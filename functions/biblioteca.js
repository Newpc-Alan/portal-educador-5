// Biblioteca do Portal 5.0: importa UM título da triagem (Google Drive -> Storage) depois que um administrador
// confirma a licença. A confirmação (tipo, observação, quem e quando) fica gravada no próprio livro.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave pública que já estava nas páginas antigas da Webnode
const REFERER = 'https://www.portaldoeducador.com.br/';
const LICENCAS = ['dominio-publico', 'licenca-aberta', 'licenciada', 'propria'];
const EXT = { pdf: 'pdf', audio: 'mp3', cbz: 'cbz' };
const CT = { pdf: 'application/pdf', audio: 'audio/mpeg', cbz: 'application/zip' };

async function exigirAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Somente administrador.');
  return u;
}
async function baixarStream(id) {
  const fontes = [`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${CHAVE}`, `https://drive.google.com/uc?export=download&confirm=t&id=${id}`];
  for (let t = 0; t < 3; t++) {
    for (const u of fontes) {
      try {
        const ac = new AbortController(), limite = setTimeout(() => ac.abort(), 60000); // só para a conexão; o download em si pode demorar
        const r = await fetch(u, { headers: { Referer: REFERER }, redirect: 'follow', signal: ac.signal }).finally(() => clearTimeout(limite));
        const tipo = r.headers.get('content-type') || '';
        if (r.ok && !tipo.startsWith('text/html')) return r;
      } catch (e) {}
    }
    await new Promise(ok => setTimeout(ok, 2000 * (t + 1)));
  }
  throw new HttpsError('unavailable', 'O Google Drive não entregou o arquivo. Tente de novo em alguns minutos.');
}
async function salvar(bucket, caminho, resposta, tipo) {
  const token = randomUUID();
  const arq = bucket.file(caminho);
  await pipeline(Readable.fromWeb(resposta.body), arq.createWriteStream({ resumable: true, contentType: tipo,
    metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } }));
  const [meta] = await arq.getMetadata();
  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`, tamanho: Number(meta.size || 0) };
}
async function capa(bucket, id, base) {
  for (const u of [`https://drive.google.com/thumbnail?id=${id}&sz=w600`, `https://lh3.googleusercontent.com/d/${id}=w600`]) {
    try {
      const r = await fetch(u, { headers: { Referer: REFERER }, signal: AbortSignal.timeout(30000) });
      const tipo = r.headers.get('content-type') || '';
      if (r.ok && tipo.startsWith('image/')) return (await salvar(bucket, base + '-capa.' + (tipo.includes('png') ? 'png' : 'jpg'), r, tipo)).url;
    } catch (e) {}
  }
  return '';
}

export const importarBiblioteca = onCall({ region: 'southamerica-east1', timeoutSeconds: 540, memory: '1GiB' }, async (req) => {
  const adm = await exigirAdmin(req);
  return importarTitulo(req.data || {}, { uid: req.auth.uid, nome: adm.nome || '' });
});

// Também usada pelo script scripts/aprovar-biblioteca.mjs (aprovação feita pelo administrador fora do painel).
export async function importarTitulo(dados, quem) {
  const { id, licenca, obs, titulo, autor, etapa } = dados;
  if (typeof id !== 'string' || !/^[\w-]{10,80}$/.test(id)) throw new HttpsError('invalid-argument', 'Título inválido.');
  if (!LICENCAS.includes(licenca)) throw new HttpsError('invalid-argument', 'Informe o tipo de licença.');
  const db = getFirestore(), tref = db.doc(`biblioteca_triagem/${id}`);
  const t = (await tref.get()).data();
  if (!t) throw new HttpsError('not-found', 'Título não está na triagem.');
  if (t.status === 'importado') return { ok: true, ja: true, livroId: t.livro_id };
  if (t.sugestao === 'comercial' && licenca !== 'licenciada')
    throw new HttpsError('failed-precondition', 'Obra comercial só entra como "licenciada", com contrato ou autorização da editora ou do autor.');
  await tref.update({ status: 'importando', atualizado_em: FieldValue.serverTimestamp() });
  const bucket = getStorage().bucket();
  const base = `biblioteca/${t.secao}/${id}`;
  try {
    let arquivo = {}, paginas = [];
    if (t.tipo === 'imagens') {
      for (let i = 0; i < (t.paginas || []).length; i++) {
        const r = await baixarStream(t.paginas[i]);
        const tipo = r.headers.get('content-type') || 'image/jpeg';
        paginas.push((await salvar(bucket, `${base}/p${String(i + 1).padStart(3, '0')}.${tipo.includes('png') ? 'png' : 'jpg'}`, r, tipo)).url);
      }
      arquivo = { tamanho: t.tamanho || 0 };
    } else {
      arquivo = await salvar(bucket, `${base}.${EXT[t.tipo] || 'bin'}`, await baixarStream(id), CT[t.tipo] || 'application/octet-stream');
    }
    const capa_url = t.tipo === 'imagens' ? paginas[0] : t.tipo === 'audio' ? '' : await capa(bucket, id, base);
    const livro = {
      titulo: String(titulo || t.titulo || '').slice(0, 160), autor: String(autor || '').slice(0, 120), etapa: String(etapa || '').slice(0, 60),
      secao: t.secao, tipo: t.tipo, url: arquivo.url || '', paginas, capa_url, tamanho: arquivo.tamanho || t.tamanho || 0,
      publicado: true, drive_id: id,
      licenca: { tipo: licenca, obs: String(obs || '').slice(0, 400), aprovado_por: quem.uid, aprovado_nome: quem.nome || '', aprovado_em: FieldValue.serverTimestamp() },
      criado_em: FieldValue.serverTimestamp()
    };
    const lref = db.doc(`biblioteca/${id}`);
    await lref.set(livro);
    await tref.update({ status: 'importado', livro_id: id, licenca, atualizado_em: FieldValue.serverTimestamp() });
    return { ok: true, livroId: id };
  } catch (e) {
    await tref.update({ status: 'erro', erro: String(e.message || e).slice(0, 300), atualizado_em: FieldValue.serverTimestamp() }).catch(() => {});
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('internal', 'Não foi possível importar: ' + String(e.message || e).slice(0, 200));
  }
}

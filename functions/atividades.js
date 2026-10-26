// Atividades do Portal 5.0: sincroniza as pastas do Banco Curricular (Google Drive) com o acervo do Portal.
// Cada PDF vira atividades/{id} com etapa, componente, ano, BNCC e categoria tirados do caminho e do nome do arquivo,
// e o arquivo é copiado para o Storage (atividades/{etapa}/{id}.pdf) com uma miniatura da primeira página.
// Rodar de novo só traz o que é novo; arquivos repetidos em pastas diferentes viram uma atividade só.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave pública que já estava nas páginas antigas da Webnode
const REFERER = 'https://www.portaldoeducador.com.br/';
// raízes de cada etapa no Drive (as mesmas da página Banco Curricular da Webnode)
export const RAIZES = {
  infantil: '1uNXhR4t2fTnLePpBofcqoOv7JihkxVhu', alfa: '1TcepN1czXDDcezZk5bmU_sziSnpaem12', iniciais: '1YF6QsJicwaBMnS9XDBYv2mrP-t3JgmYH',
  finais: '10nD0GDEy-F9Wo0VQAJrucCaTdMnaug_I', medio: '1eRrVbxEZeqYe9x1Hk1BWcYQridnhrUMS', inclusiva: '1wZFlZRHQ6NU_qPBuRllal7Xg6_xs2mvb'
};
const PASTA = 'application/vnd.google-apps.folder';
const ACEITOS = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

// ---------- nomes: conserta acentos quebrados (UTF-8 lido como CP437 ao extrair .zip) ----------
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const DE437 = new Map([...CP437].map((c, i) => [c, 128 + i]));
export function consertarAcentos(s) {
  s = String(s || '');
  if (!/[├┬╞╟]/.test(s)) return s;
  const bytes = [];
  for (const c of s) { const cp = c.codePointAt(0); if (cp < 128) bytes.push(cp); else if (DE437.has(c)) bytes.push(DE437.get(c)); else return s; }
  const t = Buffer.from(bytes).toString('utf8');
  return t.includes('�') ? s : t;
}
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// componentes: nome da pasta -> nome oficial
const COMPONENTES = [
  [/^lingua portuguesa|^portugues/, 'Língua Portuguesa'], [/^matematica/, 'Matemática'], [/^ciencias/, 'Ciências'], [/^historia/, 'História'],
  [/^geografia/, 'Geografia'], [/^arte/, 'Arte'], [/^educacao fisica/, 'Educação Física'], [/^lingua inglesa|^ingles/, 'Língua Inglesa'],
  [/^ensino religioso/, 'Ensino Religioso'], [/^espanhol/, 'Espanhol'], [/^educacao financeira/, 'Educação Financeira'],
  [/^corpo, gestos/, 'Corpo, Gestos e Movimentos'], [/^escuta, fala/, 'Escuta, Fala, Pensamento e Imaginação'], [/^o eu, o outro/, 'O Eu, o Outro e o Nós'],
  [/^espacos, tempos/, 'Espaços, Tempos, Quantidades, Relações e Transformações'], [/^tracos, sons/, 'Traços, Sons, Cores e Formas'],
  [/^linguagem e alfabetizacao/, 'Linguagem e Alfabetização'], [/^movimento/, 'Movimento'], [/^musicaliza/, 'Musicalização'], [/^natureza/, 'Natureza'],
  [/^biologia/, 'Biologia'], [/^fisica/, 'Física'], [/^quimica/, 'Química'], [/^filosofia/, 'Filosofia'], [/^sociologia/, 'Sociologia']
];
function componenteDe(pasta) {
  const p = semAcento(consertarAcentos(pasta)).replace(/[^\p{L}\p{N}, ]/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, nome] of COMPONENTES) if (re.test(p)) return nome;
  const limpo = consertarAcentos(pasta).replace(/[^\p{L}\p{N}, ]/gu, ' ').replace(/\(.*\)/, '').replace(/\s+/g, ' ').trim();
  return limpo ? limpo[0].toUpperCase() + limpo.slice(1) : 'Outros';
}
const CATEGORIAS = { fixacao: 'Fixação', avaliacao: 'Avaliação', revisao: 'Revisão', diagnostica: 'Diagnóstica', atividade: 'Atividade', atividades: 'Atividade',
  exercicio: 'Exercícios', exercicios: 'Exercícios', desafio: 'Desafio', jogo: 'Jogo', projeto: 'Projeto', simulado: 'Simulado', recuperacao: 'Recuperação',
  sequencia: 'Sequência didática', plano: 'Plano de aula', leitura: 'Leitura', producao: 'Produção de texto', interpretacao: 'Interpretação' };
const RE_BNCC = /(?<![A-Za-z0-9])(E[IFM]\d{2}[A-Z]{2,3}\d{2,3})(?!\d)/g;
function anosDe(caminho, bncc, etapa) {
  for (const seg of [...caminho].reverse()) {
    let m = /(\d)\s*º?\s*ano/i.exec(seg) || /^(\d)ANO$/i.exec(seg) || /_(\d)ANO\b/i.exec(seg);
    if (m) return [m[1] + 'º ano'];
    m = /(\d)\s*ª\s*s[ée]rie/i.exec(seg); if (m) return [m[1] + 'ª série'];
  }
  // sem pasta de ano: usa o código BNCC quando ele aponta um ano só (EF03.. = 3º ano)
  const anos = new Set();
  for (const c of bncc) { const m = /^EF(\d)(\d)/.exec(c); if (m && m[1] === '0') anos.add(m[2] + 'º ano'); }
  if (anos.size) return [...anos];
  // educação infantil: faixa etária do código (EI01 bebês, EI02 crianças bem pequenas, EI03 pré-escola)
  const FAIXA = { '01': 'Bebês', '02': 'Crianças bem pequenas', '03': 'Pré-escola' };
  for (const c of bncc) { const m = /^EI(\d\d)/.exec(c); if (m && FAIXA[m[1]]) anos.add(FAIXA[m[1]]); }
  if (anos.size) return [...anos];
  return [];
}
// lê tudo o que dá para tirar do caminho e do nome
export function classificar(etapa, caminho, nome) {
  const nomeOk = consertarAcentos(nome);
  const base = nomeOk.replace(/\.[a-z0-9]{2,4}$/i, '');
  const bncc = [...new Set([...base.matchAll(RE_BNCC)].map(m => m[1]))];
  const comp = componenteDe(caminho[0] || '');
  let resto = base.replace(RE_BNCC, ' ').replace(/[_]+/g, ' ').replace(/-{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  let categoria = 'Atividade';
  const prim = semAcento(resto.split(' ')[0] || '');
  if (CATEGORIAS[prim]) { categoria = CATEGORIAS[prim]; resto = resto.split(' ').slice(1).join(' '); }
  resto = resto.replace(/^[-–\s]+|[-–\s]+$/g, '');
  let titulo = resto || comp;
  if (titulo.length > 6 && titulo === titulo.toUpperCase()) titulo = titulo.toLowerCase();   // NOME TODO EM MAIÚSCULAS
  titulo = titulo[0].toUpperCase() + titulo.slice(1);
  const plano = caminho.some(s => /plano/i.test(semAcento(s))) || categoria === 'Plano de aula';
  return { titulo: titulo.slice(0, 160), componente: comp, anos: anosDe(caminho, bncc, etapa), bncc, categoria, tipo: plano ? 'plano' : 'atividade' };
}
// chave para juntar o mesmo arquivo copiado em pastas diferentes
const chaveDup = (etapa, comp, nome) => etapa + '|' + comp + '|' + semAcento(consertarAcentos(nome)).replace(/[^a-z0-9]+/g, '');

// ---------- Drive ----------
async function listar(pai) {
  const out = []; let tok = '';
  do {
    const u = `https://www.googleapis.com/drive/v3/files?q='${pai}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=1000&key=${CHAVE}` + (tok ? '&pageToken=' + tok : '');
    let r;
    for (let t = 0; t < 3; t++) { r = await fetch(u, { headers: { Referer: REFERER } }); if (r.ok) break; await new Promise(ok => setTimeout(ok, 1500 * (t + 1))); }
    if (!r.ok) throw new Error('Drive ' + r.status);
    const j = await r.json(); out.push(...(j.files || [])); tok = j.nextPageToken;
  } while (tok);
  return out;
}
// todos os arquivos aceitos de uma etapa, com o caminho das pastas
export async function listarEtapa(etapa) {
  const fila = [[RAIZES[etapa], []]], arquivos = [];
  while (fila.length) {
    const [pai, cam] = fila.shift();
    for (const f of await listar(pai)) {
      if (f.mimeType === PASTA) fila.push([f.id, [...cam, f.name]]);
      else if (ACEITOS[f.mimeType] && cam.length) arquivos.push({ ...f, etapa, caminho: cam });
    }
  }
  return arquivos;
}
// agrupa as cópias: prefere a da pasta "Nº Ano/Atividades" (a organização oficial)
export function agrupar(arquivos) {
  const g = new Map();
  for (const f of arquivos) {
    const comp = componenteDe(f.caminho[0]), k = chaveDup(f.etapa, comp, f.name);
    const peso = f.caminho.some(s => /\dº\s*ano|atividades/i.test(s)) ? 0 : 1;
    const x = g.get(k);
    if (!x) g.set(k, { principal: f, peso, ids: [f.id] });
    else { x.ids.push(f.id); if (peso < x.peso) { x.principal = f; x.peso = peso; } }
  }
  return [...g.values()];
}
async function baixar(id) {
  const fontes = [`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${CHAVE}`, `https://drive.google.com/uc?export=download&confirm=t&id=${id}`];
  for (let t = 0; t < 3; t++) {
    for (const u of fontes) {
      try {
        const r = await fetch(u, { headers: { Referer: REFERER }, redirect: 'follow', signal: AbortSignal.timeout(120000) });
        if (r.ok && !(r.headers.get('content-type') || '').startsWith('text/html')) return r;
      } catch (e) {}
    }
    await new Promise(ok => setTimeout(ok, 2000 * (t + 1)));
  }
  throw new Error('o Drive não entregou o arquivo');
}
async function salvar(bucket, caminho, resposta, tipo) {
  const token = randomUUID(), arq = bucket.file(caminho);
  await pipeline(Readable.fromWeb(resposta.body), arq.createWriteStream({ resumable: false, contentType: tipo,
    metadata: { cacheControl: 'public, max-age=31536000', contentDisposition: 'inline', metadata: { firebaseStorageDownloadTokens: token } } }));
  const [meta] = await arq.getMetadata();
  return { url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`, tamanho: Number(meta.size || 0) };
}
async function miniatura(bucket, id, base) {
  for (const u of [`https://drive.google.com/thumbnail?id=${id}&sz=w480`, `https://lh3.googleusercontent.com/d/${id}=w480`]) {
    try {
      const r = await fetch(u, { headers: { Referer: REFERER }, signal: AbortSignal.timeout(30000) });
      const tipo = r.headers.get('content-type') || '';
      if (r.ok && tipo.startsWith('image/')) return (await salvar(bucket, base + '-mini.' + (tipo.includes('png') ? 'png' : 'jpg'), r, tipo)).url;
    } catch (e) {}
  }
  return '';
}
// importa um grupo (o arquivo principal) e grava atividades/{id}
export async function importarGrupo(grupo) {
  const f = grupo.principal, db = getFirestore(), bucket = getStorage().bucket();
  const c = classificar(f.etapa, f.caminho, f.name), ext = ACEITOS[f.mimeType];
  const base = `atividades/${f.etapa}/${f.id}`;
  const arq = await salvar(bucket, `${base}.${ext}`, await baixar(f.id), f.mimeType);
  const mini_url = ext === 'pdf' ? await miniatura(bucket, f.id, base) : arq.url;
  await db.doc(`atividades/${f.id}`).set({
    ...c, etapa: f.etapa, formato: ext, url: arq.url, mini_url, tamanho: arq.tamanho, arquivo_nome: consertarAcentos(f.name).slice(0, 200),
    caminho: f.caminho.map(consertarAcentos).join(' / ').slice(0, 300), drive_ids: grupo.ids.slice(0, 20), drive_mod: f.modifiedTime || '',
    publicado: true, origem: 'drive', criado_em: FieldValue.serverTimestamp()
  });
  return f.id;
}
// conhecidos: todos os ids do Drive que já viraram atividade (inclusive as cópias e as excluídas, para não voltarem)
export async function conhecidos() {
  const db = getFirestore(), ids = new Set();
  (await db.collection('atividades').select('drive_ids').get()).forEach(d => { ids.add(d.id); (d.get('drive_ids') || []).forEach(x => ids.add(x)); });
  (await db.collection('atividades_ignoradas').get()).forEach(d => ids.add(d.id));
  return ids;
}
// contagem por etapa/componente/ano para a tela inicial (evita ler milhares de documentos)
export async function atualizarResumo() {
  const db = getFirestore(), r = { total: 0, etapas: {} };
  (await db.collection('atividades').where('publicado', '==', true).select('etapa', 'componente', 'anos', 'tipo').get()).forEach(d => {
    const x = d.data(), e = (r.etapas[x.etapa] = r.etapas[x.etapa] || { n: 0, componentes: {} }), c = (e.componentes[x.componente] = e.componentes[x.componente] || { n: 0, anos: {}, planos: 0 });
    r.total++; e.n++; c.n++; if (x.tipo === 'plano') c.planos++;
    (x.anos && x.anos.length ? x.anos : ['sem']).forEach(a => { c.anos[a] = (c.anos[a] || 0) + 1; });
  });
  await db.doc('config/atividades_resumo').set({ ...r, atualizado_em: FieldValue.serverTimestamp() });
  return r;
}
// uma rodada: lista o Drive, separa o que é novo e importa até "limite"
export async function sincronizar({ limite = 40, etapas = Object.keys(RAIZES), log = () => {} } = {}) {
  const ja = await conhecidos(), novos = [];
  for (const e of etapas) {
    const grupos = agrupar(await listarEtapa(e));
    grupos.filter(g => !g.ids.some(id => ja.has(id))).forEach(g => novos.push(g));
    log(e + ': ' + grupos.length + ' atividades no Drive');
  }
  let ok = 0, erro = 0; const erros = [];
  for (const g of novos.slice(0, limite)) {
    try { await importarGrupo(g); ok++; log('OK ' + g.principal.etapa + ' · ' + consertarAcentos(g.principal.name)); }
    catch (e) { erro++; erros.push(consertarAcentos(g.principal.name) + ': ' + e.message); log('ERRO ' + g.principal.name + ' ' + e.message); }
  }
  if (ok) await atualizarResumo();
  return { novos: novos.length, importadas: ok, erros: erro, restantes: Math.max(0, novos.length - ok - erro), detalhes: erros.slice(0, 10) };
}

export const sincronizarAtividades = onCall({ region: 'southamerica-east1', timeoutSeconds: 540, memory: '1GiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Somente administrador.');
  if (req.data && req.data.resumo) return { resumo: (await atualizarResumo()).total };
  const limite = Math.min(60, Math.max(1, Number((req.data || {}).limite) || 40));
  try { return await sincronizar({ limite }); }
  catch (e) { throw new HttpsError('unavailable', 'Não foi possível ler o Drive agora: ' + String(e.message || e).slice(0, 150)); }
});

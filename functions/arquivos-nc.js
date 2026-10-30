// Arquivos do acervo guardados no servidor próprio da NEWPC (Nextcloud).
// O Firebase decide QUEM pode abrir (mesmas regras do acervo no banco e no Storage);
// o servidor da NEWPC só ENTREGA, depois de conferir a assinatura do link.
// O link vale poucos minutos e não carrega nenhum dado do usuário.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { createHmac } from 'node:crypto';

const CHAVE = defineSecret('NC_ENTREGA_CHAVE');
const BASE = defineString('NC_ENTREGA_URL', { default: 'https://cloud.portaldoeducador.com.br/pde/arquivo.php' });

// Janela do link: termina no próximo múltiplo de 10 minutos, com no mínimo 5 minutos de folga.
// Assim, quem abre o mesmo arquivo na mesma janela recebe o mesmo endereço (bom para cache no futuro).
const JANELA = 600, FOLGA = 300;
export function validade(agoraSeg) {
  return Math.ceil((agoraSeg + FOLGA) / JANELA) * JANELA;
}

// Caminho relativo à pasta raiz do Drive Portal do Educador. Sem "..", sem barra inicial, sem barra invertida.
export function caminhoValido(c) {
  if (typeof c !== 'string' || !c || c.length > 500) return false;
  if (c.startsWith('/') || /[\\\0\r\n]/.test(c)) return false;
  return c.split('/').every(p => p && p !== '.' && p !== '..');
}

// Mesmo cálculo do arquivo.php: v1, caminho, validade e nome do arquivo, separados por quebra de linha.
export function assinar(caminho, exp, nome, chave) {
  return createHmac('sha256', String(chave).trim()).update(`v1\n${caminho}\n${exp}\n${nome}`).digest('base64url');
}

export function montarLink(base, caminho, exp, nome, chave) {
  const q = new URLSearchParams({ c: caminho, e: String(exp), n: nome, s: assinar(caminho, exp, nome, chave) });
  return `${base}?${q.toString()}`;
}

const ms = v => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);
const nomeSeguro = (n, caminho) => String(n || caminho.split('/').pop()).replace(/[\r\n"\\/]/g, ' ').trim().slice(0, 150) || 'arquivo';

// Espelha as regras: professor licenciado (institucional com contrato vigente, ou avulsa no prazo),
// equipe da rede (secretaria/gestor do município) e aluno só em Datas e Histórias, se a rede liberar.
export function podeAcervo(u, m, item, agora = Date.now()) {
  if (!u || u.status !== 'ativo') return false;
  if (u.perfil === 'admin') return true;
  if (item.publicado !== true) return false;
  const contratoOk = !ms(m?.vigencia_fim_ts) || ms(m.vigencia_fim_ts) > agora;
  const tipo = u.licenca_tipo || 'institucional';
  if (u.perfil === 'professor') {
    if (tipo === 'institucional') return !!u.escola_id && !!u.municipio_id && contratoOk;
    return ms(u.licenca_fim) > agora;
  }
  if (u.perfil === 'secretaria' || u.perfil === 'gestor') return !!u.municipio_id;
  if (u.perfil === 'aluno') {
    if (!u.municipio_id || !contratoOk || !['datas', 'historias'].includes(item.modulo)) return false;
    const lib = Array.isArray(m?.modulos_aluno) ? m.modulos_aluno : [];
    return !lib.length || lib.includes(item.modulo);
  }
  return false;
}

// Acervo da rede: só quem é do município (aluno não); a Secretaria também abre o que ainda não publicou.
export function podeAcervoRede(u, item) {
  if (!u || u.status !== 'ativo') return false;
  if (u.perfil === 'admin') return true;
  if (u.perfil === 'aluno' || !u.municipio_id || u.municipio_id !== item.municipio_id) return false;
  return item.publicado === true || u.perfil === 'secretaria';
}

export const linkArquivoNc = onCall({ region: 'southamerica-east1', secrets: [CHAVE], maxInstances: 20, timeoutSeconds: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const colecao = String(req.data?.colecao || ''), id = String(req.data?.id || '');
  if (!['acervo', 'acervo_rede'].includes(colecao) || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
    throw new HttpsError('invalid-argument', 'Arquivo inválido.');
  const db = getFirestore();
  const [us, is] = await Promise.all([db.doc(`usuarios/${req.auth.uid}`).get(), db.doc(`${colecao}/${id}`).get()]);
  const u = us.data(), item = is.data();
  if (!item) throw new HttpsError('not-found', 'Arquivo não encontrado.');
  let ok;
  if (colecao === 'acervo') {
    const m = u?.municipio_id ? (await db.doc(`municipios/${u.municipio_id}`).get()).data() : null;
    ok = podeAcervo(u, m, item);
  } else ok = podeAcervoRede(u, item);
  if (!ok) throw new HttpsError('permission-denied', 'Sua licença não permite abrir este arquivo.');
  const caminho = item.nc_caminho;
  if (!caminhoValido(caminho)) throw new HttpsError('failed-precondition', 'Este arquivo não está no servidor da NEWPC.');
  const exp = validade(Math.floor(Date.now() / 1000));
  return { url: montarLink(BASE.value(), caminho, exp, nomeSeguro(item.arquivo_nome, caminho), CHAVE.value()), expira: exp };
});

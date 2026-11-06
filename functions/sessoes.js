// Aparelhos conectados (nov/2026): quantos aparelhos cada conta usa ao mesmo tempo.
// Aluno: 1 (entrou em outro, o anterior sai sozinho: nada de cartão emprestado, presença ou quiz por outra pessoa).
// Professor e equipe: até 3 (Lousa na sala, notebook com o painel, celular no bolso); no 4º sai o usado há mais tempo.
// Os limites ficam em config/sessoes ({ aluno, professor, padrao, admin }) para mudar sem mexer no código.
// Cada navegador tem um número (sid) guardado no próprio aparelho; a lista fica em sessoes/{uid} e só esta função grava.
// O aparelho que sai da lista percebe pelo próprio vigia (onSnapshot) e sai da conta com o aviso.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { expiraAuditoria } from './auditoria.js';

const REGIAO = 'southamerica-east1';
export const LIMITES_PADRAO = { aluno: 1, professor: 3, padrao: 3, admin: 5 };
const SID = /^[A-Za-z0-9_-]{16,40}$/;
const MAX_DIAS = 30;

// tipo de aparelho pelo navegador (só para a lista ficar legível: nada de identificar a pessoa)
export function tipoAparelho(ua) {
  const u = String(ua || '');
  if (/CrOS/.test(u)) return 'Chromebook';
  if (/iPad|Tablet|SM-T|Tab /i.test(u) || (/Android/.test(u) && !/Mobile/.test(u))) return 'Tablet';
  if (/Mobile|iPhone|Android/.test(u)) return 'Celular';
  return 'Computador';
}
export function navegador(ua) {
  const u = String(ua || '');
  return /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Navegador';
}
export const limiteDoPerfil = (perfil, cfg = {}) => {
  const L = { ...LIMITES_PADRAO, ...cfg };
  const n = perfil === 'aluno' ? L.aluno : perfil === 'admin' ? L.admin : perfil === 'professor' ? L.professor : L.padrao;
  return Math.max(1, Math.min(10, Math.round(Number(n)) || 1));
};

// regra pura (testável): entra este aparelho; tira os vencidos e, passando do limite, os usados há mais tempo
export function entrarNaLista(lista, { sid, agora, limite, tipo, nav }) {
  const vivos = (Array.isArray(lista) ? lista : []).filter(s => s && SID.test(String(s.sid || '')) && agora - (s.ultimo || 0) < MAX_DIAS * 864e5);
  const meu = vivos.find(s => s.sid === sid);
  const outros = vivos.filter(s => s.sid !== sid).sort((a, b) => (b.ultimo || 0) - (a.ultimo || 0));
  const novo = { sid, desde: meu ? meu.desde || agora : agora, ultimo: agora, tipo, nav };
  const ficam = [novo, ...outros.slice(0, Math.max(0, limite - 1))];
  const sairam = outros.slice(Math.max(0, limite - 1));
  return { lista: ficam, sairam };
}

export const sessaoAparelho = onCall({ region: REGIAO, maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const d = req.data || {}, uid = req.auth.uid, sid = String(d.sid || '');
  if (!SID.test(sid)) throw new HttpsError('invalid-argument', 'Aparelho inválido.');
  const db = getFirestore(), ref = db.doc(`sessoes/${uid}`), agora = Date.now();
  const acao = ['entrar', 'sair', 'sair_outros'].includes(d.acao) ? d.acao : 'entrar';
  // perfil: aluno pelo login do cartão/código (claims) ou pelo cadastro
  let perfil = uid.startsWith('al-') || (req.auth.token && req.auth.token.aluno_id) ? 'aluno' : '';
  if (!perfil) { const u = (await db.doc(`usuarios/${uid}`).get()).data() || {}; perfil = u.perfil || 'professor'; }
  const cfg = (await db.doc('config/sessoes').get()).data() || {};
  const limite = limiteDoPerfil(perfil, cfg);
  const ua = req.rawRequest && req.rawRequest.headers ? req.rawRequest.headers['user-agent'] : '';
  const r = await db.runTransaction(async t => {
    const x = await t.get(ref), lista = (x.exists && x.data().lista) || [];
    if (acao === 'sair') { const l = lista.filter(s => s.sid !== sid); t.set(ref, { lista: l, atualizado_em: FieldValue.serverTimestamp() }); return { lista: l, sairam: [] }; }
    if (acao === 'sair_outros') {
      const meu = lista.find(s => s.sid === sid) || { sid, desde: agora, ultimo: agora, tipo: tipoAparelho(ua), nav: navegador(ua) };
      t.set(ref, { lista: [meu], atualizado_em: FieldValue.serverTimestamp() }); return { lista: [meu], sairam: lista.filter(s => s.sid !== sid) };
    }
    const res = entrarNaLista(lista, { sid, agora, limite, tipo: tipoAparelho(ua), nav: navegador(ua) });
    t.set(ref, { lista: res.lista, perfil, limite, atualizado_em: FieldValue.serverTimestamp() });
    return res;
  });
  if (r.sairam.length) await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'sessoes', doc: uid,
    autor_uid: uid, autor_tipo: 'usuario', perfil, detalhe: (acao === 'sair_outros' ? 'Saiu dos outros aparelhos: ' : 'Entrou em outro aparelho (limite ' + limite + '); saiu de: ') + r.sairam.map(s => s.tipo + ' ' + s.nav).join(', '), campos: [], valores: {} }).catch(e => console.warn('auditoria sessão:', e.message));
  return { limite, lista: r.lista.map(s => ({ ...s, eu: s.sid === sid })) };
});

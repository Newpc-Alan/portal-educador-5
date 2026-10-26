// Senha provisória: quando o servidor não consegue entrar (esqueceu a senha, problema com a conta Google),
// alguém da rede gera uma senha provisória do próprio Portal para o mesmo e-mail.
// - Quem pode: admin (qualquer servidor, menos outro admin), secretaria (do seu município) e gestor (professores e equipe das escolas dele).
// - A senha aparece uma única vez para quem gerou e vale 24 h. No primeiro login com ela, o servidor é obrigado a criar a própria senha.
// - Se não for trocada em 24 h, a função de limpeza troca por uma senha aleatória: a provisória deixa de funcionar.
// - A conta Google do servidor não é afetada: ele continua podendo entrar com o Google.
// - Tudo fica na auditoria (quem gerou, para quem, quando). A senha nunca é gravada.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { randomInt, randomBytes } from 'node:crypto';

const VALIDADE_H = 24;
const COTA_DIA = 30;                                 // por pessoa que gera
const PERFIS_EQUIPE = ['professor', 'secretaria_escolar', 'portaria'];
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// senha fácil de ditar: 3 blocos de 4 (sem 0/O, 1/l/I), sempre com letra maiúscula, minúscula e número
export function gerarSenha() {
  for (;;) {
    let s = ''; for (let i = 0; i < 12; i++) s += ALFA[randomInt(ALFA.length)];
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  }
}
export function senhaForte(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 64 && /[A-Za-z]/.test(s) && /\d/.test(s);
}
const escolasDe = u => [...new Set([...(u.escolas_ids || []), u.escola_id].filter(Boolean))];

// regra de quem pode gerar para quem
export function podeResetar(eu, alvo, euUid, alvoUid) {
  if (!eu || eu.status !== 'ativo' || !alvo || euUid === alvoUid) return false;
  if (alvo.perfil === 'aluno' || alvo.perfil === 'admin') return eu.perfil === 'admin' && alvo.perfil !== 'admin';
  if (eu.perfil === 'admin') return true;
  if (eu.perfil === 'secretaria') return !!eu.municipio_id && alvo.municipio_id === eu.municipio_id && ['gestor', ...PERFIS_EQUIPE].includes(alvo.perfil);
  if (eu.perfil === 'gestor') return !!eu.municipio_id && alvo.municipio_id === eu.municipio_id && PERFIS_EQUIPE.includes(alvo.perfil)
    && escolasDe(alvo).some(e => escolasDe(eu).includes(e));
  return false;
}

export async function gerar({ db, auth, uid, email }) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@\/]{1,64}@[^\s@\/]{1,190}$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
  let conta; try { conta = await auth.getUserByEmail(email); } catch (e) { throw new HttpsError('not-found', 'Este e-mail ainda não tem conta no Portal. Peça para a pessoa entrar uma primeira vez, com o Google ou pelo cadastro.'); }
  const [es, as] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`usuarios/${conta.uid}`).get()]);
  if (!as.exists) throw new HttpsError('not-found', 'Este e-mail tem conta, mas ainda não tem cadastro no Portal.');
  const eu = es.data(), alvo = as.data();
  if (!podeResetar(eu, alvo, uid, conta.uid)) throw new HttpsError('permission-denied', 'Você não pode gerar senha para este usuário.');
  if (alvo.status !== 'ativo') throw new HttpsError('failed-precondition', 'Este cadastro não está ativo. Ative antes de gerar a senha.');
  const cota = db.doc(`senhas_cota/${uid}_${hojeMS()}`);
  await db.runTransaction(async tx => { const n = ((await tx.get(cota)).data() || {}).n || 0; if (n >= COTA_DIA) throw new HttpsError('resource-exhausted', 'Limite diário de senhas provisórias atingido.'); tx.set(cota, { n: n + 1, uid, dia: hojeMS() }); });
  const senha = gerarSenha(), expira = Timestamp.fromMillis(Date.now() + VALIDADE_H * 3600e3);
  await auth.updateUser(conta.uid, { password: senha });
  await db.doc(`senhas_provisorias/${conta.uid}`).set({ email, expira_em: expira, gerada_em: FieldValue.serverTimestamp(), gerada_por: uid, gerada_por_nome: String(eu.nome || '').slice(0, 80) });
  await db.collection('auditoria').add({ uid, acao: 'senha_provisoria', alvo: conta.uid, alvo_email: email, em: FieldValue.serverTimestamp() });
  return { senha, expira_ms: expira.toMillis(), nome: alvo.nome || email, google: conta.providerData.some(p => p.providerId === 'google.com') };
}

export async function trocar({ db, auth, uid, provedor, nova }) {
  if (provedor !== 'password') throw new HttpsError('failed-precondition', 'Entre com a senha provisória para trocar.');
  const ref = db.doc(`senhas_provisorias/${uid}`), p = (await ref.get()).data();
  if (!p) throw new HttpsError('failed-precondition', 'Não há senha provisória para trocar.');
  if (p.expira_em.toMillis() < Date.now()) throw new HttpsError('deadline-exceeded', 'A senha provisória venceu. Peça uma nova à escola ou à Secretaria.');
  if (!senhaForte(nova)) throw new HttpsError('invalid-argument', 'A nova senha precisa ter pelo menos 8 caracteres, com letras e números.');
  await auth.updateUser(uid, { password: nova });
  await ref.delete();
  await db.collection('auditoria').add({ uid, acao: 'senha_trocada', em: FieldValue.serverTimestamp() });
  return { ok: true };
}

export const senhaProvisoria = onCall({ region: 'southamerica-east1', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return gerar({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, email: (req.data || {}).email });
});
export const trocarSenhaProvisoria = onCall({ region: 'southamerica-east1', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return trocar({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, provedor: req.auth.token.firebase && req.auth.token.firebase.sign_in_provider, nova: (req.data || {}).nova });
});
// a cada hora: provisória vencida e não trocada deixa de funcionar
export const expirarSenhasProvisorias = onSchedule({ schedule: '15 * * * *', timeZone: 'America/Campo_Grande', region: 'southamerica-east1' }, async () => {
  const db = getFirestore(), auth = getAuth();
  const sn = await db.collection('senhas_provisorias').where('expira_em', '<', Timestamp.now()).limit(200).get();
  for (const d of sn.docs) {
    try { await auth.updateUser(d.id, { password: randomBytes(24).toString('base64url') + '9a' }); } catch (e) { if (e.code !== 'auth/user-not-found') { console.warn(d.id, e.code); continue; } }
    await d.ref.delete();
  }
  console.log('senhas provisórias expiradas:', sn.size);
});

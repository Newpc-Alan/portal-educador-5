// Jogos do Portal (Motor de Jogos, nov/2026): guarda o resultado de cada rodada POR HABILIDADE da BNCC, para o professor
// ver quem precisa de reforço. Sem nome: só o código do aluno (ou do professor que jogou na lousa com a turma), a turma e a escola.
// Uma rodada = um documento em jogo_resultados. Limite de 80 rodadas por pessoa por dia (proteção contra abuso).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const t = (v, n) => String(v ?? '').replace(/[^\w\-.: ]/g, '').trim().slice(0, n);
const n0 = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

export const jogoResultado = onCall({ region: 'southamerica-east1', memory: '256MiB', maxInstances: 10, timeoutSeconds: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const jogo = t(d.jogo, 40).toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(jogo)) throw new HttpsError('invalid-argument', 'Jogo inválido.');
  const u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Cadastro inativo.');
  const habs = (Array.isArray(d.habs) ? d.habs : []).slice(0, 12).map(h => ({ h: t(h && h.h, 12).toUpperCase(), c: n0(h && h.c, 60), t: n0(h && h.t, 60) })).filter(h => h.h && h.t > 0 && h.c <= h.t);
  const total = n0(d.total, 60), acertos = Math.min(total, n0(d.acertos, 60));
  if (!total || !habs.length) return { ok: false };
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10), lim = db.doc(`jogo_limite/${uid}_${dia}`);
  const n = await db.runTransaction(async tx => { const x = await tx.get(lim), v = (x.exists ? x.data().n || 0 : 0) + 1; if (v > 80) return -1; tx.set(lim, { uid, dia, n: v }, { merge: true }); return v; });
  if (n < 0) return { ok: false };
  const aluno = u.perfil === 'aluno';
  await db.collection('jogo_resultados').add({
    jogo, dia, em: FieldValue.serverTimestamp(), modo: ['solo', 'dupla', 'turma'].includes(d.modo) ? d.modo : 'solo',
    perfil: aluno ? 'aluno' : 'equipe', uid, aluno_id: aluno ? String((req.auth.token && req.auth.token.aluno_id) || u.aluno_id || '') : '',
    turma_id: aluno ? String(u.turma_id || '') : '', escola_id: String(u.escola_id || ''), municipio_id: String(u.municipio_id || ''),
    nivel: n0(d.nivel, 20), niveis: n0(d.niveis, 20), duracao_s: n0(d.duracao, 7200), acertos, total, habs
  });
  return { ok: true };
});

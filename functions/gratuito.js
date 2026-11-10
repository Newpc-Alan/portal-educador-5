// Plano Gratuito do professor (nov/2026). Decisão do Alan: o Portal tem entrada gratuita e permanente.
// Quem se cadastra sozinho usa tudo por 7 dias (teste) e, quando o teste ou a licença paga vence, NÃO perde o acesso:
// passa para o Gratuito (licenca_tipo 'gratuito', plano_avulso 'gratuito', licenca_fim em 2100 para os portões de prazo).
//   Gratuito: conteúdos do Básico + Portal IA com 10 créditos por mês (config/portal_ia.creditos.gratuito_mes) + Provas impressas (5 guardadas).
//   Os créditos do mês valem até o último dia do mês e não acumulam. Uma vez por e-mail e por mês (creditos_gratuito/{e-mail}_{AAAA-MM}).
// Professor de rede contratante não muda: segue o plano da rede, sem custo para ele.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { saldoDe, cfgCreditos } from './creditos.js';

const REGIAO = 'southamerica-east1';
export const GRATUITO_FIM = Date.UTC(2100, 0, 1, 4);
const VENCE = ['teste', 'avulsa', 'cortesia'];
const ms = t => t && t.toMillis ? t.toMillis() : 0;
const mesDe = t => new Date(t - 4 * 3600e3).toISOString().slice(0, 7);
// último instante do mês corrente no horário de MS (UTC-4)
const fimDoMes = t => { const d = new Date(t - 4 * 3600e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 4) - 1; };
const txt = (v, n) => String(v ?? '').slice(0, n);

export async function creditosGratuito(db, uid, u) {
  const raw = (await db.doc('config/portal_ia').get()).data() || {};
  const n = Math.max(0, Math.min(200, Math.round(Number(((raw.creditos || {}).gratuito_mes) ?? 10)) || 0));
  if (!n) return { ok: false, motivo: 'desligado' };
  const agora = Date.now(), mes = mesDe(agora), email = String(u.email || '').trim().toLowerCase();
  const marca = db.doc('creditos_gratuito/' + ((email || uid).replace(/\//g, '_')) + '_' + mes), ref = db.doc('creditos/prof_' + uid);
  return db.runTransaction(async t => {
    const [mk, c] = await Promise.all([t.get(marca), t.get(ref)]);
    if (mk.exists) return { ok: false, motivo: 'ja_recebeu' };
    const atual = c.exists ? c.data() : {}, val = Timestamp.fromMillis(fimDoMes(agora));
    // pacotes vencidos do Gratuito saem da lista (os créditos do mês não acumulam)
    const pac = (atual.pacotes || []).filter(p => !(p.origem === 'gratuito' && ms(p.validade) < agora))
      .concat([{ id: 'grat' + mes.replace('-', ''), creditos: n, restante: n, validade: val, origem: 'gratuito', obs: 'Plano Gratuito · ' + mes, criado_em: Timestamp.now(), por: 'sistema' }]);
    t.set(ref, { tipo: 'professor', ref_id: uid, nome: txt(u.nome || email, 120), pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo, atualizado_em: FieldValue.serverTimestamp(),
      ...(c.exists ? {} : { criado_em: FieldValue.serverTimestamp() }) }, { merge: true });
    t.set(ref.collection('movimentos').doc(), { tipo: 'recarga', creditos: n, validade: val, obs: 'Plano Gratuito · ' + mes, por: 'sistema', em: FieldValue.serverTimestamp() });
    t.set(marca, { uid, creditos: n, em: FieldValue.serverTimestamp() });
    return { ok: true, creditos: n };
  });
}

export async function virarGratuito(db, uid, u) {
  await db.doc('usuarios/' + uid).update({ licenca_tipo: 'gratuito', plano_avulso: 'gratuito', licenca_plano: 'gratuito', licenca_fim: Timestamp.fromMillis(GRATUITO_FIM),
    licenca_anterior: txt(u.licenca_tipo, 20), licenca_anterior_fim: u.licenca_fim || null, gratuito_desde: FieldValue.serverTimestamp() });
  await creditosGratuito(db, uid, u).catch(e => console.warn('gratuito: créditos', uid, e.message));
}
const podeVirar = u => !!u && u.perfil === 'professor' && u.status === 'ativo' && VENCE.includes(u.licenca_tipo) && ms(u.licenca_fim) < Date.now() && u.demo !== true;

// o próprio professor, ao entrar com o teste ou a licença vencida, passa na hora para o Gratuito (sem esperar a rotina)
export const planoGratuito = onCall({ region: REGIAO, maxInstances: 10 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const u = (await db.doc('usuarios/' + uid).get()).data();
  if (d.acao === 'ativar') {
    if (u && u.licenca_tipo === 'gratuito') return { ok: true, ja: true };
    if (!podeVirar(u)) throw new HttpsError('failed-precondition', 'Seu acesso não está vencido ou não é de professor.');
    await virarGratuito(db, uid, u);
    return { ok: true };
  }
  if (d.acao === 'creditos_mes') {   // garante os créditos do mês para quem já está no Gratuito (caso a rotina do dia 1º ainda não tenha passado)
    if (!u || u.licenca_tipo !== 'gratuito') throw new HttpsError('failed-precondition', 'Só para o plano Gratuito.');
    return creditosGratuito(db, uid, u);
  }
  throw new HttpsError('invalid-argument', 'Ação inválida.');
});

// de hora em hora: teste ou licença avulsa vencida vira Gratuito
export const gratuitoVencidos = onSchedule({ schedule: 'every 60 minutes', region: REGIAO, timeZone: 'America/Campo_Grande', maxInstances: 1 }, async () => {
  const db = getFirestore();
  const s = await db.collection('usuarios').where('licenca_fim', '<', Timestamp.now()).limit(500).get();
  let n = 0;
  for (const doc of s.docs) { const u = doc.data(); if (!podeVirar(u)) continue; await virarGratuito(db, doc.id, u).catch(e => console.warn('gratuito', doc.id, e.message)); n++; }
  if (n) console.log('gratuito: ' + n + ' professor(es) passaram para o plano Gratuito');
});

// todo dia 1º, 00:30: os créditos do mês de quem está no Gratuito
export const gratuitoCreditosMes = onSchedule({ schedule: '30 0 1 * *', region: REGIAO, timeZone: 'America/Campo_Grande', timeoutSeconds: 540, maxInstances: 1 }, async () => {
  const db = getFirestore(), s = await db.collection('usuarios').where('licenca_tipo', '==', 'gratuito').get();
  let deu = 0;
  for (const doc of s.docs) { const u = doc.data(); if (u.status !== 'ativo' || u.perfil !== 'professor') continue; const r = await creditosGratuito(db, doc.id, u).catch(() => ({ ok: false })); if (r.ok) deu++; }
  console.log('gratuito: créditos do mês para ' + deu + ' professor(es)');
});

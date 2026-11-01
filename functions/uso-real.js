// Uso real do Portal: quem USOU (ação de valor) na semana, não só quem acessou.
// Conta a partir do que já fica gravado (nenhum clique novo é rastreado):
//   material do Portal IA (portal_ia_docs.criado_em), aula da Lousa salva (usuarios/{uid}/trabalhos.atualizado_em),
//   prova do Gerador (usuarios/{uid}/provas.atualizado_em), prova online aplicada (provas_online.criado_em) e provas corrigidas
//   (po_resultados), conteúdo enviado para a turma (turma_materiais/{tid}/itens.criado_em, por envio), material às famílias
//   (avisos_familia tipo material) e reaproveitamento da rede (origem_rede / modelo 'rede').
// Grava uso_real/{semana}_{municipio} e uso_real/{semana}_geral (semana ISO, segunda a domingo, horário de Campo Grande).
// Recalcula as últimas SEMANAS toda madrugada (dado que chega atrasado entra sozinho). Só o administrador lê.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const SEMANAS = 12, TZ_MS = 4 * 3600e3;   // Campo Grande = UTC-4 (sem horário de verão)
const ACOES = ['ia', 'lousa', 'prova', 'prova_online', 'correcoes', 'envio_turma', 'familias', 'reuso'];
const ms = t => (t && t.toMillis ? t.toMillis() : 0);
// início da semana (segunda 00:00 local) e o rótulo AAAA-Wnn
export function semanaDe(t) {
  const d = new Date(t - TZ_MS), dia = (d.getUTCDay() + 6) % 7;
  const seg = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia) + TZ_MS;
  const q = new Date(seg - TZ_MS + 3 * 864e5), ano = q.getUTCFullYear(), jan4 = new Date(Date.UTC(ano, 0, 4));
  const n = 1 + Math.round(((q - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { id: `${ano}-W${String(n).padStart(2, '0')}`, ini: seg };
}
async function emLotes(itens, n, fn) { const out = []; for (let i = 0; i < itens.length; i += n) out.push(...await Promise.all(itens.slice(i, i + n).map(fn))); return out; }

export async function calcularUsoReal(db, agora = Date.now()) {
  const sem0 = semanaDe(agora), desde = sem0.ini - (SEMANAS - 1) * 7 * 864e5, tsDesde = Timestamp.fromMillis(desde);
  const semanas = []; for (let i = 0; i < SEMANAS; i++) semanas.push(semanaDe(desde + i * 7 * 864e5 + 3600e3));
  // professores ativos cadastrados (base de cálculo)
  const us = await db.collection('usuarios').where('perfil', '==', 'professor').select('status', 'municipio_id', 'escola_id', 'nome').get();
  const profs = {}; us.forEach(d => { const u = d.data(); if (u.status === 'ativo') profs[d.id] = { mun: u.municipio_id || 'sem', esc: u.escola_id || '' }; });
  // ações por professor e semana
  const reg = {};   // reg[semana][uid] = {acao: n}
  const conta = (uid, t, acao, n = 1) => { if (!profs[uid] || !t || t < desde) return; const s = semanaDe(t).id; ((reg[s] = reg[s] || {})[uid] = reg[s][uid] || {}); reg[s][uid][acao] = (reg[s][uid][acao] || 0) + n; };
  const [ia, po, av] = await Promise.all([
    db.collection('portal_ia_docs').where('criado_em', '>=', tsDesde).select('uid', 'criado_em', 'modelo').get(),
    db.collection('provas_online').where('criado_em', '>=', tsDesde).select('professor_uid', 'criado_em').get(),
    db.collection('avisos_familia').where('tipo', '==', 'material').select('por_uid', 'em', 'item_id').get().catch(() => ({ docs: [] }))
  ]);
  ia.forEach(d => { const x = d.data(); conta(x.uid, ms(x.criado_em), x.modelo === 'rede' ? 'reuso' : 'ia'); });
  await emLotes(po.docs, 20, async d => { const x = d.data(); conta(x.professor_uid, ms(x.criado_em), 'prova_online');
    const c = await d.ref.collection('po_resultados').count().get().catch(() => null); if (c && c.data().count) conta(x.professor_uid, ms(x.criado_em), 'correcoes', c.data().count); });
  const envFam = new Set(); av.docs.forEach(d => { const x = d.data(), k = x.item_id || d.id; if (!envFam.has(k)) { envFam.add(k); conta(x.por_uid, ms(x.em), 'familias'); } });
  // por professor: aulas da Lousa e provas do Gerador mexidas na janela (só a data, sem baixar o conteúdo)
  await emLotes(Object.keys(profs), 25, async uid => {
    const [tr, pv] = await Promise.all([
      db.collection(`usuarios/${uid}/trabalhos`).where('atualizado_em', '>=', tsDesde).select('atualizado_em', 'origem_rede').get().catch(() => ({ docs: [] })),
      db.collection(`usuarios/${uid}/provas`).where('atualizado_em', '>=', tsDesde).select('atualizado_em', 'origem_rede').get().catch(() => ({ docs: [] }))]);
    tr.docs.forEach(d => conta(uid, ms(d.data().atualizado_em), d.data().origem_rede ? 'reuso' : 'lousa'));
    pv.docs.forEach(d => conta(uid, ms(d.data().atualizado_em), d.data().origem_rede ? 'reuso' : 'prova'));
  });
  // conteúdo enviado para a turma: um envio vale uma vez, mesmo que tenha ido para várias turmas
  const ts = await db.collection('turmas').select('status').get(), envios = new Set();
  await emLotes(ts.docs, 25, async t => {
    const it = await db.collection(`turma_materiais/${t.id}/itens`).where('criado_em', '>=', tsDesde).select('autor_uid', 'criado_em').get().catch(() => ({ docs: [] }));
    it.docs.forEach(d => { const x = d.data(); if (envios.has(d.id)) return; envios.add(d.id); conta(x.autor_uid, ms(x.criado_em), 'envio_turma'); });
  });
  // acessos (para comparar "entrou" com "usou")
  const ac = await db.collection('acessos_dia').where('dia', '>=', new Date(desde - TZ_MS).toISOString().slice(0, 10)).select('uid', 'dia').get();
  const acessou = {}; ac.forEach(d => { const x = d.data(); if (!profs[x.uid]) return; const s = semanaDe(Date.parse(x.dia + 'T12:00:00Z')).id; (acessou[s] = acessou[s] || new Set()).add(x.uid); });
  // agrega por município e geral
  const totMun = {}; Object.values(profs).forEach(p => { totMun[p.mun] = (totMun[p.mun] || 0) + 1; });
  const b = db.batch(); let n = 0;
  for (const s of semanas) {
    const r = reg[s.id] || {}, porMun = {}, geral = { semana: s.id, inicio: Timestamp.fromMillis(s.ini), professores: Object.keys(profs).length, ativos: 0, acessaram: (acessou[s.id] || new Set()).size, acoes: {} };
    for (const [uid, a] of Object.entries(r)) {
      const p = profs[uid], m = porMun[p.mun] = porMun[p.mun] || { ativos: 0, acoes: {}, escolas: {}, prof: {} };
      m.ativos++; geral.ativos++; m.prof[uid] = a;
      const e = m.escolas[p.esc || 'sem'] = m.escolas[p.esc || 'sem'] || { ativos: 0 }; e.ativos++;
      for (const [k, v] of Object.entries(a)) { m.acoes[k] = (m.acoes[k] || 0) + v; geral.acoes[k] = (geral.acoes[k] || 0) + v; }
    }
    geral.por_municipio = Object.fromEntries(Object.keys(totMun).map(mun => [mun, { professores: totMun[mun], ativos: (porMun[mun] || {}).ativos || 0,
      acessaram: [...(acessou[s.id] || [])].filter(u => profs[u].mun === mun).length, acoes: (porMun[mun] || {}).acoes || {} }]));
    b.set(db.doc(`uso_real/${s.id}_geral`), { ...geral, calculado_em: FieldValue.serverTimestamp() }); n++;
    for (const [mun, m] of Object.entries(porMun)) {
      const escTot = {}; Object.values(profs).filter(p => p.mun === mun).forEach(p => { escTot[p.esc || 'sem'] = (escTot[p.esc || 'sem'] || 0) + 1; });
      Object.entries(escTot).forEach(([e, t]) => { m.escolas[e] = { professores: t, ativos: (m.escolas[e] || {}).ativos || 0 }; });
      b.set(db.doc(`uso_real/${s.id}_${mun}`), { semana: s.id, municipio_id: mun, professores: totMun[mun], ...m, calculado_em: FieldValue.serverTimestamp() }); n++;
      if (n >= 400) break;
    }
  }
  await b.commit();
  return { semanas: semanas.map(s => s.id), professores: Object.keys(profs).length, envios: envios.size };
}

export const usoRealDiario = onSchedule({ region: 'southamerica-east1', schedule: '20 3 * * *', timeZone: 'America/Campo_Grande', timeoutSeconds: 540, memory: '1GiB' },
  async () => { const r = await calcularUsoReal(getFirestore()); console.log('uso real', JSON.stringify(r)); });

export const usoRealAgora = onCall({ region: 'southamerica-east1', timeoutSeconds: 540, memory: '1GiB', maxInstances: 2 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = await getFirestore().doc(`usuarios/${req.auth.uid}`).get();
  if (!u.exists || u.data().perfil !== 'admin') throw new HttpsError('permission-denied', 'Só o administrador.');
  return calcularUsoReal(getFirestore());
});
export { ACOES };

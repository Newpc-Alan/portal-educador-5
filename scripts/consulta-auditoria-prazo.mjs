// Ação pontual (pedido do Alan, 01/11/2026): registros antigos da auditoria sem prazo passam a vencer em 6 meses
// contados da data do próprio registro (expira_em = em + 183 dias). O TTL do Firestore apaga os vencidos sozinho.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), DIA = 86400000;
const sn = await db.collection('auditoria').get();
let feitos = 0, ja = 0, vencidos = 0; let b = db.batch(), n = 0;
for (const d of sn.docs) {
  const x = d.data(); if (x.expira_em) { ja++; continue; }
  const base = x.em && x.em.toMillis ? x.em.toMillis() : Date.now();
  const exp = base + 183 * DIA; if (exp < Date.now()) vencidos++;
  b.update(d.ref, { expira_em: Timestamp.fromMillis(exp) }); feitos++;
  if (++n === 400) { await b.commit(); b = db.batch(); n = 0; }
}
if (n) await b.commit();
console.log('::notice::auditoria: ' + sn.size + ' registros · ' + ja + ' já tinham prazo · ' + feitos + ' receberam prazo (' + vencidos + ' já vencidos, o TTL apaga em até 24 h)');

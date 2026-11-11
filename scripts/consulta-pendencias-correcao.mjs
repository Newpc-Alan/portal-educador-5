// Só leitura: provas online dos últimos 60 dias com respostas aguardando correção (sem nomes de alunos).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), agora = Date.now(), ms = t => t && t.toMillis ? t.toMillis() : 0;
const s = await db.collection('provas_online').get();
for (const d of s.docs) {
  const p = d.data(); if (ms(p.criado_em) && ms(p.criado_em) < agora - 60 * 864e5) continue;
  const r = await d.ref.collection('po_resultados').get(); let ag = 0, pend = 0, sit = {};
  r.forEach(x => { const y = x.data(); sit[y.situacao || '(sem)'] = (sit[y.situacao || '(sem)'] || 0) + 1; if (y.situacao === 'aguardando_correcao') ag++; if (y.pendentes) pend++; });
  if (!pend && !ag) continue;
  const prof = (await db.doc('usuarios/' + p.professor_uid).get()).data() || {};
  console.log(`::notice::prova ${d.id.slice(0, 6)} | prof ${String(prof.nome || '').split(' ')[0]} | status ${p.status} | aguardando ${!!p.aguardando} | abre ${new Date(ms(p.abre_em)).toISOString()} | fecha ${ms(p.fecha_em) ? new Date(ms(p.fecha_em)).toISOString() : '-'} | aguardando_correcao ${ag} | com pendentes ${pend} | ${JSON.stringify(sit)} | finalizada ${!!p.correcao_finalizada}`);
}
console.log('::notice::fim');

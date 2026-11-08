// Só leitura: erros do navegador de hoje e de ontem (resumo por mensagem) e a disponibilidade do mês.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), dia = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 10);
const l = [];
for (const d of [dia(Date.now()), dia(Date.now() - 86400000)]) (await db.collection('erros_resumo').where('dia', '==', d).get()).forEach(x => l.push(x.data()));
l.sort((a, b) => b.n - a.n);
console.log('::notice::erros: ' + (l.map(e => e.n + 'x ' + e.pagina + ' · ' + e.msg).join(' || ') || 'nenhum').replace(/[{}"]/g, ' ').slice(0, 3000));
const m = dia(Date.now()).slice(0, 7).replace('-', ''), s = (await db.doc('stats/disponibilidade_' + m).get()).data() || {};
console.log('::notice::disponibilidade ' + m + ': ' + (s.verificacoes || 0) + ' verificações, ' + (s.falhas || 0) + ' falhas');

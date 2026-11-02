// Só leitura: monta o índice da busca geral em memória e mostra o tamanho (não grava nada).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { montarIndiceBusca } = await import(pathToFileURL(process.cwd() + '/busca.js').href);
const db = getFirestore();
const r = await montarIndiceBusca(db);
console.log('::notice::conteúdos no índice: ' + r.total + ' · ' + Math.round(r.bytes / 1024) + ' KB · ' + r.partes.length + ' parte(s)');
for (const [c, n] of Object.entries(r.por)) console.log('::notice::' + c + ': ' + n);
const ex = {}; r.partes.flat().forEach(l => { if (!ex[l.c]) ex[l.c] = l; });
for (const l of Object.values(ex)) console.log('::notice::exemplo ' + JSON.stringify(l).slice(0, 400).replace(/[{}"]/g, ' '));
const m = await db.doc('busca_indice/_meta').get(); console.log('::notice::índice gravado: ' + (m.exists ? JSON.stringify(m.data().por) : 'ainda não'));

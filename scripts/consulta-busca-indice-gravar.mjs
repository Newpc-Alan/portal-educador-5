// Grava o índice da busca geral agora (o mesmo que a função agendada indiceBusca faz a cada 2 h).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { montarIndiceBusca, gravarIndiceBusca } = await import(pathToFileURL(process.cwd() + '/busca.js').href);
const db = getFirestore();
const r = await montarIndiceBusca(db);
const ids = await gravarIndiceBusca(db, r);
console.log('::notice::índice gravado: ' + r.total + ' conteúdos · ' + Math.round(r.bytes / 1024) + ' KB · partes ' + ids.join(', ') + ' · ' + JSON.stringify(r.por));

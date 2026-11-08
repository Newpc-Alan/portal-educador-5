// Simula a rodada de lembretes da Formação (não envia nada): quantos receberiam amanhã e por quê os outros ficam de fora.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { rodada } = await import(pathToFileURL(process.cwd() + '/formacao-lembretes.js').href);
const r = await rodada(getFirestore(), { simular: true });
console.log('::notice::lembretes (simulação): ' + JSON.stringify(r));

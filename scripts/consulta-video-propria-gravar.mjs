// GRAVA. Marca como produção própria (logo do Portal no card) os vídeos do catálogo cujo canal é "Portal do Educador".
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const sn = await getFirestore().collection('videos').get(); let n = 0;
for (const d of sn.docs) { const v = d.data(); if (/^portal do educador$/i.test((v.canal || '').trim()) && v.producao_propria !== true) { await d.ref.update({ producao_propria: true }); n++; } }
console.log('::notice::vídeos marcados como produção própria: ' + n);

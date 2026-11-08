// Prepara os cursos para a visibilidade por rede (nov/2026): grava exclusivo=false nos cursos que ainda não têm o campo.
// O catálogo passa a filtrar por exclusivo==false; curso sem o campo sumiria. Idempotente; não mexe em curso que já tem o campo.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const snap = await db.collection('cursos').get();
let gravou = 0, ja = 0;
const b = db.batch();
snap.forEach(d => { if (typeof d.data().exclusivo === 'boolean') { ja++; return; } b.update(d.ref, { exclusivo: false }); gravou++; });
if (gravou) await b.commit();
console.log(`::notice::cursos: ${snap.size} · gravou exclusivo=false em ${gravou} · já tinham o campo: ${ja}`);

// GRAVA (apaga): os 7 rabiscos soltos listados em 07/11/2026 e aprovados pelo Alan. Só apaga se o código estiver na lista
// E se o trabalho ainda for rabisco solto (1 página, até 2 traços, nada mais). Apaga o registro e o(s) arquivo(s) no Storage.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();
const APROVADOS = new Set(['sxblJ1', 'VlPOju', 'XRYNmq', 'j6kd56', 'Sc8BUm', 'fxlKJa', 'AnIvN8']);
const sn = await db.collectionGroup('trabalhos').get();
let apagados = 0, pulados = 0;
for (const d of sn.docs) {
  const cod = d.id.slice(0, 6); if (!APROVADOS.has(cod)) continue;
  const t = d.data();
  try {
    if (t.tipo !== 'lousa' || t.origem === 'aula' || !t.arquivo) { pulados++; console.log(cod + ' · pulado (não é mais rabisco)'); continue; }
    const [buf] = await bucket.file(t.arquivo).download();
    const txt = (t.formato === 'application/gzip' || /\.gz$/.test(t.arquivo)) ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    const pags = JSON.parse(txt).paginas || [], p = pags[0] || {}, objs = (JSON.parse(p.json || '{}').objects) || [];
    const rabisco = pags.length === 1 && !(p.pdfs && p.pdfs.length) && !p.pdf && objs.length < 3 && objs.every(o => o.type === 'path');
    if (!rabisco) { pulados++; console.log(cod + ' · pulado (mudou desde a lista)'); continue; }
    for (const f of [t.arquivo, t.original_arquivo].filter(Boolean)) await bucket.file(f).delete({ ignoreNotFound: true });
    await d.ref.delete(); apagados++; console.log(cod + ' · apagado');
  } catch (e) { pulados++; console.log(cod + ' · erro: ' + (e.code || e.message)); }
}
console.log(`::notice::Rabiscos apagados: ${apagados} · pulados: ${pulados}`);
process.exit(0);

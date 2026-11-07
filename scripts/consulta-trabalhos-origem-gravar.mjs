// GRAVA: selo de origem nos trabalhos antigos da Lousa (usuarios/{uid}/trabalhos, tipo "lousa", sem "origem").
// Lê o arquivo da aula no Storage; se tem marcas de slide montado pela Lousa (Aula IA ou Aula pronta: pdeProf, pdeFundo, pdeEt),
// grava origem "aula" (aparece no filtro "Aulas IA"). Não muda o conteúdo nem apaga nada. Log sem nomes (LGPD): só contagens.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();
const sn = await db.collectionGroup('trabalhos').get();   // sem filtro no banco (não há índice de grupo); filtra aqui
let total = 0, ja = 0, marcadas = 0, minhas = 0, falhas = 0;
for (const d of sn.docs) {
  const t = d.data();
  if (t.tipo !== 'lousa') continue;
  total++;
  if (t.origem) { ja++; continue; }
  if (!t.arquivo) { minhas++; continue; }
  try {
    const [buf] = await bucket.file(t.arquivo).download();
    const txt = (t.formato === 'application/gzip' || /\.gz$/.test(t.arquivo)) ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    if (/\\?"pde(Prof|Fundo|Et)\\?":/.test(txt)) { await d.ref.set({ origem: 'aula' }, { merge: true }); marcadas++; } else minhas++;
  } catch (e) { falhas++; }
}
console.log(`::notice::trabalhos da Lousa: ${total} · já tinham selo: ${ja} · marcadas como Aula IA: ${marcadas} · ficaram em Minhas: ${minhas} · falhas de leitura: ${falhas}`);

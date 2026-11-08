// GRAVA. Corrige a duração dos vídeos do catálogo que está vazia ou errada (ex.: 1257 min no lugar de 20:57),
// usando a duração que a IA mediu ao montar o vídeo interativo. Só mexe quando a diferença passa de 2 minutos.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const mm = t => t ? Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') : 'vazia';
const ints = await db.collection('videos_interativos').where('origem', '==', 'catalogo').get();
let n = 0;
for (const d of ints.docs) {
  const x = d.data(); if (!x.catalogo_id || !(x.duracao_seg > 0)) continue;
  const v = await db.doc('videos/' + x.catalogo_id).get(); if (!v.exists) continue;
  const atual = Number(v.data().duracao_seg) || 0;
  if (atual && Math.abs(atual - x.duracao_seg) <= 120) continue;
  await v.ref.update({ duracao_seg: x.duracao_seg });
  n++; console.log('::notice::' + String(v.data().titulo).replace(/[{}"]/g, ' ') + ': ' + mm(atual) + ' -> ' + mm(x.duracao_seg));
}
console.log('::notice::durações corrigidas: ' + n);

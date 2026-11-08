// GRAVA. Testa o vídeo interativo automático: pede "Refazer IA" no vídeo curto "Andy, a formiga" e acompanha a situação por até 4 minutos.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const q = (await db.collection('videos').where('publicado', '==', true).get()).docs.find(d => /^Andy/.test(d.data().titulo || ''));
if (!q) { console.log('::error::vídeo Andy não encontrado'); process.exit(1); }
const antes = (await db.doc('videos_interativos/cat_' + q.id).get()).data() || {};
await q.ref.update({ interativo_refazer: FieldValue.serverTimestamp() });
const t0 = Date.now(); let v = null;
while (Date.now() - t0 < 240000) {
  await new Promise(r => setTimeout(r, 10000));
  v = (await q.ref.get()).data(); console.log('situação: ' + v.interativo_status + ' (' + Math.round((Date.now() - t0) / 1000) + 's)');
  if (v.interativo_status === 'ok' || v.interativo_status === 'erro') break;
}
const depois = (await db.doc('videos_interativos/cat_' + q.id).get()).data() || {};
console.log('::notice::situação final: ' + v.interativo_status + (v.interativo_erro ? ' · ' + v.interativo_erro : '') + ' · interativo ' + v.interativo + ' · automático ' + depois.automatico + ' · publicado ' + depois.publicado + ' · pausas ' + (depois.interacoes || []).length + ' · refeito ' + (String(antes.gerado_em && antes.gerado_em.toMillis()) !== String(depois.gerado_em && depois.gerado_em.toMillis())));
if (v.interativo_status !== 'ok') process.exit(1);

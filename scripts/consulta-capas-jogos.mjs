// GRAVA: sobe as capas de scripts/capas-jogos/*.webp para o Storage (capas/jogos/) e grava em jogos/{id}.capa.
// O nome do arquivo é o título do jogo sem acento (ex.: jogo-da-forca.webp). Capa já trocada não é reenviada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pasta = '../scripts/capas-jogos/';
const jogos = (await db.collection('jogos').get()).docs.map(d => ({ ref: d.ref, ...d.data() }));
for (const arq of readdirSync(pasta).filter(f => f.endsWith('.webp'))) {
  const nome = arq.replace(/\.webp$/, ''), alvo = jogos.filter(j => slug(j.titulo) === nome);
  if (alvo.length !== 1) { console.log('::warning::' + (alvo.length ? 'mais de um jogo: ' : 'jogo nao encontrado: ') + arq); continue; }
  const j = alvo[0], caminho = 'capas/jogos/' + nome + '.webp';
  if ((j.capa || '').includes(encodeURIComponent(caminho))) { console.log('::notice::ja tinha esta capa: ' + limpo(j.titulo)); continue; }
  const token = randomUUID();
  await bucket.file(caminho).save(readFileSync(pasta + arq), { resumable: false, metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
  await j.ref.update({ capa: url, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'script-capas' });
  console.log('::notice::capa nova: ' + limpo(j.titulo));
}

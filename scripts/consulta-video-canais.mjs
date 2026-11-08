// Só leitura: canais cadastrados nos vídeos do catálogo (para marcar os de produção própria).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const vs = (await getFirestore().collection('videos').get()).docs.map(d => d.data());
const c = {}; vs.forEach(v => { const k = (v.canal || '(sem canal)').trim(); c[k] = (c[k] || 0) + 1; });
console.log('::notice::' + Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ': ' + n).join(' || ').replace(/[{}"]/g, ' '));

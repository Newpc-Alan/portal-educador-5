// Só leitura: o que a rede procurou na busca geral (agregado, sem identificar ninguém).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const sn = await getFirestore().collection('buscas_mes').get();
sn.forEach(d => { const x = d.data(); const top = Object.entries(x.termos || {}).sort((a, b) => (b[1].n || 0) - (a[1].n || 0)).slice(0, 15);
  console.log('::notice::' + d.id + ' · ' + (x.total || 0) + ' buscas · ' + top.map(([t, v]) => t.replace(/_/g, ' ') + ' ' + (v.n || 0) + (v.zero ? ' (sem resultado ' + v.zero + ')' : '')).join(', ')); });
console.log('::notice::meses: ' + sn.size);

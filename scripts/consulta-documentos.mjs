// Só leitura: documentos da Documentação/Ajuda (id, título, versão, público), para publicar novas versões.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const sn = await getFirestore().collection('documentos').get();
sn.forEach(d => { const x = d.data(); console.log('::notice::' + [d.id, x.titulo, x.categoria, x.codigo || '-', 'v' + (x.versao || '?'), x.publico, (x.versoes || []).length + ' versões'].join(' · ').replace(/[{}"\n]/g, ' ')); });
console.log('::notice::total ' + sn.size);

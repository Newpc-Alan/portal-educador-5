// Só leitura: nome de cada escola por rede (dado público), para conferir a ligação setor da planilha → escola na importação do inventário.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const [ms, es] = await Promise.all([db.collection('municipios').select('nome').get(), db.collection('escolas').select('nome', 'municipio_id').get()]);
const nm = {}; ms.forEach(d => nm[d.id] = d.data().nome);
es.forEach(d => { const e = d.data(); console.log('::notice::ESC|' + (nm[e.municipio_id] || e.municipio_id) + '|' + (e.nome || '')); });
process.exit(0);

// Diagnóstico (somente leitura): quantas escolas cada município tem no cadastro e escolas ligadas a um município que não existe.
// Nomes de município e de escola são dados públicos; nenhum dado de pessoa é mostrado.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const [ms, es] = await Promise.all([db.collection('municipios').get(), db.collection('escolas').get()]);
const por = {}, semNome = [], inativas = {};
es.forEach(d => { const e = d.data(); const k = e.municipio_id || '(sem município)'; por[k] = (por[k] || 0) + 1; if (!e.nome) semNome.push(d.id); if (e.status === 'inativa') inativas[k] = (inativas[k] || 0) + 1; });
const ids = new Set();
ms.docs.sort((a, b) => String(a.data().nome).localeCompare(String(b.data().nome), 'pt-BR')).forEach(d => { const m = d.data(); ids.add(d.id);
  console.log('::notice::' + (m.nome || '?') + '/' + (m.uf || '?') + ' · id ' + d.id + ' · status ' + (m.status || '-') + ' · escolas ' + (por[d.id] || 0) + (inativas[d.id] ? ' (' + inativas[d.id] + ' inativas)' : '')); });
Object.keys(por).filter(k => !ids.has(k)).forEach(k => console.log('::notice::ESCOLAS EM MUNICÍPIO QUE NÃO EXISTE: ' + k + ' · ' + por[k]));
if (semNome.length) console.log('::notice::escolas sem o campo nome (somem da lista do administrador): ' + semNome.length);
process.exit(0);

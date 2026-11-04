// Só leitura: envios da comunicação automática ao professor (comunicacoes), por momento e situação. Sem nomes nem e-mails.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), h = ms => new Date(ms - 4 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const sn = await db.collection('comunicacoes').get();
console.log('::notice::registros: ' + sn.size);
const cont = {}; sn.docs.forEach(d => { const x = d.data(), k = x.momento + ' · ' + x.status; cont[k] = (cont[k] || 0) + 1; });
Object.entries(cont).forEach(([k, v]) => console.log('::notice::' + k + ': ' + v));
sn.docs.map(d => d.data()).sort((a, b) => (b.em ? b.em.toMillis() : 0) - (a.em ? a.em.toMillis() : 0)).slice(0, 10)
  .forEach(x => console.log('::notice::' + h(x.em ? x.em.toMillis() : 0) + ' ' + x.momento + ' ' + x.status + (x.erro ? ' erro: ' + String(x.erro).replace(/[\w.+-]+@[\w.-]+/g, '[e-mail]').slice(0, 120) : '')));
const desde = Date.now() - 6 * 3600e3;
const novos = await db.collection('usuarios').where('criado_em', '>=', new Date(desde)).get();
console.log('::notice::cadastros novos nas últimas 6 h: ' + novos.size + ' (professores em teste: ' + novos.docs.filter(d => d.data().licenca_tipo === 'teste').length + ')');

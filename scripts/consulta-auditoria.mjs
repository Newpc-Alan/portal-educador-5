// Só leitura: últimos registros da auditoria (confere se o servidor está gravando e como identifica o autor).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const sn = await db.collection('auditoria').orderBy('em', 'desc').limit(25).get();
const por = {}; sn.forEach(d => { const x = d.data(); por[x.autor_tipo || '-'] = (por[x.autor_tipo || '-'] || 0) + 1; });
console.log('::notice::últimos 25 por tipo de autor: ' + limpo(JSON.stringify(por)));
sn.forEach(d => { const x = d.data();
  console.log('::notice::' + limpo([x.em && x.em.toDate().toISOString(), x.acao, x.colecao, x.doc, 'autor ' + (x.autor_uid || '-') + '/' + (x.autor_tipo || '-') + '/' + (x.auth || '-'), x.municipio_id, (x.campos || []).join(','), x.ip || '', x.detalhe || ''].join(' · ')).slice(0, 500)); });

// Só leitura: chave geral dos recursos de IA (config/portal_ia.ia_recursos), para conferir o que vale para o avulso.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const c = ((await getFirestore().doc('config/portal_ia').get()).data() || {}).ia_recursos || {};
console.log('::notice::ia_recursos gravado: ' + (Object.keys(c).length ? JSON.stringify(c) : '(nada: vale o padrão do código)'));

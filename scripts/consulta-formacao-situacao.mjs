// Só leitura: situação na Formação Continuada (mesma conta do Painel e dos Comunicados), para conferir.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { situacoesFormacao } = await import(pathToFileURL(process.cwd() + '/formacao-uso.js').href);
const s = await situacoesFormacao(getFirestore(), null), c = {};
Object.values(s).forEach(x => { const k = x.andamento.length ? x.situacao : 'concluiu'; c[k] = (c[k] || 0) + 1; });
console.log('::notice::cursistas com progresso: ' + Object.keys(s).length + ' · ' + JSON.stringify(c).replace(/[{}"]/g, ' '));

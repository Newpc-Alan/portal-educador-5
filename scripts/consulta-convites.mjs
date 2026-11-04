// Só leitura: andamento dos comunicados por e-mail (só números, nada de e-mail ou nome) e quantos importados já entraram.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const cs = await db.collection('comunicados_email').orderBy('criado_em', 'desc').limit(12).get();
let t = 0, e = 0, f = 0;
cs.forEach(d => { const c = d.data(); t += c.total || 0; e += c.enviados || 0; f += c.falhas || 0;
  console.log('::notice::' + (c.status || '?') + ' · ' + (c.enviados || 0) + ' de ' + (c.total || 0) + ' enviados · ' + (c.falhas || 0) + ' falha(s) · ' + String(c.assunto || '').slice(0, 40)); });
console.log('::notice::TOTAL dos últimos: ' + e + ' de ' + t + ' enviados, ' + f + ' falha(s)');
const entrou = (await db.collection('usuarios').where('origem', '==', 'pre_cadastro').count().get()).data().count;
const ativos = (await db.collection('usuarios').where('licenca_tipo', '==', 'institucional').where('status', '==', 'ativo').count().get()).data().count;
console.log('::notice::contas criadas a partir de pré-cadastro: ' + entrou + ' · contas de rede ativas: ' + ativos);

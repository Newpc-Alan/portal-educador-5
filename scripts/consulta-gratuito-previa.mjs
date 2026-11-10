// Prévia do plano Gratuito: quantos professores com teste ou licença avulsa vencida passariam para o Gratuito agora. Só leitura, sem nomes.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const s = await db.collection('usuarios').where('licenca_fim', '<', Timestamp.now()).get();
const c = {}; let total = 0, comEmail = 0;
s.forEach(d => { const u = d.data(); if (u.perfil !== 'professor' || u.status !== 'ativo' || !['teste', 'avulsa', 'cortesia'].includes(u.licenca_tipo) || u.demo === true) return;
  total++; c[u.licenca_tipo] = (c[u.licenca_tipo] || 0) + 1; if (u.email && !String(u.email).endsWith('@portaldoeducador.com.br')) comEmail++; });
const ativos = (await db.collection('usuarios').where('licenca_tipo', '==', 'teste').get()).docs.filter(d => d.data().licenca_fim && d.data().licenca_fim.toMillis() > Date.now()).length;
console.log(`::notice::Passariam para o Gratuito agora: ${total} (${JSON.stringify(c)}), recebendo e-mail: ${comEmail}. Em teste ainda válido: ${ativos}.`);

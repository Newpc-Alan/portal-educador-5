// Só leitura: estado da aula ao vivo (aula_vivo) das turmas com aula recente e erros das funções de envio na última hora
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), h = ms => new Date(ms - 4 * 3600e3).toISOString().slice(11, 19);
const av = await db.collection('aula_vivo').get();
for (const d of av.docs) { const x = d.data();
  console.log('::notice::aula_vivo ' + d.id + ' atualizado ' + (x.atualizado_em ? h(x.atualizado_em.toMillis()) : '-') + ' pausa ' + x.pausa + ' comando ' + JSON.stringify(x.comando || null).slice(0, 160) + ' comandos ' + Object.keys(x.comandos || {}).length);
  const ch = await d.ref.collection('chat').get(); const al = await d.ref.collection('alunos').get(); console.log('::notice::  chat ' + ch.size + ' · alunos ' + al.size); }
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] }).getClient();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: { resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 30,
  filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="trabalhorede" AND severity>=INFO AND timestamp>="' + new Date(Date.now() - 3600e3).toISOString() + '"' } }).catch(e => ({ erro: e }));
if (r.erro) console.log('::error::logs ' + String(r.erro.message).slice(0, 200));
else (r.data.entries || []).filter(e => !/DEBUG/.test(e.severity)).slice(0, 15).forEach(e => { const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status : ''); console.log('::notice::' + e.timestamp.slice(11, 19) + 'Z ' + e.severity + ' ' + String(t).replace(/\s+/g, ' ').slice(0, 200)); });

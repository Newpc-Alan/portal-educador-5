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
  console.log('::notice::aula_vivo ' + d.id + ' atualizado ' + (x.atualizado_em ? h(x.atualizado_em.toMillis()) : '-') + ' pausa ' + x.pausa + ' comando ' + JSON.stringify(x.comando || null).slice(0, 160) + ' comandos ' + JSON.stringify(x.comandos || {}).slice(0, 600));
  const ch = await d.ref.collection('chat').get(); const al = await d.ref.collection('alunos').get(); console.log('::notice::  chat ' + ch.size + ' · alunos ' + al.size); al.docs.forEach(a => { const y = a.data(); if (y.em && Date.now() - y.em.toMillis() < 3 * 3600e3) console.log('::notice::    aluno ' + a.id.slice(0, 6) + ' ap ' + (y.ap || '-') + ' em ' + h(y.em.toMillis()) + ' bateria ' + (y.bateria ? y.bateria.n : '-')); });
  const pr = await db.collection('turma_presenca').doc(d.id).collection('alunos').get(); pr.docs.forEach(p => { const y = p.data(); if (y.em && Date.now() - y.em.toMillis() < 3 * 3600e3) console.log('::notice::  presenca ' + p.id + ' ' + y.nome + ' ' + h(y.em.toMillis()) + ' fora ' + y.fora + ' saiu ' + y.saiu + ' aba ' + (y.aba || '')); }); }
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] }).getClient();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: { resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc',   filter: 'resource.type="cloud_run_revision" AND (resource.labels.service_name="trabalhorede" OR resource.labels.service_name="entradaqrturma") AND (httpRequest.status>=200 OR severity>=WARNING) AND timestamp>="' + new Date(Date.now() - 3600e3).toISOString() + '"', pageSize: 80 } }).catch(e => ({ erro: e }));
if (r.erro) console.log('::error::logs ' + String(r.erro.message).slice(0, 200));
else (r.data.entries || []).filter(e => !/DEBUG/.test(e.severity)).slice(0, 60).forEach(e => { const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status : ''); console.log('::notice::' + e.timestamp.slice(11, 19) + 'Z ' + e.resource.labels.service_name + ' ' + e.severity + ' ' + String(t).replace(/\s+/g, ' ').slice(0, 200)); });

const qa = await db.collection('qr_aulas').get(); qa.docs.forEach(d => { const x = d.data(); console.log('::notice::qr_aulas ' + d.id + ' por ' + x.por + ' por_nome ' + x.por_nome + ' aberta_em ' + (x.aberta_em ? h(x.aberta_em.toMillis()) : '-') + ' ate ' + (x.aberta_ate ? h(x.aberta_ate.toMillis()) : '-') + ' encerrada_por ' + (x.encerrada_por || '')); });
const au = await db.collection('auditoria').where('colecao', 'in', ['qr_aulas', 'aula_vivo']).get(); au.docs.map(d => d.data()).filter(x => x.em && Date.now() - x.em.toMillis() < 3 * 3600e3).sort((a, b) => a.em.toMillis() - b.em.toMillis()).slice(-40).forEach(x => console.log('::notice::aud ' + h(x.em.toMillis()) + ' ' + x.colecao + ' ' + x.acao + ' ' + (x.autor_uid || '').slice(0, 8) + ' ' + JSON.stringify(x.campos || []) + ' ' + String(x.detalhe || '').slice(0, 80)));

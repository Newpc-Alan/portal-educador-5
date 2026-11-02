// Só leitura: o que aconteceu nas entradas de aluno nas últimas 3 horas (aulas abertas, entradas por QR, erros das funções de entrada)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), desde = Date.now() - 3 * 3600e3, h = ms => new Date(ms - 4 * 3600e3).toISOString().slice(11, 19);
const qa = await db.collection('qr_aulas').where('atualizado_em', '>=', Timestamp.fromMillis(desde)).get();
qa.forEach(d => { const x = d.data(); console.log('::notice::aula ' + (x.turma_nome || d.id) + ' · aberta ' + (x.aberta_em ? h(x.aberta_em.toMillis()) : '-') + ' até ' + (x.aberta_ate ? h(x.aberta_ate.toMillis()) : '-') + ' · maestro ' + (x.maestro_codigo || '(sem)')); });
const au = await db.collection('auditoria').where('em', '>=', Timestamp.fromMillis(desde)).get();
const al = au.docs.map(d => d.data()).filter(x => /^aluno_/.test(String(x.acao || '')) || /^al-/.test(String(x.uid || x.autor_uid || '')));
console.log('::notice::registros de aluno na auditoria: ' + al.length);
al.sort((a, b) => a.em.toMillis() - b.em.toMillis()).slice(-15).forEach(x => console.log('::notice::' + h(x.em.toMillis()) + ' ' + (x.acao || '') + ' ' + (x.tela || x.alvo || '') + ' ' + String(x.uid || x.autor_uid || '').slice(0, 12)));
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] }).getClient();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: { resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 40,
  filter: 'resource.type="cloud_run_revision" AND (resource.labels.service_name="entraralunoqr" OR resource.labels.service_name="codigoalunoqr" OR resource.labels.service_name="entradaqrturma") AND timestamp>="' + new Date(desde).toISOString() + '"' } }).catch(e => ({ erro: e }));
if (r.erro) console.log('::error::logs ' + String(r.erro.message).slice(0, 200));
else (r.data.entries || []).slice(0, 25).forEach(e => { const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status : ''); console.log('::notice::' + e.timestamp.slice(11, 19) + 'Z ' + e.resource.labels.service_name + ' ' + e.severity + ' ' + String(t).replace(/\s+/g, ' ').slice(0, 170)); });

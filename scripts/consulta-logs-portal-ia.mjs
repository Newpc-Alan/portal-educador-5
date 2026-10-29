// Últimos avisos e erros da função portalIa (Cloud Logging), para diagnóstico. Só leitura.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] });
const cli = await auth.getClient();
const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: {
  resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 40,
  filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="portalia" AND severity>=WARNING AND NOT textPayload:"not authorized" AND NOT logName:"run.googleapis.com%2Frequests" AND timestamp>="' + desde + '"' } }).catch(e => ({ erro: e }));
if (r.erro) { console.log('::error::' + limpo(r.erro.message).slice(0, 500)); process.exit(1); }
const ents = (r.data.entries || []).slice(0, 9);
if (!ents.length) console.log('::notice::nenhum aviso nas últimas 6 horas');
const txt = e => e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status + ' em ' + e.httpRequest.latency : '') || (e.protoPayload ? JSON.stringify(e.protoPayload).slice(0, 600) : Object.keys(e).join(','));
ents.forEach(e => console.log('::notice::' + e.timestamp.slice(11, 19) + ' ' + e.severity + ' ' + limpo(txt(e)).slice(0, 900)));

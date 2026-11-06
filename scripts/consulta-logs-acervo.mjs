// Só leitura: avisos e erros recentes da função acervoFila (fila das Aulas prontas), para diagnóstico. Sem dado pessoal.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]');
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] }).getClient();
const desde = new Date(Date.now() - 2 * 3600e3).toISOString();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: {
  resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 30,
  filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="acervofila" AND severity>=WARNING AND timestamp>="' + desde + '"' } }).catch(e => ({ erro: e }));
if (r.erro) { console.log('::error::' + limpo(r.erro.message).slice(0, 500)); process.exit(1); }
const txt = e => e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status : '') || '';
const ents = r.data.entries || []; if (!ents.length) console.log('::notice::nenhum aviso');
ents.slice(0, 14).forEach(e => console.log('::notice::' + e.timestamp.slice(11, 19) + ' ' + e.severity + ' ' + limpo(txt(e)).slice(0, 300)));

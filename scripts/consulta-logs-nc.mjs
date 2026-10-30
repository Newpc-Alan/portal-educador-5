// Só leitura: últimos registros da função linkArquivoNc (Cloud Logging), para achar o motivo de um erro.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] });
const cli = await auth.getClient();
const desde = new Date(Date.now() - 3 * 3600e3).toISOString();
const filtro = `resource.type="cloud_run_revision" AND resource.labels.service_name="linkarquivonc" AND timestamp>="${desde}"`;
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST',
  data: { resourceNames: ['projects/portal-educador-5'], filter: filtro, orderBy: 'timestamp desc', pageSize: 12 } });
const es = r.data.entries || [];
console.log('::notice::registros nas ultimas 3h: ' + es.length);
for (const e of es.slice(0, 8)) {
  const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status + ' ' + (e.httpRequest.requestUrl || '') : JSON.stringify(e.protoPayload || {}).slice(0, 300));
  console.log('::notice::' + e.timestamp + ' ' + (e.severity || '') + ' ' + String(t).replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').slice(0, 700));
}

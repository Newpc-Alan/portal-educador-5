// Diagnóstico do robô do WhatsApp: últimas chamadas e erros da função whatsappWebhook (Cloud Logging). Só leitura.
// Não imprime número de telefone nem texto de mensagem (dígitos longos são mascarados): o log do GitHub é público.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const limpo = t => String(t).replace(/\d{6,}/g, '#').replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] }).getClient();
const desde = new Date(Date.now() - 3 * 3600e3).toISOString();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: {
  resourceNames: ['projects/' + (process.env.PROJETO || 'portal-educador-5')], orderBy: 'timestamp desc', pageSize: 40,
  filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name=~"whatsapp" AND timestamp>="' + desde + '"' } }).catch(e => ({ erro: e }));
if (r.erro) { console.log('::error::' + limpo(r.erro.message).slice(0, 400)); process.exit(1); }
const ents = r.data.entries || [];
if (!ents.length) console.log('::notice::nenhuma chamada ao robô nas últimas 3 horas (a Meta não está enviando)');
for (const e of ents.reverse()) {
  const h = e.httpRequest;
  const t = h ? h.requestMethod + ' ' + h.status + ' ' + (h.latency || '') : (e.textPayload || (e.jsonPayload && e.jsonPayload.message) || '');
  if (t) console.log('::notice::' + e.timestamp.slice(11, 19) + ' ' + (e.resource.labels.service_name || '') + ' ' + (e.severity || '') + ' ' + limpo(t).slice(0, 200));
}

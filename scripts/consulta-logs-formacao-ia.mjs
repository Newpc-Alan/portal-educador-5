// Avisos da Fábrica de cursos (função gerarCursoIA) nas últimas 6 horas, para diagnóstico. Só leitura; não imprime conteúdo de curso.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] });
const cli = await auth.getClient();
const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: {
  resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 60,
  filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name:"gerarcurso" AND (severity>=WARNING OR textPayload:"formacao-ia" OR textPayload:"portal-ia") AND timestamp>="' + desde + '"' } }).catch(e => ({ erro: e }));
if (r.erro) { console.log('::error::' + String(r.erro.message).slice(0, 400)); process.exit(1); }
const ents = r.data.entries || [];
if (!ents.length) console.log('::notice::nenhum aviso nas últimas 6 horas');
for (const e of ents) {
  const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || '';
  console.log(e.timestamp.slice(11, 19) + ' ' + e.severity + ' ' + String(t).replace(/\s+/g, ' ').replace(/(inicio|fim) .{0,1400}/, '$1 [texto omitido]').slice(0, 300));
}

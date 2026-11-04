// Só leitura: últimos registros do robô do WhatsApp e do teste de modelos (Cloud Logging) + conversas recentes. Números só com os 4 últimos dígitos.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const mascara = t => String(t).replace(/\d{6,}(\d{4})/g, '***$1').replace(/[\w.+-]+@[\w.-]+/g, '[e-mail]').replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const h = ms => new Date(ms - 4 * 3600e3).toISOString().slice(11, 19);
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/logging.read'] });
const cli = await auth.getClient();
const desde = new Date(Date.now() - 90 * 60e3).toISOString();
for (const svc of ['whatsapptestemodelos', 'whatsappwebhook']) {
  const r = await cli.request({ url: 'https://logging.googleapis.com/v2/entries:list', method: 'POST', data: { resourceNames: ['projects/portal-educador-5'], orderBy: 'timestamp desc', pageSize: 25,
    filter: 'resource.type="cloud_run_revision" AND resource.labels.service_name="' + svc + '" AND timestamp>="' + desde + '"' } }).catch(e => ({ erro: e }));
  if (r.erro) { console.log('::error::' + svc + ' ' + mascara(r.erro.message).slice(0, 300)); continue; }
  const ents = r.data.entries || []; console.log('::notice::' + svc + ': ' + ents.length + ' registros na última 1h30');
  ents.slice(0, 15).forEach(e => { const t = e.textPayload || (e.jsonPayload && (e.jsonPayload.message || JSON.stringify(e.jsonPayload))) || (e.httpRequest ? 'HTTP ' + e.httpRequest.status : '');
    console.log('::notice::' + svc + ' ' + e.timestamp.slice(11, 19) + 'Z ' + (e.severity || '') + ' ' + mascara(t).slice(0, 220)); });
}
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const cfg = (await db.doc('wa_config/geral').get()).data() || {};
console.log('::notice::robô ligado=' + !!cfg.ligado + ' phone_number_id=' + (cfg.phone_number_id ? 'sim' : 'não'));
const cs = await db.collection('wa_conversas').orderBy('ultima_pessoa_em', 'desc').limit(6).get();
cs.docs.forEach(d => { const x = d.data(); console.log('::notice::conversa ***' + d.id.slice(-4) + ' (' + d.id.length + ' dígitos) última da pessoa ' + h(x.ultima_pessoa_em ? x.ultima_pessoa_em.toMillis() : 0) + ' estado=' + (x.estado || '-')); });

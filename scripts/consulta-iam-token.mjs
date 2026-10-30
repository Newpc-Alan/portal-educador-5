// Só leitura: a conta das funções pode assinar tokens de login (createCustomToken precisa de signBlob)?
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const SA = '725103866385-compute@developer.gserviceaccount.com';
const L = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
try {
  const p = (await cli.request({ url: 'https://cloudresourcemanager.googleapis.com/v1/projects/portal-educador-5:getIamPolicy', method: 'POST', data: {} })).data;
  const meus = (p.bindings || []).filter(b => (b.members || []).includes('serviceAccount:' + SA)).map(b => b.role);
  L('papeis do projeto para a conta das funcoes: ' + (meus.join(', ') || 'nenhum'));
} catch (e) { L('projeto: ' + (e.response?.status || '') + ' ' + (e.response?.data?.error?.message || e.message)); }
try {
  const p = (await cli.request({ url: `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${SA}:getIamPolicy`, method: 'POST', data: {} })).data;
  L('papeis na propria conta: ' + ((p.bindings || []).map(b => b.role + ' -> ' + b.members.join(' ')).join(' | ') || 'nenhum'));
} catch (e) { L('conta: ' + (e.response?.status || '') + ' ' + (e.response?.data?.error?.message || e.message)); }

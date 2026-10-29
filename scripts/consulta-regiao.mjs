// Só leitura: em que região ficam o banco (Firestore), os arquivos (Storage) e as funções do Portal.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const P = 'portal-educador-5';
initializeApp({ credential: applicationDefault(), projectId: P });
const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
try { const r = await cli.request({ url: `https://firestore.googleapis.com/v1/projects/${P}/databases` });
  (r.data.databases || []).forEach(d => console.log('::notice::banco ' + d.name.split('/').pop() + ': regiao ' + d.locationId + ' tipo ' + d.type));
} catch (e) { console.log('::notice::banco: nao consegui ler (' + e.message.slice(0, 80) + ')'); }
try { const [bs] = await getStorage().bucket().storage.getBuckets({ project: P });
  bs.forEach(b => console.log('::notice::arquivos ' + b.name + ': regiao ' + (b.metadata.location || '?') + ' tipo ' + (b.metadata.locationType || '?')));
} catch (e) { console.log('::notice::arquivos: nao consegui ler (' + e.message.slice(0, 80) + ')'); }

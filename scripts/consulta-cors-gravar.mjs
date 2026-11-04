// GRAVA: aplica o cors.json do repositório (www, app, teste) nos buckets do Portal que o navegador lê direto
// (principal e portaria). Depois da mudança do domínio para www, o bucket da portaria só aceitava app.: as fotos não abriam.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const cors = JSON.parse(readFileSync(new URL('../cors.json', pathToFileURL(process.cwd() + '/')), 'utf8'));
for (const nome of ['portal-educador-5.firebasestorage.app', 'portal-educador-5-portaria']) {
  const b = getStorage().bucket(nome), [antes] = await b.getMetadata();
  await b.setCorsConfiguration(cors);
  const [depois] = await b.getMetadata();
  console.log('::notice::' + nome + ': antes ' + JSON.stringify((antes.cors || []).map(c => c.origin)) + ' · agora ' + JSON.stringify((depois.cors || []).map(c => c.origin)));
}
process.exit(0);

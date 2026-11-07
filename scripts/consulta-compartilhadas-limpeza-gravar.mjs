// GRAVA (uma vez): regra de ciclo de vida no bucket principal para apagar compartilhadas/ (QR code da Lousa) depois de 2 dias.
// Só acrescenta a regra: as regras de ciclo de vida que já existirem continuam como estão. Não toca em nenhum outro arquivo.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const b = getStorage().bucket('portal-educador-5.firebasestorage.app');
const [antes] = await b.getMetadata();
const regras = (antes.lifecycle && antes.lifecycle.rule) || [];
console.log('::notice::Regras antes: ' + JSON.stringify(regras));
const ja = regras.some(r => r.action && r.action.type === 'Delete' && r.condition && (r.condition.matchesPrefix || []).includes('compartilhadas/'));
if (ja) { console.log('::notice::A regra de compartilhadas/ já existe. Nada mudou.'); process.exit(0); }
await b.addLifecycleRule({ action: { type: 'Delete' }, condition: { age: 2, matchesPrefix: ['compartilhadas/'] } }, { append: true });
const [depois] = await b.getMetadata();
console.log('::notice::Regras agora: ' + JSON.stringify((depois.lifecycle && depois.lifecycle.rule) || []));
process.exit(0);

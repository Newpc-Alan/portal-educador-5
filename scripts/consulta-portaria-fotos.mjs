// Diagnóstico das fotos da entrada (somente leitura): quantas fotos de hoje estão registradas em freq_entradas,
// quantas existem de fato no bucket da portaria e se as regras do Storage conseguem ler o Firestore (papel do agente de regras).
// Mostra só contagens e códigos (o log do Actions é público).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
const s = await db.collection('freq_entradas').where('dia', '==', dia).get();
let reg = 0, existe = 0, falta = 0;
const bucket = getStorage().bucket('portal-educador-5-portaria');
for (const d of s.docs) for (const caminho of Object.values(d.data().fotos || {})) { reg++; const [ok] = await bucket.file(caminho).exists(); ok ? existe++ : falta++; }
console.log('::notice::hoje ' + dia + ': ' + s.size + ' turma(s) com entrada · fotos registradas ' + reg + ' · no bucket ' + existe + ' · faltando ' + falta);
const [arqs] = await bucket.getFiles({ prefix: 'portaria/', maxResults: 500 });
console.log('::notice::arquivos no bucket da portaria: ' + arqs.length);
try { const [cors] = await bucket.getMetadata(); console.log('::notice::cors do bucket: ' + JSON.stringify((cors.cors || []).map(c => c.origin))); } catch (e) { console.log('::notice::cors: erro ' + e.code); }
try { const [pol] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 }); console.log('::notice::papéis no bucket: ' + (pol.bindings || []).map(b => b.role + '(' + b.members.length + ')').join(', ')); } catch (e) { console.log('::notice::iam: erro ' + e.code); }
process.exit(0);

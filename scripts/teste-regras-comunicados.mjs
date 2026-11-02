// Comunicados por e-mail: só o administrador lê; ninguém grava pelo navegador (as funções gravam).
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-comunicados.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/sec1'), { perfil: 'secretaria', status: 'ativo', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'comunicados_email/c1'), { assunto: 'Oi', total: 2 });
  await setDoc(doc(db, 'comunicados_email/c1/envio_lotes/000'), { itens: [{ email: 'a@b.com' }] });
  await setDoc(doc(db, 'comunicados_pref/p1'), { token: 'abc', off: false });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
await t('admin lê os comunicados', assertSucceeds(getDocs(collection(fs('adm'), 'comunicados_email'))));
await t('admin lê os lotes (falhas)', assertSucceeds(getDocs(collection(fs('adm'), 'comunicados_email/c1/envio_lotes'))));
await t('admin lê quem pediu para não receber', assertSucceeds(getDoc(doc(fs('adm'), 'comunicados_pref/p1'))));
await t('admin não grava comunicado pelo navegador', assertFails(setDoc(doc(fs('adm'), 'comunicados_email/c2'), { assunto: 'x' })));
await t('professor não lê comunicados', assertFails(getDoc(doc(fs('p1'), 'comunicados_email/c1'))));
await t('professor não lê a lista de e-mails', assertFails(getDoc(doc(fs('p1'), 'comunicados_email/c1/envio_lotes/000'))));
await t('professor não lê nem o próprio token', assertFails(getDoc(doc(fs('p1'), 'comunicados_pref/p1'))));
await t('professor não se descadastra pelo banco', assertFails(setDoc(doc(fs('p1'), 'comunicados_pref/p1'), { off: true })));
await t('Secretaria não lê comunicados', assertFails(getDocs(collection(fs('sec1'), 'comunicados_email'))));
console.log((falha ? '::error::' : '::notice::') + 'Comunicados por e-mail: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

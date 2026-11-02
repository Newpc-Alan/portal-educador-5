// Anos em que o professor dá aula (Meu cadastro): o próprio professor grava, só uma lista curta.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-anos.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1', nome: 'Júlio' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
await t('professor marca os anos', assertSucceeds(updateDoc(doc(fs('p1'), 'usuarios/p1'), { anos_aula: ['6', '7', '9'] })));
await t('lista grande não', assertFails(updateDoc(doc(fs('p1'), 'usuarios/p1'), { anos_aula: Array.from({ length: 30 }, (_, i) => String(i)) })));
await t('anos tem de ser lista', assertFails(updateDoc(doc(fs('p1'), 'usuarios/p1'), { anos_aula: '6' })));
await t('outro usuário não mexe', assertFails(updateDoc(doc(fs('p2'), 'usuarios/p1'), { anos_aula: ['1'] })));
await t('perfil continua protegido', assertFails(updateDoc(doc(fs('p1'), 'usuarios/p1'), { anos_aula: ['6'], perfil: 'admin' })));
console.log((falha ? '::error::' : '::notice::') + 'Anos em que dou aula: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

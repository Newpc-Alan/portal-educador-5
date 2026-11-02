// Entrada pela carteirinha com foto: registros e configuração da escola só pela função (ninguém lê nem grava pelo navegador).
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-carteirinha.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'usuarios/g1'), { perfil: 'gestor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'login_carteirinha/l1'), { aluno_id: 'a1', escola_id: 'e1', turma_id: 't1', foto: 'portaria/e1/2026-11-02/login-a1-0945.jpg' });
  await setDoc(doc(db, 'escola_config/e1'), { foto_login_carteirinha: true });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const al = env.authenticatedContext('al-a1', { turma_id: 't1', aluno_id: 'a1', via_qr: true }).firestore();
await t('gestor não lê o registro direto', assertFails(getDoc(doc(fs('g1'), 'login_carteirinha/l1'))));
await t('aluno não lê o próprio registro', assertFails(getDoc(doc(al, 'login_carteirinha/l1'))));
await t('ninguém lista os registros', assertFails(getDocs(collection(fs('g1'), 'login_carteirinha'))));
await t('aluno não cria registro', assertFails(setDoc(doc(al, 'login_carteirinha/x'), { aluno_id: 'a1' })));
await t('gestor não muda a configuração pelo navegador', assertFails(setDoc(doc(fs('g1'), 'escola_config/e1'), { foto_login_carteirinha: false })));
await t('admin também só pela função', assertFails(setDoc(doc(fs('adm'), 'escola_config/e1'), { foto_login_carteirinha: false })));
await t('regra não bloqueia o resto (gestor lê o próprio cadastro)', assertSucceeds(getDoc(doc(fs('g1'), 'usuarios/g1'))));
console.log((falha ? '::error::' : '::notice::') + 'Entrada pela carteirinha (foto): ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

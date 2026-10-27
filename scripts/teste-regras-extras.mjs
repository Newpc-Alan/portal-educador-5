// Testa as liberações exclusivas do professor (usuarios.modulos_extra / recursos_extra / plano_avulso) no emulador.
// Só o administrador grava esses campos; ninguém cria o próprio cadastro já com eles.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-extras.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'usuarios/p2'), { perfil: 'professor', status: 'ativo', nome: 'P2', licenca_tipo: 'institucional' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('FALHA:', nome, e.message); } };
const fs = (uid, email) => env.authenticatedContext(uid, { email: email || uid + '@x.com', email_verified: true }).firestore();
const teste = () => ({ nome: 'Novo', email: 'novo@x.com', perfil: 'professor', status: 'ativo', licenca_tipo: 'teste',
  licenca_fim: Timestamp.fromMillis(Date.now() + 6 * 86400000), escola_id: null, municipio_id: null, turmas_ids: [], escolas_ids: [] });

await t('autocadastro normal', assertSucceeds(setDoc(doc(fs('n1', 'novo@x.com'), 'usuarios/n1'), teste())));
await t('autocadastro com modulos_extra: não', assertFails(setDoc(doc(fs('n2', 'novo@x.com'), 'usuarios/n2'), { ...teste(), modulos_extra: ['provas'] })));
await t('autocadastro com recursos_extra: não', assertFails(setDoc(doc(fs('n3', 'novo@x.com'), 'usuarios/n3'), { ...teste(), recursos_extra: ['prova_online'] })));
await t('professor não se dá extra', assertFails(updateDoc(doc(fs('p2'), 'usuarios/p2'), { modulos_extra: ['gestao'] })));
await t('professor não muda o pacote avulso', assertFails(updateDoc(doc(fs('p2'), 'usuarios/p2'), { plano_avulso: 'completo' })));
await t('professor ainda edita o nome', assertSucceeds(updateDoc(doc(fs('p2'), 'usuarios/p2'), { nome: 'Outro' })));
await t('admin grava extras', assertSucceeds(updateDoc(doc(fs('adm'), 'usuarios/p2'), { modulos_extra: ['gestao'], recursos_extra: ['prova_online'], plano_avulso: 'basico' })));
console.log(`extras: ${ok} ok, ${falha} falha(s)`);
await env.cleanup(); process.exit(falha ? 1 : 0);

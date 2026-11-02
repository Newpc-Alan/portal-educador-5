// Formação Continuada integrada: o cursista edita nome, CPF e função; município e escola de quem é da rede vêm do Portal (função).
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-formacao.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const BASE = { nome: 'Ana Souza', email: 'ana@x.com', municipio: 'Laboratório/MS', escola: 'Escola A', cargo: 'Professor(a)', cpf: '', aceiteTermos: '1.0' };
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users/ana'), { ...BASE, municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1'], perfil_portal: 'professor', licenca_portal: 'institucional' });
  await setDoc(doc(db, 'users/avu'), { ...BASE, email: 'avu@x.com', municipio: 'Cidade/UF', escola: 'Particular' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
await t('cursista novo cria o perfil básico', assertSucceeds(setDoc(doc(fs('novo', 'novo@x.com'), 'users/novo'), { ...BASE, email: 'novo@x.com' })));
await t('cursista não cria já com município do Portal', assertFails(setDoc(doc(fs('n2', 'n2@x.com'), 'users/n2'), { ...BASE, email: 'n2@x.com', municipio_id: 'm1' })));
await t('cursista da rede muda nome e CPF', assertSucceeds(setDoc(doc(fs('ana', 'ana@x.com'), 'users/ana'), { nome: 'Ana Maria Souza', cpf: '52998224725', cargo: 'Coordenador(a)' }, { merge: true })));
await t('cursista da rede não muda o município (texto)', assertFails(setDoc(doc(fs('ana', 'ana@x.com'), 'users/ana'), { municipio: 'Outra/UF' }, { merge: true })));
await t('cursista da rede não muda a escola (texto)', assertFails(setDoc(doc(fs('ana', 'ana@x.com'), 'users/ana'), { escola: 'Escola B' }, { merge: true })));
await t('cursista não muda o id do município', assertFails(setDoc(doc(fs('ana', 'ana@x.com'), 'users/ana'), { municipio_id: 'm2' }, { merge: true })));
await t('cursista não muda o perfil do Portal', assertFails(setDoc(doc(fs('ana', 'ana@x.com'), 'users/ana'), { perfil_portal: 'admin' }, { merge: true })));
await t('avulso (sem rede) muda município e escola', assertSucceeds(setDoc(doc(fs('avu', 'avu@x.com'), 'users/avu'), { municipio: 'Nova/UF', escola: 'Outra' }, { merge: true })));
await t('ninguém lê o perfil de outro', assertFails(getDoc(doc(fs('avu', 'avu@x.com'), 'users/ana'))));
console.log((falha ? '::error::' : '::notice::') + 'Formação (perfil do cursista): ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

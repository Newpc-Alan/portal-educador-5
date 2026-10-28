// Testa a regra da sala de espera da prova online (po_sala) no emulador (não toca no banco real).
// No Cloud Shell, na pasta do repositório (usa o /tmp/rt dos outros testes de regras):
//   cp scripts/teste-regras-sala.mjs /tmp/rt/ && firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-sala.mjs $PWD/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(), s = (p, d) => setDoc(doc(db, p), d);
  await s('usuarios/p2', { perfil: 'professor', status: 'ativo' });
  await s('usuarios/p3', { perfil: 'professor', status: 'ativo' });
  await s('usuarios/a1', { perfil: 'aluno', status: 'ativo' });
  await s('usuarios/al-x9', { perfil: 'aluno', status: 'ativo' });
  await s('usuarios/a5', { perfil: 'aluno', status: 'ativo' });
  const base = { professor_uid: 'p2', alunos_uids: ['a1'], alunos_ids: ['x9'], aguardando: true };
  await s('provas_online/p1', { ...base, status: 'agendada' });
  await s('provas_online/pe', { ...base, status: 'encerrada' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const db = (uid, claims) => env.authenticatedContext(uid, claims || {}).firestore();
const sala = (d, prova, chave, dados) => setDoc(doc(d, 'provas_online', prova, 'po_sala', chave), dados);
const ok1 = { nome: 'Ana', aparelho: 'Tablet Android', em: serverTimestamp(), pronto: true, foto: true };
await t('aluno (conta antiga) entra na sala', assertSucceeds(sala(db('a1'), 'p1', 'a1', ok1)));
await t('aluno pela matrícula entra na sala', assertSucceeds(sala(db('al-x9', { aluno_id: 'x9' }), 'p1', 'm-x9', ok1)));
await t('aluno de fora da prova não entra', assertFails(sala(db('a5'), 'p1', 'a5', ok1)));
await t('não entra no lugar de outro', assertFails(sala(db('a1'), 'p1', 'm-x9', ok1)));
await t('campo estranho não', assertFails(sala(db('a1'), 'p1', 'a1', { ...ok1, nota: 10 })));
await t('hora do servidor obrigatória', assertFails(sala(db('a1'), 'p1', 'a1', { ...ok1, em: new Date() })));
await t('prova encerrada não', assertFails(sala(db('a1'), 'pe', 'a1', ok1)));
await t('professor da prova vê a sala', assertSucceeds(getDocs(collection(db('p2'), 'provas_online', 'p1', 'po_sala'))));
await t('outro professor não vê', assertFails(getDocs(collection(db('p3'), 'provas_online', 'p1', 'po_sala'))));
await t('aluno vê só o próprio', assertSucceeds(getDoc(doc(db('a1'), 'provas_online', 'p1', 'po_sala', 'a1'))));
await t('aluno não vê o do colega', assertFails(getDoc(doc(db('a1'), 'provas_online', 'p1', 'po_sala', 'm-x9'))));
console.log(`sala: ${ok} ok, ${falha} falha(s)`);
await env.cleanup(); process.exit(falha ? 1 : 0);

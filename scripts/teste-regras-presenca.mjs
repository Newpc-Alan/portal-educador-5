// Turma ao Vivo: o aluno avisa que está na aula (fora = saiu da página; saiu = saiu da conta); o professor da turma lê.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-presenca.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'turmas/t1'), { nome: '6º A', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p9'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e9', escolas_ids: ['e9'], municipio_id: 'm1' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
// aluno que entrou pelo cartão QR: token com turma_id e aluno_id
const qr = (uid, aluno) => env.authenticatedContext(uid, { turma_id: 't1', aluno_id: aluno, via_qr: true }).firestore();
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const P = (o) => ({ nome: 'Ana', em: serverTimestamp(), ...o });
await t('aluno avisa que está na aula', assertSucceeds(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), P({ fora: false }))));
await t('aluno avisa que saiu da página', assertSucceeds(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), P({ fora: true }))));
await t('aluno avisa que saiu da conta', assertSucceeds(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), P({ fora: true, saiu: true }))));
await t('saiu precisa ser sim/não', assertFails(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), P({ fora: true, saiu: 'x' }))));
await t('campo estranho não', assertFails(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), P({ fora: false, extra: 1 }))));
await t('aluno não grava no lugar do colega', assertFails(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a2'), P({ fora: false }))));
await t('hora tem de ser a do servidor', assertFails(setDoc(doc(qr('u1', 'a1'), 'turma_presenca/t1/alunos/a1'), { nome: 'Ana', em: new Date(0), fora: false })));
await t('professor da escola lê', assertSucceeds(getDocs(collection(fs('p1'), 'turma_presenca/t1/alunos'))));
await t('professor de outra escola não lê', assertFails(getDocs(collection(fs('p9'), 'turma_presenca/t1/alunos'))));
await t('aluno não lê a presença da turma', assertFails(getDocs(collection(qr('u1', 'a1'), 'turma_presenca/t1/alunos'))));
console.log((falha ? '::error::' : '::notice::') + 'Presença da Turma ao Vivo: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

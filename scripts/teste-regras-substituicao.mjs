// Testa a substituição de professor no emulador: a escola nomeia o substituto de uma aula num dia;
// só ele faz a chamada daquela aula como substituto, e a titular lê a chamada depois.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-substituicao.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const prof = (e) => ({ perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: e, escolas_ids: [e], municipio_id: 'm1' });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/g1'), { perfil: 'gestor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/g2'), { perfil: 'gestor', status: 'ativo', escola_id: 'e2', escolas_ids: ['e2'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/tit'), prof('e1'));
  await setDoc(doc(db, 'usuarios/sub'), prof('e1'));
  await setDoc(doc(db, 'usuarios/outro'), prof('e1'));
  await setDoc(doc(db, 'turmas/t1'), { nome: '6º Ano A', escola_id: 'e1', municipio_id: 'm1', criado_por: 'x' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('FALHA:', nome, e.message); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const D = '2026-10-28', SID = `e1_${D}_t1_ciencias`;
const sub = (o) => ({ escola_id: 'e1', municipio_id: 'm1', dia: D, turma_id: 't1', turma_nome: '6º Ano A', disciplina: 'Ciências', disc_id: 'ciencias',
  titular_uid: 'tit', titular_nome: 'Júlia', substituto_uid: 'sub', substituto_nome: 'Carlos', motivo: 'Atestado', ...o });
const cham = (uid, o) => ({ professor_uid: uid, professor_nome: 'P', escola_id: 'e1', municipio_id: 'm1', turma_id: 't1', turma_nome: '6º Ano A', disciplina: 'Ciências', disc_id: 'ciencias',
  dia: D, ano: 2026, aulas: 2, lista: ['a1'], nomes: { a1: 'Ana' }, faltas: {}, just: {}, conteudo: '', ...o });

await t('direção nomeia o substituto', assertSucceeds(setDoc(doc(fs('g1'), 'substituicoes/' + SID), sub())));
await t('direção de outra escola: não', assertFails(setDoc(doc(fs('g2'), 'substituicoes/' + SID), sub())));
await t('professor não se nomeia', assertFails(setDoc(doc(fs('outro'), 'substituicoes/' + SID), sub({ substituto_uid: 'outro' }))));
await t('id fora do padrão: não', assertFails(setDoc(doc(fs('g1'), 'substituicoes/qualquer'), sub())));
await t('substituto lê a nomeação', assertSucceeds(getDoc(doc(fs('sub'), 'substituicoes/' + SID))));
await t('titular lê a nomeação', assertSucceeds(getDoc(doc(fs('tit'), 'substituicoes/' + SID))));
await t('outro professor não lê', assertFails(getDoc(doc(fs('outro'), 'substituicoes/' + SID))));
await t('substituto faz a chamada como substituto', assertSucceeds(setDoc(doc(fs('sub'), `freq_chamadas/sub_t1_${D}_ciencias`), cham('sub', { titular_uid: 'tit', titular_nome: 'Júlia' }))));
await t('titular lê a chamada do substituto', assertSucceeds(getDoc(doc(fs('tit'), `freq_chamadas/sub_t1_${D}_ciencias`))));
await t('outro professor não se diz substituto', assertFails(setDoc(doc(fs('outro'), `freq_chamadas/outro_t1_${D}_ciencias`), cham('outro', { titular_uid: 'tit' }))));
await t('outro professor continua fazendo chamada normal', assertSucceeds(setDoc(doc(fs('outro'), `freq_chamadas/outro_t1_${D}_ciencias`), cham('outro'))));
await t('titular falsa: não', assertFails(setDoc(doc(fs('sub'), `freq_chamadas/sub_t1_${D}_ciencias`), cham('sub', { titular_uid: 'outro' }))));
await t('gestor sem nomeação não faz chamada', assertFails(setDoc(doc(fs('g1'), `freq_chamadas/g1_t1_${D}_ciencias`), cham('g1'))));
await t('direção se nomeia substituta', assertSucceeds(setDoc(doc(fs('g1'), 'substituicoes/' + SID), sub({ substituto_uid: 'g1', substituto_nome: 'Marta' }))));
await t('direção nomeada faz a chamada', assertSucceeds(setDoc(doc(fs('g1'), `freq_chamadas/g1_t1_${D}_ciencias`), cham('g1', { titular_uid: 'tit', titular_nome: 'Júlia' }))));
await t('direção desfaz a nomeação', assertSucceeds(deleteDoc(doc(fs('g1'), 'substituicoes/' + SID))));
console.log(`substituição: ${ok} ok, ${falha} falha(s)`);
await env.cleanup(); process.exit(falha ? 1 : 0);

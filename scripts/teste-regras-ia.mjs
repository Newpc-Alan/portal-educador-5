// Testa Meus materiais do IA Studio (ia_materiais) no emulador: cada professor grava, lê e mexe só nos próprios pedidos.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-ia.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, collection, query, where } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'Lab', status: 'ativo' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p2'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/al'), { perfil: 'aluno', status: 'ativo', escola_id: 'e1', municipio_id: 'm1' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const mat = (o) => ({ uid: 'p1', titulo: 'Ciclos e Processos · Ciclo da água · Ciências', area: 'ciencias', area_nome: 'Ciências', pasta: 'atividades-de-ciencias', modo: 'ciclos',
  valores: { pasta: 'atividades-de-ciencias', modo: 'ciclos', campos: { 'c-processo': 'Ciclo da água', 'i-serie': '6º Ano' }, chips: {} },
  turma_id: 't1', turma_nome: '6º Ano A', ia: 'chatgpt', favorito: false, criado_em: new Date(), usado_em: new Date(), ...o });
await t('professor guarda o pedido', assertSucceeds(setDoc(doc(fs('p1'), 'ia_materiais/m1'), mat())));
await t('não guarda em nome de outro', assertFails(setDoc(doc(fs('p2'), 'ia_materiais/m2'), mat())));
await t('campo estranho: não', assertFails(setDoc(doc(fs('p1'), 'ia_materiais/m3'), mat({ comando: 'x' }))));
await t('título grande demais: não', assertFails(setDoc(doc(fs('p1'), 'ia_materiais/m4'), mat({ titulo: 'x'.repeat(161) }))));
await t('aluno não guarda', assertFails(setDoc(doc(fs('al'), 'ia_materiais/m5'), mat({ uid: 'al' }))));
await t('pedido do motor novo (com entrega, tipo, tema, série e BNCC)', assertSucceeds(setDoc(doc(fs('p1'), 'ia_materiais/m6'), mat({ entrega: 'atividade', tipo: 'ciclos', tipo_nome: 'Ciclos e Processos', tema: 'Ciclo da água', serie: '6º Ano', bncc: 'EF06CI04', motor: 'atividade-1', valores: { v: 2, pedido: { area: 'ciencias', tipo: 'ciclos' } } }))));
await t('BNCC grande demais: não', assertFails(setDoc(doc(fs('p1'), 'ia_materiais/m7'), mat({ bncc: 'x'.repeat(121) }))));
await t('dono lê', assertSucceeds(getDoc(doc(fs('p1'), 'ia_materiais/m1'))));
await t('dono lista os seus', assertSucceeds(getDocs(query(collection(fs('p1'), 'ia_materiais'), where('uid', '==', 'p1')))));
await t('outro professor não lê', assertFails(getDoc(doc(fs('p2'), 'ia_materiais/m1'))));
await t('outro professor não lista os do colega', assertFails(getDocs(query(collection(fs('p2'), 'ia_materiais'), where('uid', '==', 'p1')))));
await t('dono marca favorito', assertSucceeds(updateDoc(doc(fs('p1'), 'ia_materiais/m1'), { favorito: true })));
await t('dono registra novo uso', assertSucceeds(updateDoc(doc(fs('p1'), 'ia_materiais/m1'), { ia: 'gemini', usado_em: new Date() })));
await t('dono não troca o dono', assertFails(updateDoc(doc(fs('p1'), 'ia_materiais/m1'), { uid: 'p2' })));
await t('dono não troca os valores por update', assertFails(updateDoc(doc(fs('p1'), 'ia_materiais/m1'), { valores: {} })));
await t('outro não marca favorito', assertFails(updateDoc(doc(fs('p2'), 'ia_materiais/m1'), { favorito: false })));
await t('outro não remove', assertFails(deleteDoc(doc(fs('p2'), 'ia_materiais/m1'))));
await t('dono remove', assertSucceeds(deleteDoc(doc(fs('p1'), 'ia_materiais/m1'))));
console.log(`ia_materiais: ${ok} ok, ${falha} falha(s)`);
await env.cleanup();
process.exit(falha ? 1 : 0);

// Ditar pelo celular: só o dono (professor licenciado) lê e grava ditado_remoto/{uid} e os trechos; só texto curto.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-ditado.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, addDoc, deleteDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'escolas/e1'), { nome: 'E1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p2'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/pi'), { perfil: 'professor', status: 'inativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'ditado_remoto/p1'), { ativo: true, sessao: 's1', parcial: '' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const tre = (db, uid) => collection(db, 'ditado_remoto', uid, 'trechos');

await t('dono abre a sessão', assertSucceeds(setDoc(doc(fs('p1'), 'ditado_remoto/p1'), { ativo: true, sessao: 's2', lousa_em: serverTimestamp(), parcial: '', celular_em: null })));
await t('dono lê', assertSucceeds(getDoc(doc(fs('p1'), 'ditado_remoto/p1'))));
await t('celular marca que conectou e manda parcial', assertSucceeds(setDoc(doc(fs('p1'), 'ditado_remoto/p1'), { parcial: 'hoje vamos', celular_em: serverTimestamp() }, { merge: true })));
await t('parcial gigante não', assertFails(setDoc(doc(fs('p1'), 'ditado_remoto/p1'), { parcial: 'x'.repeat(700) }, { merge: true })));
await t('campo estranho não', assertFails(setDoc(doc(fs('p1'), 'ditado_remoto/p1'), { audio: 'abc' }, { merge: true })));
await t('outro professor não lê', assertFails(getDoc(doc(fs('p2'), 'ditado_remoto/p1'))));
await t('outro professor não grava', assertFails(setDoc(doc(fs('p2'), 'ditado_remoto/p1'), { ativo: true, sessao: 'x', parcial: '' })));
await t('inativo não abre', assertFails(setDoc(doc(fs('pi'), 'ditado_remoto/pi'), { ativo: true, sessao: 'x', parcial: '' })));
await t('sem login não lê', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'ditado_remoto/p1'))));
await t('celular manda trecho', assertSucceeds(addDoc(tre(fs('p1'), 'p1'), { sessao: 's2', n: 0, texto: 'Hoje vamos falar do ciclo da água.', em: serverTimestamp() })));
await t('trecho grande demais não', assertFails(addDoc(tre(fs('p1'), 'p1'), { sessao: 's2', n: 1, texto: 'x'.repeat(1200), em: serverTimestamp() })));
await t('trecho com áudio não', assertFails(addDoc(tre(fs('p1'), 'p1'), { sessao: 's2', n: 1, texto: 'oi', em: serverTimestamp(), audio: 'b64' })));
await t('outro professor não manda trecho', assertFails(addDoc(tre(fs('p2'), 'p1'), { sessao: 's2', n: 0, texto: 'oi', em: serverTimestamp() })));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'ditado_remoto/p1/trechos/a'), { sessao: 's2', n: 5, texto: 'x', em: new Date() }); });
await t('dono não altera trecho', assertFails(updateDoc(doc(fs('p1'), 'ditado_remoto/p1/trechos/a'), { texto: 'y' })));
await t('outro professor não apaga trecho', assertFails(deleteDoc(doc(fs('p2'), 'ditado_remoto/p1/trechos/a'))));
await t('Lousa apaga o trecho usado', assertSucceeds(deleteDoc(doc(fs('p1'), 'ditado_remoto/p1/trechos/a'))));
console.log((falha ? '::error::' : '::notice::') + 'Ditado pelo celular: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

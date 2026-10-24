// Testa as regras do Firestore dos Aplicativos Úteis (Folha Mágica, Teleprompter e Portal do Educador TV) no emulador.
// Não toca no banco real. No Cloud Shell, na pasta do repositório:
//   mkdir -p /tmp/rt && cp scripts/teste-regras-apps.mjs /tmp/rt/ && (cd /tmp/rt && npm i --silent @firebase/rules-unit-testing@3 firebase@10)
//   firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-apps.mjs $PWD/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const CH = 'Kq3mZx8LpR2tVw9Yb4Nc', CH2 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg';

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(); const s = (p, d) => setDoc(doc(db, p), d);
  await s('municipios/m1', { nome: 'Ribas' }); await s('municipios/m2', { nome: 'Outra' });
  await s('escolas/e1', { nome: 'EM Centro', municipio_id: 'm1' }); await s('escolas/e2', { nome: 'EM Vila', municipio_id: 'm1' }); await s('escolas/e9', { nome: 'Longe', municipio_id: 'm2' });
  await s('usuarios/prof', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await s('usuarios/prof2', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e9', escolas_ids: ['e9'], municipio_id: 'm2' });
  await s('usuarios/gest', { perfil: 'gestor', status: 'ativo', escola_id: 'e2', escolas_ids: ['e2'], municipio_id: 'm1' });
  await s('usuarios/sec', { perfil: 'secretaria', status: 'ativo', municipio_id: 'm1' });
  await s('usuarios/alu', { perfil: 'aluno', status: 'ativo', municipio_id: 'm1' });
  await s('usuarios/venc', { perfil: 'professor', status: 'ativo', licenca_tipo: 'avulsa', licenca_fim: Timestamp.fromMillis(Date.now() - 86400000), municipio_id: null, escola_id: null });
  await s(`tv_telas/${CH}`, { nome: 'TV', escola_id: 'e1', municipio_id: 'm1', playlist_id: 'p1', canal: 'c1' });
  await s('tv_playlists/p1', { nome: 'P', escola_id: 'e1', municipio_id: 'm1', itens: [] });
  await s('tv_canais/c1', { municipio_id: 'm1', avisos: [] });
  await s('tv_pareamentos/ABC234', { chave: CH2, criado_em: Timestamp.now() });
  await s('usuarios/prof/roteiros/r0', { titulo: 'x', texto: 'y', markers: [] });
});

let ok = 0, falhas = 0;
async function t(nome, p) { try { await p; ok++; } catch (e) { falhas++; console.log('FALHA:', nome, '-', String(e.message || e).slice(0, 160)); } }
const ctx = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const anon = env.unauthenticatedContext().firestore();
const prof = ctx('prof'), prof2 = ctx('prof2'), gest = ctx('gest'), sec = ctx('sec'), alu = ctx('alu'), venc = ctx('venc');

// ---------- Folha Mágica
const folha = { nome: 'Pauta', tipo: 'music', cfg: { type: 'music' }, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('professor salva folha', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/folhas/f1'), folha)));
await t('folha com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/folhas/f2'), { ...folha, x: 1 })));
await t('folha na conta de outro', assertFails(setDoc(doc(prof2, 'usuarios/prof/folhas/f3'), folha)));
await t('outro nao le minhas folhas', assertFails(getDoc(doc(prof2, 'usuarios/prof/folhas/f1'))));
await t('licenca vencida nao grava folha', assertFails(setDoc(doc(venc, 'usuarios/venc/folhas/f1'), folha)));
await t('gestor salva folha', assertSucceeds(setDoc(doc(gest, 'usuarios/gest/folhas/f1'), folha)));
await t('aluno nao salva folha', assertFails(setDoc(doc(alu, 'usuarios/alu/folhas/f1'), folha)));

// ---------- Teleprompter
const rot = { titulo: 'Aula', texto: 'Texto', settings: {}, markers: [], locked: false, cursor: 0, elapsed: 0, palavras: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('professor salva roteiro', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/roteiros/r1'), rot)));
await t('roteiro grande demais', assertFails(setDoc(doc(prof, 'usuarios/prof/roteiros/r2'), { ...rot, texto: 'a'.repeat(200001) })));
await t('roteiro com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/roteiros/r3'), { ...rot, dono: 'x' })));
await t('outro nao le roteiro', assertFails(getDoc(doc(prof2, 'usuarios/prof/roteiros/r0'))));
await t('dono apaga roteiro', assertSucceeds(deleteDoc(doc(prof, 'usuarios/prof/roteiros/r0'))));
await t('sessao do teleprompter', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/tele/sessao'), { ativo: true, bloco: 1 })));
await t('so o doc sessao', assertFails(setDoc(doc(prof, 'usuarios/prof/tele/outro'), { ativo: true })));
await t('outro nao le a sessao', assertFails(getDoc(doc(prof2, 'usuarios/prof/tele/sessao'))));
await t('celular manda comando', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/tele_cmd/c1'), { acao: 'proximo', em: serverTimestamp() })));
await t('comando desconhecido', assertFails(setDoc(doc(prof, 'usuarios/prof/tele_cmd/c2'), { acao: 'apagar_tudo', em: serverTimestamp() })));
await t('outra conta nao manda comando', assertFails(setDoc(doc(prof2, 'usuarios/prof/tele_cmd/c3'), { acao: 'proximo', em: serverTimestamp() })));
await t('dono apaga comando', assertSucceeds(deleteDoc(doc(prof, 'usuarios/prof/tele_cmd/c1'))));

// ---------- TV: pareamento (a TV não tem login)
const par = cod => ({ chave: CH2, criado_em: serverTimestamp(), orientacao: 'h', resolucao: '1920x1080' });
await t('tv cria codigo sem login', assertSucceeds(setDoc(doc(anon, 'tv_pareamentos/XYZ789'), par())));
await t('tv nao sobrescreve codigo existente', assertFails(setDoc(doc(anon, 'tv_pareamentos/ABC234'), par())));
await t('codigo fora do alfabeto', assertFails(setDoc(doc(anon, 'tv_pareamentos/ABC10O'), par())));
await t('chave curta', assertFails(setDoc(doc(anon, 'tv_pareamentos/QWE234'), { ...par(), chave: 'abc' })));
await t('anonimo nao le codigo', assertFails(getDoc(doc(anon, 'tv_pareamentos/ABC234'))));
await t('aluno nao le codigo', assertFails(getDoc(doc(alu, 'tv_pareamentos/ABC234'))));
await t('professor le codigo', assertSucceeds(getDoc(doc(prof, 'tv_pareamentos/ABC234'))));

// ---------- TV: telas
const tela = (esc, m) => ({ nome: 'TV pátio', escola_id: esc, municipio_id: m, orientacao: 'v', playlist_id: 'p1', agenda: {}, canal: 'c1', criado_em: serverTimestamp() });
await t('professor conecta tv da escola', assertSucceeds(setDoc(doc(prof, `tv_telas/${CH2}`), tela('e1', 'm1'))));
await t('municipio errado na tela', assertFails(setDoc(doc(prof, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e1', 'm2'))));
await t('professor nao conecta tv de outra escola', assertFails(setDoc(doc(prof, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e2', 'm1'))));
await t('gestor conecta tv da escola dele', assertSucceeds(setDoc(doc(gest, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e2', 'm1'))));
await t('secretaria conecta tv do municipio', assertSucceeds(setDoc(doc(sec, 'tv_telas/Qq1Ww2Ee3Rr4Tt5Yy6Uu'), tela('e1', 'm1'))));
await t('chave fora do padrao', assertFails(setDoc(doc(prof, 'tv_telas/curta'), tela('e1', 'm1'))));
await t('tv le a propria tela sem login', assertSucceeds(getDoc(doc(anon, `tv_telas/${CH}`))));
await t('anonimo nao lista telas', assertFails(getDocs(collection(anon, 'tv_telas'))));
await t('professor lista telas da escola', assertSucceeds(getDocs(query(collection(prof, 'tv_telas'), where('escola_id', '==', 'e1'), where('municipio_id', '==', 'm1')))));
await t('professor nao lista telas de outra escola', assertFails(getDocs(query(collection(prof, 'tv_telas'), where('escola_id', '==', 'e2'), where('municipio_id', '==', 'm1')))));
await t('secretaria lista telas de escola do municipio', assertSucceeds(getDocs(query(collection(sec, 'tv_telas'), where('escola_id', '==', 'e2'), where('municipio_id', '==', 'm1')))));
await t('tv manda batimento', assertSucceeds(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: serverTimestamp(), resolucao: '1920x1080', aparelho: 'tv-5.0' })));
await t('tv nao troca a playlist sozinha', assertFails(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: serverTimestamp(), playlist_id: 'p9' })));
await t('tv nao inventa horario', assertFails(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: Timestamp.fromMillis(1), resolucao: 'x', aparelho: 'y' })));
await t('professor configura tela', assertSucceeds(updateDoc(doc(prof, `tv_telas/${CH}`), { nome: 'TV da entrada', orientacao: 'h' })));
await t('nao muda a tela de escola', assertFails(updateDoc(doc(prof, `tv_telas/${CH}`), { escola_id: 'e2' })));
await t('outro municipio nao configura', assertFails(updateDoc(doc(prof2, `tv_telas/${CH}`), { nome: 'x' })));
await t('aluno nao configura', assertFails(updateDoc(doc(alu, `tv_telas/${CH}`), { nome: 'x' })));

// ---------- TV: playlists
const pl = (esc, m, n = 1) => ({ nome: 'Manhã', escola_id: esc, municipio_id: m, itens: Array.from({ length: n }, (_, i) => ({ id: 'i' + i, tipo: 'texto', titulo: 'Aviso' })), criado_em: serverTimestamp(), atualizado_em: serverTimestamp(), atualizado_por: 'prof' });
await t('professor cria playlist', assertSucceeds(addDoc(collection(prof, 'tv_playlists'), pl('e1', 'm1'))));
await t('playlist acima de 80 itens', assertFails(addDoc(collection(prof, 'tv_playlists'), pl('e1', 'm1', 81))));
await t('playlist de outra escola', assertFails(addDoc(collection(prof, 'tv_playlists'), pl('e2', 'm1'))));
await t('tv le playlist sem login', assertSucceeds(getDoc(doc(anon, 'tv_playlists/p1'))));
await t('anonimo nao lista playlists', assertFails(getDocs(collection(anon, 'tv_playlists'))));
await t('professor edita playlist', assertSucceeds(updateDoc(doc(prof, 'tv_playlists/p1'), { itens: [{ id: 'a', tipo: 'texto' }] })));
await t('outro municipio nao edita playlist', assertFails(updateDoc(doc(prof2, 'tv_playlists/p1'), { itens: [] })));

// ---------- TV: comunicados da secretaria
await t('tv le canal sem login', assertSucceeds(getDoc(doc(anon, 'tv_canais/c1'))));
await t('anonimo nao lista canais', assertFails(getDocs(collection(anon, 'tv_canais'))));
await t('secretaria publica comunicado', assertSucceeds(updateDoc(doc(sec, 'tv_canais/c1'), { avisos: [{ id: 'a1', titulo: 'Matrículas' }] })));
await t('professor nao publica comunicado', assertFails(updateDoc(doc(prof, 'tv_canais/c1'), { avisos: [] })));
await t('gestor nao publica comunicado', assertFails(updateDoc(doc(gest, 'tv_canais/c1'), { avisos: [] })));
await t('professor cria canal vazio do municipio', assertSucceeds(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm1', avisos: [], criado_em: serverTimestamp() })));
await t('canal ja nasce com aviso', assertFails(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm1', avisos: [{ id: 'x' }] })));
await t('canal de outro municipio', assertFails(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm2', avisos: [] })));
await t('professor lista canal do municipio', assertSucceeds(getDocs(query(collection(prof, 'tv_canais'), where('municipio_id', '==', 'm1')))));
await t('mais de 30 comunicados', assertFails(updateDoc(doc(sec, 'tv_canais/c1'), { avisos: Array.from({ length: 31 }, (_, i) => ({ id: 'a' + i })) })));

console.log(`REGRAS DOS APLICATIVOS: ${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);

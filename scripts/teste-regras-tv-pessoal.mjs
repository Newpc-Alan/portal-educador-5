// TV própria do professor avulso, cortesia ou teste: ele só cria e vê as TVs e playlists dele (local u_{uid}),
// sem escola, sem município e sem canal de comunicados da Secretaria. O professor de rede continua na TV da escola.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-tv-pessoal.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, updateDoc, deleteDoc, collection, query, where, Timestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const futuro = Timestamp.fromMillis(Date.now() + 5 * 864e5), passado = Timestamp.fromMillis(Date.now() - 864e5);
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'escolas/e1'), { nome: 'E1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/av'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'teste', licenca_fim: futuro, municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/av2'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'avulsa', licenca_fim: futuro });
  await setDoc(doc(db, 'usuarios/venc'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'teste', licenca_fim: passado });
  await setDoc(doc(db, 'usuarios/rede'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1'] });
  await setDoc(doc(db, 'tv_telas/BBBBBBBBBBBBBBBBBBBB'), { escola_id: 'u_av2', municipio_id: '', nome: 'Sala do av2' });
  await setDoc(doc(db, 'tv_telas/CCCCCCCCCCCCCCCCCCCC'), { escola_id: 'e1', municipio_id: 'm1', nome: 'Escola' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const tela = (esc, m, extra = {}) => ({ escola_id: esc, municipio_id: m, nome: 'TV', canal: '', modo: 'tv', ...extra });
const Q = (db, col, esc, m) => getDocs(query(collection(db, col), where('escola_id', '==', esc), where('municipio_id', '==', m)));

await t('teste cria a própria TV', assertSucceeds(setDoc(doc(fs('av'), 'tv_telas/AAAAAAAAAAAAAAAAAAAA'), tela('u_av', ''))));
await t('teste lista as próprias TVs', assertSucceeds(Q(fs('av'), 'tv_telas', 'u_av', '')));
await t('teste cria playlist própria', assertSucceeds(setDoc(doc(fs('av'), 'tv_playlists/p1'), { escola_id: 'u_av', municipio_id: '', nome: 'Principal', itens: [] })));
await t('teste edita a playlist própria', assertSucceeds(updateDoc(doc(fs('av'), 'tv_playlists/p1'), { itens: [{ tipo: 'texto' }] })));
await t('teste lista as próprias playlists', assertSucceeds(Q(fs('av'), 'tv_playlists', 'u_av', '')));
await t('teste não liga a TV no canal da Secretaria', assertFails(setDoc(doc(fs('av'), 'tv_telas/DDDDDDDDDDDDDDDDDDDD'), tela('u_av', '', { canal: 'c1' }))));
await t('teste não põe município na TV própria', assertFails(setDoc(doc(fs('av'), 'tv_telas/EEEEEEEEEEEEEEEEEEEE'), tela('u_av', 'm1'))));
await t('teste não cria TV na escola do município', assertFails(setDoc(doc(fs('av'), 'tv_telas/FFFFFFFFFFFFFFFFFFFF'), tela('e1', 'm1'))));
await t('teste não lista as TVs da escola do município', assertFails(Q(fs('av'), 'tv_telas', 'e1', 'm1')));
await t('teste não lista as TVs de outro avulso', assertFails(Q(fs('av'), 'tv_telas', 'u_av2', '')));
await t('teste não apaga a TV de outro avulso', assertFails(deleteDoc(doc(fs('av'), 'tv_telas/BBBBBBBBBBBBBBBBBBBB'))));
await t('avulso apaga a própria TV', assertSucceeds(deleteDoc(doc(fs('av2'), 'tv_telas/BBBBBBBBBBBBBBBBBBBB'))));
await t('teste vencido não cria TV', assertFails(setDoc(doc(fs('venc'), 'tv_telas/GGGGGGGGGGGGGGGGGGGG'), tela('u_venc', ''))));
await t('professor de rede não usa a TV pessoal', assertFails(setDoc(doc(fs('rede'), 'tv_telas/HHHHHHHHHHHHHHHHHHHH'), tela('u_rede', ''))));
await t('professor de rede segue na TV da escola', assertSucceeds(Q(fs('rede'), 'tv_telas', 'e1', 'm1')));
console.log((falha ? '::error::' : '::notice::') + 'TV pessoal: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

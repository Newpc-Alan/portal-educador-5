// Testa as regras do Firestore do Vídeo interativo (videos_interativos) no emulador. Não toca no banco real.
//   mkdir -p /tmp/rt && cp scripts/teste-regras-video-interativo.mjs /tmp/rt/ && (cd /tmp/rt && npm i --silent @firebase/rules-unit-testing@3 firebase@10)
//   firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-video-interativo.mjs $PWD/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const pausa = [{ t: 30, tipo: 'vf', pergunta: 'x', opcoes: ['Verdadeiro', 'Falso'], correta: 0 }];
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(); const s = (p, d) => setDoc(doc(db, p), d);
  await s('municipios/m1', { nome: 'Rede' });
  await s('usuarios/prof', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await s('usuarios/prof2', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await s('usuarios/venc', { perfil: 'professor', status: 'ativo', licenca_tipo: 'avulsa', licenca_fim: Timestamp.fromMillis(Date.now() - 86400000) });
  await s('usuarios/alu', { perfil: 'aluno', status: 'ativo', municipio_id: 'm1' });
  await s('usuarios/adm', { perfil: 'admin', status: 'ativo' });
  await s('videos_interativos/cat_v1', { origem: 'catalogo', publicado: true, dono: '', interacoes: pausa });
  await s('videos_interativos/cat_v2', { origem: 'catalogo', publicado: false, dono: '', interacoes: pausa });
  await s('videos_interativos/p1', { origem: 'link', publicado: true, dono: 'prof', interacoes: pausa });
});
let ok = 0, falhas = 0;
async function t(nome, p) { try { await p; ok++; } catch (e) { falhas++; console.log('::error::FALHA: ' + nome + ' - ' + String(e.message || e).split('\n')[0].slice(0, 160)); } }
const _c = {}; const ctx = uid => _c[uid] || (_c[uid] = env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore());
const anon = env.unauthenticatedContext().firestore();
const prof = ctx('prof'), prof2 = ctx('prof2'), venc = ctx('venc'), alu = ctx('alu'), adm = ctx('adm');

await t('professor licenciado lê o catálogo publicado', assertSucceeds(getDoc(doc(prof, 'videos_interativos/cat_v1'))));
await t('professor não lê rascunho do catálogo', assertFails(getDoc(doc(prof, 'videos_interativos/cat_v2'))));
await t('licença vencida não lê o catálogo', assertFails(getDoc(doc(venc, 'videos_interativos/cat_v1'))));
await t('aluno não lê o catálogo (fase 1)', assertFails(getDoc(doc(alu, 'videos_interativos/cat_v1'))));
await t('anônimo não lê', assertFails(getDoc(doc(anon, 'videos_interativos/cat_v1'))));
await t('dono lê o seu', assertSucceeds(getDoc(doc(prof, 'videos_interativos/p1'))));
await t('outro professor não lê o do colega', assertFails(getDoc(doc(prof2, 'videos_interativos/p1'))));
await t('lista dos meus vídeos', assertSucceeds(getDocs(query(collection(prof, 'videos_interativos'), where('dono', '==', 'prof')))));
await t('lista do catálogo publicado', assertSucceeds(getDocs(query(collection(prof2, 'videos_interativos'), where('origem', '==', 'catalogo'), where('publicado', '==', true)))));
await t('admin lê rascunho', assertSucceeds(getDoc(doc(adm, 'videos_interativos/cat_v2'))));
await t('dono não grava direto (só a função)', assertFails(updateDoc(doc(prof, 'videos_interativos/p1'), { titulo: 'x' })));
await t('professor não cria direto', assertFails(setDoc(doc(prof, 'videos_interativos/p2'), { origem: 'link', dono: 'prof', publicado: true })));
await t('admin não grava direto (só a função)', assertFails(deleteDoc(doc(adm, 'videos_interativos/cat_v1'))));

console.log(`REGRAS DO VÍDEO INTERATIVO: ${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);

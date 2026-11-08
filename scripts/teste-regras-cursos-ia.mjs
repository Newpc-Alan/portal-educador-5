// Fábrica de cursos com IA (nov/2026): o campo "ia" (curso gerado por IA e a confirmação da revisão) só a função grava.
// A equipe edita o curso normalmente, mas não cria curso com "ia" nem marca a revisão pelo navegador.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-cursos-ia.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'cursos/ia1'), { titulo: 'Lousa', status: 'rascunho', ia: { gerado: true, revisado: false } });
  // curso exclusivo de rede (nov/2026)
  await setDoc(doc(db, 'cursos/pub'), { titulo: 'Aberto', status: 'publicado', exclusivo: false, ordem: 1 });
  await setDoc(doc(db, 'cursos/exc'), { titulo: 'Só da rede A', status: 'publicado', exclusivo: true, redes: ['munA'], ordem: 2 });
  await setDoc(doc(db, 'cursos/exc/aulas/a1'), { titulo: 'Aula', moduloId: 'm1' });
  await setDoc(doc(db, 'usuarios/profA'), { perfil: 'professor', status: 'ativo', municipio_id: 'munA' });
  await setDoc(doc(db, 'usuarios/profB'), { perfil: 'professor', status: 'ativo', municipio_id: 'munB' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const editor = env.authenticatedContext('ed', { email: 'ed@newpc.com.br', email_verified: true, papel: 'editor' }).firestore();
const prof = env.authenticatedContext('pr', { email: 'pr@x.com', email_verified: true }).firestore();

await t('editor lê curso de IA em rascunho', assertSucceeds(getDoc(doc(editor, 'cursos/ia1'))));
await t('professor não lê rascunho', assertFails(getDoc(doc(prof, 'cursos/ia1'))));
await t('editor edita o título', assertSucceeds(updateDoc(doc(editor, 'cursos/ia1'), { titulo: 'Lousa digital' })));
await t('editor não marca revisão pelo navegador', assertFails(updateDoc(doc(editor, 'cursos/ia1'), { 'ia.revisado': true })));
await t('editor não apaga o campo ia', assertFails(setDoc(doc(editor, 'cursos/ia1'), { titulo: 'x', status: 'rascunho' })));
await t('editor cria curso comum', assertSucceeds(setDoc(doc(editor, 'cursos/novo1'), { titulo: 'Novo', status: 'rascunho' })));
await t('editor não cria curso já "revisado" pela IA', assertFails(setDoc(doc(editor, 'cursos/novo2'), { titulo: 'Novo', status: 'rascunho', ia: { gerado: true, revisado: true } })));
await t('editor não publica pelo navegador', assertFails(updateDoc(doc(editor, 'cursos/ia1'), { status: 'publicado' })));

const profA = env.authenticatedContext('profA', { email: 'a@x.com', email_verified: true }).firestore();
const profB = env.authenticatedContext('profB', { email: 'b@x.com', email_verified: true }).firestore();
const anon = env.unauthenticatedContext().firestore();
await t('professor da rede lê o curso exclusivo', assertSucceeds(getDoc(doc(profA, 'cursos/exc'))));
await t('professor de outra rede não lê o curso exclusivo', assertFails(getDoc(doc(profB, 'cursos/exc'))));
await t('professor da rede lê a aula do exclusivo', assertSucceeds(getDoc(doc(profA, 'cursos/exc/aulas/a1'))));
await t('professor de outra rede não lê a aula do exclusivo', assertFails(getDoc(doc(profB, 'cursos/exc/aulas/a1'))));
await t('visitante lê curso aberto', assertSucceeds(getDoc(doc(anon, 'cursos/pub'))));
await t('visitante não lê curso exclusivo', assertFails(getDoc(doc(anon, 'cursos/exc'))));
await t('catálogo com filtro exclusivo=false funciona', assertSucceeds(getDocs(query(collection(anon, 'cursos'), where('status', '==', 'publicado'), where('exclusivo', '==', false)))));
await t('editor não muda as redes pelo navegador', assertFails(updateDoc(doc(editor, 'cursos/ia1'), { redes: ['munA'], exclusivo: true })));
await t('editor não cria curso já exclusivo', assertFails(setDoc(doc(editor, 'cursos/novo3'), { titulo: 'X', status: 'rascunho', exclusivo: true, redes: ['munA'] })));
await t('editor cria curso com exclusivo=false', assertSucceeds(setDoc(doc(editor, 'cursos/novo4'), { titulo: 'Y', status: 'rascunho', exclusivo: false })));

console.log((falha ? '::error::' : '::notice::') + 'CURSOS IA: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

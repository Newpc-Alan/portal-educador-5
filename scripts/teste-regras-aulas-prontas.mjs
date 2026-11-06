// Aulas prontas da Lousa (acervo_aulas): só a função cria; professor licenciado lê as aprovadas e soma 1 no uso;
// o administrador lê tudo, aprova, oculta e apaga. Emulador; não toca no banco real.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-aulas-prontas.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/pi'), { perfil: 'professor', status: 'inativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/al1'), { perfil: 'aluno', status: 'ativo', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'acervo_aulas/den_3-5'), { titulo: 'Dengue', status: 'aprovada', usos: 2, aula: { slides: [] } });
  await setDoc(doc(db, 'acervo_aulas/fin_1-2'), { titulo: 'Dinheiro', status: 'revisao', usos: 0, aula: { slides: [] } });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const col = db => collection(db, 'acervo_aulas');

await t('professor lê aula aprovada', assertSucceeds(getDoc(doc(fs('p1'), 'acervo_aulas/den_3-5'))));
await t('professor lista só as aprovadas', assertSucceeds(getDocs(query(col(fs('p1')), where('status', '==', 'aprovada')))));
await t('professor não lê aula em revisão', assertFails(getDoc(doc(fs('p1'), 'acervo_aulas/fin_1-2'))));
await t('professor não lista sem filtro', assertFails(getDocs(col(fs('p1')))));
await t('professor inativo não lê', assertFails(getDoc(doc(fs('pi'), 'acervo_aulas/den_3-5'))));
await t('aluno não lê', assertFails(getDoc(doc(fs('al1'), 'acervo_aulas/den_3-5'))));
await t('sem login não lê', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'acervo_aulas/den_3-5'))));
await t('professor soma 1 no uso', assertSucceeds(updateDoc(doc(fs('p1'), 'acervo_aulas/den_3-5'), { usos: 3 })));
await t('professor não soma 10 no uso', assertFails(updateDoc(doc(fs('p1'), 'acervo_aulas/den_3-5'), { usos: 13 })));
await t('professor não muda o título', assertFails(updateDoc(doc(fs('p1'), 'acervo_aulas/den_3-5'), { titulo: 'x' })));
await t('professor não aprova', assertFails(updateDoc(doc(fs('p1'), 'acervo_aulas/fin_1-2'), { status: 'aprovada' })));
await t('professor não cria', assertFails(setDoc(doc(fs('p1'), 'acervo_aulas/novo'), { titulo: 'x', status: 'aprovada', usos: 0 })));
await t('professor não apaga', assertFails(deleteDoc(doc(fs('p1'), 'acervo_aulas/den_3-5'))));
await t('admin lista tudo', assertSucceeds(getDocs(col(fs('adm')))));
await t('admin aprova com as imagens leves', assertSucceeds(updateDoc(doc(fs('adm'), 'acervo_aulas/fin_1-2'), { status: 'aprovada', imagens: { capa: { caminho: 'acervo-aulas/fin_1-2/capa-v.jpg' } }, mini: 'acervo-aulas/fin_1-2/mini.jpg', revisado_por: 'adm' })));
await t('admin não inventa status', assertFails(updateDoc(doc(fs('adm'), 'acervo_aulas/fin_1-2'), { status: 'publicada' })));
await t('admin não reescreve a aula pelo navegador', assertFails(updateDoc(doc(fs('adm'), 'acervo_aulas/fin_1-2'), { aula: { slides: [1] } })));
await t('admin não cria pelo navegador', assertFails(setDoc(doc(fs('adm'), 'acervo_aulas/novo'), { titulo: 'x', status: 'revisao', usos: 0 })));
await t('admin apaga', assertSucceeds(deleteDoc(doc(fs('adm'), 'acervo_aulas/fin_1-2'))));
console.log((falha ? '::error::' : '::notice::') + 'Aulas prontas: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

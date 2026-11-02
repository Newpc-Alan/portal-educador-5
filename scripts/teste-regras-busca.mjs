// Busca geral: índice (busca_indice) lido por quem lê os catálogos; estatística (buscas_mes) só o administrador; ninguém grava.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-busca.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/pi'), { perfil: 'professor', status: 'inativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/al1'), { perfil: 'aluno', status: 'ativo', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/sec1'), { perfil: 'secretaria', status: 'ativo', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'busca_indice/_meta'), { partes: ['p01'], total: 1 });
  await setDoc(doc(db, 'busca_indice/p01'), { itens: [{ c: 'videos', i: 'v1', t: 'Frações' }] });
  await setDoc(doc(db, 'buscas_mes/2026-11'), { total: 3, termos: { fracoes: { n: 3 } } });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
await t('professor lê o índice', assertSucceeds(getDocs(collection(fs('p1'), 'busca_indice'))));
await t('admin lê o índice', assertSucceeds(getDoc(doc(fs('adm'), 'busca_indice/p01'))));
await t('professor inativo não lê o índice', assertFails(getDoc(doc(fs('pi'), 'busca_indice/p01'))));
await t('aluno não lê o índice', assertFails(getDoc(doc(fs('al1'), 'busca_indice/p01'))));
await t('sem login não lê o índice', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'busca_indice/p01'))));
await t('professor não grava o índice', assertFails(setDoc(doc(fs('p1'), 'busca_indice/p01'), { itens: [] })));
await t('admin não grava o índice pelo navegador', assertFails(setDoc(doc(fs('adm'), 'busca_indice/p02'), { itens: [] })));
await t('admin lê o que a rede procura', assertSucceeds(getDoc(doc(fs('adm'), 'buscas_mes/2026-11'))));
await t('professor não lê as buscas', assertFails(getDoc(doc(fs('p1'), 'buscas_mes/2026-11'))));
await t('Secretaria não lê as buscas', assertFails(getDoc(doc(fs('sec1'), 'buscas_mes/2026-11'))));
await t('ninguém grava as buscas', assertFails(setDoc(doc(fs('p1'), 'buscas_mes/2026-11'), { total: 999 })));
console.log((falha ? '::error::' : '::notice::') + 'Busca geral: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

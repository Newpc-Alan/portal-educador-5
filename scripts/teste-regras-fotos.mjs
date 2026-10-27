// Testa a regra do Storage das fotos de confirmação da prova online (emulador; não toca no banco real).
// No Cloud Shell, na pasta do repositório (o firebase.json do projeto tem 3 buckets; o teste usa um mínimo, em /tmp/rtf):
//   mkdir -p /tmp/rtf && cp scripts/teste-regras-fotos.mjs storage.rules /tmp/rtf/ && cd /tmp/rtf
//   echo 'rules_version="2"; service cloud.firestore { match /databases/{d}/documents { match /{x=**} { allow read, write: if false; } } }' > fs.rules
//   echo '{"firestore":{"rules":"fs.rules"},"storage":{"rules":"storage.rules"}}' > firebase.json
//   npm i --silent @firebase/rules-unit-testing@3 firebase@10
//   firebase emulators:exec --only firestore,storage --project demo-pe5 "node teste-regras-fotos.mjs storage.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const [fh, fp] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const [sh, sp] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5',
  firestore: { host: fh, port: Number(fp) }, storage: { rules: readFileSync(process.argv[2], 'utf8'), host: sh, port: Number(sp) } });

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(), s = (p, d) => setDoc(doc(db, p), d);
  await s('usuarios/p2', { perfil: 'professor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'] });
  await s('usuarios/p3', { perfil: 'professor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'] });
  await s('usuarios/g1', { perfil: 'gestor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'] });
  await s('usuarios/g2', { perfil: 'gestor', status: 'ativo', escola_id: 'e9', escolas_ids: ['e9'] });
  await s('usuarios/a1', { perfil: 'aluno', status: 'ativo' });
  await s('usuarios/al-x9', { perfil: 'aluno', status: 'ativo' });
  const base = { professor_uid: 'p2', escola_id: 'e1', status: 'agendada', alunos_uids: ['a1'], alunos_ids: ['x9'] };
  await s('provas_online/p1', { ...base, fotos: true });
  await s('provas_online/p0', { ...base, fotos: false });
  await s('provas_online/pe', { ...base, fotos: true, status: 'encerrada' });
  await uploadBytes(ref(c.storage(), 'provas_online/p1/fotos/a1/entrega.jpg'), new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' });
});

let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('FALHA:', nome, e.message); } };
const st = (uid, claims) => (uid ? env.authenticatedContext(uid, claims || {}) : env.unauthenticatedContext()).storage();
const jpg = new Uint8Array(1000), meta = { contentType: 'image/jpeg' };
const up = (s, p, dados = jpg, m = meta) => uploadBytes(ref(s, p), dados, m);

await t('aluno envia a própria foto', assertSucceeds(up(st('a1'), 'provas_online/p1/fotos/a1/inicio.jpg')));
await t('aluno troca a própria foto', assertSucceeds(up(st('a1'), 'provas_online/p1/fotos/a1/inicio.jpg')));
await t('aluno pela matrícula (claim)', assertSucceeds(up(st('al-x9', { aluno_id: 'x9' }), 'provas_online/p1/fotos/m-x9/inicio.jpg')));
await t('aluno não envia foto de outro', assertFails(up(st('a1'), 'provas_online/p1/fotos/m-x9/inicio.jpg')));
await t('claim de outro aluno não serve', assertFails(up(st('al-y1', { aluno_id: 'y1' }), 'provas_online/p1/fotos/m-y1/inicio.jpg')));
await t('nome de arquivo livre não', assertFails(up(st('a1'), 'provas_online/p1/fotos/a1/qualquer.jpg')));
await t('só jpeg', assertFails(up(st('a1'), 'provas_online/p1/fotos/a1/inicio.jpg', jpg, { contentType: 'image/png' })));
await t('até 400 KB', assertFails(up(st('a1'), 'provas_online/p1/fotos/a1/inicio.jpg', new Uint8Array(500 * 1024))));
await t('prova sem fotos não recebe', assertFails(up(st('a1'), 'provas_online/p0/fotos/a1/inicio.jpg')));
await t('prova encerrada não recebe', assertFails(up(st('a1'), 'provas_online/pe/fotos/a1/inicio.jpg')));
await t('sem login não envia', assertFails(up(st(null), 'provas_online/p1/fotos/a1/inicio.jpg')));
await t('professor da prova vê', assertSucceeds(getBytes(ref(st('p2'), 'provas_online/p1/fotos/a1/entrega.jpg'))));
await t('outro professor não vê', assertFails(getBytes(ref(st('p3'), 'provas_online/p1/fotos/a1/entrega.jpg'))));
await t('gestor da escola vê', assertSucceeds(getBytes(ref(st('g1'), 'provas_online/p1/fotos/a1/entrega.jpg'))));
await t('gestor de outra escola não vê', assertFails(getBytes(ref(st('g2'), 'provas_online/p1/fotos/a1/entrega.jpg'))));
await t('o próprio aluno não lê', assertFails(getBytes(ref(st('a1'), 'provas_online/p1/fotos/a1/entrega.jpg'))));

console.log(`fotos: ${ok} ok, ${falha} falha(s)`);
await env.cleanup();
process.exit(falha ? 1 : 0);

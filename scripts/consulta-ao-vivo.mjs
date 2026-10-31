// Teste das regras da Turma ao vivo: aluno da turma grava a própria presença e o "visto"; não grava pela chave de outro;
// professor da escola lê; aluno não lê a lista. Apaga tudo no fim.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', limpo = t => String(t).replace(/[{}"]/g, ' ');
let falhas = 0; const ok = (c, t) => { if (!c) falhas++; console.log('::notice::' + (c ? 'OK · ' : 'FALHOU · ') + limpo(t)); };
const tk = async (uid, claims) => (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid, claims), returnSecureToken: true }) })).json()).idToken;
const base = 'https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/';
const gravar = (t, cam) => fetch(base + cam + '?currentDocument.exists=false', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t } , body: JSON.stringify({ fields: { nome: { stringValue: 'Teste' } } }) }).then(r => r.status);
const gravarTs = async (t, cam) => (await fetch(base.replace('/documents/', '/documents:commit'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify({ writes: [{ update: { name: 'projects/portal-educador-5/databases/(default)/documents/' + cam, fields: { nome: { stringValue: 'Aluno teste' } } }, updateTransforms: [{ fieldPath: 'em', setToServerValue: 'REQUEST_TIME' }] }] }) })).status;
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const turma = (await db.collection('turmas').where('escola_id', '==', prof.data().escola_id).limit(5).get()).docs[0];
const al = (await db.collection('alunos').where('turma_id', '==', turma.id).limit(2).get()).docs;
const tA = await tk('teste-av-' + al[0].id, { aluno_id: al[0].id, turma_id: turma.id, escola_id: turma.data().escola_id });
ok(await gravarTs(tA, `turma_presenca/${turma.id}/alunos/${al[0].id}`) === 200, 'aluno grava a própria presença');
if (al[1]) ok(await gravarTs(tA, `turma_presenca/${turma.id}/alunos/${al[1].id}`) === 403, 'aluno NÃO grava presença de outro colega (bloqueado)');
ok(await gravarTs(tA, `turma_presenca/outra-turma/alunos/${al[0].id}`) === 403, 'aluno NÃO grava em outra turma (bloqueado)');
const it = (await db.collection(`turma_materiais/${turma.id}/itens`).limit(1).get()).docs[0];
let itemTeste = null;
if (!it) { itemTeste = db.doc(`turma_materiais/${turma.id}/itens/teste-av`); await itemTeste.set({ titulo: 'teste', criado_em: new Date() }); }
const itemId = it ? it.id : 'teste-av';
ok(await gravarTs(tA, `turma_materiais/${turma.id}/itens/${itemId}/vistos/${al[0].id}`) === 200, 'aluno marca que abriu o material');
const tP = await tk(prof.id);
const lp = await fetch(base + `turma_presenca/${turma.id}/alunos`, { headers: { Authorization: 'Bearer ' + tP } });
ok(lp.status === 200, 'professor da escola lê quem está online (HTTP ' + lp.status + ')');
const la = await fetch(base + `turma_presenca/${turma.id}/alunos`, { headers: { Authorization: 'Bearer ' + tA } });
ok(la.status === 403, 'aluno NÃO lê a lista de presença (HTTP ' + la.status + ')');
await db.doc(`turma_presenca/${turma.id}/alunos/${al[0].id}`).delete(); await db.doc(`turma_materiais/${turma.id}/itens/${itemId}/vistos/${al[0].id}`).delete();
if (itemTeste) await itemTeste.delete();
await getAuth().deleteUser('teste-av-' + al[0].id).catch(() => {});
process.exit(falhas ? 1 : 0);

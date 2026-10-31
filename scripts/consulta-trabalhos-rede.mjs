// Teste do compartilhar dos trabalhos (Lousa) no Laboratório NEWPC: rede (com cópia do arquivo e aviso nas Novidades),
// colega lê a vitrine com as regras e usa uma cópia, e-mail (PDF mínimo só para o admin), alunos (1 página) e tirar da rede.
// Desfaz tudo no fim (cópia do colega, item da turma e a publicação na rede).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const tk = async uid => (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const fn = async (t, dados) => (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/trabalhoRede', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ data: dados }) })).json().catch(() => ({}));
let falhas = 0; const ok = (c, t) => { if (!c) falhas++; aviso((c ? 'OK · ' : 'FALHOU · ') + t); };
// autor: alguém do laboratório com aula da Lousa salva
const us = (await db.collection('usuarios').where('municipio_id', '==', 'lab-muni').where('perfil', '==', 'professor').get()).docs;
let autor = null, aula = null;
for (const u of us) { const t = (await db.collection('usuarios').doc(u.id).collection('trabalhos').limit(20).get()).docs.find(d => d.data().tipo === 'lousa' && d.data().arquivo); if (t) { autor = u; aula = t; break; } }
if (!autor) { console.log('::error::nenhum professor do laboratório tem aula da Lousa salva'); process.exit(1); }
const colega = us.find(u => u.id !== autor.id);
aviso('autor ' + autor.data().nome + ' · aula ' + aula.data().titulo + ' · colega ' + (colega && colega.data().nome));
const tA = await tk(autor.id), tC = await tk(colega.id), redeId = 'lousa_' + aula.id;
const r1 = await fn(tA, { acao: 'rede', tipo: 'lousa', id: aula.id, aceite: true, disciplina: 'Ciências', serie: '6º ano do Ensino Fundamental' });
ok(r1.result && r1.result.ok, 'compartilhar com a rede ' + limpo(JSON.stringify(r1.result || r1.error)));
const rr = (await db.doc('trabalhos_rede/' + redeId).get()).data() || {};
ok(rr.arquivo && (await bucket.file(rr.arquivo).exists())[0], 'arquivo copiado para a pasta da rede: ' + rr.arquivo);
const feed = ((await db.doc('rede_feed/lab-muni').get()).data() || {}).itens || [];
ok(feed[0] && feed[0].id === redeId && feed[0].link === '/entrar/#trabalhos-rede', 'aviso nas Novidades da rede com o link de Meus trabalhos');
const q = await fetch('https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents:runQuery', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tC },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'trabalhos_rede' }], where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'municipio_id' }, op: 'EQUAL', value: { stringValue: 'lab-muni' } } }, { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'publicado' } } }] } } } }) });
const qj = await q.json(); ok(q.status === 200 && Array.isArray(qj) && qj.some(x => x.document && x.document.name.endsWith(redeId)), 'colega vê a aula em Da sua rede (HTTP ' + q.status + ')');
const r2 = await fn(tC, { acao: 'usar', tipo: 'lousa', id: redeId });
let copia = null;
if (r2.result) { copia = (await db.doc(`usuarios/${colega.id}/trabalhos/${r2.result.id}`).get()).data(); }
ok(copia && copia.tipo === 'lousa' && (await bucket.file(copia.arquivo).exists())[0], 'colega usou uma cópia: ' + (copia ? copia.titulo + ' · ' + copia.arquivo : limpo(JSON.stringify(r2.error))));
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');
const r3 = await fn(tA, { acao: 'email', tipo: 'lousa', id: aula.id, para: ['alan@newpc.com.br'], mensagem: 'Teste do compartilhar da Lousa por e-mail (pode apagar).', anexos: [{ nome: 'aula.pdf', b64: pdf }] });
ok(r3.result && r3.result.enviados === 1, 'e-mail para o admin ' + limpo(JSON.stringify(r3.result || r3.error)));
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const pad = Buffer.concat([jpg, Buffer.alloc(300)]).toString('base64');
const turma = (await db.collection('turmas').where('escola_id', '==', autor.data().escola_id).limit(5).get()).docs.find(t => (t.data().grade || []).some(g => g && g.professor_uid === autor.id) || (autor.data().turmas_ids || []).includes(t.id));
if (turma) { const r4 = await fn(tA, { acao: 'alunos', tipo: 'lousa', id: aula.id, turmas: [turma.id], paginas: [pad] });
  const it = (await db.doc(`turma_materiais/${turma.id}/itens/${redeId}`).get()).data() || {};
  ok(r4.result && (it.paginas || []).length === 1, 'alunos: ' + limpo(JSON.stringify(r4.result || r4.error)) + ' · páginas no item ' + (it.paginas || []).length);
  await db.doc(`turma_materiais/${turma.id}/itens/${redeId}`).delete(); await bucket.deleteFiles({ prefix: `turma-materiais/${redeId}/` }).catch(() => {}); }
else aviso('autor sem turma na grade: teste de alunos pulado');
const r5 = await fn(tA, { acao: 'descompartilhar', tipo: 'lousa', id: aula.id });
const feed2 = ((await db.doc('rede_feed/lab-muni').get()).data() || {}).itens || [];
ok(r5.result && !(await db.doc('trabalhos_rede/' + redeId).get()).exists && !feed2.some(x => x.id === redeId), 'tirar da rede: saiu da vitrine e das Novidades');
if (r2.result && copia) { await bucket.file(copia.arquivo).delete().catch(() => {}); await db.doc(`usuarios/${colega.id}/trabalhos/${r2.result.id}`).delete(); aviso('cópia de teste do colega apagada'); }
process.exit(falhas ? 1 : 0);

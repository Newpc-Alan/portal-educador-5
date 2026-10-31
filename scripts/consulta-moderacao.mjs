// Teste da moderação da rede no Laboratório NEWPC (modo "aprovação antes"):
// professor compartilha um roteiro -> fica pendente (colega não vê, sem aviso nas Novidades) -> admin confere e aprova -> colega vê;
// admin oculta com motivo -> sai da vitrine; o professor reenvia -> volta como pendente; professor não abre a moderação; admin retira da rede.
// No fim: devolve o modo original do município e apaga o roteiro de teste.
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
const fnM = async (t, dados) => (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/moderarRede', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ data: dados }) })).json();
const munRef = db.doc('municipios/lab-muni'), modoAntes = ((await munRef.get()).data() || {}).rede_moderacao || null;
const us = (await db.collection('usuarios').where('municipio_id', '==', 'lab-muni').where('status', '==', 'ativo').get()).docs;
const profs = us.filter(u => u.data().perfil === 'professor'), autor = profs[0], colega = profs[1];
const admin = (await db.collection('usuarios').where('perfil', '==', 'admin').where('status', '==', 'ativo').limit(1).get()).docs[0];
const tA = await tk(autor.id), tC = await tk(colega.id), tAdm = await tk(admin.id);
const rot = db.collection('usuarios').doc(autor.id).collection('roteiros').doc('teste-moderacao');
await rot.set({ titulo: 'Roteiro de teste da moderação', texto: 'Bom dia, turma! Hoje vamos falar sobre o ciclo da água. (teste automático, pode ignorar)', criado_em: new Date() });
const redeId = 'roteiro_teste-moderacao', rref = db.doc('trabalhos_rede/' + redeId);
const vitrine = async t => { const q = await fetch('https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents:runQuery', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'trabalhos_rede' }], where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'municipio_id' }, op: 'EQUAL', value: { stringValue: 'lab-muni' } } }, { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'publicado' } } }] } } } }) });
  const j = await q.json(); return Array.isArray(j) && j.some(x => x.document && x.document.name.endsWith(redeId)); };
try {
  const m1 = await fnM(tAdm, { acao: 'modo', municipio_id: 'lab-muni', modo: 'antes' });
  ok(m1.result && m1.result.modo === 'antes', 'admin liga a aprovação antes ' + limpo(JSON.stringify(m1.result || m1.error)));
  const mP = await fnM(tA, { acao: 'listar' });
  ok(mP.error && /secretaria/.test(mP.error.message), 'professor NÃO abre a moderação (' + limpo(mP.error && mP.error.message) + ')');
  const r1 = await fn(tA, { acao: 'rede', tipo: 'roteiro', id: 'teste-moderacao', aceite: true, disciplina: 'Ciências', serie: '6º ano' });
  ok(r1.result && r1.result.pendente === true, 'compartilhar fica pendente ' + limpo(JSON.stringify(r1.result || r1.error)));
  const feed = ((await db.doc('rede_feed/lab-muni').get()).data() || {}).itens || [];
  ok(!feed.some(x => x.id === redeId), 'pendente NÃO entra nas Novidades da rede');
  ok(!(await vitrine(tC)), 'colega NÃO vê o pendente na vitrine');
  const s1 = await fn(tA, { acao: 'situacao', tipo: 'roteiro', id: 'teste-moderacao' });
  ok(s1.result && s1.result.rede && s1.result.rede.status === 'pendente', 'autor vê "aguardando aprovação"');
  const l1 = await fnM(tAdm, { acao: 'listar', municipio_id: 'lab-muni' });
  ok(l1.result && l1.result.itens.some(x => x.id === redeId && x.status === 'pendente'), 'aparece em Aguardando na moderação (' + (l1.result ? l1.result.itens.length : 0) + ' itens no total)');
  const v = await fnM(tAdm, { acao: 'ver', col: 'trab', id: redeId });
  ok(v.result && /ciclo da água/.test(v.result.texto), 'conferir mostra o texto do roteiro');
  const ap = await fnM(tAdm, { acao: 'decidir', col: 'trab', id: redeId, decisao: 'aprovar' });
  const feed2 = ((await db.doc('rede_feed/lab-muni').get()).data() || {}).itens || [];
  ok(ap.result && ap.result.status === 'publicado' && feed2.some(x => x.id === redeId), 'aprovar publica e avisa nas Novidades');
  ok(await vitrine(tC), 'colega passa a ver na vitrine');
  const oc0 = await fnM(tAdm, { acao: 'decidir', col: 'trab', id: redeId, decisao: 'ocultar', motivo: '' });
  ok(oc0.error, 'ocultar sem motivo é recusado');
  const oc = await fnM(tAdm, { acao: 'decidir', col: 'trab', id: redeId, decisao: 'ocultar', motivo: 'Teste automático: revise a saudação.' });
  const orig = ((await rot.get()).data() || {}).rede || {};
  ok(oc.result && oc.result.status === 'oculto' && !(await vitrine(tC)) && orig.status === 'oculto', 'ocultar tira da vitrine e marca no original do professor');
  await fnM(tAdm, { acao: 'modo', municipio_id: 'lab-muni', modo: 'depois' });
  const r2 = await fn(tA, { acao: 'rede', tipo: 'roteiro', id: 'teste-moderacao', aceite: true, disciplina: 'Ciências', serie: '6º ano' });
  ok(r2.result && r2.result.pendente === true, 'mesmo no modo "depois", material oculto volta como pendente');
  const log = await db.collection('rede_moderacao_log').where('item_id', '==', redeId).get();
  ok(log.size >= 2, 'decisões registradas no histórico (' + log.size + ')');
  const rm = await fnM(tAdm, { acao: 'decidir', col: 'trab', id: redeId, decisao: 'remover', motivo: 'Teste automático: limpeza.' });
  ok(rm.result && rm.result.status === 'removido' && !(await rref.get()).exists && !((await rot.get()).data() || {}).rede, 'retirar da rede apaga a cópia e limpa o original');
  await Promise.all(log.docs.map(x => x.ref.delete())); (await db.collection('rede_moderacao_log').where('item_id', '==', redeId).get()).docs.forEach(x => x.ref.delete());
} finally {
  await munRef.set({ rede_moderacao: modoAntes || (await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href)).FieldValue.delete() }, { merge: true });
  await rref.delete().catch(() => {}); await rot.delete().catch(() => {});
  aviso('limpeza feita · modo do laboratório devolvido para ' + (modoAntes || 'padrão (depois)'));
}
process.exit(falhas ? 1 : 0);

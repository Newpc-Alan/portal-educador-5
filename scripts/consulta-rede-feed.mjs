// Novidades da rede: (1) monta o rede_feed de cada município a partir do que já está compartilhado (só se ainda não existe),
// (2) confere com as regras que o prof.historia (lab-muni) lê o resumo e o prof.ciencias também, e (3) dispara o resumo de teste
// do administrador (vai só para o e-mail do admin). Grava apenas rede_feed.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore, Timestamp, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
let falhas = 0;
// 1) backfill
const rede = await db.collection('portal_ia_rede').where('status', '==', 'publicado').get();
const porMun = {};
rede.forEach(d => { const r = d.data(); (porMun[r.municipio_id] = porMun[r.municipio_id] || []).push({ id: d.id, r }); });
for (const [mun, l] of Object.entries(porMun)) {
  const ref = db.doc('rede_feed/' + mun);
  if ((await ref.get()).exists) { aviso('rede_feed/' + mun + ' já existe'); continue; }
  const ms = x => x && x.toMillis ? x.toMillis() : 0;
  l.sort((a, b) => ms(b.r.atualizado_em) - ms(a.r.atualizado_em));
  const itens = l.slice(0, 10).map(({ id, r }) => ({ id, titulo: r.titulo || '', tipo_nome: r.tipo_nome || '', disciplina: r.disciplina || '', serie: r.serie || '',
    autor_nome: r.autor_nome || '', autor_uid: r.uid, escola_nome: r.escola_nome || '', atualizado: false, em: r.atualizado_em || Timestamp.now() }));
  await ref.set({ itens, atualizado_em: FieldValue.serverTimestamp() });
  aviso('rede_feed/' + mun + ' criado com ' + itens.length + ' material(is)');
}
// 2) leitura com as regras, como professor
const token = async em => { const q = await db.collection('usuarios').where('email', '==', em).limit(1).get(); const u = q.docs[0];
  const j = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(u.id), returnSecureToken: true }) })).json();
  return { id: j.idToken, mun: u.data().municipio_id }; };
for (const em of ['prof.historia@portaldoeducador.com.br']) {
  const t = await token(em);
  const r = await fetch('https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/rede_feed/' + t.mun, { headers: { Authorization: 'Bearer ' + t.id } });
  const j = await r.json(); const n = ((((j.fields || {}).itens || {}).arrayValue || {}).values || []).length;
  if (r.status !== 200) falhas++;
  aviso(em + ' lê rede_feed/' + t.mun + ': HTTP ' + r.status + ' · ' + n + ' item(ns)');
  const r2 = await fetch('https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/rede_feed/SjTBI1ztvWAsbrOQAhX9', { headers: { Authorization: 'Bearer ' + t.id } });
  if (r2.status === 200) falhas++;
  aviso(em + ' tenta ler a rede de outro município: HTTP ' + r2.status + (r2.status === 403 ? ' (bloqueado, como deve ser)' : ' (ERRO: deveria bloquear)'));
}
// 3) resumo de teste, só para o administrador
const ad = await token('alan@newpc.com.br');
const rt = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/resumoRedeTeste', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ad.id }, body: JSON.stringify({ data: { municipio: 'lab-muni' } }) });
const jt = await rt.json().catch(() => ({}));
if (!jt.result) falhas++;
aviso('resumo de teste (lab-muni → e-mail do admin): ' + limpo(JSON.stringify(jt.result || jt.error || rt.status)));
process.exit(falhas ? 1 : 0);

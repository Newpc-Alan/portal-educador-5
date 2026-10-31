// Diagnóstico (só leitura) da vitrine "Da sua rede" do Portal IA: o que está compartilhado, em que rede e com que status,
// e quantos professores/gestores ativos daquela rede conseguem ver (regra: status ativo, perfil professor ou gestor, mesmo município).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const rede = await db.collection('portal_ia_rede').get();
aviso('materiais na rede: ' + rede.size);
const muns = new Set();
for (const d of rede.docs) {
  const r = d.data(); muns.add(r.municipio_id);
  const autor = await db.doc('usuarios/' + r.uid).get(); const a = autor.exists ? autor.data() : {};
  aviso('• ' + (r.titulo || '?') + ' · autor ' + (r.autor_nome || '?') + ' (perfil ' + a.perfil + ', status ' + a.status + ', município do autor ' + a.municipio_id + ') · rede ' + r.municipio_id + ' · status ' + r.status + ' · denúncias ' + (r.denuncias || 0) + ' · usos ' + (r.usos || 0));
}
for (const m of muns) {
  const us = await db.collection('usuarios').where('municipio_id', '==', m).get();
  const cont = {}; us.forEach(u => { const x = u.data(); const k = (x.perfil || 'sem perfil') + '/' + (x.status || 'sem status'); cont[k] = (cont[k] || 0) + 1; });
  const mu = await db.doc('municipios/' + m).get();
  aviso('rede ' + m + ' (' + (mu.exists ? mu.data().nome : '?') + '): usuários por perfil/status · ' + Object.entries(cont).map(([k, v]) => k + ' ' + v).join(' · '));
}
// conta que está tentando ver: perfil, status, município, e a mesma consulta da tela feita COM as regras (como o professor)
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
for (const em of ['prof.historia@portaldoeducador.com.br']) {
  const q = await db.collection('usuarios').where('email', '==', em).limit(1).get();
  if (q.empty) { aviso(em + ': sem cadastro em usuarios'); continue; }
  const u = q.docs[0], x = u.data();
  aviso(em + ' · perfil ' + x.perfil + ' · status ' + x.status + ' · município ' + x.municipio_id + ' · licença ' + (x.licenca_tipo || '-'));
  const j = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(u.id), returnSecureToken: true }) })).json();
  const corpo = { structuredQuery: { from: [{ collectionId: 'portal_ia_rede' }], where: { compositeFilter: { op: 'AND', filters: [
    { fieldFilter: { field: { fieldPath: 'municipio_id' }, op: 'EQUAL', value: { stringValue: x.municipio_id || '' } } },
    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'publicado' } } } ] } }, limit: 300 } };
  const r = await fetch('https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents:runQuery', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j.idToken }, body: JSON.stringify(corpo) });
  const t = await r.json().catch(() => null);
  aviso(em + ' · consulta da vitrine com as regras: HTTP ' + r.status + ' · ' + (Array.isArray(t) ? t.filter(z => z.document).length + ' material(is)' : limpo(JSON.stringify(t)).slice(0, 300)));
}

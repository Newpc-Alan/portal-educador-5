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

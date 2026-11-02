// Formação Continuada: liga os perfis antigos (users/{uid}) ao cadastro do Portal (município e escola pelos ids) e dá o papel
// de administrador da Formação a quem é administrador do Portal. Sem GRAVAR, só simula e mostra o que mudaria.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { camposDoPortal } = await import(pathToFileURL(process.cwd() + '/formacao-sync.js').href);
const GRAVAR = globalThis.GRAVAR === true, db = getFirestore();
const us = await db.collection('users').get();
let ligados = 0, semPortal = 0, avulsos = 0, mudouEscola = 0;
for (const d of us.docs) {
  const u = (await db.doc('usuarios/' + d.id).get()).data();
  if (!u) { semPortal++; continue; }
  const f = await camposDoPortal(db, u), x = d.data();
  if (!f.municipio_id) avulsos++; else { ligados++; if ((x.escola || '') !== (f.escola || '')) mudouEscola++; }
  if (GRAVAR) await d.ref.set(f, { merge: true });
}
console.log('::notice::' + (GRAVAR ? 'Gravado' : 'Simulação') + ': ' + us.size + ' perfil(is) da Formação · ' + ligados + ' ligados a uma rede (' + mudouEscola + ' com escola diferente do Portal) · ' + avulsos + ' sem rede (avulsos) · ' + semPortal + ' sem cadastro no Portal (ficam como estão)');
const adms = await db.collection('usuarios').where('perfil', '==', 'admin').where('status', '==', 'ativo').get();
let papeis = 0;
for (const a of adms.docs) {
  let rec; try { rec = await getAuth().getUser(a.id); } catch { continue; }
  const c = { ...(rec.customClaims || {}) }; if (c.papel === 'admin') continue;
  papeis++;
  if (GRAVAR) {
    c.papel = 'admin'; c.papel_origem = 'portal'; await getAuth().setCustomUserClaims(a.id, c);
    await db.doc('equipe/' + a.id).set({ email: rec.email || '', papel: 'admin', nome: rec.displayName || a.data().nome || '', origem: 'portal', atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: new Date(Date.now() + 183 * 86400000), acao: 'alterou', origem: 'robo', colecao: 'equipe', doc: a.id, autor_uid: '', autor_tipo: 'sistema',
      detalhe: 'Deu o papel de administrador da Formação Continuada para ' + (rec.email || a.id) + ' (administrador do Portal)', campos: ['papel'], valores: { papel: { para: 'admin' } } });
  }
}
console.log('::notice::Administradores do Portal sem papel na Formação: ' + papeis + (GRAVAR ? ' (papel dado)' : ' (seriam acertados)'));

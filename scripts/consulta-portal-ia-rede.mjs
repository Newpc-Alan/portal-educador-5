// Teste real do compartilhamento do Portal IA com a conta de laboratório prof.ciencias@ (rede lab-muni):
// compartilha um material dela, confere a cópia das imagens, faz "usar" (cria uma cópia na própria conta) e tira da rede.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', db = getFirestore();
const q = await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
const uid = q.docs[0].id;
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid), returnSecureToken: true }) })).json();
let falhas = 0;
const portal = async (dados, rot) => { const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken }, body: JSON.stringify({ data: dados }) });
  const j = await r.json().catch(() => ({})); if (!j.result) { falhas++; console.log('::error::' + rot + ' · ' + limpo((j.error || {}).message || r.status)); } return j.result; };
const docs = await db.collection('portal_ia_docs').where('uid', '==', uid).limit(100).get();
const alvo = docs.docs.find(d => d.data().tipo === 'prova' && d.data().imagens && Object.keys(d.data().imagens).length) || docs.docs.find(d => d.data().tipo === 'prova');
if (!alvo) { console.log('::error::nenhuma prova na conta de laboratório'); process.exit(1); }
aviso('material: ' + alvo.data().titulo + ' · imagens ' + Object.keys(alvo.data().imagens || {}).join(', '));
const c = await portal({ acao: 'compartilhar', id: alvo.id, aceite: true }, 'compartilhar');
if (c) { const r = (await db.doc('portal_ia_rede/' + alvo.id).get()).data();
  const imgs = Object.values(r.imagens || {}).map(v => v.caminho); const existem = await Promise.all(imgs.map(p => getStorage().bucket().file(p).exists().then(x => x[0])));
  aviso('compartilhar OK · rede ' + r.municipio_id + ' · status ' + r.status + ' · autor ' + r.autor_nome + ' · escola ' + r.escola_nome + ' · imagens copiadas ' + existem.filter(Boolean).length + ' de ' + imgs.length); }
const sem = await portal({ acao: 'compartilhar', id: alvo.id }, 'compartilhar sem aceite (deve recusar)'); if (!sem) { falhas--; aviso('sem aceite: recusado, como deve ser'); }
const u = await portal({ acao: 'usar', id: alvo.id }, 'usar');
if (u) { const n = (await db.doc('portal_ia_docs/' + u.id).get()).data(); const imgs = Object.values(n.imagens || {}).map(v => v.caminho);
  aviso('usar OK · cópia ' + n.titulo + ' · origem ' + (n.origem_rede || {}).autor_nome + ' · imagens na pasta do professor ' + imgs.filter(p => p.startsWith('portal-ia/' + uid + '/')).length + ' de ' + imgs.length); }
const pa = docs.docs.find(d => d.data().tipo === 'parecer' || d.data().tipo === 'recado');
if (pa) { const x = await portal({ acao: 'compartilhar', id: pa.id, aceite: true }, 'compartilhar ' + pa.data().tipo + ' (deve recusar)'); if (!x) { falhas--; aviso(pa.data().tipo + ': recusado (LGPD), como deve ser'); } }
const dsc = await portal({ acao: 'descompartilhar', id: alvo.id }, 'descompartilhar');
if (dsc) aviso('tirar da rede OK · documento existe ainda? ' + (await db.doc('portal_ia_rede/' + alvo.id).get()).exists);
process.exit(falhas ? 1 : 0);

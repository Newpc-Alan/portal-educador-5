// Teste do "Enviar por e-mail" do Portal IA: como prof.ciencias (Júlio), manda um material dele com um PDF mínimo
// só para o e-mail do administrador; confere também que e-mail inválido e material de outra pessoa são recusados.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const q = await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get(); const uid = q.docs[0].id;
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid), returnSecureToken: true }) })).json();
const portal = async dados => { const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken }, body: JSON.stringify({ data: dados }) }); return r.json().catch(() => ({})); };
const docs = await db.collection('portal_ia_docs').where('uid', '==', uid).limit(50).get();
const alvo = docs.docs.find(d => d.data().tipo !== 'parecer');
const outro = (await db.collection('portal_ia_docs').limit(50).get()).docs.find(d => d.data().uid !== uid);
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 60>>stream\nBT /F1 18 Tf 72 760 Td (Teste do envio por e-mail - Portal IA) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');
let falhas = 0;
const r1 = await portal({ acao: 'enviar_email', id: alvo.id, para: ['alan@newpc.com.br'], mensagem: 'Teste do envio por e-mail do Portal IA (pode apagar).', anexos: [{ nome: 'teste.pdf', b64: pdf }] });
if (!r1.result) falhas++; aviso('envio para o admin: ' + limpo(JSON.stringify(r1.result || r1.error)) + ' · material ' + alvo.data().titulo);
const r2 = await portal({ acao: 'enviar_email', id: alvo.id, para: ['isso-nao-e-email'], anexos: [{ nome: 'x.pdf', b64: pdf }] });
if (r2.result) falhas++; aviso('e-mail inválido: ' + (r2.result ? 'ERRO, enviou' : 'recusado · ' + limpo((r2.error || {}).message)));
if (outro) { const r3 = await portal({ acao: 'enviar_email', id: outro.id, para: ['alan@newpc.com.br'], anexos: [{ nome: 'x.pdf', b64: pdf }] });
  if (r3.result) falhas++; aviso('material de outra pessoa: ' + (r3.result ? 'ERRO, enviou' : 'recusado · ' + limpo((r3.error || {}).message))); }
process.exit(falhas ? 1 : 0);

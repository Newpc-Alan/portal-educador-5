// Teste de ponta a ponta do "Passar a limpo" da Lousa com a conta de laboratório prof.ciencias@: chama a função portalIa
// (lousa_rapida, modo limpo) com uma amostra de letra cursiva e mostra o resultado, o acesso e o contador do dia. Não gasta crédito.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 3000));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', db = getFirestore();
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const tk = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(prof.id), returnSecureToken: true }) })).json()).idToken;
const chamar = async d => { const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ data: d }) }); return r.json(); };
const cota = await chamar({ acao: 'cota' });
aviso('acesso lousa_limpo: ' + JSON.stringify((cota.result && cota.result.recursos && cota.result.recursos.lousa_limpo) || cota.error));
const t0 = Date.now(), r = await chamar({ acao: 'lousa_rapida', modo: 'limpo', imagem: { mime: 'image/png', dados: readFileSync('../scripts/amostras-limpo/fracoes-verde.png').toString('base64') } });
const s = ((Date.now() - t0) / 1000).toFixed(1);
if (!r.result) { console.log('::error::passar a limpo: ' + limpo(JSON.stringify(r.error || r))); process.exit(1); }
aviso('passar a limpo em ' + s + 's · uso ' + r.result.usados + ' de ' + r.result.limite + ' hoje');
r.result.blocos.forEach(b => aviso('   ' + b.tipo.toUpperCase() + ': ' + b.texto));

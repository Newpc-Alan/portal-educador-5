// Teste de estabilidade: 4 provas seguidas no Portal IA (conta de laboratório prof.ciencias@). Mostra tempo e tipos de cada uma.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const q = await getFirestore().collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
const ct = await getAuth().createCustomToken(q.docs[0].id);
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) })).json();
const casos = [['Ciências', '6º ano', 'Prova sobre o ciclo da água, 8 questões'], ['História', '6º ano', 'Prova sobre Brasil Colônia, 10 questões'],
  ['Matemática', '5º ano', 'Prova sobre frações, 10 questões'], ['Geografia', '7º ano', 'Prova sobre as regiões do Brasil, 8 questões']];
let falhas = 0;
await Promise.all(casos.map(async ([disciplina, serie, resumo]) => {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken },
    body: JSON.stringify({ data: { acao: 'gerar', tipo: 'prova', tema: resumo, resumo, contexto: { disciplina, serie } } }) });
  const j = await r.json().catch(() => ({})); const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!j.result) { falhas++; console.log('::error::' + disciplina + ' falhou em ' + s + 's · ' + limpo((j.error || {}).message || r.status).slice(0, 300)); return; }
  const qs = j.result.doc.secoes.flatMap(x => x.questoes || []); const vf = qs.find(x => x.tipo === 'vf');
  console.log('::notice::' + disciplina + ' OK em ' + s + 's · ' + qs.length + ' questões (' + qs.map(x => x.tipo).join(', ') + ')' + (vf ? ' · VF: ' + limpo(vf.alternativas.join(' / ')).slice(0, 300) : ''));
}));
process.exit(falhas ? 1 : 0);

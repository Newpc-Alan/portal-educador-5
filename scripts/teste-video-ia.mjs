// Teste de ponta a ponta do Vídeo interativo com a conta de laboratório prof.ciencias@ (rede lab-muni): acesso, gerar por link,
// salvar a edição e apagar. Gasta 3 créditos dessa conta de laboratório e não deixa nada gravado no fim.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 2500));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const db = getFirestore();
const q = await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
const ct = await getAuth().createCustomToken(q.docs[0].id);
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) })).json();
let falhas = 0;
async function v(dados, rot) {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/videoIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken }, body: JSON.stringify({ data: dados }) });
  const j = await r.json().catch(() => ({})); const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!j.result) { falhas++; console.log('::error::' + rot + ' falhou em ' + s + 's · ' + limpo((j.error || {}).status || '') + ' · ' + limpo((j.error || {}).message || '')); return null; }
  aviso(rot + ' em ' + s + 's · ' + JSON.stringify(j.result)); return j.result;
}
await v({ acao: 'acesso' }, 'acesso');
const g = await v({ acao: 'gerar', url: 'https://www.youtube.com/watch?v=' + ((await db.collection('videos').where('publicado', '==', true).limit(1).get()).docs[0].data().youtube_id), serie: '5º ano', disciplina: 'Ciências', tipos: ['multipla', 'vf', 'aberta'], qtd: 4 }, 'gerar por link');
if (g) {
  const d = (await db.doc('videos_interativos/' + g.id).get()).data();
  aviso('gravado: ' + d.titulo + ' · dono ok ' + (d.dono === q.docs[0].id) + ' · ' + d.interacoes.map(x => x.t + 's ' + x.tipo + ': ' + x.pergunta).join(' || '));
  const ed = d.interacoes.map((x, i) => i ? x : { ...x, pergunta: 'Pergunta editada no teste' });
  await v({ acao: 'salvar', id: g.id, titulo: 'Teste editado', interacoes: ed }, 'salvar');
  const d2 = (await db.doc('videos_interativos/' + g.id).get()).data(); aviso('depois de salvar: ' + d2.titulo + ' · ' + d2.interacoes[0].pergunta);
  await v({ acao: 'salvar', id: g.id, interacoes: [] }, 'salvar vazio (deve recusar)'); falhas--;
  await v({ acao: 'gerar', catalogo_id: 'x' }, 'professor gerar catálogo (deve recusar)'); falhas--;
  await v({ acao: 'excluir', id: g.id }, 'excluir');
  aviso('apagado: ' + !(await db.doc('videos_interativos/' + g.id).get()).exists);
}
if (falhas) process.exit(1);

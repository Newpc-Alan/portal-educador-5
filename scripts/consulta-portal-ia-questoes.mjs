// Teste real do "Gerar com IA" do Provas e Avaliações (conta de laboratório prof.ciencias@; gasta 1 crédito por pedido).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | '), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const q = await getFirestore().collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(q.docs[0].id), returnSecureToken: true }) })).json();
const casos = [{ disciplina: 'Ciências', turma: '6º ano A', tema: 'ciclo da água', qtd: 10, tipos: 'mista', nivel: 'médio', total: 10 },
  { disciplina: 'Matemática', turma: '5º ano B', tema: 'frações equivalentes', qtd: 8, tipos: 'multipla', nivel: 'fácil', total: 0 }];
let falhas = 0;
await Promise.all(casos.map(async c => {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken }, body: JSON.stringify({ data: { acao: 'questoes_prova', ...c } }) });
  const j = await r.json().catch(() => ({})), s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!j.result) { falhas++; console.log('::error::' + c.disciplina + ' falhou em ' + s + 's · ' + limpo((j.error || {}).message || r.status)); return; }
  const qs = j.result.questoes, soma = qs.reduce((a, x) => a + x.valor, 0), m = qs.find(x => x.tipo === 'multipla'), v = qs.find(x => x.tipo === 'vf');
  console.log('::notice::' + c.disciplina + ' OK em ' + s + 's · ' + qs.length + ' questões (' + qs.map(x => x.tipo).join(', ') + ') · soma ' + soma + ' pts · BNCC ' + [...new Set(qs.map(x => x.bncc).filter(Boolean))].join(', ') + ' · rede depois ' + (j.result.cota.rede || {}).saldo);
  if (m) console.log('::notice::  ' + c.disciplina + ' múltipla: ' + limpo(m.enun) + ' :: ' + limpo(m.alts.map((a, i) => (i === m.gab ? '[' + a + ']' : a)).join(' / ')));
  if (v) console.log('::notice::  ' + c.disciplina + ' V/F: ' + limpo(v.enun) + ' => ' + v.gab);
}));
process.exit(falhas ? 1 : 0);

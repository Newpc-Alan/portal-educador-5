// Teste de ponta a ponta da IA do Educador, com a conta de laboratório prof.ciencias@ (rede lab-muni).
// Entra como esse professor (token personalizado), chama a função iaEducadorGerar de verdade e mostra o resultado em avisos.
// Grava 1 material em Meus materiais dessa conta de laboratório e gasta 1 da cota dela.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 1800));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';   // chave pública do app web (a mesma das páginas)
const q = await getFirestore().collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
if (q.empty) { console.log('::error::conta prof.ciencias@ não encontrada'); process.exit(1); }
const uid = q.docs[0].id;
const ct = await getAuth().createCustomToken(uid);
const r1 = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
const j1 = await r1.json(); if (!j1.idToken) { console.log('::error::login falhou ' + JSON.stringify(j1).slice(0, 300)); process.exit(1); }
const casos = [
  { area: 'ciencias', tema: 'ciclo da água', serie: '6º Ano', qtd: 6, tipos: [] },
  { area: 'matematica', tema: 'frações equivalentes', serie: '5º Ano', qtd: 4, tipos: ['Múltipla escolha', 'Completar lacunas'] }
];
let falhas = 0;
for (const c of casos) {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/iaEducadorGerar', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken },
    body: JSON.stringify({ data: { entrega: 'atividade', tipo: 'exercicios', ...c, temaLivre: '', bncc: '', incl: '', turma_id: '', turma_nome: 'Teste' } }) });
  const j = await r.json().catch(() => ({}));
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  // sem chaves e aspas na saída: o GitHub esconde linhas iguais às da credencial (como "}")
  if (!j.result) { falhas++; const e = j.error || {}; console.log('::error::' + c.area + ' falhou em ' + s + 's · HTTP ' + r.status + ' · ' + (e.status || '') + ' · ' + String(e.message || '').replace(/[{}"]/g, ' ').slice(0, 400)); continue; }
  const k = j.result.conteudo;
  aviso(`${c.area} OK em ${s}s · "${k.titulo}" · BNCC ${k.bncc_codigo || '(vazio)'} · ${k.questoes.length} questões (${k.questoes.map(x => x.tipo).join(', ')}) · restante ${j.result.restante}`);
  k.questoes.forEach((x, i) => aviso(`  ${c.area} Q${i + 1} [${x.tipo}] ${x.enunciado} ${(x.alternativas || []).length ? '{' + x.alternativas.join(' / ') + '}' : ''} => ${x.resposta}`));
}
process.exit(falhas ? 1 : 0);

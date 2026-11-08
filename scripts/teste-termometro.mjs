// Teste de ponta a ponta do Termômetro da turma com a conta de laboratório prof.ciencias@: cria uma aula de teste
// (qr_aulas, aula_vivo e 12 respostas simuladas de 5º ano), pede a leitura da IA e apaga tudo no fim. Gasta 1 crédito do laboratório.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 3000));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', db = getFirestore(), TID = 'zz-teste-termometro';
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const tk = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(prof.id), returnSecureToken: true }) })).json()).idToken;
const chamar = async d => { const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/aulaIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ data: d }) }); return r.json(); };
const RESP = [
  'É quando a planta usa a luz do sol, a água e o gás carbônico pra fazer o alimento dela e solta oxigênio',
  'a planta faz a comida dela com a luz do sol',
  'fotossintese e a planta produzindo energia com a luz e liberando oxigenio pro ar',
  'é a respiração da planta, ela respira gás carbônico',
  'a planta respira de noite e solta oxigênio',
  'a planta come terra pela raiz pra crescer',
  'é quando a planta pega os nutrientes da terra e vira alimento',
  'a planta usa o sol pra fazer alimento',
  'nao sei',
  'kkkk',
  'É o processo em que a planta transforma luz em glicose, usando água e CO2, e libera oxigênio',
  'a planta precisa de sol e agua pra viver'
];
const pid = 'pteste' + Date.now();
await db.doc('qr_aulas/' + TID).set({ por: prof.id, teste: true });
await db.doc('turmas/' + TID).set({ nome: 'Turma de teste', escola_id: 'zz-teste-esc', municipio_id: 'zz-teste', teste: true });
await db.doc('aula_vivo/' + TID).set({ pesquisa: { id: pid, pergunta: 'Com as suas palavras, o que é fotossíntese?', ativa: true, em: Date.now(), tipo: 'aberta' } });
await Promise.all(RESP.map((t, i) => db.doc(`aula_vivo/${TID}/alunos/aluno${i + 1}`).set({ nome: 'Aluno ' + (i + 1), pesquisa: { id: pid, texto: t } })));
let falhou = false;
try {
  aviso('acesso: ' + JSON.stringify(await chamar({ acao: 'acesso' })));
  const t0 = Date.now(), r = await chamar({ acao: 'termometro', tid: TID, pid, serie: '5º ano' }), s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!r.result) { falhou = true; console.log('::error::termômetro falhou: ' + limpo(JSON.stringify(r.error || r))); }
  else {
    aviso('termômetro em ' + s + 's · ' + r.result.total + ' respostas · custo ' + r.result.custo + ' · sugestão: ' + r.result.sugestao);
    r.result.grupos.forEach(g => aviso(g.tipo.toUpperCase() + ' (' + g.alunos.length + '): ' + g.titulo + ' · ' + g.explicacao + ' · ex.: ' + g.exemplo + ' · ' + g.alunos.join(',')));
  }
  // registro agregado para o Painel: contagens e rótulos, sem texto e sem nome de aluno
  const rg = (await db.doc(`termometro_registros/${TID}_${pid}`).get()).data();
  if (!rg) { falhou = true; console.log('::error::registro do painel não foi gravado'); }
  else { const js = JSON.stringify(rg), vaz = RESP.some(t => t.length > 15 && js.includes(t.slice(0, 15))) || /aluno\d/.test(js);
    aviso('registro do painel: escola ' + rg.escola_id + ' · ' + rg.respostas + ' resp · entendeu ' + rg.entendeu + ' parcial ' + rg.parcial + ' confundiu ' + rg.confundiu + ' fora ' + rg.fora + (vaz ? ' · VAZOU TEXTO/ALUNO (erro!)' : ' · sem texto de aluno'));
    if (vaz || rg.entendeu + rg.parcial + rg.confundiu + rg.fora !== rg.respostas) falhou = true; }
  // outro professor (não conduz a aula) não pode ler
  const qa = await db.doc('qr_aulas/' + TID).get(); await qa.ref.set({ por: 'outro' });
  const neg = await chamar({ acao: 'termometro', tid: TID, pid });
  aviso('professor que não conduz: ' + (neg.error ? 'recusado (' + neg.error.status + ')' : 'ACEITO (erro!)')); if (!neg.error) falhou = true;
} finally {
  const al = await db.collection(`aula_vivo/${TID}/alunos`).get(); await Promise.all(al.docs.map(d => d.ref.delete()));
  await db.doc('aula_vivo/' + TID).delete(); await db.doc('qr_aulas/' + TID).delete(); await db.doc('turmas/' + TID).delete(); await db.doc(`termometro_registros/${TID}_${pid}`).delete(); aviso('dados do teste apagados');
}
if (falhou) process.exit(1);

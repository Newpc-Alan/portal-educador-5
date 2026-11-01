// Teste real dos tipos novos do Portal IA (vitrine, nov/2026). Conta de laboratório prof.ciencias@; gasta 1 crédito por tipo.
// Gera um material de cada tipo, confere o formato e APAGA o material de teste no final.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ').slice(0, 300), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const q = await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(q.docs[0].id), returnSecureToken: true }) })).json();
const casos = [
  ['planejamento', 'Matemática', '6º ano', 'Planejamento anual de Matemática do 6º ano, 5 aulas por semana'],
  ['diagnostica', 'Matemática', '4º ano', 'Avaliação diagnóstica de início de ano de Matemática', 30],
  ['simulado', 'Língua Portuguesa', '5º ano', 'Simulado de leitura e interpretação, estilo SAEB', 22],
  ['lista', 'Matemática', '7º ano', 'Lista de exercícios de porcentagem'],
  ['rubrica', 'Língua Portuguesa', '8º ano', 'Rubrica para avaliar a apresentação oral do seminário'],
  ['projeto', 'Ciências', '6º ano', 'Projeto de 1 mês sobre a água na nossa cidade, com feira no final'],
  ['resumo', 'História', '8º ano', 'Resumo de revisão sobre a Revolução Industrial'],
  ['dinamica', 'Língua Portuguesa', '3º ano', 'Dinâmica de 20 minutos para revisar adjetivos'],
  ['cacapalavras', 'Ciências', '5º ano', 'Caça-palavras sobre os planetas do sistema solar']
];
let falhas = 0; const criados = [];
const so = (process.env.SO || 'simulado').split(',').filter(Boolean);
await Promise.all(casos.filter(c => !so.length || so.includes(c[0])).map(async ([tipo, disciplina, serie, pedido, qtd]) => {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken },
    body: JSON.stringify({ data: { acao: 'gerar', tipo, resumo: pedido, tema: pedido, qtd, contexto: { disciplina, serie } } }) });
  const j = await r.json().catch(() => ({})), s = ((Date.now() - t0) / 1000).toFixed(0);
  if (!j.result) { falhas++; console.log('::error::' + tipo + ' falhou em ' + s + 's · ' + limpo((j.error || {}).message || r.status)); return; }
  criados.push(j.result.id);
  const d = j.result.doc, secs = d.secoes || [], qs = secs.flatMap(x => x.questoes || []), tabs = secs.filter(x => x.tabela && ((x.tabela.colunas || []).length || x.tabela.grade));
  let extra = '';
  if (tipo === 'cacapalavras') { const g = secs.find(x => x.tabela && x.tabela.grade); extra = ' · grade ' + (g ? g.tabela.linhas.length + 'x' + g.tabela.linhas[0].celulas.length : 'NÃO') + ' · palavras ' + (d.gabarito || []).map(x => x.resposta).join(',') + ' · 1ª ' + (d.gabarito || [])[0]?.comentario; }
  if (tipo === 'simulado') extra = ' · tipos ' + [...new Set(qs.map(x => x.tipo))].join('/');
  if (tipo === 'lista' || tipo === 'diagnostica') extra = ' · gab1: ' + ((d.gabarito || [])[0]?.comentario || '').slice(0, 120);
  if (qs.length) extra += ' · BNCC por questão: ' + qs.filter(q => q.habilidade).length + ' de ' + qs.length + ' (' + [...new Set(qs.map(q => q.habilidade).filter(Boolean))].slice(0, 6).join(', ') + ')';
  console.log('::notice::' + tipo + ' OK ' + s + 's · pedido ' + (qtd || 'padrão') + ', vieram ' + qs.length + ' · "' + limpo(d.titulo) + '" · seções: ' + secs.map(x => x.titulo).join(' / ').slice(0, 220) + ' · ' + qs.length + ' questões, ' + tabs.length + ' tabelas, gabarito ' + (d.gabarito || []).length + extra);
}));
// limpa o que o teste criou (a conta é de laboratório)
await Promise.all(criados.map(id => db.doc('portal_ia_docs/' + id).delete().catch(() => {})));
console.log('::notice::resumo: ' + (criados.length) + ' de ' + casos.filter(c => !so.length || so.includes(c[0])).length + ' tipos OK; ' + criados.length + ' materiais de teste apagados');
process.exit(falhas ? 1 : 0);

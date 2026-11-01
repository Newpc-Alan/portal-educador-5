// Recria atividades do acervo antigo (PDFs do Banco Curricular) no padrão do Portal IA, como administrador (alan@).
// Os materiais ficam em "Seus materiais" do Portal IA para validar. Padrão: 4 da Educação Infantil, um por campo de experiência.
// Variáveis: ETAPA (padrão infantil), QTD (padrão 4), IDS (lista separada por vírgula, opcional).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' ').slice(0, 260);
const ad = (await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get()).docs[0];
const tk = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(ad.id), returnSecureToken: true }) })).json()).idToken;
const ETAPA = process.env.ETAPA || 'infantil', QTD = Math.min(20, Number(process.env.QTD) || 4);
let escolhidas = (process.env.IDS || '1D3AGsukIfXEGKxwLlql_oMVBZlIuxXhD').split(',').filter(Boolean);
const SO_IMAGENS = process.env.SO_IMAGENS === '1';
if (!escolhidas.length && !SO_IMAGENS) {
  const s = await db.collection('atividades').where('etapa', '==', ETAPA).where('publicado', '==', true).select('titulo', 'arquivo_nome', 'componente', 'tipo', 'formato', 'tamanho').get();
  const l = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.tipo !== 'plano' && (x.formato || 'pdf') === 'pdf' && (x.tamanho || 0) < 6e6)
    .sort((a, b) => String(a.titulo || a.arquivo_nome).localeCompare(String(b.titulo || b.arquivo_nome), 'pt-BR'));
  console.log('::notice::acervo ' + ETAPA + ': ' + s.size + ' atividades, ' + l.length + ' candidatas');
  const porCampo = {}; l.forEach(x => { (porCampo[x.componente || 'outros'] = porCampo[x.componente || 'outros'] || []).push(x); });
  // uma por campo de experiência, do meio da lista (as primeiras costumam ser capas e índices)
  const campos = Object.keys(porCampo).sort((a, b) => porCampo[b].length - porCampo[a].length);
  for (let i = 0; escolhidas.length < QTD && i < QTD * 3; i++) { const c = porCampo[campos[i % campos.length]]; const x = c[Math.floor(c.length / 2) + Math.floor(i / campos.length)]; if (x && !escolhidas.includes(x.id)) escolhidas.push(x.id); }
}
let ok = 0;
for (const id of escolhidas) {
  // refazer: a versão anterior desta atividade sai de Seus materiais (o gatilho de exclusão apaga as imagens)
  const ant = await db.collection('portal_ia_docs').where('uid', '==', ad.id).where('modelo', '==', 'acervo').get();
  for (const d of ant.docs) if ((d.data().origem_acervo || {}).id === id) await d.ref.delete();
  const at = (await db.doc('atividades/' + id).get()).data() || {}, t0 = Date.now();
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'converter_atividade', id } }) })).json().catch(e => ({ error: { message: e.message } }));
  const s = ((Date.now() - t0) / 1000).toFixed(0);
  if (r.result) { ok++; console.log('::notice::OK ' + s + 's · original: ' + limpo(at.titulo || at.arquivo_nome) + ' [' + limpo(at.componente || '') + '] => "' + limpo(r.result.titulo) + '" · ilustração ' + (r.result.imagem ? 'sim' : 'não') + ' · BNCC ' + (r.result.bncc.join(', ') || '-')); }
  else console.log('::error::' + id + ' (' + limpo(at.titulo || at.arquivo_nome) + '): ' + limpo((r.error || {}).message || JSON.stringify(r)));
}
// fichas do acervo que ficaram sem ilustração: desenha agora (estilo para colorir)
const sem = (await db.collection('portal_ia_docs').where('uid', '==', ad.id).where('modelo', '==', 'acervo').get()).docs.filter(d => !d.data().imagem);
for (const d of sem) {
  const x = d.data(), desc = String((x.doc || {}).sugestao_imagem || x.titulo).slice(0, 600);
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'imagem', id: d.id, onde: 'topo', estilo: 'colorir', descricao: desc + '. Para a criança pintar: poucos elementos grandes, contornos grossos.' } }) })).json().catch(e => ({ error: { message: e.message } }));
  console.log('::notice::ilustração de "' + limpo(x.titulo) + '": ' + (r.result ? 'feita' : limpo((r.error || {}).message || 'falhou')));
}
console.log('::notice::resumo: ' + ok + ' de ' + escolhidas.length + ' recriadas; estão em Seus materiais do Portal IA (conta alan@)');

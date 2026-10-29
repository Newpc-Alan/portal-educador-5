// Teste de ponta a ponta do Portal IA, com a conta de laboratório prof.ciencias@ (rede lab-muni).
// Entra como esse professor, chama a função portalIa de verdade (entender, gerar 3 tipos, ajustar e 1 imagem) e mostra o resultado em avisos.
// Grava os materiais em portal_ia_docs dessa conta de laboratório e gasta a cota dela.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
// sem chaves e aspas na saída: o GitHub esconde linhas iguais às da credencial (como "}")
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 1800));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';   // chave pública do app web (a mesma das páginas)
const q = await getFirestore().collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get();
if (q.empty) { console.log('::error::conta prof.ciencias@ não encontrada'); process.exit(1); }
const ct = await getAuth().createCustomToken(q.docs[0].id);
const r1 = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
const j1 = await r1.json(); if (!j1.idToken) { console.log('::error::login falhou'); process.exit(1); }
let falhas = 0;
async function portal(dados, rotulo) {
  const t0 = Date.now();
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken }, body: JSON.stringify({ data: dados }) });
  const j = await r.json().catch(() => ({})); const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (!j.result) { falhas++; const e = j.error || {}; console.log('::error::' + rotulo + ' falhou em ' + s + 's · HTTP ' + r.status + ' · ' + limpo(e.status || '') + ' · ' + limpo(e.message || '').slice(0, 400)); return null; }
  return { ...j.result, s };
}
const ctx = { disciplina: 'Ciências', serie: '6º ano', turma: 'Teste' };
const resumoDoc = d => (d.secoes || []).map(x => x.titulo + ((x.questoes || []).length ? ' (' + x.questoes.length + ' questões: ' + x.questoes.map(y => y.tipo).join(', ') + ')' : '') + ((x.itens || []).length ? ' (' + x.itens.length + ' itens)' : '')).join(' · ');
const c0 = await portal({ acao: 'cota' }, 'cota'); if (c0) aviso('cota: plano ' + c0.plano + ' · textos ' + c0.textos + ' · imagens ' + c0.imagens);
const e1 = await portal({ acao: 'entender', texto: 'preciso de uma prova sobre o ciclo da água', contexto: ctx }, 'entender prova');
if (e1) aviso('entender em ' + e1.s + 's · tipo ' + e1.tipo + ' · tema ' + e1.tema + ' · perguntas: ' + (e1.perguntas.map(p => p.pergunta + ' [' + p.opcoes.join(' / ') + ']').join(' ; ') || 'nenhuma'));
const e2 = await portal({ acao: 'entender', texto: 'corrige a redação do meu aluno', contexto: ctx }, 'entender redação');
if (e2 && e1) aviso('entender em ' + e2.s + 's · tipo ' + e2.tipo + ' · perguntas: ' + (e2.perguntas.map(p => p.pergunta + (p.livre ? ' (livre)' : '')).join(' ; ') || 'nenhuma'));
const casos = [
  { tipo: 'prova', tema: 'ciclo da água', resumo: 'Prova do 2º bimestre sobre o ciclo da água, 8 questões, valendo 10.', qtd: 8 },
  { tipo: 'plano', tema: 'frações equivalentes', resumo: 'Plano de 2 aulas de 50 minutos sobre frações equivalentes, com atividade em dupla.', contexto: { disciplina: 'Matemática', serie: '5º ano' } },
  { tipo: 'recado', tema: 'reunião de pais', resumo: 'Reunião de pais na quinta-feira, às 19h, para entregar os boletins do bimestre.' }
];
let idProva = '';
for (const c of casos) {
  const r = await portal({ acao: 'gerar', ...c, contexto: c.contexto || ctx }, 'gerar ' + c.tipo); if (!r) continue;
  if (c.tipo === 'prova') idProva = r.id;
  aviso(c.tipo + ' OK em ' + r.s + 's · ' + r.doc.titulo + ' · ' + resumoDoc(r.doc) + ' · gabarito ' + (r.doc.gabarito || []).length + ' · BNCC ' + (r.doc.bncc || []).map(b => b.codigo).join(', ') + ' · restam ' + r.cota.textos);
  const qs = (r.doc.secoes || []).flatMap(x => x.questoes || []);
  // o GitHub mostra só 10 avisos por etapa: uma amostra por material
  const vf = qs.find(x => x.tipo === 'vf') || qs[0];
  if (vf) aviso('  ' + c.tipo + ' amostra [' + vf.tipo + ', ' + (vf.valor || 0) + ' pt] ' + vf.enunciado + ' :: ' + (vf.alternativas || []).join(' / ') + ' · soma ' + qs.reduce((a, x) => a + (Number(x.valor) || 0), 0));
  if (r.doc.versao_whatsapp) aviso('  WhatsApp: ' + r.doc.versao_whatsapp);
}
if (idProva) { const a = await portal({ acao: 'ajustar', id: idProva, instrucao: 'Mais fácil', contexto: ctx }, 'ajustar'); if (a) aviso('ajustar OK em ' + a.s + 's · ' + a.doc.titulo + ' · ' + resumoDoc(a.doc)); }
if (idProva) { const im = await portal({ acao: 'imagem', id: idProva, descricao: 'o ciclo da água com o Sol, um rio, nuvens e chuva sobre um morro', estilo: 'didatica' }, 'imagem');
  if (im) aviso('imagem OK em ' + im.s + 's · ' + im.mime + ' · ' + Math.round(im.dados.length * 0.75 / 1024) + ' KB · ' + im.caminho + ' · imagens restantes ' + im.cota.imagens); }
process.exit(falhas ? 1 : 0);

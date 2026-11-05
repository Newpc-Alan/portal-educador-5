// Selo Rede Verde · Painel de Impacto Ambiental: estima o papel e a impressão que a rede deixou de usar no ano letivo,
// a partir do que já fica gravado no Portal (nenhum clique novo é rastreado). Só totais por escola, sem nomes.
// Regras de contagem (conservadoras, explicadas no painel):
//   provas online   cada prova entregue por aluno = 1 folha a cada 10 questões (mínimo 1)
//   materiais       cada material enviado à turma (menos links) = 1 folha por aluno ativo da turma
//   famílias        cada aviso ou comunicado enviado por e-mail à família = 1 folha (o bilhete)
//   chamada         diário de classe: 1 folha a cada 20 chamadas lançadas (uma página por turma e disciplina no mês)
// Fatores (editáveis por município em municipios/{id}.impacto, com padrão abaixo):
//   custo por página (papel + toner), páginas por cartucho de toner e gramas de CO2e por folha.
// O CO2e é só o da fabricação do papel (Environmental Paper Network, Paper Calculator 3.2, via PaperCut: 12,7 g por folha A4).
// Não é crédito de carbono certificado: o painel diz isso com todas as letras.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const PADRAO = { custo_pagina: 0.15, paginas_toner: 2000, co2_g_folha: 12.7, niveis: { bronze: 10, prata: 25, ouro: 50 } };   // níveis em folhas por aluno no ano
const FONTES = ['provas', 'materiais', 'familias', 'chamada'];
const cache = new Map();   // município_ano -> { em, dados } (30 minutos)
const ms = t => (t && t.toMillis ? t.toMillis() : 0);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
async function emLotes(itens, n, fn) { for (let i = 0; i < itens.length; i += n) await Promise.all(itens.slice(i, i + n).map(fn)); }
const num = (v, d, min, max) => { const x = Number(v); return Number.isFinite(x) && x >= min && x <= max ? x : d; };

export function fatoresDe(mu) {
  const i = (mu && mu.impacto) || {}, nv = i.niveis || {};
  return { custo_pagina: num(i.custo_pagina, PADRAO.custo_pagina, 0.01, 5), paginas_toner: num(i.paginas_toner, PADRAO.paginas_toner, 100, 100000),
    co2_g_folha: num(i.co2_g_folha, PADRAO.co2_g_folha, 0, 100),
    niveis: { bronze: num(nv.bronze, PADRAO.niveis.bronze, 0, 1e4), prata: num(nv.prata, PADRAO.niveis.prata, 0, 1e4), ouro: num(nv.ouro, PADRAO.niveis.ouro, 0, 1e4) },
    personalizado: !!(mu && mu.impacto) };
}
export function nivelDe(porAluno, nv) {
  const lista = [['ouro', nv.ouro], ['prata', nv.prata], ['bronze', nv.bronze]];
  const atual = lista.find(([, v]) => porAluno >= v), prox = [...lista].reverse().find(([, v]) => porAluno < v);
  return { nivel: atual ? atual[0] : null, proximo: prox ? prox[0] : null, falta_por_aluno: prox ? Math.max(0, prox[1] - porAluno) : 0 };
}
export const folhasProva = nq => Math.max(1, Math.ceil((Number(nq) || 0) / 10));

export async function calcularImpacto(db, m, ano) {
  const ini = Date.UTC(ano, 0, 1, 4), fim = Date.UTC(ano + 1, 0, 1, 4), tsIni = Timestamp.fromMillis(ini);
  const dentro = t => t >= ini && t < fim;
  const [mus, es, als] = await Promise.all([db.doc(`municipios/${m}`).get(), db.collection('escolas').where('municipio_id', '==', m).select('nome', 'status').get(),
    db.collection('alunos').where('municipio_id', '==', m).select('escola_id', 'turma_id', 'status').get()]);
  const mu = mus.data() || {}, esc = {};
  es.forEach(d => { esc[d.id] = { id: d.id, nome: String(d.data().nome || 'Escola').slice(0, 120), alunos: 0, folhas: Object.fromEntries(FONTES.map(f => [f, 0])) }; });
  const daEscola = id => esc[id] || (esc[id || 'sem'] = esc[id || 'sem'] || { id: id || 'sem', nome: 'Sem escola', alunos: 0, folhas: Object.fromEntries(FONTES.map(f => [f, 0])) });
  const porTurma = {};
  als.forEach(d => { const a = d.data(); if (a.status === 'inativo') return; daEscola(a.escola_id).alunos++; if (a.turma_id) porTurma[a.turma_id] = (porTurma[a.turma_id] || 0) + 1; });
  const soma = (eid, f, n) => { if (n > 0) daEscola(eid).folhas[f] += n; };
  const qtd = Object.fromEntries(FONTES.map(f => [f, 0]));   // quantos registros (para mostrar "N provas", "N envios")

  // provas online: entregas x folhas da prova
  const po = await db.collection('provas_online').where('municipio_id', '==', m).select('escola_id', 'criado_em', 'questoes').get();
  await emLotes(po.docs.filter(d => dentro(ms(d.data().criado_em))), 20, async d => {
    const x = d.data(), c = await d.ref.collection('po_resultados').count().get().catch(() => null), n = c ? c.data().count : 0;
    if (n) { qtd.provas++; soma(x.escola_id, 'provas', n * folhasProva((x.questoes || []).length)); }
  });
  // materiais enviados à turma (um envio por turma; link não conta)
  const ts = await db.collection('turmas').where('municipio_id', '==', m).select('escola_id').get();
  await emLotes(ts.docs, 25, async t => {
    const al = porTurma[t.id] || 0; if (!al) return;
    const it = await db.collection(`turma_materiais/${t.id}/itens`).where('criado_em', '>=', tsIni).select('tipo_item', 'origem', 'criado_em').get().catch(() => ({ docs: [] }));
    it.docs.forEach(d => { const x = d.data(); if (x.tipo_item === 'link' || !dentro(ms(x.criado_em))) return; qtd.materiais++; soma(t.data().escola_id, 'materiais', al); });
  });
  // avisos e comunicados às famílias enviados por e-mail
  const av = await db.collection('avisos_familia').where('municipio_id', '==', m).where('status', '==', 'enviado').select('escola_id', 'em').get().catch(() => ({ docs: [] }));
  av.docs.forEach(d => { const x = d.data(); if (!dentro(ms(x.em))) return; qtd.familias++; soma(x.escola_id, 'familias', 1); });
  // chamada digital: 1 folha a cada 20 chamadas, por escola
  const fc = await db.collection('freq_chamadas').where('municipio_id', '==', m).where('ano', '==', ano).select('escola_id').get().catch(() => ({ docs: [] }));
  const chEsc = {}; fc.docs.forEach(d => { const e = d.data().escola_id || 'sem'; chEsc[e] = (chEsc[e] || 0) + 1; qtd.chamada++; });
  Object.entries(chEsc).forEach(([e, n]) => soma(e, 'chamada', Math.ceil(n / 20)));

  const escolas = Object.values(esc).filter(e => e.id !== 'sem' || FONTES.some(f => e.folhas[f])).map(e => {
    const total = FONTES.reduce((s, f) => s + e.folhas[f], 0); return { ...e, total, por_aluno: e.alunos ? total / e.alunos : null };
  });
  return { municipio: { id: m, nome: mu.nome || '', uf: mu.uf || '', logo_url: mu.logo_url || '' }, ano, fatores: fatoresDe(mu), qtd, escolas, calculado_em: Date.now() };
}

// resumo (rede inteira ou só as escolas do gestor): totais, conversões e nível do selo
export function resumir(d, ids) {
  const set = ids ? new Set(ids) : null, escolas = d.escolas.filter(e => !set || set.has(e.id)), f = d.fatores;
  const folhas = Object.fromEntries(FONTES.map(k => [k, escolas.reduce((s, e) => s + e.folhas[k], 0)]));
  const total = FONTES.reduce((s, k) => s + folhas[k], 0), alunos = escolas.reduce((s, e) => s + e.alunos, 0), porAluno = alunos ? total / alunos : 0;
  return { ...d, escopo: set ? 'escola' : 'rede', escolas: escolas.sort((a, b) => (b.por_aluno || 0) - (a.por_aluno || 0)), folhas, total, alunos, por_aluno: porAluno,
    resmas: total / 500, economia: total * f.custo_pagina, toner: total / f.paginas_toner, co2_kg: total * f.co2_g_folha / 1000, selo: nivelDe(porAluno, f.niveis) };
}

export const impactoVerde = onCall({ region: 'southamerica-east1', timeoutSeconds: 300, memory: '1GiB', maxInstances: 4 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), u = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Acesso não liberado.');
  let m, escolas = null;
  if (u.perfil === 'admin') {
    m = String((req.data && req.data.municipio_id) || u.municipio_id || '');
    if (req.data && Array.isArray(req.data.escolas) && req.data.escolas.length) escolas = req.data.escolas.map(String).filter(x => ID.test(x)).slice(0, 5);
  } else if (u.perfil === 'secretaria') m = String(u.municipio_id || '');
  else if (u.perfil === 'gestor') {
    m = String(u.municipio_id || ''); escolas = (Array.isArray(u.escolas_ids) && u.escolas_ids.length ? u.escolas_ids : [u.escola_id]).filter(Boolean).slice(0, 5);
    if (!escolas.length) throw new HttpsError('failed-precondition', 'Seu cadastro de gestor ainda não está ligado a uma escola.');
  } else throw new HttpsError('permission-denied', 'O painel é da Secretaria de Educação e dos gestores das escolas.');
  if (!ID.test(m)) throw new HttpsError('failed-precondition', 'Seu cadastro não está ligado a um município.');
  if (u.perfil !== 'admin') {
    const mu = (await db.doc(`municipios/${m}`).get()).data() || {};
    if (!Array.isArray(mu.modulos_secretaria) || !mu.modulos_secretaria.includes('painel')) throw new HttpsError('permission-denied', 'O painel ainda não faz parte do plano do seu município.');
  }
  const ano = num(req.data && req.data.ano, new Date(Date.now() - 4 * 3600e3).getUTCFullYear(), 2024, 2100), chave = m + '_' + ano, c = cache.get(chave);
  let d;
  if (c && Date.now() - c.em < 30 * 60 * 1000 && !(req.data && req.data.forcar)) d = c.dados;
  else { d = await calcularImpacto(db, m, ano); cache.set(chave, { em: Date.now(), dados: d }); }
  return resumir(d, escolas);
});

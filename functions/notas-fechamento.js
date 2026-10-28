// Fechamento do bimestre e histórico de alterações das notas.
// - fecharPeriodo: a escola fecha um período; a função calcula a média do período de cada aluno em cada disciplina
//   (planilha do professor ou notas digitadas pela escola, bimestre a bimestre) e grava uma cópia que só a função escreve
//   (notas_fechadas). O boletim usa essa cópia nos períodos fechados: mudar a planilha depois não muda o documento oficial.
// - reabrirPeriodo: só a Direção, com motivo (fica no registro do fechamento).
// - historicoNotas: a cada gravação de notas, registra o que mudou (de, para, quem, quando), marcando o que mudou depois do fechamento.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REGIAO = 'southamerica-east1';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const PADRAO = { periodos: 4, pesos: [1, 1, 1, 1], media_minima: 6, nota_max: 10, arredondamento: 'decimo', composicao: 'media', rec_periodo: 'maior',
  rec_final: true, peso_media: 1, peso_exame: 1, media_final_minima: 5, freq_minima: 75 };
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function arred(v, r) {
  if (v === null) return null;
  if (r === 'inteiro') return Math.round(v + 1e-9);
  if (r === 'meio_cima') return Math.ceil(v * 2 - 1e-9) / 2;
  return Math.round(v * 10 + 1e-9) / 10;
}
// média do período de um aluno numa planilha do professor (mesma conta da tela Notas e Médias)
export function mediaPlanilha(P, R, aid, p) {
  const N = (P.notas || {})[aid] || {}, mx = R.nota_max, av = Array.isArray(P.avaliacoes) ? P.avaliacoes : [];
  const cols = av.filter(a => a.periodo === p && a.tipo === 'nota'), rec = av.find(a => a.periodo === p && a.tipo === 'rec');
  const lanc = cols.filter(a => N[a.id] !== undefined && N[a.id] !== null);
  let m = null;
  if (lanc.length) {
    if (R.composicao === 'soma') m = Math.min(mx, lanc.reduce((t, a) => t + N[a.id], 0));
    else { const w = lanc.reduce((t, a) => t + (a.peso || 1), 0); m = lanc.reduce((t, a) => t + N[a.id] / (a.max || mx) * mx * (a.peso || 1), 0) / w; }
  }
  const r = rec && R.rec_periodo !== 'nao' ? N[rec.id] : null;
  if (r !== null && r !== undefined) { if (m === null) m = r; else if (R.rec_periodo === 'maior') m = Math.max(m, r); else m = Math.max(m, (m + r) / 2); }
  return arred(m, R.arredondamento);
}
// o professor "tem" o período quando há ao menos uma nota lançada nele (aí a planilha dele vale para a turma inteira naquele período)
export function profTemPeriodo(P, p) {
  const ids = new Set((P.avaliacoes || []).filter(a => a.periodo === p).map(a => a.id));
  return Object.values(P.notas || {}).some(n => Object.entries(n || {}).some(([k, v]) => ids.has(k) && v !== null && v !== undefined));
}
// uma disciplina num período: professor quando ele lançou, senão o que a escola digitou
export function periodoDisciplina(P, Esc, R, alunos, p) {
  const out = { fonte: '', aulas: null, alunos: {} };
  if (P && profTemPeriodo(P, p)) {
    out.fonte = 'professor'; out.professor_nome = P.professor_nome || ''; out.aulas = +(P.aulas || {})[p] || null;
    alunos.forEach(aid => { const m = mediaPlanilha(P, R, aid, p), f = +(((P.faltas || {})[aid] || {})[p]) || 0; if (m !== null || f) out.alunos[aid] = { m, f }; });
  } else if (Esc) {
    out.fonte = 'escola'; out.aulas = +(Esc.aulas || {})[p] || null;
    alunos.forEach(aid => { const v = ((Esc.notas || {})[aid] || {})[p], f = +(((Esc.faltas || {})[aid] || {})[p]) || 0;
      const m = v === null || v === undefined ? null : arred(+v, R.arredondamento); if (m !== null || f) out.alunos[aid] = { m, f }; });
  }
  if (!Object.keys(out.alunos).length && !out.aulas) out.fonte = '';
  return out;
}

async function quem(db, uid) { const u = (await db.doc(`usuarios/${uid}`).get()).data(); if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Acesso não liberado.'); return u; }
const escolasDe = u => [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))];
function checar(d) {
  const escola = String(d.escola_id || ''), ano = +d.ano, periodo = +d.periodo;
  if (!ID.test(escola) || !(ano >= 2020 && ano <= 2100) || !(periodo >= 1 && periodo <= 4)) throw new HttpsError('invalid-argument', 'Dados do fechamento inválidos.');
  return { escola, ano, periodo };
}

export const fecharPeriodo = onCall({ region: REGIAO, timeoutSeconds: 120, memory: '512MiB', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), u = await quem(db, req.auth.uid), { escola, ano, periodo } = checar(req.data || {});
  if (u.perfil !== 'admin' && !(['gestor', 'secretaria_escolar'].includes(u.perfil) && escolasDe(u).includes(escola))) throw new HttpsError('permission-denied', 'O fechamento é feito pela Direção ou pela Secretaria da escola.');
  const e = (await db.doc(`escolas/${escola}`).get()).data(); if (!e) throw new HttpsError('not-found', 'Escola não encontrada.');
  const m = e.municipio_id || '', R = { ...PADRAO, ...((await db.doc(`notas_regras/${m}`).get()).data() || {}) };
  if (periodo > R.periodos) throw new HttpsError('invalid-argument', 'Período fora da regra da rede.');
  const [ts, pls, nes] = await Promise.all([
    db.collection('turmas').where('escola_id', '==', escola).get(),
    db.collection('notas_planilhas').where('escola_id', '==', escola).get(),
    db.collection('notas_escola').where('escola_id', '==', escola).get()
  ]);
  const turmas = ts.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'inativa');
  const porTurma = {};
  const recente = (a, b) => { const tm = v => v && v.toMillis ? v.toMillis() : 0; return !a || tm(b.atualizado_em) > tm(a.atualizado_em) ? b : a; };
  pls.docs.forEach(d => { const p = d.data(); if (+p.ano_letivo !== ano) return; const k = slug(p.disciplina), T = (porTurma[p.turma_id] = porTurma[p.turma_id] || {}); (T[k] = T[k] || { nome: p.disciplina }).P = recente(T[k].P, p); });
  nes.docs.forEach(d => { const x = d.data(); if (+x.ano_letivo !== ano) return; const T = (porTurma[x.turma_id] = porTurma[x.turma_id] || {}); (T[x.disc_id] = T[x.disc_id] || { nome: x.disciplina }).Esc = x; });
  const fechado_por_nome = String(u.nome || '').slice(0, 80);
  let n = 0;
  for (const t of turmas) {
    const als = (await db.collection('alunos').where('escola_id', '==', escola).where('turma_id', '==', t.id).get()).docs.filter(d => d.data().status !== 'inativo').map(d => d.id);
    const disciplinas = {};
    Object.entries(porTurma[t.id] || {}).forEach(([k, x]) => { const r = periodoDisciplina(x.P, x.Esc, R, als, periodo); if (r.fonte) disciplinas[k] = { nome: x.nome, ...r }; });
    await db.doc(`notas_fechadas/${escola}_${t.id}_${ano}_${periodo}`).set({ escola_id: escola, municipio_id: m, turma_id: t.id, turma_nome: t.nome || '', ano, periodo,
      disciplinas, fechado_em: FieldValue.serverTimestamp(), fechado_por: req.auth.uid, fechado_por_nome });
    n++;
  }
  await db.doc(`fechamentos/${escola}_${ano}`).set({ escola_id: escola, municipio_id: m, ano,
    periodos: { [periodo]: { fechado: true, em: Date.now(), por: req.auth.uid, por_nome: fechado_por_nome } },
    registro: FieldValue.arrayUnion({ acao: 'fechou', periodo, em: Date.now(), por_nome: fechado_por_nome }) }, { merge: true });
  return { ok: true, turmas: n };
});

export const reabrirPeriodo = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), u = await quem(db, req.auth.uid), { escola, ano, periodo } = checar(req.data || {});
  const motivo = String((req.data || {}).motivo || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (u.perfil !== 'admin' && !(u.perfil === 'gestor' && escolasDe(u).includes(escola))) throw new HttpsError('permission-denied', 'Só a Direção da escola reabre um período fechado.');
  if (motivo.length < 5) throw new HttpsError('invalid-argument', 'Escreva o motivo da reabertura.');
  const por_nome = String(u.nome || '').slice(0, 80);
  await db.doc(`fechamentos/${escola}_${ano}`).set({ periodos: { [periodo]: { fechado: false, em: Date.now(), por: req.auth.uid, por_nome, motivo } },
    registro: FieldValue.arrayUnion({ acao: 'reabriu', periodo, em: Date.now(), por_nome, motivo }) }, { merge: true });
  return { ok: true };
});

// ---------- histórico de alterações ----------
const num = v => v === null || v === undefined || v === '' ? null : +v;
async function periodosFechados(db, escola, ano) {
  if (!escola || !ano) return {};
  const f = (await db.doc(`fechamentos/${escola}_${ano}`).get()).data();
  return (f && f.periodos) || {};
}
async function registrar(db, base, mud) {
  if (!mud.length) return;
  await db.collection('notas_historico').add({ ...base, mudancas: mud.slice(0, 300), total: mud.length, em: FieldValue.serverTimestamp() });
}
export const historicoPlanilha = onDocumentWritten({ document: 'notas_planilhas/{id}', region: REGIAO, maxInstances: 10 }, async ev => {
  const a = ev.data.before && ev.data.before.exists ? ev.data.before.data() : null, d = ev.data.after && ev.data.after.exists ? ev.data.after.data() : null, x = d || a;
  if (!x || !x.escola_id) return;
  const db = getFirestore(), ano = +x.ano_letivo, fech = await periodosFechados(db, x.escola_id, ano), av = {};
  [...((a && a.avaliacoes) || []), ...((d && d.avaliacoes) || [])].forEach(c => { av[c.id] = c; });
  const mud = [], N0 = (a && a.notas) || {}, N1 = (d && d.notas) || {};
  new Set([...Object.keys(N0), ...Object.keys(N1)]).forEach(aid => {
    const A = N0[aid] || {}, B = N1[aid] || {};
    new Set([...Object.keys(A), ...Object.keys(B)]).forEach(k => { const de = num(A[k]), para = num(B[k]); if (de === para) return;
      const c = av[k] || {}, p = c.periodo || null; mud.push({ aluno_id: aid, periodo: p, campo: (c.tipo === 'rec' ? 'Recuperação' : c.nome || 'Nota'), de, para, apos_fechamento: !!(p && fech[p] && fech[p].fechado) }); });
  });
  const E0 = (a && a.exame) || {}, E1 = (d && d.exame) || {};
  new Set([...Object.keys(E0), ...Object.keys(E1)]).forEach(aid => { const de = num(E0[aid]), para = num(E1[aid]); if (de !== para) mud.push({ aluno_id: aid, periodo: null, campo: 'Exame final', de, para, apos_fechamento: false }); });
  await registrar(db, { escola_id: x.escola_id, municipio_id: x.municipio_id || '', turma_id: x.turma_id, turma_nome: x.turma_nome || '', disciplina: x.disciplina || '', ano,
    origem: 'professor', por_uid: x.professor_uid || '', por_nome: x.professor_nome || '', excluida: !d }, mud);
});
export const historicoEscola = onDocumentWritten({ document: 'notas_escola/{id}', region: REGIAO, maxInstances: 10 }, async ev => {
  const a = ev.data.before && ev.data.before.exists ? ev.data.before.data() : null, d = ev.data.after && ev.data.after.exists ? ev.data.after.data() : null, x = d || a;
  if (!x || !x.escola_id) return;
  const db = getFirestore(), ano = +x.ano_letivo, fech = await periodosFechados(db, x.escola_id, ano), mud = [];
  for (const [campo, rot] of [['notas', 'Nota'], ['faltas', 'Faltas']]) {
    const N0 = (a && a[campo]) || {}, N1 = (d && d[campo]) || {};
    new Set([...Object.keys(N0), ...Object.keys(N1)]).forEach(aid => { const A = N0[aid] || {}, B = N1[aid] || {};
      new Set([...Object.keys(A), ...Object.keys(B)]).forEach(p => { const de = num(A[p]), para = num(B[p]); if (de !== para) mud.push({ aluno_id: aid, periodo: +p, campo: rot, de, para, apos_fechamento: !!(fech[p] && fech[p].fechado) }); }); });
  }
  const E0 = (a && a.exame) || {}, E1 = (d && d.exame) || {};
  new Set([...Object.keys(E0), ...Object.keys(E1)]).forEach(aid => { const de = num(E0[aid]), para = num(E1[aid]); if (de !== para) mud.push({ aluno_id: aid, periodo: null, campo: 'Exame final', de, para, apos_fechamento: false }); });
  await registrar(db, { escola_id: x.escola_id, municipio_id: x.municipio_id || '', turma_id: x.turma_id, turma_nome: x.turma_nome || '', disciplina: x.disciplina || '', ano,
    origem: 'escola', por_uid: (d || a).atualizado_por || '', por_nome: (d || a).atualizado_por_nome || '', excluida: !d }, mud);
});

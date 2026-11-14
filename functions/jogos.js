// Jogos do Portal (Motor de Jogos, nov/2026): guarda o resultado de cada rodada POR HABILIDADE da BNCC, para o professor
// ver quem precisa de reforço. Sem nome: só o código do aluno (ou do professor que jogou na lousa com a turma), a turma e a escola.
// Uma rodada = um documento em jogo_resultados. Limite de 80 rodadas por pessoa por dia (proteção contra abuso).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const t = (v, n) => String(v ?? '').replace(/[^\w\-.: ]/g, '').trim().slice(0, n);
const n0 = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

export const jogoResultado = onCall({ region: 'southamerica-east1', memory: '256MiB', maxInstances: 10, timeoutSeconds: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const jogo = t(d.jogo, 40).toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(jogo)) throw new HttpsError('invalid-argument', 'Jogo inválido.');
  const u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Cadastro inativo.');
  const habs = (Array.isArray(d.habs) ? d.habs : []).slice(0, 12).map(h => ({ h: t(h && h.h, 12).toUpperCase(), c: n0(h && h.c, 60), t: n0(h && h.t, 60) })).filter(h => h.h && h.t > 0 && h.c <= h.t);
  const total = n0(d.total, 60), acertos = Math.min(total, n0(d.acertos, 60));
  if (!total || !habs.length) return { ok: false };
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10), lim = db.doc(`jogo_limite/${uid}_${dia}`);
  const n = await db.runTransaction(async tx => { const x = await tx.get(lim), v = (x.exists ? x.data().n || 0 : 0) + 1; if (v > 80) return -1; tx.set(lim, { uid, dia, n: v }, { merge: true }); return v; });
  if (n < 0) return { ok: false };
  const aluno = u.perfil === 'aluno';
  // na lousa (modo Turma), o professor diz qual turma está na sala: vale só turma de uma escola dele
  let turmaLousa = '', escolaLousa = '';
  if (!aluno && d.modo === 'turma' && /^[A-Za-z0-9_-]{6,64}$/.test(String(d.turma_id || ''))) {
    const tr = (await db.doc(`turmas/${d.turma_id}`).get()).data(), minhas = [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))];
    if (tr && (u.perfil === 'admin' || minhas.includes(tr.escola_id))) { turmaLousa = String(d.turma_id); escolaLousa = String(tr.escola_id || ''); }
  }
  await db.collection('jogo_resultados').add({
    jogo, dia, em: FieldValue.serverTimestamp(), modo: ['solo', 'dupla', 'turma'].includes(d.modo) ? d.modo : 'solo',
    perfil: aluno ? 'aluno' : 'equipe', uid, aluno_id: aluno ? String((req.auth.token && req.auth.token.aluno_id) || u.aluno_id || '') : '',
    turma_id: aluno ? String(u.turma_id || '') : turmaLousa, escola_id: escolaLousa || String(u.escola_id || ''), municipio_id: String(u.municipio_id || ''),
    nivel: n0(d.nivel, 20), niveis: n0(d.niveis, 20), duracao_s: n0(d.duracao, 7200), acertos, total, habs
  });
  return { ok: true };
});

// Painel do professor (nov/2026): o que a turma treinou nos jogos, por habilidade e por aluno, no período pedido.
// Devolve só códigos (aluno_id) e números; os nomes o próprio painel busca no cadastro da turma, que o professor já pode ler.
// Quem vê: o professor ou o gestor de uma escola da turma, e o administrador (a mesma regra da chamada e dos pareceres).
const ID = /^[A-Za-z0-9_-]{6,64}$/;
const escolasDe = u => [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))];
export const jogoPainel = onCall({ region: 'southamerica-east1', memory: '512MiB', maxInstances: 5, timeoutSeconds: 60 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo' || !['professor', 'gestor', 'admin'].includes(u.perfil)) throw new HttpsError('permission-denied', 'Acesso não liberado.');
  if (!ID.test(String(d.turma_id || ''))) throw new HttpsError('invalid-argument', 'Turma inválida.');
  const tr = (await db.doc(`turmas/${d.turma_id}`).get()).data();
  if (!tr) throw new HttpsError('not-found', 'Turma não encontrada.');
  const pode = u.perfil === 'admin' || (escolasDe(u).includes(tr.escola_id) && (!u.municipio_id || !tr.municipio_id || u.municipio_id === tr.municipio_id));
  if (!pode) throw new HttpsError('permission-denied', 'Esta turma não é de uma escola sua.');
  const dias = [7, 30, 90, 365].includes(+d.dias) ? +d.dias : 30, de = new Date(Date.now() - 4 * 3600e3 - dias * 864e5).toISOString().slice(0, 10);
  const soma = (o, h) => { const x = o[h.h] || (o[h.h] = { c: 0, t: 0 }); x.c += h.c || 0; x.t += h.t || 0; };
  const junta = (alvo, r) => { alvo.n++; alvo.c += r.acertos || 0; alvo.t += r.total || 0; if (!alvo.ultimo || r.dia > alvo.ultimo) alvo.ultimo = r.dia;
    alvo.jogos[r.jogo] = (alvo.jogos[r.jogo] || 0) + 1; (Array.isArray(r.habs) ? r.habs : []).forEach(h => { if (h && h.h) soma(alvo.habs, h); }); };
  const novo = () => ({ n: 0, c: 0, t: 0, ultimo: '', jogos: {}, habs: {} });
  // rodadas dos alunos da turma (filtra o período na memória: evita índice composto) e as que o próprio professor fez na lousa
  const [sa, sl] = await Promise.all([
    db.collection('jogo_resultados').where('turma_id', '==', String(d.turma_id)).limit(5000).get(),
    db.collection('jogo_resultados').where('uid', '==', uid).limit(1500).get()
  ]);
  const alunos = {}, lousa = novo(), lousaTurma = novo();
  sa.forEach(x => { const r = x.data(); if (r.dia < de) return;
    if (r.perfil === 'equipe') return junta(lousaTurma, r);                     // rodadas na lousa em que o professor marcou esta turma
    if (r.perfil !== 'aluno' || !r.aluno_id) return; junta(alunos[r.aluno_id] || (alunos[r.aluno_id] = novo()), r); });
  sl.forEach(x => { const r = x.data(); if (r.dia < de || r.perfil !== 'equipe' || r.turma_id) return; junta(lousa, r); });   // as suas, sem turma marcada
  return { ok: true, dias, de, turma: { id: String(d.turma_id), nome: t(tr.nome, 80) }, alunos, lousa, lousaTurma };
});

// Visão da rede (nov/2026): o mesmo painel, somado por ESCOLA, para a Secretaria de Educação. Só totais e percentuais, sem
// nome nem código de aluno. Quem vê: perfil "secretaria" (o próprio município, com o módulo Painel no plano), o gestor
// (só as escolas dele) e o administrador (qualquer município). Mesma regra do Painel da Rede (painelSecretaria).
const cacheRede = new Map(); // município|dias|escolas -> { em, dados } (10 minutos)
export const jogoPainelRede = onCall({ region: 'southamerica-east1', memory: '1GiB', maxInstances: 5, timeoutSeconds: 120 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), d = req.data || {};
  const u = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Acesso não liberado.');
  let m = '', soEscolas = null;
  if (u.perfil === 'admin') m = String(d.municipio_id || u.municipio_id || '');
  else if (u.perfil === 'secretaria') m = String(u.municipio_id || '');
  else if (u.perfil === 'gestor') { m = String(u.municipio_id || ''); soEscolas = escolasDe(u).slice(0, 10); if (!soEscolas.length) throw new HttpsError('failed-precondition', 'Seu cadastro de gestor ainda não está ligado a uma escola.'); }
  else throw new HttpsError('permission-denied', 'A visão da rede é da Secretaria de Educação e dos gestores das escolas.');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(m)) throw new HttpsError('failed-precondition', 'Seu cadastro não está ligado a uma rede de ensino.');
  const mu = (await db.doc(`municipios/${m}`).get()).data() || {};
  if (u.perfil === 'secretaria' && !(Array.isArray(mu.modulos_secretaria) && mu.modulos_secretaria.includes('painel'))) throw new HttpsError('permission-denied', 'O painel ainda não faz parte do plano da sua rede. Fale com a equipe NEWPC.');
  const dias = [7, 30, 90, 365].includes(+d.dias) ? +d.dias : 30, de = new Date(Date.now() - 4 * 3600e3 - dias * 864e5).toISOString().slice(0, 10);
  const chave = [m, dias, (soEscolas || []).join(',')].join('|'), guardado = cacheRede.get(chave);
  if (guardado && Date.now() - guardado.em < 600e3) return guardado.dados;
  const TETO = 20000;
  const [se, sr] = await Promise.all([
    db.collection('escolas').where('municipio_id', '==', m).limit(400).get(),
    db.collection('jogo_resultados').where('municipio_id', '==', m).where('dia', '>=', de).limit(TETO).get()
  ]);
  const escolas = {};
  se.forEach(x => { const e = x.data(); if (e.status === 'inativa' || (soEscolas && !soEscolas.includes(x.id))) return;
    escolas[x.id] = { nome: String(e.nome || 'Escola').slice(0, 90), n: 0, lousa: 0, c: 0, t: 0, alunos: new Set(), turmas: new Set(), ultimo: '', habs: {}, matriculados: null }; });
  const rede = { n: 0, lousa: 0, c: 0, t: 0, habs: {}, jogos: {}, porDia: {} };
  sr.forEach(x => { const r = x.data(), E = escolas[r.escola_id]; if (!E) return;
    const aluno = r.perfil === 'aluno';
    if (aluno) { E.n++; rede.n++; E.c += r.acertos || 0; E.t += r.total || 0; rede.c += r.acertos || 0; rede.t += r.total || 0; if (r.aluno_id) E.alunos.add(r.aluno_id); if (r.turma_id) E.turmas.add(r.turma_id); }
    else { E.lousa++; rede.lousa++; }
    if (!E.ultimo || r.dia > E.ultimo) E.ultimo = r.dia;
    rede.jogos[r.jogo] = (rede.jogos[r.jogo] || 0) + 1; rede.porDia[r.dia] = (rede.porDia[r.dia] || 0) + 1;
    (Array.isArray(r.habs) ? r.habs : []).forEach(h => { if (!h || !h.h) return;
      const a = rede.habs[h.h] || (rede.habs[h.h] = { c: 0, t: 0, escolas: new Set() }); a.c += h.c || 0; a.t += h.t || 0; a.escolas.add(r.escola_id);
      if (aluno) { const b = E.habs[h.h] || (E.habs[h.h] = { c: 0, t: 0 }); b.c += h.c || 0; b.t += h.t || 0; } }); });
  // alunos cadastrados por escola (contagem no servidor, sem ler os cadastros), para mostrar quantos da escola já jogaram
  const ids = Object.keys(escolas);
  for (let i = 0; i < ids.length; i += 20) await Promise.all(ids.slice(i, i + 20).map(async id => {
    try { escolas[id].matriculados = (await db.collection('alunos').where('escola_id', '==', id).count().get()).data().count; } catch (e) { /* sem contagem: a coluna fica em branco */ } }));
  const dados = { ok: true, dias, de, municipio: { id: m, nome: String(mu.nome || '').slice(0, 80), uf: String(mu.uf || '').slice(0, 2), logo_url: /^https:\/\//.test(String(mu.logo_url || '')) ? String(mu.logo_url).slice(0, 600) : '', tipo_rede: mu.tipo_rede === 'estadual' ? 'estadual' : 'municipal', demo: mu.demo === true }, cortado: sr.size >= TETO,
    escolas: ids.map(id => { const E = escolas[id]; return { id, nome: E.nome, n: E.n, lousa: E.lousa, c: E.c, t: E.t, alunos: E.alunos.size, turmas: E.turmas.size, matriculados: E.matriculados, ultimo: E.ultimo,
      fracas: Object.entries(E.habs).filter(([, v]) => v.t >= 20 && v.c / v.t < .6).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t).slice(0, 3).map(([h, v]) => ({ h, p: Math.round(v.c / v.t * 100) })) }; }),
    rede: { n: rede.n, lousa: rede.lousa, c: rede.c, t: rede.t, jogos: rede.jogos, porDia: rede.porDia, habs: Object.fromEntries(Object.entries(rede.habs).map(([h, v]) => [h, { c: v.c, t: v.t, escolas: v.escolas.size }])) } };
  cacheRede.set(chave, { em: Date.now(), dados });
  return dados;
});

// Turmas do professor, para ele dizer no jogo (modo Turma, na lousa) qual turma está na sala. Só id e nome; aluno não recebe nada.
export const jogoTurmas = onCall({ region: 'southamerica-east1', memory: '256MiB', maxInstances: 5, timeoutSeconds: 20 }, async req => {
  if (!req.auth) return { turmas: [] };
  const db = getFirestore(), uid = req.auth.uid, u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo' || !['professor', 'gestor'].includes(u.perfil)) return { turmas: [] };
  const ids = escolasDe(u).slice(0, 10); if (!ids.length) return { turmas: [] };
  const s = await db.collection('turmas').where('escola_id', 'in', ids).limit(300).get(), minhas = new Set((Array.isArray(u.turmas_ids) ? u.turmas_ids : []).map(String));
  const l = []; s.forEach(x => { const r = x.data(); if (r.status === 'inativa') return;
    l.push({ id: x.id, nome: String(r.nome || 'Turma').slice(0, 60), minha: minhas.has(x.id) || r.criado_por === uid || (Array.isArray(r.grade) && r.grade.some(g => g && g.professor_uid === uid)) }); });
  l.sort((a, b) => (b.minha - a.minha) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  return { turmas: l.slice(0, 120) };
});

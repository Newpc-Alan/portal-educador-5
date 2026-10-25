// Painel da Rede (Secretaria Municipal de Educação): junta, para UM município, os números de uso do Portal,
// aprendizagem (provas corrigidas e habilidades BNCC), calendário letivo e infraestrutura (chamados, equipamentos, TVs).
// Só devolve totais e percentuais (nada de nomes de alunos): a secretaria vê a rede sem abrir dados pessoais.
// Quem chama: perfil "secretaria" ativo (o próprio município) ou administrador (qualquer município).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import CAL from './calendario-nucleo.js';
import * as FREQ from './frequencia-nucleo.js';

const DIA = 864e5;
const cache = new Map(); // município -> { em, dados } (20 minutos)
const msDe = v => v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : 0);
const isoMS = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const pedacos = (l, n) => { const o = []; for (let i = 0; i < l.length; i += n) o.push(l.slice(i, i + n)); return o; };
const RX_BNCC = /^(EF\d{2}[A-Z]{2}\d{2}|EI\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,3}\d{3})$/;
const codigos = s => [...new Set(String(s || '').toUpperCase().split(/[^A-Z0-9]+/).filter(c => RX_BNCC.test(c)))];

export const painelSecretaria = onCall({ region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore();
  const u = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Acesso não liberado.');
  let m, escolasGestor = null;
  if (u.perfil === 'admin') {
    m = String((req.data && req.data.municipio_id) || u.municipio_id || '');
    // administrador testando como gestor ("Entrar como"): mesma visão de escola
    if (req.data && Array.isArray(req.data.escolas) && req.data.escolas.length) escolasGestor = req.data.escolas.map(String).filter(x => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 5);
  }
  else if (u.perfil === 'secretaria') m = String(u.municipio_id || '');
  else if (u.perfil === 'gestor') {
    m = String(u.municipio_id || '');
    escolasGestor = (Array.isArray(u.escolas_ids) && u.escolas_ids.length ? u.escolas_ids : [u.escola_id]).filter(Boolean).slice(0, 5);
    if (!escolasGestor.length) throw new HttpsError('failed-precondition', 'Seu cadastro de gestor ainda não está ligado a uma escola.');
  }
  else throw new HttpsError('permission-denied', 'O painel é da Secretaria de Educação e dos gestores das escolas.');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(m)) throw new HttpsError('failed-precondition', 'Seu cadastro não está ligado a um município.');
  // o painel é um módulo do plano: o administrador libera em Municípios › Plano e módulos
  if (u.perfil !== 'admin') {
    const mu = (await db.doc(`municipios/${m}`).get()).data() || {};
    if (!Array.isArray(mu.modulos_secretaria) || !mu.modulos_secretaria.includes('painel')) throw new HttpsError('permission-denied', 'O painel ainda não faz parte do plano do seu município. Fale com a equipe NEWPC.');
  }
  const c = cache.get(m);
  let dados;
  if (c && Date.now() - c.em < 20 * 60 * 1000 && !(req.data && req.data.forcar)) dados = c.dados;
  else { dados = await montar(db, m); cache.set(m, { em: Date.now(), dados }); }
  return escolasGestor ? daEscola(dados, escolasGestor) : dados;
});

// visão do gestor: só as escolas dele, com a média da rede ao lado para comparar (só números agregados)
export function daEscola(d, ids) {
  const set = new Set(ids), escolas = d.escolas.filter(e => set.has(e.id)), soma = k => escolas.reduce((s, e) => s + (e[k] || 0), 0);
  const qtot = soma('qtot'), acerto = qtot ? escolas.reduce((s, e) => s + (e.acerto || 0) * (e.qtot || 0), 0) / qtot : null;
  const habilidades = d.aprendizagem.habilidades.map(h => {
    const vs = ids.map(id => h.escolas[id]).filter(v => v !== undefined && v !== null);
    return vs.length ? { c: h.c, q: h.q, p: vs.reduce((s, v) => s + v, 0) / vs.length, rede: h.p, escolas: {} } : null;
  }).filter(Boolean).sort((a, b) => a.p - b.p);
  const abaixo = escolas.filter(e => e.dias !== null && (e.dias < e.metaDias || e.horas < e.metaHoras)).length;
  return {
    ...d, escopo: 'escola', escolasNomes: escolas.map(e => e.nome),
    totais: { escolas: escolas.length, alunos: soma('alunos') },
    uso: { professores: soma('professores'), gestores: 0, ativos30: soma('ativos30'), ativos7: null, onlineAgora: null, porDia: [], modulos: [] },
    aprendizagem: { provas: soma('provas'), respostas: soma('respostas'), acerto, habilidades, semHab: null },
    calendario: { ...d.calendario, escolasAbaixo: abaixo },
    infra: { abertos: soma('chamadosAbertos'), atrasados48h: soma('chamadosAtrasados'), resolvidos30: null, horasMedia: null, equipamentos: soma('equipamentos'), tvs: soma('tvs'), tvsOnline: soma('tvsOnline'), problemas: [] },
    relatorios: null, escolas,
    frequencia: (() => { const a = soma('freqAulas'), f = soma('freqFaltas'); return { turmas: soma('freqTurmas'), turmas7: soma('freqTurmas7'), alunos: soma('freqAlunos'), freq: a ? (a - f) / a : null, risco: soma('freqRisco'), atencao: soma('freqAtencao') }; })(),
    rede: { acerto: d.aprendizagem.acerto, ativos30: (d.uso.professores + d.uso.gestores) ? d.uso.ativos30 / (d.uso.professores + d.uso.gestores) : null, escolas: d.totais.escolas, baseDias: d.calendario.baseDias, freq: d.frequencia ? d.frequencia.freq : null }
  };
}

export async function montar(db, m) {
  const agora = Date.now(), hoje = isoMS(agora), ano = +hoje.slice(0, 4), d30 = isoMS(agora - 29 * DIA);
  const muni = (await db.doc(`municipios/${m}`).get()).data() || {};
  const escolas = (await db.collection('escolas').where('municipio_id', '==', m).get()).docs
    .map(d => ({ id: d.id, nome: d.data().nome || d.id, status: d.data().status || '' })).filter(e => e.status !== 'inativa')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const E = {}; escolas.forEach(e => { E[e.id] = { id: e.id, nome: e.nome, professores: 0, ativos30: 0, alunos: 0, provas: 0, respostas: 0, ac: 0, tot: 0,
    dias: null, horas: null, metaDias: 200, metaHoras: 800, chamadosAbertos: 0, chamadosAtrasados: 0, equipamentos: 0, tvs: 0, tvsOnline: 0,
    freq: null, freqAlunos: 0, freqRisco: 0, freqAtencao: 0, freqTurmas: 0, freqTurmas7: 0, freqAulas: 0, freqFaltas: 0 }; });
  const erros = [];
  const tenta = async (nome, f) => { try { return await f(); } catch (e) { erros.push(nome); console.error('painelSecretaria', m, nome, e.message); return null; } };

  // ---------- pessoas e uso ----------
  const uso = { professores: 0, gestores: 0, ativos30: 0, ativos7: 0, onlineAgora: 0, porDia: [], modulos: [] };
  const uids = new Set();
  await tenta('usuarios', async () => {
    const s = await db.collection('usuarios').where('municipio_id', '==', m).get();
    s.forEach(d => {
      const x = d.data(); if (x.status !== 'ativo' || !['professor', 'gestor'].includes(x.perfil)) return;
      uids.add(d.id);
      const ult = msDe(x.ultimo_acesso), a30 = ult >= agora - 30 * DIA;
      if (x.perfil === 'professor') uso.professores++; else uso.gestores++;
      if (a30) uso.ativos30++; if (ult >= agora - 7 * DIA) uso.ativos7++; if (ult >= agora - 10 * 60 * 1000) uso.onlineAgora++;
      if (x.perfil === 'professor') (x.escolas_ids && x.escolas_ids.length ? x.escolas_ids : [x.escola_id]).forEach(eid => { if (E[eid]) { E[eid].professores++; if (a30) E[eid].ativos30++; } });
    });
  });
  await tenta('acessos', async () => {
    if (!muni.nome) return;
    const s = await db.collection('acessos_dia').where('municipio', '==', muni.nome).where('dia', '>=', d30).get();
    const porDia = {}, mods = {};
    s.forEach(d => { const x = d.data(); if (!uids.has(x.uid)) return; porDia[x.dia] = (porDia[x.dia] || 0) + 1; (x.modulos || []).forEach(md => { mods[md] = (mods[md] || 0) + 1; }); });
    for (let t = agora - 29 * DIA; t <= agora + 1000; t += DIA) { const d = isoMS(t); uso.porDia.push({ dia: d, n: porDia[d] || 0 }); }
    uso.modulos = Object.entries(mods).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  });
  await tenta('alunos', async () => {
    for (const ids of pedacos(escolas.map(e => e.id), 30)) {
      for (const id of ids) { const r = await db.collection('alunos').where('escola_id', '==', id).count().get(); E[id].alunos = r.data().count; }
    }
  });

  // ---------- aprendizagem: provas objetivas corrigidas no ano (cartão ou Portal) ----------
  const apr = { provas: 0, respostas: 0, ac: 0, tot: 0, habilidades: [], semHab: 0 };
  await tenta('aprendizagem', async () => {
    const s = await db.collection('avaliacoes').where('municipio_id', '==', m).get();
    const provas = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
      const a = +p.ano_letivo || (p.criado_em ? new Date(msDe(p.criado_em)).getFullYear() : 0);
      return a === ano && p.status !== 'excluida' && (p.questoes || []).some(q => q.tipo === 'multipla' && (q.alternativas || []).some(x => x.correta));
    }).sort((a, b) => msDe(b.criado_em) - msDe(a.criado_em)).slice(0, 300);
    const H = {};
    for (const lote of pedacos(provas, 10)) {
      await Promise.all(lote.map(async p => {
        const rs = (await db.collection('respostas').where('avaliacao_id', '==', p.id).get()).docs.map(d => d.data());
        if (!rs.length) return;
        const e = E[p.escola_id];
        apr.provas++; apr.respostas += rs.length; if (e) { e.provas++; e.respostas += rs.length; }
        (p.questoes || []).filter(q => q.tipo === 'multipla').forEach(q => {
          const cer = (q.alternativas || []).find(x => x.correta); if (!cer) return;
          let ac = 0; rs.forEach(r => { const x = (r.respostas || []).find(y => y.numero === q.numero); if (x && x.escolhida === cer.letra) ac++; });
          apr.ac += ac; apr.tot += rs.length; if (e) { e.ac += ac; e.tot += rs.length; }
          const cs = codigos(q.bncc); if (!cs.length) apr.semHab++;
          cs.forEach(cd => { const h = (H[cd] = H[cd] || { c: cd, ac: 0, tot: 0, q: 0, escolas: {} }); h.ac += ac; h.tot += rs.length; h.q++;
            if (p.escola_id) { const he = (h.escolas[p.escola_id] = h.escolas[p.escola_id] || { ac: 0, tot: 0 }); he.ac += ac; he.tot += rs.length; } });
        });
      }));
    }
    apr.habilidades = Object.values(H).map(h => ({ c: h.c, q: h.q, p: h.tot ? h.ac / h.tot : null,
      escolas: Object.fromEntries(Object.entries(h.escolas).map(([k, v]) => [k, v.tot ? v.ac / v.tot : null])) }))
      .sort((a, b) => a.p - b.p);
  });

  // ---------- calendário letivo ----------
  const cal = { publicado: false, inicio: '', fim: '', metaDias: 200, metaHoras: 800, baseDias: 0, baseHoras: 0, escolasAbaixo: 0 };
  await tenta('calendario', async () => {
    const R = (await db.doc(`cal_rede/${m}_${ano}`).get()).data(); if (!R) return;
    cal.publicado = true; cal.inicio = R.inicio; cal.fim = R.fim;
    const base = CAL.resumo(R, null, muni.uf); cal.metaDias = base.metaDias; cal.metaHoras = base.metaHoras; cal.baseDias = base.total; cal.baseHoras = base.horas;
    const ajustes = {}; (await db.collection('cal_escola').where('municipio_id', '==', m).where('ano', '==', ano).get()).forEach(d => { ajustes[d.data().escola_id] = d.data(); });
    escolas.forEach(e => { const r = CAL.resumo(R, ajustes[e.id] || null, muni.uf); Object.assign(E[e.id], { dias: r.total, horas: r.horas, metaDias: r.metaDias, metaHoras: r.metaHoras });
      if (r.total < r.metaDias || r.horas < r.metaHoras) cal.escolasAbaixo++; });
  });

  // ---------- infraestrutura ----------
  const inf = { abertos: 0, atrasados48h: 0, resolvidos30: 0, horasMedia: null, equipamentos: 0, tvs: 0, tvsOnline: 0, problemas: [] };
  await tenta('chamados', async () => {
    const s = await db.collection('rec_chamados').where('municipio_id', '==', m).get(); let soma = 0, n = 0; const probs = {};
    s.forEach(d => {
      const x = d.data(), ini = msDe(x.criado_em), e = E[x.escola_id];
      if (x.status !== 'resolvido') { inf.abertos++; if (e) e.chamadosAbertos++; if (ini && agora - ini > 48 * 36e5) { inf.atrasados48h++; if (e) e.chamadosAtrasados++; } }
      else { const fim = msDe(x.resolvido_em); if (fim >= agora - 30 * DIA) { inf.resolvidos30++; if (ini) { soma += (fim - ini) / 36e5; n++; } } }
      if (ini >= agora - 90 * DIA && x.problema) probs[x.problema] = (probs[x.problema] || 0) + 1;
    });
    inf.horasMedia = n ? Math.round(soma / n * 10) / 10 : null;
    inf.problemas = Object.entries(probs).map(([t, n2]) => ({ t, n: n2 })).sort((a, b) => b.n - a.n).slice(0, 5);
  });
  await tenta('equipamentos', async () => {
    const s = await db.collection('rec_itens').where('municipio_id', '==', m).get();
    s.forEach(d => { inf.equipamentos++; const e = E[d.data().escola_id]; if (e) e.equipamentos++; });
  });
  await tenta('tvs', async () => {
    const s = await db.collection('tv_telas').where('municipio_id', '==', m).get();
    s.forEach(d => { const x = d.data(), on = msDe(x.visto_em) >= agora - 15 * 60 * 1000; inf.tvs++; if (on) inf.tvsOnline++; const e = E[x.escola_id]; if (e) { e.tvs++; if (on) e.tvsOnline++; } });
  });

  // ---------- frequência digital (chamadas dos professores): só totais, sem nomes ----------
  const frq = { turmas: 0, turmas7: 0, alunos: 0, freq: null, risco: 0, atencao: 0 };
  await tenta('frequencia', async () => {
    const s = await db.collection('freq_resumo').where('municipio_id', '==', m).where('ano', '==', ano).get();
    const porE = {}; s.forEach(d => { const r = d.data(); (porE[r.escola_id] = porE[r.escola_id] || []).push(r); });
    let a = 0, f = 0;
    Object.entries(porE).forEach(([id, rs]) => { const g = FREQ.agregar(rs, hoje), e = E[id];
      frq.turmas += g.turmas; frq.turmas7 += g.turmas7; frq.alunos += g.alunos; frq.risco += g.risco; frq.atencao += g.atencao; a += g.aulas; f += g.faltas;
      if (e) Object.assign(e, { freq: g.freq, freqAlunos: g.alunos, freqRisco: g.risco, freqAtencao: g.atencao, freqTurmas: g.turmas, freqTurmas7: g.turmas7, freqAulas: g.aulas, freqFaltas: g.faltas }); });
    frq.freq = a ? (a - f) / a : null;
  });

  // ---------- relatórios pedagógicos (Central de Relatórios) ----------
  const rel = { enviados: 0, aprovados: 0, devolvidos: 0, rascunhos: 0 };
  await tenta('relatorios', async () => {
    const s = await db.collection('relatorios').where('municipio_id', '==', m).get();
    s.forEach(d => { const st = d.data().status; if (st === 'aprovado') rel.aprovados++; else if (st === 'devolvido') rel.devolvidos++; else if (st === 'enviado') rel.enviados++; else rel.rascunhos++; });
  });

  return {
    gerado_em: agora, ano, municipio: { id: m, nome: muni.nome || '', uf: muni.uf || '', logo_url: muni.logo_url || '' },
    totais: { escolas: escolas.length, alunos: Object.values(E).reduce((s, e) => s + e.alunos, 0) },
    uso, aprendizagem: { provas: apr.provas, respostas: apr.respostas, acerto: apr.tot ? apr.ac / apr.tot : null, habilidades: apr.habilidades.slice(0, 40), semHab: apr.semHab },
    calendario: cal, infra: inf, relatorios: rel, frequencia: frq,
    escolas: Object.values(E).map(e => ({ ...e, acerto: e.tot ? e.ac / e.tot : null, qtot: e.tot, ac: undefined, tot: undefined })),
    erros
  };
}

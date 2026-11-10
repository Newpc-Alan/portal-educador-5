// Painel de gestão para a TV do escritório (nov/2026): números ao vivo do Portal e do atendimento WhatsApp.
// A TV não faz login: abre /tv/painel/?k=CHAVE. A chave fica em painel_tv/config (só o administrador gera ou troca).
// O painel só devolve NÚMEROS e o primeiro nome da equipe de atendimento: nenhum telefone, e-mail ou texto de conversa.
// Resultado em memória por 60 s (a TV pede a cada minuto; várias TVs não multiplicam as leituras).
// v2 (nov/2026): a TV fica na recepção e é touch. Sem PIN ela recebe só a VITRINE (números institucionais da rede);
// a GESTÃO (fila, equipe, vencimentos) só vai com o PIN da equipe, conferido aqui no servidor (POST, fora da URL e dos logs).
// PIN: painel_tv/config.pin_hash = sha256(chave + ':' + pin); 5 erros seguidos travam por 5 minutos.
// Integridade: professores contam quem já entrou E os pré-cadastrados (convidados que ainda não fizeram o 1º acesso).
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { diaCG } from './whatsapp.js';
import { expiraAuditoria } from './auditoria.js';

const REGIAO = 'southamerica-east1';
const TZ = 4 * 3600e3;   // Campo Grande = UTC-4
const ORIGENS = /^https:\/\/(www\.portaldoeducador\.com\.br|portal-educador-5(-teste)?\.web\.app|teste\.portaldoeducador\.com\.br)$/;
const inicioDia = (t = Date.now()) => { const d = new Date(t - TZ); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + TZ; };
const inicioSemana = (t = Date.now()) => { const d = new Date(t - TZ), dia = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia) + TZ; };
const ts = ms => Timestamp.fromMillis(ms);
const n = async q => { try { return (await q.count().get()).data().count; } catch (e) { console.warn('painel-tv:', e.message); return null; } };
const primeiro = s => String(s || '').trim().split(/\s+/)[0] || '';

let CACHE = null, CACHE_EM = 0, CDEMO = null, CDEMO_EM = 0;
const DEMO = 'demo-rede';
// convidados que ainda não entraram: pré-cadastro (professor ou equipe, não aluno) cujo e-mail ainda não tem conta.
// O pré-cadastro continua existindo depois do 1º login, por isso compara os e-mails. Pesado: recalcula a cada 15 min.
const EDU = ['professor', 'gestor', 'secretaria'];
let CONV = null, CONV_EM = 0;
async function convidadosPendentes(db) {
  if (CONV && Date.now() - CONV_EM < 15 * 60e3) return CONV;
  const contas = new Set();
  (await db.collection('usuarios').select('email').get()).forEach(d => { const e = String(d.get('email') || '').trim().toLowerCase(); if (e) contas.add(e); });
  const por = {}; let total = 0;
  (await db.collection('pre_cadastros').where('status', '==', 'ativo').select('email', 'perfil', 'municipio_id').get()).forEach(d => {
    const u = d.data(), e = String(u.email || d.id).trim().toLowerCase();
    if (u.perfil === 'aluno' || contas.has(e)) return;
    total++; const m = u.municipio_id || '__sem'; por[m] = (por[m] || 0) + 1;
  });
  CONV = { total, por }; CONV_EM = Date.now(); return CONV;
}
async function montar(db) {
  const agora = Date.now(), hoje = inicioDia(agora), semana = inicioSemana(agora), d7 = agora - 7 * 864e5;
  const amanha = hoje + 864e5, depois = hoje + 2 * 864e5, em7 = hoje + 8 * 864e5;
  const U = db.collection('usuarios'), C = db.collection('wa_conversas'), M = db.collection('municipios');
  const [eqSn, emAt, metSn, munSn, comSn] = await Promise.all([
    db.collection('wa_equipe').get(),
    C.where('estado', '==', 'atendente').select('atribuido_uid', 'setor').get(),
    db.doc('wa_metricas/' + diaCG(agora)).get(),
    M.where('status', 'in', ['ativo', 'piloto']).select('nome', 'uf', 'rede', 'ideb', 'tipo_rede', 'status').get().catch(() => null),
    db.collection('comunicados_email').where('status', '==', 'enviando').select('total', 'enviados', 'falhas').get().catch(() => null)
  ]);
  const met = metSn.data() || {};
  // a Rede de Demonstração (POP-PDE-41, dados simulados) nunca entra nos números reais
  const dem = { prof: 0, gest: 0, ativos: 0, alunos: 0 };
  try {
    (await U.where('municipio_id', '==', DEMO).select('perfil', 'status').get()).forEach(d => { const u = d.data(); if (u.status !== 'ativo') return; dem.ativos++;
      if (u.perfil === 'professor') dem.prof++; else if (['gestor', 'secretaria'].includes(u.perfil)) dem.gest++; });
    dem.alunos = (await n(db.collection('alunos').where('municipio_id', '==', DEMO))) || 0;
  } catch (e) { console.warn('painel-tv demo:', e.message); }
  const conv = await convidadosPendentes(db).catch(e => { console.warn('painel-tv convidados:', e.message); return null; });
  const preTotal = conv ? conv.total : null;
  const [convHoje, chamados, comerciais, cadastrados, pendentes, novosHoje, novosSemana, ativos7, iaHoje, aulasAgora, professores, gestores, novos7,
    licAmanha, lic7, ctrAmanha, ctr30, acessosHoje, alunosTot, iaTotal, acervoTot, atividadesTot, jogosTot, videosTot, provasTot] = await Promise.all([
    n(C.where('ultima_em', '>=', ts(hoje))),
    n(db.collection('wa_chamados').where('status', '==', 'aberto')),
    n(C.where('comercial_em', '>=', ts(semana))),
    n(U.where('status', '==', 'ativo')),
    n(U.where('status', '==', 'pendente')),
    n(U.where('criado_em', '>=', ts(hoje))),
    n(U.where('criado_em', '>=', ts(semana))),
    n(U.where('ultimo_acesso', '>=', ts(d7))),
    n(db.collection('portal_ia_docs').where('criado_em', '>=', ts(hoje))),
    n(db.collection('qr_aulas').where('aberta_ate', '>', ts(agora))),
    n(U.where('perfil', '==', 'professor').where('status', '==', 'ativo')),
    n(U.where('perfil', 'in', ['gestor', 'secretaria']).where('status', '==', 'ativo')),
    n(U.where('criado_em', '>=', ts(d7))),
    n(U.where('licenca_fim', '>=', ts(amanha)).where('licenca_fim', '<', ts(depois))),
    n(U.where('licenca_fim', '>=', ts(amanha)).where('licenca_fim', '<', ts(em7))),
    n(M.where('vigencia_fim_ts', '>=', ts(amanha)).where('vigencia_fim_ts', '<', ts(depois))),
    n(M.where('vigencia_fim_ts', '>=', ts(amanha)).where('vigencia_fim_ts', '<', ts(hoje + 31 * 864e5))),
    // quem entrou hoje: 1 documento por pessoa por dia (acessos_dia), gravado pelo próprio Portal
    n(db.collection('acessos_dia').where('dia', '==', diaCG(agora))),
    n(db.collection('alunos')),
    n(db.collection('portal_ia_docs')),
    n(db.collection('acervo')),
    n(db.collection('atividades')),
    n(db.collection('jogos')),
    n(db.collection('videos')),
    n(db.collection('provas_online'))
  ]);
  const menos = (v, k) => v == null ? v : Math.max(0, v - k);
  const professoresR = menos(professores, dem.prof), gestoresR = menos(gestores, dem.gest), cadastradosR = menos(cadastrados, dem.ativos), alunosR = menos(alunosTot, dem.alunos);
  const comCada = {}; let fila = 0;
  emAt.forEach(d => { const u = d.data().atribuido_uid; if (u) comCada[u] = (comCada[u] || 0) + 1; else fila++; });
  const atendidas = met.atendidas_por || {};
  const equipe = eqSn.docs.map(d => d.data().ativo === true ? { nome: primeiro(d.data().nome), setores: d.data().setores || [], disponivel: d.data().disponivel !== false,
    comigo: comCada[d.id] || 0, atendidas_hoje: atendidas[d.id] || 0 } : null).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // redes ativas (o laboratório fica de fora): escolas, quem já entrou e quem foi convidado e ainda não entrou
  let redes = [];
  if (munSn) {
    const ms = munSn.docs.filter(d => d.id !== 'lab-muni' && d.id !== DEMO).slice(0, 40);
    const num = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
    redes = await Promise.all(ms.map(async d => ({ nome: d.data().nome || '', uf: d.data().uf || '', tipo: d.data().tipo_rede || 'municipal', piloto: d.data().status === 'piloto',
      // dados oficiais da rede (Censo/INEP), cadastrados em Municípios
      censo: { escolas: num((d.data().rede || {}).escolas), alunos: num((d.data().rede || {}).alunos), professores: num((d.data().rede || {}).professores), ano: num((d.data().rede || {}).censo) },
      ideb: { ai: num((d.data().ideb || {}).ai), af: num((d.data().ideb || {}).af), ano: num((d.data().ideb || {}).ano) },
      escolas: await n(db.collection('escolas').where('municipio_id', '==', d.id)),
      professores: await n(U.where('municipio_id', '==', d.id).where('perfil', 'in', EDU).where('status', '==', 'ativo').where('licenca_tipo', '==', 'institucional')),
      convidados: conv ? (conv.por[d.id] || 0) : null })));
    redes = redes.sort((a, b) => ((b.professores || 0) + (b.convidados || 0)) - ((a.professores || 0) + (a.convidados || 0)) || (b.escolas || 0) - (a.escolas || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  // vitrine: redes com dados oficiais cadastrados (Censo ou IDEB); conta interna sem dado oficial não aparece para o público
  // instituições particulares (e estaduais) não têm Censo da rede cadastrado: entram pelas escolas que já estão no Portal
  const comEscola = redes.filter(r => r.censo.escolas || r.censo.alunos || r.ideb.ai || r.ideb.af || (r.tipo !== 'municipal' && r.escolas));
  const escRede = r => r.censo.escolas || r.escolas || 0;
  const soma = l => l.some(v => v != null) ? l.reduce((a, v) => a + (v || 0), 0) : null;
  const transf = met.transferidas || 0, convites = { total: 0, enviados: 0, falhas: 0 };
  if (comSn) comSn.forEach(d => { const c = d.data(); convites.total += c.total || 0; convites.enviados += c.enviados || 0; convites.falhas += c.falhas || 0; });
  return {
    gerado_em: agora,
    // VITRINE: só totais institucionais (vão para qualquer pessoa que olhar a TV)
    publico: {
      redes: comEscola.length, redes_publicas: comEscola.filter(r => r.tipo === 'municipal' || r.tipo === 'estadual').length, particulares: comEscola.filter(r => r.tipo !== 'municipal' && r.tipo !== 'estadual').length,
      escolas: comEscola.length ? comEscola.reduce((a, r) => a + escRede(r), 0) : null,                 // escolas das redes atendidas (Censo; sem Censo, as do Portal)
      alunos_rede: soma(comEscola.map(r => r.censo.alunos)),                                            // alunos das redes atendidas (Censo)
      professores_rede: soma(comEscola.map(r => r.censo.professores)),
      escolas_portal: soma(comEscola.map(r => r.escolas)),
      educadores: soma([professoresR, gestoresR, preTotal]), professores_ativos: professoresR, convidados: preTotal,
      alunos: alunosR, ia_total: iaTotal, recursos: soma([acervoTot, atividadesTot, jogosTot, videosTot]), provas: provasTot,
      redes_lista: comEscola.map(r => ({ nome: r.nome, uf: r.uf, tipo: r.tipo, escolas: escRede(r), escolas_portal: r.escolas, alunos: r.censo.alunos, censo_ano: r.censo.ano,
        ideb_ai: r.ideb.ai, ideb_af: r.ideb.af, ideb_ano: r.ideb.ano, educadores: soma([r.professores, r.convidados]) }))
        .sort((a, b) => (b.alunos || 0) - (a.alunos || 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    // GESTÃO: só com PIN
    gestao: {
      whatsapp: { fila, em_atendimento: emAt.size - fila, conversas_hoje: convHoje, transferidas_hoje: transf,
        resolvidas_robo_pct: convHoje ? Math.max(0, Math.min(100, Math.round(100 * (1 - transf / convHoje)))) : null,
        resposta_media_min: met.resp_n ? Math.round(met.resp_soma_s / met.resp_n / 60) : null,
        encerradas_equipe: met.encerradas || 0, encerradas_auto: met.encerradas_auto || 0, sla_estouros: met.sla_estouros || 0,
        chamados_abertos: chamados, comerciais_semana: comerciais,
        satisfacao_pct: met.avaliacoes ? Math.round(100 * (met.nota_3 || 0) / met.avaliacoes) : null, avaliacoes_hoje: met.avaliacoes || 0 },
      equipe,
      usuarios: { cadastrados: cadastradosR, professores: professoresR, convidados: preTotal, pendentes, novos_hoje: novosHoje, novos_semana: novosSemana, novos_7d: novos7, ativos_7d: ativos7 },
      vencimentos: { licencas_amanha: licAmanha, licencas_7d: lic7, contratos_amanha: ctrAmanha, contratos_30d: ctr30 },
      uso: { acessos_hoje: acessosHoje, ia_hoje: iaHoje, aulas_agora: aulasAgora },
      convites,
      redes
    }
  };
}
// ---------- Rede de Demonstração (SENACOP, nov/2026): o "painel da Secretaria" com dados SIMULADOS ----------
// Só vai quando a TV pede ?demo=1 e só existe se a rede demo-rede foi criada (consulta demo-criar-gravar).
// Nada de nome de pessoa: só totais, escolas fictícias e habilidades BNCC. A TV mostra a faixa "dados simulados".
// As janelas de tempo contam a partir da data de referência da própria rede (criada como "hoje" na consulta), para não envelhecer.
const AREA = { MA: 'Matemática', LP: 'Língua Portuguesa', CI: 'Ciências', GE: 'Geografia', HI: 'História' };
async function montarDemo(db) {
  const munD = await db.doc('municipios/' + DEMO).get();
  if (!munD.exists) return null;
  const mun = munD.data(), DIA = 864e5, ref = mun.criado_em && mun.criado_em.toMillis ? mun.criado_em.toMillis() + 120 * DIA : Date.now();
  const q = c => db.collection(c).where('municipio_id', '==', DEMO).get();
  const [escS, frS, avS, rsS, usS, itS, chS, tvS, baS, relS, tmS, uS, ceS, acS] = await Promise.all([q('escolas'), q('freq_resumo'), q('avaliacoes'), q('respostas'),
    db.collection('usuarios').where('municipio_id', '==', DEMO).get(), q('rec_itens'), q('rec_chamados'), q('tv_telas'), q('busca_ativa'), q('relatorios'),
    q('termometro_registros'), q('users'), db.collection('certificados').where('demo', '==', true).get(), db.collection('acessos_dia').where('municipio', '==', mun.nome || '').get()]);
  const escNome = {}; escS.forEach(d => { escNome[d.id] = d.data().nome || ''; });
  const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
  // frequência
  let aulas = 0, faltas = 0, alunos = 0, risco = 0, atencao = 0; const fe = {};
  frS.forEach(d => { const x = d.data(), e = fe[x.escola_id] = fe[x.escola_id] || { a: 0, f: 0, al: 0, r: 0 };
    Object.values(x.alunos || {}).forEach(v => { aulas += v.a || 0; faltas += v.f || 0; alunos++; e.a += v.a || 0; e.f += v.f || 0; e.al++; if (v.r) { risco++; e.r++; } else if (v.at) atencao++; }); });
  const ba = { aberto: 0, encaminhado: 0, resolvido: 0 }; baS.forEach(d => { const s = d.data().status; if (s in ba) ba[s]++; });
  // aprendizagem: acerto por habilidade BNCC e por escola (provas corrigidas)
  const gab = {}; avS.forEach(d => { const m = {}; (d.data().questoes || []).forEach(qq => { const c = (qq.alternativas || []).find(a => a.correta); m[qq.numero] = { bncc: qq.bncc || '', c: c ? c.letra : '' }; }); gab[d.id] = m; });
  const hab = {}, ae = {}; let ok = 0, tot = 0;
  rsS.forEach(d => { const r = d.data(), g = gab[r.avaliacao_id]; if (!g) return; const e = ae[r.escola_id] = ae[r.escola_id] || { ok: 0, t: 0 };
    (r.respostas || []).forEach(x => { const qq = g[x.numero]; if (!qq) return; const h = hab[qq.bncc] = hab[qq.bncc] || { ok: 0, t: 0 }; const certo = x.escolhida === qq.c ? 1 : 0;
      h.ok += certo; h.t++; e.ok += certo; e.t++; ok += certo; tot++; }); });
  // professores: uso nos últimos 30 dias e quem entrou na semana
  const profs = usS.docs.map(d => d.data()).filter(u => u.perfil === 'professor' && u.status === 'ativo');
  const ativos7 = profs.filter(u => u.ultimo_acesso && u.ultimo_acesso.toMillis() >= ref - 7 * DIA).length;
  // só os 30 dias até a data de referência (recriar a rede deixa dias antigos para trás)
  const desde = new Date(ref - 30 * DIA - 4 * 36e5).toISOString().slice(0, 10), ate = new Date(ref - 4 * 36e5 + DIA).toISOString().slice(0, 10);
  const porDia = {}, mods = {}; let acessos30 = 0;
  acS.forEach(d => { const x = d.data(); if (!(x.dia >= desde && x.dia <= ate)) return; acessos30++; porDia[x.dia] = (porDia[x.dia] || 0) + 1; (x.modulos || []).forEach(m => { mods[m] = (mods[m] || 0) + 1; }); });
  const dias = Object.keys(porDia).sort().slice(-22).map(dia => ({ dia, n: porDia[dia] }));
  // formação continuada
  let iniciados = 0, concluidos = 0, praticas = 0;
  await Promise.all(uS.docs.map(async d => { const [pg, pr] = await Promise.all([d.ref.collection('progresso').get(), d.ref.collection('praticas').get()]);
    pg.forEach(x => { iniciados++; if (x.data().concluido) concluidos++; }); praticas += pr.size; }));
  let certificados = 0, horas = 0; ceS.forEach(d => { if (String(d.data().uid || '').startsWith('demo-')) { certificados++; horas += Number(d.data().cargaHoraria || 0); } });
  // termômetro da turma (só contagens e rótulos)
  let tmResp = 0, tmEnt = 0, tmPar = 0, tmConf = 0; const conf = {};
  tmS.forEach(d => { const x = d.data(); tmResp += x.respostas || 0; tmEnt += x.entendeu || 0; tmPar += x.parcial || 0; tmConf += x.confundiu || 0;
    (x.grupos || []).filter(g => g.tipo === 'confundiu').forEach(g => { const k = (x.disciplina || '') + '|' + (g.titulo || ''); conf[k] = (conf[k] || 0) + (g.n || 0); }); });
  // escolas conectadas
  const tipos = {}; itS.forEach(d => { const t = d.data().tipo || 'Outro'; tipos[t] = (tipos[t] || 0) + 1; });
  let abertos = 0, resolvidos = 0, horasSol = 0; chS.forEach(d => { const x = d.data(); if (x.status === 'resolvido') { resolvidos++; if (x.resolvido_em && x.criado_em) horasSol += (x.resolvido_em.toMillis() - x.criado_em.toMillis()) / 36e5; } else abertos++; });
  const rel = {}; relS.forEach(d => { const s = d.data().status || ''; rel[s] = (rel[s] || 0) + 1; });
  return {
    rede: mun.nome || 'Rede Municipal de Demonstração', escolas: escS.size, turmas: frS.size,
    ia: mun.ia_demo || null,
    frequencia: { alunos, presenca: aulas ? pct(aulas - faltas, aulas) : null, risco, atencao, busca_ativa: ba,
      escolas: Object.keys(fe).map(id => ({ nome: escNome[id] || id, presenca: fe[id].a ? pct(fe[id].a - fe[id].f, fe[id].a) : null, alunos: fe[id].al, risco: fe[id].r })).sort((a, b) => (b.presenca || 0) - (a.presenca || 0)) },
    aprendizagem: { provas: avS.size, avaliados: rsS.size, acerto: pct(ok, tot),
      habilidades: Object.keys(hab).map(k => ({ codigo: k, area: AREA[k.slice(4, 6)] || '', acerto: pct(hab[k].ok, hab[k].t) })).sort((a, b) => a.acerto - b.acerto),
      escolas: Object.keys(ae).map(id => ({ nome: escNome[id] || id, acerto: pct(ae[id].ok, ae[id].t) })).sort((a, b) => b.acerto - a.acerto) },
    professores: { total: profs.length, ativos7, acessos30, dias, modulos: Object.keys(mods).map(k => ({ id: k, n: mods[k] })).sort((a, b) => b.n - a.n).slice(0, 5) },
    formacao: { iniciados, concluidos, certificados, horas, praticas },
    termometro: { leituras: tmS.size, respostas: tmResp, entendeu: pct(tmEnt, tmResp), parcial: pct(tmPar, tmResp), confundiu: pct(tmConf, tmResp),
      confusoes: Object.keys(conf).map(k => ({ disciplina: k.split('|')[0], titulo: k.split('|')[1], n: conf[k] })).sort((a, b) => b.n - a.n).slice(0, 3) },
    infra: { equipamentos: itS.size, tipos, tvs: tvS.size, chamados_abertos: abertos, chamados_resolvidos: resolvidos, horas_media: resolvidos ? Math.round(horasSol / resolvidos) : null,
      relatorios: relS.size, relatorios_aprovados: rel.aprovado || 0 }
  };
}

const hashPin = (chave, pin) => createHash('sha256').update(chave + ':' + pin).digest('hex');
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export const painelTv = onRequest({ region: REGIAO, maxInstances: 3, timeoutSeconds: 60, memory: '512MiB' }, async (req, res) => {
  const o = String(req.get('origin') || ''); if (ORIGENS.test(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); }
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET, POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.status(204).send(''); return; }
  if (req.method !== 'GET' && req.method !== 'POST') { res.status(405).send(''); return; }
  const k = String(req.query.k || '');
  const db = getFirestore(), ref = db.doc('painel_tv/config'), cfg = (await ref.get()).data() || {};
  if (!cfg.chave || !/^[A-Za-z0-9_-]{20,64}$/.test(k) || !igual(k, cfg.chave)) { res.status(403).json({ erro: 'chave' }); return; }
  // PIN da gestão: só no corpo do POST (não aparece na URL nem nos logs)
  const pin = req.method === 'POST' ? String((req.body && req.body.pin) || '').replace(/\D/g, '').slice(0, 8) : '';
  let gestao = false, pinErro = null;
  if (pin) {
    const travado = cfg.pin_bloqueio_ate && cfg.pin_bloqueio_ate.toMillis() > Date.now();
    if (!cfg.pin_hash) pinErro = 'sem_pin';
    else if (travado) pinErro = 'travado';
    else if (igual(hashPin(cfg.chave, pin), cfg.pin_hash)) { gestao = true; if (cfg.pin_erros) await ref.update({ pin_erros: 0 }).catch(() => {}); }
    else {
      const e = (cfg.pin_erros || 0) + 1; pinErro = e >= 5 ? 'travado' : 'pin';
      await ref.update(e >= 5 ? { pin_erros: 0, pin_bloqueio_ate: Timestamp.fromMillis(Date.now() + 5 * 60e3) } : { pin_erros: e }).catch(() => {});
    }
  }
  try {
    if (!CACHE || Date.now() - CACHE_EM > 60e3) { CACHE = await montar(db); CACHE_EM = Date.now(); }
    const out = { gerado_em: CACHE.gerado_em, publico: CACHE.publico, tem_pin: !!cfg.pin_hash };
    if (req.query.demo === '1') {
      if (!CDEMO_EM || Date.now() - CDEMO_EM > 5 * 60e3) { CDEMO = await montarDemo(db).catch(e => { console.warn('painel-tv demo:', e.message); return null; }); CDEMO_EM = Date.now(); }
      if (CDEMO) out.demo = CDEMO;
    }
    if (gestao) out.gestao = CACHE.gestao;
    if (pinErro) out.pin_erro = pinErro;
    res.json(out);
  } catch (e) { console.error('painel-tv:', e.message); res.status(500).json({ erro: 'falha' }); }
});

// administrador gera (ou troca) a chave e recebe o link do painel. Trocar a chave desliga o link antigo na hora.
export const painelTvChave = onCall({ region: REGIAO, maxInstances: 2, timeoutSeconds: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore(), u = (await db.doc('usuarios/' + req.auth.uid).get()).data() || {};
  if (u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador do Portal faz isso.');
  const ref = db.doc('painel_tv/config'), atual = (await ref.get()).data() || {};
  let chave = atual.chave;
  // PIN da gestão (4 a 6 números): guarda só o hash, ligado à chave (trocar a chave pede PIN novo)
  const pinNovo = String((req.data || {}).pin || '');
  if (pinNovo) {
    if (!/^\d{4,6}$/.test(pinNovo)) throw new HttpsError('invalid-argument', 'O PIN tem de 4 a 6 números.');
    if (!chave) throw new HttpsError('failed-precondition', 'Gere o link do painel antes de definir o PIN.');
    await ref.set({ pin_hash: hashPin(chave, pinNovo), pin_erros: 0, pin_bloqueio_ate: null, pin_trocado_em: FieldValue.serverTimestamp() }, { merge: true });
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'painel_tv', doc: 'config',
      autor_uid: req.auth.uid, autor_tipo: 'usuario', autor_email: String(req.auth.token.email || '').slice(0, 120), perfil: 'admin', detalhe: 'PIN da gestão do painel da TV definido', campos: [], valores: {} }).catch(() => {});
    return { link: 'https://www.portaldoeducador.com.br/tv/painel/?k=' + chave, tem_pin: true };
  }
  if (!chave || (req.data || {}).trocar === true) {
    chave = randomBytes(24).toString('base64url');
    await ref.set({ chave, trocada_em: FieldValue.serverTimestamp(), trocada_por: req.auth.uid }, { merge: true });
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'painel_tv', doc: 'config',
      autor_uid: req.auth.uid, autor_tipo: 'usuario', autor_email: String(req.auth.token.email || '').slice(0, 120), perfil: 'admin', detalhe: 'Chave do painel da TV ' + (atual.chave ? 'trocada' : 'criada'), campos: [], valores: {} }).catch(() => {});
  }
  const trocou = chave !== atual.chave;
  if (trocou && atual.pin_hash) await ref.update({ pin_hash: FieldValue.delete() });   // o PIN antigo era ligado à chave antiga
  return { link: 'https://www.portaldoeducador.com.br/tv/painel/?k=' + chave, tem_pin: !trocou && !!atual.pin_hash };
});

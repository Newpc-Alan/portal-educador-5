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

let CACHE = null, CACHE_EM = 0;
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
    M.where('status', '==', 'ativo').select('nome', 'uf').get().catch(() => null),
    db.collection('comunicados_email').where('status', '==', 'enviando').select('total', 'enviados', 'falhas').get().catch(() => null)
  ]);
  const met = metSn.data() || {};
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
  const comCada = {}; let fila = 0;
  emAt.forEach(d => { const u = d.data().atribuido_uid; if (u) comCada[u] = (comCada[u] || 0) + 1; else fila++; });
  const atendidas = met.atendidas_por || {};
  const equipe = eqSn.docs.map(d => d.data().ativo === true ? { nome: primeiro(d.data().nome), setores: d.data().setores || [], disponivel: d.data().disponivel !== false,
    comigo: comCada[d.id] || 0, atendidas_hoje: atendidas[d.id] || 0 } : null).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // redes ativas (o laboratório fica de fora): escolas, quem já entrou e quem foi convidado e ainda não entrou
  let redes = [];
  if (munSn) {
    const ms = munSn.docs.filter(d => d.id !== 'lab-muni').slice(0, 40);
    redes = await Promise.all(ms.map(async d => ({ nome: d.data().nome || '', uf: d.data().uf || '',
      escolas: await n(db.collection('escolas').where('municipio_id', '==', d.id)),
      professores: await n(U.where('municipio_id', '==', d.id).where('perfil', 'in', EDU).where('status', '==', 'ativo')),
      convidados: conv ? (conv.por[d.id] || 0) : null })));
    redes = redes.sort((a, b) => ((b.professores || 0) + (b.convidados || 0)) - ((a.professores || 0) + (a.convidados || 0)) || (b.escolas || 0) - (a.escolas || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  const soma = l => l.some(v => v != null) ? l.reduce((a, v) => a + (v || 0), 0) : null;
  const transf = met.transferidas || 0, convites = { total: 0, enviados: 0, falhas: 0 };
  if (comSn) comSn.forEach(d => { const c = d.data(); convites.total += c.total || 0; convites.enviados += c.enviados || 0; convites.falhas += c.falhas || 0; });
  return {
    gerado_em: agora,
    // VITRINE: só totais institucionais (vão para qualquer pessoa que olhar a TV)
    publico: {
      redes: redes.length, escolas: soma(redes.map(r => r.escolas)),   // só as escolas das redes ativas (laboratório fora)
      educadores: soma([professores, gestores, preTotal]), professores_ativos: professores, convidados: preTotal,
      alunos: alunosTot, ia_total: iaTotal, recursos: soma([acervoTot, atividadesTot, jogosTot, videosTot]), provas: provasTot,
      redes_lista: redes.map(r => ({ nome: r.nome, uf: r.uf, escolas: r.escolas, educadores: soma([r.professores, r.convidados]) }))
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
      usuarios: { cadastrados, professores, convidados: preTotal, pendentes, novos_hoje: novosHoje, novos_semana: novosSemana, novos_7d: novos7, ativos_7d: ativos7 },
      vencimentos: { licencas_amanha: licAmanha, licencas_7d: lic7, contratos_amanha: ctrAmanha, contratos_30d: ctr30 },
      uso: { acessos_hoje: acessosHoje, ia_hoje: iaHoje, aulas_agora: aulasAgora },
      convites,
      redes
    }
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

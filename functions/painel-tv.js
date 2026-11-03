// Painel de gestão para a TV do escritório (nov/2026): números ao vivo do Portal e do atendimento WhatsApp.
// A TV não faz login: abre /tv/painel/?k=CHAVE. A chave fica em painel_tv/config (só o administrador gera ou troca).
// O painel só devolve NÚMEROS e o primeiro nome da equipe de atendimento: nenhum telefone, e-mail ou texto de conversa.
// Resultado em memória por 60 s (a TV pede a cada minuto; várias TVs não multiplicam as leituras).
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes, timingSafeEqual } from 'node:crypto';
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
async function montar(db) {
  const agora = Date.now(), hoje = inicioDia(agora), semana = inicioSemana(agora), d7 = agora - 7 * 864e5;
  const amanha = hoje + 864e5, depois = hoje + 2 * 864e5, em7 = hoje + 8 * 864e5;
  const U = db.collection('usuarios'), C = db.collection('wa_conversas');
  const [eqSn, emAt, metSn, entradas, munSn] = await Promise.all([
    db.collection('wa_equipe').get(),
    C.where('estado', '==', 'atendente').select('atribuido_uid', 'setor').get(),
    db.doc('wa_metricas/' + diaCG(agora)).get(),
    db.collection('auditoria').where('acao', '==', 'entrou').where('em', '>=', ts(hoje)).select('autor_uid').limit(20000).get().catch(() => null),
    db.collection('municipios').where('status', '==', 'ativo').select('nome', 'uf').get().catch(() => null)
  ]);
  const met = metSn.data() || {};
  const M = db.collection('municipios');
  const [convHoje, transfHoje, chamados, comerciais, cadastrados, pendentes, novosHoje, novosSemana, ativos7, iaHoje, aulasAgora, professores, novos7, licAmanha, lic7, ctrAmanha, ctr30] = await Promise.all([
    n(C.where('ultima_em', '>=', ts(hoje))),
    n(C.where('encaminhada_em', '>=', ts(hoje))),
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
    n(U.where('criado_em', '>=', ts(d7))),
    // licenças individuais (teste, avulsa, cortesia) que terminam amanhã e nos próximos 7 dias
    n(U.where('licenca_fim', '>=', ts(amanha)).where('licenca_fim', '<', ts(depois))),
    n(U.where('licenca_fim', '>=', ts(amanha)).where('licenca_fim', '<', ts(em7))),
    // contratos das redes (vigência) que terminam amanhã e nos próximos 30 dias
    n(M.where('vigencia_fim_ts', '>=', ts(amanha)).where('vigencia_fim_ts', '<', ts(depois))),
    n(M.where('vigencia_fim_ts', '>=', ts(amanha)).where('vigencia_fim_ts', '<', ts(hoje + 31 * 864e5)))
  ]);
  // equipe: só primeiro nome, situação e quantas conversas estão com cada um
  const comCada = {}; let fila = 0;
  emAt.forEach(d => { const u = d.data().atribuido_uid; if (u) comCada[u] = (comCada[u] || 0) + 1; else fila++; });
  const atendidas = met.atendidas_por || {};
  const equipe = eqSn.docs.map(d => d.data().ativo === true ? { nome: primeiro(d.data().nome), setores: d.data().setores || [], disponivel: d.data().disponivel !== false,
    comigo: comCada[d.id] || 0, atendidas_hoje: atendidas[d.id] || 0 } : null).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // redes ativas: escolas e professores de cada uma (até 12, as maiores primeiro; o laboratório fica de fora)
  let redes = [];
  if (munSn) {
    const ms = munSn.docs.filter(d => d.id !== 'lab-muni').slice(0, 40);
    redes = await Promise.all(ms.map(async d => ({ nome: d.data().nome || '', uf: d.data().uf || '',
      escolas: await n(db.collection('escolas').where('municipio_id', '==', d.id)),
      professores: await n(U.where('municipio_id', '==', d.id).where('perfil', '==', 'professor').where('status', '==', 'ativo')) })));
    redes = redes.sort((a, b) => (b.professores || 0) - (a.professores || 0) || (b.escolas || 0) - (a.escolas || 0) || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 12);
  }
  const acessosHoje = entradas ? new Set(entradas.docs.map(d => d.data().autor_uid).filter(Boolean)).size : null;
  return {
    gerado_em: agora,
    whatsapp: { fila, em_atendimento: emAt.size - fila, conversas_hoje: convHoje, transferidas_hoje: transfHoje,
      resolvidas_robo_pct: convHoje ? Math.max(0, Math.round(100 * (1 - (transfHoje || 0) / convHoje))) : null,
      resposta_media_min: met.resp_n ? Math.round(met.resp_soma_s / met.resp_n / 60) : null, encerradas_hoje: met.encerradas || 0,
      chamados_abertos: chamados, comerciais_semana: comerciais,
      satisfacao_pct: met.avaliacoes ? Math.round(100 * (met.nota_3 || 0) / met.avaliacoes) : null, avaliacoes_hoje: met.avaliacoes || 0 },
    equipe,
    usuarios: { cadastrados, professores, pendentes, novos_hoje: novosHoje, novos_semana: novosSemana, novos_7d: novos7, ativos_7d: ativos7 },
    vencimentos: { licencas_amanha: licAmanha, licencas_7d: lic7, contratos_amanha: ctrAmanha, contratos_30d: ctr30 },
    uso: { acessos_hoje: acessosHoje, ia_hoje: iaHoje, aulas_agora: aulasAgora },
    redes
  };
}
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export const painelTv = onRequest({ region: REGIAO, maxInstances: 3, timeoutSeconds: 60, memory: '512MiB' }, async (req, res) => {
  const o = String(req.get('origin') || ''); if (ORIGENS.test(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); }
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'GET'); res.status(204).send(''); return; }
  if (req.method !== 'GET') { res.status(405).send(''); return; }
  const k = String(req.query.k || '');
  const db = getFirestore(), cfg = (await db.doc('painel_tv/config').get()).data() || {};
  if (!cfg.chave || !/^[A-Za-z0-9_-]{20,64}$/.test(k) || !igual(k, cfg.chave)) { res.status(403).json({ erro: 'chave' }); return; }
  try {
    if (!CACHE || Date.now() - CACHE_EM > 60e3) { CACHE = await montar(db); CACHE_EM = Date.now(); }
    res.json(CACHE);
  } catch (e) { console.error('painel-tv:', e.message); res.status(500).json({ erro: 'falha' }); }
});

// administrador gera (ou troca) a chave e recebe o link do painel. Trocar a chave desliga o link antigo na hora.
export const painelTvChave = onCall({ region: REGIAO, maxInstances: 2, timeoutSeconds: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore(), u = (await db.doc('usuarios/' + req.auth.uid).get()).data() || {};
  if (u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador do Portal faz isso.');
  const ref = db.doc('painel_tv/config'), atual = (await ref.get()).data() || {};
  let chave = atual.chave;
  if (!chave || (req.data || {}).trocar === true) {
    chave = randomBytes(24).toString('base64url');
    await ref.set({ chave, trocada_em: FieldValue.serverTimestamp(), trocada_por: req.auth.uid }, { merge: true });
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'painel_tv', doc: 'config',
      autor_uid: req.auth.uid, autor_tipo: 'usuario', autor_email: String(req.auth.token.email || '').slice(0, 120), perfil: 'admin', detalhe: 'Chave do painel da TV ' + (atual.chave ? 'trocada' : 'criada'), campos: [], valores: {} }).catch(() => {});
  }
  return { link: 'https://www.portaldoeducador.com.br/tv/painel/?k=' + chave };
});

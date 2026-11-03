// Trilha de auditoria do Portal 5.0 (pedido do Alan, nov/2026: "tudo que acontece deve ser possível auditar").
// - Toda criação, alteração e exclusão no banco é registrada PELO SERVIDOR em auditoria/{id}: quem, quando, onde, o quê.
//   O usuário não grava nem apaga nada aqui (regra: só leitura do admin).
// - Entradas no Portal (data, hora, IP, navegador) por registrarEntrada, chamada pela tela depois do login.
// - Retenção: 6 meses (Marco Civil da Internet, art. 15). O campo expira_em tem política de TTL: o Firestore apaga sozinho.
// - LGPD: guarda QUAIS campos mudaram; o valor (antes e depois) só nos campos de controle listados em VALOR. Nunca senha, PIN, token.
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const REGIAO = 'southamerica-east1';
const RETENCAO_DIAS = 183;   // 6 meses
// prazo de guarda de QUALQUER registro da auditoria (as outras funções que gravam aqui também usam)
export const expiraAuditoria = () => Timestamp.fromMillis(Date.now() + RETENCAO_DIAS * 86400000);

// coleções de ruído técnico (contadores, presença ao vivo, filas internas) e a própria trilha
const IGNORAR = new Set(['auditoria', 'backups_log', 'stats', 'temas_populares', 'vistos', 'tele_sessoes', 'cmd', 'avisos_contador', 'rec_busca',
  'uso_real', 'ia_uso', 'portal_ia_uso', 'freq_resumo', 'rede_feed', 'nc_mapa', 'qr_aulas', 'po_sala', 'turma_aluno_estado', 'turma_presenca',
  'videos_reacoes', 'biblioteca_reacoes', 'noticias_reacoes', 'atividades_reacoes', 'tv_telas', 'tv_pareamentos', 'portaria_vistas', 'login_carteirinha', 'escola_config', 'busca_indice', 'buscas_mes', 'comunicados_email', 'envio_lotes', 'comunicados_pref',
  'wa_conversas', 'wa_vistos', 'bot_conhecimento']);   // WhatsApp: o robô registra na auditoria só os fatos (chamado, link, atendente)
const IGNORAR_DOC = new Set(['config/nc_copia']);
// campos que mudam sozinhos a cada gravação e não dizem nada
const CAMPO_TECNICO = /^(atualizado_em|atualizadoEm|ultimo|ultimo_acesso|ultima_atividade|visto_em|em|ts|modificado_em)$/;
// campos de controle: aqui guardamos o valor antes e depois
const VALOR = new Set(['perfil', 'status', 'papel', 'municipio_id', 'escola_id', 'turma_id', 'licenca_tipo', 'licenca_fim', 'publicado', 'email',
  'nota', 'notas', 'media', 'conceito', 'faltas', 'presenca', 'presencas', 'situacao', 'saldo', 'creditos', 'valor', 'titulo', 'pasta', 'origem',
  'modulos', 'plano', 'cota', 'acervo_cota_mb', 'fechado', 'aberto', 'bimestre', 'periodo', 'tipo_nome', 'turma_nome']);
const SEGREDO = /senha|pin|token|chave|segredo|hash|secret/i;

const curto = (v, max = 300) => {
  if (v === undefined) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  let s; try { s = typeof v === 'string' ? v : JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toDate === 'function') ? x.toDate().toISOString() : x); } catch (e) { s = String(v); }
  return s && s.length > max ? s.slice(0, max) + '…' : s;
};
const igual = (a, b) => curto(a, 1e6) === curto(b, 1e6);

// pura (testável): monta o registro a partir do antes/depois; null = nada a registrar
export function montarRegistro({ caminho, antes, depois, authType, authId }) {
  const partes = caminho.split('/'), colecao = partes[0];
  if (IGNORAR.has(colecao) || IGNORAR.has(partes[2]) || IGNORAR_DOC.has(caminho)) return null;
  const acao = !antes ? 'criou' : !depois ? 'excluiu' : 'alterou';
  const a = antes || {}, d = depois || {};
  const campos = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(k => !CAMPO_TECNICO.test(k) && !igual(a[k], d[k])).sort();
  if (acao === 'alterou' && !campos.length) return null;
  const valores = {};
  for (const k of campos) if (VALOR.has(k) && !SEGREDO.test(k)) valores[k] = { de: curto(a[k]), para: curto(d[k]) };
  // acesso ao acervo: mostra QUAIS arquivos foram abertos/baixados
  let detalhe = null;
  if (colecao === 'acessos_dia') {
    const novos = [].concat(...Object.keys(d).filter(k => Array.isArray(d[k])).map(k => d[k].filter(x => !(a[k] || []).includes(x)).map(x => k + ':' + x)));
    if (!novos.length) return null;
    detalhe = novos.slice(0, 20).join(', ');
  }
  // quem fez: o usuário da requisição; quando foi o servidor (função), o campo de autoria do próprio documento
  const doDoc = d.atualizado_por || d.criado_por || d.autor_uid || d.uid || a.atualizado_por || '';
  // usuário do app (Firebase Auth): authId é o uid. Conta de serviço (as funções do Portal) vem com e-mail no authId.
  const usuario = !!authId && !String(authId).includes('@') && !['system', 'service_account'].includes(authType);   // pelo navegador chega como api_key + uid
  return {
    em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + RETENCAO_DIAS * 86400000),
    acao: acao === 'alterou' && colecao === 'acessos_dia' ? 'acessou' : acao, origem: 'banco',
    colecao: partes.length > 2 ? colecao + '/' + partes[2] : colecao, doc: caminho.slice(0, 400),
    autor_uid: usuario ? String(authId || '') : String(doDoc || '').slice(0, 128),
    autor_tipo: usuario ? 'usuario' : ['admin', 'service_account', 'system'].includes(authType) ? 'sistema' : authType === 'unauthenticated' ? 'anonimo' : 'desconhecido',
    auth: String(authType || '').slice(0, 30),
    municipio_id: String(d.municipio_id || a.municipio_id || '').slice(0, 64), escola_id: String(d.escola_id || a.escola_id || '').slice(0, 64),
    campos: campos.slice(0, 60), valores, ...(detalhe ? { detalhe } : {})
  };
}

async function registrar(event) {
  const antes = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const caminho = event.document || (event.data && (event.data.after || event.data.before).ref.path) || '';
  const r = montarRegistro({ caminho, antes, depois, authType: event.authType, authId: event.authId });
  if (r) await getFirestore().collection('auditoria').add(r);
}
const OPC = { region: REGIAO, maxInstances: 20, timeoutSeconds: 30, memory: '256MiB', retry: false };
export const auditarBanco = onDocumentWrittenWithAuthContext({ ...OPC, document: '{colecao}/{id}' }, registrar);
export const auditarBancoSub = onDocumentWrittenWithAuthContext({ ...OPC, document: '{colecao}/{id}/{sub}/{subId}' }, registrar);

// entrada no Portal: a tela chama uma vez por sessão, logo depois do login
export const registrarEntrada = onCall({ region: REGIAO, maxInstances: 20, timeoutSeconds: 15 }, async req => {
  const uid = req.auth && req.auth.uid; if (!uid) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore();
  let u = (await db.doc('usuarios/' + uid).get()).data();
  if (!u) { const f = (await db.doc('users/' + uid).get()).data(); u = f ? { perfil: 'formacao' + (f.papel ? ':' + f.papel : ''), municipio_id: f.municipio_id || '' } : {}; }   // conta só da Formação Continuada
  const h = (req.rawRequest && req.rawRequest.headers) || {};
  const ip = String(h['x-forwarded-for'] || (req.rawRequest && req.rawRequest.ip) || '').split(',')[0].trim().slice(0, 64);
  const tela = String((req.data && req.data.tela) || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + RETENCAO_DIAS * 86400000),
    acao: 'entrou', origem: 'login', colecao: 'sessao', doc: '', autor_uid: uid, autor_tipo: 'usuario', autor_email: String(req.auth.token.email || '').slice(0, 120),
    perfil: String(u.perfil || '').slice(0, 30), municipio_id: String(u.municipio_id || '').slice(0, 64), escola_id: String(u.escola_id || '').slice(0, 64),
    ip, navegador: String(h['user-agent'] || '').slice(0, 200), tela, campos: [], valores: {} });
  return { ok: true };
});

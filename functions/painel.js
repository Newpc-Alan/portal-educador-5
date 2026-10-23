// Painel de uso da plataforma (só administrador): lê as métricas oficiais do Google Cloud Monitoring
// (banco Firestore, Storage, funções) dos últimos 30 dias. Permissão usada: roles/monitoring.viewer
// na conta de serviço das funções (somente leitura).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJETO = 'portal-educador-5';
const DIA = 86400;
let cache = null; // { em, dados }: evita consultar de novo a cada clique (5 minutos)

async function exigirAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Somente administrador.');
}

// uma série por dia (soma ou máximo), agrupada pelos campos pedidos
async function serie(token, metrica, { alinhador = 'ALIGN_SUM', redutor = 'REDUCE_SUM', grupo = [], filtroExtra = '', dias = 30 } = {}) {
  const fim = new Date(), ini = new Date(Date.now() - dias * DIA * 1000);
  const p = new URLSearchParams({
    filter: `metric.type="${metrica}"${filtroExtra ? ' AND ' + filtroExtra : ''}`,
    'interval.startTime': ini.toISOString(), 'interval.endTime': fim.toISOString(),
    'aggregation.alignmentPeriod': `${DIA}s`, 'aggregation.perSeriesAligner': alinhador, 'aggregation.crossSeriesReducer': redutor
  });
  grupo.forEach(g => p.append('aggregation.groupByFields', g));
  const r = await fetch(`https://monitoring.googleapis.com/v3/projects/${PROJETO}/timeSeries?${p}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${metrica}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  const d = await r.json();
  return (d.timeSeries || []).map(s => ({
    rotulos: { ...(s.metric && s.metric.labels || {}), ...(s.resource && s.resource.labels || {}) },
    pontos: Object.fromEntries((s.points || []).map(pt => [
      new Date(pt.interval.endTime).toLocaleDateString('en-CA', { timeZone: 'America/Campo_Grande' }),
      Number(pt.value.int64Value ?? pt.value.doubleValue ?? 0)
    ]))
  }));
}
const somaDias = (series) => { const o = {}; series.forEach(s => Object.entries(s.pontos).forEach(([d, v]) => { o[d] = (o[d] || 0) + v; })); return o; };
const ultimo = (pontos) => { const ks = Object.keys(pontos).sort(); return ks.length ? pontos[ks[ks.length - 1]] : 0; };

export const painelUso = onCall({ region: 'southamerica-east1', timeoutSeconds: 60, memory: '256MiB' }, async (req) => {
  await exigirAdmin(req);
  if (cache && Date.now() - cache.em < 5 * 60 * 1000 && !(req.data && req.data.forcar)) return cache.dados;
  const { access_token: token } = await applicationDefault().getAccessToken();
  const erros = [];
  const tenta = async (nome, f) => { try { return await f(); } catch (e) { erros.push(nome + ': ' + String(e.message || e).slice(0, 200)); return null; } };

  const [leit, grav, excl, banco, stBytes, stObjs, stSaida, run] = await Promise.all([
    tenta('leituras', () => serie(token, 'firestore.googleapis.com/document/read_count')),
    tenta('gravacoes', () => serie(token, 'firestore.googleapis.com/document/write_count')),
    tenta('exclusoes', () => serie(token, 'firestore.googleapis.com/document/delete_count')),
    tenta('tamanho do banco', () => serie(token, 'firestore.googleapis.com/storage/data_and_index_storage_bytes', { alinhador: 'ALIGN_MAX', redutor: 'REDUCE_SUM', dias: 3 })),
    tenta('storage', () => serie(token, 'storage.googleapis.com/storage/total_bytes', { alinhador: 'ALIGN_MAX', redutor: 'REDUCE_SUM', grupo: ['resource.label.bucket_name'], dias: 3 })),
    tenta('arquivos', () => serie(token, 'storage.googleapis.com/storage/object_count', { alinhador: 'ALIGN_MAX', redutor: 'REDUCE_SUM', grupo: ['resource.label.bucket_name'], dias: 3 })),
    tenta('saida do storage', () => serie(token, 'storage.googleapis.com/network/sent_bytes_count')),
    tenta('funcoes', () => serie(token, 'run.googleapis.com/request_count', { grupo: ['resource.label.service_name', 'metric.label.response_code_class'] }))
  ]);

  // funções: total e erros (5xx) por função nos 30 dias
  const funcoes = {};
  (run || []).forEach(s => {
    const n = s.rotulos.service_name || '?', classe = s.rotulos.response_code_class || '';
    const tot = Object.values(s.pontos).reduce((a, b) => a + b, 0);
    const f = (funcoes[n] = funcoes[n] || { total: 0, erros: 0 });
    f.total += tot; if (classe === '5xx') f.erros += tot;
  });
  const porBucket = (series) => Object.fromEntries((series || []).map(s => [s.rotulos.bucket_name || '?', ultimo(s.pontos)]));

  const dados = {
    gerado_em: new Date().toISOString(),
    firestore: { leituras: somaDias(leit || []), gravacoes: somaDias(grav || []), exclusoes: somaDias(excl || []), bytes: banco ? ultimo(somaDias(banco)) : null },
    storage: { bytes: porBucket(stBytes), objetos: porBucket(stObjs), saida: somaDias(stSaida || []) },
    funcoes, erros
  };
  cache = { em: Date.now(), dados };
  return dados;
});

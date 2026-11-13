// Visitantes que não se cadastram (nov/2026): de onde vêm e até onde chegam no funil, sem guardar IP, nome ou e-mail.
// O navegador manda pequenos avisos (sendBeacon) com um código anônimo aleatório (pde_vid no aparelho):
//   visita (abriu a página inicial ou o login) → login (viu a tela de entrar) → cadastro (entrou com Google e viu o formulário)
//   → muni (escolheu estado e município) → fim (concluiu o cadastro). "conta" = já tinha cadastro (sai da lista de quem não cadastrou).
// Região: pelo fuso horário do aparelho (ex.: America/Campo_Grande = MS). Cidade e UF exatas entram com a Cloudflare (cf.city).
// Grava visitantes/{vid} (um por aparelho) e visitas_dia/{dia} (contadores do dia). Só o admin lê (regras).
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ETAPAS = { visita: 1, login: 2, cadastro: 3, muni: 4, fim: 5, conta: 5 };
const ORIGENS = ['direto', 'instagram', 'facebook', 'google', 'whatsapp', 'youtube', 'tiktok', 'linkedin', 'bing', 'email', 'qrcode', 'senacop', 'outro'];
const FUSO_UF = {
  'America/Campo_Grande': 'MS', 'America/Cuiaba': 'MT', 'America/Porto_Velho': 'RO', 'America/Manaus': 'AM', 'America/Rio_Branco': 'AC',
  'America/Eirunepe': 'AM', 'America/Boa_Vista': 'RR', 'America/Belem': 'PA', 'America/Santarem': 'PA', 'America/Araguaina': 'TO',
  'America/Fortaleza': 'CE', 'America/Recife': 'PE', 'America/Maceio': 'AL', 'America/Bahia': 'BA', 'America/Noronha': 'PE'
};
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp\/|curl|wget|python|axios/i;
const t = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const chave = s => t(s, 40).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase() || 'x';

function regiao(tz){
  tz = t(tz, 40);
  if (FUSO_UF[tz]) return FUSO_UF[tz];
  if (tz === 'America/Sao_Paulo') return 'Horário de Brasília (SP, RJ, MG, PR, SC, RS, GO, DF, ES...)';
  if (/^America\//.test(tz)) return 'Outro país (Américas)';
  return tz ? 'Fora do Brasil' : 'Desconhecida';
}

export const visita = onRequest({ region: 'southamerica-east1', invoker: 'public', cors: false, memory: '256MiB', maxInstances: 5, timeoutSeconds: 15 }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const ua = String(req.get('user-agent') || ''), de = String(req.get('origin') || req.get('referer') || '');
  if (BOT.test(ua) || !/^https:\/\/([a-z0-9-]+\.)*portaldoeducador\.com\.br(\/|$)/.test(de)) { res.status(204).end(); return; }
  let d = null;
  try { d = JSON.parse(Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8').slice(0, 2000) : JSON.stringify(req.body || {})); } catch (e) { d = null; }
  const vid = d && String(d.v || ''), ev = d && String(d.e || '');
  if (!/^[a-z0-9]{12,32}$/.test(vid) || !ETAPAS[ev]) { res.status(204).end(); return; }
  try {
    const db = getFirestore(), dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
    const ref = db.doc(`visitantes/${vid}`), dRef = db.doc(`visitas_dia/${dia}`);
    const origem = ORIGENS.includes(d.o) ? d.o : 'outro', reg = regiao(d.tz), disp = d.m === 1 ? 'celular' : 'computador';
    const uf = /^[A-Z]{2}$/.test(String(d.uf || '')) ? d.uf : '', mun = t(d.mun, 60), ibge = /^\d{7}$/.test(String(d.ibge || '')) ? d.ibge : '';
    await db.runTransaction(async tx => {
      const s = await tx.get(ref), x = s.exists ? s.data() : null;
      // até 60 avisos por aparelho por dia (proteção contra abuso)
      const nDia = x && x.dia_n === dia ? (x.n_dia || 0) + 1 : 1;
      if (nDia > 60) return;
      const etapas = (x && x.etapas) || {}, novaEtapa = !etapas[ev], novoDia = !x || x.ultimo_dia !== dia;
      const up = { ultimo_em: FieldValue.serverTimestamp(), ultimo_dia: dia, dia_n: dia, n_dia: nDia, [`etapas.${ev}`]: true,
        etapa_max: Math.max((x && x.etapa_max) || 0, ETAPAS[ev]), regiao: reg, dispositivo: disp };
      if (!x) Object.assign(up, { primeiro_em: FieldValue.serverTimestamp(), primeiro_dia: dia, origem, pagina: t(d.p, 60) });
      else if ((!x.origem || x.origem === 'direto') && origem !== 'direto') up.origem = origem;
      if (uf) up.uf = uf;
      if (mun) up.municipio = mun;
      if (ibge) up.ibge = ibge;
      if (ev === 'fim' || ev === 'conta') up.cadastrou = true;
      else if (!x) up.cadastrou = false;
      if (novoDia) up.dias = FieldValue.increment(1);
      tx.set(ref, up, { merge: true });
      // contadores do dia: visitante único do dia (com origem, região e aparelho) e quem chegou pela 1ª vez a cada etapa
      const c = { dia, atualizado_em: FieldValue.serverTimestamp() };
      if (novoDia) { c.vis = FieldValue.increment(1); c[`o_${chave(x ? x.origem || origem : origem)}`] = FieldValue.increment(1); c[`r_${chave(reg)}`] = FieldValue.increment(1); c[`d_${disp}`] = FieldValue.increment(1); if (!x) c.novos = FieldValue.increment(1); }
      if (novaEtapa) c[`f_${ev}`] = FieldValue.increment(1);
      if (Object.keys(c).length > 2) tx.set(dRef, c, { merge: true });
    });
  } catch (e) { console.warn('visita', e && e.message); }
  res.status(204).end();
});

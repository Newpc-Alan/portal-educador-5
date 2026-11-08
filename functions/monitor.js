// Monitoramento (nov/2026): erros que acontecem no navegador dos professores e resumo diário para a NEWPC.
// - registrarErro: as páginas do Portal (assets/js/erros.js) mandam o erro; guarda o detalhe 30 dias e soma por dia e mensagem.
// - monitorResumoDiario: todo dia às 7h manda por e-mail os erros das últimas 24 h e a disponibilidade do mês
//   (medida pelo GitHub Actions, scripts/monitor-disponibilidade.mjs, gravada em stats/disponibilidade_AAAAMM).
// Nada aqui guarda dado pessoal além do uid de quem estava logado (para achar o caso), e o detalhe some em 30 dias.
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { SMTP_SENHA, emailAlerta } from './dicas.js';

const PARA = 'alan@newpc.com.br';
const ORIGEM_OK = /^https:\/\/([\w-]+\.)*portaldoeducador\.com\.br$/;
const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const diaBR = (ms = Date.now()) => new Date(ms - 4 * 3600e3).toISOString().slice(0, 10);
// ruído que não é defeito do Portal (extensões do navegador, avisos internos do Chrome)
const RUIDO = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|NotAllowedError: play\(\)|AbortError/i;
// freio simples por instância: no máximo 60 erros por minuto por IP
const janela = new Map();
function freio(ip) {
  const agora = Date.now(), m = Math.floor(agora / 60000), k = ip + '|' + m, n = (janela.get(k) || 0) + 1;
  janela.set(k, n); if (janela.size > 5000) janela.clear();
  return n > 60;
}

export const registrarErro = onRequest({ region: 'southamerica-east1', invoker: 'public', maxInstances: 3, timeoutSeconds: 10, memory: '256MiB' }, async (req, res) => {
  const origem = req.get('origin') || '';
  if (ORIGEM_OK.test(origem)) { res.set('Access-Control-Allow-Origin', origem); res.set('Vary', 'Origin'); }
  if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Content-Type'); res.status(204).send(''); return; }
  if (req.method !== 'POST' || !ORIGEM_OK.test(origem)) { res.status(403).send(''); return; }
  const ip = (req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
  if (freio(ip)) { res.status(429).send(''); return; }
  let d = req.body; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  d = d || {};
  const msg = txt(d.m, 300), fonte = txt(d.s, 200), pagina = txt(d.p, 120).replace(/[?#].*$/, '');
  if (!msg || RUIDO.test(msg) || RUIDO.test(fonte)) { res.status(204).send(''); return; }
  const db = getFirestore(), dia = diaBR();
  const chave = createHash('sha1').update(pagina + '|' + msg.replace(/\d+/g, '#')).digest('hex').slice(0, 16);
  await Promise.all([
    db.collection('erros_navegador').add({ msg, fonte, linha: Number(d.l) || 0, coluna: Number(d.c) || 0, pilha: txt(d.k, 1200), pagina, versao: txt(d.v, 40),
      uid: txt(d.u, 64).replace(/[^\w]/g, ''), navegador: txt(req.get('user-agent'), 200), dia, em: FieldValue.serverTimestamp() }),
    db.doc(`erros_resumo/${dia}_${chave}`).set({ dia, msg, pagina, fonte, n: FieldValue.increment(1), ultimo: FieldValue.serverTimestamp() }, { merge: true })
  ]).catch(e => console.warn('registrarErro', e.message));
  res.status(204).send('');
});

export const monitorResumoDiario = onSchedule({ schedule: '7 7 * * *', timeZone: 'America/Campo_Grande', region: 'southamerica-east1', secrets: [SMTP_SENHA], timeoutSeconds: 300, maxInstances: 1 }, async () => {
  const db = getFirestore(), ontem = diaBR(Date.now() - 86400000), hoje = diaBR();
  const [r1, r2] = await Promise.all([db.collection('erros_resumo').where('dia', '==', ontem).get(), db.collection('erros_resumo').where('dia', '==', hoje).get()]);
  const erros = [...r1.docs, ...r2.docs].map(d => d.data()).sort((a, b) => (b.n || 0) - (a.n || 0));
  const mes = ontem.slice(0, 7).replace('-', ''), dsp = (await db.doc(`stats/disponibilidade_${mes}`).get()).data() || {};
  const ver = dsp.verificacoes || 0, fal = dsp.falhas || 0, pct = ver ? ((ver - fal) / ver * 100) : null;
  // limpeza: detalhe dos erros com mais de 30 dias
  const velhos = await db.collection('erros_navegador').where('em', '<', Timestamp.fromMillis(Date.now() - 30 * 86400000)).limit(450).get();
  if (!velhos.empty) { const b = db.batch(); velhos.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
  const velhosR = await db.collection('erros_resumo').where('dia', '<', diaBR(Date.now() - 90 * 86400000)).limit(450).get();
  if (!velhosR.empty) { const b = db.batch(); velhosR.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
  const total = erros.reduce((n, e) => n + (e.n || 0), 0);
  const falhasHoje = (dsp.ultimas_falhas || []).filter(f => String(f.dia || '') >= ontem);
  // dia tranquilo: não manda e-mail
  if (!total && !falhasHoje.length) return;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linhas = erros.slice(0, 25).map(e => `<tr><td style="padding:6px;border-bottom:1px solid #e3e9ef;text-align:right"><b>${e.n}</b></td><td style="padding:6px;border-bottom:1px solid #e3e9ef">${esc(e.pagina)}</td><td style="padding:6px;border-bottom:1px solid #e3e9ef">${esc(e.msg)}</td></tr>`).join('');
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#0f2c4a;max-width:760px">
    <h2 style="margin:0 0 6px">Portal do Educador · monitoramento</h2>
    <p style="margin:0 0 14px;color:#5b6b7b">${esc(ontem)} e ${esc(hoje)}</p>
    <p><b>Disponibilidade do mês:</b> ${pct == null ? 'sem medição ainda' : pct.toFixed(2).replace('.', ',') + '% (' + (ver - fal) + ' de ' + ver + ' verificações ok)'}${pct != null && pct < 99.5 ? ' <b style="color:#c0392b">abaixo da meta de 99,5% do TR</b>' : ''}</p>
    ${falhasHoje.length ? '<p><b style="color:#c0392b">Falhas de disponibilidade:</b> ' + falhasHoje.slice(-10).map(f => esc(f.quando + ' · ' + f.o_que)).join('<br>') + '</p>' : ''}
    <p><b>Erros no navegador dos usuários:</b> ${total} ocorrência(s) em ${erros.length} tipo(s)</p>
    ${erros.length ? `<table style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#eef3f7"><th style="padding:6px">Vezes</th><th style="padding:6px;text-align:left">Página</th><th style="padding:6px;text-align:left">Erro</th></tr>${linhas}</table>` : ''}
    <p style="font-size:12px;color:#5b6b7b;margin-top:14px">Detalhes (navegador, linha, usuário) na coleção erros_navegador do Firestore, guardados por 30 dias.</p></div>`;
  await emailAlerta(PARA, `Portal · ${total} erro(s) no navegador${falhasHoje.length ? ' · ' + falhasHoje.length + ' falha(s) de disponibilidade' : ''}${pct != null ? ' · ' + pct.toFixed(1).replace('.', ',') + '% no mês' : ''}`, html);
});

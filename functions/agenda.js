// Minha agenda: avisos por e-mail dos lembretes do professor.
// 1) emailAgendaDia, todo dia às 6h30 (MS): adianta os lembretes que já passaram e manda UM e-mail por pessoa com o que tem hoje.
// 2) emailLembretes, a cada 15 minutos: avisa no horário (com a antecedência escolhida) os lembretes marcados "na hora".
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';
import CAL from './calendario-nucleo.js';

const LINK = 'https://app.portaldoeducador.com.br/apps/calendario/#agenda';
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dataBr = d => d.slice(8, 10) + '/' + d.slice(5, 7);
const quando = it => (it.hora ? it.hora : 'Dia todo');
const etiqueta = it => it.tipo === 'pessoal' ? '<span style="background:#f3e8fb;color:#6b3a99;border-radius:6px;padding:1px 6px;font-size:11px">Pessoal</span>' : '<span style="background:#e3f1fb;color:#1f5f91;border-radius:6px;padding:1px 6px;font-size:11px">Escola</span>';
const moldura = (titulo, corpo) => `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:600px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${esc(titulo)}</b><br><span style="color:#8DC63F;font-size:12px">Minha agenda · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}
<p style="margin:16px 0 0"><a href="${LINK}" style="display:inline-block;background:#2671AB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Abrir minha agenda</a></p>
<p style="font-size:11px;color:#8a97a6;margin:14px 0 0">Você recebe este aviso porque marcou o lembrete para avisar por e-mail. Para parar, edite o lembrete no Portal e escolha "Não avisar".</p></div></div>`;

// recalcula próxima data e próximo aviso de um lembrete a partir de um dia
function proximos(it, desde) {
  const proxima = CAL.proximaOcorrencia(it, desde);
  let aviso = null;
  if (it.avisar === 'hora') {
    // o aviso pode ser para a ocorrência de hoje (se ainda não foi avisada) ou a seguinte
    let d = proxima;
    for (let i = 0; d && i < 3; i++) { if (d !== it.avisado && CAL.instanteAviso(it, d) > Date.now() - 6 * 36e5) { aviso = Timestamp.fromMillis(CAL.instanteAviso(it, d)); break; } d = CAL.proximaOcorrencia(it, CAL.soma(d, 1)); }
  }
  return { proxima, proximo_aviso: aviso };
}
async function emailDe(db, uid, cache) {
  if (!(uid in cache)) { const u = (await db.doc(`usuarios/${uid}`).get()).data() || {}; cache[uid] = u.status === 'ativo' && u.email ? { email: String(u.email), nome: String(u.nome || '').split(' ')[0] } : null; }
  return cache[uid];
}

export const emailAgendaDia = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'America/Campo_Grande', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 300 },
  async () => {
    const db = getFirestore(), hoje = hojeMS();
    // 1) lembretes que ficaram para trás: avança para a próxima ocorrência (ou encerra)
    const velhos = await db.collectionGroup('lembretes').where('proxima', '<', hoje).limit(2000).get();
    let lote = db.batch(), n = 0;
    for (const d of velhos.docs) { lote.update(d.ref, proximos(d.data(), hoje)); if (++n % 400 === 0) { await lote.commit(); lote = db.batch(); } }
    if (n % 400) await lote.commit();
    // 2) o que tem hoje, agrupado por pessoa
    const s = await db.collectionGroup('lembretes').where('proxima', '==', hoje).limit(3000).get();
    const porUid = {};
    s.forEach(d => { const it = d.data(); if (it.avisar === 'nao') return; const uid = d.ref.parent.parent.id; (porUid[uid] = porUid[uid] || []).push(it); });
    const cache = {}, tr = transporte();
    for (const [uid, itens] of Object.entries(porUid)) {
      const u = await emailDe(db, uid, cache); if (!u) continue;
      itens.sort((a, b) => (a.hora || '00:00').localeCompare(b.hora || '00:00'));
      const linhas = itens.map(it => `<tr><td style="padding:7px 12px 7px 0;border-bottom:1px solid #eef2f6;font-weight:bold;white-space:nowrap;vertical-align:top">${esc(quando(it))}</td><td style="padding:7px 0;border-bottom:1px solid #eef2f6">${esc(it.titulo)} ${etiqueta(it)}${it.notas ? `<div style="color:#6b7c90;font-size:12px;margin-top:2px">${esc(it.notas)}</div>` : ''}</td></tr>`).join('');
      try {
        await tr.sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: u.email,
          subject: `Sua agenda de hoje (${dataBr(hoje)}): ${itens.length} lembrete${itens.length > 1 ? 's' : ''}`,
          html: moldura(`Bom dia${u.nome ? ', ' + u.nome : ''}! Hoje, ${dataBr(hoje)}:`, `<table style="border-collapse:collapse;width:100%;font-size:14px">${linhas}</table>`) });
      } catch (err) { console.error('emailAgendaDia', uid, err.message); }
    }
    console.log('emailAgendaDia', { avancados: n, pessoas: Object.keys(porUid).length });
  }
);

export const emailLembretes = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/Campo_Grande', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 120 },
  async () => {
    const db = getFirestore(), agora = Timestamp.now();
    const s = await db.collectionGroup('lembretes').where('proximo_aviso', '<=', agora).limit(300).get();
    if (s.empty) return;
    const cache = {}, tr = transporte();
    for (const d of s.docs) {
      const it = d.data(), uid = d.ref.parent.parent.id;
      // qual ocorrência este aviso cobre: a que tem o instante mais próximo de agora
      const desde = CAL.soma(hojeMS(), -2), dia = CAL.ocorrencias(it, desde, CAL.soma(hojeMS(), 2)).find(x => Math.abs(CAL.instanteAviso(it, x) - it.proximo_aviso.toMillis()) < 60000);
      const atrasado = Date.now() - it.proximo_aviso.toMillis() > 6 * 36e5;
      if (it.avisar === 'hora' && dia && !atrasado && dia !== it.avisado && !(it.feitos || []).includes(dia)) {
        const u = await emailDe(db, uid, cache);
        if (u) {
          const ant = it.antes_min === 1440 ? 'amanhã' : it.antes_min === 60 ? 'em 1 hora' : it.antes_min === 15 ? 'em 15 minutos' : 'agora';
          try {
            await tr.sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: u.email,
              subject: `Lembrete: ${String(it.titulo).slice(0, 80)} · ${dataBr(dia)}${it.hora ? ' às ' + it.hora : ''}`,
              html: moldura(`Lembrete ${ant}`, `<p style="font-size:18px;margin:0 0 6px"><b>${esc(it.titulo)}</b> ${etiqueta(it)}</p>
<p style="margin:0 0 10px;color:#2C3E55">${dataBr(dia)}${it.hora ? ' às ' + esc(it.hora) : ' (dia todo)'}</p>${it.notas ? `<p style="white-space:pre-line;background:#f6f9fc;border-radius:8px;padding:10px 12px;margin:0">${esc(it.notas)}</p>` : ''}`) });
          } catch (err) { console.error('emailLembretes', uid, err.message); continue; }
        }
      }
      const marcado = { ...it, avisado: dia || it.avisado || null };
      await d.ref.update({ avisado: marcado.avisado, ...proximos(marcado, CAL.soma(dia || hojeMS(), 0)) , proxima: CAL.proximaOcorrencia(it, hojeMS()) });
    }
  }
);

// Frequência digital.
// 1) freqResumo: a cada chamada gravada, refaz o dia da turma e os totais de cada aluno em freq_resumo/{turma}_{ano}.
//    Quem lê o resumo: gestor da escola (busca ativa, com nomes), professores da escola e o Painel (só números).
// 2) emailBuscaAtiva: toda segunda-feira, um e-mail para cada gestor com os alunos que precisam de busca ativa.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';
import * as FREQ from './frequencia-nucleo.js';

const ID = /^[A-Za-z0-9_-]{1,80}$/, DATA = /^20\d\d-[01]\d-[0-3]\d$/;
const LINK = 'https://app.portaldoeducador.com.br/apps/frequencia/#busca';

export const freqResumo = onDocumentWritten(
  { document: 'freq_chamadas/{id}', region: REGIAO_FIRESTORE, timeoutSeconds: 60, maxInstances: 10 },
  async (event) => {
    const x = (event.data.after && event.data.after.exists ? event.data.after.data() : null) || (event.data.before && event.data.before.data());
    if (!x || !ID.test(String(x.turma_id || '')) || !DATA.test(String(x.dia || ''))) return;
    const T = String(x.turma_id), D = String(x.dia), ano = +D.slice(0, 4), db = getFirestore();
    let freqMin = 75;
    if (ID.test(String(x.municipio_id || ''))) { const r = (await db.doc(`notas_regras/${x.municipio_id}`).get()).data(); if (r && Number(r.freq_minima) > 0) freqMin = Number(r.freq_minima); }
    const ref = db.doc(`freq_resumo/${T}_${ano}`);
    await db.runTransaction(async tx => {
      const [r, s] = await Promise.all([tx.get(ref), tx.get(db.collection('freq_chamadas').where('turma_id', '==', T).where('dia', '==', D))]);
      const chamadas = s.docs.map(d => d.data()).filter(c => c.ano === ano);
      const out = FREQ.aplicarDia(r.exists ? r.data() : null, D, chamadas, freqMin);
      const ult = chamadas[chamadas.length - 1] || x;
      tx.set(ref, { ...out, turma_id: T, turma_nome: String(ult.turma_nome || (r.exists && r.data().turma_nome) || '').slice(0, 80),
        escola_id: String(ult.escola_id || ''), municipio_id: String(ult.municipio_id || ''), ano, atualizado_em: FieldValue.serverTimestamp() });
    });
  }
);

const pct = v => v === null || v === undefined ? '–' : String(v).replace('.', ',') + '%';
const dataBr = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '–';

export const emailBuscaAtiva = onSchedule(
  { schedule: '40 6 * * 1', timeZone: 'America/Campo_Grande', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 300 },
  async () => {
    const db = getFirestore(), ano = +new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric' }).format(new Date());
    const s = await db.collection('freq_resumo').where('ano', '==', ano).where('alerta', '==', true).limit(3000).get();
    const porEscola = {};
    s.forEach(d => { const r = d.data(); if (r.escola_id) (porEscola[r.escola_id] = porEscola[r.escola_id] || []).push(r); });
    if (!Object.keys(porEscola).length) { console.log('emailBuscaAtiva: nada a enviar'); return; }
    const nomes = {};
    await Promise.all(Object.keys(porEscola).map(async id => { const e = (await db.doc(`escolas/${id}`).get()).data(); nomes[id] = (e && e.nome) || 'Escola'; }));
    const gest = await db.collection('usuarios').where('perfil', '==', 'gestor').where('status', '==', 'ativo').get();
    const tr = transporte(); let enviados = 0;
    for (const g of gest.docs) {
      const u = g.data(); if (!u.email) continue;
      const minhas = (Array.isArray(u.escolas_ids) && u.escolas_ids.length ? u.escolas_ids : [u.escola_id]).filter(id => id && porEscola[id]);
      if (!minhas.length) continue;
      let corpo = '', total = 0;
      for (const id of minhas) {
        const lista = FREQ.emRisco(porEscola[id]); if (!lista.length) continue; total += lista.length;
        const linhas = lista.slice(0, 60).map(a => `<tr><td style="padding:6px 10px 6px 0;border-bottom:1px solid #eef2f6"><b>${esc(a.nome || 'Aluno')}</b><div style="color:#6b7c90;font-size:12px">${esc(a.turma)}</div></td>
<td style="padding:6px 10px;border-bottom:1px solid #eef2f6;text-align:right;color:${a.risco ? '#C2362C' : '#0c2338'};font-weight:bold">${pct(a.freq)}</td>
<td style="padding:6px 10px;border-bottom:1px solid #eef2f6;text-align:right">${a.seguidos >= 3 ? `<span style="background:#fff3d6;color:#8a5a00;border-radius:6px;padding:1px 6px">${a.seguidos} dias seguidos</span>` : '–'}</td>
<td style="padding:6px 0;border-bottom:1px solid #eef2f6;text-align:right;color:#6b7c90">${dataBr(a.ultima)}</td></tr>`).join('');
        corpo += `<p style="margin:18px 0 6px;font-size:15px"><b>${esc(nomes[id])}</b> · ${lista.length} aluno${lista.length > 1 ? 's' : ''}</p>
<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="color:#6b7c90;font-size:11px;text-transform:uppercase"><td>Aluno</td><td style="text-align:right">Frequência</td><td style="text-align:right">Faltas seguidas</td><td style="text-align:right">Última falta</td></tr>${linhas}</table>
${lista.length > 60 ? `<p style="color:#6b7c90;font-size:12px">+ ${lista.length - 60} alunos no Portal.</p>` : ''}`;
      }
      if (!total) continue;
      const nome = String(u.nome || '').split(' ')[0];
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Busca ativa da semana: ${total} aluno${total > 1 ? 's' : ''}</b><br><span style="color:#8DC63F;font-size:12px">Frequência digital · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="margin:0 0 6px">Bom dia${nome ? ', ' + esc(nome) : ''}! Estes alunos estão abaixo da frequência mínima da rede ou faltaram ${FREQ.DIAS_SEGUIDOS} dias ou mais seguidos, sem justificativa, nas chamadas lançadas pelos professores.</p>
${corpo}
<p style="margin:18px 0 0"><a href="${LINK}" style="display:inline-block;background:#2671AB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Abrir a busca ativa</a></p>
<p style="font-size:11px;color:#8a97a6;margin:14px 0 0">Dados de alunos: uso restrito à gestão da escola (LGPD). Você recebe este resumo por ser gestor(a) cadastrado(a) no Portal do Educador.</p></div></div>`;
      try {
        await tr.sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: String(u.email), subject: `Busca ativa: ${total} aluno${total > 1 ? 's' : ''} com faltas para acompanhar`, html });
        enviados++;
      } catch (err) { console.error('emailBuscaAtiva', g.id, err.message); }
    }
    console.log('emailBuscaAtiva', { escolas: Object.keys(porEscola).length, enviados });
  }
);

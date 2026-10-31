// Novidades da rede (Portal IA): quando um professor compartilha um material com a rede do município,
// o resumo rede_feed/{municipio} guarda os 10 últimos. O Início do professor lê só esse documento (1 leitura por login)
// e o resumo diário por e-mail sai no fim da tarde para professores e gestores ativos da rede, só quando houve novidade.
// Quem não quiser o e-mail desliga no cartão do Início (usuarios.resumo_rede = false, gravado pela função portalIa).
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';

const APP = 'https://app.portaldoeducador.com.br';
const LOTE = 50;   // destinatários por e-mail (cópia oculta)

// coloca (ou tira) um material no resumo da rede; os mais novos primeiro, no máximo 10
export async function feedRede(db, mun, item, removerId) {
  if (!mun) return;
  const ref = db.doc(`rede_feed/${mun}`), id = item ? item.id : removerId;
  await db.runTransaction(async t => {
    const s = await t.get(ref);
    let itens = s.exists && Array.isArray(s.data().itens) ? s.data().itens : [];
    itens = itens.filter(x => x && x.id !== id);
    if (item) itens.unshift({ ...item, em: Timestamp.now() });
    t.set(ref, { itens: itens.slice(0, 10), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  });
}

const caixa = (titulo, sub, corpo) => `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${titulo}</b><br><span style="color:#8DC63F;font-size:12px">${sub}</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}</div></div>`;

function htmlResumo(nomeMun, novos) {
  const linhas = novos.map(x => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f6">
<a href="${APP}/apps/portal-ia/?rede=${encodeURIComponent(x.id)}" style="color:#0f2c4a;font-weight:bold;font-size:15px;text-decoration:none">${esc(x.titulo || 'Material')}</a><br>
<span style="color:#5b6b7b;font-size:12.5px">${esc([x.tipo_nome, x.disciplina, x.serie].filter(Boolean).join(' · '))}</span><br>
<span style="color:#1a6b2a;font-size:12.5px">${x.atualizado ? 'Atualizado' : 'Compartilhado'} por ${esc(x.autor_nome || 'um(a) colega')}${x.escola_nome ? ', ' + esc(x.escola_nome) : ''}</span></td></tr>`).join('');
  return caixa(`${novos.length === 1 ? 'Um material novo' : novos.length + ' materiais novos'} na sua rede`, 'Portal do Educador · ' + esc(nomeMun || 'sua rede'),
    `<p style="margin:0 0 6px">Colegas da sua rede compartilharam hoje no Portal IA. É só abrir, usar uma cópia e ajustar para a sua turma.</p>
<table style="width:100%;border-collapse:collapse">${linhas}</table>
<p style="margin:16px 0 0"><a href="${APP}/apps/portal-ia/?rede=todos" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Ver todos os materiais da rede</a></p>
<p style="margin:18px 0 0;color:#8a98a6;font-size:11.5px">Você recebe este resumo porque é professor(a) da rede no Portal do Educador. Para não receber mais, entre no Portal e desligue em "Novidades da sua rede", no Início.</p>`);
}

// monta e envia os resumos; "so" limita a um município e "para" troca os destinatários (teste do administrador)
export async function resumoRede({ so = '', para = null, desde = null } = {}) {
  const db = getFirestore(), agora = Timestamp.now(), out = [];
  const feeds = so ? [await db.doc(`rede_feed/${so}`).get()] : (await db.collection('rede_feed').get()).docs;
  for (const f of feeds) {
    if (!f.exists) continue;
    const d = f.data(), corte = desde || (d.resumo_ate ? d.resumo_ate.toMillis() : Date.now() - 864e5);
    const novos = (d.itens || []).filter(x => x && x.em && x.em.toMillis() > corte);
    if (!novos.length) { out.push(f.id + ': sem novidade'); continue; }
    let dest = para;
    if (!dest) {
      const us = await db.collection('usuarios').where('municipio_id', '==', f.id).get();
      dest = []; us.forEach(u => { const x = u.data(); if (x.status === 'ativo' && ['professor', 'gestor'].includes(x.perfil) && x.resumo_rede !== false && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email || '')) dest.push(x.email); });
    }
    const mu = await db.doc(`municipios/${f.id}`).get(), nomeMun = mu.exists ? mu.data().nome : '';
    const html = htmlResumo(nomeMun, novos), assunto = (novos.length === 1 ? 'Novo material na sua rede: ' + novos[0].titulo : novos.length + ' materiais novos na sua rede') .slice(0, 140);
    let enviados = 0;
    for (let i = 0; i < dest.length; i += LOTE) {
      const lote = dest.slice(i, i + LOTE);
      try { await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, bcc: lote, subject: assunto, html }); enviados += lote.length; }
      catch (e) { console.error('resumoRede', f.id, e.message); }
    }
    if (!para) await f.ref.set({ resumo_ate: agora, ultimo_resumo: { em: agora, materiais: novos.length, destinatarios: enviados } }, { merge: true });
    out.push(f.id + ': ' + novos.length + ' material(is), ' + enviados + ' destinatário(s)');
  }
  console.log('resumoRede', out.join(' | '));
  return out;
}

export const resumoRedeDiario = onSchedule({ region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], schedule: '0 18 * * 1-6', timeZone: 'America/Campo_Grande', timeoutSeconds: 540, memory: '512MiB' },
  () => resumoRede());

// teste do administrador: manda o resumo das últimas 72 h de uma rede só para o e-mail dele (não marca como enviado)
export const resumoRedeTeste = onCall({ region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 60 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const eu = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data() || {};
  if (eu.perfil !== 'admin' || eu.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador.');
  const mun = String((req.data && req.data.municipio) || '').slice(0, 60);
  if (!mun) throw new HttpsError('invalid-argument', 'Informe o município.');
  return { ok: true, r: await resumoRede({ so: mun, para: [eu.email], desde: Date.now() - 3 * 864e5 }) };
});

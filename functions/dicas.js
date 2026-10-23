// Dicas do Professor: cada envio novo em dicas_envios dispara um e-mail para a equipe do Portal.
// A senha de app do remetente fica no Secret Manager (SMTP_SENHA), nunca no código.
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import nodemailer from 'nodemailer';

const SMTP_SENHA = defineSecret('SMTP_SENHA');
const SMTP_USUARIO = defineString('SMTP_USUARIO', { default: 'suporte@portaldoeducador.com.br' });
const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
const DESTINO = defineString('DICAS_DESTINO', { default: 'suporte@portaldoeducador.com.br' });
const REGIAO_FIRESTORE = 'southamerica-east1';

const TIPOS = { dica: 'Dica de aula', app: 'Aplicativo ou site', material: 'Material', atividade: 'Atividade' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tam = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

export const emailDicaProfessor = onDocumentCreated(
  { document: 'dicas_envios/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], memory: '512MiB', timeoutSeconds: 120 },
  async (event) => {
    const snap = event.data; if (!snap) return;
    const d = snap.data(), id = event.params.id;
    const ref = getFirestore().doc(`dicas_envios/${id}`);
    try {
      const anexos = []; let total = 0; const fora = [];
      for (const a of (d.arquivos || []).slice(0, 5)) {
        if (!a || typeof a.path !== 'string' || !a.path.startsWith(`dicas/${d.autor_uid}/${id}/`)) continue;
        if (total + (a.tamanho || 0) > 20 * 1048576) { fora.push(a); continue; }
        const [buf] = await getStorage().bucket().file(a.path).download();
        total += buf.length; anexos.push({ filename: a.nome || 'arquivo', content: buf, contentType: a.tipo || undefined });
      }
      const links = (d.links || []).map(u => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('');
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Nova dica do professor</b><br><span style="color:#8DC63F;font-size:12px">Portal do Educador 5.0</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="font-size:18px;margin:0 0 6px"><b>${esc(d.titulo)}</b></p>
<p style="margin:0 0 14px;color:#6b7c90">${esc(TIPOS[d.tipo] || d.tipo)}${d.disciplina ? ' · ' + esc(d.disciplina) : ''}${d.etapa ? ' · ' + esc(d.etapa) : ''}</p>
<p style="white-space:pre-line;margin:0 0 14px">${esc(d.texto)}</p>
${links ? `<p style="margin:0 0 4px"><b>Links</b></p><ul style="margin:0 0 14px">${links}</ul>` : ''}
${anexos.length ? `<p style="margin:0 0 14px"><b>Anexos:</b> ${anexos.length} arquivo(s) neste e-mail.</p>` : ''}
${fora.length ? `<p style="margin:0 0 14px;color:#9a5b00">${fora.length} arquivo(s) grande(s) ficaram só no Portal: ${fora.map(a => esc(a.nome) + ' (' + tam(a.tamanho || 0) + ')').join(', ')}.</p>` : ''}
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
<tr><td style="color:#6b7c90;padding:2px 12px 2px 0">Professor(a)</td><td>${esc(d.autor_nome)} &lt;${esc(d.autor_email)}&gt;</td></tr>
<tr><td style="color:#6b7c90;padding:2px 12px 2px 0">Escola</td><td>${esc([d.escola_nome, d.municipio_nome].filter(Boolean).join(' · ') || 'não informada')}</td></tr>
<tr><td style="color:#6b7c90;padding:2px 12px 2px 0">Publicar com nome</td><td>${d.credito === false ? 'Não' : 'Sim'}</td></tr>
</table>
<a href="https://app.portaldoeducador.com.br/dicas/#recebidas" style="display:inline-block;background:#5A9420;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Revisar e publicar no Portal</a>
<p style="font-size:12px;color:#6b7c90;margin:16px 0 0">Responda este e-mail para falar direto com o professor.</p>
</div></div>`;
      const t = nodemailer.createTransport({ host: SMTP_HOST.value(), port: 465, secure: true, auth: { user: SMTP_USUARIO.value(), pass: SMTP_SENHA.value() } });
      await t.sendMail({
        from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`,
        to: DESTINO.value(),
        replyTo: d.autor_email ? `"${String(d.autor_nome || '').replace(/["\r\n]/g, '')}" <${d.autor_email}>` : undefined,
        subject: `Nova dica do professor: ${String(d.titulo || '').replace(/[\r\n]/g, ' ').slice(0, 120)}`,
        html, attachments: anexos
      });
      await ref.update({ email_status: 'enviado', email_em: FieldValue.serverTimestamp() });
    } catch (e) {
      console.error('emailDicaProfessor', id, e);
      await ref.update({ email_status: 'falhou', email_erro: String(e && e.message || e).slice(0, 300) }).catch(() => {});
    }
  }
);

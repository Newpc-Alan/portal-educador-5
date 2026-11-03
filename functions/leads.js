// "Quero isso na minha escola" (nov/2026): o professor em teste ou avulso toca num recurso que a Secretaria contrata
// (Gestão Escolar, Central de Relatórios, Portal 360º VR, Portal Maestro) e pede o Portal para a escola dele.
//   leads_portal/{id}   o pedido (só o administrador lê; só esta função grava)
// O comercial recebe um e-mail na hora. O pedido do Portal 360º VR vai marcado como lead de sala de realidade virtual.
// Só com o "Autorizo o contato" marcado (LGPD). No máximo 1 pedido por recurso por pessoa a cada 24 h.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO } from './dicas.js';
import { expiraAuditoria } from './auditoria.js';

export const RECURSOS_LEAD = {
  gestao: 'Gestão Escolar', relatorios: 'Central de Relatórios', portal360: 'Portal 360º VR', maestro: 'Portal Maestro'
};
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export const leadEscola = onCall({ region: 'southamerica-east1', secrets: [SMTP_SENHA], maxInstances: 5, timeoutSeconds: 30 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const d = req.data || {}, db = getFirestore(), uid = req.auth.uid;
  const modulo = String(d.modulo || ''), escola = txt(d.escola, 120), municipio = txt(d.municipio, 80);
  if (!RECURSOS_LEAD[modulo]) throw new HttpsError('invalid-argument', 'Recurso inválido.');
  if (d.autorizo !== true) throw new HttpsError('failed-precondition', 'Marque a autorização de contato para enviar o pedido.');
  if (escola.length < 3 || municipio.length < 2) throw new HttpsError('invalid-argument', 'Informe a escola e o município.');
  const u = (await db.doc('usuarios/' + uid).get()).data() || {};
  if (u.status !== 'ativo' || u.perfil !== 'professor') throw new HttpsError('permission-denied', 'Pedido disponível para professores.');
  // 1 pedido por recurso por pessoa a cada 24 h (o botão não vira fonte de spam para o comercial)
  const chave = uid + '_' + modulo, ref = db.doc('leads_portal/' + chave), atual = await ref.get();
  const ultimo = atual.exists && atual.data().em ? atual.data().em.toMillis() : 0;
  if (ultimo && Date.now() - ultimo < 864e5) return { ok: true, repetido: true };
  const vr = modulo === 'portal360';
  const lead = { uid, nome: txt(u.nome, 120), email: txt(u.email, 120), whatsapp: txt(u.whatsapp || u.telefone, 30), licenca: txt(u.licenca_tipo, 20),
    modulo, recurso: RECURSOS_LEAD[modulo], tipo: vr ? 'sala_vr' : 'portal', escola, municipio, autorizou_contato: true,
    status: 'novo', em: FieldValue.serverTimestamp(), pedidos: FieldValue.increment(1) };
  await ref.set(lead, { merge: true });
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'criou', origem: 'funcao', colecao: 'leads_portal', doc: chave,
    autor_uid: uid, autor_tipo: 'usuario', autor_email: lead.email, perfil: 'professor', detalhe: 'Pedido "Quero na minha escola": ' + lead.recurso + ' · ' + municipio, campos: [], valores: {} }).catch(() => {});
  // e-mail para o comercial (wa_config/geral.comercial_emails, se houver; senão a lista padrão da NEWPC)
  try {
    const cfg = (await db.doc('wa_config/geral').get()).data() || {};
    const para = Array.isArray(cfg.comercial_emails) && cfg.comercial_emails.length ? cfg.comercial_emails : destinos();
    const linha = (k, v) => v ? `<tr><td style="padding:4px 10px 4px 0;color:#5b6b7c">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>` : '';
    await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: para.join(','), replyTo: lead.email || undefined,
      subject: (vr ? '[Lead sala VR] ' : '[Lead Portal] ') + lead.recurso + ' · ' + escola + ' (' + municipio + ')',
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:600px">
<div style="background:#0f2c4a;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Quero isso na minha escola</b><br><span style="color:#8DC63F;font-size:12px">${vr ? 'Lead de sala de realidade virtual (kit de óculos, carrinho e treinamento)' : 'Lead comercial do Portal do Educador'}</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p>Um professor ${lead.licenca === 'teste' ? 'em teste' : 'avulso'} pediu <b>${esc(lead.recurso)}</b> para a escola dele.</p>
<table style="font-size:14px">${linha('Professor', lead.nome)}${linha('E-mail', lead.email)}${linha('WhatsApp', lead.whatsapp)}${linha('Escola', escola)}${linha('Município', municipio)}${linha('Licença', lead.licenca)}</table>
<p style="color:#5b6b7c;font-size:12.5px">Ele autorizou o contato da NEWPC com ele e com a escola. Responda este e-mail para falar direto com ele.</p></div></div>` });
  } catch (e) { console.error('lead e-mail:', e.message); }
  return { ok: true };
});

// Recursos da escola: avisa a equipe NEWPC e a direção da escola quando alguém abre um chamado pela etiqueta QR do equipamento.
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';

const linha = (k, v) => v ? `<tr><td style="color:#6b7c90;padding:3px 14px 3px 0;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>` : '';

// e-mails dos gestores ativos da escola (cadastros novos têm escolas_ids; os antigos só escola_id)
async function gestoresDaEscola(escolaId) {
  const db = getFirestore(), emails = new Set();
  const consultas = [
    db.collection('usuarios').where('escolas_ids', 'array-contains', escolaId).get(),
    db.collection('usuarios').where('escola_id', '==', escolaId).get()
  ];
  for (const s of await Promise.all(consultas)) s.forEach(d => { const u = d.data(); if (u.perfil === 'gestor' && u.status === 'ativo' && u.email) emails.add(String(u.email).toLowerCase()); });
  return [...emails].slice(0, 10);
}

export const emailChamadoTecnico = onDocumentCreated(
  { document: 'rec_chamados/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 60 },
  async (event) => {
    const c = event.data && event.data.data(); if (!c) return;
    try {
      const db = getFirestore();
      const e = c.escola_id ? (await db.doc(`escolas/${c.escola_id}`).get()).data() || {} : { nome: 'Estoque (ainda não entregue)' };
      const m = (await db.doc(`municipios/${c.municipio_id}`).get()).data() || {};
      const protocolo = String(event.params.id).slice(-6).toUpperCase();
      // prazo do SLA pelo contrato ligado ao equipamento
      const it = c.item_id ? (await db.doc(`rec_itens/${c.item_id}`).get()).data() || {} : {};
      const ct = it.contrato_id ? (await db.doc(`rec_contratos/${it.contrato_id}`).get()).data() || null : null;
      const ini = c.criado_em && typeof c.criado_em.toMillis === 'function' ? c.criado_em.toMillis() : Date.now();
      const fmt = h => new Date(ini + h * 36e5).toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande', dateStyle: 'short', timeStyle: 'short' });
      const prazo = ct && ct.sla_atendimento_h ? `atender até ${fmt(ct.sla_atendimento_h)} · resolver até ${fmt(ct.sla_solucao_h || ct.sla_atendimento_h)} (contrato ${ct.numero})` : '';
      const zap = String(c.contato || '').replace(/\D/g, '');
      const corpo = `<p style="font-size:18px;margin:0 0 4px"><b>${esc(c.problema)}</b></p>
<p style="margin:0 0 12px;color:#2C3E55">${esc(c.item_nome)}${c.patrimonio ? ' · ' + esc(c.patrimonio) : ''}</p>
${c.descricao ? `<p style="white-space:pre-line;background:#f6f9fc;border-radius:8px;padding:10px 12px;margin:0 0 14px">${esc(c.descricao)}</p>` : ''}
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
${linha('Protocolo', protocolo)}${linha('Escola', e.nome)}${linha('Município', [m.nome, m.uf].filter(Boolean).join('/'))}${linha('Onde fica', c.local)}
${linha('Aberto por', `${c.nome} (${c.funcao})`)}${linha('WhatsApp', c.contato)}${linha('Série', it.serie)}${linha('Prazo (SLA)', prazo)}</table>
${zap.length >= 10 ? `<p style="margin:0 0 14px"><a href="https://wa.me/55${zap.replace(/^55/, '')}" style="color:#2671AB">Responder pelo WhatsApp</a></p>` : ''}`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Novo chamado técnico</b><br><span style="color:#8DC63F;font-size:12px">Recursos da Escola · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}
<a href="https://app.portaldoeducador.com.br/apps/recursos/#chamados" style="display:inline-block;background:#5A9420;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Abrir os chamados</a></div></div>`;
      const para = [...new Set([...destinos(), ...(c.escola_id ? await gestoresDaEscola(c.escola_id) : [])])];
      await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: para,
        subject: `Chamado ${protocolo}: ${String(c.problema || '').slice(0, 40)} · ${String(c.item_nome || '').slice(0, 50)} · ${String(e.nome || '').slice(0, 60)}`, html });
    } catch (err) { console.error('emailChamadoTecnico', event.params.id, err); }
  }
);

// Portal do Educador TV: avisa a equipe NEWPC por e-mail quando uma TV é conectada e quando a secretaria publica um comunicado.
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';

const ORI = { auto: 'Automática', h: 'Horizontal', v: 'Vertical (totem)' };
const quando = v => v && typeof v.toDate === 'function' ? v.toDate().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande', dateStyle: 'short', timeStyle: 'short' }) : '';
const linha = (k, v) => v ? `<tr><td style="color:#6b7c90;padding:3px 14px 3px 0;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>` : '';
const moldura = (titulo, corpo, botao, link) => `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${esc(titulo)}</b><br><span style="color:#8DC63F;font-size:12px">Portal do Educador TV</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}
<a href="${link}" style="display:inline-block;background:#5A9420;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">${esc(botao)}</a></div></div>`;
async function nomeMunicipio(id) { if (!id) return ''; const m = (await getFirestore().doc(`municipios/${id}`).get()).data() || {}; return [m.nome, m.uf].filter(Boolean).join('/'); }

export const emailTvConectada = onDocumentCreated(
  { document: 'tv_telas/{chave}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 60 },
  async (event) => {
    const t = event.data && event.data.data(); if (!t) return;
    try {
      const muni = await nomeMunicipio(t.municipio_id);
      const corpo = `<p style="font-size:18px;margin:0 0 12px"><b>${esc(t.nome)}</b></p><table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
${linha('Escola', t.escola_nome)}${linha('Município', muni)}${linha('Formato', ORI[t.orientacao] || t.orientacao)}${linha('Conectada por', t.criado_nome)}${linha('Quando', quando(t.criado_em))}</table>`;
      await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: destinos(),
        subject: `Nova TV conectada: ${String(t.nome || '').slice(0, 60)} · ${String(t.escola_nome || '').slice(0, 60)}`,
        html: moldura('Nova TV conectada', corpo, 'Abrir o painel das TVs', 'https://app.portaldoeducador.com.br/apps/tv/') });
    } catch (e) { console.error('emailTvConectada', event.params.chave, e); }
  }
);

export const emailComunicadoTv = onDocumentUpdated(
  { document: 'tv_canais/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA], timeoutSeconds: 60 },
  async (event) => {
    const antes = new Set(((event.data.before.data() || {}).avisos || []).map(a => a && a.id));
    const depois = event.data.after.data() || {};
    const novos = (depois.avisos || []).filter(a => a && a.id && !antes.has(a.id));
    if (!novos.length) return;
    try {
      const muni = await nomeMunicipio(depois.municipio_id);
      for (const a of novos.slice(0, 5)) {
        const corpo = `<p style="font-size:18px;margin:0 0 6px"><b>${esc(a.titulo)}</b></p><p style="white-space:pre-line;margin:0 0 14px">${esc(a.texto)}</p>
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">${linha('Município', muni)}${linha('Escolas', a.escolas && a.escolas.length ? a.escolas.length + ' escola(s) escolhida(s)' : 'Todas as escolas da rede')}
${linha('Início', quando(a.inicio) || 'imediato')}${linha('Fim', quando(a.fim) || 'sem data de fim')}${linha('Publicado por', a.criado_nome)}</table>
${a.imagem_url ? `<p style="margin:0 0 14px"><img src="${esc(a.imagem_url)}" alt="" style="max-width:100%;border-radius:8px"></p>` : ''}`;
        await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: destinos(),
          subject: `Comunicado nas TVs (${muni || 'rede'}): ${String(a.titulo || '').replace(/[\r\n]/g, ' ').slice(0, 100)}`,
          html: moldura('Novo comunicado nas TVs da rede', corpo, 'Ver os comunicados', 'https://app.portaldoeducador.com.br/apps/tv/#avisos') });
      }
    } catch (e) { console.error('emailComunicadoTv', event.params.id, e); }
  }
);

// Avisos por e-mail para a equipe: novos cadastros (usuarios) e Dicas do Professor (dicas_envios).
// A senha de app do remetente fica no Secret Manager (SMTP_SENHA), nunca no código.
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import nodemailer from 'nodemailer';

const SMTP_SENHA = defineSecret('SMTP_SENHA');
const SMTP_USUARIO = defineString('SMTP_USUARIO', { default: 'suporte@portaldoeducador.com.br' });
const SMTP_HOST = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
const DESTINO = defineString('NOTIFICAR_EMAILS', { default: 'alan@newpc.com.br,leonardo@newpc.com.br,stefano@newpc.com.br,suporte@newpc.com.br' });
const REGIAO_FIRESTORE = 'southamerica-east1';

const TIPOS = { dica: 'Dica de aula', app: 'Aplicativo ou site', material: 'Material', atividade: 'Atividade' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const destinos = () => DESTINO.value().split(',').map(x => x.trim()).filter(Boolean);
const transporte = () => nodemailer.createTransport({ host: SMTP_HOST.value(), port: 465, secure: true, auth: { user: SMTP_USUARIO.value(), pass: SMTP_SENHA.value() } });
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
      await transporte().sendMail({
        from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`,
        to: destinos(),
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

const ORIGENS = { autocadastro: 'Teste grátis (cadastro pelo site)', pre_cadastro: 'Primeiro acesso de importado pela rede' };
const linha = (k, v) => v ? `<tr><td style="color:#6b7c90;padding:3px 14px 3px 0;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>` : '';
const dataBR = v => v && typeof v.toDate === 'function' ? v.toDate().toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' }) : '';

export const emailNovoCadastro = onDocumentCreated(
  { document: 'usuarios/{uid}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async (event) => {
    const snap = event.data; if (!snap) return;
    const u = snap.data(), uid = event.params.uid;
    // aluno nao gera e-mail individual (podem ser milhares no inicio do ano): entra no resumo diario
    if (u.perfil === 'aluno') return;
    // usuarios da rede de demonstracao (scripts/demo-rede.mjs) nao geram aviso
    if (u.demo === true || uid.startsWith('demo-')) return;
    const ref = getFirestore().doc(`usuarios/${uid}`);
    const whats = String(u.whatsapp || '').replace(/\D/g, '');
    const local = [u.municipio_nome || u.municipio_cad, u.uf].filter(Boolean).join('/');
    const escola = (u.escolas_nomes && u.escolas_nomes.length ? u.escolas_nomes.join(', ') : u.escola_texto) || '';
    try {
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Novo cadastro no Portal</b><br><span style="color:#8DC63F;font-size:12px">Portal do Educador 5.0</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="font-size:18px;margin:0 0 12px"><b>${esc(u.nome || '(sem nome)')}</b></p>
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
${linha('E-mail', u.email)}${linha('WhatsApp', whats)}${linha('Perfil', u.perfil)}${linha('Função', u.funcao)}
${linha('Rede', u.rede)}${linha('Município', local)}${linha('Escola', escola)}${linha('INEP', u.escola_inep)}
${linha('Etapas', (u.etapas || []).join(', '))}${linha('Origem', ORIGENS[u.origem] || u.origem)}
${linha('Licença', [u.licenca_tipo, u.licenca_fim ? 'até ' + dataBR(u.licenca_fim) : ''].filter(Boolean).join(' · '))}${linha('Situação', u.status)}
</table>
${whats ? `<a href="https://wa.me/55${esc(whats)}" style="display:inline-block;background:#5A9420;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold;margin-right:8px">Chamar no WhatsApp</a>` : ''}
<a href="https://app.portaldoeducador.com.br/entrar/" style="display:inline-block;background:#2671AB;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Abrir Usuários no Portal</a>
</div></div>`;
      await transporte().sendMail({
        from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: destinos(),
        replyTo: u.email || undefined,
        subject: `Novo cadastro no Portal: ${String(u.nome || u.email || uid).replace(/[\r\n]/g, ' ').slice(0, 100)}${local ? ' (' + local + ')' : ''}`,
        html
      });
      await ref.update({ aviso_email: 'enviado' }).catch(() => {});
    } catch (e) {
      console.error('emailNovoCadastro', uid, e);
      await ref.update({ aviso_email: 'falhou' }).catch(() => {});
    }
  }
);

/* ======================= mais avisos ======================= */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';

const caixa = (titulo, sub, corpo) => `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:640px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${titulo}</b><br><span style="color:#8DC63F;font-size:12px">${sub || 'Portal do Educador 5.0'}</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}</div></div>`;
const botao = (href, txt, cor) => `<a href="${href}" style="display:inline-block;background:${cor || '#2671AB'};color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold;margin:4px 8px 0 0">${esc(txt)}</a>`;
const enviar = (assunto, html, extra) => transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: destinos(), subject: String(assunto).replace(/[\r\n]/g, ' ').slice(0, 150), html, ...(extra || {}) });

// Certificado emitido na Formação Continuada
export const emailCertificadoEmitido = onDocumentCreated(
  { document: 'certificados/{codigo}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async (event) => {
    const c = event.data && event.data.data(); if (!c) return;
    const codigo = event.params.codigo;
    try {
      await enviar(`Certificado emitido: ${c.nome || ''} · ${c.cursoTitulo || ''}`, caixa('Certificado emitido na Formação Continuada', '', `
<p style="font-size:18px;margin:0 0 12px"><b>${esc(c.nome)}</b></p>
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
${linha('Curso', c.cursoTitulo)}${linha('Carga horária', c.cargaHoraria ? c.cargaHoraria + ' h' : '')}${linha('Nota final', c.notaFinal != null ? String(c.notaFinal) : '')}
${linha('Escola', c.escola)}${linha('Município', c.municipio)}${linha('E-mail', c.email)}${linha('Código', codigo)}
</table>${botao('https://app.portaldoeducador.com.br/validar/?c=' + encodeURIComponent(codigo), 'Ver validação do certificado', '#5A9420')}`),
        { replyTo: c.email || undefined });
    } catch (e) { console.error('emailCertificadoEmitido', codigo, e); }
  }
);

// Relatório enviado para aprovação na Central de Relatórios.
// LGPD: o e-mail não leva nome de aluno nem o conteúdo do relatório, só o registro do envio.
export const emailRelatorioEnviado = onDocumentWritten(
  { document: 'relatorios/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async (event) => {
    const antes = event.data.before.exists ? event.data.before.data() : null;
    const r = event.data.after.exists ? event.data.after.data() : null;
    if (!r || r.status !== 'enviado' || (antes && antes.status === 'enviado')) return;
    try {
      let muni = '';
      if (r.municipio_id) { const m = (await getFirestore().doc(`municipios/${r.municipio_id}`).get()).data() || {}; muni = [m.nome, m.uf].filter(Boolean).join('/'); }
      await enviar(`Relatório enviado: ${r.titulo || r.modelo || ''} · ${r.autor_nome || ''}`, caixa('Relatório enviado para aprovação', 'Central de Relatórios · Portal do Educador 5.0', `
<p style="font-size:17px;margin:0 0 12px"><b>${esc(r.titulo || r.modelo)}</b></p>
<table style="font-size:13px;border-collapse:collapse;margin:0 0 12px">
${linha('Enviado por', r.autor_nome)}${linha('Escola', r.escola_nome)}${linha('Município', muni)}${linha('Turma', r.turma_nome)}${linha('Período', r.periodo)}${linha('Modelo', r.modelo)}
</table>
<p style="font-size:12px;color:#6b7c90;margin:0 0 12px">Por proteção de dados (LGPD), nomes de alunos e o conteúdo do relatório ficam só no Portal.</p>
${botao('https://app.portaldoeducador.com.br/relatorios/', 'Abrir a Central de Relatórios')}`));
    } catch (e) { console.error('emailRelatorioEnviado', event.params.id, e); }
  }
);

// Pré-cadastros importados pela rede: junta tudo em UM e-mail a cada 15 minutos
// (uma importação de 300 professores vira 1 e-mail com a lista, não 300 e-mails, e não estoura o limite diário do Gmail).
export const emailPreCadastros = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'America/Campo_Grande', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async () => {
    const db = getFirestore(), marca = db.doc('config/avisos_email');
    const ult = ((await marca.get()).data() || {}).pre_cadastros_ate;
    const agora = Timestamp.now();
    if (!ult) { await marca.set({ pre_cadastros_ate: agora }, { merge: true }); return; } // primeira execução: só marca o ponto de partida
    const s = await db.collection('pre_cadastros').where('importado_em', '>', ult).where('importado_em', '<=', agora).get();
    if (s.empty) { await marca.set({ pre_cadastros_ate: agora }, { merge: true }); return; }
    const todos = s.docs.map(d => ({ id: d.id, ...d.data() }));
    // alunos (menores de idade): o e-mail leva so a contagem por municipio e escola, sem nomes
    const alunosPre = todos.filter(p => p.perfil === 'aluno');
    if (alunosPre.length) {
      const porLocal = {};
      alunosPre.forEach(p => { const k = [p.municipio_nome || 'Sem município', p.escola_nome || 'sem escola informada'].join(' · '); porLocal[k] = (porLocal[k] || 0) + 1; });
      await enviar(`${alunosPre.length} aluno(s) importado(s) pela rede`, caixa(`${alunosPre.length} aluno(s) importado(s)`, '', `
<p style="margin:0 0 12px">Eles entram no Portal com a conta Google do e-mail cadastrado.</p>
<table style="font-size:13px;border-collapse:collapse;margin:0 0 12px">${Object.entries(porLocal).map(([k, n]) => linha(k, String(n))).join('')}</table>
<p style="font-size:12px;color:#6b7c90">Por proteção de dados (LGPD), a lista com nomes fica só no Portal, em Usuários › Alunos.</p>`));
    }
    const lista = todos.filter(p => p.perfil !== 'aluno').sort((a, b) => String(a.municipio_nome || '').localeCompare(String(b.municipio_nome || '')) || String(a.nome || '').localeCompare(String(b.nome || '')));
    if (!lista.length) { await marca.set({ pre_cadastros_ate: agora }, { merge: true }); return; }
    const munis = [...new Set(lista.map(p => p.municipio_nome).filter(Boolean))];
    const linhas = lista.map(p => `<tr><td style="padding:4px 10px 4px 0;border-bottom:1px solid #eef2f6">${esc(p.nome)}</td><td style="padding:4px 10px 4px 0;border-bottom:1px solid #eef2f6">${esc(p.email || p.id)}</td><td style="padding:4px 0;border-bottom:1px solid #eef2f6">${esc((p.escolas_nomes || []).join(', ') || p.municipio_nome || '')}</td></tr>`).join('');
    const csv = '﻿Nome;E-mail;Município;Escolas\r\n' + lista.map(p => [p.nome, p.email || p.id, p.municipio_nome, (p.escolas_nomes || []).join(', ')].map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    await enviar(`${lista.length} pré-cadastro(s) importado(s)${munis.length ? ' · ' + munis.join(', ') : ''}`, caixa(`${lista.length} professor(es) importado(s) pela rede`, '', `
<p style="margin:0 0 12px">Eles recebem acesso quando entrarem pela primeira vez com o e-mail cadastrado.</p>
<table style="font-size:12px;border-collapse:collapse;margin:0 0 12px;width:100%"><tr style="color:#6b7c90;text-align:left"><th style="padding:4px 10px 4px 0">Nome</th><th style="padding:4px 10px 4px 0">E-mail</th><th>Escola</th></tr>${linhas}</table>
<p style="font-size:12px;color:#6b7c90">A lista completa também vai em planilha anexa.</p>`),
      { attachments: [{ filename: 'pre-cadastros-importados.csv', content: csv, contentType: 'text/csv; charset=utf-8' }] });
    await marca.set({ pre_cadastros_ate: agora }, { merge: true });
  }
);

// Resumo diário às 7h (horário de MS) com o movimento das últimas 24 horas
export const emailResumoDiario = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'America/Campo_Grande', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async () => {
    const db = getFirestore();
    const desde = Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000);
    const ontem = new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Campo_Grande' });
    const conta = async (q) => { try { return (await q.count().get()).data().count; } catch (e) { console.warn('conta', e.message); return '–'; } };
    const [novos, pre, dicas, relCriados, relPend, certs, acessos, totalUs] = await Promise.all([
      conta(db.collection('usuarios').where('criado_em', '>=', desde)),
      conta(db.collection('pre_cadastros').where('importado_em', '>=', desde)),
      conta(db.collection('dicas_envios').where('criado_em', '>=', desde)),
      conta(db.collection('relatorios').where('criado_em', '>=', desde)),
      conta(db.collection('relatorios').where('status', '==', 'enviado')),
      conta(db.collection('certificados').where('emitidoEm', '>=', desde)),
      conta(db.collection('acessos_dia').where('dia', '==', ontem)),
      conta(db.collection('usuarios'))
    ]);
    const dicasPend = await conta(db.collection('dicas_envios').where('status', '==', 'novo'));
    const [alNovos, alTotal, alAcessos, dicasAl, dicasAlPend] = await Promise.all([
      conta(db.collection('usuarios').where('perfil', '==', 'aluno').where('criado_em', '>=', desde)),
      conta(db.collection('usuarios').where('perfil', '==', 'aluno')),
      conta(db.collection('acessos_dia').where('dia', '==', ontem).where('perfil', '==', 'aluno')),
      conta(db.collection('dicas_alunos').where('criado_em', '>=', desde)),
      conta(db.collection('dicas_alunos').where('status', '==', 'novo'))
    ]);
    const kpi = (n, t) => `<td style="padding:10px;border:1px solid #dce4ed;border-radius:10px;text-align:center;width:25%"><b style="font-size:22px;color:#0c2338">${n}</b><br><span style="font-size:11px;color:#6b7c90">${t}</span></td>`;
    const dataBRhoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' });
    await enviar(`Resumo do Portal · ${dataBRhoje}`, caixa(`Resumo das últimas 24 horas`, `Portal do Educador 5.0 · ${dataBRhoje}`, `
<table style="border-collapse:separate;border-spacing:6px;width:100%;margin:0 0 10px"><tr>${kpi(typeof acessos === 'number' && typeof alAcessos === 'number' ? acessos - alAcessos : acessos, 'professores que usaram ontem')}${kpi(novos, 'novos cadastros')}${kpi(pre, 'pré-cadastros importados')}${kpi(totalUs, 'usuários no total')}</tr>
<tr>${kpi(relCriados, 'relatórios criados')}${kpi(relPend, 'relatórios aguardando aprovação')}${kpi(dicas, 'dicas enviadas')}${kpi(certs, 'certificados emitidos')}</tr>
<tr>${kpi(alAcessos, 'alunos que usaram ontem')}${kpi(alNovos, 'alunos novos')}${kpi(alTotal, 'alunos no total')}${kpi(dicasAl, 'dicas de alunos')}</tr></table>
${typeof dicasAlPend === 'number' && dicasAlPend > 0 ? `<p style="margin:0 0 10px;color:#9a5b00"><b>${dicasAlPend}</b> dica(s) de aluno esperando revisão.</p>` : ''}
${typeof dicasPend === 'number' && dicasPend > 0 ? `<p style="margin:0 0 10px;color:#9a5b00"><b>${dicasPend}</b> dica(s) esperando revisão.</p>` : ''}
${botao('https://app.portaldoeducador.com.br/entrar/', 'Abrir o Portal')}${typeof dicasPend === 'number' && dicasPend > 0 ? botao('https://app.portaldoeducador.com.br/dicas/#recebidas', 'Revisar dicas', '#5A9420') : ''}${typeof dicasAlPend === 'number' && dicasAlPend > 0 ? botao('https://app.portaldoeducador.com.br/dicas/?aluno=1#recebidas', 'Revisar dicas de alunos', '#5A9420') : ''}`));
  }
);

// Dica do Aluno: cada envio chega por e-mail para a equipe. Trava contra excesso: mais de 3 envios
// do mesmo aluno em 24 horas não gera novo e-mail (fica no Portal e no resumo diário).
const TIPOS_ALUNO = { estudo: 'Dica de estudo', app: 'Site ou app', curiosidade: 'Curiosidade', desafio: 'Desafio' };
export const emailDicaAluno = onDocumentCreated(
  { document: 'dicas_alunos/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] },
  async (event) => {
    const snap = event.data; if (!snap) return;
    const d = snap.data(), id = event.params.id;
    const db = getFirestore(), ref = db.doc(`dicas_alunos/${id}`);
    try {
      const desde = Date.now() - 24 * 3600 * 1000;
      const meus = await db.collection('dicas_alunos').where('autor_uid', '==', d.autor_uid).get();
      const recentes = meus.docs.filter(x => { const t = x.data().criado_em; return t && t.toMillis && t.toMillis() >= desde; }).length;
      if (recentes > 3) { await ref.update({ email_status: 'limitado' }); return; }
      const links = (d.links || []).map(u => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('');
      await enviar(`Nova dica de aluno: ${String(d.titulo || '').slice(0, 100)}`, caixa('Nova Dica do Aluno', 'Portal do Educador 5.0', `
<p style="font-size:18px;margin:0 0 6px"><b>${esc(d.titulo)}</b></p>
<p style="margin:0 0 14px;color:#6b7c90">${esc(TIPOS_ALUNO[d.tipo] || d.tipo)}${d.disciplina ? ' · ' + esc(d.disciplina) : ''}</p>
<p style="white-space:pre-line;margin:0 0 14px">${esc(d.texto)}</p>
${links ? `<p style="margin:0 0 4px"><b>Links</b> (confira antes de publicar)</p><ul style="margin:0 0 14px">${links}</ul>` : ''}
<table style="font-size:13px;border-collapse:collapse;margin:0 0 16px">
${linha('Aluno(a)', d.autor_nome)}${linha('E-mail', d.autor_email)}${linha('Escola', [d.escola_nome, d.municipio_nome].filter(Boolean).join(' · ') || 'não informada')}
${linha('Se publicada aparece como', String(d.autor_nome || '').trim().split(/\s+/)[0] + (d.escola_nome ? ' · ' + d.escola_nome : ''))}
</table>${botao('https://app.portaldoeducador.com.br/dicas/?aluno=1#recebidas', 'Revisar e publicar no Portal', '#5A9420')}
<p style="font-size:12px;color:#6b7c90;margin:14px 0 0">Aluno é menor de idade: responda pela escola, não direto para o e-mail do aluno.</p>`));
      await ref.update({ email_status: 'enviado', email_em: FieldValue.serverTimestamp() });
    } catch (e) {
      console.error('emailDicaAluno', id, e);
      await ref.update({ email_status: 'falhou', email_erro: String(e && e.message || e).slice(0, 300) }).catch(() => {});
    }
  }
);

// usados pelos avisos do Portal do Educador TV (tv.js)
export { transporte, destinos, esc as escHtml, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE };

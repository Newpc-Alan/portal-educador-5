// Envia UMA vez o histórico completo de cadastros (usuarios + pre_cadastros) e de Dicas do Professor
// para a equipe, em planilhas CSV anexas. Rodar no Cloud Shell:
//   SMTP_SENHA="$(gcloud secrets versions access latest --secret=SMTP_SENHA --project=portal-educador-5)" node enviar-historico.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const USUARIO = 'newpc.educacao@gmail.com';
const PARA = ['alan@newpc.com.br', 'leonardo@newpc.com.br', 'stefano@newpc.com.br', 'suporte@newpc.com.br'];
if (!process.env.SMTP_SENHA) { console.error('Defina SMTP_SENHA (veja o comentário no topo).'); process.exit(1); }
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' }));

const data = v => v && typeof v.toDate === 'function' ? v.toDate().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' }) : '';
const cel = v => { const s = Array.isArray(v) ? v.join(', ') : String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = (cab, linhas) => '﻿' + [cab.map(c => c[0]).join(';')].concat(linhas.map(l => cab.map(c => cel(c[1](l))).join(';'))).join('\r\n');
const ms = v => v && typeof v.toMillis === 'function' ? v.toMillis() : 0;

const us = (await db.collection('usuarios').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criado_em) - ms(a.criado_em));
const pre = (await db.collection('pre_cadastros').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const dicas = (await db.collection('dicas_envios').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criado_em) - ms(a.criado_em));

const cUs = csv([
  ['Cadastrado em', u => data(u.criado_em)], ['Nome', u => u.nome], ['E-mail', u => u.email], ['WhatsApp', u => u.whatsapp], ['Perfil', u => u.perfil],
  ['Situação', u => u.status], ['Origem', u => u.origem], ['Função', u => u.funcao], ['Rede', u => u.rede], ['UF', u => u.uf],
  ['Município', u => u.municipio_nome || u.municipio_cad], ['Escola', u => (u.escolas_nomes && u.escolas_nomes.length) ? u.escolas_nomes : u.escola_texto],
  ['INEP', u => u.escola_inep], ['Etapas', u => u.etapas], ['Licença', u => u.licenca_tipo], ['Licença até', u => data(u.licenca_fim)]
], us);
const cPre = csv([['E-mail', p => p.email || p.id], ['Nome', p => p.nome], ['Perfil', p => p.perfil], ['Município', p => p.municipio_nome], ['Escolas', p => p.escolas_nomes], ['Situação', p => p.status]], pre);
const cDi = csv([
  ['Enviada em', d => data(d.criado_em)], ['Situação', d => d.status], ['Tipo', d => d.tipo], ['Título', d => d.titulo], ['Professor', d => d.autor_nome],
  ['E-mail', d => d.autor_email], ['Escola', d => d.escola_nome], ['Município', d => d.municipio_nome], ['Disciplina', d => d.disciplina], ['Etapa', d => d.etapa],
  ['Descrição', d => d.texto], ['Links', d => d.links], ['Arquivos', d => (d.arquivos || []).map(a => a.nome)]
], dicas);

const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: USUARIO, pass: process.env.SMTP_SENHA } });
const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' }).replace(/\//g, '-');
await t.sendMail({
  from: `"Portal do Educador" <${USUARIO}>`, to: PARA,
  subject: `Histórico de cadastros e formulários do Portal (${hoje})`,
  html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338"><p><b>Histórico completo do Portal do Educador 5.0</b></p>
<ul><li>${us.length} usuários cadastrados</li><li>${pre.length} pré-cadastros importados pela rede (ainda sem primeiro acesso ou já vinculados)</li><li>${dicas.length} envios de Dicas do Professor</li></ul>
<p>As planilhas estão anexas (abrem no Excel ou Google Planilhas). Daqui em diante, cada novo cadastro e cada nova dica chegam neste e-mail na hora.</p></div>`,
  attachments: [
    { filename: `cadastros-usuarios-${hoje}.csv`, content: cUs, contentType: 'text/csv; charset=utf-8' },
    { filename: `pre-cadastros-${hoje}.csv`, content: cPre, contentType: 'text/csv; charset=utf-8' },
    { filename: `dicas-do-professor-${hoje}.csv`, content: cDi, contentType: 'text/csv; charset=utf-8' }
  ]
});
console.log(`OK: histórico enviado para ${PARA.join(', ')} (${us.length} usuários, ${pre.length} pré-cadastros, ${dicas.length} dicas).`);

// Comunicados por e-mail (nov/2026): o administrador escreve uma mensagem e escolhe o público (perfil, município, escola);
// o robô envia aos poucos, pela conta comunicados@portaldoeducador.com.br (Webnode), separada da conta dos e-mails do sistema.
//   comunicados_email/{id}                 o comunicado, o público, a situação e os totais (só o admin lê; só funções gravam)
//   comunicados_email/{id}/envio_lotes/{n} destinatários em lotes de até 400 e o andamento de cada lote
//   config/comunicados                     servidor SMTP, porta, envios por hora e nome do remetente (sem senha)
// A senha da conta fica só no Secret Manager (COMUNICADOS_SMTP_SENHA), cadastrada pelo Alan.
//   comunicados_pref/{uid}                 token do link "não quero receber" e a escolha da pessoa (só funções gravam, só o admin lê)
// Comunicado "informativo" respeita quem pediu para não receber (comunicados_pref.off); "aviso de serviço" vai para todos.
// Tudo fica na Auditoria: criar, enviar teste, cancelar, concluir, e quem pediu para não receber.
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { expiraAuditoria } from './auditoria.js';
import { situacoesFormacao } from './formacao-uso.js';

const REGIAO = 'southamerica-east1';
const SENHA = defineSecret('COMUNICADOS_SMTP_SENHA');
const PERFIS = { professor: 'Professores', gestor: 'Gestão da escola (direção e coordenação)', secretaria: 'Secretaria de Educação', aluno: 'Alunos' };
const TAM_LOTE = 400;
const LICENCAS = ['institucional', 'avulsa', 'teste', 'cortesia'];
const msDe = v => v && v.toMillis ? v.toMillis() : (v && v._seconds ? v._seconds * 1000 : 0);
const URL_SAIR = 'https://southamerica-east1-portal-educador-5.cloudfunctions.net/descadastroEmail';
const PADRAO = { host: 'smtp.mail.webnode.com', porta: 465, por_hora: 100, remetente: 'comunicados@portaldoeducador.com.br', nome: 'Portal do Educador' };
const txt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').slice(0, n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okEmail = e => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(e);
const okUrl = u => /^https:\/\/[^\s<>"]{3,500}$/.test(u);

async function adminAtivo(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const u = (await getFirestore().doc('usuarios/' + req.auth.uid).get()).data();
  if (!u || u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador do Portal envia comunicados.');
  return { uid: req.auth.uid, email: String(req.auth.token.email || u.email || ''), ...u };
}
export async function config(db) {
  const c = (await db.doc('config/comunicados').get()).data() || {};
  const porta = [465, 587].includes(Number(c.porta)) ? Number(c.porta) : PADRAO.porta;
  return { host: /^[a-z0-9.-]{4,100}$/i.test(c.host || '') ? c.host : PADRAO.host, porta, por_hora: Math.min(2000, Math.max(10, Number(c.por_hora) || PADRAO.por_hora)),
    remetente: okEmail(c.remetente || '') ? c.remetente : PADRAO.remetente, nome: txt(c.nome || PADRAO.nome, 60) };
}
const transporte = c => nodemailer.createTransport({ host: c.host, port: c.porta, secure: c.porta === 465, requireTLS: c.porta === 587,
  auth: { user: c.remetente, pass: SENHA.value() }, pool: true, maxConnections: 2, maxMessages: 50 });
function auditar(db, u, acao, doc, detalhe, valores) {
  return db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao, origem: 'funcao', colecao: 'comunicados_email', doc,
    autor_uid: u ? u.uid : '', autor_tipo: u ? 'usuario' : 'sistema', autor_email: u ? txt(u.email, 120) : '', perfil: u ? txt(u.perfil, 30) : '', detalhe: txt(detalhe, 600), campos: [], valores: valores || {} });
}

// público: perfis escolhidos, municípios (vazio = todos) e escola (opcional); só conta ativa com e-mail válido
function normalizarPublico(p) {
  const perfis = (Array.isArray(p && p.perfis) ? p.perfis : []).map(String).filter(x => PERFIS[x]);
  const municipios = (Array.isArray(p && p.municipios) ? p.municipios : []).map(String).filter(x => /^[A-Za-z0-9_-]{1,80}$/.test(x)).slice(0, 60);   // "__sem" = sem município (avulsos)
  // licença dos professores: institucional (contrato da rede), avulsa, teste, cortesia; vazio = todas. Vencidas só se pedir.
  const licencas = (Array.isArray(p && p.licencas) ? p.licencas : []).map(String).filter(x => LICENCAS.includes(x));
  const vencidas = !!(p && p.vencidas);
  // situação na Formação Continuada (só para quem não é aluno): nao_comecou, andamento (em andamento ou parado), parado (sem avanço há 14 dias), concluiu
  const formacao = ['nao_comecou', 'andamento', 'parado', 'concluiu'].includes(String(p && p.formacao || '')) ? String(p.formacao) : '';
  const escola = /^[A-Za-z0-9_-]{1,80}$/.test(String(p && p.escola || '')) ? String(p.escola) : '';
  if (!perfis.length) throw new HttpsError('invalid-argument', 'Escolha pelo menos um público.');
  return { perfis, municipios, escola, licencas, vencidas, formacao };
}
async function destinatarios(db, pub, tipo) {
  const out = [], vistos = new Set(); let semEmail = 0, sairam = 0, vencidasFora = 0;
  const sitF = pub.formacao ? await situacoesFormacao(db, null) : null;
  const off = new Set(); if (tipo !== 'servico') (await db.collection('comunicados_pref').where('off', '==', true).get()).forEach(d => off.add(d.id));
  for (const perfil of pub.perfis) {
    const sn = await db.collection('usuarios').where('perfil', '==', perfil).where('status', '==', 'ativo').get();
    sn.forEach(d => {
      const u = d.data();
      if (pub.municipios.length && !pub.municipios.includes(u.municipio_id || '__sem')) return;
      if (perfil === 'professor') {
        const lic = LICENCAS.includes(u.licenca_tipo) ? u.licenca_tipo : 'institucional';
        if (pub.licencas.length && !pub.licencas.includes(lic)) return;
        if (lic !== 'institucional' && !pub.vencidas && msDe(u.licenca_fim) && msDe(u.licenca_fim) < Date.now()) { vencidasFora++; return; }
      }
      if (pub.escola && u.escola_id !== pub.escola && !(u.escolas_ids || []).includes(pub.escola)) return;
      const email = String(u.email || '').trim().toLowerCase();
      if (!okEmail(email)) { semEmail++; return; }
      if (off.has(d.id)) { sairam++; return; }
      if (sitF) { if (perfil === 'aluno') return;
        const st = sitF[d.id] ? (sitF[d.id].andamento.length ? sitF[d.id].situacao : 'concluiu') : 'nao_comecou';
        if (pub.formacao === 'andamento' ? !['em_andamento', 'parado'].includes(st) : st !== pub.formacao) return; }
      if (vistos.has(email)) return; vistos.add(email);
      out.push({ uid: d.id, email, nome: txt(String(u.nome || '').split(' ')[0], 40), perfil, lic: perfil === 'professor' ? (LICENCAS.includes(u.licenca_tipo) ? u.licenca_tipo : 'institucional') : '' });
    });
  }
  return { lista: out, semEmail, sairam, vencidasFora };
}
export function montarEmail(c, com, dest, token) {
  const paras = String(com.mensagem || '').split(/\n{2,}/).map(p => '<p style="margin:0 0 14px">' + esc(p).replace(/\n/g, '<br>').replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2671AB">$1</a>') + '</p>').join('');
  const ola = dest.nome ? 'Olá, ' + esc(dest.nome) + '!' : 'Olá!';
  const botao = com.botao_link ? '<p style="margin:18px 0"><a href="' + esc(com.botao_link) + '" style="background:#1a6b2a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">' + esc(com.botao_texto || 'Abrir') + '</a></p>' : '';
  const sair = com.tipo === 'servico' ? '<p style="margin:6px 0 0">Este é um aviso de serviço do Portal do Educador, enviado a todos os usuários do público escolhido.</p>'
    : '<p style="margin:6px 0 0">Não quer mais receber comunicados? <a href="' + URL_SAIR + '?t=' + token + '" style="color:#62758a">Clique aqui</a>.</p>';
  const html = '<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#0c2338">' +
    '<div style="max-width:600px;margin:0 auto;padding:18px 12px">' +
    '<div style="background:#0f2c4a;border-radius:14px 14px 0 0;padding:16px 20px;color:#fff"><img src="https://www.portaldoeducador.com.br/assets/pde-logo-128.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:50%"> <b style="font-size:17px;vertical-align:middle;margin-left:8px">Portal do Educador</b></div>' +
    '<div style="background:#fff;padding:22px 20px;border-radius:0 0 14px 14px;font-size:15px;line-height:1.55"><p style="margin:0 0 14px;font-weight:700">' + ola + '</p>' + paras + botao + '</div>' +
    '<div style="font-size:12px;color:#62758a;padding:12px 6px;line-height:1.5"><p style="margin:0">Você recebe este e-mail porque tem cadastro no Portal do Educador · NEWPC Tecnologia.</p>' + sair + '</div></div></body></html>';
  const texto = ola + '\n\n' + String(com.mensagem || '') + (com.botao_link ? '\n\n' + (com.botao_texto || 'Abrir') + ': ' + com.botao_link : '') +
    '\n\n--\nPortal do Educador · NEWPC Tecnologia' + (com.tipo === 'servico' ? '' : '\nNão quer mais receber? ' + URL_SAIR + '?t=' + token);
  const headers = com.tipo === 'servico' ? {} : { 'List-Unsubscribe': '<' + URL_SAIR + '?t=' + token + '>' };
  return { from: { name: c.nome, address: c.remetente }, to: dest.email, subject: com.assunto, html, text: texto, headers };
}
// token de descadastro por pessoa (comunicados_pref, fora do cadastro: ninguém além do admin vê); criado só quando falta
async function tokens(db, lista) {
  const out = {};
  for (let i = 0; i < lista.length; i += 300) {
    const parte = lista.slice(i, i + 300), refs = parte.map(d => db.doc('comunicados_pref/' + d.uid));
    const docs = await db.getAll(...refs), lote = db.batch(); let n = 0;
    docs.forEach((d, k) => { let t = (d.data() || {}).token; if (!t) { t = randomBytes(18).toString('base64url'); lote.set(refs[k], { token: t, off: false, criado_em: FieldValue.serverTimestamp() }, { merge: true }); n++; } out[parte[k].uid] = t; });
    if (n) await lote.commit();
  }
  return out;
}

export const comunicadoEmail = onCall({ region: REGIAO, timeoutSeconds: 300, memory: '512MiB', secrets: [SENHA] }, async req => {
  const u = await adminAtivo(req), d = req.data || {}, db = getFirestore(), acao = String(d.acao || '');
  if (acao === 'contar') {
    const pub = normalizarPublico(d.publico), r = await destinatarios(db, pub, d.tipo === 'servico' ? 'servico' : 'info');
    const por = {}, porLic = {}; r.lista.forEach(x => { por[x.perfil] = (por[x.perfil] || 0) + 1; if (x.lic) porLic[x.lic] = (porLic[x.lic] || 0) + 1; });
    const c = await config(db);
    return { total: r.lista.length, por, porLic, vencidasFora: r.vencidasFora, semEmail: r.semEmail, sairam: r.sairam, horas: Math.ceil(r.lista.length / c.por_hora * 10) / 10, por_hora: c.por_hora };
  }
  const com = { tipo: d.tipo === 'servico' ? 'servico' : 'info', assunto: txt(String(d.assunto || '').trim(), 140), mensagem: txt(String(d.mensagem || '').trim(), 8000),
    botao_texto: txt(String(d.botao_texto || '').trim(), 40), botao_link: String(d.botao_link || '').trim() };
  if (com.botao_link && !okUrl(com.botao_link)) throw new HttpsError('invalid-argument', 'O link do botão precisa começar com https://');
  if (acao === 'teste') {
    if (com.assunto.length < 3 || com.mensagem.length < 5) throw new HttpsError('invalid-argument', 'Escreva o assunto e a mensagem.');
    const c = await config(db), para = okEmail(u.email) ? u.email : '';
    if (!para) throw new HttpsError('failed-precondition', 'Sua conta não tem e-mail válido.');
    try { const t = transporte(c); await t.sendMail({ ...montarEmail(c, com, { email: para, nome: txt(String(u.nome || '').split(' ')[0], 40) }, 'teste'), subject: '[TESTE] ' + com.assunto }); t.close(); }
    catch (e) { throw new HttpsError('unavailable', 'O servidor de e-mail recusou: ' + txt(e.message, 160)); }
    await auditar(db, u, 'alterou', 'teste', 'Enviou teste do comunicado "' + com.assunto + '" para ' + para);
    return { ok: true, para };
  }
  if (acao === 'enviar') {
    if (com.assunto.length < 3 || com.mensagem.length < 5) throw new HttpsError('invalid-argument', 'Escreva o assunto e a mensagem.');
    const pub = normalizarPublico(d.publico), r = await destinatarios(db, pub, com.tipo);
    if (!r.lista.length) throw new HttpsError('failed-precondition', 'Ninguém para receber com esse público.');
    if (Number(d.confirmo) !== r.lista.length) throw new HttpsError('failed-precondition', 'O número de destinatários mudou (agora são ' + r.lista.length + '). Confira e confirme de novo.');
    const quando = Number(d.agendar_ms) > Date.now() + 60000 ? Math.min(Number(d.agendar_ms), Date.now() + 60 * 86400000) : Date.now();
    const tk = await tokens(db, r.lista);
    const ref = db.collection('comunicados_email').doc();
    const lotes = []; for (let i = 0; i < r.lista.length; i += TAM_LOTE) lotes.push(r.lista.slice(i, i + TAM_LOTE).map(x => ({ ...x, t: tk[x.uid] })));
    await ref.set({ ...com, publico: pub, total: r.lista.length, enviados: 0, falhas: 0, lotes: lotes.length, status: quando > Date.now() ? 'agendado' : 'enviando',
      agendado_para: Timestamp.fromMillis(quando), criado_em: FieldValue.serverTimestamp(), criado_por: txt(u.nome, 60), criado_por_uid: u.uid });
    for (let i = 0; i < lotes.length; i++) await ref.collection('envio_lotes').doc(String(i).padStart(3, '0')).set({ n: i, itens: lotes[i], prox: 0, falhas: [] });
    const pubTxt = pub.perfis.map(p => PERFIS[p]).join(', ') + (pub.municipios.length ? ' · ' + pub.municipios.length + ' município(s)' + (pub.municipios.includes('__sem') ? ' (inclui sem município)' : '') : ' · todos os municípios') + (pub.escola ? ' · 1 escola' : '') +
      (pub.licencas.length ? ' · licenças: ' + pub.licencas.join(', ') : '') + (pub.vencidas ? ' · inclui licenças vencidas' : '') + (pub.formacao ? ' · Formação: ' + pub.formacao : '');
    await auditar(db, u, 'criou', ref.id, (quando > Date.now() ? 'Agendou' : 'Enviou') + ' o comunicado "' + com.assunto + '" para ' + r.lista.length + ' pessoa(s): ' + pubTxt, { total: { para: r.lista.length } });
    return { ok: true, id: ref.id, total: r.lista.length };
  }
  if (acao === 'cancelar') {
    const id = String(d.id || ''); if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', 'Comunicado inválido.');
    const ref = db.doc('comunicados_email/' + id), x = (await ref.get()).data();
    if (!x) throw new HttpsError('not-found', 'Comunicado não encontrado.');
    if (!['enviando', 'agendado'].includes(x.status)) return { ok: true, ja: true };
    await ref.update({ status: 'cancelado', cancelado_em: FieldValue.serverTimestamp(), cancelado_por: txt(u.nome, 60) });
    await auditar(db, u, 'alterou', id, 'Cancelou o comunicado "' + x.assunto + '" (' + (x.enviados || 0) + ' de ' + x.total + ' já tinham sido enviados)');
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

// a cada 5 minutos: manda a cota do período (envios por hora / 12), um comunicado de cada vez, na ordem em que foram criados
export const enviarComunicados = onSchedule({ region: REGIAO, schedule: 'every 5 minutes', timeZone: 'America/Campo_Grande', timeoutSeconds: 280, memory: '512MiB', secrets: [SENHA] }, async () => {
  const db = getFirestore(), agora = Timestamp.now();
  const sn = await db.collection('comunicados_email').where('status', 'in', ['enviando', 'agendado']).get();
  const fila = sn.docs.filter(d => (d.data().agendado_para || agora).toMillis() <= agora.toMillis()).sort((a, b) => a.data().agendado_para.toMillis() - b.data().agendado_para.toMillis());
  if (!fila.length) return;
  const c = await config(db); let cota = Math.max(1, Math.floor(c.por_hora / 12));
  const t = transporte(c), inicio = Date.now();
  try {
    for (const cd of fila) {
      if (cota <= 0 || Date.now() - inicio > 240000) break;
      const com = cd.data(); if (com.status === 'agendado') await cd.ref.update({ status: 'enviando', iniciado_em: FieldValue.serverTimestamp() });
      const lotes = await cd.ref.collection('envio_lotes').orderBy('n').get();
      let enviados = 0, falhas = 0, acabou = true;
      for (const ld of lotes.docs) {
        const l = ld.data(); if (l.prox >= l.itens.length) continue;
        let prox = l.prox; const novasFalhas = [];
        while (prox < l.itens.length && cota > 0 && Date.now() - inicio < 240000) {
          const dest = l.itens[prox];
          try { await t.sendMail(montarEmail(c, com, dest, dest.t)); enviados++; }
          catch (e) { falhas++; novasFalhas.push({ email: dest.email, erro: txt(e.message, 140) }); if (/auth|login|credential|535|534/i.test(String(e.message))) { cota = 0; console.error('comunicados: o servidor recusou a senha', e.message); break; } }
          prox++; cota--;
        }
        await ld.ref.update({ prox, ...(novasFalhas.length ? { falhas: FieldValue.arrayUnion(...novasFalhas) } : {}) });
        if (prox < l.itens.length) { acabou = false; break; }
      }
      const upd = { enviados: FieldValue.increment(enviados), falhas: FieldValue.increment(falhas), ultimo_envio_em: FieldValue.serverTimestamp() };
      if (acabou) upd.status = 'concluido', upd.concluido_em = FieldValue.serverTimestamp();
      await cd.ref.update(upd);
      if (acabou) await auditar(db, null, 'alterou', cd.id, 'Comunicado "' + com.assunto + '" concluído: ' + ((com.enviados || 0) + enviados) + ' enviado(s), ' + ((com.falhas || 0) + falhas) + ' falha(s)');
      if (!acabou) break;
    }
  } finally { t.close(); }
});

// "não quero mais receber": a página pede confirmação (o clique automático de antivírus não descadastra ninguém)
export const descadastroEmail = onRequest({ region: REGIAO, maxInstances: 5, timeoutSeconds: 15 }, async (req, res) => {
  const t = String((req.query && req.query.t) || (req.body && req.body.t) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const pag = (titulo, corpo) => res.status(200).set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + titulo + '</title></head>' +
    '<body style="margin:0;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#0c2338"><div style="max-width:480px;margin:40px auto;background:#fff;border-radius:14px;padding:26px 22px;text-align:center"><h1 style="font-size:20px;margin:0 0 10px">' + titulo + '</h1>' + corpo + '</div></body></html>');
  if (t.length < 10 || t === 'teste') return pag('Link inválido', '<p>Este link não é válido. Se quiser, responda o e-mail pedindo para não receber.</p>');
  const db = getFirestore(), sn = await db.collection('comunicados_pref').where('token', '==', t).limit(1).get();
  if (sn.empty) return pag('Link inválido', '<p>Não encontramos o cadastro deste link.</p>');
  const pd = sn.docs[0], u = { ...((await db.doc('usuarios/' + pd.id).get()).data() || {}), comunicados_off: !!pd.data().off }, voltar = req.method === 'POST' && String((req.body || {}).voltar || '') === '1';
  if (req.method !== 'POST') return pag(u.comunicados_off ? 'Você já não recebe comunicados' : 'Parar de receber comunicados?',
    '<p>' + (u.comunicados_off ? 'Avisos de serviço importantes (como mudanças de acesso) continuam chegando.' : 'Você deixa de receber os comunicados informativos do Portal do Educador. Avisos de serviço importantes continuam chegando.') + '</p>' +
    '<form method="post"><input type="hidden" name="t" value="' + t + '">' + (u.comunicados_off ? '<input type="hidden" name="voltar" value="1"><button style="background:#2671AB;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer">Quero voltar a receber</button>'
      : '<button style="background:#1a6b2a;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer">Sim, não quero mais receber</button>') + '</form>');
  await pd.ref.update({ off: !voltar, alterado_em: FieldValue.serverTimestamp() });
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'email', colecao: 'comunicados_pref', doc: pd.id,
    autor_uid: pd.id, autor_tipo: 'usuario', autor_email: txt(u.email, 120), perfil: txt(u.perfil, 30), municipio_id: txt(u.municipio_id, 64), detalhe: voltar ? 'Voltou a receber comunicados por e-mail' : 'Pediu para não receber comunicados por e-mail', campos: ['off'], valores: { off: { para: !voltar } } });
  return pag(voltar ? 'Pronto, você volta a receber' : 'Pronto, você não recebe mais', '<p>' + (voltar ? 'Os comunicados do Portal do Educador voltam a chegar no seu e-mail.' : 'Você não vai mais receber os comunicados informativos do Portal do Educador.') + '</p>');
});

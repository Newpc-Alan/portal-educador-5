// Robô do WhatsApp do Portal do Educador (API oficial da Meta, nov/2026).
// Fase 1: menu, dúvidas respondidas a partir dos manuais (bot_conhecimento), chamado de equipamento,
// link de acesso por e-mail e passagem para atendente humano. Tudo registrado (wa_conversas e auditoria).
//
// Segredos (cadastrados pelo Alan no Google, nunca passam pelo chat):
//   WHATSAPP_TOKEN       token permanente do usuário do sistema (Meta)
//   WHATSAPP_APP_SECRET  chave secreta do app (confere a assinatura de cada aviso da Meta)
//   WHATSAPP_VERIFY      código combinado para a Meta confirmar o endereço do robô
//   GEMINI_API_KEY       (o mesmo do Portal IA) para responder dúvidas
// Configuração (sem segredo, só o administrador lê): wa_config/geral { phone_number_id, ligado, equipe_emails[], comercial_emails[] }
//
// Coleções (só funções gravam; só o administrador lê):
//   wa_conversas/{wa_id}                  quem é, estado do menu, última mensagem
//   wa_conversas/{wa_id}/mensagens/{id}   histórico (entrada e saída)
//   wa_chamados/{id}                      chamados abertos pelo WhatsApp (atribuido_uid: técnico da vez)
//   wa_equipe/{uid}                       equipe de atendimento: nome, email, setores[suporte|tecnico|comercial], ativo, disponivel, ultimo_em (rodízio)
//   wa_vistos/{wamid}                     ids já tratados (a Meta pode reenviar); expira_em tem TTL de 7 dias
//   bot_conhecimento/{id}                 trechos dos manuais (titulo, texto) que o robô usa para responder
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO } from './dicas.js';
import { expiraAuditoria } from './auditoria.js';

const REGIAO = 'southamerica-east1';
const TOKEN = defineSecret('WHATSAPP_TOKEN');
const APP_SECRET = defineSecret('WHATSAPP_APP_SECRET');
const VERIFY = defineSecret('WHATSAPP_VERIFY');
const GEMINI = defineSecret('GEMINI_API_KEY');
const GRAPH = 'https://graph.facebook.com/v25.0/';
const SITE = 'https://www.portaldoeducador.com.br';
const MODELOS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
const txt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const sa = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MENU = [
  { id: 'duvida', title: 'Dúvida sobre o Portal', description: 'Como fazer algo no Portal do Educador' },
  { id: 'chamado', title: 'Problema em equipamento', description: 'Chromebook, tablet, lousa, rede' },
  { id: 'acesso', title: 'Não consigo entrar', description: 'Receber o link de acesso no e-mail' },
  { id: 'atendente', title: 'Falar com atendente', description: 'Uma pessoa da equipe responde' },
  { id: 'comercial', title: 'Portal na minha rede', description: 'Conhecer, assinar ou renovar o Portal' }
];
// sem \b: em JS o \b não entende letra acentuada ("olá" falhava)
// pedido comercial (botões do site e do Portal chegam com texto pronto): vai para um consultor, não para o manual
const COMERCIAL = /(quero (conhecer|saber mais|ver (uma )?demonstra|assinar|renovar|levar)|proposta|consultor|demonstra[cç][aã]o|contratar|or[cç]amento)/i;
const SAUDACAO = /^(oi+|ola|olá|oie|bom dia|boa tarde|boa noite|menu|inicio|início|ajuda|opcoes|opções|voltar|0)(?=$|[\s!.,?]|$)/i;

// ---------- Meta ----------
function assinaturaOk(req) {
  const h = String(req.get('x-hub-signature-256') || ''); if (!h.startsWith('sha256=') || !req.rawBody) return false;
  const esperado = Buffer.from('sha256=' + createHmac('sha256', APP_SECRET.value()).update(req.rawBody).digest('hex'));
  const veio = Buffer.from(h);
  return esperado.length === veio.length && timingSafeEqual(esperado, veio);
}
async function enviar(cfg, para, corpo) {
  const r = await fetch(GRAPH + cfg.phone_number_id + '/messages', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN.value(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, ...corpo })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Meta ' + r.status + ': ' + txt(j.error && j.error.message, 200));
  return j;
}
const texto = t => ({ type: 'text', text: { preview_url: false, body: txt(t, 4000) } });
const botoes = (t, lista) => ({ type: 'interactive', interactive: { type: 'button', body: { text: txt(t, 1000) }, action: { buttons: lista.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: txt(b.title, 20) } })) } } });
const menu = nome => ({ type: 'interactive', interactive: { type: 'list',
  header: { type: 'text', text: 'Portal do Educador' },
  body: { text: (nome ? 'Olá, ' + nome + '! ' : 'Olá! ') + 'Sou o assistente do Portal do Educador. Em que posso ajudar?' },
  footer: { text: 'Digite "menu" a qualquer momento' },
  action: { button: 'Ver opções', sections: [{ title: 'Atendimento', rows: MENU.map(m => ({ id: m.id, title: txt(m.title, 24), description: txt(m.description, 72) })) }] } } });

// ---------- quem está falando ----------
// o cadastro guarda o WhatsApp sem o 55 (ex.: 67999998888); a Meta manda 55 + DDD + número, às vezes sem o 9
function variantes(waId) {
  let d = String(waId || '').replace(/\D/g, ''); if (d.startsWith('55')) d = d.slice(2);
  const v = new Set([d]); if (d.length === 10 && /^[6-9]/.test(d[2])) v.add(d.slice(0, 2) + '9' + d.slice(2));
  if (d.length === 11 && d[2] === '9') v.add(d.slice(0, 2) + d.slice(3));
  return [...v].flatMap(x => [x, '55' + x]);
}
async function identificar(db, waId) {
  const sn = await db.collection('usuarios').where('whatsapp', 'in', variantes(waId).slice(0, 10)).limit(2).get();
  if (sn.size !== 1) return null;   // ninguém, ou mais de um cadastro com o mesmo número: não adivinha
  const d = sn.docs[0], u = d.data();
  if (u.status !== 'ativo' && u.status !== 'pendente') return null;
  return { uid: d.id, nome: txt(String(u.nome || '').split(' ')[0], 40), email: u.email || '', perfil: u.perfil || '', municipio_id: u.municipio_id || '', municipio_nome: u.municipio_nome || '', escola_nome: u.escola_nome || '' };
}

// ---------- dúvidas: busca nos manuais + resposta curta da IA ----------
let CONHECIMENTO = null, CONHECIMENTO_EM = 0;
async function conhecimento(db) {
  if (CONHECIMENTO && Date.now() - CONHECIMENTO_EM < 10 * 60e3) return CONHECIMENTO;
  const sn = await db.collection('bot_conhecimento').get(); const l = [];
  sn.forEach(d => { const x = d.data(); l.push({ titulo: x.titulo || '', texto: x.texto || '', chave: sa((x.titulo || '') + ' ' + (x.texto || '')) }); });
  CONHECIMENTO = l; CONHECIMENTO_EM = Date.now(); return l;
}
const VAZIAS = new Set('a o e de da do das dos em no na nos nas um uma para por com como que se eu meu minha ao os as é ou mais'.split(' '));
function buscar(lista, pergunta, n = 5) {
  const termos = sa(pergunta).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VAZIAS.has(w));
  if (!termos.length) return [];
  return lista.map(x => ({ x, p: termos.reduce((s, t) => s + (x.chave.includes(t) ? 1 + (sa(x.titulo).includes(t) ? 1 : 0) : 0), 0) }))
    .filter(r => r.p > 0).sort((a, b) => b.p - a.p).slice(0, n).map(r => r.x);
}
async function responderDuvida(db, pergunta, quem) {
  const trechos = buscar(await conhecimento(db), pergunta);
  if (!trechos.length) return null;
  const contexto = trechos.map((t, i) => '[' + (i + 1) + '] ' + t.titulo + '\n' + t.texto.slice(0, 2500)).join('\n\n');
  const instrucao = 'Você é o assistente de suporte do Portal do Educador (plataforma para professores de escolas públicas). ' +
    'Responda em português do Brasil, de forma curta e prática, em passos numerados quando for um procedimento, no máximo 12 linhas, sem markdown (use *negrito* só para nomes de botões). ' +
    'Use SOMENTE as informações dos trechos do manual abaixo. Se a resposta não estiver nos trechos, responda exatamente: NAO_SEI. Não invente botões, telas nem prazos.' +
    (quem && quem.perfil ? ' Quem pergunta é ' + quem.perfil + '.' : '');
  for (const modelo of MODELOS) {
    try {
      const corpo = { systemInstruction: { parts: [{ text: instrucao }] }, contents: [{ role: 'user', parts: [{ text: 'TRECHOS DO MANUAL:\n' + contexto + '\n\nPERGUNTA: ' + txt(pergunta, 600) }] }],
        generationConfig: { maxOutputTokens: 700, thinkingConfig: { thinkingLevel: 'low' } } };
      const chamar = c => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.value() }, body: JSON.stringify(c), signal: AbortSignal.timeout(12000) });
      let r = await chamar(corpo);
      // modelo que não aceita o ajuste de raciocínio: tenta de novo sem ele
      if (r.status === 400) { delete corpo.generationConfig.thinkingConfig; r = await chamar(corpo); }
      if (!r.ok) continue;
      const j = await r.json(), out = txt(((j.candidates || [])[0] || {}).content?.parts?.map(p => p.text || '').join('') || '', 3500);
      if (!out) continue;
      return /NAO_SEI/.test(out) ? null : out;
    } catch (e) { /* tenta o próximo modelo */ }
  }
  return null;
}

// ---------- registro ----------
async function guardar(ref, de, conteudo, extra) {
  await ref.collection('mensagens').add({ de, texto: txt(conteudo, 2000), em: FieldValue.serverTimestamp(), ...(extra || {}) });
}
function auditar(db, waId, detalhe) {
  return db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'wa_conversas', doc: waId,
    autor_uid: '', autor_tipo: 'sistema', autor_email: '', perfil: 'whatsapp', detalhe: txt(detalhe, 600), campos: [], valores: {} }).catch(() => {});
}
async function avisarEquipe(cfg, assunto, html) {
  const para = (cfg.equipe_emails && cfg.equipe_emails.length ? cfg.equipe_emails : destinos()).join(',');
  try { await transporte().sendMail({ from: `"Portal do Educador · WhatsApp" <${SMTP_USUARIO.value()}>`, to: para, subject: assunto, html }); } catch (e) { console.warn('whatsapp: e-mail da equipe', e.message); }
}

// ---------- equipe: rodízio por setor e transferência ----------
const SETORES = { suporte: 'Suporte', tecnico: 'Técnico', comercial: 'Comercial' };
// horário de atendimento humano: segunda a sexta, 8h às 18h (Mato Grosso do Sul)
function dentroHorario(d = new Date()) {
  const ms = new Date(d.getTime() - 4 * 3600e3), dia = ms.getUTCDay(), h = ms.getUTCHours();
  return dia >= 1 && dia <= 5 && h >= 8 && h < 18;
}
// escolhe o membro ativo e disponível do setor que recebeu conversa há mais tempo (rodízio justo) e marca a vez dele
async function proximoDoSetor(db, setor, exceto) {
  return db.runTransaction(async tx => {
    const sn = await tx.get(db.collection('wa_equipe').where('setores', 'array-contains', setor));
    const livres = sn.docs.filter(d => d.data().ativo === true && d.data().disponivel !== false && d.id !== exceto)
      .sort((a, b) => ((a.data().ultimo_em && a.data().ultimo_em.toMillis()) || 0) - ((b.data().ultimo_em && b.data().ultimo_em.toMillis()) || 0));
    if (!livres.length) return null;
    const d = livres[0]; tx.update(d.ref, { ultimo_em: FieldValue.serverTimestamp() });
    return { uid: d.id, nome: d.data().nome || '', email: d.data().email || '' };
  });
}
async function avisarPessoa(email, assunto, html) {
  if (!email) return;
  try { await transporte().sendMail({ from: `"Portal do Educador · WhatsApp" <${SMTP_USUARIO.value()}>`, to: email, subject: assunto, html }); } catch (e) { console.warn('whatsapp: aviso', e.message); }
}
// passa a conversa para alguém do setor (rodízio); sem ninguém disponível, fica na fila do setor e a lista padrão é avisada
async function encaminhar(db, cfg, ref, waId, setor, resumo, contexto) {
  const m = await proximoDoSetor(db, setor).catch(e => { console.warn('whatsapp: rodízio', e.message); return null; });
  await ref.set({ estado: 'atendente', setor, fila_desde: FieldValue.serverTimestamp(), nao_lidas: 1, encaminhada_em: FieldValue.serverTimestamp(), aguardando_desde: FieldValue.serverTimestamp(),
    atribuido_uid: m ? m.uid : '', atribuido_nome: m ? m.nome : '', atribuido_em: FieldValue.serverTimestamp() }, { merge: true });
  await metricas(db, { transferidas: FieldValue.increment(1), por_setor: { [setor]: FieldValue.increment(1) } });
  await guardar(ref, 'sistema', 'Encaminhada para ' + (m ? m.nome : 'a fila do setor') + ' (' + SETORES[setor] + ')');
  const html = '<p>' + esc(resumo) + '</p>' + (contexto ? '<p>' + esc(contexto) + '</p>' : '') + '<p>Responda pela tela <b>Atendimento WhatsApp</b> do Portal: ' + SITE + '/entrar/#whatsapp</p>';
  if (m) await avisarPessoa(m.email, 'WhatsApp (' + SETORES[setor] + '): nova conversa para você', html);
  else await avisarEquipe(cfg, 'WhatsApp (' + SETORES[setor] + '): conversa na fila sem atendente disponível', html);
  await auditar(db, waId, 'Conversa encaminhada: ' + SETORES[setor] + (m ? ' › ' + m.nome : ' › fila'));
  return m;
}
// métricas do dia (painel da TV): wa_metricas/{AAAA-MM-DD} no horário de Campo Grande
export const diaCG = (t = Date.now()) => new Date(t - 4 * 3600e3).toISOString().slice(0, 10);
// set com merge junta os mapas aninhados (por_setor, atendidas_por); ponto no nome da chave NÃO vira caminho no set
const metricas = (db, campos) => db.doc('wa_metricas/' + diaCG()).set({ ...campos, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
const AVISO_HORARIO = 'Nosso atendimento humano é de segunda a sexta, das 8h às 18h. Sua mensagem fica registrada e respondemos no próximo horário.';

// ---------- conversa ----------
async function tratar(db, cfg, msg, contato) {
  const waId = String(msg.from || ''); if (!/^\d{8,15}$/.test(waId)) return;
  const ref = db.doc('wa_conversas/' + waId);
  // "lida" + "digitando..." na hora: a pessoa vê que o atendimento começou enquanto o robô prepara a resposta
  const digitando = fetch(GRAPH + cfg.phone_number_id + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN.value(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: msg.id, typing_indicator: { type: 'text' } }) }).catch(() => {});
  const entrada = msg.type === 'text' ? txt(msg.text && msg.text.body, 1500)
    : msg.type === 'interactive' ? txt((msg.interactive.list_reply || msg.interactive.button_reply || {}).id, 40) : '';
  const [snConv, quem] = await Promise.all([ref.get(), identificar(db, waId).catch(() => null)]);
  const conv = snConv.data() || {};
  const nome = quem ? quem.nome : txt(contato && contato.profile && contato.profile.name, 40).split(' ')[0];
  const cabecalho = ref.set({ wa_id: waId, nome_whatsapp: txt(contato && contato.profile && contato.profile.name, 80), uid: quem ? quem.uid : '', nome: quem ? quem.nome : '', email: quem ? quem.email : '',
    perfil: quem ? quem.perfil : '', municipio_nome: quem ? (quem.municipio_nome || '') : '', ultima_pessoa_em: FieldValue.serverTimestamp(),
    ultima: txt(entrada || '[' + msg.type + ']', 200), ultima_em: FieldValue.serverTimestamp() }, { merge: true });
  const gravando = guardar(ref, 'pessoa', entrada || '[' + msg.type + ']', { tipo: msg.type, wamid: txt(msg.id, 120) });
  const responder = async corpo => { await Promise.all([enviar(cfg, waId, corpo), guardar(ref, 'robo', corpo.text ? corpo.text.body : (corpo.interactive.body || {}).text || '[menu]')]); };
  await Promise.all([cabecalho, gravando, digitando]);
  const estado = async e => ref.set({ estado: e, estado_em: FieldValue.serverTimestamp() }, { merge: true });

  if (msg.type !== 'text' && msg.type !== 'interactive') { await responder(texto('Por enquanto eu entendo só mensagens de texto. Escreva sua dúvida ou digite *menu*.')); return; }

  // em atendimento humano: o robô só volta se a pessoa pedir o menu
  if (conv.estado === 'atendente' && !SAUDACAO.test(entrada)) { await ref.set({ nao_lidas: FieldValue.increment(1) }, { merge: true }); return; }

  if (entrada === 'comercial' || (msg.type === 'text' && conv.estado !== 'comercial' && COMERCIAL.test(entrada))) {
    await estado('comercial'); await ref.set({ assunto: 'comercial', pedido: txt(entrada, 300) }, { merge: true });
    await responder(texto('Que bom! Um consultor da NEWPC vai falar com você por aqui. Para agilizar, conte numa mensagem só: *seu nome*, *cargo*, *instituição ou rede* e *município*.'));
    return;
  }
  if (conv.estado === 'comercial' && msg.type === 'text' && !SAUDACAO.test(entrada)) {
    await ref.set({ lead: txt(entrada, 800), comercial_em: FieldValue.serverTimestamp() }, { merge: true });
    await responder(texto('Obrigado! Passei para um consultor do Portal do Educador, que responde por aqui.' + (dentroHorario() ? '' : ' ' + AVISO_HORARIO)));
    await encaminhar(db, cfg, ref, waId, 'comercial', 'Novo contato comercial: ' + (nome || 'contato') + '.', 'Pedido: ' + (conv.pedido || '-') + ' · Dados: ' + entrada);
    return;
  }
  if (SAUDACAO.test(entrada) || (!conv.estado && msg.type !== 'interactive')) { await estado('menu'); await responder(menu(nome)); return; }

  if (entrada === 'duvida') { await estado('duvida'); await responder(texto('Escreva sua dúvida numa mensagem só. Ex.: "Como faço um quiz com a turma?"')); return; }
  if (entrada === 'chamado') { await estado('chamado'); await responder(texto('Conte numa mensagem só: a *escola*, o *equipamento* (ex.: Chromebook 12, lousa da sala 3) e *o que está acontecendo*.')); return; }
  const quemTxt = (nome || 'Contato') + (quem ? ' · ' + (quem.perfil || '') + (quem.municipio_nome ? ' de ' + quem.municipio_nome : '') : ' · sem cadastro no Portal');
  if (entrada === 'atendente') {
    await ref.set({ assunto: 'suporte' }, { merge: true });
    await responder(texto('Certo! Passei a sua conversa para uma pessoa da equipe do Portal do Educador, que responde por aqui.' + (dentroHorario() ? '' : ' ' + AVISO_HORARIO)));
    await encaminhar(db, cfg, ref, waId, 'suporte', quemTxt + ' pediu atendente.');
    return;
  }
  if (entrada === 'acesso') {
    if (!quem || !quem.email) { await responder(texto('Não achei um cadastro no Portal com este WhatsApp. Entre em ' + SITE + '/entrar com a sua conta Google ou peça o link de acesso pelo e-mail na própria tela. Se precisar, digite *menu* e escolha *Falar com atendente*.')); return; }
    try {
      const link = await getAuth().generateSignInWithEmailLink(quem.email, { url: SITE + '/entrar/?link=1', handleCodeInApp: true });
      await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: quem.email, subject: 'Seu link de acesso ao Portal do Educador',
        html: '<p>Olá, ' + esc(quem.nome) + '!</p><p>Você pediu pelo WhatsApp um link para entrar no Portal do Educador. Ele vale por pouco tempo e só uma vez.</p><p><a href="' + esc(link) + '">Entrar no Portal</a></p><p>Se não foi você, ignore este e-mail.</p>' });
      const m = quem.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
      await responder(texto('Pronto! Mandei um link de acesso para ' + m + '. Abra o e-mail *neste mesmo aparelho* e toque em "Entrar no Portal". Não chegou? Olhe o spam.'));
      await auditar(db, waId, 'Link de acesso enviado por e-mail pelo WhatsApp');
    } catch (e) { console.warn('whatsapp: link', e.message); await responder(texto('Não consegui gerar o link agora. Tente de novo em alguns minutos ou digite *menu* › *Falar com atendente*.')); }
    await estado('menu'); return;
  }
  if (entrada === 'nao_resolveu') {
    await ref.set({ assunto: 'suporte' }, { merge: true });
    await responder(texto('Tudo bem! Passei a sua conversa para uma pessoa da equipe, que continua por aqui.' + (dentroHorario() ? '' : ' ' + AVISO_HORARIO)));
    await encaminhar(db, cfg, ref, waId, 'suporte', quemTxt + ': a resposta do robô não resolveu.', 'Última pergunta: ' + (conv.ultima || '-'));
    return;
  }

  if (conv.estado === 'chamado') {
    const c = await db.collection('wa_chamados').add({ wa_id: waId, uid: quem ? quem.uid : '', nome: quem ? quem.nome : nome || '', municipio_nome: quem ? (quem.municipio_nome || '') : '',
      descricao: entrada, status: 'aberto', criado_em: FieldValue.serverTimestamp() });
    const prot = c.id.slice(0, 6).toUpperCase();
    const tec = await proximoDoSetor(db, 'tecnico').catch(() => null);
    await c.update({ protocolo: prot, atribuido_uid: tec ? tec.uid : '', atribuido_nome: tec ? tec.nome : '' });
    await responder(texto('Chamado aberto! Protocolo *' + prot + '*. A equipe técnica vai entrar em contato. Para outra coisa, digite *menu*.'));
    const htmlCh = '<p><b>Protocolo ' + esc(prot) + '</b> · ' + esc(quemTxt) + '</p><p>' + esc(entrada) + '</p><p>Veja na tela <b>Atendimento WhatsApp</b> do Portal.</p>';
    if (tec) await avisarPessoa(tec.email, 'Chamado pelo WhatsApp ' + prot + ' para você', htmlCh);
    else await avisarEquipe(cfg, 'Chamado pelo WhatsApp ' + prot + (quem && quem.municipio_nome ? ' · ' + quem.municipio_nome : ''), htmlCh);
    await auditar(db, waId, 'Chamado ' + prot + ' aberto pelo WhatsApp'); await estado('menu'); return;
  }

  // qualquer outro texto: trata como dúvida
  const resp = await responderDuvida(db, entrada, quem);
  if (resp) {
    await responder(texto(resp));
    await responder(botoes('Isso resolveu?', [{ id: 'menu', title: 'Sim, obrigado' }, { id: 'nao_resolveu', title: 'Falar com atendente' }]));
  } else {
    // o robô não sabe: passa direto para uma pessoa da equipe (rodízio do suporte)
    await ref.set({ assunto: 'suporte' }, { merge: true });
    await responder(texto('Essa eu não encontrei no manual do Portal. Passei sua pergunta para uma pessoa da equipe, que responde por aqui.' + (dentroHorario() ? '' : ' ' + AVISO_HORARIO)));
    await encaminhar(db, cfg, ref, waId, 'suporte', quemTxt + ': o robô não encontrou resposta.', 'Pergunta: ' + entrada);
    return;
  }
  await estado('menu');
}

// ---------- endereço que a Meta chama ----------
// configuração em memória por 60 s (uma leitura a menos por mensagem)
let CFG = null, CFG_EM = 0;
async function config(db) { if (!CFG || Date.now() - CFG_EM > 60e3) { CFG = (await db.doc('wa_config/geral').get()).data() || {}; CFG_EM = Date.now(); } return CFG; }

// minInstances 1: um servidor sempre acordado (sem a espera de 3 a 8 s da primeira mensagem)
export const whatsappWebhook = onRequest({ region: REGIAO, secrets: [TOKEN, APP_SECRET, VERIFY, GEMINI, SMTP_SENHA], minInstances: 1, maxInstances: 5, timeoutSeconds: 60, memory: '512MiB', cpu: 1 }, async (req, res) => {
  if (req.method === 'GET') {   // a Meta confirma o endereço uma vez
    const ok = req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY.value();
    res.status(ok ? 200 : 403).send(ok ? String(req.query['hub.challenge'] || '') : 'não');
    return;
  }
  if (req.method !== 'POST') { res.status(405).send(''); return; }
  if (!assinaturaOk(req)) { res.status(401).send(''); return; }
  // trabalha ANTES de responder: depois da resposta o Google reduz a CPU ao mínimo e tudo fica lento
  const db = getFirestore(), cfg = await config(db);
  if (!cfg.ligado || !cfg.phone_number_id) { res.status(200).send('ok'); return; }
  const tarefas = [];
  for (const e of (req.body && req.body.entry) || []) for (const ch of e.changes || []) {
    const v = ch.value || {}; if (v.metadata && String(v.metadata.phone_number_id) !== String(cfg.phone_number_id)) continue;
    for (const m of v.messages || []) {
      // a Meta pode mandar a mesma mensagem duas vezes: guarda o id e ignora repetidas
      const marca = db.doc('wa_vistos/' + txt(m.id, 200).replace(/[\/]/g, '_'));
      tarefas.push(marca.create({ em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + 7 * 86400e3) })
        .then(() => tratar(db, cfg, m, (v.contacts || [])[0]), () => null)
        .catch(e => console.error('whatsapp:', e.message)));
    }
  }
  await Promise.all(tarefas);
  res.status(200).send('ok');
});

// ---------- tela de Atendimento (só administrador) ----------
// a Meta só deixa mandar texto livre até 24 h depois da última mensagem da pessoa; depois disso precisa de modelo aprovado
async function souAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const u = (await getFirestore().doc('usuarios/' + req.auth.uid).get()).data() || {};
  if (u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Só o administrador do Portal faz isso.');
  return u;
}
// quem atende: administrador ativo ou membro ativo da equipe de atendimento
async function souAtendente(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no Portal.');
  const db = getFirestore();
  const [u, eq] = await Promise.all([db.doc('usuarios/' + req.auth.uid).get(), db.doc('wa_equipe/' + req.auth.uid).get()]);
  const ud = u.data() || {}, ed = eq.data() || {};
  const admin = ud.perfil === 'admin' && ud.status === 'ativo';
  if (!admin && !(eq.exists && ed.ativo === true)) throw new HttpsError('permission-denied', 'Só a equipe de atendimento usa esta tela.');
  return { nome: txt(String(ed.nome || ud.nome || 'Equipe').split(' ')[0], 30), nomeCompleto: txt(ed.nome || ud.nome || '', 80), admin };
}
export const whatsappResponder = onCall({ region: REGIAO, secrets: [TOKEN], maxInstances: 5, timeoutSeconds: 20 }, async req => {
  const u = await souAtendente(req), db = getFirestore();
  const waId = String((req.data || {}).wa_id || ''), msg = txt((req.data || {}).texto, 3000), encerrar = !!(req.data || {}).encerrar;
  if (!/^\d{8,15}$/.test(waId)) throw new HttpsError('invalid-argument', 'Conversa inválida.');
  const ref = db.doc('wa_conversas/' + waId), conv = (await ref.get()).data();
  if (!conv) throw new HttpsError('not-found', 'Conversa não encontrada.');
  const cfg = (await db.doc('wa_config/geral').get()).data() || {};
  if (!cfg.ligado || !cfg.phone_number_id) throw new HttpsError('failed-precondition', 'O robô do WhatsApp está desligado.');
  const ult = conv.ultima_pessoa_em && conv.ultima_pessoa_em.toMillis ? conv.ultima_pessoa_em.toMillis() : 0;
  if (Date.now() - ult > 24 * 3600e3) throw new HttpsError('failed-precondition', 'Passaram 24 h da última mensagem desta pessoa. O WhatsApp só deixa responder depois que ela escrever de novo.');
  const quem = txt(String(u.nome || 'Equipe').split(' ')[0], 30);
  // a pessoa vê só a equipe, nunca o nome de quem atendeu (o nome fica no histórico interno)
  if (msg) {
    await enviar(cfg, waId, texto('*Equipe Portal do Educador:* ' + msg)); await guardar(ref, 'equipe', msg, { autor_uid: req.auth.uid, autor_nome: quem });
    // tempo até a 1ª resposta humana depois que o robô passou a conversa
    const desde = conv.aguardando_desde && conv.aguardando_desde.toMillis ? conv.aguardando_desde.toMillis() : 0;
    if (desde) { await metricas(db, { resp_soma_s: FieldValue.increment(Math.round((Date.now() - desde) / 1000)), resp_n: FieldValue.increment(1) }); await ref.update({ aguardando_desde: FieldValue.delete() }); }
  }
  if (encerrar) await metricas(db, { encerradas: FieldValue.increment(1), atendidas_por: { [req.auth.uid]: FieldValue.increment(1) } });
  if (encerrar) {
    await enviar(cfg, waId, texto('Atendimento encerrado. Se precisar de mais alguma coisa, é só digitar *menu*.'));
    await guardar(ref, 'robo', 'Atendimento encerrado');
  }
  // quem responde uma conversa da fila (sem dono) fica com ela
  const dono = conv.atribuido_uid ? {} : { atribuido_uid: req.auth.uid, atribuido_nome: u.nomeCompleto || quem, atribuido_em: FieldValue.serverTimestamp() };
  await ref.set({ estado: encerrar ? 'menu' : 'atendente', nao_lidas: 0, atendente_uid: req.auth.uid, atendente_nome: quem, ...dono,
    ...(encerrar ? { fila_desde: FieldValue.delete(), atribuido_uid: '', atribuido_nome: '', setor: FieldValue.delete() } : {}) }, { merge: true });
  if (encerrar) await auditar(db, waId, 'Atendimento encerrado por ' + quem);
  return { ok: true };
});

// transferir a conversa: para um membro (para_uid), para o próximo do setor (setor) ou assumir (para_uid = eu)
export const whatsappTransferir = onCall({ region: REGIAO, secrets: [SMTP_SENHA], maxInstances: 5, timeoutSeconds: 20 }, async req => {
  const u = await souAtendente(req), db = getFirestore(), d = req.data || {};
  const waId = String(d.wa_id || ''), nota = txt(d.nota, 500);
  if (!/^\d{8,15}$/.test(waId)) throw new HttpsError('invalid-argument', 'Conversa inválida.');
  const ref = db.doc('wa_conversas/' + waId), conv = (await ref.get()).data();
  if (!conv) throw new HttpsError('not-found', 'Conversa não encontrada.');
  let alvo = null, setor = SETORES[d.setor] ? d.setor : (conv.setor || 'suporte');
  if (d.para_uid) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(d.para_uid))) throw new HttpsError('invalid-argument', 'Membro inválido.');
    const m = await db.doc('wa_equipe/' + d.para_uid).get();
    if (!m.exists || m.data().ativo !== true) throw new HttpsError('failed-precondition', 'Essa pessoa não está ativa na equipe de atendimento.');
    alvo = { uid: m.id, nome: m.data().nome || '', email: m.data().email || '' };
    if (!SETORES[d.setor] && (m.data().setores || []).length && !(m.data().setores || []).includes(setor)) setor = m.data().setores[0];
  } else {
    alvo = await proximoDoSetor(db, setor, req.auth.uid);
    if (!alvo) throw new HttpsError('failed-precondition', 'Ninguém disponível no setor ' + SETORES[setor] + ' agora.');
  }
  const assumiu = alvo.uid === req.auth.uid;
  await ref.set({ estado: 'atendente', setor, atribuido_uid: alvo.uid, atribuido_nome: alvo.nome, atribuido_em: FieldValue.serverTimestamp() }, { merge: true });
  await guardar(ref, 'sistema', assumiu ? u.nomeCompleto + ' assumiu a conversa' : 'Transferida por ' + (u.nomeCompleto || u.nome) + ' para ' + alvo.nome + ' (' + SETORES[setor] + ')' + (nota ? ': ' + nota : ''));
  if (!assumiu) await avisarPessoa(alvo.email, 'WhatsApp: ' + (u.nomeCompleto || u.nome) + ' transferiu uma conversa para você',
    '<p>' + esc(conv.nome || conv.nome_whatsapp || 'Contato') + (conv.municipio_nome ? ' · ' + esc(conv.municipio_nome) : '') + '</p>' + (nota ? '<p>Recado: ' + esc(nota) + '</p>' : '') + '<p>Responda pela tela <b>Atendimento WhatsApp</b> do Portal: ' + SITE + '/entrar/#whatsapp</p>');
  await auditar(db, waId, assumiu ? 'Conversa assumida por ' + u.nomeCompleto : 'Conversa transferida para ' + alvo.nome + ' (' + SETORES[setor] + ')');
  return { ok: true, para: alvo.nome, setor };
});

// cadastro da equipe de atendimento (só administrador). A pessoa precisa ter conta no Portal (o e-mail localiza o cadastro).
export const whatsappEquipe = onCall({ region: REGIAO, maxInstances: 3, timeoutSeconds: 20 }, async req => {
  await souAdmin(req); const db = getFirestore(), d = req.data || {};
  if (d.acao === 'salvar') {
    const email = txt(d.email, 160).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
    const setores = (Array.isArray(d.setores) ? d.setores : []).filter(x => SETORES[x]);
    if (!setores.length) throw new HttpsError('invalid-argument', 'Marque pelo menos um setor.');
    const sn = await db.collection('usuarios').where('email', '==', email).limit(2).get();
    if (sn.size !== 1) throw new HttpsError('not-found', sn.size ? 'Mais de um cadastro com esse e-mail.' : 'Não achei cadastro no Portal com esse e-mail. A pessoa precisa entrar no Portal uma vez antes.');
    const uref = sn.docs[0], ud = uref.data();
    if (ud.status !== 'ativo') throw new HttpsError('failed-precondition', 'O cadastro dessa pessoa no Portal não está ativo.');
    const ref = db.doc('wa_equipe/' + uref.id), antes = await ref.get();
    await ref.set({ nome: txt(ud.nome, 80) || email, email, setores, ativo: true, disponivel: antes.exists ? antes.data().disponivel !== false : true,
      atualizado_em: FieldValue.serverTimestamp(), ...(antes.exists ? {} : { criado_em: FieldValue.serverTimestamp(), ultimo_em: Timestamp.fromMillis(0) }) }, { merge: true });
    await auditar(db, uref.id, 'Equipe de atendimento: ' + email + ' (' + setores.join(', ') + ')');
    return { ok: true, uid: uref.id, nome: ud.nome || email };
  }
  if (d.acao === 'ativo') {   // tirar ou voltar da equipe (não apaga: o histórico das conversas continua com o nome)
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(d.uid || ''))) throw new HttpsError('invalid-argument', 'Membro inválido.');
    const ref = db.doc('wa_equipe/' + d.uid); if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Membro não encontrado.');
    await ref.update({ ativo: !!d.ativo, atualizado_em: FieldValue.serverTimestamp() });
    await auditar(db, d.uid, 'Equipe de atendimento: ' + (d.ativo ? 'voltou' : 'saiu'));
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

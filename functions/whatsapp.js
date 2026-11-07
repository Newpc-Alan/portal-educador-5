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
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO } from './dicas.js';
import { expiraAuditoria } from './auditoria.js';
const msTs = x => x && x.toMillis ? x.toMillis() : 0;
import { MODELO_BOAS_VINDAS_WA, MODELO_ALERTA_WA, RODAPE_WA, preencherWA, URL_ENTRAR } from './comunicacoes.js';

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
// quem já chega pedindo uma pessoa (ex.: link "Falar com o atendimento" do site) vai direto para a equipe
const PEDE_PESSOA = /(falar com (o |a |um |uma )?(atendimento|atendente|pessoa|humano|algu[eé]m|equipe|suporte))/i;
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
  header: { type: 'text', text: 'Lara · Portal do Educador' },
  // Lara (nov/2026): a mesma assistente virtual do site; deixa claro que é virtual e como falar com uma pessoa
  body: { text: (nome ? 'Olá, ' + nome + '! ' : 'Olá! ') + 'Sou a Lara, assistente virtual do Portal do Educador. Em que posso ajudar hoje?\n\nSe preferir falar com uma pessoa da equipe, é só escolher *Falar com atendente*.' },
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
// palavras do dia a dia → como o manual chama (amplia a busca sem depender da palavra exata)
const SINONIMOS = { carteira: 'carteirinha cartao cracha', cracha: 'carteirinha cartao', qr: 'qrcode carteirinha cartao', qrcode: 'qr carteirinha',
  senha: 'entrar acesso link', login: 'entrar acesso', logar: 'entrar acesso', prova: 'avaliacao gerador', avaliacao: 'prova', nota: 'notas boletim media',
  chamada: 'frequencia presenca', presenca: 'frequencia chamada', falta: 'frequencia', boletim: 'notas', lousa: 'quadro', tablet: 'aparelho dispositivo',
  chromebook: 'aparelho dispositivo', aula: 'turma', aluno: 'alunos', turma: 'turmas', imprimir: 'impressao pdf', baixar: 'download pdf' };
// radical: corta o fim da palavra (carteiras → cartei, imprimir → imprim) para achar plural, diminutivo e conjugação
const radical = w => w.length <= 5 ? w : w.slice(0, Math.max(5, Math.min(7, w.length - 3)));
function buscar(lista, pergunta, n = 6) {
  let palavras = sa(pergunta).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VAZIAS.has(w));
  palavras = palavras.concat(...palavras.map(w => (SINONIMOS[w] || SINONIMOS[w.replace(/s$/, '')] || '').split(' ').filter(Boolean)));
  const termos = [...new Set(palavras.map(radical))];
  if (!termos.length) return [];
  // palavra rara vale mais (idf): "carteirinha" pesa mais que "portal"
  const N = lista.length || 1, peso = {};
  termos.forEach(t => { const df = lista.reduce((c, x) => c + (x.chave.includes(t) ? 1 : 0), 0); peso[t] = df ? Math.log(1 + N / df) : 0; });
  return lista.map(x => ({ x, p: termos.reduce((s, t) => s + (x.chave.includes(t) ? peso[t] * (sa(x.titulo).includes(t) ? 2 : 1) : 0), 0) }))
    .filter(r => r.p > 0).sort((a, b) => b.p - a.p).slice(0, n).map(r => r.x);
}
// segunda chance: a IA escolhe, pelos títulos do manual, onde está a resposta (quando a busca por palavra errou)
async function escolherSecoes(lista, pergunta) {
  const titulos = [...new Set(lista.map(x => x.titulo))].slice(0, 400);
  const corpo = { systemInstruction: { parts: [{ text: 'Escolha até 3 títulos do manual que respondem à pergunta. Responda só o JSON com os números.' }] },
    contents: [{ role: 'user', parts: [{ text: 'TÍTULOS:\n' + titulos.map((t, i) => i + ': ' + t).join('\n') + '\n\nPERGUNTA: ' + txt(pergunta, 400) }] }],
    generationConfig: { maxOutputTokens: 60, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' }, responseSchema: { type: 'OBJECT', properties: { secoes: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['secoes'] } } };
  for (const modelo of MODELOS) {
    try {
      const chamar = c => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.value() }, body: JSON.stringify(c), signal: AbortSignal.timeout(8000) });
      let r = await chamar(corpo); if (r.status === 400) { delete corpo.generationConfig.thinkingConfig; r = await chamar(corpo); }
      if (!r.ok) continue;
      const j = await r.json(), o = JSON.parse(((j.candidates || [])[0] || {}).content?.parts?.map(p => p.text || '').join('') || '{}');
      const esc = (o.secoes || []).map(i => titulos[i]).filter(Boolean);
      return lista.filter(x => esc.includes(x.titulo)).slice(0, 6);
    } catch (e) { /* próximo modelo */ }
  }
  return [];
}
// ---------- agente: entende o pedido e resolve consultando o Portal ----------
// Classifica a mensagem (uma chamada curta à IA) e, quando é algo que o Portal sabe responder, responde com os dados reais:
//   cadastro (situação, perfil, rede, escola, licença), acesso (manda o link), chamado (status pelo protocolo),
//   escola (se a escola já está cadastrada na rede), comercial e humano. O resto vai para o manual.
// Só fala de dados da PRÓPRIA pessoa, reconhecida pelo WhatsApp do cadastro. Número desconhecido não recebe dado nenhum.
const ACOES_AGENTE = ['cadastro', 'acesso', 'chamado', 'escola', 'comercial', 'humano', 'manual'];
async function classificar(pergunta) {
  const corpo = { systemInstruction: { parts: [{ text: 'Classifique a mensagem de um professor ao suporte do Portal do Educador. Responda só o JSON. acao: ' +
      'cadastro (quer saber do próprio cadastro, situação, licença, plano, validade, a que rede ou escola está ligado), ' +
      'acesso (não consegue entrar, esqueceu a senha, link de acesso, login), chamado (pergunta sobre um chamado/protocolo já aberto), ' +
      'escola (quer saber se uma escola já está cadastrada ou pede para vincular/adicionar escola), comercial (contratar, preço, proposta, renovar, assinar), ' +
      'humano (pede uma pessoa, reclamação, assunto delicado) ou manual (dúvida de como usar o Portal). protocolo: código de 6 letras/números se houver. escola: nome da escola se houver.' }] },
    contents: [{ role: 'user', parts: [{ text: txt(pergunta, 600) }] }],
    generationConfig: { maxOutputTokens: 120, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'low' },
      responseSchema: { type: 'OBJECT', properties: { acao: { type: 'STRING', enum: ACOES_AGENTE }, protocolo: { type: 'STRING' }, escola: { type: 'STRING' } }, required: ['acao'] } } };
  for (const modelo of MODELOS) {
    try {
      const chamar = c => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.value() }, body: JSON.stringify(c), signal: AbortSignal.timeout(8000) });
      let r = await chamar(corpo);
      if (r.status === 400) { delete corpo.generationConfig.thinkingConfig; r = await chamar(corpo); }
      if (!r.ok) continue;
      const j = await r.json(), t = ((j.candidates || [])[0] || {}).content?.parts?.map(p => p.text || '').join('') || '';
      const o = JSON.parse(t); if (ACOES_AGENTE.includes(o.acao)) return o;
    } catch (e) { /* próximo modelo */ }
  }
  return { acao: 'manual' };
}
const dataBR = v => { const ms = v && v.toMillis ? v.toMillis() : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? Date.parse(v.slice(0, 10) + 'T12:00:00-04:00') : 0);
  return ms ? new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' }) : ''; };
const PERFIS = { professor: 'Professor(a)', gestor: 'Gestão da escola', secretaria: 'Secretaria de Educação', secretaria_escolar: 'Secretaria escolar', portaria: 'Portaria', admin: 'Administrador', aluno: 'Aluno' };
async function meuCadastro(db, quem) {
  const u = (await db.doc('usuarios/' + quem.uid).get()).data() || {};
  const [mun, esc] = await Promise.all([u.municipio_id ? db.doc('municipios/' + u.municipio_id).get() : null, u.escola_id ? db.doc('escolas/' + u.escola_id).get() : null]);
  const m = mun && mun.exists ? mun.data() : null, e = esc && esc.exists ? esc.data() : null;
  const tipo = u.licenca_tipo || 'institucional';
  const fim = tipo === 'institucional' ? (m && (m.vigencia_fim_ts || m.vigencia_fim)) : u.licenca_fim;
  const linhas = ['Encontrei seu cadastro, ' + quem.nome + ':', '• Situação: *' + (u.status === 'ativo' ? 'ativo' : u.status === 'pendente' ? 'em análise pela equipe' : 'inativo') + '*',
    '• Perfil: ' + (PERFIS[u.perfil] || u.perfil || '-')];
  if (m) linhas.push('• Rede: ' + (m.nome || '-') + (m.uf ? '/' + m.uf : ''));
  if (e) linhas.push('• Escola: ' + (e.nome || '-'));
  else if (u.perfil === 'professor' && tipo === 'institucional') linhas.push('• Escola: ainda sem vínculo (a gestão da escola ou a Secretaria faz o vínculo)');
  linhas.push('• Acesso: ' + ({ institucional: 'pela rede (contrato institucional)', teste: 'teste grátis', avulsa: 'licença individual', cortesia: 'cortesia' }[tipo] || tipo) + (dataBR(fim) ? ', válido até *' + dataBR(fim) + '*' : ''));
  linhas.push('', 'Algo errado? Digite *menu* › *Falar com atendente*.');
  return linhas.join('\n');
}
async function statusChamado(db, waId, protocolo) {
  const p = String(protocolo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  let sn = p ? await db.collection('wa_chamados').where('protocolo', '==', p).limit(3).get() : null;
  let docs = sn ? sn.docs.filter(d => d.data().wa_id === waId) : [];   // só os chamados abertos por este número
  if (!docs.length) { sn = await db.collection('wa_chamados').where('wa_id', '==', waId).limit(20).get(); docs = sn.docs.sort((a, b) => ((b.data().criado_em && b.data().criado_em.toMillis()) || 0) - ((a.data().criado_em && a.data().criado_em.toMillis()) || 0)).slice(0, 3); }
  if (!docs.length) return 'Não encontrei chamado aberto por este WhatsApp' + (p ? ' com o protocolo ' + p : '') + '. Para abrir um, digite *menu* › *Problema em equipamento*.';
  return 'Seus chamados:\n' + docs.map(d => { const c = d.data(); return '• *' + (c.protocolo || d.id.slice(0, 6).toUpperCase()) + '* (' + (dataBR(c.criado_em) || '-') + '): ' +
    (c.status === 'resolvido' ? 'resolvido ✅' : c.atribuido_uid ? 'com o técnico, em andamento' : 'aberto, aguardando técnico'); }).join('\n');
}
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(escola|municipal|estadual|e\.?m\.?|emef|emei|ceim?|cmei)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
async function escolaNaRede(db, quem, nomeEscola) {
  const u = (await db.doc('usuarios/' + quem.uid).get()).data() || {};
  if (!u.municipio_id) return 'Seu cadastro ainda não está ligado a uma rede. Digite *menu* › *Falar com atendente* que a equipe faz o vínculo.';
  const sn = await db.collection('escolas').where('municipio_id', '==', u.municipio_id).select('nome').get();
  const alvo = semAcento(nomeEscola);
  const nomes = sn.docs.map(d => d.data().nome || '').filter(Boolean);
  if (!alvo) return nomes.length ? 'A sua rede tem ' + nomes.length + ' escolas cadastradas no Portal. Qual é o nome da sua escola?' : 'Sua rede ainda não tem escolas cadastradas. A equipe já foi avisada; digite *menu* › *Falar com atendente* se for urgente.';
  const achou = nomes.filter(n => { const a = semAcento(n); return a.includes(alvo) || alvo.includes(a) || alvo.split(' ').filter(w => w.length > 3).every(w => a.includes(w)); }).slice(0, 5);
  if (achou.length) return 'Sim! Encontrei na sua rede:\n' + achou.map(n => '• ' + n).join('\n') + '\n\nPara entrar nela, abra *Meu cadastro* no Portal e escolha a escola. Se não aparecer, digite *menu* › *Falar com atendente*.';
  return 'Não encontrei "' + txt(nomeEscola, 60) + '" entre as escolas da sua rede no Portal. Vou passar para a equipe conferir com a Secretaria.';
}

async function responderDuvida(db, pergunta, quem) {
  const lista = await conhecimento(db);
  let trechos = buscar(lista, pergunta);
  let resp = trechos.length ? await responderComTrechos(trechos, pergunta, quem) : null;
  if (!resp) {   // a busca por palavra não achou: a IA aponta a seção pelos títulos e tentamos de novo
    const outros = await escolherSecoes(lista, pergunta);
    const novos = outros.filter(x => !trechos.includes(x));
    if (novos.length) resp = await responderComTrechos(novos, pergunta, quem);
  }
  return resp;
}
async function responderComTrechos(trechos, pergunta, quem) {
  const contexto = trechos.map((t, i) => '[' + (i + 1) + '] ' + t.titulo + '\n' + t.texto.slice(0, 2500)).join('\n\n');
  const instrucao = 'Você é a Lara, assistente virtual de suporte do Portal do Educador (plataforma para professores de escolas públicas). Fale no feminino, com simpatia e objetividade. ' +
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

// ---------- áudio (nov/2026) ----------
// A Lara entende áudio: baixa o arquivo da Meta, a IA transcreve e a conversa segue como se a pessoa tivesse escrito.
// O áudio não é guardado em lugar nenhum; só a transcrição entra no histórico. Limite: 3 minutos / 8 MB.
const AUDIO_MAX = 8 * 1048576;
async function baixarMidia(id) {
  const r = await fetch(GRAPH + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + TOKEN.value() }, signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error('mídia ' + r.status);
  if (j.file_size && j.file_size > AUDIO_MAX) throw new Error('grande');
  const a = await fetch(j.url, { headers: { Authorization: 'Bearer ' + TOKEN.value() }, signal: AbortSignal.timeout(15000) });
  if (!a.ok) throw new Error('download ' + a.status);
  const buf = Buffer.from(await a.arrayBuffer()); if (buf.length > AUDIO_MAX) throw new Error('grande');
  return { buf, mime: String(j.mime_type || 'audio/ogg').split(';')[0] };
}
async function transcrever(audio) {
  const instrucao = 'Transcreva fielmente o áudio em português do Brasil, com pontuação. Devolva só o texto falado, sem comentários. ' +
    'Se não houver fala compreensível, devolva exatamente: SEM_FALA.';
  for (const modelo of MODELOS) {
    try {
      const corpo = { systemInstruction: { parts: [{ text: instrucao }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.buf.toString('base64') } }, { text: 'Transcreva este áudio.' }] }],
        generationConfig: { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'low' } } };
      const chamar = c => fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.value() }, body: JSON.stringify(c), signal: AbortSignal.timeout(25000) });
      let r = await chamar(corpo);
      if (r.status === 400) { delete corpo.generationConfig.thinkingConfig; r = await chamar(corpo); }
      if (!r.ok) continue;
      const j = await r.json(), out = txt(((j.candidates || [])[0] || {}).content?.parts?.map(p => p.text || '').join('') || '', 1500);
      if (!out) continue;
      return /SEM_FALA/.test(out) ? '' : out;
    } catch (e) { /* tenta o próximo modelo */ }
  }
  throw new Error('transcrição indisponível');
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
// horário de atendimento humano: segunda a sexta, 7h às 17h (horário de Mato Grosso do Sul)
function dentroHorario(d = new Date()) {
  const ms = new Date(d.getTime() - 4 * 3600e3), dia = ms.getUTCDay(), h = ms.getUTCHours();
  return dia >= 1 && dia <= 5 && h >= 7 && h < 17;
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
// notificação no celular (app de atendimento /atendimento/): tokens em wa_equipe/{uid}.tokens; os que morreram saem da lista
async function notificar(db, uids, titulo, corpo, waId) {
  const lista = [...new Set((uids || []).filter(Boolean))]; if (!lista.length) return;
  await Promise.all(lista.map(async uid => {
    const ref = db.doc('wa_equipe/' + uid), m = (await ref.get()).data() || {};
    const tokens = (m.tokens || []).filter(t => typeof t === 'string' && t.length > 20).slice(0, 10); if (!tokens.length) return;
    try {
      const r = await getMessaging().sendEachForMulticast({ tokens, data: { titulo: txt(titulo, 80), corpo: txt(corpo, 160), wa_id: String(waId || ''), link: '/atendimento/' + (waId ? '#c=' + waId : '') },
        webpush: { headers: { Urgency: 'high', TTL: '3600' } } });
      const mortos = r.responses.map((x, i) => !x.success && /registration-token-not-registered|invalid-argument|invalid-registration/.test((x.error && x.error.code) || '') ? tokens[i] : null).filter(Boolean);
      if (mortos.length) await ref.update({ tokens: FieldValue.arrayRemove(...mortos) });
    } catch (e) { console.warn('whatsapp: notificação', e.message); }
  }));
}
async function avisarPessoa(email, assunto, html) {
  if (!email) return;
  try { await transporte().sendMail({ from: `"Portal do Educador · WhatsApp" <${SMTP_USUARIO.value()}>`, to: email, subject: assunto, html }); } catch (e) { console.warn('whatsapp: aviso', e.message); }
}
// aviso no WhatsApp pessoal da equipe (nov/2026): todo membro ativo com "whatsapp_aviso" recebe (Alan e Leonardo sempre).
// Usa o modelo aprovado pde_alerta_atendimento; sem ele (ainda em aprovação), manda texto se o membro falou com o robô nas últimas 24 h.
const MODELO_ALERTA = 'pde_alerta_atendimento';
async function alertaWhats(db, cfg, waId, quem, situacao) {
  const sn = await db.collection('wa_equipe').where('ativo', '==', true).get().catch(() => null); if (!sn) return;
  const alvos = sn.docs.map(d => d.data()).filter(m => m.avisos_wa !== false && /^\d{10,13}$/.test(String(m.whatsapp_aviso || '')));
  if (alvos.some(m => variantes(m.whatsapp_aviso).includes(String(waId)))) return;   // conversa de alguém da equipe (teste): ninguém é avisado
  const deQuem = txt(quem || 'Um contato', 80), sit = txt(situacao, 80);
  await Promise.all(alvos.map(async m => {
    const vs = variantes(m.whatsapp_aviso);
    const para = vs.find(x => x.startsWith('55') && x.length === 13) || vs.find(x => x.startsWith('55'));
    try {
      await enviar(cfg, para, { type: 'template', template: { name: MODELO_ALERTA, language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: deQuem }, { type: 'text', text: sit }] }] } });
    } catch (e) {
      let ult = 0, conv = '';
      for (const v of vs.filter(x => x.startsWith('55'))) { const c = (await db.doc('wa_conversas/' + v).get()).data(); const t = c && c.ultima_pessoa_em && c.ultima_pessoa_em.toMillis ? c.ultima_pessoa_em.toMillis() : 0; if (t > ult) { ult = t; conv = v; } }
      if (conv && Date.now() - ult < 23.5 * 3600e3) await enviar(cfg, conv, { type: 'interactive', interactive: { type: 'cta_url', header: { type: 'text', text: 'Portal do Educador' },
        body: { text: 'Novo chamado no atendimento do Portal do Educador. Contato: ' + deQuem + '. Situação: ' + sit + '. Toque no botão para responder.' }, footer: { text: 'Aviso para a equipe' },
        action: { name: 'cta_url', parameters: { display_text: 'Abrir o atendimento', url: SITE + '/atendimento/' } } } }).catch(e2 => console.warn('whatsapp: alerta texto', e2.message));
      else console.warn('whatsapp: alerta sem modelo aprovado e fora das 24 h', e.message);
    }
  }));
}
const quemDe = c => { const n = (c && (c.nome || c.nome_whatsapp)) || 'Um contato'; return n + (c && c.municipio_nome ? ' (' + c.municipio_nome + ')' : ''); };
// passa a conversa para alguém do setor (rodízio); sem ninguém disponível, fica na fila do setor e a lista padrão é avisada
async function encaminhar(db, cfg, ref, waId, setor, resumo, contexto) {
  const m = await proximoDoSetor(db, setor).catch(e => { console.warn('whatsapp: rodízio', e.message); return null; });
  await ref.set({ estado: 'atendente', setor, fila_desde: FieldValue.serverTimestamp(), nao_lidas: 1, encaminhada_em: FieldValue.serverTimestamp(), aguardando_desde: FieldValue.serverTimestamp(),
    atribuido_uid: m ? m.uid : '', atribuido_nome: m ? m.nome : '', atribuido_em: FieldValue.serverTimestamp() }, { merge: true });
  await metricas(db, { transferidas: FieldValue.increment(1), por_setor: { [setor]: FieldValue.increment(1) } });
  await guardar(ref, 'sistema', 'Encaminhada para ' + (m ? m.nome : 'a fila do setor') + ' (' + SETORES[setor] + ')');
  const html = '<p>' + esc(resumo) + '</p>' + (contexto ? '<p>' + esc(contexto) + '</p>' : '') + '<p>Responda pelo app de atendimento: ' + SITE + '/atendimento/</p>';
  if (m) { await avisarPessoa(m.email, 'WhatsApp (' + SETORES[setor] + '): nova conversa para você', html); await notificar(db, [m.uid], 'Nova conversa · ' + SETORES[setor], resumo, waId); }
  else {
    await avisarEquipe(cfg, 'WhatsApp (' + SETORES[setor] + '): conversa na fila sem atendente disponível', html);
    const sn = await db.collection('wa_equipe').where('setores', 'array-contains', setor).get().catch(() => null);
    if (sn) await notificar(db, sn.docs.filter(d => d.data().ativo === true).map(d => d.id), 'Conversa na fila · ' + SETORES[setor], resumo, waId);
  }
  await auditar(db, waId, 'Conversa encaminhada: ' + SETORES[setor] + (m ? ' › ' + m.nome : ' › fila'));
  const conv = (await ref.get()).data() || {};
  await alertaWhats(db, cfg, waId, quemDe(conv), 'precisa de um atendente (' + SETORES[setor] + ')').catch(e => console.warn('whatsapp: alerta', e.message));
  return m;
}
// métricas do dia (painel da TV): wa_metricas/{AAAA-MM-DD} no horário de Campo Grande
export const diaCG = (t = Date.now()) => new Date(t - 4 * 3600e3).toISOString().slice(0, 10);
// set com merge junta os mapas aninhados (por_setor, atendidas_por); ponto no nome da chave NÃO vira caminho no set
const metricas = (db, campos) => db.doc('wa_metricas/' + diaCG()).set({ ...campos, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
// pesquisa de satisfação ao encerrar (botões); a resposta vai para wa_metricas e para a conversa
const PESQUISA = botoes('Como foi o atendimento?', [{ id: 'nota_3', title: '😀 Ótimo' }, { id: 'nota_2', title: '😐 Regular' }, { id: 'nota_1', title: '🙁 Ruim' }]);
const AVISO_HORARIO = 'Nosso horário de atendimento é de segunda a sexta, das 7h às 17h (horário de MS). Sua mensagem fica registrada e em breve entraremos em contato.';

// ---------- conversa ----------
// interno: o próprio agente reaproveita um fluxo do menu (sem registrar de novo a mensagem nem mandar "digitando")
async function tratar(db, cfg, msg, contato, interno = false) {
  const waId = String(msg.from || ''); if (!/^\d{8,15}$/.test(waId)) return;
  // áudio: vira texto e segue o fluxo normal (o histórico guarda "🎤 transcrição")
  if (!interno && msg.type === 'audio' && msg.audio && msg.audio.id && !(msg.audio.voice === false && /video/.test(msg.audio.mime_type || ''))) {
    let falado = null, motivo = '';
    fetch(GRAPH + cfg.phone_number_id + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN.value(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: msg.id, typing_indicator: { type: 'text' } }) }).catch(() => {});
    try { falado = await transcrever(await baixarMidia(msg.audio.id)); } catch (e) { motivo = e.message; console.warn('whatsapp: áudio', e.message); }
    await metricas(db, { audios: FieldValue.increment(1), ...(falado ? { audios_ok: FieldValue.increment(1) } : {}) });
    if (falado) return tratar(db, cfg, { ...msg, type: 'text', text: { body: falado }, audio_transcrito: true }, contato, false);
    const ref = db.doc('wa_conversas/' + waId);
    const aviso = motivo === 'grande' ? 'Esse áudio ficou longo demais para mim. Pode mandar um áudio mais curto (até uns 2 minutos) ou escrever?'
      : falado === '' ? 'Não consegui entender a fala nesse áudio. Pode repetir num lugar mais silencioso ou escrever sua dúvida?'
      : 'Não consegui ouvir esse áudio agora. Pode escrever sua dúvida numa mensagem? Ou digite *menu* para ver as opções.';
    await Promise.all([guardar(ref, 'pessoa', '[áudio não transcrito]', { tipo: 'audio', wamid: txt(msg.id, 120) }), enviar(cfg, waId, texto(aviso)), guardar(ref, 'robo', aviso)]);
    return;
  }
  const ref = db.doc('wa_conversas/' + waId);
  // "lida" + "digitando..." na hora: a pessoa vê que o atendimento começou enquanto o robô prepara a resposta
  const digitando = interno ? null : fetch(GRAPH + cfg.phone_number_id + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN.value(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: msg.id, typing_indicator: { type: 'text' } }) }).catch(() => {});
  const entrada = msg.type === 'text' ? txt(msg.text && msg.text.body, 1500)
    : msg.type === 'interactive' ? txt((msg.interactive.list_reply || msg.interactive.button_reply || {}).id, 40) : '';
  const [snConv, quem] = await Promise.all([ref.get(), identificar(db, waId).catch(() => null)]);
  const conv = snConv.data() || {};
  const nome = quem ? quem.nome : txt(contato && contato.profile && contato.profile.name, 40).split(' ')[0];
  const cabecalho = interno ? null : ref.set({ wa_id: waId, nome_whatsapp: txt(contato && contato.profile && contato.profile.name, 80), uid: quem ? quem.uid : '', nome: quem ? quem.nome : '', email: quem ? quem.email : '',
    perfil: quem ? quem.perfil : '', municipio_nome: quem ? (quem.municipio_nome || '') : '', ultima_pessoa_em: FieldValue.serverTimestamp(),
    ultima: txt(entrada || '[' + msg.type + ']', 200), ultima_em: FieldValue.serverTimestamp() }, { merge: true });
  const gravando = interno ? null : guardar(ref, 'pessoa', (msg.audio_transcrito ? '🎤 ' : '') + (entrada || '[' + msg.type + ']'), { tipo: msg.audio_transcrito ? 'audio' : msg.type, wamid: txt(msg.id, 120) });
  const responder = async corpo => { await Promise.all([enviar(cfg, waId, corpo), guardar(ref, 'robo', corpo.text ? corpo.text.body : (corpo.interactive.body || {}).text || '[menu]')]); };
  // primeiro contato do dia desta pessoa: a equipe fica sabendo, mesmo com o robô atendendo
  const primeiroDoDia = !interno && diaCG(conv.ultima_pessoa_em && conv.ultima_pessoa_em.toMillis ? conv.ultima_pessoa_em.toMillis() : 0) !== diaCG()
    ? alertaWhats(db, cfg, waId, (quem ? quem.nome : nome) + (quem && quem.municipio_nome ? ' (' + quem.municipio_nome + ')' : ''), 'começou a conversar com o robô').catch(e => console.warn('whatsapp: alerta', e.message)) : null;
  await Promise.all([cabecalho, gravando, digitando, primeiroDoDia]);
  const estado = async e => ref.set({ estado: e, estado_em: FieldValue.serverTimestamp() }, { merge: true });

  if (msg.type !== 'text' && msg.type !== 'interactive') { await responder(texto('Ainda não consigo ver imagens, vídeos ou arquivos por aqui. Pode escrever sua dúvida ou mandar um áudio? Ou digite *menu* para ver as opções.')); return; }

  // em atendimento humano: o robô só volta se a pessoa pedir o menu
  if (/^nota_[123]$/.test(entrada)) {
    const nota = Number(entrada.slice(5));
    await ref.set({ avaliacao: nota, avaliado_em: FieldValue.serverTimestamp(), estado: 'menu' }, { merge: true });
    await metricas(db, { avaliacoes: FieldValue.increment(1), avaliacao_soma: FieldValue.increment(nota), ['nota_' + nota]: FieldValue.increment(1) });
    await responder(texto(nota === 1 ? 'Obrigado por avisar. Vamos rever esse atendimento. Se quiser, conte numa mensagem o que faltou.' : 'Obrigado pela avaliação! Quando precisar, é só chamar.'));
    if (nota === 1) await avisarEquipe(cfg, 'WhatsApp: avaliação ruim de ' + (nome || waId), '<p>' + esc(nome || waId) + ' avaliou o atendimento como <b>ruim</b>. Veja a conversa na tela Atendimento WhatsApp.</p>');
    return;
  }
  if (conv.estado === 'atendente' && !SAUDACAO.test(entrada)) {
    await ref.set({ nao_lidas: FieldValue.increment(1) }, { merge: true });
    if (/^(resolvido|resolveu|obrigad[oa]|era isso|deu certo)\b/i.test(sa(entrada)) && conv.aguardando_desde) {
      await ref.set({ estado: 'menu', atribuido_uid: '', atribuido_nome: '', aguardando_desde: FieldValue.delete(), fila_desde: FieldValue.delete() }, { merge: true });
      await guardar(ref, 'sistema', 'A pessoa marcou como resolvido antes da equipe responder');
      await metricas(db, { resolvidas_espera: FieldValue.increment(1) });
      await responder(texto('Que bom que resolveu! Vou avisar a equipe que não precisa mais.'));
      await responder(PESQUISA);
      return;
    }
    // ninguém da equipe respondeu ainda: o robô não deixa no vácuo. Tenta ajudar pelo manual; se não souber, confirma que chegou.
    if (conv.aguardando_desde && msg.type === 'text') {
      const ajuda = entrada.length >= 12 ? await responderDuvida(db, entrada, quem).catch(() => null) : null;
      const ack = conv.ack_em && conv.ack_em.toMillis ? conv.ack_em.toMillis() : 0;
      if (ajuda) await responder(texto('Enquanto a equipe não chega, veja se isto ajuda:\n\n' + ajuda + '\n\nSe resolver, pode só dizer *resolvido*.'));
      else if (Date.now() - ack > 10 * 60e3) {
        await ref.set({ ack_em: FieldValue.serverTimestamp() }, { merge: true });
        await responder(texto('Recebi sua mensagem e ela já está com ' + (conv.atribuido_nome ? 'uma pessoa da equipe' : 'a equipe') + (conv.setor ? ' (' + SETORES[conv.setor] + ')' : '') + '. Em breve alguém responde por aqui.' + (dentroHorario() ? '' : ' ' + AVISO_HORARIO)));
      }
    }
    const ult = conv.notificado_em && conv.notificado_em.toMillis ? conv.notificado_em.toMillis() : 0;
    if (conv.atribuido_uid && Date.now() - ult > 60e3) { await ref.set({ notificado_em: FieldValue.serverTimestamp() }, { merge: true }); await notificar(db, [conv.atribuido_uid], (conv.nome || conv.nome_whatsapp || 'Contato') + ' respondeu', entrada, waId); }
    return;
  }

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
  if (msg.type === 'text' && conv.estado !== 'atendente' && PEDE_PESSOA.test(entrada)) {
    await tratar(db, cfg, { ...msg, id: msg.id + '_p', type: 'interactive', interactive: { list_reply: { id: 'atendente' } } }, contato, true); return;
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
    if (tec) { await avisarPessoa(tec.email, 'Chamado pelo WhatsApp ' + prot + ' para você', htmlCh); await notificar(db, [tec.uid], 'Chamado ' + prot, entrada, ''); }
    else await avisarEquipe(cfg, 'Chamado pelo WhatsApp ' + prot + (quem && quem.municipio_nome ? ' · ' + quem.municipio_nome : ''), htmlCh);
    await auditar(db, waId, 'Chamado ' + prot + ' aberto pelo WhatsApp'); await estado('menu'); return;
  }

  // qualquer outro texto: o agente entende o pedido; se for dúvida de uso, vai para o manual
  const pedido = msg.type === 'text' ? await classificar(entrada) : { acao: 'manual' };
  await metricas(db, { ['agente_' + pedido.acao]: FieldValue.increment(1) });
  if (pedido.acao === 'acesso') { await tratar(db, cfg, { ...msg, id: msg.id + '_a', type: 'interactive', interactive: { list_reply: { id: 'acesso' } } }, contato, true); return; }
  if (pedido.acao === 'comercial') { await tratar(db, cfg, { ...msg, id: msg.id + '_c', type: 'interactive', interactive: { list_reply: { id: 'comercial' } } }, contato, true); return; }
  if (pedido.acao === 'humano') { await tratar(db, cfg, { ...msg, id: msg.id + '_h', type: 'interactive', interactive: { list_reply: { id: 'atendente' } } }, contato, true); return; }
  if (pedido.acao === 'chamado') { await responder(texto(await statusChamado(db, waId, pedido.protocolo))); await estado('menu'); return; }
  if (pedido.acao === 'cadastro' || pedido.acao === 'escola') {
    if (!quem) { await responder(texto('Não achei um cadastro no Portal com este WhatsApp. Atualize o WhatsApp em *Meu cadastro* no Portal, ou digite *menu* › *Falar com atendente*.')); await estado('menu'); return; }
    if (pedido.acao === 'cadastro') { await responder(texto(await meuCadastro(db, quem))); await estado('menu'); return; }
    const r = await escolaNaRede(db, quem, pedido.escola);
    await responder(texto(r));
    if (/Vou passar para a equipe/.test(r)) { await ref.set({ assunto: 'suporte' }, { merge: true }); await encaminhar(db, cfg, ref, waId, 'suporte', quemTxt + ': escola não encontrada na rede.', 'Escola informada: ' + (pedido.escola || entrada)); return; }
    await estado('menu'); return;
  }
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
  const waba = ((req.body && req.body.entry) || []).map(e => String(e.id || '')).find(x => /^\d{6,25}$/.test(x));
  if (waba && cfg.waba_id !== waba) tarefas.push(db.doc('wa_config/geral').set({ waba_id: waba }, { merge: true }).catch(() => null));   // conta do WhatsApp Business (para os modelos)
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
    await ref.set({ ultima_equipe_em: FieldValue.serverTimestamp() }, { merge: true });
    // tempo até a 1ª resposta humana depois que o robô passou a conversa
    const desde = conv.aguardando_desde && conv.aguardando_desde.toMillis ? conv.aguardando_desde.toMillis() : 0;
    if (desde) { await metricas(db, { resp_soma_s: FieldValue.increment(Math.round((Date.now() - desde) / 1000)), resp_n: FieldValue.increment(1) }); await ref.update({ aguardando_desde: FieldValue.delete() }); }
  }
  if (encerrar) await metricas(db, { encerradas: FieldValue.increment(1), atendidas_por: { [req.auth.uid]: FieldValue.increment(1) } });
  if (encerrar) {
    await enviar(cfg, waId, texto('Atendimento encerrado. Se precisar de mais alguma coisa, é só digitar *menu*.'));
    await enviar(cfg, waId, PESQUISA).catch(() => {});
    await guardar(ref, 'robo', 'Atendimento encerrado (pesquisa de satisfação enviada)');
  }
  // quem responde uma conversa da fila (sem dono) fica com ela
  const dono = conv.atribuido_uid ? {} : { atribuido_uid: req.auth.uid, atribuido_nome: u.nomeCompleto || quem, atribuido_em: FieldValue.serverTimestamp() };
  await ref.set({ estado: encerrar ? 'menu' : 'atendente', nao_lidas: 0, atendente_uid: req.auth.uid, atendente_nome: quem, ...dono,
    ...(encerrar ? { fila_desde: FieldValue.delete(), atribuido_uid: '', atribuido_nome: '', setor: FieldValue.delete(), aguardando_desde: FieldValue.delete() } : {}) }, { merge: true });
  if (encerrar) await auditar(db, waId, 'Atendimento encerrado por ' + quem);
  return { ok: true };
});

// transferir a conversa: para um membro (para_uid), para o próximo do setor (setor) ou assumir (para_uid = eu)
// teste dos avisos automáticos (só administrador): manda os modelos com valores de exemplo para o WhatsApp de quem pediu.
// Sem modelo aprovado, a Meta só aceita dentro das 24 h depois da última mensagem da pessoa: por isso pede um "oi" antes.
export const whatsappTesteModelos = onCall({ region: REGIAO, secrets: [TOKEN], maxInstances: 2, timeoutSeconds: 60 }, async req => {
  const u = await souAdmin(req), db = getFirestore();
  const cfg = (await db.doc('wa_config/geral').get()).data() || {};
  if (!cfg.ligado || !cfg.phone_number_id) throw new HttpsError('failed-precondition', 'O robô do WhatsApp está desligado.');
  const num = String((req.data || {}).numero || u.whatsapp || '').replace(/\D/g, '');
  if (num.length < 10 || num.length > 13) throw new HttpsError('invalid-argument', 'Informe o WhatsApp com DDD.');
  let waId = '', ult = 0;
  for (const v of variantes(num).filter(x => x.startsWith('55'))) {
    const c = (await db.doc('wa_conversas/' + v).get()).data(); const t = c && c.ultima_pessoa_em && c.ultima_pessoa_em.toMillis ? c.ultima_pessoa_em.toMillis() : 0;
    if (t > ult) { ult = t; waId = v; } }
  if (!waId || Date.now() - ult > 24 * 3600e3) throw new HttpsError('failed-precondition', 'Mande um "oi" deste WhatsApp para o número do Portal e toque de novo. Sem modelo aprovado, a Meta só deixa enviar até 24 h depois da sua última mensagem.');
  let n = 0;
  for (const m of [MODELO_BOAS_VINDAS_WA, MODELO_ALERTA_WA]) {
    await enviar(cfg, waId, { type: 'interactive', interactive: { type: 'cta_url', header: { type: 'text', text: 'Portal do Educador' },
      body: { text: txt(preencherWA(m.corpo, m.exemplo), 1000) }, footer: { text: txt('Teste: ' + m.nome, 60) },
      action: { name: 'cta_url', parameters: { display_text: m.botao || 'Entrar no Portal', url: m.url || URL_ENTRAR } } } });
    n++; await new Promise(r => setTimeout(r, 700));
  }
  const ref = db.doc('wa_conversas/' + waId);
  await guardar(ref, 'equipe', '[teste dos ' + n + ' modelos de aviso automático]', { autor_uid: req.auth.uid, autor_nome: txt(String(u.nome || '').split(' ')[0], 30) });
  await auditar(db, waId, 'Teste dos modelos de aviso automático enviado por ' + txt(u.nome || '', 60) + ' (' + n + ' mensagens)');
  return { enviados: n, final: waId.slice(-4) };
});
// boas-vindas automáticas no WhatsApp (nov/2026): todo cadastro novo (professor, gestão, equipe) com WhatsApp recebe o modelo
// pde_boas_vindas. Sem o modelo aprovado ainda, fica "aguardando" e a rotina tenta de novo por até 3 dias (1 vez por hora).
async function boasVindasWA(db, cfg, uid, u, ref) {
  const vs = variantes(u.whatsapp), para = vs.find(x => x.startsWith('55') && x.length === 13) || vs.find(x => x.startsWith('55'));
  if (!para) { await ref.set({ status: 'sem_numero' }, { merge: true }); return; }
  try {
    await enviar(cfg, para, { type: 'template', template: { name: MODELO_BOAS_VINDAS_WA.nome, language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: txt(String(u.nome || 'professor(a)').trim().split(/\s+/)[0], 40) }] }] } });
    await ref.set({ status: 'enviado', enviado_em: FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    await ref.set({ status: 'aguardando', erro: txt(e.message, 200), tentativas: FieldValue.increment(1), proxima_em: Timestamp.fromMillis(Date.now() + 3600e3) }, { merge: true });
  }
}
export const whatsappBoasVindas = onDocumentWritten({ document: 'usuarios/{uid}', region: REGIAO, secrets: [TOKEN], maxInstances: 5 }, async ev => {
  const a = ev.data.before.exists ? ev.data.before.data() : null, d = ev.data.after.exists ? ev.data.after.data() : null;
  if (!d || !d.whatsapp || (a && a.whatsapp) || d.perfil === 'aluno' || d.municipio_id === 'lab-muni' || String(d.email || '').endsWith('@portaldoeducador.com.br')) return;
  if (a && msTs(a.criado_em) && Date.now() - msTs(a.criado_em) > 7 * 864e5) return;   // só cadastro novo (não quem só acrescentou o número depois)
  const db = getFirestore(), cfg = await config(db); if (!cfg.ligado || !cfg.phone_number_id) return;
  const ref = db.doc('comunicacoes/' + ev.params.uid + '_wa_boas_vindas');
  try { await ref.create({ uid: ev.params.uid, momento: 'cadastro', canal: 'whatsapp', status: 'enviando', em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + 400 * 864e5) }); }
  catch (e) { return; }   // já foi
  await boasVindasWA(db, cfg, ev.params.uid, d, ref);
});
// modelos de mensagem na Meta (só administrador): lista a situação e cadastra os que faltam, com o mesmo texto do Portal
async function wabaDe(db, cfg) {
  if (cfg.waba_id) return cfg.waba_id;
  const r = await fetch(GRAPH + 'debug_token?input_token=' + encodeURIComponent(TOKEN.value()) + '&access_token=' + encodeURIComponent(TOKEN.value()));
  const j = await r.json().catch(() => ({}));
  const g = ((j.data && j.data.granular_scopes) || []).find(x => x.scope === 'whatsapp_business_management');
  const id = g && (g.target_ids || [])[0];
  if (!id) throw new HttpsError('failed-precondition', 'A chave do WhatsApp não tem a permissão de gerenciar modelos (whatsapp_business_management). Gere a chave do usuário do sistema com essa permissão.');
  await db.doc('wa_config/geral').set({ waba_id: String(id) }, { merge: true });
  return String(id);
}
function corpoModelo(m) {
  const url = m.url || URL_ENTRAR;
  return { name: m.nome, language: 'pt_BR', category: m.categoria,
    components: [ { type: 'HEADER', format: 'TEXT', text: 'Portal do Educador' },
      { type: 'BODY', text: m.corpo, example: { body_text: [m.exemplo] } },
      { type: 'FOOTER', text: m.rodape || RODAPE_WA },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: m.botao || 'Entrar no Portal', url }] } ] };
}
export const whatsappModelos = onCall({ region: REGIAO, secrets: [TOKEN], maxInstances: 2, timeoutSeconds: 120 }, async req => {
  const u = await souAdmin(req), db = getFirestore(), cfg = (await db.doc('wa_config/geral').get()).data() || {};
  const waba = await wabaDe(db, cfg), todos = [MODELO_BOAS_VINDAS_WA, MODELO_ALERTA_WA];
  const lista = async () => {
    const r = await fetch(GRAPH + waba + '/message_templates?fields=name,status,category,rejected_reason&limit=200', { headers: { Authorization: 'Bearer ' + TOKEN.value() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpsError('failed-precondition', 'A Meta recusou a consulta dos modelos: ' + txt((j.error && j.error.message) || r.status, 200));
    const m = {}; (j.data || []).forEach(t => { if (t.name) m[t.name] = t; }); return m;
  };
  let meta = await lista(); const erros = [];
  if ((req.data || {}).acao === 'cadastrar') {
    for (const m of todos) {
      if (meta[m.nome]) continue;
      const r = await fetch(GRAPH + waba + '/message_templates', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN.value(), 'Content-Type': 'application/json' }, body: JSON.stringify(corpoModelo(m)) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); erros.push(m.nome + ': ' + txt((j.error && (j.error.error_user_msg || j.error.message)) || r.status, 200)); }
      await new Promise(x => setTimeout(x, 400));
    }
    await auditar(db, 'modelos', 'Modelos de mensagem enviados para aprovação da Meta por ' + txt(u.nome || '', 60) + (erros.length ? ' (' + erros.length + ' com erro)' : ''));
    meta = await lista();
  }
  return { modelos: todos.map(m => ({ nome: m.nome, categoria: m.categoria, status: meta[m.nome] ? meta[m.nome].status : 'NAO_CADASTRADO', motivo: meta[m.nome] && meta[m.nome].rejected_reason !== 'NONE' ? (meta[m.nome].rejected_reason || '') : '' })), erros };
});
export const whatsappTransferir = onCall({ region: REGIAO, secrets: [SMTP_SENHA], maxInstances: 5, timeoutSeconds: 20 }, async req => {
  const u = await souAtendente(req), db = getFirestore(), d = req.data || {};
  const waId = String(d.wa_id || ''), nota = txt(d.nota, 500);
  if (!/^\d{8,15}$/.test(waId)) throw new HttpsError('invalid-argument', 'Conversa inválida.');
  const ref = db.doc('wa_conversas/' + waId), conv = (await ref.get()).data();
  if (!conv) throw new HttpsError('not-found', 'Conversa não encontrada.');
  let alvo = null, setor = SETORES[d.setor] ? d.setor : (conv.setor || 'suporte');
  // devolver para a fila (quadro: soltar o cartão na coluna Fila)
  if (d.fila === true) {
    await ref.set({ estado: 'atendente', setor, atribuido_uid: '', atribuido_nome: '', fila_desde: FieldValue.serverTimestamp(),
      aguardando_desde: conv.aguardando_desde || FieldValue.serverTimestamp() }, { merge: true });
    await guardar(ref, 'sistema', (u.nomeCompleto || u.nome) + ' devolveu a conversa para a fila (' + SETORES[setor] + ')' + (nota ? ': ' + nota : ''));
    await auditar(db, waId, 'Conversa devolvida para a fila por ' + (u.nomeCompleto || u.nome));
    return { ok: true, para: 'a fila', setor };
  }
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
  if (!assumiu) await notificar(db, [alvo.uid], 'Conversa transferida por ' + (u.nome || 'equipe'), (conv.nome || conv.nome_whatsapp || 'Contato') + (nota ? ': ' + nota : ''), waId);
  if (!assumiu) await avisarPessoa(alvo.email, 'WhatsApp: ' + (u.nomeCompleto || u.nome) + ' transferiu uma conversa para você',
    '<p>' + esc(conv.nome || conv.nome_whatsapp || 'Contato') + (conv.municipio_nome ? ' · ' + esc(conv.municipio_nome) : '') + '</p>' + (nota ? '<p>Recado: ' + esc(nota) + '</p>' : '') + '<p>Responda pelo app de atendimento: ' + SITE + '/atendimento/</p>');
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
    let wz = String(d.whatsapp_aviso || '').replace(/\D/g, ''); if (wz.startsWith('55') && wz.length > 11) wz = wz.slice(2);
    if (wz && !/^\d{10,11}$/.test(wz)) throw new HttpsError('invalid-argument', 'WhatsApp para avisos: use DDD + número.');
    await ref.set({ whatsapp_aviso: wz, avisos_wa: !!wz, nome: txt(ud.nome, 80) || email, email, setores, ativo: true, disponivel: antes.exists ? antes.data().disponivel !== false : true,
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

// ---------- rotina (a cada 5 min): ninguém fica no vácuo e conversa parada se encerra sozinha ----------
// Tempos em wa_config/geral (minutos): sla_min (10) sem resposta humana → passa para o próximo do setor (até 2 vezes) e avisa todos;
// fim_humano_min (120) sem a pessoa responder depois da equipe → encerra com pesquisa; fim_robo_min (30) conversa com o robô parada → volta ao menu.
export const whatsappRotina = onSchedule({ region: REGIAO, schedule: 'every 5 minutes', timeZone: 'America/Campo_Grande', secrets: [TOKEN, SMTP_SENHA], timeoutSeconds: 120, memory: '256MiB' }, async () => {
  // boas-vindas que esperavam o modelo ser aprovado: nova tentativa de hora em hora, por até 3 dias
  try {
    const db0 = getFirestore(), cfg0 = await config(db0);
    if (cfg0.ligado && cfg0.phone_number_id) {
      const pend = await db0.collection('comunicacoes').where('status', '==', 'aguardando').where('proxima_em', '<=', Timestamp.now()).limit(10).get();
      for (const doc of pend.docs) { const c = doc.data();
        if (c.canal !== 'whatsapp' || msTs(c.em) < Date.now() - 3 * 864e5) { await doc.ref.set({ status: 'desistiu' }, { merge: true }); continue; }
        const u = (await db0.doc('usuarios/' + c.uid).get()).data(); if (!u) { await doc.ref.set({ status: 'desistiu' }, { merge: true }); continue; }
        await boasVindasWA(db0, cfg0, c.uid, u, doc.ref); }
    }
  } catch (e) { console.warn('whatsapp: boas-vindas pendentes', e.message); }

  const db = getFirestore(), cfg = (await db.doc('wa_config/geral').get()).data() || {};
  if (!cfg.ligado || !cfg.phone_number_id) return;
  const agora = Date.now(), ms = t => (t && t.toMillis ? t.toMillis() : 0);
  const SLA = (cfg.sla_min || 10) * 60e3, FIM_H = (cfg.fim_humano_min || 120) * 60e3, FIM_R = (cfg.fim_robo_min || 30) * 60e3;
  const emAt = await db.collection('wa_conversas').where('estado', '==', 'atendente').get();
  for (const d of emAt.docs) {
    const c = d.data(), ref = d.ref, waId = d.id, dentro24 = agora - ms(c.ultima_pessoa_em) < 23.5 * 3600e3;
    try {
      // 1) ninguém respondeu ainda
      if (c.aguardando_desde) {
        const espera = agora - ms(c.aguardando_desde);
        if (espera < SLA || !dentroHorario()) continue;
        const ultimoAviso = ms(c.sla_aviso_em); if (agora - ultimoAviso < SLA) continue;
        const setor = c.setor || 'suporte', vezes = c.reencaminhada || 0;
        const m = vezes < 2 ? await proximoDoSetor(db, setor, c.atribuido_uid || '') : null;
        await ref.set({ sla_aviso_em: FieldValue.serverTimestamp(), reencaminhada: FieldValue.increment(1),
          ...(m ? { atribuido_uid: m.uid, atribuido_nome: m.nome, atribuido_em: FieldValue.serverTimestamp() } : {}) }, { merge: true });
        const min = Math.round(espera / 60e3), quem = c.nome || c.nome_whatsapp || 'Contato';
        await guardar(ref, 'sistema', (m ? 'Sem resposta há ' + min + ' min: passou para ' + m.nome : 'Sem resposta há ' + min + ' min: toda a equipe do setor foi avisada'));
        if (m) await Promise.all([notificar(db, [m.uid], 'Conversa esperando há ' + min + ' min', quem + ' · ' + SETORES[setor], waId),
          avisarPessoa(m.email, 'WhatsApp: ' + quem + ' espera há ' + min + ' min', '<p>' + esc(quem) + ' espera resposta há ' + min + ' minutos. A conversa passou para você.</p><p>' + SITE + '/atendimento/#c=' + waId + '</p>')]);
        else {
          const sn = await db.collection('wa_equipe').where('setores', 'array-contains', setor).get();
          await notificar(db, sn.docs.filter(x => x.data().ativo === true).map(x => x.id), 'Conversa esperando há ' + min + ' min', quem + ' · ' + SETORES[setor], waId);
          await avisarEquipe(cfg, 'WhatsApp: ' + quem + ' espera há ' + min + ' min sem resposta', '<p>Ninguém respondeu ainda. Assuma pela tela de atendimento: ' + SITE + '/atendimento/</p>');
        }
        if (dentro24 && vezes === 0) await enviar(cfg, waId, texto('Ainda estamos com a sua conversa. Já chamei mais alguém da equipe para responder.')).then(() => guardar(ref, 'robo', 'Aviso de espera enviado')).catch(() => {});
        await alertaWhats(db, cfg, waId, quemDe(c), 'espera resposta há ' + min + ' min').catch(e => console.warn('whatsapp: alerta', e.message));
        await metricas(db, { sla_estouros: FieldValue.increment(1) });
        continue;
      }
      // 2) a equipe respondeu e a pessoa sumiu: encerra com pesquisa
      const ultima = Math.max(ms(c.ultima_pessoa_em), ms(c.ultima_equipe_em));
      if (ultima && agora - ultima > FIM_H && ms(c.ultima_equipe_em) >= ms(c.ultima_pessoa_em)) {
        await ref.set({ estado: 'menu', atribuido_uid: '', atribuido_nome: '', fila_desde: FieldValue.delete(), setor: FieldValue.delete(), nao_lidas: 0 }, { merge: true });
        if (dentro24) {
          await enviar(cfg, waId, texto('Como não tivemos mais retorno, encerrei este atendimento. Se precisar, é só mandar *menu*.')).catch(() => {});
          await enviar(cfg, waId, PESQUISA).catch(() => {});
        }
        await guardar(ref, 'sistema', 'Encerrada por falta de resposta da pessoa');
        await metricas(db, { encerradas_auto: FieldValue.increment(1) });
        await auditar(db, waId, 'Atendimento encerrado por inatividade');
      }
    } catch (e) { console.warn('whatsapp rotina:', waId.slice(-4), e.message); }
  }
  // 3) conversa com o robô parada no meio (esperando a dúvida, o chamado ou os dados comerciais): volta ao menu sem mensagem
  const meio = await db.collection('wa_conversas').where('estado', 'in', ['duvida', 'chamado', 'comercial']).get();
  await Promise.all(meio.docs.filter(d => agora - ms(d.data().ultima_em) > FIM_R).map(d => d.ref.set({ estado: 'menu' }, { merge: true })));
});

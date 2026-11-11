// IA na TV Escola (nov/2026). Dois recursos para quem cuida da TV da escola, sempre com revisão humana antes de ir para a tela:
//   aviso:    a pessoa escreve o recado do jeito que sair; a IA devolve título curto, texto para ler de longe e um emoji.
//   cardapio: a pessoa manda a foto do cardápio da merenda; a IA lê os pratos de cada dia da semana (seg a sex).
// Sem dado de aluno: o recado é da escola, a foto é do cardápio. A foto NÃO é guardada (vai para a IA e é descartada).
// Grátis com uso justo diário (tv_ia, 25 por dia por pessoa; config/portal_ia.tv_ia_dia muda o limite).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { RESERVA_TEXTO, geminiJson, geminiFluxo } from './portal-ia.js';
import { usoJustoDiario } from './creditos.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const PERFIS = ['professor', 'gestor', 'secretaria', 'secretaria_escolar', 'admin'];
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const semCpf = t => t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '');
const S = d => ({ type: 'STRING', description: d });

const ESQ_AVISO = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título curto para a TV, até 40 caracteres, sem emoji, sem ponto final'),
    texto: S('O recado reescrito para ler de longe: frases curtas, até 220 caracteres, com data, hora e local se o original tiver. Não invente nada.'),
    emoji: S('Um único emoji que combine com o assunto'),
    categoria: { type: 'STRING', enum: ['Avisos', 'Eventos', 'Merenda', 'Recados', 'Parabéns', 'Saúde', 'Calendário'], description: 'Assunto do recado' }
  },
  required: ['titulo', 'texto', 'emoji', 'categoria']
};
const ESQ_CARDAPIO = {
  type: 'OBJECT',
  properties: {
    legivel: { type: 'BOOLEAN', description: 'false se a foto não é um cardápio ou não dá para ler' },
    semana: S('Período escrito no cardápio, se houver (ex.: "11 a 15 de novembro"); vazio se não houver'),
    dias: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      dia: { type: 'INTEGER', description: '1 = segunda, 2 = terça, 3 = quarta, 4 = quinta, 5 = sexta' },
      itens: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Pratos do dia como estão no cardápio (ex.: "Arroz", "Feijão", "Frango ao molho", "Salada de alface"), no máximo 8' },
      lanche: S('Lanche ou fruta à parte, se o cardápio separar; vazio se não houver')
    }, required: ['dia', 'itens'] } }
  },
  required: ['legivel', 'dias']
};

export const tvIA = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 90, memory: '512MiB', maxInstances: 10 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const [us, cs] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc('config/portal_ia').get()]);
  const u = us.exists ? us.data() : null, cfgRaw = cs.exists ? cs.data() : {};
  if (!u || u.status !== 'ativo' || !PERFIS.includes(u.perfil)) throw new HttpsError('permission-denied', 'Recurso para quem cuida da TV da escola.');
  if (!['aviso', 'cardapio'].includes(d.acao)) throw new HttpsError('invalid-argument', 'Ação inválida.');
  const admin = u.perfil === 'admin';
  if (!admin && cfgRaw.ativo === false) throw new HttpsError('failed-precondition', 'A IA está em manutenção. Tente mais tarde.');
  const modelos = [cfgRaw.modelo_texto || 'gemini-3.6-flash', ...RESERVA_TEXTO];

  // valida a entrada antes de gastar o uso do dia
  let recado = '', foto = '', mime = 'image/jpeg';
  if (d.acao === 'aviso') {
    recado = semCpf(txt(d.texto, 800));
    if (recado.length < 8) throw new HttpsError('invalid-argument', 'Escreva o recado com um pouco mais de detalhe.');
  } else {
    foto = String(d.imagem || '').replace(/^data:[^,]*,/, '');
    if (/^data:image\/png/.test(String(d.imagem || ''))) mime = 'image/png';
    if (foto.length < 2000 || foto.length > 6e6 || !/^[A-Za-z0-9+/=]+$/.test(foto.slice(0, 200))) throw new HttpsError('invalid-argument', 'Foto inválida ou grande demais. Tire de novo, mais de perto.');
  }
  const uj = await usoJustoDiario(db, { uid, admin, cfgRaw }, 'tv_ia', 25);
  if (!uj.ok) throw new HttpsError('resource-exhausted', 'Você chegou ao limite de ' + uj.limite + ' usos da IA na TV hoje. Amanhã libera de novo.');

  try {
    if (d.acao === 'aviso') {
      const sistema = 'Você ajuda a direção de uma escola pública brasileira a montar recados para a TV do pátio, que alunos, pais e professores leem de longe, de passagem. ' +
        'Reescreva o recado com clareza, tom acolhedor e respeitoso, frases curtas, português do Brasil correto. Regras: mantenha TODAS as informações (data, horário, local, o que levar); ' +
        'NÃO invente data, horário, nome ou detalhe que não esteja no recado; não use nome completo de aluno (se houver, use só o primeiro nome); sem hashtags; no máximo um emoji, só no campo emoji.';
      const r = await geminiJson(GEMINI.value(), modelos, sistema, 'Recado escrito pela escola:\n"""' + recado + '"""', ESQ_AVISO, undefined, 45000);
      const j = r.json;
      if (!j || !j.texto) throw new HttpsError('unavailable', 'A IA não conseguiu montar o aviso. Tente de novo.');
      return { ok: true, titulo: txt(j.titulo, 50), texto: txt(j.texto, 280), emoji: txt(j.emoji, 8), categoria: txt(j.categoria, 20) };
    }

    const sistema = 'Você lê fotos de cardápios de merenda escolar de escolas públicas brasileiras. Extraia os pratos de cada dia útil (segunda a sexta), exatamente como escritos, ' +
      'corrigindo só a ortografia evidente. Não invente pratos. Se um dia não aparece ou não dá para ler, deixe-o de fora. Se a foto não for um cardápio, legivel = false.';
    const corpo = {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: foto } }, { text: 'Leia este cardápio e devolva os pratos de cada dia da semana.' }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: ESQ_CARDAPIO, maxOutputTokens: 8000 }
    };
    const r = await geminiFluxo(GEMINI.value(), modelos, corpo, 60000);
    let j = null; try { j = JSON.parse(r.partes.map(p => p.text || '').join('')); } catch (e) { j = null; }
    if (!j) throw new HttpsError('unavailable', 'A IA não conseguiu ler a foto. Tente de novo.');
    const vistos = new Set();
    const dias = (Array.isArray(j.dias) ? j.dias : []).filter(x => x && x.dia >= 1 && x.dia <= 5 && !vistos.has(x.dia) && vistos.add(x.dia))
      .map(x => ({ dia: x.dia, itens: (x.itens || []).map(i => txt(i, 60)).filter(Boolean).slice(0, 8), lanche: txt(x.lanche, 80) }))
      .filter(x => x.itens.length).sort((a, b) => a.dia - b.dia);
    if (j.legivel === false || !dias.length) { await uj.desfazer(); return { ok: false, motivo: 'Não consegui ler um cardápio nesta foto. Tire de novo, de frente, com boa luz e o cardápio inteiro no quadro.' }; }
    return { ok: true, semana: txt(j.semana, 60), dias };
  } catch (e) {
    await uj.desfazer();
    if (e instanceof HttpsError) throw e;
    console.error('tvIA', d.acao, e && e.message);
    throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo.');
  }
});

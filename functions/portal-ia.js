// Portal IA · a ferramenta única do professor, com a IA embarcada.
// Uma caixa "O que você precisa para sua aula?" + atalhos. A IA entende o pedido, pergunta só o que falta,
// e devolve um DOCUMENTO num formato único (seções, questões, tabela, gabarito). O Portal mostra, deixa editar
// e monta o PDF com a identidade da escola. Imagem só para os planos que a incluem.
// Independente da IA do Educador (ia-educador.js), que fica guardada como está.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const GEMINI = defineSecret('GEMINI_API_KEY');

// config/portal_ia sobrepõe tudo isto. Cotas por professor por mês, por plano do município.
export const PADRAO = {
  ativo: true, todos: false, municipios: ['lab-muni'],
  modelo_texto: 'gemini-3.6-flash', modelo_rapido: 'gemini-3.1-flash-lite', modelo_imagem: 'gemini-3.1-flash-image',
  planos: { basico: { textos: 30, imagens: 0 }, intermediario: { textos: 80, imagens: 10 }, completo: { textos: 200, imagens: 40 }, personalizado: { textos: 80, imagens: 10 } }
};
// o Google desliga versões antigas; se a escolhida sumir, a função tenta a próxima sem o professor ver erro
const RESERVA_TEXTO = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const RESERVA_IMAGEM = ['gemini-3.1-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

/* ------------------------------------------------------------------ o que o Portal IA sabe fazer */
export const TIPOS = {
  plano: { nome: 'Plano de aula', publico: 'professor', instrucao:
'Escreva um PLANO DE AULA pronto para entregar à coordenação. Seções, nesta ordem: "Identificação" (tabela com Componente, Série, Duração e Tema); "Habilidades da BNCC" (itens); "Objetivos de aprendizagem" (itens começando com verbo); "Conteúdos" (itens); "Materiais" (itens simples, do que a escola pública tem); "Desenvolvimento" (itens numerados por momento, cada um com o tempo em minutos e o que o professor faz e o que os alunos fazem); "Avaliação" (como saber se aprenderam); "Adaptações para inclusão" (itens práticos). Tempos somando a duração pedida.' },
  sequencia: { nome: 'Sequência didática', publico: 'professor', instrucao:
'Escreva uma SEQUÊNCIA DIDÁTICA. Primeira seção "Visão geral" (tabela com Componente, Série, Número de aulas, Produto final; e o texto com o objetivo geral). Depois UMA seção por aula, com o título "Aula N: <tema da aula>", trazendo nos itens: objetivo, atividade principal, tempo, recursos e como avaliar. Última seção "Produto final e avaliação". Aulas encadeadas, da sondagem ao produto final.' },
  atividade: { nome: 'Atividade com gabarito', publico: 'aluno', questoes: true, instrucao:
'Escreva uma FICHA DE ATIVIDADE para o aluno. Primeira seção "Para lembrar" com a ideia central em até 3 frases curtas (texto). Segunda seção "Atividades" com as questões, alternando os tipos (multipla, vf, lacuna, curta, relacionar, aberta), em dificuldade crescente, com pelo menos uma questão que pede para explicar com as próprias palavras. Gabarito completo em "gabarito", nunca dentro das questões.' },
  prova: { nome: 'Prova com gabarito', publico: 'aluno', questoes: true, instrucao:
'Escreva uma AVALIAÇÃO (prova). Uma seção "Questões" com as questões numeradas, cada uma com o "valor" em pontos (a soma dos valores é 10, salvo outro total pedido). Mistura de tipos, maioria objetiva, ao menos uma dissertativa curta. Enunciados claros e completos, sem pegadinhas. Gabarito completo em "gabarito", com o critério de correção das dissertativas no comentário.' },
  parecer: { nome: 'Parecer do aluno', publico: 'professor', instrucao:
'Escreva um PARECER DESCRITIVO do aluno, em linguagem respeitosa, objetiva e acolhedora, baseado SOMENTE nas observações que o professor escreveu: não invente fatos, comportamentos nem dificuldades. Seções: "Aspectos cognitivos", "Aspectos socioemocionais", "Participação e autonomia", "Encaminhamentos" (o que a escola e a família podem fazer). Use só o primeiro nome do aluno, como o professor escreveu. Sem diagnóstico médico ou psicológico.' },
  inclusao: { nome: 'Adaptação para inclusão', publico: 'aluno', questoes: true, instrucao:
'ADAPTE o conteúdo ou a atividade indicada para a necessidade informada. Seção "Atividade adaptada" com as questões ou o texto já adaptados (enunciados curtos, uma instrução por vez, apoio visual descrito, linguagem literal, espaço para responder). Depois a seção "Orientações ao professor" (itens práticos de mediação). Sem diagnóstico, sem rótulos: fale da necessidade, não da pessoa.' },
  redacao: { nome: 'Correção de redação', publico: 'professor', instrucao:
'CORRIJA a redação que o professor colou. Seções: "Avaliação por critério" (tabela com Critério, Nota e Comentário; use as 5 competências do ENEM com notas de 0 a 200 se for Ensino Médio, ou critérios simples de 0 a 10 adequados à série nos demais casos); "Pontos fortes" (itens citando trechos curtos do texto); "O que melhorar" (itens, cada um com o trecho e a sugestão); "Devolutiva para o aluno" (texto direto ao aluno, encorajador e específico). Não reescreva a redação inteira. Não invente trechos que não estão no texto.' },
  recado: { nome: 'Recado aos pais', publico: 'familia', instrucao:
'Escreva um COMUNICADO aos pais e responsáveis, formal e acolhedor, curto (até 120 palavras), com o assunto, data, horário e o que a família precisa fazer, quando informados. Uma seção "Comunicado" com o texto. Em "versao_whatsapp" escreva a mesma mensagem em até 60 palavras, para mandar no grupo, sem emoji excessivo (no máximo 2).' },
  explicar: { nome: 'Explicação do conteúdo', publico: 'aluno', instrucao:
'Escreva uma EXPLICAÇÃO do conteúdo para o aluno da série informada. Seções: "O que é" (texto claro, frases curtas), "Como funciona" ou "Passo a passo" (itens), "Exemplos do dia a dia" (itens), "Palavras importantes" (tabela com Palavra e Significado), "Teste rápido" (3 questões curtas, com as respostas no gabarito). Nada de informação incerta como se fosse certa.' }
};
const NOMES = Object.keys(TIPOS);

const REGRAS_GERAIS =
'REGRAS DA CASA\n1) Português do Brasil, frases curtas e claras, linguagem adequada à série. Sem travessão como conector de frase.\n2) Conteúdo correto e atualizado. Na dúvida, não afirme.\n3) Código da BNCC só se tiver certeza de que é real e do ano certo; se não tiver, deixe o código vazio e descreva a habilidade.\n4) Nunca invente citação entre aspas atribuída a pessoa real, nem dado, lei, livro ou site.\n5) Matemática: recalcule todas as contas; vírgula decimal. Ciências: experimento só com material caseiro seguro e supervisão de adulto. História: datas e nomes verificáveis, temas sensíveis com seriedade.\n6) Contexto de escola pública brasileira: material simples, nada que dependa de equipamento caro.\n7) Responda somente no formato JSON pedido.';

const S = d => ({ type: 'STRING', description: d });
const AS = d => ({ type: 'ARRAY', items: { type: 'STRING' }, description: d });
export const ESQUEMA_DOC = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título curto e claro do material'),
    subtitulo: S('Uma linha: disciplina, série e tema, ou vazio'),
    secoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      titulo: S('Título da seção'),
      texto: S('Parágrafos da seção (pode ser vazio)'),
      itens: AS('Lista de itens da seção (pode ser vazia)'),
      questoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        tipo: { type: 'STRING', enum: ['multipla', 'vf', 'lacuna', 'curta', 'relacionar', 'aberta'] },
        enunciado: S('Enunciado completo; em lacuna use ______ no lugar de cada palavra que falta'),
        alternativas: AS('multipla: exatamente 4 alternativas, sem letra na frente; vf: de 3 a 5 afirmativas; demais: vazio'),
        coluna_a: AS('relacionar: de 3 a 5 itens'), coluna_b: AS('relacionar: os correspondentes, embaralhados'),
        linhas: { type: 'INTEGER', description: 'linhas para responder: curta 2, aberta 4, demais 0' },
        valor: { type: 'NUMBER', description: 'pontos da questão (só em prova)' }
      }, required: ['tipo', 'enunciado'] } },
      tabela: { type: 'OBJECT', properties: { colunas: AS('cabeçalho'), linhas: { type: 'ARRAY', items: { type: 'OBJECT', properties: { celulas: AS('células da linha') } } } } }
    }, required: ['titulo'] } },
    gabarito: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      questao: { type: 'INTEGER', description: 'número da questão, contando todas as questões do documento a partir de 1' },
      resposta: S('multipla: a letra; vf: V, F, V; lacuna: as palavras; relacionar: 1-C, 2-A; demais: a resposta esperada'),
      comentario: S('por que, em uma ou duas frases, ou o critério de correção') }, required: ['questao', 'resposta'] } },
    bncc: { type: 'ARRAY', items: { type: 'OBJECT', properties: { codigo: S('ex.: EF06CI04, ou vazio'), descricao: S('a habilidade em uma frase') } } },
    nota_professor: S('Uma ou duas dicas de uso para o professor (pode ser vazio)'),
    versao_whatsapp: S('Só no recado aos pais: a versão curta para o WhatsApp'),
    sugestao_imagem: S('Uma ilustração que combinaria com o material, em uma frase')
  },
  required: ['titulo', 'secoes']
};
const ESQUEMA_ENTENDER = {
  type: 'OBJECT',
  properties: {
    tipo: { type: 'STRING', enum: [...NOMES, 'fora'] },
    tema: S('O tema ou conteúdo central, curto'),
    resumo: S('O pedido completo reescrito com clareza, com TUDO o que o professor informou'),
    perguntas: { type: 'ARRAY', description: 'no máximo 2, só o que for indispensável e não estiver no pedido nem no contexto', items: { type: 'OBJECT', properties: {
      id: S('identificador curto, sem espaço'), pergunta: S('a pergunta, curta e direta'),
      opcoes: AS('de 2 a 5 respostas prontas para tocar (pode ser vazio quando a resposta é livre)'),
      livre: { type: 'BOOLEAN', description: 'true quando o professor precisa escrever (ex.: colar a redação, observações sobre o aluno)' } }, required: ['id', 'pergunta'] } },
    mensagem: S('Só quando tipo = fora: explique em uma frase o que o Portal IA faz')
  },
  required: ['tipo', 'resumo']
};

/* ------------------------------------------------------------------ chamadas ao Gemini */
async function gemini(chave, modelos, corpo) {
  for (const mod of [...new Set(modelos.filter(Boolean))]) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mod) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(110000) });
    if (r.status === 404) { console.warn('portal-ia: modelo fora do ar', mod); continue; }
    const j = await r.json().catch(() => ({}));
    // se o modelo não aceitar o ajuste de raciocínio, repete a chamada sem ele
    if (r.status === 400 && corpo.generationConfig && corpo.generationConfig.thinkingConfig && /think/i.test(JSON.stringify(j))) {
      console.warn('portal-ia: sem thinkingConfig em', mod); const c2 = JSON.parse(JSON.stringify(corpo)); delete c2.generationConfig.thinkingConfig; return gemini(chave, [mod, ...modelos.filter(m => m !== mod)], c2);
    }
    if (!r.ok) { console.error('portal-ia gemini', mod, r.status, JSON.stringify(j).slice(0, 400)); throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.'); }
    const u = j.usageMetadata || {}, cand = (j.candidates || [])[0] || {};
    const partes = (cand.content || {}).parts || [];
    return { modelo: mod, partes, fim: cand.finishReason || '', pensou: u.thoughtsTokenCount || 0, entrada: u.promptTokenCount || 0, saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
  }
  throw new HttpsError('unavailable', 'Nenhum modelo da IA está disponível agora. Avise a NEWPC.');
}
async function geminiJson(chave, modelos, sistema, pedido, esquema, temp) {
  const r = await gemini(chave, modelos, { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: pedido }] }],
    generationConfig: { temperature: temp ?? 0.6, responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 32000, thinkingConfig: { thinkingLevel: 'low' } } });
  const bruto = r.partes.filter(p => !p.thought).map(p => p.text || '').join('');
  let json = null; try { json = JSON.parse(bruto); } catch (e) { json = null; console.warn('portal-ia: JSON inválido', r.modelo, 'fim', r.fim, 'pensou', r.pensou, 'tamanho', bruto.length, bruto.slice(-200)); }
  return { ...r, json };
}

/* ------------------------------------------------------------------ limpeza e conferência */
const semMarca = t => String(t ?? '').replace(/^\s*(\(\s*\)|\[\s*\]|[A-Ea-e][).]|\d+[).])\s*/, '').trim();
export function limparDoc(d) {
  (d.secoes || []).forEach(s => (s.questoes || []).forEach(q => ['alternativas', 'coluna_a', 'coluna_b'].forEach(k => { if (Array.isArray(q[k])) q[k] = q[k].map(semMarca).filter(Boolean); })));
  return d;
}
export function conferirDoc(d, tipo, qtd) {
  const prob = [];
  if (!d || typeof d !== 'object') return ['resposta incompleta'];
  if (!String(d.titulo || '').trim()) prob.push('sem título');
  const secoes = Array.isArray(d.secoes) ? d.secoes : [];
  if (!secoes.length) prob.push('sem conteúdo');
  const qs = secoes.flatMap(s => s.questoes || []);
  if (TIPOS[tipo] && TIPOS[tipo].questoes && tipo !== 'inclusao') {
    if (!qs.length) prob.push('sem questões');
    if (qtd && Math.abs(qs.length - qtd) > 1) prob.push('veio com ' + qs.length + ' questões em vez de ' + qtd);
    const gab = Array.isArray(d.gabarito) ? d.gabarito : [];
    if (gab.length < qs.length) prob.push('gabarito incompleto');
  }
  qs.forEach((q, i) => {
    const n = i + 1, alt = (q.alternativas || []).filter(a => String(a).trim());
    if (!String(q.enunciado || '').trim()) prob.push('questão ' + n + ' sem enunciado');
    if (q.tipo === 'multipla' && alt.length !== 4) prob.push('questão ' + n + ' de múltipla escolha sem 4 alternativas');
    if (q.tipo === 'relacionar' && ((q.coluna_a || []).length < 2 || (q.coluna_a || []).length !== (q.coluna_b || []).length)) prob.push('questão ' + n + ' de relacionar com colunas desiguais');
  });
  if (tipo === 'prova' && qs.length) { const soma = qs.reduce((a, q) => a + (Number(q.valor) || 0), 0); if (soma > 0 && Math.abs(soma - 10) > 0.05 && !/total|pontos|valendo/i.test(d._pedido || '')) prob.push('valores somando ' + soma + ' em vez de 10'); }
  return prob;
}

/* ------------------------------------------------------------------ quem pode, quanto pode */
const mesAtual = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '');
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
async function contexto(db, uid) {
  const [us, cs] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc('config/portal_ia').get()]);
  const eu = us.exists ? us.data() : null;
  if (!eu || eu.status !== 'ativo' || !['professor', 'gestor', 'admin'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'O Portal IA é para professores e gestores com cadastro ativo.');
  const c = cs.exists ? cs.data() : {};
  const cfg = { ...PADRAO, ...c, planos: { ...PADRAO.planos, ...(c.planos || {}) } };
  const admin = eu.perfil === 'admin';
  if (!admin && !cfg.ativo) throw new HttpsError('failed-precondition', 'O Portal IA está em manutenção.');
  if (!admin && !cfg.todos && !(cfg.municipios || []).includes(eu.municipio_id)) throw new HttpsError('failed-precondition', 'O Portal IA ainda não foi liberado para a sua rede.');
  let plano = 'basico';
  if (admin) plano = 'completo';
  else if (eu.municipio_id) { const m = await db.doc(`municipios/${eu.municipio_id}`).get(); plano = (m.exists && m.data().plano_nome) || 'basico'; }
  else if (eu.plano_avulso) plano = eu.plano_avulso;
  const limites = cfg.planos[plano] || cfg.planos.basico;
  return { eu, cfg, admin, plano, limites, usoRef: db.doc(`portal_ia_uso/${uid}_${mesAtual()}`) };
}
// reserva 1 da cota (texto ou imagem); devolve se a geração falhar
async function reservar(db, ctx, campo) {
  if (ctx.admin) return;
  const lim = ctx.limites[campo] || 0;
  if (lim <= 0) throw new HttpsError('permission-denied', campo === 'imagens' ? 'Gerar imagens não faz parte do plano da sua rede.' : 'O plano da sua rede não inclui o Portal IA.');
  const ok = await db.runTransaction(async t => { const s = await t.get(ctx.usoRef); const n = (s.exists && s.data()[campo]) || 0;
    if (n >= lim) return false; t.set(ctx.usoRef, { uid: ctx.uid, [campo]: n + 1, mes: mesAtual(), municipio_id: ctx.eu.municipio_id || '', plano: ctx.plano, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }); return true; });
  if (!ok) throw new HttpsError('resource-exhausted', campo === 'imagens' ? 'Você já usou as ' + lim + ' imagens deste mês.' : 'Você já usou os ' + lim + ' materiais deste mês no Portal IA.');
}
async function registrar(ctx, campo, falhou, entrada, saida) {
  await ctx.usoRef.set({ uid: ctx.uid, tokens_entrada: FieldValue.increment(entrada || 0), tokens_saida: FieldValue.increment(saida || 0),
    ...(falhou && !ctx.admin && campo ? { [campo]: FieldValue.increment(-1), falhas: FieldValue.increment(1) } : {}), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
}
function quotaRestante(ctx, uso) {
  if (ctx.admin) return { plano: ctx.plano, textos: null, imagens: null };
  const u = uso || {};
  return { plano: ctx.plano, textos: Math.max(0, (ctx.limites.textos || 0) - (u.textos || 0)), imagens: Math.max(0, (ctx.limites.imagens || 0) - (u.imagens || 0)) };
}
function contextoTexto(cx) {
  return ['Disciplina: ' + (cx.disciplina || 'não informada'), 'Série: ' + (cx.serie || 'não informada'), cx.turma ? 'Turma: ' + cx.turma : '', cx.necessidade ? 'Necessidade da turma: ' + cx.necessidade : '']
    .filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ a função */
export const portalIa = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 240, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const ctx = await contexto(db, uid); ctx.uid = uid;
  const cx = { disciplina: txt(d.contexto && d.contexto.disciplina, 60), serie: txt(d.contexto && d.contexto.serie, 30), turma: txt(d.contexto && d.contexto.turma, 60), necessidade: txt(d.contexto && d.contexto.necessidade, 60) };
  const chave = GEMINI.value();

  // 0) como está a cota (a tela mostra ao abrir)
  if (d.acao === 'cota') { const s = await ctx.usoRef.get(); return quotaRestante(ctx, s.exists ? s.data() : {}); }

  // 1) entender o pedido: tipo, tema e no máximo 2 perguntas (modelo rápido, não conta na cota)
  if (d.acao === 'entender') {
    const texto = txt(d.texto, 6000), tipoDado = NOMES.includes(d.tipo) ? d.tipo : '';
    if (texto.length < 3 && !tipoDado) throw new HttpsError('invalid-argument', 'Escreva o que você precisa.');
    const sistema = 'Você é o assistente do Portal IA, que ajuda professores de escolas públicas brasileiras. Sua tarefa agora é ENTENDER o pedido e classificá-lo num destes tipos: ' +
      NOMES.map(k => k + ' (' + TIPOS[k].nome + ')').join(', ') + '. Use "fora" só se o pedido não tiver relação com o trabalho do professor.\n' +
      'Pergunte no máximo 2 coisas, e só o que for indispensável e não estiver no pedido nem no contexto. Série e disciplina já estão no contexto: não pergunte. ' +
      'Exemplos do que costuma ser indispensável: na correção de redação, o texto da redação (livre); no parecer, as observações do professor sobre o aluno (livre); na adaptação, a necessidade e o que adaptar; no recado, o assunto e a data quando houver evento. ' +
      'Para atividade e prova, se a quantidade de questões não foi dita, NÃO pergunte: use 6 na atividade e 10 na prova. Responda somente no formato JSON pedido.';
    const pedido = 'CONTEXTO\n' + contextoTexto(cx) + (tipoDado ? '\nTipo escolhido pelo professor no atalho: ' + tipoDado : '') + '\n\nPEDIDO DO PROFESSOR\n' + (texto || '(o professor só tocou no atalho)') +
      (d.respostas && typeof d.respostas === 'object' ? '\n\nRESPOSTAS ÀS PERGUNTAS ANTERIORES\n' + Object.entries(d.respostas).slice(0, 4).map(([k, v]) => k + ': ' + txt(v, 6000)).join('\n') : '');
    const r = await geminiJson(chave, [ctx.cfg.modelo_rapido, ...RESERVA_TEXTO], sistema, pedido, ESQUEMA_ENTENDER, 0.2);
    await registrar(ctx, null, false, r.entrada, r.saida);
    const j = r.json || {};
    let tipo = tipoDado || j.tipo; if (!NOMES.includes(tipo) && tipo !== 'fora') tipo = 'explicar';
    const perguntas = (Array.isArray(j.perguntas) ? j.perguntas : []).slice(0, 2).map(p => ({ id: txt(p.id, 30).replace(/\W+/g, '_') || 'p', pergunta: txt(p.pergunta, 200), opcoes: (p.opcoes || []).slice(0, 5).map(o => txt(o, 80)), livre: !!p.livre }));
    return { tipo, nome: TIPOS[tipo] ? TIPOS[tipo].nome : '', tema: txt(j.tema, 160), resumo: txt(j.resumo, 6000), perguntas: d.respostas ? [] : perguntas, mensagem: txt(j.mensagem, 300) };
  }

  // 2) gerar o documento (conta 1 na cota de textos)
  if (d.acao === 'gerar' || d.acao === 'ajustar') {
    let tipo = d.tipo, resumo = txt(d.resumo, 12000), tema = txt(d.tema, 160), anterior = null, docRef = null;
    if (d.acao === 'ajustar') {
      docRef = db.doc(`portal_ia_docs/${txt(d.id, 64)}`); const s = await docRef.get();
      if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.');
      anterior = s.data(); tipo = anterior.tipo; tema = anterior.tema; resumo = anterior.resumo;
    }
    if (!TIPOS[tipo]) throw new HttpsError('invalid-argument', 'Tipo de material inválido.');
    if (resumo.length < 3) throw new HttpsError('invalid-argument', 'Pedido vazio.');
    const qtd = Math.min(20, Math.max(0, Number(d.qtd) || (tipo === 'prova' ? 10 : tipo === 'atividade' ? 6 : 0)));
    await reservar(db, ctx, 'textos');
    const T = TIPOS[tipo];
    const sistema = 'Você é um professor experiente da educação básica brasileira e autor de material didático. ' + T.instrucao + '\n\n' + REGRAS_GERAIS;
    let pedido = 'CONTEXTO\n' + contextoTexto(cx) + '\n\nPEDIDO\n' + resumo + (qtd && T.questoes ? '\nQuantidade de questões: ' + qtd + '.' : '');
    if (anterior) pedido += '\n\nMATERIAL ATUAL (em JSON)\n' + JSON.stringify(anterior.doc).slice(0, 60000) + '\n\nAJUSTE PEDIDO PELO PROFESSOR\n' + txt(d.instrucao, 1000) +
      '\nDevolva o material inteiro já ajustado, no mesmo formato, mudando só o que o ajuste pede.';
    let r = null, prob = ['sem resposta'], ent = 0, sai = 0, erro = null;
    try {
      for (let t = 0; t < 2; t++) {
        r = await geminiJson(chave, [ctx.cfg.modelo_texto, ...RESERVA_TEXTO], sistema, pedido + (t ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' : ''), ESQUEMA_DOC, 0.6);
        ent += r.entrada; sai += r.saida;
        if (r.json) r.json._pedido = resumo;
        prob = r.json ? conferirDoc(r.json, tipo, anterior ? 0 : qtd) : ['resposta incompleta, ' + (r.fim || 'sem motivo') + ', ' + r.saida + ' tokens'];
        if (!prob.length) break;
        console.warn('portal-ia: conferência reprovou', tipo, prob.join('; '));
      }
    } catch (e) { erro = e; }
    const falhou = !!erro || prob.length > 0;
    await registrar(ctx, 'textos', falhou, ent, sai);
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
    if (prob.length) throw new HttpsError('internal', 'A IA devolveu o material com problema (' + prob[0] + '). Tente de novo.');
    const doc = limparDoc(r.json); delete doc._pedido;
    const reg = { uid, tipo, tipo_nome: T.nome, publico: T.publico, titulo: txt(doc.titulo, 160), tema: tema || txt(doc.titulo, 120), resumo, contexto: cx, doc,
      modelo: r.modelo, tokens_entrada: FieldValue.increment(ent), tokens_saida: FieldValue.increment(sai), atualizado_em: FieldValue.serverTimestamp() };
    if (anterior) { await docRef.set({ ...reg, ajustes: FieldValue.increment(1), anterior: anterior.doc }, { merge: true }); }
    else { docRef = db.collection('portal_ia_docs').doc(); await docRef.set({ ...reg, imagem: '', favorito: false, ajustes: 0, criado_em: FieldValue.serverTimestamp() }); }
    const s = await ctx.usoRef.get();
    return { id: docRef.id, tipo, nome: T.nome, publico: T.publico, doc, cota: quotaRestante(ctx, s.exists ? s.data() : {}) };
  }

  // 3) imagem para a aula (só nos planos que incluem; conta na cota de imagens)
  if (d.acao === 'imagem') {
    const descricao = txt(d.descricao, 600); if (descricao.length < 5) throw new HttpsError('invalid-argument', 'Descreva a imagem.');
    const estilos = { didatica: 'ilustração didática colorida, traço limpo, fundo claro', colorir: 'desenho para colorir: só contornos pretos grossos sobre fundo branco, sem sombras nem cores', realista: 'fotografia realista e natural', cartoon: 'desenho animado infantil, alegre e acolhedor' };
    const estilo = estilos[d.estilo] || estilos.didatica;
    const docId = txt(d.id, 64);
    let docRef = null;
    if (docId) { docRef = db.doc(`portal_ia_docs/${docId}`); const s = await docRef.get(); if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.'); }
    await reservar(db, ctx, 'imagens');
    const prompt = 'Crie uma imagem para uso em sala de aula de escola brasileira, adequada para crianças e adolescentes. Assunto: ' + descricao + '. Estilo: ' + estilo +
      '. Formato horizontal 4:3. NÃO escreva palavras, letras nem números na imagem. Nada de violência, marcas comerciais ou pessoas reais conhecidas. Pessoas, quando houver, diversas e representando o Brasil.';
    let r = null, erro = null;
    try { r = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }); }
    catch (e) { erro = e; }
    const parte = r && r.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
    await registrar(ctx, 'imagens', !!erro || !parte, r && r.entrada, r && r.saida);
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora.');
    if (!parte) throw new HttpsError('internal', 'A IA não devolveu a imagem desta vez (às vezes ela recusa um assunto). Tente descrever de outro jeito.');
    const ext = /png/.test(parte.inlineData.mimeType) ? 'png' : 'jpg';
    const caminho = `portal-ia/${uid}/${docId || 'avulsa'}-${Date.now()}.${ext}`;
    await getStorage().bucket().file(caminho).save(Buffer.from(parte.inlineData.data, 'base64'), { contentType: parte.inlineData.mimeType, resumable: false, metadata: { cacheControl: 'private, max-age=86400' } });
    if (docRef) await docRef.set({ imagem: caminho, imagem_descricao: descricao, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    const s = await ctx.usoRef.get();
    return { caminho, mime: parte.inlineData.mimeType, dados: parte.inlineData.data, cota: quotaRestante(ctx, s.exists ? s.data() : {}) };
  }

  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

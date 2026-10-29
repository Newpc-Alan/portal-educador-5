// IA do Educador · a IA integrada do Portal.
// Princípio: a IA escreve o CONTEÚDO (questões, textos, gabarito) num formato combinado (JSON);
// o Portal confere, monta a folha em PDF com a identidade da escola e guarda o material.
// O comando fica aqui no servidor: o professor nunca vê nem copia, e a chave da API mora no cofre (GEMINI_API_KEY).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const GEMINI = defineSecret('GEMINI_API_KEY');

// configuração padrão (config/ia no Firestore sobrepõe): piloto restrito ao laboratório e aos administradores
export const PADRAO_IA = { ativo: true, modelo: 'gemini-3.6-flash', limite_mensal: 60, municipios: ['lab-muni'], todos: false };
// o Google desliga versões de modelo (o 2.5 saiu do ar em 16/10/2026): se o modelo escolhido não existir mais, tenta os seguintes
const RESERVAS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

const AREAS = {
  ciencias: { nome: 'Ciências', regras:
'REGRAS DE CIÊNCIAS\n1) Informações científicas corretas e atualizadas, com os nomes oficiais dos fenômenos e das estruturas; sem mitos escolares (usamos o cérebro inteiro; a língua não tem zonas de sabor; as estações vêm da inclinação do eixo da Terra).\n2) Qualquer experimento sugerido usa só material caseiro seguro (água, sal, açúcar, vinagre, bicarbonato, papel, copos plásticos) e indica a supervisão de um adulto. Nada de fogo, vidro, objeto cortante ou produto de limpeza.' },
  matematica: { nome: 'Matemática', regras:
'REGRAS DA MATEMÁTICA ESCOLAR\n1) Recalcule uma a uma todas as contas e respostas antes de entregar: conta errada invalida o material.\n2) Use só operações, números e conceitos do ano informado (BNCC de Matemática).\n3) Notação brasileira: vírgula decimal (2,5), x para multiplicar nos anos iniciais, ÷ ou fração conforme o nível.\n4) Situações do cotidiano brasileiro real, sem marcas de empresas.' },
  historia: { nome: 'História', regras:
'REGRAS DO RIGOR HISTÓRICO\n1) Datas, nomes, lugares e eventos corretos e verificáveis; quando houver incerteza, escreva "aproximadamente" ou "por volta de".\n2) Nunca invente falas entre aspas atribuídas a pessoas reais; use discurso indireto.\n3) Escravização tratada com a gravidade devida, usando "pessoas escravizadas" e incluindo a resistência; povos indígenas com protagonismo e presentes hoje; guerras e ditaduras sem romantizar.\n4) Mostre mais de um ponto de vista quando a historiografia o fizer.' }
};
const INCL = {
  tea: 'ADAPTAÇÃO PARA ESTUDANTE COM TEA: enunciados literais e diretos, uma instrução por frase, sem ironia nem metáfora, mesma estrutura em todas as questões.',
  tdah: 'ADAPTAÇÃO PARA ESTUDANTE COM TDAH: enunciados muito curtos, uma tarefa por questão, sem informação que não seja usada.',
  baixavisao: 'ADAPTAÇÃO PARA BAIXA VISÃO: enunciados curtos (a folha sai com letra grande), nada que dependa de cor ou de imagem pequena.',
  di: 'ADAPTAÇÃO PARA DEFICIÊNCIA INTELECTUAL: vocabulário simples e concreto, números menores, exemplos do dia a dia, uma ideia por questão.'
};
const TIPOS_Q = { 'Múltipla escolha': 'multipla', 'Verdadeiro ou falso': 'vf', 'Completar lacunas': 'lacuna', 'Resposta curta': 'curta', 'Relacionar colunas': 'relacionar' };
const SERIES = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano', '8º Ano', '9º Ano', 'Ensino Médio', 'EJA'];

const S = (description) => ({ type: 'STRING', description });
const ESQUEMA_EXERCICIOS = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título curto e atraente da ficha, sem o nome da disciplina'),
    bncc_codigo: S('Código da habilidade da BNCC no formato EF06CI04. Vazio se não tiver certeza do código exato.'),
    bncc_descricao: S('A habilidade da BNCC em uma frase'),
    para_lembrar: S('A ideia central do tema em no máximo 3 frases curtas, adequadas à série'),
    questoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: ['multipla', 'vf', 'lacuna', 'curta', 'relacionar', 'aberta'] },
      enunciado: S('O enunciado completo. Em lacuna, use ______ (seis sublinhados) no lugar de cada palavra que falta.'),
      alternativas: { type: 'ARRAY', items: { type: 'STRING' }, description: 'multipla: exatamente 4 alternativas sem letra na frente; vf: de 3 a 5 afirmativas; outros tipos: vazio' },
      coluna_a: { type: 'ARRAY', items: { type: 'STRING' }, description: 'relacionar: de 3 a 5 itens; outros tipos: vazio' },
      coluna_b: { type: 'ARRAY', items: { type: 'STRING' }, description: 'relacionar: os mesmos itens correspondentes, em ordem embaralhada; outros tipos: vazio' },
      linhas: { type: 'INTEGER', description: 'Linhas de resposta escrita: curta 2, aberta 4, os demais 0' },
      resposta: S('multipla: a letra (A, B, C ou D); vf: a sequência como V, F, V; lacuna: as palavras na ordem; relacionar: pares como 1-C, 2-A; curta e aberta: a resposta esperada'),
      comentario: S('Por que esta é a resposta, em uma ou duas frases, para o professor')
    }, required: ['tipo', 'enunciado', 'resposta', 'comentario'] } },
    objetivo: S('O que a ficha desenvolve, em uma frase, para o professor'),
    tempo: S('Tempo estimado, por exemplo 30 minutos'),
    ilustracao: S('Sugestão de uma ilustração simples para o topo da ficha, em uma frase')
  },
  required: ['titulo', 'para_lembrar', 'questoes', 'objetivo', 'tempo']
};

export function montarPedidoExercicios(p) {
  const area = AREAS[p.area];
  const tipos = (p.tipos || []).map(t => TIPOS_Q[t]).filter(Boolean);
  const lista = (tipos.length ? tipos : Object.values(TIPOS_Q));
  const sistema = 'Você é professor de ' + area.nome + ' da educação básica brasileira e autor de material didático. Escreve em português do Brasil, com linguagem adequada à série, frases curtas e claras, sem travessão como conector de frase. Responde somente no formato JSON pedido.\n\n' + area.regras +
    '\n\nREGRAS DAS QUESTÕES\n1) Cada questão de múltipla escolha tem UMA única alternativa correta e três erradas plausíveis; nada de "todas as anteriores".\n2) Nenhuma questão cobra algo que não se aprende na série informada.\n3) Pelo menos uma questão pede para explicar com as próprias palavras.\n4) Dificuldade crescente, da primeira para a última.\n5) Resolva cada questão você mesmo e confira a resposta antes de entregar.\n6) Código da BNCC: só escreva se tiver certeza de que é real e do ano certo; se não tiver, deixe vazio e descreva a habilidade.';
  let pedido = 'Crie uma ficha de exercícios de ' + area.nome + ' sobre "' + p.tema + '" para turma de ' + p.serie + '.\n' +
    'Quantidade de questões: exatamente ' + p.qtd + '.\n' +
    'Tipos de questão, alternando entre eles: ' + lista.join(', ') + (lista.length < 6 ? ' (e uma "aberta" se precisar da questão de explicar)' : '') + '.';
  if (p.temaLivre) pedido += '\nO professor descreveu assim o que quer: "' + p.temaLivre + '". Siga essa orientação.';
  if (p.bncc) pedido += '\nTrabalhe a habilidade ' + p.bncc + ' e use exatamente esse código em bncc_codigo.';
  if (INCL[p.incl]) pedido += '\n' + INCL[p.incl];
  return { sistema, pedido, esquema: ESQUEMA_EXERCICIOS };
}

// tira marcas que a IA às vezes repete (a folha já desenha o quadradinho e a letra): "( ) ", "A) ", "a. "
const semMarca = t => String(t ?? '').replace(/^\s*(\(\s*\)|\[\s*\]|[A-Ea-e][).]|\d+[).])\s*/, '').trim();
export function limpar(c) {
  (c.questoes || []).forEach(q => { ['alternativas', 'coluna_a', 'coluna_b'].forEach(k => { if (Array.isArray(q[k])) q[k] = q[k].map(semMarca); }); });
  return c;
}

// confere o que a IA devolveu antes de entregar ao professor
export function conferirExercicios(c, qtd) {
  const prob = [];
  if (!c || typeof c !== 'object') return ['resposta vazia'];
  if (!String(c.titulo || '').trim()) prob.push('sem título');
  const q = Array.isArray(c.questoes) ? c.questoes : [];
  if (q.length !== qtd) prob.push('veio com ' + q.length + ' questões em vez de ' + qtd);
  q.forEach((x, i) => {
    const n = i + 1, alt = Array.isArray(x.alternativas) ? x.alternativas.filter(a => String(a).trim()) : [];
    if (!String(x.enunciado || '').trim()) prob.push('questão ' + n + ' sem enunciado');
    if (!String(x.resposta || '').trim()) prob.push('questão ' + n + ' sem resposta no gabarito');
    if (x.tipo === 'multipla' && (alt.length !== 4 || !/^[A-D]\b/i.test(String(x.resposta).trim()))) prob.push('questão ' + n + ' de múltipla escolha incompleta');
    if (x.tipo === 'vf' && (alt.length < 2)) prob.push('questão ' + n + ' de verdadeiro ou falso sem afirmativas');
    if (x.tipo === 'relacionar' && (!Array.isArray(x.coluna_a) || !Array.isArray(x.coluna_b) || x.coluna_a.length < 2 || x.coluna_a.length !== x.coluna_b.length)) prob.push('questão ' + n + ' de relacionar com colunas desiguais');
    if (x.tipo === 'lacuna' && !/_{3,}/.test(String(x.enunciado || ''))) prob.push('questão ' + n + ' de completar sem lacuna');
  });
  return prob;
}

async function chamarGemini(chave, modelo, m) {
  const corpo = {
    systemInstruction: { parts: [{ text: m.sistema }] },
    contents: [{ role: 'user', parts: [{ text: m.pedido }] }],
    generationConfig: { temperature: 0.6, responseMimeType: 'application/json', responseSchema: m.esquema, maxOutputTokens: 12000,
    }
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(90000)
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) return { naoExiste: true };
  if (!r.ok) { console.error('gemini', r.status, JSON.stringify(j).slice(0, 400)); throw new HttpsError('unavailable', 'A IA não respondeu agora (' + r.status + '). Tente de novo em instantes.'); }
  const texto = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
  let conteudo = null; try { conteudo = JSON.parse(texto); } catch (e) { conteudo = null; }
  const u = j.usageMetadata || {};
  return { conteudo, entrada: u.promptTokenCount || 0, saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
}

const mesAtual = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '');
const txt = (v, n) => String(v ?? '').trim().slice(0, n);

export const iaEducadorGerar = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 180, memory: '512MiB', maxInstances: 10 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid;
  const [us, cs] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc('config/ia').get()]);
  const eu = us.exists ? us.data() : null;
  if (!eu || eu.status !== 'ativo' || !['professor', 'gestor', 'admin'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'A IA do Educador é para professores e gestores com cadastro ativo.');
  const cfg = { ...PADRAO_IA, ...(cs.exists ? cs.data() : {}) };
  const admin = eu.perfil === 'admin';
  if (!cfg.ativo && !admin) throw new HttpsError('failed-precondition', 'A IA do Educador está em manutenção. Use o modo copiar e colar.');
  if (!admin && !cfg.todos && !(cfg.municipios || []).includes(eu.municipio_id)) throw new HttpsError('failed-precondition', 'A IA do Educador ainda não foi liberada para a sua rede. Use o modo copiar e colar.');

  // pedido
  const d = req.data || {};
  if (d.entrega !== 'atividade' || d.tipo !== 'exercicios') throw new HttpsError('invalid-argument', 'Este tipo de material ainda é feito no modo copiar e colar.');
  const p = { area: d.area, tema: txt(d.tema, 160), serie: txt(d.serie, 20), qtd: Number(d.qtd), tipos: Array.isArray(d.tipos) ? d.tipos.slice(0, 6) : [],
    temaLivre: txt(d.temaLivre, 300), bncc: txt(d.bncc, 40), incl: txt(d.incl, 20) };
  if (!AREAS[p.area]) throw new HttpsError('invalid-argument', 'Disciplina ainda não disponível na IA do Educador.');
  if (p.tema.length < 3) throw new HttpsError('invalid-argument', 'Escreva o tema ou conteúdo.');
  if (!SERIES.includes(p.serie)) throw new HttpsError('invalid-argument', 'Série inválida.');
  if (![4, 6, 8, 10].includes(p.qtd)) throw new HttpsError('invalid-argument', 'Quantidade de questões inválida.');

  // cota do mês (o administrador não tem limite)
  const usoRef = db.doc(`ia_uso/${uid}_${mesAtual()}`);
  if (!admin) {
    const usado = await db.runTransaction(async t => { const s = await t.get(usoRef); const n = s.exists ? s.data().n || 0 : 0;
      if (n >= cfg.limite_mensal) return -1; t.set(usoRef, { uid, mes: mesAtual(), municipio_id: eu.municipio_id || '', n: n + 1, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }); return n + 1; });
    if (usado < 0) throw new HttpsError('resource-exhausted', 'Você usou os ' + cfg.limite_mensal + ' materiais deste mês na IA do Educador. Use o modo copiar e colar até o mês virar.');
  }

  const m = montarPedidoExercicios(p);
  let r = null, prob = ['sem resposta'], entrada = 0, saida = 0, erro = null, usado = cfg.modelo;
  try {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      for (const mod of [...new Set([cfg.modelo, ...RESERVAS])]) {
        r = await chamarGemini(GEMINI.value(), mod, m);
        if (!r.naoExiste) { usado = mod; break; }
        console.warn('ia-educador: modelo fora do ar', mod);
      }
      if (r.naoExiste) throw new HttpsError('unavailable', 'Nenhum modelo da IA está disponível agora. Avise a NEWPC.');
      entrada += r.entrada; saida += r.saida;
      prob = conferirExercicios(r.conteudo, p.qtd);
      if (!prob.length) break;
      console.warn('ia-educador: conferência reprovou', prob.join('; '));
    }
  } catch (e) { erro = e; }
  // material que não saiu não conta na cota do professor; os tokens gastos ficam registrados para o custo
  const falhou = !!erro || prob.length > 0;
  await usoRef.set({ uid, tokens_entrada: FieldValue.increment(entrada), tokens_saida: FieldValue.increment(saida), ...(falhou && !admin ? { n: FieldValue.increment(-1), falhas: FieldValue.increment(1) } : {}),
    atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
  if (prob.length) throw new HttpsError('internal', 'A IA devolveu um material com problema (' + prob[0] + '). Tente de novo.');

  const c = limpar(r.conteudo);
  const doc = { uid, titulo: txt(c.titulo + ' · ' + AREAS[p.area].nome, 160), entrega: 'atividade', area: p.area, area_nome: AREAS[p.area].nome, tipo: 'exercicios', tipo_nome: 'Exercícios variados',
    tema: p.tema.slice(0, 120), serie: p.serie, bncc: txt(c.bncc_codigo || p.bncc, 40), motor: 'ia-educador-1', modelo: usado, pasta: 'ia/integrada', modo: 'exercicios',
    valores: { v: 3, pedido: { ...p, entrega: 'atividade', tipo: 'exercicios' } }, conteudo: c, turma_id: txt(d.turma_id, 64), turma_nome: txt(d.turma_nome, 60),
    ia: 'integrada', tokens_entrada: entrada, tokens_saida: saida, favorito: false, criado_em: FieldValue.serverTimestamp(), usado_em: FieldValue.serverTimestamp() };
  const ref = await db.collection('ia_materiais').add(doc);
  const us2 = admin ? null : await usoRef.get();
  return { id: ref.id, conteudo: c, modelo: usado, restante: admin ? null : Math.max(0, cfg.limite_mensal - ((us2 && us2.data().n) || 0)) };
});

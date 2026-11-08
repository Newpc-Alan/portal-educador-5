// Fábrica de cursos com IA (Formação Continuada): partes puras, sem Firebase, para testar fora do servidor.
// Fluxo em duas etapas: 1) plano do curso (estrutura, questões e o que o material base diz em cada módulo);
// 2) texto das aulas, um pedido por módulo, em paralelo. O resultado nasce como rascunho e só publica depois
// que alguém da equipe confirma a revisão pedagógica (pendenciasPublicacao confere o campo ia.revisado).

export const NIVEIS = ['iniciante', 'intermediario', 'avancado'];
const corta = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **negrito** vira <strong>; o resto é texto puro escapado
const linha = s => esc(s).replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>');

export const ESQUEMA_PLANO = {
  type: 'OBJECT',
  properties: {
    titulo: { type: 'STRING' }, resumo: { type: 'STRING' }, descricao: { type: 'STRING' },
    nivel: { type: 'STRING', enum: NIVEIS },
    competencias: { type: 'ARRAY', items: { type: 'STRING' } },
    modulos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      titulo: { type: 'STRING' }, objetivo: { type: 'STRING' }, base_material: { type: 'STRING' },
      aulas: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        titulo: { type: 'STRING' }, objetivo: { type: 'STRING' }, duracaoMin: { type: 'INTEGER' } }, required: ['titulo', 'objetivo', 'duracaoMin'] } } },
      required: ['titulo', 'objetivo', 'aulas'] } },
    questoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      enunciado: { type: 'STRING' }, alternativas: { type: 'ARRAY', items: { type: 'STRING' } },
      correta: { type: 'INTEGER' }, explicacao: { type: 'STRING' }, modulo: { type: 'INTEGER' } },
      required: ['enunciado', 'alternativas', 'correta', 'explicacao', 'modulo'] } }
  },
  required: ['titulo', 'resumo', 'descricao', 'nivel', 'competencias', 'modulos', 'questoes']
};

export const TIPOS_BLOCO = ['subtitulo', 'paragrafo', 'lista', 'passos', 'dica', 'atividade'];
export const ESQUEMA_AULAS = {
  type: 'OBJECT',
  properties: { aulas: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    titulo: { type: 'STRING' },
    blocos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: TIPOS_BLOCO }, texto: { type: 'STRING' }, itens: { type: 'ARRAY', items: { type: 'STRING' } } },
      required: ['tipo'] } } },
    required: ['titulo', 'blocos'] } } },
  required: ['aulas']
};

const REGRAS_COMUNS = `Escreva em português do Brasil, linguagem clara de colega para colega, sem jargão vazio e sem frases de efeito.
O público é professor da rede pública brasileira: turmas cheias, pouco tempo, equipamento nem sempre disponível. Toda orientação precisa caber nessa realidade.
NUNCA invente número de lei, resolução, artigo, pesquisa, autor, estatística, percentual ou citação. Só mencione esses dados se estiverem no material base enviado. Pode citar BNCC e LDB pelo nome, sem números de artigo.
Não use travessão longo (—). Use vírgula, dois-pontos ou ponto.`;

export function pedidoPlano({ tema, publico, horas, nivel, foco, temMaterial }) {
  const minutos = horas * 60;
  const nAulas = Math.max(3, Math.min(24, Math.round(minutos / 45)));
  const sistema = `Você é coordenador pedagógico de formação continuada de professores, especialista em desenho instrucional para cursos a distância autoinstrucionais.
${REGRAS_COMUNS}
Alinhe o curso às três dimensões da BNC-Formação Continuada (conhecimento profissional, prática profissional e engajamento profissional) e liste em "competencias" de 3 a 6 competências que o curso desenvolve, cada uma começando pela dimensão entre parênteses, por exemplo "(Prática) Planejar uma aula usando a lousa digital".`;
  const pedido = `Monte o PLANO de um curso de formação continuada.
Tema: ${tema}
Público: ${publico || 'professores da educação básica da rede pública'}
Carga horária total: ${horas} hora(s), ou seja ${minutos} minutos somando todas as aulas (leitura mais atividade prática de cada aula).
Nível: ${nivel}
${foco ? 'Orientações da equipe: ' + foco : ''}
${temMaterial ? 'Use o MATERIAL BASE enviado como fonte principal: a estrutura, os conceitos e os exemplos devem sair dele. Em cada módulo, preencha "base_material" com um resumo fiel (até 1500 caracteres) do que o material diz sobre aquele módulo, para orientar quem vai escrever as aulas.' : 'Não há material base. Deixe "base_material" vazio.'}

Regras do plano:
- De 2 a 6 módulos, numa progressão do conceito à prática em sala.
- Cerca de ${nAulas} aulas no total, de 2 a 5 por módulo. A soma de duracaoMin deve dar ${minutos} minutos (aulas de 20 a 90 minutos).
- "titulo" do curso com até 80 caracteres; "resumo" com até 150 caracteres, dizendo o que o professor vai conseguir fazer; "descricao" com 2 ou 3 parágrafos curtos (até 900 caracteres) para a página do curso.
- "questoes": de 8 a 12 questões de múltipla escolha com exatamente 4 alternativas, ao menos uma por módulo ("modulo" é o número do módulo, começando em 1). Questões de aplicação em situação de sala de aula, não de decorar definição. Uma única alternativa correta ("correta" é o índice de 0 a 3), distratores plausíveis, sem "todas as anteriores" e sem "nenhuma das anteriores". Varie a posição da correta. "explicacao" diz em uma ou duas frases por que a correta está certa.`;
  return { sistema, pedido };
}

// uma aula por pedido: saídas curtas degeneram menos (o modelo entra em "repetição sem sentido" em textos longos)
export function pedidoAula({ plano, modulo, indice, alvo, tema, publico }) {
  const sistema = `Você escreve aulas de cursos de formação continuada a distância para professores.
${REGRAS_COMUNS}
Cada aula é lida na tela do computador ou do celular: parágrafos curtos, subtítulos que ajudam a escanear, exemplos concretos de sala de aula.
Escreva frases completas e diretas, de até 25 palavras. Cada parágrafo tem de 2 a 4 frases (no máximo 80 palavras). Nunca encadeie adjetivos ou expressões soltas.`;
  const a = modulo.aulas[alvo];
  const outras = modulo.aulas.filter((_, i) => i !== alvo).map(x => '- ' + x.titulo).join('\n');
  const pedido = `Curso: ${plano.titulo}
Tema: ${tema}
Público: ${publico || 'professores da educação básica da rede pública'}
Módulo ${indice + 1}: ${modulo.titulo} (objetivo: ${modulo.objetivo})
${modulo.base_material ? 'O que o material base diz sobre este módulo (use como fonte, sem contradizer):\n' + modulo.base_material + '\n' : ''}${outras ? 'Outras aulas deste módulo (não repita o conteúdo delas):\n' + outras + '\n' : ''}
Escreva SOMENTE esta aula, em texto Markdown simples (não use JSON, não use bloco de código):
Título: ${a.titulo}
Objetivo: ${a.objetivo}
Duração: ${a.duracaoMin} minutos (leitura mais atividade prática)

Formato:
- Não repita o título no início. Comece com 1 parágrafo de abertura que conecta o tema a uma situação real de sala de aula.
- Depois, 3 ou 4 seções, cada uma com "## Subtítulo" seguido de 1 ou 2 parágrafos, uma lista com "- " ou passos numerados com "1. ".
- Uma linha começando com "Dica: " com um cuidado prático ou erro comum a evitar.
- Por último, a seção "## Atividade prática": uma atividade que o professor aplica ou prepara para a própria turma, com o que entregar ou registrar.
Tamanho total: de 600 a 1000 palavras. Aprofunde com exemplos de sala de aula, não com repetição. Use **negrito** só para termos-chave.
Instruções ao professor (passos, atividade, dica) sempre no imperativo, falando com ele: "Defina", "Apresente", "Peça", nunca "Define" ou "O professor define".`;
  return { sistema, pedido };
}

// texto degenerado: trecho longo sem pontuação, ou a mesma sequência de 4 palavras repetida muitas vezes
export function textoDegenerado(aula) {
  const partes = typeof aula === 'string' ? aula.split(/\n+/) : (aula?.blocos || []).flatMap(b => [String(b?.texto || ''), ...(b?.itens || []).map(String)]);
  for (const t of partes) {
    if (t.split(/[.!?:;]/).some(f => f.split(/\s+/).filter(Boolean).length > 40)) return true;
    const w = t.toLowerCase().split(/\s+/).filter(Boolean), vistos = new Map();
    for (let i = 0; i + 4 <= w.length; i++) { const k = w.slice(i, i + 4).join(' '); vistos.set(k, (vistos.get(k) || 0) + 1); if (vistos.get(k) >= 4) return true; }
  }
  return false;
}

// segunda passada: revisão de língua e coerência, sem cortar conteúdo
export function pedidoRevisao(md) {
  const sistema = `Você é revisor de textos didáticos em português do Brasil. Corrija ortografia, concordância, palavras sem sentido ou fora de contexto (troque pela palavra certa ou reescreva a frase), frases truncadas e incoerências. Passe instruções ao professor para o imperativo ("Defina", "Apresente"). Toda frase com mais de 30 palavras deve ser reescrita em frases curtas; elimine encadeamentos de palavras soltas sem sentido (por exemplo "na unidade de ensino municipal ou estadual de atendimento básico diário regular"), mantendo só a ideia útil. Não resuma, não corte seções, não acrescente informação nova, mantenha os subtítulos e a marcação Markdown. Não use travessão longo (—). Devolva só o texto revisado, sem comentários.`;
  return { sistema, pedido: 'Revise esta aula:\n\n' + md };
}
const contaPalavras = t => String(t || '').split(/\s+/).filter(Boolean).length;
// aceita a revisão só se manteve quase todo o texto e as seções (o revisor não pode encurtar o curso)
export function aceitarRevisao(original, revisada) {
  if (typeof revisada !== 'string' || !revisada.trim()) return false;
  const secoes = t => (t.match(/^##\s/gm) || []).length;
  if (secoes(revisada) < secoes(original)) return false;
  if (textoDegenerado(revisada)) return false;
  return contaPalavras(revisada) >= contaPalavras(original) * 0.75;
}

// tira cerca de código, título repetido e espaços; devolve Markdown limpo da aula
export function limparMd(t, titulo) {
  let md = String(t || '').replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').replace(/\r/g, '').trim();
  const l = md.split('\n');
  if (l.length && /^#{1,2}\s/.test(l[0]) && titulo && l[0].replace(/^#+\s*/, '').trim().toLowerCase() === titulo.trim().toLowerCase()) l.shift();
  return l.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 16000);
}

// Markdown simples da aula para o HTML que o editor da Formação aceita (p, h3, ul, ol, li, strong, em)
export function mdParaHtml(md) {
  const out = []; let lista = null;
  const fecha = () => { if (lista) { out.push(`<${lista.t}>${lista.i.map(x => `<li>${linha(x)}</li>`).join('')}</${lista.t}>`); lista = null; } };
  for (const bruta of String(md || '').split('\n')) {
    const ln = bruta.trim();
    if (!ln) { fecha(); continue; }
    let m;
    if ((m = ln.match(/^#{1,4}\s+(.*)$/))) { fecha(); out.push(`<h3>${linha(m[1].replace(/\*\*/g, ''))}</h3>`); continue; }
    if ((m = ln.match(/^[-*•]\s+(.*)$/))) { if (!lista || lista.t !== 'ul') { fecha(); lista = { t: 'ul', i: [] }; } lista.i.push(m[1]); continue; }
    if ((m = ln.match(/^\d+[.)]\s+(.*)$/))) { if (!lista || lista.t !== 'ol') { fecha(); lista = { t: 'ol', i: [] }; } lista.i.push(m[1]); continue; }
    fecha();
    const t = ln.replace(/^>\s*/, '');
    if ((m = t.match(/^\**dica:?\**:?\s*(.*)$/i))) { out.push(`<p><strong>Dica:</strong> ${linha(m[1])}</p>`); continue; }
    out.push(`<p>${linha(t)}</p>`);
  }
  fecha();
  return out.join('');
}

// ---------- conferência do que a IA devolveu ----------
export function limparPlano(j, horas) {
  const prob = [];
  if (!j || typeof j !== 'object') return { plano: null, prob: ['resposta vazia'] };
  const modulos = (Array.isArray(j.modulos) ? j.modulos : []).slice(0, 6).map(m => ({
    titulo: corta(m?.titulo, 120), objetivo: corta(m?.objetivo, 400), base_material: corta(m?.base_material, 1600),
    aulas: (Array.isArray(m?.aulas) ? m.aulas : []).slice(0, 6).map(a => ({ titulo: corta(a?.titulo, 120), objetivo: corta(a?.objetivo, 300), duracaoMin: Number(a?.duracaoMin) || 30 }))
      .filter(a => a.titulo)
  })).filter(m => m.titulo && m.aulas.length);
  if (modulos.length < 2) prob.push('menos de 2 módulos');
  const nMod = modulos.length;
  const questoes = (Array.isArray(j.questoes) ? j.questoes : []).slice(0, 20).map(q => {
    const alt = (Array.isArray(q?.alternativas) ? q.alternativas : []).map(a => corta(a, 300).replace(/^\s*[A-Da-d][).]\s*/, ''));
    return { enunciado: corta(q?.enunciado, 800), alternativas: alt, correta: Number(q?.correta), explicacao: corta(q?.explicacao, 600),
      modulo: Math.min(Math.max(1, Math.round(Number(q?.modulo) || 1)), Math.max(1, nMod)) };
  }).filter(q => q.enunciado && q.alternativas.length === 4 && q.alternativas.every(Boolean) && new Set(q.alternativas.map(a => a.toLowerCase())).size === 4
    && Number.isInteger(q.correta) && q.correta >= 0 && q.correta <= 3
    && !q.alternativas.some(a => /(todas|nenhuma) (as|das) (anteriores|alternativas)/i.test(a)));
  if (questoes.length < 5) prob.push('menos de 5 questões válidas');
  // distribui a carga horária: a soma das aulas fecha com o certificado (múltiplos de 5 minutos, mínimo 15)
  const todas = modulos.flatMap(m => m.aulas), alvo = horas * 60;
  const soma = todas.reduce((s, a) => s + Math.min(Math.max(a.duracaoMin, 10), 180), 0) || 1;
  todas.forEach(a => { a.duracaoMin = Math.max(15, Math.round(Math.min(Math.max(a.duracaoMin, 10), 180) * alvo / soma / 5) * 5); });
  const dif = alvo - todas.reduce((s, a) => s + a.duracaoMin, 0);
  if (todas.length) { const maior = todas.reduce((x, a) => a.duracaoMin > x.duracaoMin ? a : x); maior.duracaoMin = Math.max(15, maior.duracaoMin + dif); }
  const plano = {
    titulo: corta(j.titulo, 90), resumo: corta(j.resumo, 160), descricao: String(j.descricao ?? '').trim().slice(0, 1200),
    nivel: NIVEIS.includes(j.nivel) ? j.nivel : 'iniciante',
    competencias: (Array.isArray(j.competencias) ? j.competencias : []).map(c => corta(c, 200)).filter(Boolean).slice(0, 8),
    modulos, questoes
  };
  if (!plano.titulo || !plano.resumo) prob.push('sem título ou resumo');
  return { plano, prob };
}

export function blocosParaHtml(blocos) {
  const out = [];
  for (const b of (Array.isArray(blocos) ? blocos : []).slice(0, 40)) {
    const tipo = TIPOS_BLOCO.includes(b?.tipo) ? b.tipo : 'paragrafo';
    const texto = String(b?.texto ?? '').trim().slice(0, 3000), itens = (Array.isArray(b?.itens) ? b.itens : []).map(i => String(i ?? '').trim().slice(0, 600)).filter(Boolean).slice(0, 15);
    if (tipo === 'subtitulo') { if (texto) out.push(`<h3>${linha(texto)}</h3>`); continue; }
    if (tipo === 'lista' || tipo === 'passos') {
      if (texto) out.push(`<p>${linha(texto)}</p>`);
      if (itens.length) { const t = tipo === 'passos' ? 'ol' : 'ul'; out.push(`<${t}>${itens.map(i => `<li>${linha(i)}</li>`).join('')}</${t}>`); }
      continue;
    }
    if (tipo === 'dica') { if (texto) out.push(`<p><strong>Dica:</strong> ${linha(texto)}</p>`); continue; }
    if (tipo === 'atividade') {
      out.push('<h3>Atividade prática</h3>');
      texto.split(/\n+/).filter(Boolean).forEach(p => out.push(`<p>${linha(p)}</p>`));
      if (itens.length) out.push(`<ul>${itens.map(i => `<li>${linha(i)}</li>`).join('')}</ul>`);
      continue;
    }
    texto.split(/\n+/).filter(Boolean).forEach(p => out.push(`<p>${linha(p)}</p>`));
  }
  return out.join('');
}

export const palavras = html => String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

// junta o plano com as aulas escritas; aula que veio vazia ganha um roteiro mínimo a partir do objetivo (sinalizado para revisão)
export function montarCurso(plano, aulasPorModulo) {
  const modulos = [], aulas = [], pendencias = [];
  plano.modulos.forEach((m, i) => {
    const mid = `m${i + 1}`; modulos.push({ id: mid, titulo: m.titulo, ordem: i + 1 });
    const escritas = Array.isArray(aulasPorModulo[i]) ? aulasPorModulo[i] : [];
    m.aulas.forEach((a, k) => {
      const e = escritas[k] || escritas.find(x => corta(x?.titulo, 120).toLowerCase() === a.titulo.toLowerCase());
      let texto = !e ? '' : typeof e.html === 'string' ? e.html : blocosParaHtml(e.blocos);
      if (e && e.suspeito) pendencias.push(`Aula "${a.titulo}" tem frase longa ou repetitiva demais: revise o texto.`);
      if (palavras(texto) < 60) {
        pendencias.push(`Aula "${a.titulo}" veio sem texto suficiente: complete antes de publicar.`);
        texto = `<p><strong>Objetivo:</strong> ${linha(a.objetivo)}</p><p>[Conteúdo a completar pela equipe]</p>`;
      }
      aulas.push({ id: `${mid}a${k + 1}`, moduloId: mid, titulo: a.titulo, ordem: aulas.length + 1, duracaoMin: a.duracaoMin, texto, videos: [], materiais: [] });
    });
  });
  const questoes = plano.questoes.map((q, i) => ({ id: `q${i + 1}`, enunciado: q.enunciado, alternativas: q.alternativas, ordem: i + 1, correta: q.correta, explicacao: q.explicacao }));
  return { modulos, aulas, questoes, pendencias };
}

export const slugCurso = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

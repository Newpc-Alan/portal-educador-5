// Relatório da Formação Continuada para a Secretaria: partes puras (agregação e pedido à IA), sem Firebase.
// A IA recebe só números por escola e por curso, nunca nome de professor (LGPD); escreve a leitura e as recomendações.

const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const semTags = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// competências listadas na descrição do curso (a Fábrica escreve "Competências desenvolvidas" + lista)
export function competenciasDoCurso(c) {
  const d = String((c && c.descricao) || ''), i = d.search(/Compet[eê]ncias/i);
  if (i < 0) return [];
  return [...d.slice(i).matchAll(/<li>(.*?)<\/li>/gi)].map(m => semTags(m[1]).slice(0, 160)).filter(Boolean).slice(0, 8);
}

export function agregarFormacao(a) {
  const t = a.totais || {}, linhas = a.linhas || [], cursosDoc = a._cursos || {};
  const esc = {};
  // escola sem nome no cadastro (vem "-" ou o próprio código interno): agrupa como "Sem escola identificada", nunca mostra código
  const nomeEscola = v => { const x = String(v || '').trim(); return !x || x === '-' || /^[A-Za-z0-9_-]{15,}$/.test(x) ? 'Sem escola identificada' : x; };
  for (const l0 of linhas) {
    const l = { ...l0, escola: nomeEscola(l0.escola) };
    const e = esc[l.escola] = esc[l.escola] || { escola: l.escola, pessoas: 0, concluiu: 0, em_andamento: 0, parado: 0, nao_comecou: 0, horas: 0, certificados: 0, praticas: 0, aplicaram_em_sala: 0 };
    e.pessoas++; e[l.situacao] = (e[l.situacao] || 0) + 1; e.horas += l.horas || 0; e.certificados += l.certificados || 0;
    e.praticas = (e.praticas || 0) + (l._praticas || 0); if (l._aplicou) e.aplicaram_em_sala = (e.aplicaram_em_sala || 0) + 1;
  }
  const escolas = Object.values(esc).map(e => ({ ...e, engajamento_pct: pct(e.pessoas - e.nao_comecou, e.pessoas), conclusao_pct: pct(e.concluiu, e.pessoas) }))
    .sort((x, y) => y.pessoas - x.pessoas).slice(0, 80);
  const cur = {};
  for (const l of linhas) {
    for (const id of l._andamentoIds || []) { (cur[id] = cur[id] || { iniciaram: 0, concluiram: 0 }).iniciaram++; }
    for (const id of l._concluidosIds || []) { const c = cur[id] = cur[id] || { iniciaram: 0, concluiram: 0 }; c.iniciaram++; c.concluiram++; }
  }
  const cursos = Object.entries(cur).map(([id, c]) => ({ titulo: String((cursosDoc[id] && cursosDoc[id].titulo) || 'Curso').slice(0, 90), horas: Number((cursosDoc[id] && cursosDoc[id].horas) || 0),
    iniciaram: c.iniciaram, concluiram: c.concluiram, conclusao_pct: pct(c.concluiram, c.iniciaram), competencias: competenciasDoCurso(cursosDoc[id]) }))
    .sort((x, y) => y.iniciaram - x.iniciaram).slice(0, 30);
  // onde as pessoas pararam: curso + aula da última atividade de quem está parado (os títulos das aulas entram depois, na função)
  const ab = {};
  for (const l of linhas) for (const [c, a] of (l._paradosEm || [])) { const k = c + '|' + (a || ''); ab[k] = (ab[k] || 0) + 1; }
  const abandono = Object.entries(ab).map(([k, n]) => { const [cursoId, aulaId] = k.split('|');
    return { cursoId, aulaId, curso: String((cursosDoc[cursoId] && cursosDoc[cursoId].titulo) || 'Curso').slice(0, 90), aula: '', pararam: n }; })
    .sort((x, y) => y.pararam - x.pararam).slice(0, 8);
  const competencias = [...new Set(cursos.filter(c => c.concluiram > 0).flatMap(c => c.competencias))].slice(0, 15);
  return {
    escopo: a.escopo, rede: a._munNome || '', parado_dias: a.parado_dias,
    totais: { ...t, engajamento_pct: pct((t.pessoas || 0) - (t.nao_comecou || 0), t.pessoas), conclusao_pct: pct(t.concluiu, t.pessoas),
      praticas_registradas: linhas.reduce((n, l) => n + (l._praticas || 0), 0),
      concluiram_ao_menos_um_curso: linhas.filter(l => (l._concluidosIds || []).length || (l.certificados || 0) > 0).length, professores_que_aplicaram_em_sala: linhas.filter(l => l._aplicou).length },
    escolas, cursos, competencias, abandono
  };
}

export const ESQUEMA_RELATORIO = {
  type: 'OBJECT',
  properties: {
    resumo: { type: 'STRING' },
    destaques: { type: 'ARRAY', items: { type: 'STRING' } },
    atencao: { type: 'ARRAY', items: { type: 'STRING' } },
    recomendacoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { acao: { type: 'STRING' }, porque: { type: 'STRING' } }, required: ['acao', 'porque'] } },
    proximo_passo: { type: 'STRING' }
  },
  required: ['resumo', 'destaques', 'atencao', 'recomendacoes', 'proximo_passo']
};

export function pedidoRelatorio(ag) {
  const quem = ag.escopo === 'escola' ? 'a direção da escola' : 'a Secretaria Municipal de Educação';
  const sistema = `Você é analista de formação continuada de professores e escreve para ${quem}, em português do Brasil, com linguagem clara, objetiva e institucional.
Use APENAS os números fornecidos. Não invente dados, percentuais, metas, leis ou pesquisas. Não cite nomes de pessoas. Pode citar escolas e cursos pelo nome.
"Práticas registradas" são relatos dos professores sobre a atividade prática das aulas; "aplicaram em sala" conta quem relatou ter feito a atividade com a turma. Isso é evidência de aplicação, destaque quando houver.
"onde_pararam" mostra em qual aula está quem parou; se várias pessoas param na mesma aula, aponte a aula para revisão.
"Parado" significa quem começou um curso e não avança há ${ag.parado_dias || 14} dias. "Engajamento" é a parte da equipe que já começou ao menos um curso. "concluiram_ao_menos_um_curso" conta quem terminou pelo menos um curso; "concluiu" (em totais e escolas) é só quem terminou tudo o que começou. Use concluiram_ao_menos_um_curso ao falar de conclusão.
Recomendações práticas e de baixo custo para a realidade da rede pública (horário de planejamento, HTPC, coordenação pedagógica, mensagens às escolas). Frases de até 25 palavras. Não use travessão longo (—).`;
  const pedido = `Dados da Formação Continuada (Portal do Educador)${ag.rede ? ' · ' + ag.rede : ''}:
${JSON.stringify({ totais: ag.totais, escolas: ag.escolas, cursos: ag.cursos.map(({ competencias, ...c }) => c), competencias_dos_cursos_concluidos: ag.competencias, onde_pararam: (ag.abandono || []).map(({ cursoId, aulaId, ...x }) => x) })}

Escreva:
- "resumo": 3 ou 4 frases com a situação geral e os números principais.
- "destaques": 2 a 4 pontos positivos, cada um com o número que o sustenta.
- "atencao": 2 a 4 pontos de atenção (escolas com muita gente sem começar ou parada, cursos com baixa conclusão), com números.
- "recomendacoes": 3 a 5 ações, cada uma com "acao" (imperativo, o que fazer) e "porque" (o dado que justifica).
- "proximo_passo": uma frase com a ação mais importante para os próximos 30 dias.
Se houver poucos dados (menos de 5 pessoas ou nenhum curso iniciado), diga isso com franqueza e recomende como começar.`;
  return { sistema, pedido };
}

export function limparRelatorio(j) {
  const lista = (v, n, m) => (Array.isArray(v) ? v : []).map(x => String(x || '').replace(/—/g, ',').trim().slice(0, m)).filter(Boolean).slice(0, n);
  if (!j || typeof j !== 'object' || !String(j.resumo || '').trim()) return null;
  return {
    resumo: String(j.resumo).replace(/—/g, ',').trim().slice(0, 900),
    destaques: lista(j.destaques, 5, 300), atencao: lista(j.atencao, 5, 300),
    recomendacoes: (Array.isArray(j.recomendacoes) ? j.recomendacoes : []).map(r => ({ acao: String(r?.acao || '').replace(/—/g, ',').trim().slice(0, 240), porque: String(r?.porque || '').replace(/—/g, ',').trim().slice(0, 300) }))
      .filter(r => r.acao).slice(0, 6),
    proximo_passo: String(j.proximo_passo || '').replace(/—/g, ',').trim().slice(0, 300)
  };
}

/* ---------------- Atividade prática da aula (nov/2026) ----------------
   O professor conta o que aplicou com a turma; a IA devolve um retorno curto de colega formador.
   Só texto nesta versão: foto de sala pode ter rosto de aluno (menor de idade), então fica para depois. */
export const SITUACOES_PRATICA = ['aplicou', 'planejou', 'incompleto'];
export const ESQUEMA_PRATICA = {
  type: 'OBJECT',
  properties: {
    situacao: { type: 'STRING', enum: SITUACOES_PRATICA },
    pontos_fortes: { type: 'ARRAY', items: { type: 'STRING' } },
    sugestao: { type: 'STRING' },
    pergunta: { type: 'STRING' }
  },
  required: ['situacao', 'pontos_fortes', 'sugestao', 'pergunta']
};

// trecho "Atividade prática" do texto da aula (HTML da Fábrica ou texto livre); sem ele, o fim da aula
export function atividadeDaAula(html) {
  const t = String(html || '').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ');
  const i = t.search(/atividade pr[aá]tica/i);
  return (i >= 0 ? t.slice(i) : t.slice(-900)).replace(/\n\s*\n+/g, '\n').trim().slice(0, 1500);
}

export function pedidoPratica({ curso, aula, atividade, texto }) {
  const sistema = `Você é formador de professores e comenta, como um colega experiente, o relato de um professor da rede pública sobre a atividade prática de uma aula de formação continuada.
Português do Brasil, tom acolhedor e direto, sem elogio vazio e sem jargão. Frases de até 25 palavras. Não use travessão longo (—).
Comente SÓ o que está no relato. Não invente o que o professor não disse. Nunca escreva nomes de alunos, mesmo que apareçam no relato.
"situacao": "aplicou" se ele relata que fez com a turma; "planejou" se relata só o planejamento ou a preparação; "incompleto" se o relato é vago demais ou fora do tema da atividade.
"pontos_fortes": 1 ou 2 frases sobre o que funcionou ou foi bem pensado, citando o relato.
"sugestao": uma sugestão prática e específica para a próxima vez (até 2 frases).
"pergunta": uma pergunta curta de reflexão sobre a aprendizagem dos alunos.`;
  const pedido = `Curso: ${String(curso || '').slice(0, 120)}
Aula: ${String(aula || '').slice(0, 120)}
Atividade proposta na aula:
${atividade}

Relato do professor:
${texto}`;
  return { sistema, pedido };
}

export function limparPratica(j) {
  if (!j || !SITUACOES_PRATICA.includes(j.situacao)) return null;
  const s = v => String(v || '').replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const r = { situacao: j.situacao, pontos_fortes: (Array.isArray(j.pontos_fortes) ? j.pontos_fortes : []).map(x => s(x).slice(0, 300)).filter(Boolean).slice(0, 2),
    sugestao: s(j.sugestao).slice(0, 400), pergunta: s(j.pergunta).slice(0, 240) };
  return r.sugestao ? r : null;
}

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
  for (const l of linhas) {
    const e = esc[l.escola] = esc[l.escola] || { escola: l.escola, pessoas: 0, concluiu: 0, em_andamento: 0, parado: 0, nao_comecou: 0, horas: 0, certificados: 0 };
    e.pessoas++; e[l.situacao] = (e[l.situacao] || 0) + 1; e.horas += l.horas || 0; e.certificados += l.certificados || 0;
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
  const competencias = [...new Set(cursos.filter(c => c.concluiram > 0).flatMap(c => c.competencias))].slice(0, 15);
  return {
    escopo: a.escopo, rede: a._munNome || '', parado_dias: a.parado_dias,
    totais: { ...t, engajamento_pct: pct((t.pessoas || 0) - (t.nao_comecou || 0), t.pessoas), conclusao_pct: pct(t.concluiu, t.pessoas) },
    escolas, cursos, competencias
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
"Parado" significa quem começou um curso e não avança há ${ag.parado_dias || 14} dias. "Engajamento" é a parte da equipe que já começou ao menos um curso.
Recomendações práticas e de baixo custo para a realidade da rede pública (horário de planejamento, HTPC, coordenação pedagógica, mensagens às escolas). Frases de até 25 palavras. Não use travessão longo (—).`;
  const pedido = `Dados da Formação Continuada (Portal do Educador)${ag.rede ? ' · ' + ag.rede : ''}:
${JSON.stringify({ totais: ag.totais, escolas: ag.escolas, cursos: ag.cursos.map(({ competencias, ...c }) => c), competencias_dos_cursos_concluidos: ag.competencias })}

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

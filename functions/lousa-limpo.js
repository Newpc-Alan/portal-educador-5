// Passar a limpo na Lousa (nov/2026): núcleo puro (sem Firebase), usado pela função portalIa (lousa_rapida, modo limpo) e pelo teste.
// A IA lê a foto da letra à mão selecionada e devolve blocos de texto organizados; a Lousa monta os textos no lugar dos traços.
export const TIPOS_BLOCO = ['titulo', 'paragrafo', 'item', 'numerado', 'formula'];

export const ESQUEMA_LIMPO = {
  type: 'OBJECT',
  properties: {
    legivel: { type: 'BOOLEAN', description: 'false se não houver escrita legível na imagem' },
    blocos: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: TIPOS_BLOCO },
      texto: { type: 'STRING', description: 'O texto do bloco, sem marcador na frente (sem "-", "•" ou "1.")' }
    }, required: ['tipo', 'texto'] } }
  },
  required: ['legivel', 'blocos']
};

export const SISTEMA_LIMPO = 'Você transcreve o que um professor escreveu À MÃO numa lousa digital, para virar texto digitado e bem organizado. Regras: ' +
  'transcreva fielmente as palavras e números escritos, corrigindo só ortografia e acentuação óbvias; NÃO acrescente conteúdo, NÃO explique, NÃO resolva contas; ' +
  'mantenha a ordem de leitura (de cima para baixo, da esquerda para a direita); uma linha destacada ou sublinhada no topo vira "titulo"; ' +
  'listas com traço, bolinha ou seta viram "item"; listas com número ou letra viram "numerado"; contas e fórmulas viram "formula", ' +
  'escritas numa linha com símbolos Unicode (x², ½, √, π, ≠, ≤, ≥, ×, ÷, →, H₂O), fração como (a)/(b) quando não houver símbolo; ' +
  'desenhos, setas soltas e rabiscos são ignorados. Português do Brasil. Se não houver escrita legível, legivel = false e blocos vazio.';

const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// limpa o que a IA devolveu: tipo conhecido, sem markdown nem marcador repetido, no máximo 60 blocos
export function limparBlocos(j) {
  return (j && Array.isArray(j.blocos) ? j.blocos : []).slice(0, 60).map(b => ({
    tipo: TIPOS_BLOCO.includes(b.tipo) ? b.tipo : 'paragrafo',
    texto: txt(String(b.texto || '').replace(/[*#_`]+/g, '').replace(/^\s*([-•·▪►→]|\d+[.)]|[a-z][.)])\s+/i, ''), 400)
  })).filter(b => b.texto);
}

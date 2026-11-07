// Vídeo interativo (nov/2026): núcleo puro (sem Firebase), usado pela função videoIa e pelos testes.
// O Gemini "assiste" o vídeo público do YouTube (áudio e imagem) e devolve as pausas com pergunta, cada uma no segundo certo.

export const TIPOS_INTERACAO = ['multipla', 'vf', 'aberta', 'nota'];
export const NOMES_INTERACAO = { multipla: 'Múltipla escolha', vf: 'Verdadeiro ou falso', aberta: 'Resposta aberta', nota: 'Nota' };

// aceita link do YouTube em qualquer formato comum ou o próprio ID de 11 caracteres
export function idYoutube(s) {
  const t = String(s || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  let u; try { u = new URL(t); } catch (e) { return ''; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  let id = '';
  if (h === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (/^youtube(-nocookie)?\.com$/.test(h)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else { const m = /^\/(embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname); if (m) id = m[2]; }
  }
  return /^[\w-]{11}$/.test(id) ? id : '';
}

const S = d => ({ type: 'STRING', description: d });
export const ESQUEMA_VIDEO = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título curto para a aula interativa, em português'),
    resumo: S('O que o vídeo ensina, em até 2 frases'),
    duracao_seg: { type: 'INTEGER', description: 'Duração total do vídeo em segundos, como você percebeu' },
    adequado: { type: 'BOOLEAN', description: 'false se o vídeo não for educativo ou não servir para a série informada' },
    motivo: S('Se adequado = false, explique em 1 frase; senão, vazio'),
    interacoes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tempo_seg: { type: 'INTEGER', description: 'Segundo do vídeo em que ele pausa: logo DEPOIS de o assunto da pergunta ser mostrado ou falado' },
          tipo: { type: 'STRING', enum: TIPOS_INTERACAO },
          pergunta: S('Enunciado curto (até 160 caracteres). Na nota: o texto da nota'),
          opcoes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'multipla: 3 ou 4 alternativas curtas sem letra na frente; vf: ["Verdadeiro","Falso"]; aberta e nota: vazio' },
          correta: { type: 'INTEGER', description: 'Índice (começa em 0) da alternativa certa; aberta e nota: -1' },
          explicacao: S('Por que a resposta é essa, em 1 ou 2 frases, para o professor comentar com a turma. Aberta: a resposta esperada'),
          trecho: S('O que o vídeo mostra ou diz logo antes da pausa (para conferência), em até 1 frase')
        },
        required: ['tempo_seg', 'tipo', 'pergunta', 'opcoes', 'correta', 'explicacao', 'trecho']
      }
    }
  },
  required: ['titulo', 'resumo', 'duracao_seg', 'adequado', 'motivo', 'interacoes']
};

export function sistemaVideo() {
  return 'Você é um professor experiente da educação básica brasileira. Você vai ASSISTIR o vídeo (áudio e imagem) e transformá-lo numa aula interativa: ' +
    'o vídeo pausa em alguns momentos e a turma responde uma pergunta na lousa antes de continuar.\n' +
    'REGRAS DE TEMPO (as mais importantes):\n' +
    '- Cada pausa acontece LOGO DEPOIS de o vídeo mostrar ou falar o conteúdo da pergunta, nunca antes. Confira o segundo exato ouvindo a fala.\n' +
    '- Nenhuma pausa nos primeiros 15 segundos nem nos últimos 5 segundos. Pausas com pelo menos 20 segundos entre si, espalhadas pelo vídeo inteiro.\n' +
    '- Preencha "trecho" com o que foi dito ou mostrado logo antes da pausa.\n' +
    'REGRAS DO CONTEÚDO:\n' +
    '- Português do Brasil, linguagem da série informada. Enunciados curtos, que se leem de longe na lousa.\n' +
    '- IGNORE abertura, vinheta, propaganda, pedido de inscrição e encerramento do canal ou da plataforma: nenhuma pausa e nenhuma pergunta sobre isso, mesmo que apareça no fim do vídeo.\n' +
    '- Pergunte só o que o vídeo ensina. Não invente fatos que não estão no vídeo e não cobre detalhe irrelevante (cor de roupa, nome do canal).\n' +
    '- Múltipla escolha: 3 ou 4 alternativas plausíveis, uma só certa, sem "todas as anteriores". Verdadeiro ou falso: afirmação clara.\n' +
    '- Resposta aberta: pergunta para a turma discutir ou relacionar com o dia a dia. Nota: curiosidade ou destaque curto, sem pergunta.\n' +
    '- Se o vídeo não for educativo, não tiver fala ou imagem compreensível, ou não servir para a série, marque adequado = false e explique.';
}

export function pedidoVideo({ serie, disciplina, tipos, qtd, duracao }) {
  const ts = (Array.isArray(tipos) && tipos.length ? tipos : ['multipla', 'vf', 'aberta']).filter(t => TIPOS_INTERACAO.includes(t));
  return 'Série: ' + (serie || 'não informada') + '\nComponente: ' + (disciplina || 'não informado') +
    (duracao ? '\nDuração do vídeo: ' + duracao + ' segundos.' : '') +
    '\nQuantidade de pausas: ' + qtd + '.\nTipos permitidos: ' + ts.map(t => t + ' (' + NOMES_INTERACAO[t] + ')').join(', ') + '. Alterne os tipos.';
}

const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const semMarca = t => String(t ?? '').replace(/^\s*([A-Ea-e][).]|\d+[).])\s*/, '').trim();

// limpa e confere o que a IA devolveu; devolve { interacoes, problemas }
export function conferirVideo(j, { duracao, qtd, tipos }) {
  const problemas = [];
  // a duração do catálogo às vezes está errada: vale a maior entre a cadastrada e a que a IA percebeu
  const dur = Math.max(Number(duracao) || 0, Number(j && j.duracao_seg) || 0);
  const permitidos = new Set((Array.isArray(tipos) && tipos.length ? tipos : TIPOS_INTERACAO).filter(t => TIPOS_INTERACAO.includes(t)));
  let lista = (j && Array.isArray(j.interacoes) ? j.interacoes : []).map(x => {
    const tipo = TIPOS_INTERACAO.includes(x.tipo) ? x.tipo : 'aberta';
    let opcoes = (Array.isArray(x.opcoes) ? x.opcoes : []).map(o => txt(semMarca(o), 120)).filter(Boolean).slice(0, 4);
    let correta = Number.isInteger(x.correta) ? x.correta : -1;
    if (tipo === 'vf') { opcoes = ['Verdadeiro', 'Falso']; if (correta !== 0 && correta !== 1) correta = -1; }
    if (tipo === 'aberta' || tipo === 'nota') { opcoes = []; correta = -1; }
    return { t: Math.round(Number(x.tempo_seg) || 0), tipo, pergunta: txt(x.pergunta, 220), opcoes, correta, explicacao: txt(x.explicacao, 400), trecho: txt(x.trecho, 200) };
  });
  lista = lista.filter(x => {
    if (!x.pergunta) { problemas.push('pausa sem texto'); return false; }
    if (!permitidos.has(x.tipo)) { problemas.push('tipo não pedido: ' + x.tipo); return false; }
    if (x.tipo === 'multipla' && (x.opcoes.length < 3 || x.correta < 0 || x.correta >= x.opcoes.length)) { problemas.push('múltipla escolha incompleta em ' + x.t + 's'); return false; }
    if (x.tipo === 'vf' && x.correta < 0) { problemas.push('V ou F sem resposta em ' + x.t + 's'); return false; }
    if (x.t < 5 || (dur && x.t > dur - 2)) { problemas.push('tempo fora do vídeo: ' + x.t + 's'); return false; }
    return true;
  }).sort((a, b) => a.t - b.t);
  // duas pausas coladas: fica a primeira
  lista = lista.filter((x, i, a) => i === 0 || x.t - a[i - 1].t >= 8);
  if (qtd && lista.length < Math.max(1, Math.ceil(qtd * 0.6))) problemas.push('poucas pausas válidas (' + lista.length + ' de ' + qtd + ')');
  return { interacoes: lista.slice(0, 15), problemas, duracao: dur };
}

// corpo da chamada ao Gemini: o vídeo do YouTube vai como fileData (o Google busca e assiste)
export function corpoVideo(youtubeId, sistema, pedido, baixa = true) {
  return {
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ fileData: { fileUri: 'https://www.youtube.com/watch?v=' + youtubeId, mimeType: 'video/*' } }, { text: pedido }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA_VIDEO, maxOutputTokens: 12000, ...(baixa ? { mediaResolution: 'MEDIA_RESOLUTION_LOW' } : {}) }
  };
}

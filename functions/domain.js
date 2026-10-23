// Regras puras compartilhadas pelos serviços e pelos testes.
export function idValido(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
}
export function minimoAula(a) {
  return Math.max(60, Math.min(7200, Math.round((Number(a.duracaoMin) || 3) * 60 * 0.4)));
}
export function unirTrechos(trechos) {
  const lista = trechos.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b > a)
    .sort((a,b) => a[0]-b[0]);
  const saida = [];
  for (const [a,b] of lista) {
    const ultimo = saida.at(-1);
    if (ultimo && a <= ultimo[1] + 0.25) ultimo[1] = Math.max(b,ultimo[1]);
    else saida.push([a,b]);
  }
  return saida.slice(0,2000);
}
export const segundosTrechos = t => t.reduce((s,[a,b])=>s+b-a,0);
export function videoAtualizado(ant = {}, amostra, decorrido) {
  const { posicao, duracao, tocando } = amostra;
  if (!Number.isFinite(posicao) || !Number.isFinite(duracao) || duracao <= 0 || duracao > 43200 || posicao < 0 || posicao > duracao + 2)
    throw new Error('Posição de vídeo inválida.');
  const delta = posicao - (ant.posicao ?? posicao);
  // Saltos e repetição não dão crédito. Limite de 2x e tolerância de rede.
  // O teto acompanha o intervalo de sincronização do cliente (45 s). Precisa
  // caber reprodução em 2x mais folga de rede, senão quem assiste acelerado
  // é tratado como se tivesse arrastado a barra e não recebe crédito.
  const continuo = ant.tocando && delta > 0 && delta <= Math.min(90, decorrido) * 2.1 + 1;
  const trechos = unirTrechos([...(ant.trechos || []).map(t=>Array.isArray(t)?t:[t.inicio,t.fim]), ...(continuo ? [[ant.posicao,Math.min(posicao,duracao)]] : [])]);
  return { posicao, duracao: Math.max(ant.duracao || 0,duracao), tocando: Boolean(tocando), trechos:trechos.map(([inicio,fim])=>({inicio,fim})),
    assistido: segundosTrechos(trechos) };
}
export function projecaoPublica(c) {
  // Lista positiva: nunca devolver perfil, UID, CPF inteiro ou motivo interno.
  // notaFinal entra: é o dado que o RH confere na progressão. Município e
  // escola ficam de fora de propósito, são dado de perfil e não do documento.
  return Object.fromEntries(['nome','cpfMascarado','cursoTitulo','cargaHoraria','emitidoEmISO','ativo',
    'periodoInicioISO','periodoFimISO','programa','totalAulas','notaFinal'].filter(k=>c[k] !== undefined).map(k=>[k,c[k]]));
}
export function pendenciasPublicacao(c, modulos, aulas, questoes, gabarito) {
  const erros = [];
  const texto = v => String(v || '').replace(/<[^>]*>/g,'').trim();
  if (!texto(c.titulo) || !texto(c.resumo)) erros.push('Preencha título e resumo.');
  if (!(Number(c.horas)>0)) erros.push('Defina a carga horária.');
  if (!modulos.length || !aulas.length) erros.push('Cadastre pelo menos um módulo e uma aula.');
  for (const a of aulas) {
    if (!modulos.some(m=>m.id===a.moduloId)) erros.push(`Aula ${a.titulo || a.id}: módulo inexistente.`);
    if (!texto(a.titulo) || (!a.videos?.length && !texto(a.texto))) erros.push(`Aula ${a.id}: título ou conteúdo ausente.`);
    if (!(Number(a.duracaoMin)>0)) erros.push(`Aula ${a.titulo || a.id}: informe a duração em minutos.`);
    if ((a.videos || []).some(v=>!/^[-\w]{11}$/.test(v.youtubeId || ''))) erros.push(`Aula ${a.titulo || a.id}: vídeo inválido.`);
  }
  // A carga horária vai impressa no certificado e é o número que a prefeitura
  // usa para contar horas de formação. Sem esta conferência, um curso cadastrado
  // com 40 horas e três aulas de um minuto emite certificado de 40 horas.
  const minutosCadastrados = aulas.reduce((s,a)=>s+(Number(a.duracaoMin)||0),0);
  const horasCadastradas = minutosCadastrados/60;
  if (Number(c.horas)>0 && minutosCadastrados>0 && horasCadastradas < Number(c.horas)*0.6)
    erros.push(`Carga horária incompatível: o certificado dirá ${Number(c.horas)} horas, mas as aulas somam ${horasCadastradas.toFixed(1)} hora(s). Ajuste a carga horária ou a duração das aulas.`);

  if (c.quizAtivo) {
    const porProva = Number(c.quizPorProva ?? 10), corte = Number(c.quizNotaCorte ?? 70), max = Number(c.quizTentativasMax ?? 3);
    if (!Number.isInteger(porProva) || porProva < 3 || porProva > 50 || questoes.length < porProva) erros.push('A prova deve ter de 3 a 50 questões e o banco deve comportar o sorteio.');
    // max = 0 significava "ilimitado", e ilimitado com banco pequeno é acertar
    // por eliminação até passar. Curso publicado precisa de um teto.
    if (!(corte>=1 && corte<=100) || !Number.isInteger(max) || max<1 || max>100) erros.push('Revise a nota mínima e informe um limite de tentativas de 1 a 100.');
    for (const q of questoes) {
      const g = gabarito[q.id];
      if (!texto(q.enunciado) || !Array.isArray(q.alternativas) || q.alternativas.length<2 || q.alternativas.some(v=>!texto(v)) || !g || g.correta===null || g.correta==='' || !Number.isInteger(Number(g.correta)) || Number(g.correta)<0 || Number(g.correta)>=q.alternativas.length)
        erros.push(`Questão ${q.id}: enunciado, alternativas ou gabarito inválido.`);
    }
  }
  return erros;
}

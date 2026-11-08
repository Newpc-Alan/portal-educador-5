// Portal IA · a ferramenta única do professor, com a IA embarcada.
// Uma caixa "O que você precisa para sua aula?" + atalhos. A IA entende o pedido, pergunta só o que falta,
// e devolve um DOCUMENTO num formato único (seções, questões, tabela, gabarito). O Portal mostra, deixa editar
// e monta o PDF com a identidade da escola. Imagem só para os planos que a incluem.
// Independente da IA do Educador (ia-educador.js), que fica guardada como está.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { situacao, reservarCreditos, estornarCreditos, registrarConsumo, daRede } from './creditos.js';
import { feedRede } from './rede-feed.js';
import { statusAoCompartilhar, avisarModeradores } from './moderacao-rede.js';
import { SMTP_SENHA, emailAlerta } from './dicas.js';
import { exigirRecurso } from './envio-comum.js';
import { PERFIS_REDE, opcoesEnvio, destinatarios, contarEnvioDia, lerAnexos, mandarMaterial, htmlSeguro, turmasParaAlunos, linkPublico, publicarNaTurma } from './envio-comum.js';
import { CODIGOS_BNCC } from './bncc-codigos.js';
import { SISTEMA_LIMPO, ESQUEMA_LIMPO, limparBlocos } from './lousa-limpo.js';
import { geralIA, iaDaRede, iaDoUsuario, acessoIA, mensagemAcesso, mapaAcesso, NOMES_IA } from './ia-acesso.js';

const GEMINI = defineSecret('GEMINI_API_KEY');

// config/portal_ia sobrepõe tudo isto. Cotas por professor por mês, por plano do município.
export const PADRAO = {
  ativo: true, todos: true, municipios: ['lab-muni'],
  modelo_texto: 'gemini-3.6-flash', modelo_rapido: 'gemini-3.1-flash-lite', modelo_imagem: 'gemini-3.1-flash-image',
  // quem usa e quanto: créditos pré-pagos (creditos.js). Rede Intermediário: só texto; Completo: texto e imagem; professor pode ter créditos avulsos
  planos: {}
};
// o Google desliga versões antigas; se a escolhida sumir, a função tenta a próxima sem o professor ver erro
export const RESERVA_TEXTO = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
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
'Escreva uma AVALIAÇÃO (prova). Seja direto: enunciados de até 3 linhas, sem textos longos de apoio. Uma seção "Questões" com as questões numeradas, cada uma com o "valor" em pontos (a soma dos valores é 10, salvo outro total pedido). Mistura de tipos, maioria objetiva, ao menos uma dissertativa curta. Enunciados claros e completos, sem pegadinhas. Gabarito completo em "gabarito", com o critério de correção das dissertativas no comentário.' },
  parecer: { nome: 'Parecer do aluno', publico: 'professor', instrucao:
'Escreva um PARECER DESCRITIVO do aluno, em linguagem respeitosa, objetiva e acolhedora, baseado SOMENTE nas observações que o professor escreveu: não invente fatos, comportamentos nem dificuldades. Seções: "Aspectos cognitivos", "Aspectos socioemocionais", "Participação e autonomia", "Encaminhamentos" (o que a escola e a família podem fazer). Use só o primeiro nome do aluno, como o professor escreveu. Sem diagnóstico médico ou psicológico.' },
  inclusao: { nome: 'Adaptação para inclusão', publico: 'aluno', questoes: true, instrucao:
'ADAPTE o conteúdo ou a atividade indicada para a necessidade informada. Seção "Atividade adaptada" com as questões ou o texto já adaptados (enunciados curtos, uma instrução por vez, apoio visual descrito, linguagem literal, espaço para responder). Depois a seção "Orientações ao professor" (itens práticos de mediação). Sem diagnóstico, sem rótulos: fale da necessidade, não da pessoa.' },
  redacao: { nome: 'Correção de redação', publico: 'professor', instrucao:
'CORRIJA a redação que o professor colou. Seções: "Avaliação por critério" (tabela com Critério, Nota e Comentário; use as 5 competências do ENEM com notas de 0 a 200 se for Ensino Médio, ou critérios simples de 0 a 10 adequados à série nos demais casos); "Pontos fortes" (itens citando trechos curtos do texto); "O que melhorar" (itens, cada um com o trecho e a sugestão); "Devolutiva para o aluno" (texto direto ao aluno, encorajador e específico). Não reescreva a redação inteira. Não invente trechos que não estão no texto.' },
  recado: { nome: 'Recado aos pais', publico: 'familia', instrucao:
'Escreva um COMUNICADO aos pais e responsáveis, formal e acolhedor, curto (até 120 palavras), com o assunto, data, horário e o que a família precisa fazer, quando informados. Uma seção "Comunicado" com o texto. Em "versao_whatsapp" escreva a mesma mensagem em até 60 palavras, para mandar no grupo, sem emoji excessivo (no máximo 2).' },
  explicar: { nome: 'Explicação do conteúdo', publico: 'aluno', instrucao:
'Escreva uma EXPLICAÇÃO do conteúdo para o aluno da série informada. Seções: "O que é" (texto claro, frases curtas), "Como funciona" ou "Passo a passo" (itens), "Exemplos do dia a dia" (itens), "Palavras importantes" (tabela com Palavra e Significado), "Teste rápido" (3 questões curtas, com as respostas no gabarito). Nada de informação incerta como se fosse certa.' },
  // novembro/2026: tipos que o professor procura no dia a dia (vitrine do Portal IA)
  planejamento: { nome: 'Planejamento bimestral ou anual', publico: 'professor', instrucao:
'Escreva um PLANEJAMENTO do período pedido (bimestre, trimestre, semestre ou ano; se não disser, faça o ANUAL dividido em 4 bimestres). Primeira seção "Identificação" (tabela com Componente, Série, Período e Aulas por semana, quando informado). Depois UMA seção por bimestre (ou trimestre), com o título "1º bimestre" etc., e nela uma tabela com as colunas Unidade ou tema, Conteúdos, Habilidades da BNCC e Avaliação, de 2 a 4 linhas por período, em ordem de progressão. Na coluna de habilidades, use o código só quando tiver certeza; senão descreva. Última seção "Observações" (itens: retomadas, projetos ao longo do ano, datas que combinam com o conteúdo). Respeite o que a escola pública costuma ter de carga horária.' },
  diagnostica: { nome: 'Avaliação diagnóstica', publico: 'aluno', questoes: true, instrucao:
'Escreva uma AVALIAÇÃO DIAGNÓSTICA para o início de um conteúdo ou do ano, para o professor descobrir o que a turma já sabe. Uma seção "Questões" em ordem crescente de dificuldade: as primeiras checam pré-requisitos, as do meio o essencial do ano, as últimas um pouco acima. Enunciados curtos, sem pegadinha, maioria objetiva, ao menos uma em que o aluno explica como pensou. No gabarito, em cada "comentario", diga O QUE O ERRO REVELA (qual dificuldade ou pré-requisito falta) e como retomar. Em "nota_professor" explique em duas frases como ler o resultado da turma (agrupar quem errou as mesmas questões).' },
  simulado: { nome: 'Simulado estilo SAEB', publico: 'aluno', questoes: true, instrucao:
'Escreva um SIMULADO no estilo das avaliações externas (SAEB, Prova Brasil e avaliações estaduais). Uma seção "Questões" SÓ com questões de múltipla escolha (tipo multipla), 4 alternativas plausíveis e uma única correta. Sempre que o descritor pedir, a questão traz um pequeno texto, tabela ou situação de apoio dentro do enunciado (até 6 linhas), como nas provas oficiais: leitura em Língua Portuguesa, situação-problema em Matemática. Em cada item do gabarito, no "comentario", diga a habilidade ou descritor avaliado e por que cada distrator atrai o aluno. Nada de questão que dependa de imagem.' },
  lista: { nome: 'Lista de exercícios por nível', publico: 'aluno', questoes: true, instrucao:
'Escreva uma LISTA DE EXERCÍCIOS dividida em três seções, nesta ordem: "Nível 1: aquecimento" (questões diretas, para todos conseguirem), "Nível 2: prática" (aplicação do conteúdo) e "Nível 3: desafio" (problemas que pedem raciocínio). Distribua a quantidade pedida igualmente entre os níveis. Varie os tipos de questão. Gabarito completo em "gabarito", com a resolução resumida nas de cálculo.' },
  rubrica: { nome: 'Rubrica de avaliação', publico: 'professor', instrucao:
'Escreva uma RUBRICA DE AVALIAÇÃO para a atividade ou produção informada. Primeira seção "Rubrica" com uma tabela: colunas Critério, Excelente, Bom, Em desenvolvimento e Ainda não atingiu; de 4 a 6 linhas, uma por critério, cada célula descrevendo o que se observa no trabalho (comportamento observável, nunca adjetivo vago). Segunda seção "Pontuação" (texto curto: quanto vale cada nível e como somar para chegar à nota). Terceira seção "Como usar com a turma" (itens: apresentar a rubrica antes, autoavaliação, devolutiva).' },
  projeto: { nome: 'Projeto pedagógico', publico: 'professor', instrucao:
'Escreva um PROJETO PEDAGÓGICO pronto para apresentar à coordenação. Seções, nesta ordem: "Identificação" (tabela com Tema, Componentes envolvidos, Série, Duração e Público); "Justificativa" (texto curto, ligado à realidade da escola); "Objetivos" (geral no texto, específicos nos itens); "Habilidades da BNCC" (itens); "Etapas" (tabela com Etapa, O que acontece, Responsáveis e Tempo); "Recursos" (itens simples, do que a escola pública tem); "Produto final" (texto); "Avaliação" (itens); "Envolvimento das famílias e da comunidade" (itens).' },
  resumo: { nome: 'Resumo para estudar', publico: 'aluno', questoes: true, instrucao:
'Escreva um RESUMO PARA O ALUNO ESTUDAR o conteúdo (revisão antes da prova). Seções: "Em poucas palavras" (texto de até 5 frases curtas com a ideia central); "Pontos principais" (itens, um conceito por item, com exemplo curto); "Não confunda" (tabela com duas colunas comparando os conceitos que os alunos mais misturam); "Palavras-chave" (tabela com Palavra e Significado); "Revise" (3 a 5 questões curtas, com as respostas no gabarito). Linguagem da série, sem informação incerta.' },
  dinamica: { nome: 'Dinâmica ou jogo para a sala', publico: 'professor', instrucao:
'Escreva uma DINÂMICA ou JOGO para fazer na sala de aula com o conteúdo informado, sem equipamento caro. Seções: "Resumo" (tabela com Objetivo, Tempo, Organização da turma e Materiais); "Preparação" (itens do que o professor faz antes); "Como fazer" (itens numerados, passo a passo, com o que o professor fala e o que os alunos fazem); "Regras" (itens curtos); "Variações" (itens: turma grande, turma agitada, alunos com deficiência); "Fechamento" (como amarrar a dinâmica ao conteúdo, com 2 ou 3 perguntas para a roda de conversa).' },
  // modelos do acervo antigo (PDFs do Banco Curricular) recriados no padrão do Portal; não aparece nos atalhos
  ficha_ei: { nome: 'Ficha da Educação Infantil', publico: 'aluno', instrucao:
'Escreva uma FICHA DE ATIVIDADE da EDUCAÇÃO INFANTIL (crianças pequenas, de 4 e 5 anos, salvo outra faixa indicada), para a criança fazer com a mediação do professor. A criança ainda não lê: as instruções são para o professor ler em voz alta. Seções, nesta ordem: "Para o professor" (texto com o objetivo da proposta em até 2 frases; itens com o passo a passo da condução, de 3 a 5 passos, incluindo uma roda de conversa antes e um momento de partilha depois); "Atividade" (itens: de 2 a 4 consignas curtas, uma ação por vez, com verbos concretos como observe, pinte, circule, ligue, conte, desenhe, cole); "Para ampliar" (itens: 2 brincadeiras ou variações com material simples, sem tela). Em "bncc", os objetivos de aprendizagem da Educação Infantil (códigos EI03...) que a proposta trabalha, só os que você tem certeza. Em "sugestao_imagem", descreva UMA ilustração em contornos, para a criança realizar a atividade na própria folha (ex.: cinco maçãs grandes numa árvore para contar e pintar; três animais e suas sombras para ligar), com poucos elementos grandes e espaço para pintar. Nada de questões de múltipla escolha.' },
  cacapalavras: { nome: 'Caça-palavras', publico: 'aluno', instrucao:
'Prepare um CAÇA-PALAVRAS sobre o tema. Seção 1 "Como fazer" com UMA frase de instrução para o aluno. Seção 2 "Palavras para encontrar" com os itens: SÓ as palavras, uma por item, cada uma com 3 a 11 letras, sem espaço, hífen nem número (nada de expressão com duas palavras), todas ligadas ao tema e corretas na série. Anos iniciais: 6 a 8 palavras curtas; demais séries: 8 a 12 palavras. Seção 3 "Para pensar" com 2 itens: perguntas curtas que ligam as palavras ao conteúdo. NÃO monte a grade de letras: o Portal monta sozinho.' }
};
const NOMES = Object.keys(TIPOS);
// o que pode ir para a rede: parecer e recado têm dados de alunos e famílias (LGPD) e ficam de fora
export const TIPOS_REDE = ['ficha_ei', 'plano', 'sequencia', 'atividade', 'prova', 'explicar', 'inclusao', 'planejamento', 'diagnostica', 'simulado', 'lista', 'rubrica', 'projeto', 'resumo', 'dinamica', 'cacapalavras'];

/* ------------------------------------------------------------------ caça-palavras: a grade é do Portal, não da IA */
// A IA só escolhe as palavras (ela erra muito ao desenhar grade). Aqui as palavras viram letras sem acento e entram
// na grade em direções que a série dá conta: anos iniciais só para a direita e para baixo; depois, também na diagonal.
const semAcentoUp = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Ç/g, 'C');
export function palavrasCaca(doc) {
  const sec = (doc.secoes || []).find(s => /palavra/i.test(s.titulo || '') && (s.itens || []).length) || (doc.secoes || []).find(s => (s.itens || []).length >= 4) || {};
  const vistas = new Set();
  return (sec.itens || []).map(p => semAcentoUp(p).replace(/[^A-Z]/g, '')).filter(p => p.length >= 3 && p.length <= 13 && !vistas.has(p) && vistas.add(p)).slice(0, 14);
}
export function montarCaca(doc, serie, sorte = Math.random) {
  const palavras = palavrasCaca(doc);
  const ano = Number((String(serie || '').match(/\d+/) || [0])[0]), iniciais = /infantil|polivalente/i.test(serie || '') || (ano >= 1 && ano <= 5 && !/s[ée]rie|m[ée]dio/i.test(serie || ''));
  const DIR = iniciais ? [[0, 1, 'para a direita'], [1, 0, 'para baixo']] : [[0, 1, 'para a direita'], [1, 0, 'para baixo'], [1, 1, 'na diagonal'], [-1, 1, 'na diagonal, subindo']];
  const maior = Math.max(0, ...palavras.map(p => p.length)), letras = palavras.reduce((a, p) => a + p.length, 0);
  const n = Math.min(15, Math.max(iniciais ? 10 : 12, maior + 1, Math.ceil(Math.sqrt(letras * 2.2))));
  const sorteio = k => Math.floor(sorte() * k);
  for (let tent = 0; tent < 30; tent++) {
    const g = Array.from({ length: n }, () => Array(n).fill('')), pos = [];
    let ok = true;
    for (const p of [...palavras].sort((a, b) => b.length - a.length)) {
      let posto = false;
      for (let k = 0; k < 300 && !posto; k++) {
        const [dl, dc, nome] = DIR[sorteio(DIR.length)], l0 = sorteio(n), c0 = sorteio(n), lf = l0 + dl * (p.length - 1), cf = c0 + dc * (p.length - 1);
        if (lf < 0 || lf >= n || cf < 0 || cf >= n) continue;
        let cabe = true;
        for (let i = 0; i < p.length && cabe; i++) { const x = g[l0 + dl * i][c0 + dc * i]; if (x && x !== p[i]) cabe = false; }
        if (!cabe) continue;
        for (let i = 0; i < p.length; i++) g[l0 + dl * i][c0 + dc * i] = p[i];
        pos.push({ p, l: l0 + 1, c: c0 + 1, nome }); posto = true;
      }
      if (!posto) { ok = false; break; }
    }
    if (!ok) continue;
    const ALFA = 'AABCDEEFGHIIJLMNOOPRRSSTUUVZ';
    g.forEach(lin => lin.forEach((x, j) => { if (!x) lin[j] = ALFA[sorteio(ALFA.length)]; }));
    const ordem = palavras.map(p => pos.find(x => x.p === p));
    // a grade entra como uma seção de tabela marcada como "grade"; a lista de palavras fica na grafia sem acento, igual à grade
    // perguntas do "Para pensar" viram itens: o gabarito do caça-palavras numera só as palavras
    (doc.secoes || []).forEach(s => { if ((s.questoes || []).length) { s.itens = [...(s.itens || []), ...s.questoes.map(q => q.enunciado).filter(Boolean)]; delete s.questoes; } });
    const secs = (doc.secoes || []).filter(s => !(s.tabela && (s.tabela.grade || /^ca[cç]a-palavras$/i.test(s.titulo || ''))));
    const iPal = secs.findIndex(s => /palavra/i.test(s.titulo || ''));
    if (iPal >= 0) secs[iPal] = { ...secs[iPal], itens: palavras };
    secs.splice(Math.max(1, iPal >= 0 ? iPal : 1), 0, { titulo: 'Caça-palavras', tabela: { grade: true, colunas: [], linhas: g.map(lin => ({ celulas: lin })) } });
    doc.secoes = secs;
    doc.gabarito = ordem.map((x, i) => ({ questao: i + 1, resposta: x.p, comentario: 'começa na linha ' + x.l + ', coluna ' + x.c + ', ' + x.nome }));
    return doc;
  }
  return doc;   // não coube: a conferência reprova e a IA tenta de novo
}

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
        enunciado: S('Enunciado completo, SEM número na frente; em lacuna use exatamente seis sublinhados (______) no lugar de cada palavra que falta; em vf só a instrução, sem as afirmativas'),
        alternativas: AS('Só em multipla: exatamente 4 opções curtas, sem letra na frente. Nos outros tipos, vazio.'),
        afirmativas: AS('Só em vf: de 3 a 5 frases curtas (até 20 palavras cada) para o aluno marcar V ou F. Nos outros tipos, vazio.'),
        coluna_a: AS('relacionar: de 3 a 5 itens'), coluna_b: AS('relacionar: os correspondentes, embaralhados'),
        linhas: { type: 'INTEGER', description: 'linhas para responder: curta 2, aberta 4, demais 0' },
        valor: { type: 'NUMBER', description: 'pontos da questão (só em prova)' },
        habilidade: S('código BNCC da habilidade que a questão avalia, do ano e do componente informados (ex.: EF05LP09); só se tiver certeza de que o código existe, senão vazio')
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

/* ------------------------------------------------------------------ crédito da IA do Google esgotado (nov/2026)
   O saldo pré-pago do Gemini acabou em 06/11 e ninguém soube: o professor via "tente de novo".
   Agora o professor recebe a mensagem certa (crédito dele não é descontado: quem chamou estorna no erro)
   e o Alan recebe um e-mail na hora, no máximo um a cada 6 horas. */
const ALERTA_CREDITO_PARA = 'alan@newpc.com.br';
const semCreditoGoogle = (status, j) => status === 402 || /prepayment credits? (are|is) depleted|billing.*(disabled|required)/i.test(JSON.stringify(j || {}));
async function avisarSemCredito(detalhe) {
  try {
    const db = getFirestore(), ref = db.doc('config/alerta_ia'), agora = Date.now();
    const mandar = await db.runTransaction(async t => {
      const x = await t.get(ref), ult = (x.exists && x.data().sem_credito_em) || 0;
      if (agora - ult < 6 * 3600e3) return false;
      t.set(ref, { sem_credito_em: agora, sem_credito_detalhe: String(detalhe).slice(0, 300) }, { merge: true }); return true;
    });
    if (!mandar) return;
    const hora = new Date(agora).toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' });
    await emailAlerta(ALERTA_CREDITO_PARA, '⚠️ IA do Portal parada: crédito do Google acabou',
      '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#12202e">' +
      '<div style="background:#b3261e;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:800;font-size:17px">IA do Portal parada: crédito do Google acabou</div>' +
      '<div style="border:1px solid #e1e7ed;border-top:0;padding:16px 18px;border-radius:0 0 10px 10px">' +
      '<p>Às <b>' + hora + '</b> o Google recusou a chamada da IA por <b>falta de crédito pré-pago</b>. Enquanto o saldo não for recarregado, Aula IA, Portal IA e Aulas prontas novas não funcionam para nenhum professor.</p>' +
      '<p>Os professores estão vendo "A IA do Portal está em manutenção" e <b>não perdem créditos</b>.</p>' +
      '<p><b>Como resolver</b><br>1. Entre em <a href="https://ai.studio/projects">ai.studio/projects</a> com a conta <b>newpc.educador@gmail.com</b>.<br>' +
      '2. No projeto <b>Portal 5 PRODUCAO - NAO APAGAR</b>, toque em <b>Comprar créditos</b>.<br>3. Se quiser, ligue a recarga automática.</p>' +
      '<p style="color:#5b6b7b;font-size:13px">Este aviso sai no máximo uma vez a cada 6 horas enquanto o problema continuar.</p></div></div>');
    console.warn('portal-ia: alerta de crédito esgotado enviado');
  } catch (e) { console.error('portal-ia: alerta de crédito não saiu', e.message); }
}
const ERRO_SEM_CREDITO = () => new HttpsError('failed-precondition', 'A IA do Portal está em manutenção agora. Seus créditos não foram descontados. Tente de novo mais tarde.');

/* ------------------------------------------------------------------ chamadas ao Gemini */
async function gemini(chave, modelos, corpo) {
  for (const mod of [...new Set(modelos.filter(Boolean))]) {
    let r;
    try {
      r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mod) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(85000) });
    } catch (e) {
      // a IA às vezes entra em repetição e não termina: corta e deixa a função tentar de novo
      if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) { console.warn('portal-ia: tempo esgotado', mod); return { modelo: mod, partes: [], fim: 'TEMPO', pensou: 0, entrada: 0, saida: 0 }; }
      throw e;
    }
    if (r.status === 404) { console.warn('portal-ia: modelo fora do ar', mod); continue; }
    const j = await r.json().catch(() => ({}));
    // se o modelo não aceitar o ajuste de raciocínio, repete a chamada sem ele
    if (r.status === 400 && corpo.generationConfig && corpo.generationConfig.thinkingConfig && /think/i.test(JSON.stringify(j))) {
      console.warn('portal-ia: sem thinkingConfig em', mod); const c2 = JSON.parse(JSON.stringify(corpo)); delete c2.generationConfig.thinkingConfig; return gemini(chave, [mod, ...modelos.filter(m => m !== mod)], c2);
    }
    if (!r.ok) { console.error('portal-ia gemini', mod, r.status, JSON.stringify(j).slice(0, 400));
      if (semCreditoGoogle(r.status, j)) { await avisarSemCredito(r.status + ' ' + JSON.stringify(j).slice(0, 200)); throw ERRO_SEM_CREDITO(); }
      throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.'); }
    const u = j.usageMetadata || {}, cand = (j.candidates || [])[0] || {};
    const partes = (cand.content || {}).parts || [];
    return { modelo: mod, partes, fim: cand.finishReason || '', pensou: u.thoughtsTokenCount || 0, entrada: u.promptTokenCount || 0, saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
  }
  throw new HttpsError('unavailable', 'Nenhum modelo da IA está disponível agora. Avise a NEWPC.');
}
// Versão em fluxo (SSE) para as respostas em JSON: vai lendo o texto enquanto a IA escreve e,
// se um campo de texto passar do tamanho de qualquer conteúdo de aula (sinal de que o modelo entrou em repetição),
// corta na hora em vez de esperar ela gastar 12 mil tokens. Quem chamou tenta de novo.
const LIMITE_CAMPO = 3500;
export async function geminiFluxo(chave, modelos, corpo, limiteMs = 85000) {
  for (const mod of [...new Set(modelos.filter(Boolean))]) {
    const ctl = new AbortController(), relogio = setTimeout(() => ctl.abort(), limiteMs);
    let r;
    try {
      r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mod) + ':streamGenerateContent?alt=sse', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: ctl.signal });
    } catch (e) {
      clearTimeout(relogio);
      if (e && e.name === 'AbortError') { console.warn('portal-ia: tempo esgotado', mod); return { modelo: mod, partes: [], fim: 'TEMPO', pensou: 0, entrada: 0, saida: 0 }; }
      throw e;
    }
    if (r.status === 404) { clearTimeout(relogio); console.warn('portal-ia: modelo fora do ar', mod); continue; }
    if (!r.ok) {
      clearTimeout(relogio); const j = await r.json().catch(() => ({}));
      if (r.status === 400 && corpo.generationConfig && corpo.generationConfig.thinkingConfig && /think/i.test(JSON.stringify(j))) {
        console.warn('portal-ia: sem thinkingConfig em', mod); const c2 = JSON.parse(JSON.stringify(corpo)); delete c2.generationConfig.thinkingConfig; return geminiFluxo(chave, [mod, ...modelos.filter(m => m !== mod)], c2);
      }
      console.error('portal-ia gemini', mod, r.status, JSON.stringify(j).slice(0, 400));
      if (semCreditoGoogle(r.status, j)) { await avisarSemCredito(r.status + ' ' + JSON.stringify(j).slice(0, 200)); throw ERRO_SEM_CREDITO(); }
      throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
    }
    let texto = '', fim = '', u = {}, buf = '', semAspas = 0, cortou = false;
    const dec = new TextDecoder();
    try {
      for await (const pedaco of r.body) {
        buf += dec.decode(pedaco, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const linha = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!linha.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(linha.slice(5)); } catch (e) { continue; }
          if (ev.usageMetadata) u = ev.usageMetadata;
          const cand = (ev.candidates || [])[0] || {};
          if (cand.finishReason) fim = cand.finishReason;
          for (const p of (cand.content || {}).parts || []) {
            if (p.thought || !p.text) continue;
            texto += p.text;
            // conta quantos caracteres vieram desde a última aspa: um campo de texto aberto há tempo demais
            const k = p.text.lastIndexOf('"'); semAspas = k >= 0 ? p.text.length - k - 1 : semAspas + p.text.length;
          }
          if (semAspas > LIMITE_CAMPO) { cortou = true; break; }
        }
        if (cortou) break;
      }
    } catch (e) {
      if (!(e && e.name === 'AbortError')) throw e;
      fim = fim || 'TEMPO';
    } finally { clearTimeout(relogio); if (cortou) ctl.abort(); }
    if (cortou) { fim = 'REPETICAO'; console.warn('portal-ia: repetição cortada', mod, texto.length, texto.slice(-160)); }
    return { modelo: mod, partes: [{ text: texto }], fim, pensou: u.thoughtsTokenCount || 0, entrada: u.promptTokenCount || 0, saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) || Math.round(texto.length / 4) };
  }
  throw new HttpsError('unavailable', 'Nenhum modelo da IA está disponível agora. Avise a NEWPC.');
}
export async function geminiJson(chave, modelos, sistema, pedido, esquema, temp, limiteMs = 85000) {
  // Gemini 3 em diante: temperatura padrão (1.0), como o Google recomenda; abaixo disso ele entra em repetição e estoura o limite
  const r = await geminiFluxo(chave, modelos, { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: pedido }] }],
    generationConfig: { ...(/gemini-[3-9]/.test(modelos[0] || '') ? {} : { temperature: temp ?? 0.6 }), responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 32000 } }, limiteMs);
  const bruto = r.partes.filter(p => !p.thought).map(p => p.text || '').join('');
  let json = null; try { json = JSON.parse(bruto); } catch (e) { json = null; console.warn('portal-ia: JSON inválido', r.modelo, 'fim', r.fim, 'pensou', r.pensou, 'tamanho', bruto.length, 'inicio', bruto.slice(0, 1400).replace(/\s+/g, ' '), 'fim', bruto.slice(-200)); }
  return { ...r, json };
}

/* ------------------------------------------------------------------ limpeza e conferência */
const semMarca = t => String(t ?? '').replace(/^\s*(\(\s*\)|\[\s*\]|[A-Ea-e][).]|\d+[).])\s*/, '').trim();
const ehCombinacao = a => /^[VF](\s*[-,;/]?\s*[VF])+$/i.test(String(a || '').trim());
/* ------------------------------------------------------------------ Provas e Avaliações: questões no formato da ferramenta */
// aula em slides para a Lousa: capa + slides em formatos variados, com roteiro do professor; texto curto, para ler de longe
// ranking de temas (Lousa e Portal IA): conta só o tema escolhido no banco de temas do Portal (identificador curto),
// nunca o texto digitado (que pode trazer nome de aluno). Sem leitura: um incremento por material gerado.
function contarTema(db, d) {
  const chaveTema = String(d.tema_chave || ''), idTema = String(d.tema_id || '');
  if (/^(ei|ef[1-9]|em[1-3])\|[A-Za-zÀ-ú ]{3,30}$/.test(chaveTema) && /^[a-z0-9-]{3,60}$/.test(idTema))
    db.doc('temas_populares/' + chaveTema.replace('|', '__').replace(/ /g, '_')).set({ [idTema]: FieldValue.increment(1) }, { merge: true }).catch(() => {});
}
export const TIPOS_SLIDE = ['topicos', 'conceito', 'curiosidade', 'dado', 'numeros', 'tabela', 'calculo', 'linha_tempo', 'passos', 'comparacao', 'mapa', 'quiz', 'atividade', 'resumo'];
export const ESQUEMA_AULA = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título da aula, curto e atraente (até 60 caracteres).'),
    subtitulo: S('Uma frase que desperta a curiosidade da turma (até 110 caracteres).'),
    objetivo: S('Objetivo de aprendizagem: o que o aluno será capaz de fazer ao final, começando com verbo (até 160 caracteres).'),
    bncc: AS('Até 2 códigos de habilidade da BNCC, SÓ se tiver certeza de que existem e são do ano certo; senão, vazio.'),
    capa_ilustracao: S('Descrição de uma ilustração para a capa (uma frase, sem texto na imagem).'),
    slides: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: TIPOS_SLIDE, description:
        'topicos: 3 a 4 tópicos, cada um com uma ideia completa. ' +
        'conceito: definição precisa em "destaque", "explicacao" do porquê/como funciona, um "exemplo" do cotidiano brasileiro e, se houver, o "erro_comum" que alunos costumam cometer. ' +
        'curiosidade: um fato surpreendente e verdadeiro em "destaque" e a "explicacao" do porquê. ' +
        'dado: um número marcante e verificável em "numero" (ex.: "70%", "1,5 milhão", "1500"), o que ele significa em "legenda" e a "explicacao". Só use dado que você tem certeza. ' +
        'numeros: 2 a 4 valores grandes lado a lado em "numeros" (valor, rotulo, detalhe), para proporções, resultados e comparações numéricas (ex.: 25% · 50% · 25%). ' +
        'tabela: quadro em "cabecalho" (títulos das colunas) e "linhas" (cada uma com "celulas" na ordem das colunas); use para quadro de Punnett, tabela de dados, classificação, tabuada, frequência. ' +
        'calculo: o problema em "destaque", a resolução em "calculo" (2 a 5 etapas, cada uma com a "conta" armada e o que ela faz em "explica") e a resposta final em "resultado". Use SEMPRE que a aula envolver conta. ' +
        'linha_tempo: 3 a 5 "itens" com rotulo = data ou período e texto = o que aconteceu e por que importa. ' +
        'passos: 3 a 5 etapas em "topicos", cada uma com o que fazer e por quê. ' +
        'comparacao: 2 "colunas" com titulo e 3 itens cada, comparando as mesmas características. ' +
        'mapa: mapa mental do tema, com 4 a 6 ramos em "topicos" no formato "Palavra-chave: explicação curta". ' +
        'quiz: pergunta de verificação em "destaque", exatamente 4 "alternativas" plausíveis (só uma certa), "correta" = posição (0 a 3) e a "resposta" explicando por que é a certa. ' +
        'atividade: um desafio para a turma fazer em dupla ou no caderno em "destaque" e a "resposta" esperada. ' +
        'resumo: 4 ideias principais em "topicos" (use no último slide).' },
      titulo: S('Título do slide, até 55 caracteres.'),
      icone: S('Um único emoji que represente o slide.'),
      topicos: AS('Frases curtas e informativas (até 90 caracteres cada), sem marcador na frente.'),
      destaque: S('Texto principal de conceito, curiosidade, quiz ou atividade, curto e direto (até 150 caracteres).'),
      explicacao: S('Em conceito, curiosidade e dado: o porquê ou o como, em linguagem da turma, numa frase (até 140 caracteres).'),
      exemplo: S('Em conceito: um exemplo do cotidiano do aluno brasileiro (até 110 caracteres).'),
      erro_comum: S('Em conceito: um erro ou confusão comum dos alunos sobre o assunto (até 110 caracteres). Pode ficar vazio.'),
      numero: S('Em dado: o número em destaque, curto (até 14 caracteres).'),
      legenda: S('Em dado: o que o número significa (até 100 caracteres).'),
      alternativas: AS('Em quiz: exatamente 4 alternativas curtas (até 90 caracteres), sem letra na frente.'),
      correta: { type: 'INTEGER', description: 'Em quiz: posição da alternativa correta (0 a 3).' },
      resposta: S('Em quiz e atividade: a resposta com a justificativa (até 220 caracteres).'),
      itens: { type: 'ARRAY', items: { type: 'OBJECT', properties: { rotulo: S('Data ou período curto'), texto: S('O que aconteceu e por que importa, até 120 caracteres') }, required: ['rotulo', 'texto'] } },
      numeros: { type: 'ARRAY', description: 'Em numeros: 2 a 4 valores lado a lado.', items: { type: 'OBJECT', properties: { valor: S('Valor curto, até 10 caracteres (ex.: "25%", "1/4", "3:1", "R$ 1.331")'), rotulo: S('O que o valor representa, até 40 caracteres'), detalhe: S('Complemento opcional, até 60 caracteres (ex.: "1/4 = 25%")') }, required: ['valor', 'rotulo'] } },
      cabecalho: AS('Em tabela: títulos das colunas (2 a 5), curtos. A primeira pode ficar vazia (ex.: canto do quadro de Punnett).'),
      linhas: { type: 'ARRAY', description: 'Em tabela: 2 a 6 linhas.', items: { type: 'OBJECT', properties: { celulas: AS('Células da linha, na ordem das colunas, curtas (até 40 caracteres cada)') }, required: ['celulas'] } },
      calculo: { type: 'ARRAY', description: 'Em calculo: 2 a 5 etapas, na ordem da resolução.', items: { type: 'OBJECT', properties: { conta: S('A conta armada desta etapa, só números e sinais (ex.: "1/2 × 1/4 = 1/8 = 12,5%" ou "1.000 × 1,1 = 1.100"). Refaça a conta antes de escrever.'), explica: S('O que esta etapa faz, numa frase curta (até 90 caracteres).') }, required: ['conta'] } },
      resultado: S('Em calculo: a resposta final, curta (ex.: "1/8 = 12,5%").'),
      colunas: { type: 'ARRAY', items: { type: 'OBJECT', properties: { titulo: S('Título da coluna'), itens: AS('3 itens, até 90 caracteres cada') }, required: ['titulo', 'itens'] } },
      pergunta: S('Uma pergunta aberta para o professor fazer à turma, que faça pensar (até 130 caracteres). Pode ficar vazia.'),
      roteiro: S('O que o professor fala ou faz neste slide, em até 2 frases curtas.'),
      aprofundamento: S('Só para o professor (vai para o Guia do professor, não aparece na tela): explicação aprofundada do conteúdo do slide, contexto, detalhes e como responder às dúvidas mais prováveis, em 3 a 5 frases (até 700 caracteres).'),
      minutos: { type: 'INTEGER', description: 'Tempo sugerido para o slide, em minutos (1 a 10).' },
      ilustracao: S('Se uma imagem ajudar a entender este slide, descreva-a em uma frase; senão, vazio.')
    }, required: ['tipo', 'titulo'] } }
  },
  required: ['titulo', 'slides']
};
// etapa da turma pelo texto (ex.: "1º ano EM", "7º B", "Pré II"); vazio quando não dá para saber
export function etapaDaTurma(t) {
  const x = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/medio|\bem\b|\d\s*em\b|eja|tecnico|superior/.test(x)) return 'medio';
  if (/infantil|pre\b|pre-?escola|maternal|bercario|creche|\bg[1-5]\b/.test(x)) return 'infantil';
  const n = (x.match(/\b([1-9])\s*(o|º|ª|a)?\s*ano/) || [])[1];
  if (n) return Number(n) <= 5 ? 'iniciais' : 'finais';
  return '';
}
const ETAPA_TXT = { infantil: 'Educação Infantil (crianças de 4 a 5 anos)', iniciais: 'Anos iniciais do Ensino Fundamental (crianças de 6 a 10 anos)', finais: 'Anos finais do Ensino Fundamental (11 a 14 anos)', medio: 'Ensino Médio (adolescentes de 15 a 17 anos)' };
// estilo das ilustrações: o professor escolhe; no automático, segue a etapa (nada de desenho infantil para adolescentes)
export function estiloIlustracao(escolha, etapa) {
  const E = { infantil: 'ilustração infantil colorida, traço simples e acolhedor', didatica: 'ilustração didática de livro escolar, semi-realista, cores naturais, sem aparência de desenho animado',
    realista: 'imagem realista e sóbria, como fotografia documental ou pintura histórica, cores naturais' };
  if (E[escolha]) return E[escolha];
  return etapa === 'infantil' || etapa === 'iniciais' ? E.infantil : etapa === 'finais' ? E.didatica : E.realista;
}
// limpa e confere a aula devolvida pela IA (cada formato precisa do seu conteúdo; senão vira lista de tópicos)
export function paraAula(j, qtd) {
  // a IA às vezes devolve o nome do campo no lugar do texto ("destaque"): isso vira vazio
  const VAZIO = /^(destaque|explica[cç][aã]o|explica|exemplo|erro[_ ]comum|t[oó]picos?|legenda|resposta|t[ií]tulo|pergunta|roteiro|n[uú]mero|texto|conta|resultado|r[oó]tulo|valor|detalhe|vazio|null|undefined|n\/a|-)$/i;
  const c = (v, n) => { const t = String(v || '').replace(/\s+/g, ' ').trim(); return VAZIO.test(t) ? '' : t.slice(0, n); };
  // tira só o marcador de lista ("- ", "• ", "1) ", "2. "); número que faz parte do texto fica ("10 kWh", "1500 pessoas")
  const lista = (v, n, m) => (Array.isArray(v) ? v : []).map(t => c(t, m).replace(/^\s*(?:[-•*]\s*|\d{1,2}[.)]\s+)/, '')).filter(Boolean).slice(0, n);
  const slides = (Array.isArray(j && j.slides) ? j.slides : []).map(x => {
    x = x || {};
    const alts = lista(x.alternativas, 4, 110).map(a => a.replace(/^[a-dA-D][).:-]\s*/, ''));
    const sl = { tipo: TIPOS_SLIDE.includes(x.tipo) ? x.tipo : 'topicos', titulo: c(x.titulo, 70), icone: c(x.icone, 8), topicos: lista(x.topicos, 6, 170),
      destaque: c(x.destaque, 280), explicacao: c(x.explicacao, 280), exemplo: c(x.exemplo, 200), erro_comum: c(x.erro_comum, 180), numero: c(x.numero, 16), legenda: c(x.legenda, 170),
      alternativas: alts, correta: Number.isInteger(x.correta) && x.correta >= 0 && x.correta < alts.length ? x.correta : -1,
      resposta: c(x.resposta, 260), pergunta: c(x.pergunta, 150), roteiro: c(x.roteiro, 240), aprofundamento: c(x.aprofundamento, 800),
      minutos: Number(x.minutos) > 0 ? Math.min(10, Math.max(1, Math.round(Number(x.minutos)))) : 0, ilustracao: c(x.ilustracao, 300),
      itens: (Array.isArray(x.itens) ? x.itens : []).map(i => ({ rotulo: c(i && i.rotulo, 30), texto: c(i && i.texto, 140) })).filter(i => i.rotulo && i.texto).slice(0, 5),
      colunas: (Array.isArray(x.colunas) ? x.colunas : []).map(k => ({ titulo: c(k && k.titulo, 40), itens: lista(k && k.itens, 4, 110) })).filter(k => k.titulo && k.itens.length).slice(0, 2),
      numeros: (Array.isArray(x.numeros) ? x.numeros : []).map(n => ({ valor: c(n && n.valor, 14), rotulo: c(n && n.rotulo, 60), detalhe: c(n && n.detalhe, 90) })).filter(n => n.valor && n.rotulo).slice(0, 4),
      cabecalho: (Array.isArray(x.cabecalho) ? x.cabecalho : []).slice(0, 5).map(t => c(t, 50)),
      linhas: (Array.isArray(x.linhas) ? x.linhas : []).map(l => (Array.isArray(l && l.celulas) ? l.celulas : []).slice(0, 5).map(t => c(t, 60))).filter(l => l.some(Boolean)).slice(0, 7),
      calculo: (Array.isArray(x.calculo) ? x.calculo : []).map(e => ({ conta: c(e && e.conta, 140), explica: c(e && e.explica, 130) })).filter(e => e.conta).slice(0, 5),
      resultado: c(x.resultado, 70) };
    const ok = { topicos: sl.topicos.length, passos: sl.topicos.length >= 2, resumo: sl.topicos.length >= 2, mapa: sl.topicos.length >= 3, conceito: !!sl.destaque, curiosidade: !!sl.destaque,
      atividade: !!sl.destaque, dado: !!(sl.numero && sl.legenda), quiz: !!sl.destaque && sl.alternativas.length === 4 && sl.correta >= 0,
      linha_tempo: sl.itens.length >= 2, comparacao: sl.colunas.length === 2, numeros: sl.numeros.length >= 2,
      tabela: sl.linhas.length >= 1 && Math.max(sl.cabecalho.filter(Boolean).length, ...sl.linhas.map(l => l.length)) >= 2, calculo: sl.calculo.length >= 1 }[sl.tipo];
    if (!ok) {
      const t = sl.topicos.length ? sl.topicos : [sl.destaque, sl.explicacao, sl.exemplo, sl.numero && sl.legenda ? sl.numero + ': ' + sl.legenda : ''].filter(Boolean)
        .concat(sl.itens.map(i => i.rotulo + ': ' + i.texto)).concat(sl.colunas.flatMap(k => k.itens.map(i => k.titulo + ': ' + i)))
        .concat(sl.numeros.map(n => n.valor + ': ' + n.rotulo)).concat(sl.linhas.map(l => l.filter(Boolean).join(' · '))).concat(sl.calculo.map(e => e.conta)).concat(sl.resultado ? ['Resposta: ' + sl.resultado] : []);
      sl.tipo = 'topicos'; sl.topicos = t.slice(0, 4);
    }
    return sl;
  }).filter(x => x.titulo && (x.tipo !== 'topicos' || x.topicos.length)).slice(0, qtd);
  return { titulo: c(j && j.titulo, 80), subtitulo: c(j && j.subtitulo, 130), objetivo: c(j && j.objetivo, 180), bncc: lista(j && j.bncc, 2, 12).filter(b => /^E[IFM]\d{2}[A-Z]{2}\d{2,3}/.test(b)),
    capa_ilustracao: c(j && j.capa_ilustracao, 300), slides };
}
// conferência das contas (slides de cálculo e números): cada trecho entre "=" (ou "≈") que for só número tem que dar o mesmo valor
export function valorConta(t) {
  let x = String(t || '').replace(/R\$\s*/g, '').replace(/\s+/g, '').replace(/[×xX·∙*]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
  x = x.replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\^/g, '**');
  if (!/\d/.test(x) || !/^[\d+\-*/().]+$/.test(x)) return null;
  try { const v = Function('"use strict";return (' + x + ');')(); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
}
export function contaErrada(t) {
  const partes = String(t || '').split(/(=|≈|≅)/), vals = [];
  for (let i = 0; i < partes.length; i += 2) { const v = valorConta(partes[i]); if (v !== null) vals.push({ v, aprox: partes[i - 1] && partes[i - 1] !== '=' }); }
  for (let i = 1; i < vals.length; i++) { const a = vals[0].v, b = vals[i].v, tol = vals[i].aprox ? 0.02 : 0.006;
    if (Math.abs(a - b) > Math.max(1e-9, tol * Math.max(Math.abs(a), Math.abs(b)))) return true; }
  return false;
}
export function contasErradas(aula) {
  const out = [];
  (aula && aula.slides || []).forEach((sl, i) => {
    const contas = (sl.calculo || []).map(e => e.conta).concat(sl.resultado ? [sl.resultado] : []).concat((sl.numeros || []).map(n => n.detalhe).filter(Boolean));
    const errada = contas.find(contaErrada); if (errada) out.push({ i, conta: errada });
  });
  return out;
}
// Aula em duas etapas (nov/2026): primeiro o PLANO (tipo e título de cada slide, na quantidade pedida) e depois cada slide com o
// esquema do seu tipo, com os campos daquele formato OBRIGATÓRIOS. Num esquema único com tudo opcional, a IA pulava campos
// (cálculo sem as contas, quiz sem alternativas) e o slide virava uma frase solta.
export const ESQUEMA_PLANO = {
  type: 'OBJECT',
  properties: {
    titulo: S('Título da aula, curto e atraente (até 60 caracteres).'),
    subtitulo: S('Uma frase que desperta a curiosidade da turma (até 110 caracteres).'),
    objetivo: S('Objetivo de aprendizagem, começando com verbo (até 160 caracteres).'),
    bncc: AS('Até 2 códigos de habilidade da BNCC, SÓ se tiver certeza de que existem e são do ano certo; senão, vazio.'),
    capa_ilustracao: S('Descrição de uma ilustração para a capa (uma frase, sem texto na imagem).'),
    slides: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: TIPOS_SLIDE },
      titulo: S('Título do slide, até 55 caracteres.'),
      foco: S('O que este slide ensina ou pede, em uma frase concreta (conteúdo, conta ou pergunta que vai aparecer).')
    }, required: ['tipo', 'titulo', 'foco'] } }
  },
  required: ['titulo', 'subtitulo', 'objetivo', 'slides']
};
const CAMPOS_TIPO = { topicos: ['topicos'], conceito: ['destaque', 'explicacao', 'exemplo'], curiosidade: ['destaque', 'explicacao'], dado: ['numero', 'legenda', 'explicacao'],
  numeros: ['numeros'], tabela: ['cabecalho', 'linhas'], calculo: ['destaque', 'calculo', 'resultado'], linha_tempo: ['itens'], passos: ['topicos'], comparacao: ['colunas'],
  mapa: ['topicos'], quiz: ['destaque', 'alternativas', 'correta', 'resposta'], atividade: ['destaque', 'resposta'], resumo: ['topicos'] };
const OPCIONAIS_TIPO = { conceito: ['erro_comum'] };
// instrução de cada formato, tirada da descrição do campo "tipo" do esquema único (uma fonte só)
export function descTipo(tipo) {
  const d = ESQUEMA_AULA.properties.slides.items.properties.tipo.description || '', re = new RegExp('(?:^|\\s)(' + TIPOS_SLIDE.join('|') + '): ', 'g'), marcas = [];
  let m; while ((m = re.exec(d))) marcas.push({ t: m[1], i: m.index + m[0].length });
  const k = marcas.findIndex(x => x.t === tipo); if (k < 0) return '';
  return d.slice(marcas[k].i, k + 1 < marcas.length ? marcas[k + 1].i - marcas[k + 1].t.length - 2 : d.length).trim();
}
export function esquemaSlide(tipo) {
  const P = ESQUEMA_AULA.properties.slides.items.properties, campos = CAMPOS_TIPO[tipo] || ['topicos'];
  const usa = ['titulo', 'icone', ...campos, ...(OPCIONAIS_TIPO[tipo] || []), 'pergunta', 'roteiro', 'aprofundamento', 'minutos', 'ilustracao'];
  const props = {}; usa.forEach(k => { if (P[k]) props[k] = P[k]; });
  return { type: 'OBJECT', properties: props, required: ['titulo', ...campos, 'roteiro', 'aprofundamento', 'minutos'] };
}
const DENSIDADE = {
  infantil: 'Pouco texto na tela: uma ideia por slide, frases bem curtas e simples (no máximo umas 20 palavras visíveis por slide).',
  iniciais: 'Pouco texto na tela: uma ideia por slide, frases curtas (no máximo umas 30 palavras visíveis por slide).',
  finais: 'Texto na tela objetivo: frases completas e curtas, até umas 50 palavras visíveis por slide, com exemplos concretos.',
  medio: 'Conteúdo completo e preciso, no nível de vestibular e ENEM: termos técnicos corretos, fórmulas, contas armadas e exemplos; até umas 70 palavras visíveis por slide, bem organizadas em tabela, cálculo ou números lado a lado em vez de parágrafo.'
};
export const ESQUEMA_QUESTOES = {
  type: 'OBJECT',
  properties: {
    questoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      tipo: { type: 'STRING', enum: ['multipla', 'vf', 'curta', 'dissertativa'] },
      enunciado: S('Enunciado completo e claro, sem número na frente. Em vf, UMA afirmação para o aluno julgar.'),
      alternativas: AS('Só em multipla: exatamente 4 opções curtas, sem letra na frente. Nos outros tipos, vazio.'),
      correta: { type: 'INTEGER', description: 'Só em multipla: posição da alternativa correta (0 a 3).' },
      vf: S('Só em vf: a letra V se a afirmação é verdadeira, F se é falsa. Nos outros tipos, vazio.'),
      esperado: S('Em curta e dissertativa: a resposta esperada ou o critério de correção, para o professor.'),
      valor: { type: 'NUMBER', description: 'Pontos da questão.' },
      bncc: S('Código da habilidade da BNCC (ex.: EF05MA03) só se tiver certeza; senão vazio.')
    }, required: ['tipo', 'enunciado'] } }
  },
  required: ['questoes']
};
const TIPOS_PROVA = { mista: 'mistas: a maioria de múltipla escolha, algumas de verdadeiro ou falso, 1 ou 2 de resposta curta e 1 dissertativa', multipla: 'todas de múltipla escolha',
  vf: 'todas de verdadeiro ou falso', aberta: 'todas dissertativas', curta: 'todas de resposta curta' };
// converte para o formato do Provas e Avaliações e ajusta os pontos ao total pedido
export function paraProvas(lista, total) {
  const qs = (lista || []).map(q => {
    const tipo = ['multipla', 'vf', 'curta', 'dissertativa'].includes(q.tipo) ? q.tipo : 'dissertativa';
    const o = { tipo, enun: String(q.enunciado || '').replace(/^\s*(quest[aã]o\s*)?\d{1,2}\s*[).:\-–]\s*/i, '').trim(), valor: Number(q.valor) > 0 ? Number(q.valor) : 1,
      bncc: (String(q.bncc || '').toUpperCase().match(/E[FIM]\d{2}[A-Z]{2}\d{2,3}/) || [''])[0] };
    if (tipo === 'multipla') {
      o.alts = (q.alternativas || []).map(semMarca).filter(Boolean).slice(0, 5); const c = Number(q.correta); o.gab = Number.isInteger(c) && c >= 0 && c < o.alts.length ? c : -1;
      // a IA tende a pôr a correta sempre na mesma letra: embaralha e acompanha o gabarito
      if (o.gab >= 0) { const certa = o.alts[o.gab]; for (let i = o.alts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o.alts[i], o.alts[j]] = [o.alts[j], o.alts[i]]; } o.gab = o.alts.indexOf(certa); }
    }
    if (tipo === 'vf') { const v = String(q.vf || '').trim().toUpperCase().charAt(0); o.gab = v === 'V' || v === 'F' ? v : ''; }
    if (tipo === 'curta' || tipo === 'dissertativa') o.exp = String(q.esperado || '').trim();
    return o;
  }).filter(q => q.enun);
  if (total > 0 && qs.length) {
    const soma = qs.reduce((a, q) => a + q.valor, 0) || 1;
    qs.forEach(q => { q.valor = Math.max(0.25, Math.round(q.valor / soma * total * 4) / 4); });
    const dif = Math.round((total - qs.reduce((a, q) => a + q.valor, 0)) * 4) / 4;
    if (dif) { const m = qs.reduce((a, q) => q.valor > a.valor ? q : a, qs[0]); m.valor = Math.max(0.25, Math.round((m.valor + dif) * 4) / 4); }
  }
  return qs;
}
export function conferirQuestoes(qs, qtd) {
  const prob = [];
  if (!qs.length) return ['sem questões'];
  if (qtd && Math.abs(qs.length - qtd) > 1) prob.push('veio com ' + qs.length + ' questões em vez de ' + qtd);
  qs.forEach((q, i) => {
    if (q.tipo === 'multipla' && (q.alts.length !== 4 || q.gab < 0)) prob.push('questão ' + (i + 1) + ' de múltipla escolha sem 4 alternativas ou sem a correta');
    if (q.tipo === 'vf' && !q.gab) prob.push('questão ' + (i + 1) + ' de V ou F sem a resposta');
  });
  return prob;
}

export function limparDoc(d) {
  (d.secoes || []).forEach(s => (s.questoes || []).forEach(q => {
    q.enunciado = String(q.enunciado || '').replace(/^\s*(quest[aã]o\s*)?\d{1,2}\s*[).:\-–]\s*/i, '').trim();
    // V ou F com as afirmativas dentro do enunciado e combinações nas alternativas: separa do jeito certo
    if (q.tipo === 'vf' && Array.isArray(q.afirmativas) && q.afirmativas.length) q.alternativas = q.afirmativas;
    delete q.afirmativas;
    if (q.tipo === 'vf' && (q.alternativas || []).length && q.alternativas.every(ehCombinacao)) {
      const linhas = q.enunciado.split(/\n|\s\|\s/).map(x => x.trim()).filter(Boolean);
      const afirm = linhas.filter(x => /^\(\s*\)/.test(x)).map(semMarca);
      if (afirm.length >= 2) { q.alternativas = afirm; q.enunciado = linhas.filter(x => !/^\(\s*\)/.test(x)).join(' '); }
    }
    ['alternativas', 'coluna_a', 'coluna_b'].forEach(k => { if (Array.isArray(q[k])) q[k] = q[k].map(semMarca).filter(Boolean); });
    // habilidade da BNCC por questão: só fica se o código existe de verdade (a IA às vezes inventa)
    const cod = String(q.habilidade || '').toUpperCase().match(/E[FIM]\d{2}[A-Z]{2,3}\d{2,3}/);
    q.habilidade = cod && CODIGOS_BNCC.has(cod[0]) ? cod[0] : '';
  }));
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
    if (q.tipo === 'vf' && (alt.length < 2 || alt.some(ehCombinacao))) prob.push('questão ' + n + ' de V ou F sem as afirmativas nas alternativas');
    if (q.tipo === 'relacionar' && ((q.coluna_a || []).length < 2 || (q.coluna_a || []).length !== (q.coluna_b || []).length)) prob.push('questão ' + n + ' de relacionar com colunas desiguais');
  });
  // texto em repetição (a IA às vezes entra em laço e repete as mesmas palavras): reprova para tentar de novo
  const textos = secoes.flatMap(s => [s.texto || '', ...(s.itens || [])]).concat(d.nota_professor || '');
  textos.forEach(t => {
    const ws = String(t).toLowerCase().match(/[a-zà-ú]{4,}/g) || [];
    if (ws.length > 120 && new Set(ws).size / ws.length < 0.4) prob.push('texto repetitivo ("' + String(t).slice(0, 40) + '...")');
    else if (String(t).length > 1800) prob.push('texto longo demais');
  });
  if (tipo === 'ficha_ei') {
    // a parte da criança: qualquer seção que não seja do professor, com pelo menos 2 consignas (a IA às vezes dá outro nome)
    const at = secoes.find(s => !/^(para o professor|orienta|para ampliar|amplia)/i.test(String(s.titulo || '').trim()) && (s.itens || []).length >= 2);
    if (!at) prob.push('falta a seção "Atividade" com as consignas para a criança (itens curtos, uma ação por item)');
    if (!String(d.sugestao_imagem || '').trim()) prob.push('falta a sugestão da ilustração');
  }
  if (tipo === 'cacapalavras') {
    const gr = secoes.find(s => s.tabela && s.tabela.grade);
    if (palavrasCaca(d).length < 5) prob.push('poucas palavras para o caça-palavras (mínimo 5, de 3 a 13 letras)');
    else if (!gr) prob.push('as palavras não couberam na grade');
  }
  if (tipo === 'prova' && qs.length) { const soma = qs.reduce((a, q) => a + (Number(q.valor) || 0), 0); if (soma > 0 && Math.abs(soma - 10) > 0.05 && !/total|pontos|valendo/i.test(d._pedido || '')) prob.push('valores somando ' + soma + ' em vez de 10'); }
  return prob;
}

/* ------------------------------------------------------------------ quem pode, quanto pode */
const mesAtual = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '');
const txt = (v, n) => String(v ?? '').trim().slice(0, n);
export async function contexto(db, uid) {
  const [us, cs] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc('config/portal_ia').get()]);
  const eu = us.exists ? us.data() : null;
  if (!eu || eu.status !== 'ativo' || !['professor', 'gestor', 'admin'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'O Portal IA é para professores e gestores com cadastro ativo.');
  const c = cs.exists ? cs.data() : {};
  const cfg = { ...PADRAO, ...c, planos: { ...PADRAO.planos, ...(c.planos || {}) } };
  const admin = eu.perfil === 'admin';
  if (!admin && !cfg.ativo) throw new HttpsError('failed-precondition', 'O Portal IA está em manutenção.');
  // quem usa cada recurso agora é decidido na Central de IA (ia-acesso.js), recurso a recurso
  let plano = 'basico', muni = null;
  if (admin) plano = 'completo';
  // só quem é da rede (licença institucional) usa o plano e a Central de IA do município; avulso, cortesia e teste seguem a própria licença
  else if (daRede(eu)) { const m = await db.doc(`municipios/${eu.municipio_id}`).get(); muni = m.exists ? m.data() : null; plano = (muni && muni.plano_nome) || 'basico'; }
  else if (eu.plano_avulso) plano = eu.plano_avulso;
  // quem pode usar e quanto: créditos da rede (plano Intermediário ou Completo) e créditos avulsos do professor (creditos.js)
  const ia = { admin, geral: geralIA(c), rede: admin ? new Set() : iaDaRede(muni, plano), user: admin ? new Set() : iaDoUsuario(daRede(eu) ? eu : { ...eu, municipio_id: '' }) };
  return { eu, cfg, cfgRaw: c, admin, plano, muni, ia, uid, usoRef: db.doc(`portal_ia_uso/${uid}_${mesAtual()}`) };
}
function contextoTexto(cx) {
  return ['Disciplina: ' + (cx.disciplina || 'não informada'), 'Série: ' + (cx.serie || 'não informada'), cx.turma ? 'Turma: ' + cx.turma : '', cx.necessidade ? 'Necessidade da turma: ' + cx.necessidade : '']
    .filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ a função */
// o corpo da função fica separado para a fila do acervo (acervoFila) usar exatamente o mesmo caminho do professor
async function tratarPortalIa(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const ctx = await contexto(db, uid); ctx.uid = uid;
  const cx = { disciplina: txt(d.contexto && d.contexto.disciplina, 60), serie: txt(d.contexto && d.contexto.serie, 30), turma: txt(d.contexto && d.contexto.turma, 60), necessidade: txt(d.contexto && d.contexto.necessidade, 60) };
  const chave = GEMINI.value();
  // Central de IA: confere o recurso e diz se a carteira da rede paga (senão, só créditos próprios do professor)
  const exigir = r => { const a = acessoIA(r, ctx.ia); if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso(r, a.motivo)); return { rede: a.via === 'rede' ? true : a.via === 'admin' ? undefined : false, nome: NOMES_IA[r] }; };
  const cota = async () => {
    const tx = ['portalia', 'provas_ia', 'lousa_ia'].some(r => ctx.ia.rede.has(r)), im = ['portalia_imagem', 'lousa_ia_ultra'].some(r => ctx.ia.rede.has(r));
    const st = await situacao(db, ctx, ctx.admin ? {} : { redeTexto: tx, redeImagem: im });
    st.recursos = mapaAcesso(ctx.ia); return st;
  };

  // 0) como está a cota (a tela mostra ao abrir) e o que esta pessoa pode usar
  if (d.acao === 'cota') return cota();

  // 1) entender o pedido: tipo, tema e no máximo 2 perguntas (modelo rápido, não conta na cota)
  if (d.acao === 'entender') {
    const texto = txt(d.texto, 6000), tipoDado = NOMES.includes(d.tipo) ? d.tipo : '';
    if (texto.length < 3 && !tipoDado) throw new HttpsError('invalid-argument', 'Escreva o que você precisa.');
    const sistema = 'Você é o assistente do Portal IA, que ajuda professores de escolas públicas brasileiras. Sua tarefa agora é ENTENDER o pedido e classificá-lo num destes tipos: ' +
      NOMES.map(k => k + ' (' + TIPOS[k].nome + ')').join(', ') + '. Use "fora" só se o pedido não tiver relação com o trabalho do professor.\n' +
      'Pergunte no máximo 2 coisas, e só o que for indispensável e não estiver no pedido nem no contexto. Série e disciplina já estão no contexto: não pergunte. ' +
      'Exemplos do que costuma ser indispensável: na correção de redação, o texto da redação (livre); no parecer, as observações do professor sobre o aluno (livre); na adaptação, a necessidade e o que adaptar; no recado, o assunto e a data quando houver evento. ' +
      'Para atividade, prova, simulado, diagnóstica e lista, se a quantidade de questões não foi dita, NÃO pergunte: use 6 na atividade, 9 na lista, 10 na prova e 15 no simulado e na diagnóstica. No planejamento, se o período não foi dito, NÃO pergunte: faça o anual. No caça-palavras, na dinâmica, na rubrica, no projeto e no resumo, basta o tema: não pergunte mais nada. Na correção de redação não pergunte critérios: o Portal usa os da série. Responda somente no formato JSON pedido.';
    const pedido = 'CONTEXTO\n' + contextoTexto(cx) + (tipoDado ? '\nTipo escolhido pelo professor no atalho: ' + tipoDado : '') + '\n\nPEDIDO DO PROFESSOR\n' + (texto || '(o professor só tocou no atalho)') +
      (d.respostas && typeof d.respostas === 'object' ? '\n\nRESPOSTAS ÀS PERGUNTAS ANTERIORES\n' + Object.entries(d.respostas).slice(0, 4).map(([k, v]) => k + ': ' + txt(v, 6000)).join('\n') : '');
    exigir('portalia');
    if (!ctx.admin) { const st = await cota(); if (!st.pode_usar) throw new HttpsError('resource-exhausted', st.motivo || 'Sem créditos para o Portal IA.', { semCredito: true, motivo: 'cota', comprar: '/apps/portal-ia/#comprar' }); }
    const r = await geminiJson(chave, [ctx.cfg.modelo_rapido, ...RESERVA_TEXTO], sistema, pedido, ESQUEMA_ENTENDER, 0.2);
    await registrarConsumo(db, ctx, null, { modelo: r.modelo, entrada: r.entrada, saida: r.saida });
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
    // quantidade escolhida pelo professor (até 40); sem escolha, o padrão de cada tipo
    const qtd = Math.min(40, Math.max(0, Math.round(Number(d.qtd)) || ({ prova: 10, simulado: 15, diagnostica: 15, lista: 9, atividade: 6 }[tipo] || 0)));
    const res = await reservarCreditos(db, ctx, anterior ? 'ajuste' : 'material', exigir('portalia'));
    const T = TIPOS[tipo];
    const sistema = 'Você é um professor experiente da educação básica brasileira e autor de material didático. ' + T.instrucao +
      (T.questoes ? ' Em CADA questão, preencha "habilidade" com o código da BNCC que ela avalia, do ano e do componente do contexto (o professor usa isso para ver, depois da correção, em que habilidade a turma errou). Só use código que você tem certeza de que existe; na dúvida, deixe vazio.' : '') +
      '\n\n' + REGRAS_GERAIS;
    let pedido = 'CONTEXTO\n' + contextoTexto(cx) + '\n\nPEDIDO\n' + resumo + (qtd && T.questoes ? '\nQuantidade de questões: ' + qtd + '.' : '');
    // caça-palavras: a grade não vai para a IA (ela só mexe nas palavras; o Portal remonta a grade)
    const docParaIA = tipo === 'cacapalavras' && anterior ? { ...anterior.doc, secoes: (anterior.doc.secoes || []).filter(s => !(s.tabela && s.tabela.grade)), gabarito: [] } : anterior && anterior.doc;
    if (anterior) pedido += '\n\nMATERIAL ATUAL (em JSON)\n' + JSON.stringify(docParaIA).slice(0, 60000) + '\n\nAJUSTE PEDIDO PELO PROFESSOR\n' + txt(d.instrucao, 1000) +
      '\nDevolva o material inteiro já ajustado, no mesmo formato, mudando só o que o ajuste pede.';
    let r = null, prob = ['sem resposta'], ent = 0, sai = 0, erro = null;
    try {
      for (let t = 0; t < 4; t++) {
        // se o modelo principal se perder duas vezes, tenta outros modelos (cada um se perde em momentos diferentes)
        const ordem = t < 2 ? [ctx.cfg.modelo_texto, ...RESERVA_TEXTO] : t === 2 ? ['gemini-flash-latest', ctx.cfg.modelo_texto] : [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto];
        r = await geminiJson(chave, ordem, sistema, pedido + (t ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' : ''), ESQUEMA_DOC, 0.6, qtd > 15 ? 170000 : 85000);
        ent += r.entrada; sai += r.saida;
        if (r.json) r.json._pedido = resumo;
        if (r.json && tipo === 'cacapalavras') montarCaca(limparDoc(r.json), cx.serie);
        prob = r.json ? conferirDoc(limparDoc(r.json), tipo, anterior ? 0 : qtd) : ['resposta incompleta, ' + (r.fim || 'sem motivo') + ', ' + r.saida + ' tokens'];
        if (!prob.length) break;
        console.warn('portal-ia: conferência reprovou', tipo, prob.join('; '));
      }
    } catch (e) { erro = e; }
    const falhou = !!erro || prob.length > 0;
    if (falhou) await estornarCreditos(db, res);   // não deu certo: o crédito volta
    await registrarConsumo(db, ctx, falhou ? null : res, { modelo: r && r.modelo, entrada: ent, saida: sai, doc_id: docRef ? docRef.id : '' });
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
    if (prob.length) throw new HttpsError('internal', 'A IA devolveu o material com problema (' + prob[0] + '). Tente de novo.');
    const doc = limparDoc(r.json); delete doc._pedido;
    const reg = { uid, tipo, tipo_nome: T.nome, publico: T.publico, titulo: txt(doc.titulo, 160), tema: tema || txt(doc.titulo, 120), resumo, contexto: cx, doc,
      modelo: r.modelo, tokens_entrada: FieldValue.increment(ent), tokens_saida: FieldValue.increment(sai), atualizado_em: FieldValue.serverTimestamp() };
    if (anterior) { await docRef.set({ ...reg, ajustes: FieldValue.increment(1), anterior: anterior.doc }, { merge: true }); }
    else { docRef = db.collection('portal_ia_docs').doc(); await docRef.set({ ...reg, imagem: '', favorito: false, ajustes: 0, criado_em: FieldValue.serverTimestamp() }); }
    if (d.acao === 'gerar') contarTema(db, d);
    return { id: docRef.id, tipo, nome: T.nome, publico: T.publico, doc, cota: await cota() };
  }

  // 3) imagem para a aula (só nos planos que incluem; conta na cota de imagens)
  if (d.acao === 'imagem') {
    const descricao = txt(d.descricao, 600); if (descricao.length < 5) throw new HttpsError('invalid-argument', 'Descreva a imagem.');
    const estilos = { didatica: 'ilustração didática colorida, traço limpo, fundo claro', colorir: 'desenho para colorir: só contornos pretos grossos sobre fundo branco, sem sombras nem cores', realista: 'fotografia realista e natural', cartoon: 'desenho animado infantil, alegre e acolhedor' };
    const estilo = estilos[d.estilo] || estilos.didatica;
    const docId = txt(d.id, 64);
    // onde a imagem entra: no topo do material ou junto de uma questão (q1, q2...)
    const onde = /^q([1-9]|[12]\d|30)$/.test(String(d.onde || '')) ? d.onde : 'topo';
    let docRef = null;
    if (docId) { docRef = db.doc(`portal_ia_docs/${docId}`); const s = await docRef.get(); if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.'); }
    const res = await reservarCreditos(db, ctx, 'imagem', exigir('portalia_imagem'));
    const prompt = 'Crie uma imagem para uso em sala de aula de escola brasileira, adequada para crianças e adolescentes. Assunto: ' + descricao + '. Estilo: ' + estilo +
      '. Formato ' + (onde === 'topo' ? 'horizontal 4:3' : 'quadrado 1:1, com o assunto centralizado e fundo limpo, para ficar ao lado de uma questão') + '. NÃO escreva palavras, letras nem números na imagem. Nada de violência, marcas comerciais ou pessoas reais conhecidas. Pessoas, quando houver, diversas e representando o Brasil.';
    let r = null, erro = null;
    try { r = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }); }
    catch (e) { erro = e; }
    const parte = r && r.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
    if (erro || !parte) await estornarCreditos(db, res);
    await registrarConsumo(db, ctx, erro || !parte ? null : res, { modelo: r && r.modelo, entrada: r && r.entrada, saida: r && r.saida, imagem: !!parte, doc_id: docId });
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora.');
    if (!parte) throw new HttpsError('internal', 'A IA não devolveu a imagem desta vez (às vezes ela recusa um assunto). Tente descrever de outro jeito.');
    const ext = /png/.test(parte.inlineData.mimeType) ? 'png' : 'jpg';
    const caminho = `portal-ia/${uid}/${docId || 'avulsa'}-${Date.now()}.${ext}`;
    await getStorage().bucket().file(caminho).save(Buffer.from(parte.inlineData.data, 'base64'), { contentType: parte.inlineData.mimeType, resumable: false, metadata: { cacheControl: 'private, max-age=86400' } });
    if (docRef) {
      const ant = (((await docRef.get()).data() || {}).imagens || {})[onde];
      await docRef.set({ imagens: { [onde]: { caminho, descricao } }, ...(onde === 'topo' ? { imagem: caminho, imagem_descricao: descricao } : {}), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      if (ant && ant.caminho) await getStorage().bucket().file(ant.caminho).delete().catch(() => {});   // a imagem trocada não fica ocupando espaço
    }
    return { caminho, onde, mime: parte.inlineData.mimeType, dados: parte.inlineData.data, cota: await cota() };
  }

  // 3b) só administrador: foto de card com os personagens da NEWPC (fotos de referência enviadas pelo script de geração).
  // Não grava nada nem gasta créditos: devolve a imagem para o script revisar e guardar.
  // 3c) só administrador: recria uma atividade do acervo antigo (PDF) no padrão do Portal IA, com ilustração para colorir.
  // O material fica na conta de quem converteu, em "Seus materiais", para revisar antes de virar modelo.
  if (d.acao === 'converter_atividade') {
    if (!ctx.admin) throw new HttpsError('permission-denied', 'Só o administrador.');
    const id = txt(d.id, 80), at = await db.doc('atividades/' + id).get();
    if (!at.exists) throw new HttpsError('not-found', 'Atividade não encontrada.');
    const a = at.data(), tipo = a.etapa === 'infantil' ? 'ficha_ei' : 'atividade', T = TIPOS[tipo];
    const [pdf] = await getStorage().bucket().file(`atividades/${a.etapa}/${id}.${a.formato || 'pdf'}`).download();
    if (pdf.length > 18e6) throw new HttpsError('failed-precondition', 'Arquivo grande demais para converter.');
    const cxA = { disciplina: a.etapa === 'infantil' ? 'Educação Infantil' : txt(a.componente, 60), serie: a.etapa === 'infantil' ? 'Educação Infantil (4 e 5 anos)' : (a.anos || []).map(n => n + 'º ano').join(', ') };
    const sistema = 'Você é um professor experiente da educação básica brasileira e autor de material didático. Você recebe o PDF de uma atividade antiga e a RECRIA no padrão do Portal: mantenha a proposta pedagógica e o tema, mas escreva com as suas palavras (não copie o texto do PDF) e melhore o que estiver confuso. Se o PDF tiver várias atividades ou várias páginas, escolha UMA proposta, a mais representativa, e recrie só ela: o resultado é UMA ficha curta, de uma página. ' + T.instrucao + '\n\n' + REGRAS_GERAIS;
    const pedido = 'CONTEXTO\n' + contextoTexto(cxA) + '\nTítulo do arquivo: ' + txt(a.titulo || a.arquivo_nome, 160) + (a.componente ? '\nCampo / componente no acervo: ' + txt(a.componente, 80) : '');
    let r = null, prob = ['sem resposta'];
    for (let t = 0; t < 3 && prob.length; t++) {
      // cada modelo se perde em PDFs diferentes: a 2ª e a 3ª tentativas usam outros modelos
      const ordem = t === 0 ? [ctx.cfg.modelo_texto, ...RESERVA_TEXTO] : t === 1 ? ['gemini-flash-latest', ctx.cfg.modelo_texto] : [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto];
      const g = await geminiFluxo(chave, ordem, { systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: a.formato === 'pdf' || !a.formato ? 'application/pdf' : 'image/' + (a.formato === 'jpg' ? 'jpeg' : a.formato), data: pdf.toString('base64') } }, { text: pedido + (t ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' : '') }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA_DOC, maxOutputTokens: 32000 } }, 170000);
      const bruto = g.partes.map(p => p.text || '').join('');
      try { r = JSON.parse(bruto); } catch (e) { r = null; }
      prob = r ? conferirDoc(limparDoc(r), tipo, 0) : ['resposta incompleta: ' + (g.fim || 'sem motivo') + ', ' + bruto.length + ' caracteres'];
      if (prob.length) console.warn('portal-ia: converter', id, prob.join('; '));
    }
    if (prob.length) throw new HttpsError('internal', 'A IA não conseguiu recriar esta atividade (' + prob[0] + ').');
    const doc = limparDoc(r);
    (doc.bncc || []).forEach(b => { const c = String(b.codigo || '').toUpperCase(); b.codigo = CODIGOS_BNCC.has(c) ? c : ''; });
    // ilustração em contorno, para a criança fazer a atividade na própria folha
    let imagens = {}, erroImg = '';
    const desc = txt(doc.sugestao_imagem, 600);
    for (let ti = 0; ti < 2 && desc.length > 10 && !imagens.topo; ti++) {
      const pi = 'Crie uma imagem para uma ficha de Educação Infantil de escola brasileira. Assunto: ' + desc + '. Estilo: desenho para colorir, só contornos pretos grossos e limpos sobre fundo branco, sem sombras, sem cores, sem tons de cinza, elementos grandes e simples, com espaço para a criança pintar. Formato horizontal 4:3. NÃO escreva palavras, letras nem números na imagem.';
      try {
        const gi = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts: [{ text: pi }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
        const parte = gi.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
        if (parte) { const cam = `portal-ia/${uid}/acervo-${id}-${Date.now()}.${/png/.test(parte.inlineData.mimeType) ? 'png' : 'jpg'}`;
          await getStorage().bucket().file(cam).save(Buffer.from(parte.inlineData.data, 'base64'), { contentType: parte.inlineData.mimeType, resumable: false, metadata: { cacheControl: 'private, max-age=86400' } });
          imagens = { topo: { caminho: cam, descricao: desc } }; }
        else erroImg = 'a IA não devolveu imagem: ' + txt(gi.partes.map(p => p.text || '').join(' '), 160);
      } catch (e) { erroImg = e.message; console.warn('converter: imagem', e.message); }
    }
    const ref = db.collection('portal_ia_docs').doc();
    await ref.set({ uid, tipo, tipo_nome: T.nome, publico: T.publico, titulo: txt(doc.titulo, 160), tema: txt(doc.titulo, 120), resumo: 'Recriada do acervo: ' + txt(a.titulo || a.arquivo_nome, 160), contexto: cxA, doc,
      imagem: imagens.topo ? imagens.topo.caminho : '', imagens, favorito: false, ajustes: 0, origem_acervo: { id, titulo: txt(a.titulo || a.arquivo_nome, 160), mini_url: a.mini_url || '' },
      modelo: 'acervo', criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
    return { id: ref.id, titulo: doc.titulo, imagem: !!imagens.topo, erro_imagem: imagens.topo ? '' : erroImg || (desc.length > 10 ? '' : 'sem sugestão de imagem'), bncc: (doc.bncc || []).map(b => b.codigo).filter(Boolean) };
  }

  if (d.acao === 'foto_ref') {
    if (!ctx.admin) throw new HttpsError('permission-denied', 'Só o administrador.');
    const descricao = txt(d.descricao, 1500); if (descricao.length < 10) throw new HttpsError('invalid-argument', 'Descreva a cena.');
    const ok = r => /^image\/(png|jpeg|webp)$/.test(r && r.mime) && typeof r.dados === 'string' && r.dados.length < 2e6;
    const refs = (Array.isArray(d.refs) ? d.refs : []).slice(0, 4).filter(ok), objs = (Array.isArray(d.objetos) ? d.objetos : []).slice(0, 2).filter(ok);
    const prompt = 'Fotografia realista, profissional, para o card de um aplicativo educacional brasileiro. ' +
      (refs.length ? 'As pessoas da cena são EXATAMENTE as pessoas das fotos de referência anexadas, na ordem em que aparecem: mantenha o rosto, o cabelo, os óculos, o tom de pele e o corpo de cada uma, e o uniforme igual ao da referência (camiseta com o logo NEWPC EDUCAÇÃO). Não acrescente outras pessoas adultas. ' : '') +
      (objs.length ? 'As ' + objs.length + ' últimas imagens anexadas NÃO são pessoas: mostram o produto EduDock da NEWPC (suporte de tablet para a carteira). Sempre que a cena tiver tablet, ele está dentro deste suporte, reproduzido com fidelidade: moldura azul arredondada em volta da tela, logo NEWPC branco na borda de baixo da frente, perna traseira verde rebatível com o logo NEWPC, apoiando o tablet inclinado a uns 45 graus. ' : '') +
      'Cena: ' + descricao + '. Sala de aula ou escola pública brasileira, clara, organizada, luz natural da janela, cores vivas e acolhedoras, expressões naturais. Formato horizontal 4:3, assunto principal no centro (as bordas serão cortadas). Nenhum texto, letra ou número na imagem além do logo da camiseta.';
    const parts = [...refs, ...objs].map(r => ({ inlineData: { mimeType: r.mime, data: r.dados } })).concat({ text: prompt });
    const r = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
    const parte = r.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
    if (!parte) throw new HttpsError('internal', 'A IA não devolveu a imagem: ' + txt(r.partes.map(p => p.text || '').join(' '), 200));
    return { mime: parte.inlineData.mimeType, dados: parte.inlineData.data, modelo: r.modelo };
  }

  // 4) tirar uma imagem do material (não devolve cota)
  if (d.acao === 'remover_imagem') {
    const docRef = db.doc(`portal_ia_docs/${txt(d.id, 64)}`); const s = await docRef.get();
    if (!s.exists || s.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.');
    const onde = /^(topo|q([1-9]|[12]\d|30))$/.test(String(d.onde || '')) ? d.onde : '';
    if (!onde) throw new HttpsError('invalid-argument', 'Imagem inválida.');
    const ims = s.data().imagens || {}, cam = (ims[onde] && ims[onde].caminho) || (onde === 'topo' ? s.data().imagem : '');
    await docRef.update({ ['imagens.' + onde]: FieldValue.delete(), ...(onde === 'topo' ? { imagem: '' } : {}), atualizado_em: FieldValue.serverTimestamp() });
    if (cam) await getStorage().bucket().file(cam).delete().catch(() => {});
    return { ok: true };
  }

  /* ---------------- questões para o Provas e Avaliações (1 crédito) ---------------- */
  if (d.acao === 'questoes_prova') {
    const tema = txt(d.tema, 300), qtd = Math.min(40, Math.max(1, Math.round(Number(d.qtd) || 10))), total = Math.min(100, Math.max(0, Number(d.total) || 0));
    if (tema.length < 3) throw new HttpsError('invalid-argument', 'Informe o tema ou conteúdo da prova.');
    const tipos = TIPOS_PROVA[d.tipos] || TIPOS_PROVA.mista, nivel = txt(d.nivel, 40) || 'médio';
    const disciplina = txt(d.disciplina, 80), turma = txt(d.turma, 80), obs = txt(d.obs, 600);
    const res = await reservarCreditos(db, ctx, 'texto', exigir('provas_ia'));
    const sistema = 'Você é um professor experiente da rede pública brasileira e elabora avaliações escolares. Crie exatamente ' + qtd + ' questões. ' +
      'Múltipla escolha: 4 alternativas curtas, só uma correta, distratores plausíveis. Verdadeiro ou falso: cada questão é UMA afirmação clara, sem pegadinha. ' +
      'Resposta curta e dissertativa: informe em "esperado" a resposta ou o critério de correção. Dificuldade crescente. Valores: 1 ponto para objetivas, 2 para dissertativas, salvo outro total pedido.\n\n' + REGRAS_GERAIS;
    const pedido = 'Disciplina: ' + (disciplina || 'não informada') + '\nTurma / ano: ' + (turma || 'não informada') + '\nTema: ' + tema + '\nQuantidade: ' + qtd + ' questões\nTipos: ' + tipos +
      '\nNível: ' + nivel + (total ? '\nValor total da prova: ' + total + ' pontos' : '') + (obs ? '\nObservações do professor: ' + obs : '');
    let r = null, prob = ['sem resposta'], ent = 0, sai = 0, erro = null, qs = [];
    try {
      for (let t = 0; t < 4; t++) {
        const ordem = t < 2 ? [ctx.cfg.modelo_texto, ...RESERVA_TEXTO] : t === 2 ? ['gemini-flash-latest', ctx.cfg.modelo_texto] : [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto];
        r = await geminiJson(chave, ordem, sistema, pedido + (t ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' : ''), ESQUEMA_QUESTOES, 0.6, qtd > 15 ? 170000 : 85000);
        ent += r.entrada; sai += r.saida;
        qs = r.json ? paraProvas(r.json.questoes, total) : [];
        prob = r.json ? conferirQuestoes(qs, qtd) : ['resposta incompleta, ' + (r.fim || 'sem motivo')];
        if (!prob.length) break;
        console.warn('portal-ia: questões reprovadas', prob.join('; '));
      }
    } catch (e) { erro = e; }
    const falhou = !!erro || prob.length > 0;
    if (falhou) await estornarCreditos(db, res);
    await registrarConsumo(db, ctx, falhou ? null : { ...res, acao: 'prova' }, { modelo: r && r.modelo, entrada: ent, saida: sai });
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
    if (prob.length) throw new HttpsError('internal', 'A IA devolveu as questões com problema (' + prob[0] + '). Tente de novo.');
    return { questoes: qs, cota: await cota() };
  }

  /* ---------------- aula em slides para a Lousa (1 crédito) ---------------- */
  if (d.acao === 'aula_lousa') {
    // Central de IA: Lousa IA Básica (texto) e Ultra (ilustrações; inclui a Básica)
    const opcLousa = exigir('lousa_ia');
    // Aulas prontas (nov/2026): o administrador gera o acervo oficial; a aula fica guardada para revisão e não volta pesada para a tela
    const acervo = d.acervo && typeof d.acervo === 'object' ? d.acervo : null;
    const acervoId = acervo ? txt(acervo.id, 80).replace(/[^a-z0-9_-]/g, '') : '';
    if (acervo && (!ctx.admin || !acervoId)) throw new HttpsError('permission-denied', 'Só o administrador gera aulas para o acervo.');
    const aUltra = acessoIA('lousa_ia_ultra', ctx.ia), ultra = d.ultra === true && aUltra.ok;
    const opcUltra = { rede: aUltra.via === 'rede' ? true : aUltra.via === 'admin' ? undefined : false, nome: NOMES_IA.lousa_ia_ultra };
    const tema = txt(d.tema, 300), qtd = Math.min(15, Math.max(3, Math.round(Number(d.qtd) || 6)));
    if (tema.length < 3) throw new HttpsError('invalid-argument', 'Informe o tema da aula.');
    const disciplina = txt(d.disciplina, 80), turma = txt(d.turma, 80), obs = txt(d.obs, 1500);
    // Aula avançada (nov/2026): modelo mais forte do Gemini, para Ensino Médio e revisões; custa mais créditos (precos.avancado)
    const avancado = d.avancado === true;
    const res = await reservarCreditos(db, ctx, avancado ? 'avancado' : 'aula', opcLousa);
    const etapa = etapaDaTurma(turma);
    const MODELOS = avancado ? [ctx.cfg.modelo_avancado || 'gemini-pro-latest', ctx.cfg.modelo_texto, ...RESERVA_TEXTO] : [ctx.cfg.modelo_texto, ...RESERVA_TEXTO];
    const LIMITE = avancado ? 240000 : qtd > 10 ? 170000 : 85000;
    const sistema = 'Você é um professor experiente e muito bem preparado da rede pública brasileira. Prepare uma aula rica e envolvente para projetar na lousa digital, com conteúdo de verdade, não superficial. ' +
      'Monte EXATAMENTE ' + qtd + ' slides de conteúdo (sem contar a capa): nem um a menos. Sequência: 1) ativação (o que a turma já sabe ou vive, com uma pergunta), 2) problematização ou curiosidade, ' +
      '3) conceito explicado com o porquê e o como, 4) aprofundamento com exemplos do Brasil, dados reais, causas e consequências, 5) aplicação (quiz para a turma votar e atividade), 6) síntese no resumo final. ' +
      'Varie os formatos: conceito para definições, curiosidade ou dado para despertar interesse, numeros para comparar valores lado a lado, tabela para quadros e dados organizados, calculo para toda conta (passo a passo), ' +
      'linha_tempo quando houver datas, passos para procedimentos, comparacao para contrastes, mapa para organizar ideias, quiz para verificar e resumo no último slide. ' +
      'Use pelo menos 4 formatos diferentes e inclua OBRIGATORIAMENTE 1 quiz. Cada texto precisa ensinar algo concreto (nome, data, causa, exemplo, número), nada de frase vaga como "é muito importante". ' +
      (DENSIDADE[etapa] || DENSIDADE.finais) + ' O que for explicação longa vai no aprofundamento do professor, que não aparece na tela. ' +
      'Ajuste profundidade e vocabulário à turma' + (etapa ? ' (' + ETAPA_TXT[etapa] + ')' : '') + '. Contas: refaça cada operação antes de escrever; frações e porcentagens juntas quando ajudar (ex.: 1/4 = 25%). Valores que mudam com o tempo (salário mínimo, tarifas, preços, população): diga o ano de referência ou use um valor redondo apresentado como exemplo. ' +
      'Quando a aula usar preços, tarifas ou valores em dinheiro de exemplo, deixe claro na tela, numa frase curta, que são valores ilustrativos e que os reais variam (por cidade, estado, empresa ou ano). ' +
      (qtd >= 6 ? 'Antes do resumo, inclua um slide do tipo atividade que leve o conteúdo para a vida real do aluno: algo para investigar ' + (etapa === 'infantil' || etapa === 'iniciais' ? 'em casa com a família' : 'em casa, no bairro ou no trabalho') + ', dizendo o que observar ou anotar e que os resultados serão conversados na próxima aula. ' : '') +
      'Em cada slide escreva também o roteiro do professor, o tempo sugerido e o aprofundamento (só para o professor, explicando o conteúdo com mais detalhe). ' +
      'A aula se basta: não indique vídeo, filme, site, aplicativo nem material externo (nem "assista", "veja o vídeo", "pesquise no site"), nem no roteiro do professor.\n\n' + REGRAS_GERAIS;
    const pedido = 'Disciplina: ' + (disciplina || 'não informada') + '\nTurma / ano: ' + (turma || 'não informada') +
      '\nTema da aula: ' + tema + '\nQuantidade: ' + qtd + ' slides' + (obs ? '\nObservações do professor (siga com atenção): ' + obs : '');
    let r = null, prob = ['sem resposta'], ent = 0, sai = 0, erro = null, aula = null;
    const diag = { pedidos: qtd, primeira: 0, complementos: 0, quiz_extra: false, contas_corrigidas: 0, contas_erradas: 0, avancado };
    const soma = x => { if (x) { ent += x.entrada || 0; sai += x.saida || 0; } };
    // pede à IA só alguns slides para esta aula (completar, acrescentar o quiz ou refazer um slide com conta errada)
    const pedirSlides = async (instrucao, n) => {
      const feitos = aula.slides.map((x, k) => (k + 1) + ') ' + x.tipo + ': ' + x.titulo).join('\n');
      const rc = await geminiJson(chave, MODELOS, sistema, pedido + '\n\nA aula "' + aula.titulo + '" já tem estes slides:\n' + feitos + '\n\n' + instrucao + ' Repita o mesmo título da aula.', ESQUEMA_AULA, 0.6, LIMITE)
        .catch(e => { console.warn('portal-ia: pedido extra da aula', e.message); return null; });
      soma(rc);
      return rc && rc.json ? paraAula({ ...rc.json, titulo: rc.json.titulo || aula.titulo }, n).slides : [];
    };
    const antesDoResumo = novos => { const iRes = aula.slides.findIndex(x => x.tipo === 'resumo');
      if (iRes >= 0 && !novos.some(x => x.tipo === 'resumo')) aula.slides.splice(iRes, 0, ...novos);
      else { if (iRes >= 0) aula.slides.splice(iRes, 1); aula.slides.push(...novos); } };
    // etapa 1: plano com exatamente qtd slides (quiz garantido, resumo no fim); etapa 2: cada slide com os campos do seu tipo
    const planoAula = async () => {
      let pl = null;
      for (let t = 0; t < 2 && !pl; t++) {
        const rp = await geminiJson(chave, MODELOS, sistema, pedido + '\n\nPRIMEIRO, o PLANO da aula: devolva exatamente ' + qtd + ' slides, cada um com o tipo (formato), o título e o foco (o que ele ensina). ' +
          'Escolha o formato que mostra melhor cada conteúdo: conta vira calculo, quadro ou dados viram tabela, proporções viram numeros. Inclua 1 quiz' + (qtd >= 6 ? ', 1 atividade para investigar na vida real logo antes do resumo' : '') + ' e termine com resumo.', ESQUEMA_PLANO, 0.6, LIMITE).catch(e => { console.warn('portal-ia: plano', e.message); return null; });
        soma(rp); if (rp) r = rp;
        const j = rp && rp.json, sl = j && Array.isArray(j.slides) ? j.slides.filter(x => x && TIPOS_SLIDE.includes(x.tipo) && x.titulo) : [];
        if (sl.length >= Math.min(3, qtd)) pl = { ...j, slides: sl.slice(0, qtd) };
      }
      if (!pl) return null;
      // garante a quantidade, o quiz e o resumo final sem gastar outra chamada
      while (pl.slides.length < qtd) pl.slides.splice(Math.max(0, pl.slides.length - 1), 0, { tipo: 'topicos', titulo: 'Para aprofundar', foco: 'aprofundamento do tema com exemplos do cotidiano' });
      if (!pl.slides.some(x => x.tipo === 'quiz')) { const k = pl.slides.length - 2 >= 0 ? pl.slides.length - 2 : 0; pl.slides[k] = { tipo: 'quiz', titulo: 'Vamos testar', foco: 'pergunta de múltipla escolha que verifica o conceito principal da aula' }; }
      if (pl.slides[pl.slides.length - 1].tipo !== 'resumo') pl.slides[pl.slides.length - 1] = { tipo: 'resumo', titulo: 'Resumo da aula', foco: 'as 4 ideias principais da aula' };
      return pl;
    };
    const escreverSlide = async (pl, i, extra) => {
      const it = pl.slides[i], roteiro = pl.slides.map((x, k) => (k + 1) + ') ' + x.tipo + ': ' + x.titulo + ' · ' + (x.foco || '')).join('\n');
      const rs = await geminiJson(chave, MODELOS, sistema, pedido + '\n\nPlano da aula "' + pl.titulo + '":\n' + roteiro + '\n\nAgora escreva SOMENTE o slide ' + (i + 1) + ' (formato ' + it.tipo + '): "' + it.titulo + '" · ' + (it.foco || '') +
        '. Como é o formato ' + it.tipo + ': ' + descTipo(it.tipo) + ' Preencha TODOS os campos obrigatórios do formato com conteúdo real e completo, sem repetir os outros slides.' + (extra || ''), esquemaSlide(it.tipo), 0.6, LIMITE).catch(e => { console.warn('portal-ia: slide', i + 1, e.message); return null; });
      soma(rs);
      if (!rs || !rs.json) return null;
      const sl = paraAula({ titulo: pl.titulo, slides: [{ ...rs.json, tipo: it.tipo, titulo: rs.json.titulo || it.titulo }] }, 1).slides[0];
      return sl && sl.tipo === it.tipo ? sl : null;   // formato que não fechou (virou lista) conta como falha
    };
    try {
      const pl = await planoAula();
      if (pl) {
        diag.plano = pl.slides.map(x => x.tipo).join(',');
        const prontos = new Array(pl.slides.length).fill(null);
        for (let t = 0; t < 2; t++) {
          const faltam = prontos.map((x, i) => x ? -1 : i).filter(i => i >= 0);
          for (let k = 0; k < faltam.length; k += 5) await Promise.all(faltam.slice(k, k + 5).map(async i => { prontos[i] = await escreverSlide(pl, i, t ? ' ATENÇÃO: a tentativa anterior deste slide veio incompleta; preencha todos os campos.' : ''); }));
        }
        diag.slides_falhos = prontos.filter(x => !x).length;
        const ok = prontos.filter(Boolean);
        if (ok.length >= Math.min(3, qtd)) {
          aula = paraAula({ titulo: pl.titulo, subtitulo: pl.subtitulo, objetivo: pl.objetivo, bncc: pl.bncc, capa_ilustracao: pl.capa_ilustracao, slides: [] }, qtd);
          aula.slides = ok; prob = []; diag.modo = 'plano';
        }
      }
    } catch (e) { console.warn('portal-ia: aula em duas etapas', e.message); }
    try {
      for (let t = 0; t < 3 && prob.length; t++) {
        diag.modo = 'unico';
        const ordem = t < 2 ? MODELOS : [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto];
        r = await geminiJson(chave, ordem, sistema, pedido + (t ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' : ''), ESQUEMA_AULA, 0.6, LIMITE);
        soma(r);
        aula = r.json ? paraAula(r.json, qtd) : null;
        prob = !aula ? ['resposta incompleta, ' + (r.fim || 'sem motivo')] : aula.slides.length < Math.min(3, qtd) ? ['poucos slides (' + aula.slides.length + ')'] : !aula.titulo ? ['sem título'] : [];
        if (!prob.length) break;
        console.warn('portal-ia: aula reprovada', prob.join('; '));
      }
      if (aula) diag.primeira = aula.slides.length;
      // 1) veio com menos slides do que o professor pediu: pede só os que faltam, continuando a mesma aula (até 2 vezes)
      for (let t = 0; !prob.length && aula && aula.slides.length < qtd && t < 2; t++) {
        const falta = qtd - aula.slides.length;
        const extra = await pedirSlides('Crie APENAS os ' + falta + ' slides que faltam para completar a aula, continuando a mesma sequência (sem repetir conteúdo dos slides acima). Se faltar o resumo final, ele é o último. Devolva no campo slides só esses ' + falta + ' novos.', falta);
        if (!extra.length) continue;
        diag.complementos++; antesDoResumo(extra); aula.slides = aula.slides.slice(0, qtd);
      }
      // 2) toda aula tem quiz (é o que a turma vota e o que vai ao vivo para os aparelhos)
      if (!prob.length && aula && !aula.slides.some(x => x.tipo === 'quiz')) {
        const qz = (await pedirSlides('A aula ficou sem quiz. Crie APENAS 1 slide do tipo quiz sobre o conteúdo acima (pergunta, 4 alternativas plausíveis, a correta e a resposta explicada).', 1)).filter(x => x.tipo === 'quiz');
        if (qz.length) {
          diag.quiz_extra = true; antesDoResumo(qz.slice(0, 1));
          if (aula.slides.length > qtd) { const k = aula.slides.map(x => x.tipo).lastIndexOf('topicos'); aula.slides.splice(k >= 0 ? k : aula.slides.length - 2, 1); }
        }
      }
      // 3) conferência das contas: slide com conta errada é refeito uma vez; se continuar errado, o professor é avisado
      if (!prob.length && aula) {
        for (const e of contasErradas(aula).slice(0, 3)) {
          const sl = aula.slides[e.i];
          const novo = (await pedirSlides('O slide ' + (e.i + 1) + ' ("' + sl.titulo + '") tem conta ERRADA: "' + e.conta + '". Refaça APENAS esse slide, do mesmo tipo (' + sl.tipo + '), conferindo cada operação. Devolva no campo slides só esse slide corrigido.', 1))[0];
          if (novo && !contasErradas({ slides: [novo] }).length) { aula.slides[e.i] = novo; diag.contas_corrigidas++; }
        }
        diag.contas_erradas = contasErradas(aula).length;
      }
    } catch (e) { erro = e; }
    // mesmo assim incompleta: entrega o que veio e não cobra (o professor pediu N slides e pagou por N)
    const curta = !erro && !prob.length && aula && aula.slides.length < qtd ? aula.slides.length : 0;
    diag.entregues = aula ? aula.slides.length : 0;
    console.log('portal-ia: aula da lousa', JSON.stringify({ ...diag, modelo: r && r.modelo, etapa }));
    const falhou = !!erro || prob.length > 0;
    if (falhou || curta) await estornarCreditos(db, res);
    await registrarConsumo(db, ctx, falhou || curta ? null : { ...res, acao: 'aula_lousa' }, { modelo: r && r.modelo, entrada: ent, saida: sai });
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes.');
    if (prob.length) throw new HttpsError('internal', 'A IA devolveu a aula com problema (' + prob[0] + '). Tente de novo.');
    // ranking de temas da Aula com IA: conta só o tema escolhido no banco do Portal (identificador curto),
    // nunca o texto digitado (que pode trazer nome de aluno). Sem leitura: um incremento por aula.
    contarTema(db, d);
    // Lousa Ultra: o professor escolhe de 1 a 4 ilustrações (capa + até 3 slides); cada uma cobra como imagem e a que falhar é estornada.
    // Primeiro os slides em que a IA pediu imagem; se faltar, slides de conteúdo (nunca quiz, atividade ou resumo).
    let imagens = {}, aviso = '';
    if (ultra) {
      const nImg = Math.min(4, Math.max(1, Math.round(Number(d.imagens) || 3)));
      const pediram = aula.slides.map((sl, i) => ({ onde: 's' + i, desc: sl.ilustracao })).filter(x => x.desc);
      const extras = aula.slides.map((sl, i) => ({ sl, i })).filter(x => !x.sl.ilustracao && ['topicos', 'conceito', 'curiosidade', 'dado', 'passos'].includes(x.sl.tipo))
        .map(x => ({ onde: 's' + x.i, desc: x.sl.titulo + (x.sl.destaque ? ': ' + x.sl.destaque : '') }));
      const pedidos = [{ onde: 'capa', desc: aula.capa_ilustracao || aula.titulo }].concat(pediram, extras).slice(0, nImg);
      const feitas = await Promise.all(pedidos.map(async pd => {
        let rv = null;
        try { rv = await reservarCreditos(db, ctx, 'imagem', opcUltra); }
        catch (e) { return { onde: pd.onde, erro: e.message || 'sem créditos para imagem' }; }
        const prompt = 'Crie UMA ilustração para uma aula de escola brasileira' + (etapa ? ' (' + ETAPA_TXT[etapa] + ')' : '') + '. Assunto: ' + pd.desc +
          '. Tema da aula: ' + aula.titulo + '. Estilo: ' + estiloIlustracao(d.estilo, etapa) + '. Uma única cena, com um ponto de interesse claro: não faça colagem, grade, mosaico nem vários quadros. Formato horizontal 16:9. ' +
          'NÃO escreva palavras, letras nem números na imagem. Adequada ao ambiente escolar: temas históricos e difíceis com seriedade, sem violência gráfica, sangue ou símbolos de ódio em destaque. Nada de marcas comerciais nem retratos de pessoas reais conhecidas. Pessoas, quando houver, diversas.';
        let ri = null, er = null;
        try { ri = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }); }
        catch (e) { er = e; }
        const parte = ri && ri.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
        if (er || !parte) await estornarCreditos(db, rv);
        await registrarConsumo(db, ctx, er || !parte ? null : { ...rv, acao: 'aula_lousa_imagem' }, { modelo: ri && ri.modelo, entrada: ri && ri.entrada, saida: ri && ri.saida, imagem: !!parte });
        return parte ? { onde: pd.onde, mime: parte.inlineData.mimeType, dados: parte.inlineData.data } : { onde: pd.onde, erro: 'a IA não gerou a imagem' };
      }));
      feitas.forEach(f => { if (f.dados) imagens[f.onde] = { mime: f.mime, dados: f.dados }; });
      const falhas = feitas.filter(f => f.erro);
      if (falhas.length) aviso = falhas.length === feitas.length ? 'As ilustrações não saíram (' + falhas[0].erro + '). A aula veio só com texto.' : falhas.length + ' ilustração(ões) não saíram; o resto da aula está completo.';
    }
    if (curta) aviso = 'A IA montou ' + curta + ' dos ' + qtd + ' slides pedidos. Como a aula não veio completa, os créditos do texto foram devolvidos.' + (aviso ? ' ' + aviso : '');
    if (diag.contas_erradas) aviso = 'Confira as contas: ' + (diag.contas_erradas === 1 ? 'um slide de cálculo pode ter conta errada.' : diag.contas_erradas + ' slides de cálculo podem ter conta errada.') + (aviso ? ' ' + aviso : '');
    if (acervo) {
      // ilustrações no Storage (acervo-aulas/{id}/...) e a aula em acervo_aulas/{id}, aguardando revisão; o id fixo deixa refazer o lote sem duplicar
      const bucket = getStorage().bucket(), imgs = {};
      for (const [onde, im] of Object.entries(imagens)) {
        const caminho = `acervo-aulas/${acervoId}/${onde}.${/png/.test(im.mime) ? 'png' : 'jpg'}`;
        await bucket.file(caminho).save(Buffer.from(im.dados, 'base64'), { contentType: im.mime, resumable: false, metadata: { cacheControl: 'private, max-age=86400' } });
        imgs[onde] = { caminho, mime: im.mime };
      }
      await db.doc('acervo_aulas/' + acervoId).set({
        titulo: txt(aula.titulo, 160), tema, disciplina, turma, etapa, faixa: txt(acervo.faixa, 10), macroarea: txt(acervo.macroarea, 40), tema_rotulo: txt(acervo.tema, 120),
        qtd: aula.slides.length, aula: JSON.parse(JSON.stringify(aula)), imagens: imgs, status: 'revisao', origem: 'oficial', usos: 0, aviso,
        contas_erradas: diag.contas_erradas || 0, criado_por: uid, criado_em: FieldValue.serverTimestamp() });
      return { acervo_id: acervoId, titulo: aula.titulo, qtd: aula.slides.length, imagens: Object.keys(imgs).length, aviso };
    }
    return { aula, imagens, aviso, diag, cota: await cota() };
  }

  /* ---------------- compartilhar com a rede municipal (fase 1) ---------------- */
  /* ---------------------------------------------------------------- IA rápida da Lousa (nov/2026)
     pergunta: "Pergunte à IA" (resposta curta, no quadro) · circule: o professor circula um pedaço do quadro e a IA explica, resolve ou traduz
     mapa: "Tópicos com IA" (mapa mental editável) · pintor: o rabisco do professor vira ilustração (créditos de imagem, Lousa Ultra)
     As legendas ao vivo não passam aqui: usam o reconhecimento de voz do próprio navegador, sem crédito. */
  if (d.acao === 'lousa_rapida') {
    const modo = ['pergunta', 'circule', 'mapa', 'pintor', 'limpo'].includes(d.modo) ? d.modo : '';
    if (!modo) throw new HttpsError('invalid-argument', 'Ferramenta desconhecida.');
    const turma = txt(d.turma, 80), disciplina = txt(d.disciplina, 80), etapa = etapaDaTurma(turma);
    const publico = { infantil: 'crianças da Educação Infantil (frases curtíssimas, palavras simples)', iniciais: 'alunos dos anos iniciais do Fundamental (frases curtas, exemplos do dia a dia)',
      finais: 'alunos dos anos finais do Fundamental', medio: 'alunos do Ensino Médio (pode usar termos técnicos, explicados)' }[etapa] || 'alunos do Ensino Fundamental';
    // imagem do quadro (circule e pintor): JPEG ou PNG em base64, até ~1,5 MB
    const img = d.imagem && typeof d.imagem === 'object' ? { mime: /^image\/(png|jpeg)$/.test(d.imagem.mime) ? d.imagem.mime : '', dados: typeof d.imagem.dados === 'string' ? d.imagem.dados : '' } : null;
    if ((modo === 'circule' || modo === 'pintor' || modo === 'limpo') && (!img || !img.mime || img.dados.length < 200 || img.dados.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(img.dados.slice(0, 400))))
      throw new HttpsError('invalid-argument', modo === 'limpo' ? 'Não deu para ler o que foi selecionado. Selecione de novo.' : 'Não deu para ler o pedaço do quadro. Circule de novo.');
    // Passar a limpo (nov/2026): a letra à mão selecionada vira texto digitado e organizado. Modelo leve, SEM crédito (a NEWPC absorve,
    // ~R$ 0,002 por uso), com limite diário por professor; o uso e o custo aparecem no painel de IA como "lousa_limpo".
    if (modo === 'limpo') {
      const a = acessoIA('lousa_limpo', ctx.ia);
      if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso('lousa_limpo', a.motivo));
      const lim = Math.max(1, Number(ctx.cfgRaw && ctx.cfgRaw.limpo_dia) || 100), dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
      const limRef = db.doc(`ia_limite_diario/${uid}_${dia}`);
      const n = await db.runTransaction(async t => { const x = await t.get(limRef), v = (x.exists ? x.data().limpo || 0 : 0) + 1;
        if (v > lim && !ctx.admin) return -1; t.set(limRef, { uid, dia, limpo: v, em: FieldValue.serverTimestamp() }, { merge: true }); return v; });
      if (n < 0) throw new HttpsError('resource-exhausted', 'Você chegou ao limite de ' + lim + ' "Passar a limpo" de hoje. Amanhã libera de novo.');
      let r = null, erro = null, j = null;
      try {
        r = await gemini(chave, [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto], { systemInstruction: { parts: [{ text: SISTEMA_LIMPO }] },
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.mime, data: img.dados } }, { text: 'Transcreva e organize.' }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA_LIMPO, maxOutputTokens: 3000 } });
        try { j = JSON.parse(r.partes.filter(p => !p.thought).map(p => p.text || '').join('')); } catch (e) { j = null; }
      } catch (e) { erro = e; }
      await registrarConsumo(db, ctx, erro || !j ? null : { acao: 'lousa_limpo' }, { modelo: r && r.modelo, entrada: r && r.entrada, saida: r && r.saida });
      if (erro || !j) { await limRef.set({ limpo: FieldValue.increment(-1) }, { merge: true }).catch(() => {});
        throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo.'); }
      const blocos = limparBlocos(j);
      if (!j.legivel || !blocos.length) throw new HttpsError('failed-precondition', 'Não encontrei escrita legível no que foi selecionado. Selecione só o texto escrito à mão.');
      return { blocos, usados: n, limite: lim };
    }
    const base = 'Você é um professor experiente da rede pública brasileira ajudando ao vivo, na lousa digital, diante da turma. Público: ' + publico + '.' + (disciplina ? ' Disciplina: ' + disciplina + '.' : '') +
      ' Responda em português do Brasil, correto, curto e claro, para ser lido de longe. Sem markdown, sem asteriscos. Se for conta, confira o resultado antes de responder. Nada de conteúdo impróprio para escola.';
    if (modo === 'pintor') {
      const opc = exigir('lousa_ia_ultra');
      const res = await reservarCreditos(db, ctx, 'imagem', opc);
      const estilos = { didatica: 'ilustração didática colorida, traço limpo, fundo branco', cartoon: 'desenho animado infantil, alegre', realista: 'imagem realista e natural', colorir: 'desenho para colorir: só contornos pretos sobre fundo branco' };
      const prompt = 'Este é um rascunho feito à mão por um professor numa lousa digital. Transforme-o numa ilustração caprichada para a aula, MANTENDO a mesma composição, posição e proporção dos elementos do rascunho. ' +
        (txt(d.descricao, 300) ? 'O professor disse que é: ' + txt(d.descricao, 300) + '. ' : 'Interprete o que o rascunho representa. ') +
        'Estilo: ' + (estilos[d.estilo] || estilos.didatica) + '. Adequada para crianças e adolescentes. NÃO escreva palavras, letras nem números. Nada de violência, marcas ou pessoas reais conhecidas.';
      let r = null, erro = null;
      try { r = await gemini(chave, [ctx.cfg.modelo_imagem, ...RESERVA_IMAGEM], { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.mime, data: img.dados } }, { text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }); }
      catch (e) { erro = e; }
      const parte = r && r.partes.find(p => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
      if (erro || !parte) await estornarCreditos(db, res);
      await registrarConsumo(db, ctx, erro || !parte ? null : res, { modelo: r && r.modelo, entrada: r && r.entrada, saida: r && r.saida, imagem: !!parte });
      if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora.');
      if (!parte) throw new HttpsError('internal', 'A IA não conseguiu desenhar a partir deste rabisco. Tente escrever o que é no campo "o que é o desenho".');
      return { mime: parte.inlineData.mimeType, dados: parte.inlineData.data, cota: await cota() };
    }
    const opc = exigir('lousa_ia');
    const res = await reservarCreditos(db, ctx, 'texto', opc);
    let esquema, sistema, partes;
    if (modo === 'mapa') {
      const tema = txt(d.tema, 200); if (tema.length < 3) { await estornarCreditos(db, res); throw new HttpsError('invalid-argument', 'Diga o tema do mapa.'); }
      esquema = { type: 'OBJECT', properties: { centro: { type: 'STRING' }, ramos: { type: 'ARRAY', items: { type: 'OBJECT', properties: { titulo: { type: 'STRING' }, itens: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['titulo', 'itens'] } } }, required: ['centro', 'ramos'] };
      sistema = base + ' Monte um mapa mental: um centro curto (até 4 palavras) e de 4 a 6 ramos; cada ramo com título de até 3 palavras e de 2 a 3 itens de até 6 palavras. Responda só no JSON pedido.';
      partes = [{ text: 'Tema do mapa mental: ' + tema }];
    } else {
      esquema = { type: 'OBJECT', properties: { titulo: { type: 'STRING' }, resposta: { type: 'STRING' }, passos: { type: 'ARRAY', items: { type: 'STRING' } }, dica: { type: 'STRING' } }, required: ['titulo', 'resposta'] };
      const ped = txt(d.pergunta, 500);
      if (modo === 'pergunta') {
        if (ped.length < 3) { await estornarCreditos(db, res); throw new HttpsError('invalid-argument', 'Escreva a pergunta.'); }
        sistema = base + ' Responda à pergunta feita em sala: título de até 6 palavras, resposta de até 60 palavras, até 4 passos curtos quando ajudar, e uma dica curta para o professor continuar a conversa com a turma. Responda só no JSON pedido.';
        partes = [{ text: 'Pergunta: ' + ped }];
      } else {
        const acoes = { explicar: 'Explique o que está circulado', resolver: 'Resolva o que está circulado, passo a passo, conferindo a conta', traduzir: 'Traduza o que está circulado para o português (ou do português para o inglês, se já estiver em português) e explique o sentido', livre: ped || 'Explique o que está circulado' };
        const acao = acoes[d.pedido] || acoes.explicar;
        sistema = base + ' A imagem é um pedaço do quadro que o professor circulou com a caneta (pode ter letra à mão, conta, figura ou texto). ' + acao + '. Título de até 6 palavras; resposta de até 70 palavras; passos curtos (até 6) quando for conta ou processo; uma dica curta para o professor. Se não der para entender a imagem, diga isso na resposta com gentileza. Responda só no JSON pedido.';
        partes = [{ inlineData: { mimeType: img.mime, data: img.dados } }, { text: acao + (d.pedido === 'livre' && ped ? '' : '.') }];
      }
    }
    let r = null, erro = null, j = null;
    try {
      r = await gemini(chave, [ctx.cfg.modelo_texto, ...RESERVA_TEXTO], { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: partes }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 4000 } });
      try { j = JSON.parse(r.partes.filter(p => !p.thought).map(p => p.text || '').join('')); } catch (e) { j = null; }
    } catch (e) { erro = e; }
    if (erro || !j) await estornarCreditos(db, res);
    await registrarConsumo(db, ctx, erro || !j ? null : res, { modelo: r && r.modelo, entrada: r && r.entrada, saida: r && r.saida });
    if (erro) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora.');
    if (!j) throw new HttpsError('internal', 'A IA não respondeu direito desta vez. Tente de novo.');
    const limpa = (t, n) => txt(String(t || '').replace(/[*#_`]+/g, ''), n);
    if (modo === 'mapa') return { mapa: { centro: limpa(j.centro, 60), ramos: (Array.isArray(j.ramos) ? j.ramos : []).slice(0, 6).map(x => ({ titulo: limpa(x.titulo, 40), itens: (Array.isArray(x.itens) ? x.itens : []).slice(0, 3).map(i => limpa(i, 70)).filter(Boolean) })).filter(x => x.titulo) }, cota: await cota() };
    return { titulo: limpa(j.titulo, 80), resposta: limpa(j.resposta, 700), passos: (Array.isArray(j.passos) ? j.passos : []).slice(0, 6).map(x => limpa(x, 160)).filter(Boolean), dica: limpa(j.dica, 200), cota: await cota() };
  }

  if (d.acao === 'compartilhar') {
    await exigirRecurso(db, ctx.eu, 'rede_colab', ctx.muni);
    if (!d.aceite) throw new HttpsError('failed-precondition', 'Confirme o termo de compartilhamento.');
    const origRef = db.doc(`portal_ia_docs/${txt(d.id, 64)}`); const os = await origRef.get();
    if (!os.exists || os.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.');
    const o = os.data(), mun = ctx.eu.municipio_id || '';
    if (!TIPOS_REDE.includes(o.tipo)) throw new HttpsError('failed-precondition', 'Parecer e recado aos pais não são compartilhados: eles têm dados de alunos e famílias.');
    if (!mun) throw new HttpsError('failed-precondition', 'Sua conta não está ligada a uma rede de ensino contratante.');
    let escola = '';
    if (ctx.eu.escola_id) { const es = await db.doc(`escolas/${ctx.eu.escola_id}`).get(); escola = es.exists ? txt(es.data().nome, 120) : ''; }
    const redeId = os.id, bucket = getStorage().bucket();
    // imagens: cópia numa pasta da rede (a do professor continua só dele)
    const fontes = {}; Object.entries(o.imagens || {}).forEach(([k, v]) => { if (v && v.caminho) fontes[k] = v.caminho; });
    if (o.imagem && !fontes.topo) fontes.topo = o.imagem;
    await bucket.deleteFiles({ prefix: `portal-ia-rede/${mun}/${redeId}/` }).catch(() => {});
    const imagens = {};
    for (const [k, cam] of Object.entries(fontes)) {
      const destino = `portal-ia-rede/${mun}/${redeId}/${k}.${cam.split('.').pop()}`;
      try { await bucket.file(cam).copy(bucket.file(destino)); imagens[k] = { caminho: destino }; } catch (e) { console.warn('portal-ia: imagem não copiada', cam, e.message); }
    }
    const cx2 = o.contexto || {};
    const bncc = ((o.doc && o.doc.bncc) || []).map(b => txt(b.codigo, 12)).filter(Boolean).slice(0, 8);
    const antes = await db.doc(`portal_ia_rede/${redeId}`).get(), status = statusAoCompartilhar(ctx.muni, antes);
    await db.doc(`portal_ia_rede/${redeId}`).set({
      uid, origem_id: os.id, municipio_id: mun, escopo: 'municipio', status,
      autor_nome: txt(ctx.eu.nome || '', 80), escola_nome: escola, escola_id: ctx.eu.escola_id || '',
      tipo: o.tipo, tipo_nome: o.tipo_nome || (TIPOS[o.tipo] || {}).nome || '', publico: o.publico || 'aluno',
      titulo: txt(o.titulo || (o.doc && o.doc.titulo), 160), tema: txt(o.tema, 160), disciplina: txt(cx2.disciplina, 60), serie: txt(cx2.serie, 30), bncc,
      doc: o.doc, html: typeof o.html === 'string' ? o.html : '', imagens,
      usos: antes.exists ? (antes.data().usos || 0) : 0, denuncias: antes.exists ? (antes.data().denuncias || 0) : 0,
      termo_aceito_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(), ...(antes.exists ? {} : { criado_em: FieldValue.serverTimestamp() })
    });
    await origRef.set({ rede: { municipio_id: mun, em: FieldValue.serverTimestamp(), status, motivo: '' } }, { merge: true });
    // aguardando aprovação: só entra nas Novidades quando a moderação aprovar (moderacao-rede.js)
    if (status === 'pendente') {
      await feedRede(db, mun, null, redeId).catch(() => {});
      if (!(antes.exists && antes.data().status === 'pendente')) await avisarModeradores(db, mun, { titulo: txt(o.titulo || (o.doc && o.doc.titulo), 160), tipo_nome: o.tipo_nome || '', disciplina: txt(cx2.disciplina, 60),
        serie: txt(cx2.serie, 30), autor_nome: txt(ctx.eu.nome || '', 80), escola_nome: escola, escola_id: ctx.eu.escola_id || '' }).catch(e => console.warn('avisarModeradores', e.message));
      return { ok: true, id: redeId, pendente: true };
    }
    // Novidades da rede (Início dos colegas e resumo diário por e-mail)
    await feedRede(db, mun, { id: redeId, titulo: txt(o.titulo || (o.doc && o.doc.titulo), 160), tipo_nome: o.tipo_nome || (TIPOS[o.tipo] || {}).nome || '',
      disciplina: txt(cx2.disciplina, 60), serie: txt(cx2.serie, 30), autor_nome: txt(ctx.eu.nome || '', 80), autor_uid: uid, escola_nome: escola, atualizado: antes.exists }).catch(e => console.warn('feedRede', e.message));
    return { ok: true, id: redeId };
  }
  if (d.acao === 'descompartilhar') {
    const id = txt(d.id, 64), ref = db.doc(`portal_ia_rede/${id}`), rs = await ref.get();
    if (!rs.exists) return { ok: true };
    if (rs.data().uid !== uid && !ctx.admin) throw new HttpsError('permission-denied', 'Só quem compartilhou pode tirar da rede.');
    await getStorage().bucket().deleteFiles({ prefix: `portal-ia-rede/${rs.data().municipio_id}/${id}/` }).catch(() => {});
    await ref.delete();
    await feedRede(db, rs.data().municipio_id, null, id).catch(() => {});
    await db.doc(`portal_ia_docs/${rs.data().origem_id}`).set({ rede: FieldValue.delete() }, { merge: true }).catch(() => {});
    return { ok: true };
  }
  if (d.acao === 'usar') {
    const rs = await db.doc(`portal_ia_rede/${txt(d.id, 64)}`).get();
    if (!rs.exists) throw new HttpsError('not-found', 'Este material não está mais na rede.');
    const r = rs.data();
    const moderador = ctx.eu.perfil === 'gestor' && r.municipio_id === ctx.eu.municipio_id;
    if (!ctx.admin && !moderador && (r.status !== 'publicado' || r.municipio_id !== ctx.eu.municipio_id)) throw new HttpsError('permission-denied', 'Este material não é da sua rede.');
    const novo = db.collection('portal_ia_docs').doc(), bucket = getStorage().bucket(), imagens = {};
    for (const [k, v] of Object.entries(r.imagens || {})) {
      if (!v || !v.caminho) continue;
      const destino = `portal-ia/${uid}/${novo.id}-${k}.${v.caminho.split('.').pop()}`;
      try { await bucket.file(v.caminho).copy(bucket.file(destino)); imagens[k] = { caminho: destino }; } catch (e) { console.warn('portal-ia: imagem não copiada', v.caminho, e.message); }
    }
    await novo.set({ uid, tipo: r.tipo, tipo_nome: r.tipo_nome, publico: r.publico, titulo: r.titulo, tema: r.tema, resumo: r.tema || r.titulo,
      contexto: { disciplina: r.disciplina || '', serie: r.serie || '', turma: '' }, doc: r.doc, html: r.html || '', imagens, imagem: (imagens.topo && imagens.topo.caminho) || '',
      favorito: false, ajustes: 0, modelo: 'rede', origem_rede: { id: rs.id, autor_nome: r.autor_nome || '', escola_nome: r.escola_nome || '' },
      criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
    if (r.uid !== uid) await rs.ref.update({ usos: FieldValue.increment(1) });
    return { ok: true, id: novo.id };
  }
  if (d.acao === 'denunciar') {
    const ref = db.doc(`portal_ia_rede/${txt(d.id, 64)}`), motivo = txt(d.motivo, 500);
    if (motivo.length < 5) throw new HttpsError('invalid-argument', 'Conte em poucas palavras qual é o problema.');
    const oculto = await db.runTransaction(async t => {
      const rs = await t.get(ref); if (!rs.exists) throw new HttpsError('not-found', 'Este material não está mais na rede.');
      const r = rs.data();
      if (!ctx.admin && r.municipio_id !== ctx.eu.municipio_id) throw new HttpsError('permission-denied', 'Este material não é da sua rede.');
      if (r.uid === uid) throw new HttpsError('failed-precondition', 'Para corrigir o seu material, edite e use Atualizar na rede.');
      const dr = ref.collection('denuncias').doc(uid), ds = await t.get(dr);
      t.set(dr, { uid, nome: txt(ctx.eu.nome, 80), motivo, em: FieldValue.serverTimestamp() });
      const n = (r.denuncias || 0) + (ds.exists ? 0 : 1);
      // 3 professores diferentes apontando erro: sai da vitrine até a revisão
      t.update(ref, { denuncias: n, ...(n >= 3 ? { status: 'oculto' } : {}) });
      return n >= 3;
    });
    if (oculto) { const rr = (await ref.get()).data() || {}; await feedRede(db, rr.municipio_id, null, ref.id).catch(() => {}); }
    return { ok: true, oculto };
  }
  /* ---------------- enviar um material por e-mail (colegas da turma ou qualquer pessoa) ----------------
     Vai em PDF anexo (gerado na tela do professor) ou, no material editado à mão, no corpo do e-mail.
     Resposta cai direto no e-mail do professor (replyTo). Limite: 30 destinatários por dia por professor. */
  if (d.acao === 'enviar_email') {
    const os = await db.doc(`portal_ia_docs/${txt(d.id, 64)}`).get();
    if (!os.exists || os.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.');
    const o = os.data();
    if (o.tipo === 'parecer') throw new HttpsError('failed-precondition', 'O parecer tem dados do aluno e não é enviado por e-mail daqui.');
    await exigirRecurso(db, ctx.eu, 'rede_colab', ctx.muni); if (d.rede) await exigirRecurso(db, ctx.eu, 'turma_ao_vivo', ctx.muni);
    const { para, teto } = await destinatarios(db, ctx.eu, uid, ctx.admin, d);
    const anexos = lerAnexos(d.anexos, 2);
    let corpo = '';
    if (!anexos.length) { corpo = htmlSeguro(d.html); if (corpo.replace(/<[^>]+>/g, '').trim().length < 20) throw new HttpsError('invalid-argument', 'Não encontrei o conteúdo do material para enviar.'); }
    await contarEnvioDia(db, uid, ctx.admin, para.length, teto);
    let escola = ''; if (ctx.eu.escola_id) { const es = await db.doc(`escolas/${ctx.eu.escola_id}`).get(); escola = es.exists ? txt(es.data().nome, 120) : ''; }
    const cx2 = o.contexto || {};
    await mandarMaterial({ eu: ctx.eu, escola, mun: ctx.muni ? txt(ctx.muni.nome, 80) : '', titulo: txt(o.titulo || (o.doc && o.doc.titulo) || 'Material', 160),
      sub: [o.tipo_nome, cx2.disciplina, cx2.serie].filter(Boolean).join(' · '), mensagem: d.mensagem, anexos, corpo, para });
    await os.ref.set({ envios_email: FieldValue.increment(para.length) }, { merge: true });
    return { ok: true, enviados: para.length };
  }
  /* ---------------- opções de envio para gestor e secretaria: escolas, séries e disciplinas do alcance ---------------- */
  if (d.acao === 'opcoes_envio') return opcoesEnvio(db, ctx.eu);
  /* ---------------- enviar o material para os alunos: aparece em "Materiais da turma" no Portal do Aluno ----------------
     Vai a versão do aluno (sem gabarito), como HTML já montado na tela do professor; as imagens são copiadas
     para turma-materiais/{material}/ com link de acesso próprio. Professor: turmas dele; gestor e secretaria: pelo filtro. */
  if (d.acao === 'enviar_turma') {
    const os = await db.doc(`portal_ia_docs/${txt(d.id, 64)}`).get();
    if (!os.exists || os.data().uid !== uid) throw new HttpsError('not-found', 'Material não encontrado.');
    const o = os.data();
    if (['parecer', 'recado'].includes(o.tipo) || o.publico === 'professor') throw new HttpsError('failed-precondition', 'Este tipo de material é para o professor ou para as famílias, não para os alunos.');
    await exigirRecurso(db, ctx.eu, 'sala_digital', ctx.muni); if (d.filtro) await exigirRecurso(db, ctx.eu, 'turma_ao_vivo', ctx.muni);
    const turmas = await turmasParaAlunos(db, ctx.eu, uid, ctx.admin, d);
    let html = htmlSeguro(d.html);
    if (html.replace(/<[^>]+>/g, '').trim().length < 20) throw new HttpsError('invalid-argument', 'Não encontrei o conteúdo do material.');
    const fontes = {};
    Object.entries(o.imagens || {}).forEach(([k, v]) => { if (v && v.caminho) fontes[k] = v.caminho; });
    if (o.imagem && !fontes.topo) fontes.topo = o.imagem;
    const urls = {};
    for (const [k, cam] of Object.entries(fontes)) {
      if (!/^[\w-]{1,12}$/.test(k)) continue;
      try { urls[k] = await linkPublico(cam, `turma-materiais/${os.id}/${k}.${cam.split('.').pop()}`); } catch (e) { console.warn('portal-ia: imagem não copiada para a turma', cam, e.message); }
    }
    html = html.replace(/__IMG_([\w-]{1,12})__/g, (_, k) => urls[k] || '');
    const css = String(d.css || '').slice(0, 80000).replace(/<\/?style[^>]*>/gi, '').replace(/@import[^;]+;/gi, '').replace(/url\(\s*['"]?\s*javascript:[^)]*\)/gi, '');
    let escola = ''; if (ctx.eu.escola_id) { const es = await db.doc(`escolas/${ctx.eu.escola_id}`).get(); escola = es.exists ? txt(es.data().nome, 120) : ''; }
    const cx2 = o.contexto || {};
    await publicarNaTurma(db, turmas, os.id, { origem_id: os.id, origem: 'portalia', autor_uid: uid, autor_nome: txt(ctx.eu.nome || '', 80), escola_nome: escola, titulo: txt(o.titulo || (o.doc && o.doc.titulo) || 'Material', 160),
      tipo_nome: o.tipo_nome || '', disciplina: txt(cx2.disciplina, 60), serie: txt(cx2.serie, 30), html, css });
    await os.ref.set({ turmas_enviadas: FieldValue.arrayUnion(...turmas.slice(0, 50).map(t => t.id)) }, { merge: true });
    return { ok: true, turmas: turmas.length, nomes: turmas.slice(0, 8).map(t => t.nome || 'Turma') };
  }
  // resumo diário das novidades da rede por e-mail: o próprio professor liga ou desliga
  if (d.acao === 'pref_resumo_rede') {
    await db.doc(`usuarios/${uid}`).set({ resumo_rede: d.ligado === true }, { merge: true });
    return { ok: true, ligado: d.ligado === true };
  }

  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
}
export const portalIa = onCall({ region: 'southamerica-east1', secrets: [GEMINI, SMTP_SENHA], timeoutSeconds: 540, memory: '512MiB', maxInstances: 20 }, tratarPortalIa);

/* ------------------------------------------------------------------ Aulas prontas: fila no servidor (nov/2026)
   O administrador toca uma vez (ou o script do lote grava) e pode fechar a Lousa: acervo_lote/atual guarda a lista;
   cada gravação nesse documento dispara esta função, que gera UMA aula pendente e grava o resultado, o que dispara a próxima.
   Uma por vez (maxInstances 1): sem atropelo e sem estourar a cota do Gemini. */
export const acervoFila = onDocumentWritten({ document: 'acervo_lote/{id}', region: 'southamerica-east1', secrets: [GEMINI, SMTP_SENHA], timeoutSeconds: 540, memory: '512MiB', maxInstances: 1 }, async ev => {
  const depois = ev.data && ev.data.after;
  if (!depois || !depois.exists) return;
  const db = getFirestore(), ref = depois.ref;
  // pega a próxima pendente numa transação (duas execuções seguidas não pegam a mesma)
  const vez = await db.runTransaction(async t => {
    const x = await t.get(ref); if (!x.exists) return null;
    const L = x.data(), itens = Array.isArray(L.itens) ? L.itens : [];
    // aula presa em "gerando" há mais de 12 min (a execução caiu): vira erro e a fila segue
    itens.forEach((i, k) => { if (i.status === 'gerando' && Date.now() - (i.inicio || 0) > 12 * 60e3) itens[k] = { ...i, status: 'erro', erro: 'tempo esgotado' }; });
    if (L.parado || itens.some(i => i.status === 'gerando')) return null;
    const k = itens.findIndex(i => i.status === 'fila');
    if (k < 0) { if (!L.terminado_em) t.update(ref, { terminado_em: FieldValue.serverTimestamp() }); return null; }
    itens[k] = { ...itens[k], status: 'gerando', inicio: Date.now() };
    t.update(ref, { itens, atualizado_em: FieldValue.serverTimestamp() });
    return { k, item: itens[k], uid: L.uid };
  });
  if (!vez) return;
  const it = vez.item;
  let status = 'ok', erro = '', titulo = '';
  try {
    const r = await tratarPortalIa({ auth: { uid: vez.uid }, data: { acao: 'aula_lousa', tema: it.tema, disciplina: it.disciplina, turma: it.turma, qtd: it.qtd, obs: it.obs,
      ultra: true, imagens: it.imagens || 2, estilo: 'auto', acervo: { id: it.id, faixa: it.faixa, macroarea: it.macroarea, tema: it.tema } } });
    titulo = (r && r.titulo) || '';
  } catch (e) { status = 'erro'; erro = String(e.message || e).slice(0, 200); console.warn('acervo: falhou', it.id, erro); }
  await db.runTransaction(async t => {
    const x = await t.get(ref); if (!x.exists) return;
    const itens = x.data().itens || [];
    const k = itens.findIndex(i => i.id === it.id);
    if (k >= 0) itens[k] = { ...itens[k], status, erro, titulo, fim: Date.now() };
    t.update(ref, { itens, atualizado_em: FieldValue.serverTimestamp() });
  });
});

// Material excluído (pelo Portal IA ou por Meus trabalhos): as imagens dele saem do Storage junto.
// A cópia compartilhada com a rede tem imagens próprias e continua no ar até o autor tirar da rede.
export const portalIaLimpar = onDocumentDeleted({ document: 'portal_ia_docs/{id}', region: 'southamerica-east1' }, async ev => {
  const d = (ev.data && ev.data.data()) || {}, uid = d.uid, id = ev.params.id;
  if (!uid || !/^[\w-]{4,64}$/.test(id)) return;
  const pasta = `portal-ia/${uid}/`, bucket = getStorage().bucket(), cams = new Set();
  Object.values(d.imagens || {}).forEach(v => { if (v && typeof v.caminho === 'string') cams.add(v.caminho); });
  if (typeof d.imagem === 'string' && d.imagem) cams.add(d.imagem);
  let n = 0;
  for (const c of cams) if (c.startsWith(pasta)) { await bucket.file(c).delete().then(() => n++).catch(() => {}); }
  await bucket.deleteFiles({ prefix: `${pasta}${id}-` }).catch(() => {});   // sobras de imagens trocadas deste material
  console.log('portal-ia: material excluido', id, 'imagens apagadas', n);
});

// Rede de demonstração "Rede Modelo NEWPC" para testes e apresentações. Todos os nomes são fictícios.
// Tudo o que este script cria tem ID começando com "demo-", e o comando --apagar remove tudo de uma vez.
//
// Rodar no Cloud Shell, na pasta do repositório (usa o firebase-admin da pasta functions):
//   cd functions && node ../scripts/demo-rede.mjs --criar      cria a rede (escolas, turmas, alunos, calendário, 6 semanas de chamadas, fichas, provas)
//   cd functions && node ../scripts/demo-rede.mjs --manha      simula a entrada de hoje pela portaria (rodar na manhã da demonstração)
//   cd functions && node ../scripts/demo-rede.mjs --apagar     apaga tudo o que começa com "demo-"
//
// Não cria usuários (professor, gestor, secretaria): cada usuário novo dispara e-mail de "novo cadastro" para a equipe.
// Para ver a rede, o administrador usa "Entrar como" e escolhe a Rede Modelo NEWPC.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as FREQ from '../functions/frequencia-nucleo.js';
// o firebase-admin vem da pasta functions (de onde o script é chamado)
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldPath, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);

initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const MUNI = 'demo-rede', MUNI_NOME = 'Rede Modelo NEWPC', ANO = 2026;
const COLECOES = ['freq_chamadas', 'freq_entradas', 'freq_resumo', 'busca_ativa', 'respostas', 'avaliacoes', 'alunos', 'turmas', 'escolas', 'cal_rede', 'notas_regras', 'acessos_dia', 'usuarios', 'municipios'];

// sorteio com semente fixa: rodar de novo gera a mesma rede
let semente = 20261024;
const rnd = () => { semente |= 0; semente = (semente + 0x6D2B79F5) | 0; let t = Math.imul(semente ^ (semente >>> 15), 1 | semente); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const um = l => l[Math.floor(rnd() * l.length)];
const p2 = n => String(n).padStart(2, '0');
const ds = d => d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
const soma = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ds(d); };
const semana = s => new Date(s + 'T12:00:00Z').getUTCDay();
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const NOMES = ['Ana', 'Alice', 'Arthur', 'Beatriz', 'Bernardo', 'Bruno', 'Caio', 'Carla', 'Cecília', 'Davi', 'Eduarda', 'Enzo', 'Felipe', 'Gabriela', 'Gael', 'Heitor', 'Helena', 'Isabela',
  'João', 'Júlia', 'Kauã', 'Larissa', 'Laura', 'Lorena', 'Lucas', 'Manuela', 'Maria Clara', 'Miguel', 'Nicole', 'Otávio', 'Pedro', 'Pietra', 'Rafael', 'Samuel', 'Sofia', 'Theo', 'Thiago',
  'Valentina', 'Vitória', 'Yasmin', 'Lívia', 'Benício', 'Mariana', 'Guilherme', 'Lara', 'Matheus', 'Emanuelly', 'Henrique', 'Rebeca', 'Murilo'];
const SOBRENOMES = ['Silva', 'Souza', 'Oliveira', 'Lima', 'Pereira', 'Ferreira', 'Rodrigues', 'Almeida', 'Costa', 'Gomes', 'Ribeiro', 'Martins', 'Carvalho', 'Rocha', 'Barbosa', 'Moraes',
  'Nogueira', 'Teixeira', 'Cardoso', 'Pinheiro', 'Freitas', 'Araújo', 'Mendes', 'Campos', 'Vieira', 'Batista', 'Moreira', 'Duarte', 'Farias', 'Monteiro'];
const nomeAluno = () => um(NOMES) + ' ' + um(SOBRENOMES) + (rnd() < 0.5 ? ' ' + um(SOBRENOMES) : '');

// três escolas: anos iniciais, anos finais e uma de 1º ao 9º
const ESCOLAS = [
  { id: 'demo-e1', nome: 'Escola Modelo NEWPC Educação', turmas: [['1º Ano', 2], ['2º Ano', 2], ['3º Ano', 2], ['4º Ano', 2], ['5º Ano', 2]], porTurma: 25 },
  { id: 'demo-e2', nome: 'Escola Municipal Pantanal', turmas: [['6º Ano', 2], ['7º Ano', 2], ['8º Ano', 2], ['9º Ano', 2]], porTurma: 30 },
  { id: 'demo-e3', nome: 'Escola Municipal Ipê Amarelo', turmas: [['2º Ano', 1], ['4º Ano', 1], ['5º Ano', 2], ['6º Ano', 1], ['7º Ano', 1], ['8º Ano', 1], ['9º Ano', 1]], porTurma: 28 }
];
const anosIniciais = n => /^[1-5]º/.test(n);
const BNCC = { '5º Ano': ['EF05MA03', 'EF05MA08', 'EF05MA12', 'EF05LP03', 'EF05LP07', 'EF05LP15'], '9º Ano': ['EF09MA05', 'EF09MA09', 'EF09MA19', 'EF89LP04', 'EF89LP33', 'EF09LP05'] };

let SIMULAR = false, gravados = 0;
async function gravar(lista) {
  gravados += lista.length; if (SIMULAR) return;
  for (let i = 0; i < lista.length; i += 400) {
    const b = db.batch(); lista.slice(i, i + 400).forEach(([ref, dados]) => b.set(ref, dados)); await b.commit();
  }
}

async function criar() {
  const agora = Timestamp.now(), docs = [];
  docs.push([db.doc(`municipios/${MUNI}`), { nome: MUNI_NOME, uf: 'MS', status: 'ativo', demo: true, modulos_professor: [], modulos_aluno: [], modulos_secretaria: ['painel'],
    logo_url: 'https://app.portaldoeducador.com.br/assets/pde-logo-256.png', criado_em: agora }]);
  docs.push([db.doc(`notas_regras/${MUNI}`), { periodos: 4, pesos: [1, 1, 1, 1], media_minima: 6, nota_max: 10, arredondamento: 'decimo', composicao: 'media', rec_periodo: 'maior',
    rec_final: true, peso_media: 1, peso_exame: 1, media_final_minima: 5, freq_minima: 75, atualizado_em: agora, atualizado_por: 'demo' }]);
  const per = [['2026-02-09', '2026-04-24'], ['2026-04-27', '2026-07-10'], ['2026-07-27', '2026-09-30'], ['2026-10-01', '2026-12-11']].map(([inicio, fim]) => ({ inicio, fim }));
  docs.push([db.doc(`cal_rede/${MUNI}_${ANO}`), { municipio_id: MUNI, ano: ANO, inicio: '2026-02-09', fim: '2026-12-11', dias_semana: [1, 2, 3, 4, 5], horas_dia: 4, meta_dias: 200, meta_horas: 800,
    periodos: per, facultativos_letivos: [], eventos: [{ ini: '2026-07-13', fim: '2026-07-24', tipo: 'recesso', nome: 'Recesso escolar' }],
    token: Array.from({ length: 20 }, () => um('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.split(''))).join(''), atualizado_em: agora, atualizado_por: 'demo' }]);

  // escolas, turmas e alunos
  const turmas = [], alunos = {};
  let nt = 0, na = 0;
  for (const e of ESCOLAS) {
    docs.push([db.doc(`escolas/${e.id}`), { nome: e.nome, municipio_id: MUNI, municipio_nome: MUNI_NOME, status: 'ativa', demo: true, criado_em: agora }]);
    for (const [serie, q] of e.turmas) for (let k = 0; k < q; k++) {
      const id = `demo-t${p2(++nt)}`, nome = serie + ' ' + 'ABC'[k], ini = anosIniciais(serie);
      const t = { id, nome, serie, escola_id: e.id, escola_nome: e.nome, ini, profs: ini ? [`demo-prof-${id}`] : [`demo-prof-${id}-ma`, `demo-prof-${id}-lp`], alunos: [] };
      turmas.push(t);
      docs.push([db.doc(`turmas/${id}`), { nome, escola_id: e.id, escola_nome: e.nome, municipio_id: MUNI, municipio_nome: MUNI_NOME, ano_serie: serie, turno: k % 2 ? 'Vespertino' : 'Matutino',
        ano_letivo: ANO, status: 'ativa', criado_por: t.profs[0], criado_em: agora, demo: true }]);
      const n = e.porTurma + Math.floor(rnd() * 5) - 2;
      for (let i = 0; i < n; i++) {
        const aid = `demo-a${String(++na).padStart(4, '0')}`, r = rnd();
        // perfil de frequência: maioria regular, alguns irregulares e poucos em risco de evasão
        const a = { id: aid, nome: nomeAluno(), turma: t, p: r < 0.83 ? 0.03 + rnd() * 0.03 : r < 0.95 ? 0.14 + rnd() * 0.1 : 0.38 + rnd() * 0.2 };
        alunos[aid] = a; t.alunos.push(a);
        docs.push([db.doc(`alunos/${aid}`), { nome: a.nome, turma_id: id, escola_id: e.id, municipio_id: MUNI, status: 'ativo', criado_por: t.profs[0], criado_em: agora, demo: true }]);
      }
      t.alunos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    }
  }
  // quatro alunos faltando os últimos dias seguidos (para a busca ativa e os anéis do Mural)
  const seguidos = [turmas[1].alunos[3], turmas[6].alunos[8], turmas[12].alunos[5], turmas[17].alunos[2]].map((a, i) => ({ a, dias: [3, 5, 4, 6][i] }));

  // seis semanas de chamadas, até o último dia letivo antes de hoje
  const hoje = hojeMS(), dias = [];
  for (let d = '2026-09-14'; d < hoje; d = soma(d, 1)) if (semana(d) >= 1 && semana(d) <= 5 && d !== '2026-10-12') dias.push(d);
  const ultimos = n => dias.slice(-n);
  const chamadas = [];
  for (const t of turmas) {
    const lista = t.alunos.map(a => a.id), nomes = Object.fromEntries(t.alunos.map(a => [a.id, a.nome]));
    for (const d of dias) {
      const faltouDia = {}, just = {};
      t.alunos.forEach(a => {
        const s = seguidos.find(x => x.a === a);
        if (s ? ultimos(s.dias).includes(d) : rnd() < a.p) faltouDia[a.id] = true;
        if (faltouDia[a.id] && !s && rnd() < 0.12) just[a.id] = true;
      });
      const base = { escola_id: t.escola_id, municipio_id: MUNI, turma_id: t.id, turma_nome: t.nome, dia: d, ano: ANO, lista, nomes, atualizado_em: agora };
      if (t.ini) {
        const f = Object.fromEntries(Object.keys(faltouDia).map(id => [id, 4]));
        chamadas.push({ id: `${t.profs[0]}_${t.id}_${d}_polivalente-anos-iniciais`, ...base, professor_uid: t.profs[0], professor_nome: 'Professora da turma (demonstração)',
          disciplina: 'Polivalente (anos iniciais)', disc_id: 'polivalente-anos-iniciais', aulas: 4, faltas: f, just: Object.fromEntries(Object.keys(just).filter(id => f[id]).map(id => [id, true])),
          conteudo: um(['Leitura compartilhada e interpretação', 'Problemas com as quatro operações', 'Ciências: ciclo da água', 'Produção de texto: bilhete', 'Geometria: figuras planas', 'História do município']) });
      } else {
        [['ma', 'Matemática', 'matematica'], ['lp', 'Língua Portuguesa', 'lingua-portuguesa']].forEach(([k, disc, did], i) => {
          const f = {}; Object.keys(faltouDia).forEach(id => { f[id] = 2; });
          t.alunos.forEach(a => { if (!f[a.id] && rnd() < 0.015) f[a.id] = 1; }); // faltou só uma das aulas
          chamadas.push({ id: `${t.profs[i]}_${t.id}_${d}_${did}`, ...base, professor_uid: t.profs[i], professor_nome: (i ? 'Professor(a) de Língua Portuguesa' : 'Professor(a) de Matemática') + ' (demonstração)',
            disciplina: disc, disc_id: did, aulas: 2, faltas: f, just: Object.fromEntries(Object.keys(just).filter(id => f[id]).map(id => [id, true])),
            conteudo: um(i ? ['Gêneros textuais: notícia', 'Concordância verbal', 'Leitura de crônica', 'Argumentação'] : ['Equações do 1º grau', 'Frações e porcentagem', 'Proporcionalidade', 'Gráficos e tabelas']) });
        });
      }
    }
  }

  // resumo por turma (o mesmo cálculo da função freqResumo)
  const resumos = {};
  for (const t of turmas) {
    let r = null;
    for (const d of dias) r = FREQ.aplicarDia(r, d, chamadas.filter(c => c.turma_id === t.id && c.dia === d), 75);
    resumos[t.id] = { ...r, turma_id: t.id, turma_nome: t.nome, escola_id: t.escola_id, municipio_id: MUNI, ano: ANO, atualizado_em: agora };
  }

  // fichas de busca ativa em situações diferentes
  const reg = (dias, tipo, texto, extra) => ({ em: Date.parse(soma(hoje, -dias) + 'T14:00:00Z'), por: 'demo-gestor', por_nome: 'Coordenação (demonstração)', tipo, motivo: '', para: '', retorno: '', texto, ...(extra || {}) });
  const fichas = [
    [seguidos[1].a, 'encaminhado', [reg(3, 'ligacao', 'Telefone da mãe não atende. Deixado recado.'), reg(2, 'sem_contato', 'Nova tentativa sem sucesso.'),
      reg(1, 'visita', 'Visita domiciliar: ninguém em casa. Vizinha informou mudança recente.', { motivo: 'Mudança de endereço', para: 'Conselho Tutelar' })]],
    [seguidos[3].a, 'contato', [reg(2, 'whatsapp', 'Avó respondeu: aluno com febre, deve voltar na segunda.', { motivo: 'Doença', retorno: soma(hoje, 2) })]],
    [seguidos[0].a, 'aberto', []],
    [Object.values(alunos).find(a => a.p > 0.38), 'resolvido', [reg(20, 'ligacao', 'Pai informou problema com o transporte escolar.', { motivo: 'Transporte' }),
      reg(15, 'reuniao', 'Reunião com a família e a Secretaria: rota do ônibus ajustada.', { motivo: 'Transporte', para: 'Secretaria de Educação' }), reg(5, 'status', 'Situação alterada para: Resolvido')]]
  ];
  fichas.forEach(([a, status, registros]) => { if (!a) return; docs.push([db.doc(`busca_ativa/${a.turma.escola_id}_${a.id}_${ANO}`), { escola_id: a.turma.escola_id, municipio_id: MUNI, aluno_id: a.id, aluno_nome: a.nome,
    turma_id: a.turma.id, turma_nome: a.turma.nome, ano: ANO, status, registros, atualizado_em: agora, atualizado_por: 'demo-gestor' }]); });

  // provas objetivas corrigidas (Painel: acerto e habilidades BNCC)
  let nr = 0;
  turmas.filter(t => BNCC[t.serie]).forEach((t, k) => {
    const cods = BNCC[t.serie], aid = `demo-av${p2(k + 1)}`;
    const questoes = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, tipo: 'multipla', bncc: cods[i % cods.length], enunciado: 'Questão ' + (i + 1) + ' (demonstração)',
      alternativas: 'ABCD'.split('').map((l, j) => ({ letra: l, texto: 'Alternativa ' + l, correta: j === (i * 7) % 4 })) }));
    docs.push([db.doc(`avaliacoes/${aid}`), { titulo: 'Avaliação diagnóstica ' + t.serie + ' (demonstração)', disciplina: 'Avaliação integrada', professor_uid: t.profs[0], escola_id: t.escola_id, municipio_id: MUNI,
      turma_id: t.id, turma_nome: t.nome, ano_letivo: ANO, status: 'publicada', questoes, criado_em: Timestamp.fromMillis(Date.parse('2026-09-21T13:00:00Z') + k * 864e5), demo: true }]);
    const dific = Object.fromEntries(cods.map(c => [c, 0.35 + rnd() * 0.5]));
    t.alunos.forEach(a => {
      const resp = questoes.map(q => { const cer = q.alternativas.find(x => x.correta).letra; return { numero: q.numero, escolhida: rnd() < dific[q.bncc] ? cer : um('ABCD'.split('').filter(l => l !== cer)) }; });
      docs.push([db.doc(`respostas/demo-r${String(++nr).padStart(5, '0')}`), { avaliacao_id: aid, aluno_id: a.id, aluno_nome: a.nome, turma_id: t.id, respostas: resp, origem: 'cartao', enviado_em: agora }]);
    });
  });

  console.log(`Gravando: ${ESCOLAS.length} escolas, ${turmas.length} turmas, ${Object.keys(alunos).length} alunos, ${dias.length} dias letivos (${dias[0]} a ${dias[dias.length - 1]}), ${chamadas.length} chamadas, ${nr} respostas de provas...`);
  await gravar(docs);
  await gravar(chamadas.map(({ id, ...c }) => [db.doc(`freq_chamadas/${id}`), c]));
  // a função freqResumo também refaz cada dia; o resumo completo vai por último, depois que ela termina
  console.log('Chamadas gravadas. Aguardando 90 s para a função terminar os resumos...');
  if (!SIMULAR) await new Promise(r => setTimeout(r, 90000));
  await gravar(Object.entries(resumos).map(([id, r]) => [db.doc(`freq_resumo/${id}_${ANO}`), r]));
  const risco = Object.values(resumos).reduce((s, r) => s + r.risco, 0), atencao = Object.values(resumos).reduce((s, r) => s + r.atencao, 0);
  console.log(`${SIMULAR ? 'SIMULADO (nada gravado), ' : ''}${gravados} documentos. PRONTO. Rede Modelo NEWPC criada: ${Object.keys(alunos).length} alunos, ${risco} abaixo de 75%, ${atencao} faltando dias seguidos, ${fichas.length} fichas de busca ativa.`);
}

// entrada de hoje pela portaria: ~88% dos alunos entre 6h45 e 7h25; em duas turmas a chamada de hoje marca falta em quem entrou (na escola, fora da sala)
async function manha() {
  const hoje = hojeMS(), agora = Timestamp.now();
  const ts = (await db.collection('turmas').where('municipio_id', '==', MUNI).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const als = (await db.collection('alunos').where('municipio_id', '==', MUNI).get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const docs = []; let n = 0, fora = 0;
  const primeiras = new Set(['demo-e1', 'demo-e3'].map(e => (ts.filter(t => t.escola_id === e && /^[1-5]º/.test(t.ano_serie || '')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))[0] || {}).id));
  ts.forEach(t => {
    const l = als.filter(a => a.turma_id === t.id), entradas = {}, nomes = {};
    l.forEach(a => { if (rnd() < 0.88) { const m = 45 + Math.floor(rnd() * 40); entradas[a.id] = p2(6 + Math.floor(m / 60)) + ':' + p2(m % 60); nomes[a.id] = a.nome; n++; } });
    docs.push([db.doc(`freq_entradas/${t.id}_${hoje}`), { escola_id: t.escola_id, municipio_id: MUNI, turma_id: t.id, turma_nome: t.nome, dia: hoje, ano: +hoje.slice(0, 4), entradas, nomes, atualizado_em: agora }]);
    if (primeiras.has(t.id)) {
      const dentro = Object.keys(entradas), faltas = {}; dentro.slice(0, 1).forEach(id => { faltas[id] = 4; fora++; });
      l.filter(a => !entradas[a.id]).forEach(a => { faltas[a.id] = 4; });
      const uid = `demo-prof-${t.id}`;
      docs.push([db.doc(`freq_chamadas/${uid}_${t.id}_${hoje}_polivalente-anos-iniciais`), { professor_uid: uid, professor_nome: 'Professora da turma (demonstração)', escola_id: t.escola_id, municipio_id: MUNI,
        turma_id: t.id, turma_nome: t.nome, disciplina: 'Polivalente (anos iniciais)', disc_id: 'polivalente-anos-iniciais', dia: hoje, ano: +hoje.slice(0, 4), aulas: 4,
        lista: l.map(a => a.id), nomes: Object.fromEntries(l.map(a => [a.id, a.nome])), faltas, just: {}, conteudo: 'Chamada da manhã (demonstração)', atualizado_em: agora }]);
    }
  });
  await gravar(docs);
  console.log(`PRONTO. ${n} entradas pela portaria hoje (${hoje}); ${fora} aluno(s) na escola mas com falta na chamada.`);
}

async function apagar() {
  // chamadas primeiro: a função freqResumo recriaria resumos apagados antes
  const porPrefixo = async c => {
    let total = 0;
    for (;;) {
      const s = await db.collection(c).orderBy(FieldPath.documentId()).startAt('demo-').endAt('demo-').limit(400).get();
      if (s.empty) break; const b = db.batch(); s.docs.forEach(d => b.delete(d.ref)); await b.commit(); total += s.size;
    }
    return total;
  };
  console.log('freq_chamadas', await porPrefixo('freq_chamadas'));
  console.log('Aguardando 90 s para a função terminar...'); await new Promise(r => setTimeout(r, 90000));
  for (const c of COLECOES.filter(c => c !== 'freq_chamadas')) console.log(c, await porPrefixo(c));
  console.log('PRONTO. Rede Modelo NEWPC apagada.');
}

const cmd = process.argv[2];
if (cmd === '--criar') await criar();
else if (cmd === '--simular') { SIMULAR = true; await criar(); }
else if (cmd === '--manha') await manha();
else if (cmd === '--apagar') await apagar();
else console.log('Use --criar, --manha ou --apagar');

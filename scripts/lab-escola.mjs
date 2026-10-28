// Escola de laboratório NEWPC: contas reais de teste (e-mails @portaldoeducador.com.br) numa turma de 30 alunos fictícios.
// Fica num município próprio ("Laboratório NEWPC", id lab-muni): não soma nos números de nenhuma rede real.
// Roda pelo GitHub Actions (workflow "Escola de laboratório"), na pasta functions:
//   --diagnostico   só lê: escolas com "NEWPC" no nome e a situação das 9 contas (não grava nada)
//   --criar         município, escola, 6º Ano A com 30 alunos (ficha e família), calendário, regras de notas, 2 chamados e os 9 pré-cadastros
//   --historico     depois que os 4 professores entraram: 6 semanas de chamadas, notas do 1º ao 3º bimestre, 1 prova corrigida, busca ativa
//   --apagar        apaga tudo o que é do lab-muni, os pré-cadastros e os perfis das 9 contas no Portal (as contas de e-mail continuam)
// Sem CPF, NIS, SUS ou telefone: números inventados podem ser de pessoas reais. O e-mail das famílias é a caixa da secretaria do laboratório.
// O resultado sai como avisos (::notice::) no resumo da execução, porque o log completo não é baixado daqui.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp, FieldPath } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
if (!process.env.LAB_FAKE) initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
// LAB_FAKE: banco em memória para testar o script sem tocar no Firestore
const db = process.env.LAB_FAKE ? (await import(process.env.LAB_FAKE)).db : getFirestore();
const espera = ms => new Promise(ok => setTimeout(ok, process.env.LAB_FAKE ? 1 : ms));

export const CONTAS = [
  ['prof.matematica@portaldoeducador.com.br', 'professor', 'Matemática'],
  ['prof.portugues@portaldoeducador.com.br', 'professor', 'Língua Portuguesa'],
  ['prof.historia@portaldoeducador.com.br', 'professor', 'História'],
  ['prof.ciencias@portaldoeducador.com.br', 'professor', 'Ciências'],
  ['direcao@portaldoeducador.com.br', 'gestor', 'Direção'],
  ['coordenacao@portaldoeducador.com.br', 'gestor', 'Coordenação'],
  ['secretaria.escola@portaldoeducador.com.br', 'secretaria_escolar', 'Secretaria da escola'],
  ['portaria@portaldoeducador.com.br', 'portaria', 'Portaria'],
  ['semed@portaldoeducador.com.br', 'secretaria', 'Secretaria de Educação']
];
const aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 900));

async function diagnostico() {
  const munis = {}; (await db.collection('municipios').get()).forEach(d => { munis[d.id] = d.data(); });
  const escolas = (await db.collection('escolas').get()).docs.filter(d => /newpc/i.test(d.data().nome || ''));
  const linhas = [];
  for (const d of escolas) {
    const e = d.data(), m = munis[e.municipio_id] || {};
    const [t, a] = await Promise.all([db.collection('turmas').where('escola_id', '==', d.id).count().get(), db.collection('alunos').where('escola_id', '==', d.id).count().get()]);
    linhas.push(`escola ${d.id} "${e.nome}" status=${e.status || '-'} · município ${e.municipio_id} "${m.nome || '?'}" plano=${m.plano_nome || '-'} demo=${!!m.demo} · ${t.data().count} turmas, ${a.data().count} alunos`);
  }
  aviso(`ESCOLAS COM NEWPC (${escolas.length}): ` + (linhas.join(' || ') || 'nenhuma'));
  const contas = [];
  for (const [email, perfil] of CONTAS) {
    const u = (await db.collection('usuarios').where('email', '==', email).limit(2).get()).docs[0];
    const p = (await db.doc(`pre_cadastros/${email}`).get()).exists;
    contas.push(`${email.split('@')[0]}: ${u ? `uid ${u.id} perfil=${u.data().perfil || '-'} status=${u.data().status || '-'} muni=${u.data().municipio_id || '-'} escola=${u.data().escola_id || '-'} turmas=${(u.data().turmas_ids || []).join('+') || '-'}` : 'ainda não entrou no Portal'}${p ? ' (tem pré-cadastro)' : ''}`);
  }
  aviso('CONTAS 1: ' + contas.slice(0, 4).join(' || ')); aviso('CONTAS 2: ' + contas.slice(4).join(' || '));
}

const FREQ = await import(pathToFileURL(process.cwd() + '/frequencia-nucleo.js').href);
const MUNI = 'lab-muni', MUNI_NOME = 'Laboratório NEWPC', ESC = 'lab-escola', ESC_NOME = 'Escola Laboratório NEWPC', TUR = 'lab-t6a', TUR_NOME = '6º Ano A', ANO = 2026;
const FAMILIA_EMAIL = 'secretaria.escola@portaldoeducador.com.br';
const NOMES_CONTA = { 'prof.matematica': 'Carlos Lab', 'prof.portugues': 'Ana Lab', 'prof.historia': 'Paulo Lab', 'prof.ciencias': 'Júlia Lab', direcao: 'Marta Lab', coordenacao: 'Renata Lab',
  'secretaria.escola': 'Sônia Lab', portaria: 'José Lab', semed: 'Rosa Lab' };
// grade da semana (1 = segunda): disciplina, dias e aulas por dia
const GRADE = { 'prof.matematica': { disc: 'Matemática', did: 'matematica', dias: [1, 3, 5], aulas: 2 }, 'prof.portugues': { disc: 'Língua Portuguesa', did: 'lingua-portuguesa', dias: [1, 2, 4], aulas: 2 },
  'prof.historia': { disc: 'História', did: 'historia', dias: [3, 5], aulas: 1 }, 'prof.ciencias': { disc: 'Ciências', did: 'ciencias', dias: [2, 4], aulas: 2 } };
const CONTEUDOS = { matematica: ['Frações equivalentes', 'Números decimais', 'Porcentagem', 'Ângulos', 'Expressões numéricas'], 'lingua-portuguesa': ['Leitura de crônica', 'Substantivos e adjetivos', 'Produção de texto: relato', 'Pontuação'],
  historia: ['Pré-história', 'Mesopotâmia', 'Egito antigo', 'Fontes históricas'], ciencias: ['Células', 'Misturas e separação', 'Sistema Solar', 'Rochas e solo'] };

let semente = 20261028;
const rnd = () => { semente |= 0; semente = (semente + 0x6D2B79F5) | 0; let t = Math.imul(semente ^ (semente >>> 15), 1 | semente); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const um = l => l[Math.floor(rnd() * l.length)];
const p2 = n => String(n).padStart(2, '0');
const ds = d => d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
const soma = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ds(d); };
const semana = s => new Date(s + 'T12:00:00Z').getUTCDay();
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function gravar(lista) { for (let i = 0; i < lista.length; i += 400) { const b = db.batch(); lista.slice(i, i + 400).forEach(([ref, d]) => b.set(ref, d)); await b.commit(); } return lista.length; }

const ALUNOS = ['Alice Ferreira Lima', 'Arthur Souza Campos', 'Beatriz Oliveira Rocha', 'Bernardo Almeida Costa', 'Caio Ribeiro Martins', 'Cecília Gomes Pinheiro', 'Davi Carvalho Nogueira',
  'Eduarda Barbosa Teixeira', 'Enzo Moraes Cardoso', 'Felipe Araújo Mendes', 'Gabriela Freitas Vieira', 'Gael Batista Duarte', 'Heitor Moreira Farias', 'Helena Monteiro Silva',
  'Isabela Campos Pereira', 'João Pedro Lima Souza', 'Júlia Rodrigues Alves', 'Kauã Martins Ribeiro', 'Larissa Costa Gomes', 'Laura Pinheiro Rocha', 'Lucas Teixeira Moraes',
  'Manuela Cardoso Freitas', 'Maria Clara Vieira Araújo', 'Miguel Duarte Batista', 'Nicole Farias Moreira', 'Pedro Henrique Silva Monteiro', 'Rafael Nogueira Campos',
  'Sofia Almeida Barbosa', 'Theo Mendes Carvalho', 'Valentina Souza Oliveira'];
const MAES = ['Adriana', 'Cláudia', 'Daniela', 'Fernanda', 'Juliana', 'Luciana', 'Márcia', 'Patrícia', 'Renata', 'Simone'];
const PAIS = ['André', 'Carlos', 'Eduardo', 'Fábio', 'Marcelo', 'Rodrigo', 'Sérgio', 'Wagner'];
const BAIRROS = ['Centro', 'Jardim dos Estados', 'Vila Planalto', 'Coronel Antonino', 'Tiradentes', 'Aero Rancho'];
// perfis de frequência: os índices aqui viram os casos de teste (o resto falta pouco)
const FALTOSOS = { 4: 0.32, 12: 0.42, 20: 0.22 };       // abaixo ou perto de 75% no período
const SEGUIDOS = { 8: 3, 25: 5 };                         // faltando os últimos dias inteiros seguidos (busca ativa)

async function criar() {
  const agora = Timestamp.now(), docs = [], mods = ['videos', 'jogos', 'ia', 'provas', 'portal360', 'atividades', 'relatorios', 'datas', 'colorir', 'historias', 'biblioteca', 'formacao', 'museus', 'dicas', 'dicasaluno', 'apps', 'gestao', 'maestro'];
  docs.push([db.doc(`municipios/${MUNI}`), { nome: MUNI_NOME, uf: 'MS', status: 'ativo', lab: true, plano_nome: 'completo', modulos_professor: mods,
    modulos_aluno: ['videos', 'jogos', 'portal360', 'datas', 'colorir', 'historias', 'biblioteca', 'museus', 'dicasaluno'], modulos_secretaria: ['painel'], recursos: ['prova_online'],
    logo_url: 'https://app.portaldoeducador.com.br/assets/pde-logo-256.png', criado_em: agora }]);
  docs.push([db.doc(`notas_regras/${MUNI}`), { periodos: 4, pesos: [1, 1, 1, 1], media_minima: 6, nota_max: 10, arredondamento: 'decimo', composicao: 'media', rec_periodo: 'maior',
    rec_final: true, peso_media: 1, peso_exame: 1, media_final_minima: 5, freq_minima: 75, atualizado_em: agora, atualizado_por: 'lab' }]);
  const per = [['2026-02-09', '2026-04-24'], ['2026-04-27', '2026-07-10'], ['2026-07-27', '2026-09-30'], ['2026-10-01', '2026-12-11']].map(([inicio, fim]) => ({ inicio, fim }));
  docs.push([db.doc(`cal_rede/${MUNI}_${ANO}`), { municipio_id: MUNI, ano: ANO, inicio: '2026-02-09', fim: '2026-12-11', dias_semana: [1, 2, 3, 4, 5], horas_dia: 4, meta_dias: 200, meta_horas: 800,
    periodos: per, facultativos_letivos: [], eventos: [{ ini: '2026-07-13', fim: '2026-07-24', tipo: 'recesso', nome: 'Recesso escolar' }],
    token: Array.from({ length: 20 }, () => um('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.split(''))).join(''), atualizado_em: agora, atualizado_por: 'lab' }]);
  docs.push([db.doc(`escolas/${ESC}`), { nome: ESC_NOME, municipio_id: MUNI, municipio_nome: MUNI_NOME, municipio_uf: 'MS', status: 'ativa', lab: true, criado_em: agora }]);
  docs.push([db.doc(`turmas/${TUR}`), { nome: TUR_NOME, escola_id: ESC, escola_nome: ESC_NOME, municipio_id: MUNI, municipio_nome: MUNI_NOME, ano_serie: '6º Ano', turno: 'Matutino',
    ano_letivo: ANO, status: 'ativa', criado_por: 'lab', criado_em: agora, lab: true }]);
  ALUNOS.forEach((nome, i) => {
    const id = `lab-a${p2(i + 1)}`, menina = /a$|e$|Alice|Isabela|Beatriz|Helena|Nicole|Cecília|Larissa|Laura|Sofia|Manuela|Valentina|Gabriela|Eduarda|Júlia|Maria/.test(nome.split(' ')[0]) && !/Felipe|Theo|Gael|Davi|João|Kauã/.test(nome);
    const sob = nome.split(' ').slice(-1)[0], mae = um(MAES) + ' ' + sob, pai = um(PAIS) + ' ' + sob;
    const nasc = '2014-' + p2(4 + Math.floor(rnd() * 9)) + '-' + p2(1 + Math.floor(rnd() * 28));
    docs.push([db.doc(`alunos/${id}`), { nome, nome_social: '', matricula: '2026' + String(1001 + i), inep_aluno: '', email: '', nascimento: nasc, situacao: 'cursando',
      turma_id: TUR, turma_nome: TUR_NOME, escola_id: ESC, escola_nome: ESC_NOME, municipio_id: MUNI, municipio_nome: MUNI_NOME, ano_letivo: ANO, status: 'ativo', alertas: [],
      ficha_pct: 90, foto: '', origem: 'lab', criado_em: agora, criado_por: 'lab', atualizado_em: agora, atualizado_por: 'lab' }]);
    const comum = { aluno_id: id, aluno_nome: nome, escola_id: ESC, municipio_id: MUNI, atualizado_em: agora, atualizado_por: 'lab', atualizado_por_nome: 'Laboratório' };
    const transp = rnd() < 0.3;
    docs.push([db.doc(`alunos_ficha/${id}`), { ...comum, sexo: menina ? 'F' : 'M', naturalidade: 'Campo Grande/MS', cpf: '', nis: '', sus: '', certidao: '',
      endereco: { cep: '', rua: 'Rua do Laboratório', numero: String(10 + i * 7), complemento: '', bairro: um(BAIRROS), cidade: 'Campo Grande', uf: 'MS', zona: 'urbana' },
      transporte: { usa: transp, poder: transp ? 'municipal' : '', rota: transp ? 'Rota 3' : '', ponto: transp ? 'Ponto da praça' : '' },
      vida: { escola_anterior: 'Escola Laboratório NEWPC', origem: 'municipal', ano_escola: 2021, ano_rede: 2021, obs: '' },
      programas: { bolsa_familia: rnd() < 0.25, bpc: false, outros: '' }, documentos: [], obs: 'Aluno fictício do laboratório NEWPC.', origem: 'lab', saude_revisada: false }]);
    docs.push([db.doc(`alunos_familia/${id}`), { ...comum, turma_id: TUR, turma_nome: TUR_NOME, aceita_avisos: true, obs: '', origem: 'lab',
      responsaveis: [{ nome: mae, parentesco: 'Mãe', whatsapp: '', email: FAMILIA_EMAIL, principal: true }, { nome: pai, parentesco: 'Pai', whatsapp: '', email: '', principal: false }] }]);
  });
  docs.push([db.doc('rec_chamados/lab-c1'), { qr: '', item_id: '', escola_id: ESC, municipio_id: MUNI, item_nome: 'Lousa digital', patrimonio: 'LAB-001', local: 'Sala do 6º Ano A',
    problema: 'Não liga', descricao: 'Chamado de teste: lousa não liga desde segunda.', nome: 'Carlos Lab', funcao: 'Professor', contato: '', status: 'aberto', criado_em: Timestamp.fromMillis(Date.now() - 5 * 864e5) }]);
  docs.push([db.doc('rec_chamados/lab-c2'), { qr: '', item_id: '', escola_id: ESC, municipio_id: MUNI, item_nome: 'Chromebook 12', patrimonio: 'LAB-012', local: 'Carrinho 1',
    problema: 'Tela quebrada', descricao: 'Chamado de teste.', nome: 'Ana Lab', funcao: 'Professora', contato: '', status: 'aberto', criado_em: Timestamp.fromMillis(Date.now() - 1 * 864e5) }]);
  for (const [email, perfil] of CONTAS) {
    const k = email.split('@')[0], vinc = perfil === 'secretaria'
      ? { escola_id: null, escola_nome: '', escolas_ids: [], escolas_nomes: [] }
      : { escola_id: ESC, escola_nome: ESC_NOME, escolas_ids: [ESC], escolas_nomes: [ESC_NOME] };
    docs.push([db.doc(`pre_cadastros/${email}`), { nome: NOMES_CONTA[k], email, perfil, status: 'ativo', licenca_tipo: 'institucional', municipio_id: MUNI, municipio_nome: MUNI_NOME,
      ...vinc, turmas_ids: perfil === 'professor' ? [TUR] : [], lab: true, importado_em: agora, importado_por: 'lab' }]);
  }
  const n = await gravar(docs);
  aviso(`CRIADO: ${n} documentos. ${MUNI_NOME} (plano completo), ${ESC_NOME}, ${TUR_NOME} com ${ALUNOS.length} alunos, 2 chamados e ${CONTAS.length} pré-cadastros. Agora entre uma vez com cada conta.`);
}

async function historico() {
  const agora = Timestamp.now(), hoje = hojeMS(), uid = {}, faltam = [];
  for (const [email] of CONTAS) {
    const u = (await db.collection('usuarios').where('email', '==', email).limit(1).get()).docs[0];
    if (u) uid[email.split('@')[0]] = { id: u.id, ...u.data() }; else faltam.push(email.split('@')[0]);
  }
  const profs = Object.keys(GRADE).filter(k => uid[k]);
  // professor cadastrado sem a turma: liga ao 6º Ano A (só contas do laboratório)
  const ligados = [];
  for (const k of profs) { const u = uid[k];
    if (u.municipio_id === MUNI && !(u.turmas_ids || []).includes(TUR)) { const t = [...new Set([...(u.turmas_ids || []), TUR])]; await db.doc(`usuarios/${u.id}`).update({ turmas_ids: t }); u.turmas_ids = t; ligados.push(k); } }
  if (ligados.length) aviso('Turma 6º Ano A ligada a: ' + ligados.join(', '));
  if (!profs.length) { aviso('Nenhum professor entrou ainda. Entre com as contas prof.* antes do histórico.'); process.exit(1); }
  const lista = ALUNOS.map((_, i) => `lab-a${p2(i + 1)}`), nomes = Object.fromEntries(ALUNOS.map((n, i) => [`lab-a${p2(i + 1)}`, n]));
  const dias = []; for (let d = '2026-09-14'; d < hoje; d = soma(d, 1)) if (semana(d) >= 1 && semana(d) <= 5 && d !== '2026-10-12') dias.push(d);
  const ult = n => dias.slice(-n);
  const chamadas = [];
  for (const d of dias) {
    const faltou = new Set();
    lista.forEach((id, i) => { if (SEGUIDOS[i] ? ult(SEGUIDOS[i]).includes(d) : rnd() < (FALTOSOS[i] || 0.03)) faltou.add(id); });
    for (const k of profs) {
      const g = GRADE[k]; if (!g.dias.includes(semana(d))) continue;
      const faltas = {}; faltou.forEach(id => { faltas[id] = g.aulas; });
      chamadas.push([db.doc(`freq_chamadas/${uid[k].id}_${TUR}_${d}_${g.did}`), { professor_uid: uid[k].id, professor_nome: uid[k].nome || NOMES_CONTA[k], escola_id: ESC, municipio_id: MUNI,
        turma_id: TUR, turma_nome: TUR_NOME, disciplina: g.disc, disc_id: g.did, dia: d, ano: ANO, aulas: g.aulas, lista, nomes, faltas, just: {}, conteudo: um(CONTEUDOS[g.did]), atualizado_em: agora }]);
    }
  }
  await gravar(chamadas);
  // resumo da turma (o mesmo cálculo da função freqResumo), gravado depois que a função termina
  let r = null; for (const d of dias) r = FREQ.aplicarDia(r, d, chamadas.filter(([, c]) => c.dia === d).map(([, c]) => c), 75);
  aviso(`Chamadas: ${chamadas.length} (${dias[0]} a ${dias[dias.length - 1]}). Aguardando 90 s para a função de resumo...`);
  await espera(90000);
  await gravar([[db.doc(`freq_resumo/${TUR}_${ANO}`), { ...r, turma_id: TUR, turma_nome: TUR_NOME, escola_id: ESC, municipio_id: MUNI, ano: ANO, atualizado_em: agora }]]);
  // notas do 1º ao 3º bimestre (uma prova por bimestre, como a planilha cria), 4º em aberto
  const docs = [];
  for (const k of profs) {
    const g = GRADE[k], avs = [1, 2, 3, 4].map(p => ({ id: `lab${g.did.slice(0, 3)}${p}`, periodo: p, nome: 'Prova', peso: 1, max: 10, tipo: 'nota' })), notas = {};
    lista.forEach((id, i) => { const base = FALTOSOS[i] ? 4.5 : 6 + rnd() * 3; notas[id] = {}; avs.slice(0, 3).forEach(a => { notas[id][a.id] = Math.max(0, Math.min(10, Math.round((base + (rnd() - 0.5) * 3) * 10) / 10)); }); });
    docs.push([db.doc(`notas_planilhas/${uid[k].id}_${TUR}_${g.did}_${ANO}`), { professor_uid: uid[k].id, professor_nome: uid[k].nome || NOMES_CONTA[k], escola_id: ESC, municipio_id: MUNI,
      turma_id: TUR, turma_nome: TUR_NOME, disciplina: g.disc, ano_letivo: ANO, avaliacoes: avs, notas, faltas: {}, aulas: {}, exame: {}, conselho: {}, atualizado_em: agora }]);
  }
  // prova objetiva corrigida de Matemática (acerto e habilidades BNCC no Painel)
  if (uid['prof.matematica']) {
    const cods = ['EF06MA07', 'EF06MA08', 'EF06MA13', 'EF06MA25'], dif = { EF06MA07: 0.75, EF06MA08: 0.6, EF06MA13: 0.45, EF06MA25: 0.35 };
    const questoes = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, tipo: 'multipla', bncc: cods[i % 4], enunciado: 'Questão ' + (i + 1) + ' (laboratório)',
      alternativas: 'ABCD'.split('').map((l, j) => ({ letra: l, texto: 'Alternativa ' + l, correta: j === (i * 7) % 4 })) }));
    docs.push([db.doc('avaliacoes/lab-av1'), { titulo: 'Avaliação de Matemática · 3º bimestre (laboratório)', disciplina: 'Matemática', professor_uid: uid['prof.matematica'].id, escola_id: ESC, municipio_id: MUNI,
      turma_id: TUR, turma_nome: TUR_NOME, ano_letivo: ANO, status: 'publicada', questoes, criado_em: Timestamp.fromMillis(Date.parse('2026-09-24T13:00:00Z')), lab: true }]);
    lista.forEach((id, i) => { docs.push([db.doc(`respostas/lab-r${p2(i + 1)}`), { avaliacao_id: 'lab-av1', aluno_id: id, aluno_nome: nomes[id], turma_id: TUR, origem: 'cartao', enviado_em: agora,
      respostas: questoes.map(q => { const c = q.alternativas.find(x => x.correta).letra; return { numero: q.numero, escolhida: rnd() < dif[q.bncc] ? c : um('ABCD'.split('').filter(l => l !== c)) }; }) }]); });
  }
  // uma ficha de busca ativa já em contato (a outra fica para a coordenação abrir no teste)
  const coord = uid.coordenacao || uid.direcao, a = 'lab-a' + p2(26);
  docs.push([db.doc(`busca_ativa/${ESC}_${a}_${ANO}`), { escola_id: ESC, municipio_id: MUNI, aluno_id: a, aluno_nome: nomes[a], turma_id: TUR, turma_nome: TUR_NOME, ano: ANO, status: 'contato',
    registros: [{ em: Date.now() - 864e5, por: coord ? coord.id : 'lab', por_nome: coord ? coord.nome : 'Coordenação', tipo: 'ligacao', motivo: 'Doença', para: '', retorno: soma(hoje, 2), texto: 'Mãe informou febre. Deve voltar na próxima semana. (teste)' }],
    atualizado_em: agora, atualizado_por: coord ? coord.id : 'lab' }]);
  const n = await gravar(docs);
  aviso(`HISTÓRICO: ${chamadas.length} chamadas, resumo da turma (${r.risco} abaixo de 75%, ${r.atencao} faltando seguido), ${n} documentos de notas, prova e busca ativa.` + (faltam.length ? ` Ainda não entraram: ${faltam.join(', ')}.` : ' Todas as 9 contas entraram.'));
}

async function apagar() {
  const porMuni = async c => { let t = 0; for (;;) { const s = await db.collection(c).where('municipio_id', '==', MUNI).limit(400).get(); if (s.empty) break; const b = db.batch(); s.docs.forEach(d => b.delete(d.ref)); await b.commit(); t += s.size; } return t; };
  const porPrefixo = async c => { let t = 0; for (;;) { const s = await db.collection(c).orderBy(FieldPath.documentId()).startAt('lab-').endAt('lab-').limit(400).get(); if (s.empty) break; const b = db.batch(); s.docs.forEach(d => b.delete(d.ref)); await b.commit(); t += s.size; } return t; };
  const log = [];
  log.push('freq_chamadas ' + await porMuni('freq_chamadas'));
  await espera(60000);   // a função de resumo termina antes de o resumo sair
  for (const c of ['freq_resumo', 'freq_entradas', 'notas_planilhas', 'busca_ativa', 'rec_chamados', 'rec_itens', 'alunos_familia', 'alunos_ficha', 'alunos_autorizados', 'avaliacoes', 'alunos', 'turmas', 'escolas', 'cal_escola', 'provas_online', 'tv_telas'])
    log.push(c + ' ' + await porMuni(c));
  log.push('respostas ' + await porPrefixo('respostas'));
  for (const c of ['municipios', 'notas_regras', 'cal_rede', 'escolas', 'turmas', 'alunos']) log.push(c + '(id) ' + await porPrefixo(c));
  let pre = 0, us = 0;
  for (const [email] of CONTAS) {
    const p = db.doc(`pre_cadastros/${email}`); if ((await p.get()).exists) { await p.delete(); pre++; }
    for (const d of (await db.collection('usuarios').where('email', '==', email).get()).docs) if (d.data().municipio_id === MUNI || !d.data().municipio_id) { await d.ref.delete(); us++; }
  }
  aviso(`APAGADO: ${log.join(', ')}, ${pre} pré-cadastros, ${us} perfis das contas de teste (as contas de e-mail continuam).`);
}

const cmd = process.argv[2];
if (cmd === '--diagnostico') await diagnostico();
else if (cmd === '--criar') await criar();
else if (cmd === '--historico') await historico();
else if (cmd === '--apagar') await apagar();
else { console.log('Use --diagnostico, --criar, --historico ou --apagar'); process.exit(1); }


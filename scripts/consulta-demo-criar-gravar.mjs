// Rede Municipal de Demonstração (SENACOP, nov/2026). Dados SIMULADOS, assumidos como demonstração na tela.
// Tudo leva demo:true e a rede demo-rede; ids começam com "demo-". Sem e-mail em ninguém (nenhum envio automático alcança).
// Idempotente: refaz os mesmos documentos. Para apagar: consulta demo-apagar (conta) e demo-apagar-gravar (remove).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();

const M = 'demo-rede', NOME = 'Rede Municipal de Demonstração', D = { demo: true };
const DIA = 864e5, agora = Date.now(), ano = new Date(agora - 4 * 36e5).getUTCFullYear();
const iso = ms => new Date(ms - 4 * 36e5).toISOString().slice(0, 10);
const ts = ms => Timestamp.fromMillis(ms);
let semente = 20261111; const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1)), um = l => l[Math.floor(rnd() * l.length)];
const pad = (n, k = 2) => String(n).padStart(k, '0');

let lote = db.batch(), nLote = 0, total = 0;
const grava = async (ref, dados) => { lote.set(ref, dados); nLote++; total++; if (nLote >= 400) { await lote.commit(); lote = db.batch(); nLote = 0; } };
const fecha = async () => { if (nLote) await lote.commit(); lote = db.batch(); nLote = 0; };

// ---------- rede e escolas ----------
await grava(db.doc(`municipios/${M}`), { ...D, nome: NOME, uf: 'MS', cidade: 'Demonstração', tipo_rede: 'municipal', status: 'ativo',
  vigencia_fim_ts: ts(Date.UTC(ano + 1, 11, 31)), criado_em: ts(agora - 120 * DIA) });
const ESC = [['demo-esc-1', 'EM Cecília Meireles'], ['demo-esc-2', 'EM Paulo Freire'], ['demo-esc-3', 'EM Anísio Teixeira'], ['demo-esc-4', 'EM Monteiro Lobato']];
for (const [id, nome] of ESC) await grava(db.doc(`escolas/${id}`), { ...D, municipio_id: M, nome, status: 'ativa', criado_em: ts(agora - 120 * DIA) });

// ---------- professores e gestores (sem e-mail) ----------
const NOMES = ['Ana Paula', 'Carlos Eduardo', 'Fernanda', 'Juliana', 'Marcos', 'Patrícia', 'Roberto', 'Simone', 'Tatiane', 'Luciana', 'Adriana', 'Rafael', 'Cláudia', 'Daniela',
  'Eliane', 'Fábio', 'Gisele', 'Helena', 'Ivone', 'Jéssica', 'Kátia', 'Leandro', 'Márcia', 'Natália', 'Odete', 'Priscila', 'Renata', 'Sandra', 'Thiago', 'Vanessa', 'Wesley', 'Aline',
  'Beatriz', 'Cristiane', 'Denise', 'Edson'];
const SOBRE = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Lima', 'Martins', 'Nogueira', 'Oliveira', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
const profs = [];
for (let i = 1; i <= 36; i++) {
  const uid = `demo-prof-${pad(i)}`, esc = ESC[(i - 1) % 4][0], nome = `${NOMES[i - 1]} ${um(SOBRE)} ${um(SOBRE)}`;
  const ativo = rnd() < 0.82, ult = agora - (ativo ? ent(0, 6) : ent(8, 40)) * DIA - ent(0, 20) * 36e5;
  profs.push({ uid, esc, nome, ativo, ult });
  await grava(db.doc(`usuarios/${uid}`), { ...D, nome, email: '', perfil: 'professor', status: 'ativo', municipio_id: M, escola_id: esc, escolas_ids: [esc],
    licenca_tipo: 'institucional', ultimo_acesso: ts(ult), criado_em: ts(agora - 90 * DIA) });
}
for (let i = 1; i <= 4; i++) await grava(db.doc(`usuarios/demo-gestor-${i}`), { ...D, nome: `Direção ${ESC[i - 1][1]}`, email: '', perfil: 'gestor', status: 'ativo',
  municipio_id: M, escola_id: ESC[i - 1][0], escolas_ids: [ESC[i - 1][0]], ultimo_acesso: ts(agora - ent(0, 3) * DIA), criado_em: ts(agora - 90 * DIA) });

// ---------- acessos dos últimos 30 dias (quem entrou e em quais módulos) ----------
const MODS = ['portal-ia', 'lousa', 'provas', 'turma-ao-vivo', 'formacao', 'atividades', 'videos', 'jogos'];
for (let d = 0; d < 30; d++) {
  const ms = agora - d * DIA, dia = iso(ms), semana = new Date(ms - 4 * 36e5).getUTCDay(); if (semana === 0 || semana === 6) continue;
  for (const p of profs) { if (!(p.ativo ? rnd() < 0.62 : (agora - p.ult > d * DIA ? false : rnd() < 0.25))) continue;
    const mods = [...new Set([um(MODS), um(MODS), rnd() < 0.5 ? 'portal-ia' : um(MODS)])];
    await grava(db.doc(`acessos_dia/demo-${dia}-${p.uid}`), { ...D, uid: p.uid, municipio: NOME, dia, modulos: mods }); }
}

// ---------- turmas e alunos (nomes genéricos) ----------
const turmas = [];
for (const [esc] of ESC) for (const t of ['3º ano A', '4º ano A', '5º ano A', '5º ano B']) {
  const id = `demo-tur-${esc.slice(-1)}-${t.replace(/\W/g, '')}`; turmas.push({ id, esc, nome: t });
  await grava(db.doc(`turmas/${id}`), { ...D, municipio_id: M, escola_id: esc, nome: t, ano_letivo: ano, status: 'ativa', criado_em: ts(agora - 80 * DIA) });
}
const alunos = {};
for (const t of turmas) { alunos[t.id] = [];
  for (let k = 1; k <= ent(22, 28); k++) { const id = `demo-al-${t.id.slice(9)}-${pad(k)}`; alunos[t.id].push(id);
    await grava(db.doc(`alunos/${id}`), { ...D, municipio_id: M, escola_id: t.esc, turma_id: t.id, nome: `Estudante ${pad(k)} (${t.nome})`, status: 'ativo' }); } }

// ---------- frequência (resumo por turma; alerta=false para nenhum aviso automático) ----------
for (const t of turmas) { const al = {};
  for (const id of alunos[t.id]) { const a = ent(150, 170), f = rnd() < 0.08 ? ent(30, 45) : rnd() < 0.15 ? ent(15, 25) : ent(0, 10);
    al[id] = { a, f, ...(f / a > 0.25 ? { r: true } : f / a > 0.15 ? { at: true } : {}) }; }
  await grava(db.doc(`freq_resumo/${t.id}_${ano}`), { ...D, municipio_id: M, escola_id: t.esc, turma_id: t.id, ano, ultimo_dia: iso(agora - ent(0, 2) * DIA), alunos: al, alerta: false });
}

// ---------- provas objetivas corrigidas (habilidades BNCC reais) ----------
const HAB = ['EF05MA03', 'EF05MA07', 'EF04MA03', 'EF05LP04', 'EF35LP03', 'EF05CI02', 'EF04MA10', 'EF05MA19'];
const acertoHab = { EF05MA03: 0.48, EF05MA07: 0.63, EF04MA03: 0.71, EF05LP04: 0.66, EF35LP03: 0.78, EF05CI02: 0.59, EF04MA10: 0.52, EF05MA19: 0.44 };
let np = 0;
for (const t of turmas) for (let k = 0; k < 2; k++) {
  const id = `demo-av-${t.id.slice(9)}-${k}`, habs = [um(HAB), um(HAB), um(HAB)];
  const questoes = Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, tipo: 'multipla', bncc: habs[i % 3], enunciado: `Questão ${i + 1}`,
    alternativas: ['A', 'B', 'C', 'D'].map(l => ({ letra: l, texto: `Alternativa ${l}`, correta: l === 'ABCD'[(i * 3 + k) % 4] })) }));
  await grava(db.doc(`avaliacoes/${id}`), { ...D, municipio_id: M, escola_id: t.esc, turma_id: t.id, titulo: `Avaliação diagnóstica ${k + 1} · ${t.nome}`, ano_letivo: ano,
    status: 'corrigida', criado_em: ts(agora - (40 - k * 25) * DIA), questoes });
  for (const al of alunos[t.id]) { if (rnd() < 0.1) continue;
    await grava(db.doc(`respostas/demo-r-${id.slice(8)}-${al.slice(-2)}`), { ...D, avaliacao_id: id, municipio_id: M, escola_id: t.esc, aluno_id: al,
      respostas: questoes.map(q => { const c = q.alternativas.find(x => x.correta).letra; return { numero: q.numero, escolhida: rnd() < (acertoHab[q.bncc] + (t.esc === 'demo-esc-2' ? 0.08 : 0)) ? c : um(['A', 'B', 'C', 'D'].filter(x => x !== c)) }; }) });
  }
  np++;
}

// ---------- infraestrutura: equipamentos, chamados e TVs ----------
for (const [esc] of ESC) { for (let k = 1; k <= ent(14, 22); k++) await grava(db.doc(`rec_itens/demo-it-${esc.slice(-1)}-${pad(k)}`), { ...D, municipio_id: M, escola_id: esc, tipo: um(['Chromebook', 'Chromebook', 'Lousa digital', 'Projetor']) });
  await grava(db.doc(`tv_telas/demo-tv-${esc.slice(-1)}`), { ...D, municipio_id: M, escola_id: esc, nome: 'TV do pátio', visto_em: ts(agora - (esc === 'demo-esc-4' ? 3 * 36e5 : ent(1, 8) * 6e4)) }); }
const PROB = ['Chromebook não liga', 'Lousa sem toque', 'Internet lenta na sala', 'Projetor sem imagem', 'Carregador com defeito'];
for (let k = 1; k <= 14; k++) { const ini = agora - ent(1, 60) * DIA, res = k > 4;
  await grava(db.doc(`rec_chamados/demo-ch-${pad(k)}`), { ...D, municipio_id: M, escola_id: um(ESC)[0], problema: um(PROB), status: res ? 'resolvido' : 'aberto',
    criado_em: ts(res ? ini : agora - ent(1, 5) * DIA), ...(res ? { resolvido_em: ts(ini + ent(4, 40) * 36e5) } : {}) }); }
for (let k = 1; k <= 5; k++) await grava(db.doc(`busca_ativa/demo-ba-${k}`), { ...D, municipio_id: M, escola_id: um(ESC)[0], ano, status: um(['aberto', 'encaminhado', 'resolvido']) });
for (let k = 1; k <= 18; k++) await grava(db.doc(`relatorios/demo-rel-${pad(k)}`), { ...D, municipio_id: M, escola_id: um(ESC)[0], status: um(['aprovado', 'aprovado', 'enviado', 'devolvido']) });

// ---------- Termômetro das aulas (só contagens e rótulos, como o real) ----------
const PERG = [['Matemática', 'Por que 3/4 é maior que 2/3?', 'Compara só os numeradores'], ['Ciências', 'O que acontece com a água na evaporação?', 'Confunde evaporação com fervura'],
  ['Língua Portuguesa', 'Qual é a ideia principal do texto?', 'Responde com um detalhe do texto'], ['Matemática', 'Como você calculou 25% de 80?', 'Divide por 25 em vez de por 4'],
  ['Geografia', 'Por que o rio enche no verão?', 'Associa só à chuva da cidade']];
for (let k = 1; k <= 22; k++) { const t = um(turmas), p = um(PERG), resp = ent(20, 27), conf = ent(2, 9), parc = ent(3, 8), fora = ent(0, 2), ent2 = resp - conf - parc - fora;
  await grava(db.doc(`termometro_registros/demo-tm-${pad(k)}`), { ...D, municipio_id: M, escola_id: t.esc, turma_id: t.id, turma_nome: t.nome, por: um(profs).uid,
    disciplina: p[0], pergunta: p[1], dia: iso(agora - ent(0, 25) * DIA), respostas: resp, entendeu: ent2, parcial: parc, confundiu: conf, fora,
    grupos: [{ tipo: 'entendeu', titulo: 'Explica com as próprias palavras', n: ent2 }, { tipo: 'parcial', titulo: 'Acerta o resultado sem justificar', n: parc }, { tipo: 'confundiu', titulo: p[2], n: conf }],
    em: ts(agora - ent(0, 25) * DIA) }); }

// ---------- Formação Continuada (cursos reais publicados; progresso e certificados simulados) ----------
const cursos = (await db.collection('cursos').where('status', '==', 'publicado').where('exclusivo', '==', false).get()).docs;
const aulasDe = {}; for (const c of cursos) aulasDe[c.id] = (await c.ref.collection('aulas').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
let nCert = 0, nProg = 0, nPrat = 0;
const RELATO = ['Apliquei com o 5º ano A e a turma participou bastante. Na próxima vou organizar melhor o tempo de cada grupo.',
  'Usei a atividade com o 4º ano. Os alunos gostaram de ir ao quadro; alguns precisaram de ajuda para entender a pergunta.',
  'Preparei a atividade e apliquei em duas turmas. Funcionou melhor na segunda, depois que ajustei as instruções.'];
for (const p of profs) {
  const esc = ESC.find(e => e[0] === p.esc)[1];
  await grava(db.doc(`users/${p.uid}`), { ...D, nome: p.nome, email: '', municipio: NOME, escola: esc, cargo: 'Professor(a)', cpf: '', aceiteTermos: '1.0',
    municipio_id: M, escola_id: p.esc, escolas_ids: [p.esc], lembretes: false, criadoEm: ts(agora - 60 * DIA) });
  if (rnd() < 0.22) continue;                                  // não começou nenhum curso
  for (const c of cursos.slice(0, 4)) { if (rnd() < 0.45) continue;
    const aulas = aulasDe[c.id]; if (!aulas.length) continue;
    const r = rnd(), concl = r < 0.3, n = concl ? aulas.length : Math.max(1, Math.floor(aulas.length * (0.15 + rnd() * 0.7)));
    const feitas = aulas.slice(0, n).map(a => a.id), parado = !concl && rnd() < 0.35, ult = agora - (parado ? ent(15, 35) : ent(0, 9)) * DIA;
    await grava(db.doc(`users/${p.uid}/progresso/${c.id}`), { ...D, aulas: feitas, aulasVerificadas: feitas, percentual: Math.round(n / aulas.length * 100), concluido: concl,
      progressoVersao: 2, ultimaAula: aulas[Math.min(n, aulas.length - 1)].id, ultimoAcessoISO: new Date(ult).toISOString(), iniciadoServidorISO: new Date(ult - 20 * DIA).toISOString(),
      concluidoEmISO: concl ? new Date(ult).toISOString() : null, atualizadoEm: ts(ult) }); nProg++;
    if (concl) { const cod = `DEMO-${p.uid.slice(-2)}${c.id.slice(0, 2).toUpperCase()}`;
      await grava(db.doc(`certificados/${cod}`), { ...D, uid: p.uid, nome: p.nome, cursoId: c.id, cursoTitulo: c.data().titulo, cargaHoraria: Number(c.data().horas || 0), ativo: true,
        emitidoEmISO: new Date(ult).toISOString(), aviso: 'DEMONSTRAÇÃO · sem validade' }); nCert++; }
    if (rnd() < 0.5) { const a = aulas[Math.min(1, aulas.length - 1)], s = um(['aplicou', 'aplicou', 'planejou']);
      await grava(db.doc(`users/${p.uid}/praticas/${c.id}__${a.id}`), { ...D, cursoId: c.id, aulaId: a.id, cursoTitulo: c.data().titulo, aulaTitulo: a.titulo, texto: um(RELATO), situacao: s,
        retorno: { situacao: s, pontos_fortes: ['Envolveu a turma na atividade proposta.'], sugestao: 'Combine o tempo de cada etapa antes de começar.', pergunta: 'O que mudou na participação dos alunos?' },
        envios: 1, municipio_id: M, escola_id: p.esc, em: ts(agora - ent(1, 20) * DIA) }); nPrat++; }
  }
}
await fecha();
console.log(`::notice::Rede de demonstração criada: ${total} documentos · 4 escolas · ${profs.length} professores · ${turmas.length} turmas · ${Object.values(alunos).flat().length} estudantes · ${np} provas · ${nProg} cursos em andamento/concluídos · ${nCert} certificados demo · ${nPrat} práticas`);

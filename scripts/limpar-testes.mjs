// Limpeza dos dados de teste e da Rede Modelo NEWPC, antes do cadastro real.
// Rodar no Cloud Shell, na pasta functions:
//   node ../scripts/limpar-testes.mjs              SIMULA: só lista e conta, não apaga nada
//   node ../scripts/limpar-testes.mjs --executar   apaga de verdade (definitivo)
// O que sai: tudo da Rede Modelo (id demo-, municipio_id demo-rede ou demo: true), as escolas de teste abaixo
// com tudo o que estiver ligado a elas (turmas, alunos, chamadas, provas, respostas, fichas, fotos), o usuário
// de teste e os pré-cadastros. Contas reais, municípios reais, Documentação e acervos não são tocados.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore();
const EXEC = process.argv.includes('--executar');

const MUNI = 'demo-rede', MUNI_NOME = 'Rede Modelo NEWPC';
const ESCOLAS_TESTE = ['YJ7S53Kg2nW83nuAkLNT', 'XtvXEIHtMpxLd9VVL9l6'];   // Newpc Educação (Campo Grande) e Escola Municipal centro (São Gabriel)
const EMAIL_TESTE = 'teste@portal.com';
// coleções ligadas a escola, turma, aluno ou prova (acervos, conteúdo e configuração ficam de fora)
const COLS = ['freq_chamadas', 'freq_entradas', 'freq_resumo', 'busca_ativa', 'portaria_vistas', 'respostas', 'avaliacoes', 'gabarito', 'tentativas', 'provas',
  'po_tentativas', 'po_resultados', 'provas_online_gab', 'provas_online', 'notas_planilhas', 'notas_regras', 'anotacoes', 'aulas', 'maestro_aulas', 'progresso',
  'avisos_familia', 'comunicados_familia', 'cal_escola', 'cal_rede', 'alunos_ficha', 'alunos_familia', 'alunos_saude', 'alunos_autorizados', 'alunos_acessos',
  'alunos', 'turmas', 'escolas'];

const tudo = async c => (await db.collection(c).get()).docs;
const ehDemo = d => { const x = d.data(); return d.id.startsWith('demo-') || x.municipio_id === MUNI || x.demo === true; };

// 1) alvos em cascata: escolas -> turmas -> alunos -> provas
const E = new Set(ESCOLAS_TESTE), T = new Set(), A = new Set(), P = new Set();
for (const d of await tudo('escolas')) if (ehDemo(d)) E.add(d.id);
for (const d of await tudo('turmas')) if (ehDemo(d) || E.has(d.data().escola_id)) T.add(d.id);
for (const d of await tudo('alunos')) { const x = d.data(); if (ehDemo(d) || E.has(x.escola_id) || T.has(x.turma_id)) A.add(d.id); }
for (const c of ['avaliacoes', 'provas', 'provas_online']) for (const d of await tudo(c)) { const x = d.data(); if (ehDemo(d) || E.has(x.escola_id) || T.has(x.turma_id) || (x.turmas_ids || []).some(t => T.has(t))) P.add(d.id); }
const alvo = (c, d) => {
  const x = d.data();
  if (ehDemo(d)) return true;
  if (c === 'escolas') return E.has(d.id);
  if (c === 'turmas') return T.has(d.id);
  if (c.startsWith('alunos')) return A.has(d.id) || A.has(x.aluno_id) || E.has(x.escola_id);
  if (['avaliacoes', 'provas', 'provas_online', 'provas_online_gab', 'gabarito'].includes(c) && P.has(d.id)) return true;
  return E.has(x.escola_id) || T.has(x.turma_id) || A.has(x.aluno_id) || P.has(x.avaliacao_id) || P.has(x.prova_id);
};

const apagar = async refs => { for (let i = 0; i < refs.length; i += 400) { const b = db.batch(); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); } };
const plano = [];
const prep = async c => { const l = (await tudo(c)).filter(d => alvo(c, d)); plano.push([c, l]); return l; };

console.log(EXEC ? '=== EXECUTANDO (definitivo) ===' : '=== SIMULAÇÃO: nada será apagado ===');
console.log('Escolas alvo:', E.size, '| turmas:', T.size, '| alunos:', A.size, '| avaliações/provas:', P.size);

// chamadas primeiro: a função freqResumo recria resumos enquanto houver chamadas
const ch = await prep('freq_chamadas');
if (EXEC && ch.length) { await apagar(ch.map(d => d.ref)); console.log('freq_chamadas apagadas:', ch.length, '| aguardando 90 s a função de resumo...'); await new Promise(r => setTimeout(r, 90000)); }
for (const c of COLS.slice(1)) await prep(c);

// usuários: só os de demonstração e o de teste; contas reais ficam, mesmo ligadas às escolas de teste
const us = (await tudo('usuarios')).filter(d => { const x = d.data(); return d.id.startsWith('demo-') || x.demo === true || x.municipio_id === MUNI || x.email === EMAIL_TESTE; });
plano.push(['usuarios', us]);
plano.push(['pre_cadastros', await tudo('pre_cadastros')]);
plano.push(['acessos_dia', (await db.collection('acessos_dia').where('municipio', '==', MUNI_NOME).get()).docs]);
plano.push(['municipios', (await tudo('municipios')).filter(d => d.id === MUNI)]);

let total = 0;
for (const [c, l] of plano) { if (!l.length) continue; total += l.length; console.log(c.padEnd(20), String(l.length).padStart(5)); }
console.log('TOTAL de registros:', total);
const ficam = (await tudo('usuarios')).filter(d => !us.includes(d) && (E.has(d.data().escola_id) || (d.data().escolas_ids || []).some(e => E.has(e))));
const usIds = new Set(us.map(d => d.id));
ficam.filter(d => !usIds.has(d.id)).forEach(d => console.log('Conta real mantida, mas ligada a escola apagada:', d.data().nome, '(' + d.data().perfil + ')'));

// arquivos das escolas apagadas (fichas, fotos, documentos) no bucket principal
const bucket = getStorage().bucket();
const pastas = [...E].flatMap(e => ['alunos_docs/' + e + '/', 'fotos_alunos/' + e + '/', 'fotos_autorizados/' + e + '/']);
let arqs = 0;
for (const p of pastas) { const [f] = await bucket.getFiles({ prefix: p }); arqs += f.length; if (EXEC && f.length) await bucket.deleteFiles({ prefix: p }); }
console.log('Arquivos (fotos e documentos):', arqs);

// conta de login do usuário de teste
let contaTeste = null; try { contaTeste = await getAuth().getUserByEmail(EMAIL_TESTE); } catch (e) {}
console.log('Login de', EMAIL_TESTE + ':', contaTeste ? 'existe' : 'não existe');

if (EXEC) {
  for (const [c, l] of plano) if (c !== 'freq_chamadas' && l.length) await apagar(l.map(d => d.ref));
  if (contaTeste) await getAuth().deleteUser(contaTeste.uid);
  console.log('PRONTO. Limpeza concluída.');
} else console.log('Para apagar de verdade: node ../scripts/limpar-testes.mjs --executar');
process.exit(0);

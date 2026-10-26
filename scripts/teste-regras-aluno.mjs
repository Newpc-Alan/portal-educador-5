// Testa as regras do Firestore para o perfil aluno no emulador (não toca no banco real).
// No Cloud Shell, na pasta do repositório:
//   mkdir -p /tmp/rt && cp scripts/teste-regras-aluno.mjs /tmp/rt/ && (cd /tmp/rt && npm i --silent @firebase/rules-unit-testing@3 firebase@10)
//   firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-aluno.mjs $PWD/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  const s = (p, d) => setDoc(doc(db, p), d);
  await s('municipios/m1', { nome: 'Ribas', modulos_aluno: [] });
  await s('municipios/m2', { nome: 'Outra', modulos_aluno: ['jogos'] });
  await s('municipios/m3', { nome: 'Vencida', modulos_aluno: [], vigencia_fim_ts: Timestamp.fromMillis(Date.now() - 86400000) });
  await s('escolas/e1', { nome: 'EM Centro', municipio_id: 'm1' });
  await s('dominios_aluno/aluno.ribas.ms.gov.br', { municipio_id: 'm1', municipio_nome: 'Ribas', ativo: true });
  await s('pre_cadastros/duda@gmail.com', { nome: 'Duda', perfil: 'aluno', status: 'ativo', municipio_id: 'm1', escola_id: 'e1' });
  await s('usuarios/alu', { perfil: 'aluno', status: 'ativo', municipio_id: 'm1', email: 'alu@aluno.ribas.ms.gov.br' });
  await s('usuarios/alu2', { perfil: 'aluno', status: 'ativo', municipio_id: 'm2' });
  await s('usuarios/alu3', { perfil: 'aluno', status: 'ativo', municipio_id: 'm3' });
  await s('usuarios/prof', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await s('videos/v1', { publicado: true, para_alunos: true });
  await s('biblioteca/h1', { publicado: true, secao: 'historias' }); await s('biblioteca/l1', { publicado: true, secao: 'livros' });
  await s('videos/v2', { publicado: true, para_alunos: false });
  await s('jogos/j1', { publicado: true, para_alunos: true });
  await s('biblioteca/b1', { publicado: true, secao: 'livros' });
  await s('biblioteca/b2', { publicado: true, secao: 'gibiteca' });
  await s('colorir/c1', { publicado: true });
  await s('dicas_envios/d1', { publicado: true, status: 'publicado' });
  await s('dicas_alunos_pub/p1', { titulo: 'x' });
  await s('acervo/x1', { publicado: true, modulo: 'datas' });
  await s('acervo/x2', { publicado: true, modulo: 'atividades' });
  await s('config/modulos', { itens: {} });
});

let ok = 0, falhas = 0;
async function t(nome, p) { try { await p; ok++; } catch (e) { falhas++; console.log('FALHA:', nome, '-', String(e.message || e).slice(0, 160)); } }
const ctx = (uid, email, verificado = true) => env.authenticatedContext(uid, { email, email_verified: verificado }).firestore();
const agora = () => serverTimestamp();
const alunoNovo = (uid, email, extra = {}) => ({ uid, nome: 'Novo', email, perfil: 'aluno', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', municipio_nome: 'Ribas', escola_id: null, origem: 'dominio', criado_em: agora(), criado_por: uid, atualizado_em: agora(), atualizado_por: uid, ...extra });
const teste = (uid) => ({ uid, nome: 'P', email: '', perfil: 'professor', status: 'ativo', licenca_tipo: 'teste', licenca_fim: Timestamp.fromMillis(Date.now() + 6 * 86400000), escola_id: null, municipio_id: null, turmas_ids: [], escolas_ids: [] });

// ---- criação de conta
const novoAl = ctx('n1', 'ana@aluno.ribas.ms.gov.br');
await t('aluno pelo dominio', assertSucceeds(setDoc(doc(novoAl, 'usuarios/n1'), alunoNovo('n1', 'ana@aluno.ribas.ms.gov.br'))));
const n2 = ctx('n2', 'beto@aluno.ribas.ms.gov.br');
await t('dominio com municipio errado', assertFails(setDoc(doc(n2, 'usuarios/n2'), alunoNovo('n2', 'beto@aluno.ribas.ms.gov.br', { municipio_id: 'm2' }))));
await t('dominio de aluno nao vira professor em teste', assertFails(setDoc(doc(n2, 'usuarios/n2'), teste('n2'))));
await t('dominio de aluno nao vira professor pendente', assertFails(setDoc(doc(n2, 'usuarios/n2'), { ...teste('n2'), status: 'pendente', licenca_tipo: 'institucional' })));
await t('aluno com campo extra', assertFails(setDoc(doc(n2, 'usuarios/n2'), alunoNovo('n2', 'beto@aluno.ribas.ms.gov.br', { licenca_fim: Timestamp.now() }))));
await t('aluno de dominio com escola', assertFails(setDoc(doc(n2, 'usuarios/n2'), alunoNovo('n2', 'beto@aluno.ribas.ms.gov.br', { escola_id: 'e1' }))));
const n3 = ctx('n3', 'beto@aluno.ribas.ms.gov.br', false);
await t('dominio sem e-mail verificado nao cria aluno', assertFails(setDoc(doc(n3, 'usuarios/n3'), alunoNovo('n3', 'beto@aluno.ribas.ms.gov.br'))));
await t('dominio sem verificacao tambem nao vira professor', assertFails(setDoc(doc(n3, 'usuarios/n3'), teste('n3'))));
const gm = ctx('g1', 'fulano@gmail.com');
await t('gmail nao vira aluno sozinho', assertFails(setDoc(doc(gm, 'usuarios/g1'), alunoNovo('g1', 'fulano@gmail.com'))));
await t('gmail continua podendo testar como professor', assertSucceeds(setDoc(doc(gm, 'usuarios/g1'), teste('g1'))));
const du = ctx('du', 'duda@gmail.com');
await t('aluno da lista com escola', assertSucceeds(setDoc(doc(du, 'usuarios/du'), alunoNovo('du', 'duda@gmail.com', { escola_id: 'e1', origem: 'pre_cadastro' }))));
const du2 = ctx('du2', 'duda@gmail.com');
await t('aluno da lista com escola diferente', assertFails(setDoc(doc(du2, 'usuarios/du2'), alunoNovo('du2', 'duda@gmail.com', { escola_id: null, origem: 'pre_cadastro' }))));

// ---- leituras do aluno
const al = ctx('alu', 'alu@aluno.ribas.ms.gov.br');
await t('videos para alunos', assertSucceeds(getDocs(query(collection(al, 'videos'), where('publicado', '==', true), where('para_alunos', '==', true)))));
await t('videos sem filtro', assertFails(getDocs(query(collection(al, 'videos'), where('publicado', '==', true)))));
await t('video so de professor', assertFails(getDoc(doc(al, 'videos/v2'))));
const reac = (v, r, extra = {}) => ({ video_id: v, uid: 'alu', reacao: r, perfil: 'aluno', em: serverTimestamp(), ...extra });
await t('aluno reage ao video', assertSucceeds(setDoc(doc(al, 'videos_reacoes/v1_alu'), reac('v1', 'amei'))));
await t('aluno troca a reacao', assertSucceeds(setDoc(doc(al, 'videos_reacoes/v1_alu'), reac('v1', 'meh'))));
await t('aluno le a propria reacao', assertSucceeds(getDoc(doc(al, 'videos_reacoes/v1_alu'))));
await t('aluno nao reage a video so de professor', assertFails(setDoc(doc(al, 'videos_reacoes/v2_alu'), reac('v2', 'amei'))));
await t('reacao invalida', assertFails(setDoc(doc(al, 'videos_reacoes/v1_alu'), reac('v1', 'odiei'))));
await t('reacao fingindo ser professor', assertFails(setDoc(doc(al, 'videos_reacoes/v1_alu'), reac('v1', 'amei', { perfil: 'professor' }))));
await t('reacao em nome de outro', assertFails(setDoc(doc(al, 'videos_reacoes/v1_outro'), reac('v1', 'amei', { uid: 'outro' }))));
await t('aluno nao lista reacoes', assertFails(getDocs(query(collection(al, 'videos_reacoes'), where('video_id', '==', 'v1')))));
await t('jogos para alunos', assertSucceeds(getDocs(query(collection(al, 'jogos'), where('publicado', '==', true), where('para_alunos', '==', true)))));
await t('biblioteca estantes do aluno', assertSucceeds(getDocs(query(collection(al, 'biblioteca'), where('publicado', '==', true), where('secao', 'in', ['aprender', 'gibiteca'])))));
await t('biblioteca inteira', assertFails(getDocs(query(collection(al, 'biblioteca'), where('publicado', '==', true)))));
await t('aluno le historias educativas', assertSucceeds(getDocs(query(collection(al, 'biblioteca'), where('publicado', '==', true), where('secao', '==', 'historias')))));
await t('aluno nao le livro do professor', assertFails(getDoc(doc(al, 'biblioteca/l1'))));
const rl = (l, r, extra = {}) => ({ livro_id: l, uid: 'alu', reacao: r, perfil: 'aluno', em: serverTimestamp(), ...extra });
await t('aluno reage a historia', assertSucceeds(setDoc(doc(al, 'biblioteca_reacoes/h1_alu'), rl('h1', 'amei'))));
await t('aluno troca reacao da historia', assertSucceeds(setDoc(doc(al, 'biblioteca_reacoes/h1_alu'), rl('h1', 'gostei'))));
await t('aluno nao reage a livro do professor', assertFails(setDoc(doc(al, 'biblioteca_reacoes/l1_alu'), rl('l1', 'amei'))));
await t('reacao de livro em nome de outro', assertFails(setDoc(doc(al, 'biblioteca_reacoes/h1_outro'), rl('h1', 'amei', { uid: 'outro' }))));
await t('aluno nao lista reacoes de livros', assertFails(getDocs(query(collection(al, 'biblioteca_reacoes'), where('livro_id', '==', 'h1')))));
await t('livro adulto', assertFails(getDoc(doc(al, 'biblioteca/b1'))));
await t('gibi', assertSucceeds(getDoc(doc(al, 'biblioteca/b2'))));
await t('colorir', assertSucceeds(getDoc(doc(al, 'colorir/c1'))));
await t('acervo datas', assertSucceeds(getDoc(doc(al, 'acervo/x1'))));
await t('acervo atividades', assertFails(getDoc(doc(al, 'acervo/x2'))));
await t('config', assertSucceeds(getDoc(doc(al, 'config/modulos'))));
await t('dica de professor', assertFails(getDoc(doc(al, 'dicas_envios/d1'))));
await t('dica publica de aluno', assertSucceeds(getDoc(doc(al, 'dicas_alunos_pub/p1'))));
await t('aluno nao escreve dica publica', assertFails(setDoc(doc(al, 'dicas_alunos_pub/z'), { titulo: 'x' })));
await t('cadastro de professor', assertFails(getDoc(doc(al, 'usuarios/prof'))));
await t('aluno nao muda o proprio perfil', assertFails(updateDoc(doc(al, 'usuarios/alu'), { perfil: 'professor' })));
await t('aluno nao muda o municipio', assertFails(updateDoc(doc(al, 'usuarios/alu'), { municipio_id: 'm2' })));
await t('dominio proprio', assertSucceeds(getDoc(doc(al, 'dominios_aluno/aluno.ribas.ms.gov.br'))));
await t('dominio alheio', assertFails(getDoc(doc(gm, 'dominios_aluno/aluno.ribas.ms.gov.br'))));
await t('lista de dominios', assertFails(getDocs(collection(al, 'dominios_aluno'))));
const al2 = ctx('alu2', 'x@outra.br');
await t('plano so jogos: videos bloqueado', assertFails(getDocs(query(collection(al2, 'videos'), where('publicado', '==', true), where('para_alunos', '==', true)))));
await t('plano so jogos: jogos liberado', assertSucceeds(getDocs(query(collection(al2, 'jogos'), where('publicado', '==', true), where('para_alunos', '==', true)))));
const al3 = ctx('alu3', 'y@vencida.br');
await t('contrato vencido bloqueia', assertFails(getDoc(doc(al3, 'config/modulos'))));

// ---- Dica do Aluno
const dica = (extra = {}) => ({ tipo: 'curiosidade', titulo: 'Por que o ceu e azul', texto: 'A luz se espalha no ar.', disciplina: '', links: ['https://a.com'],
  autor_uid: 'alu', autor_nome: 'Alu', autor_email: 'alu@aluno.ribas.ms.gov.br', escola_nome: '', municipio_id: 'm1', municipio_nome: 'Ribas', status: 'novo', criado_em: agora(), ...extra });
await t('envia dica', assertSucceeds(setDoc(doc(al, 'dicas_alunos/k1'), dica())));
await t('dica com arquivo', assertFails(setDoc(doc(al, 'dicas_alunos/k2'), dica({ arquivos: [] }))));
await t('dica com 3 links', assertFails(setDoc(doc(al, 'dicas_alunos/k3'), dica({ links: ['a', 'b', 'c'] }))));
await t('dica ja publicada', assertFails(setDoc(doc(al, 'dicas_alunos/k4'), dica({ status: 'publicado' }))));
await t('dica com outro municipio', assertFails(setDoc(doc(al, 'dicas_alunos/k5'), dica({ municipio_id: 'm2' }))));
await t('dica com e-mail de outro', assertFails(setDoc(doc(al, 'dicas_alunos/k6'), dica({ autor_email: 'x@y.com' }))));
await t('aluno nao publica a propria dica', assertFails(updateDoc(doc(al, 'dicas_alunos/k1'), { status: 'publicado' })));
await t('aluno nao envia dica de professor', assertFails(setDoc(doc(al, 'dicas_envios/k7'), { tipo: 'dica', titulo: 'xxxx', texto: '', disciplina: '', etapa: '', links: [], arquivos: [], credito: true, autor_uid: 'alu', autor_nome: '', autor_email: 'alu@aluno.ribas.ms.gov.br', escola_nome: '', municipio_nome: '', status: 'novo', criado_em: agora() })));
await t('professor nao envia dica de aluno', assertFails(setDoc(doc(ctx('prof', 'p@x.com'), 'dicas_alunos/k8'), dica({ autor_uid: 'prof', autor_email: 'p@x.com' }))));

// ---- professor continua igual
const pr = ctx('prof', 'p@x.com');
await t('professor ve todos os videos publicados', assertSucceeds(getDocs(query(collection(pr, 'videos'), where('publicado', '==', true)))));
await t('professor ve a biblioteca toda', assertSucceeds(getDocs(query(collection(pr, 'biblioteca'), where('publicado', '==', true)))));
await t('professor le dica de professor', assertSucceeds(getDoc(doc(pr, 'dicas_envios/d1'))));

// prova online
await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore();
  await setDoc(doc(f, 'provas_online/po1'), { professor_uid: 'prof', alunos_uids: ['alu'], status: 'agendada', fecha_em: Timestamp.fromMillis(Date.now() + 3600000), nota_liberada: false, questoes: [] });
  await setDoc(doc(f, 'provas_online/po2'), { professor_uid: 'prof', alunos_uids: ['alu'], status: 'encerrada', fecha_em: Timestamp.fromMillis(Date.now() - 60000), questoes: [] });
  await setDoc(doc(f, 'provas_online_gab/po1'), { professor_uid: 'prof', gab: { q1: { gab: 1 } } });
  await setDoc(doc(f, 'provas_online/po1/po_tentativas/alu'), { uid: 'alu', status: 'em_andamento', prazo: Timestamp.fromMillis(Date.now() + 3000000), respostas: {}, desvios: 0, avisos_max: 1, eventos: [] });
  await setDoc(doc(f, 'provas_online/po1/po_tentativas/alu2'), { uid: 'alu2', status: 'em_andamento', prazo: Timestamp.fromMillis(Date.now() - 600000), respostas: {}, desvios: 0, avisos_max: 1, eventos: [] });
  await setDoc(doc(f, 'provas_online/po1/po_resultados/alu'), { nota: 5 });
  await setDoc(doc(f, 'provas_online/po2/po_resultados/alu'), { nota: 7 }); });
const poA = ctx('alu', 'alu@aluno.ribas.ms.gov.br'), poA2 = ctx('alu2', 'x@y.com'), poP = ctx('prof', 'prof@x.com');
await t('prova online: aluno da turma le a prova', assertSucceeds(getDoc(doc(poA, 'provas_online/po1'))));
await t('prova online: aluno lista as dele', assertSucceeds(getDocs(query(collection(poA, 'provas_online'), where('alunos_uids', 'array-contains', 'alu')))));
await t('prova online: outro aluno nao le', assertFails(getDoc(doc(poA2, 'provas_online/po1'))));
await t('prova online: aluno nao le gabarito', assertFails(getDoc(doc(poA, 'provas_online_gab/po1'))));
await t('prova online: professor le gabarito', assertSucceeds(getDoc(doc(poP, 'provas_online_gab/po1'))));
await t('prova online: aluno nao cria prova', assertFails(setDoc(doc(poA, 'provas_online/x'), { professor_uid: 'alu' })));
await t('prova online: aluno salva resposta', assertSucceeds(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { 'respostas.q1': 1, atualizado_em: serverTimestamp() })));
await t('prova online: aluno nao muda o prazo', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { prazo: Timestamp.fromMillis(Date.now() + 9e6) })));
await t('prova online: aluno nao se entrega sozinho', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { status: 'entregue' })));
await t('prova online: aluno registra a saida', assertSucceeds(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { desvios: 1 })));
await t('prova online: desvios nao diminuem', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { desvios: 0 })));
await t('prova online: bloqueio so passando dos avisos', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { status: 'bloqueada', desvios: 1 })));
await t('prova online: bloqueio no segundo desvio', assertSucceeds(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { status: 'bloqueada', desvios: 2, bloqueado_em: serverTimestamp() })));
await t('prova online: bloqueado nao responde', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu'), { 'respostas.q1': 2 })));
await t('prova online: sem resposta depois do prazo', assertFails(updateDoc(doc(poA2, 'provas_online/po1/po_tentativas/alu2'), { 'respostas.q1': 2 })));
await t('prova online: aluno nao mexe na tentativa do colega', assertFails(updateDoc(doc(poA, 'provas_online/po1/po_tentativas/alu2'), { 'respostas.q1': 2 })));
await t('prova online: nota escondida antes do fim', assertFails(getDoc(doc(poA, 'provas_online/po1/po_resultados/alu'))));
await t('prova online: nota visivel depois do fim', assertSucceeds(getDoc(doc(poA, 'provas_online/po2/po_resultados/alu'))));
await t('prova online: professor ve a nota', assertSucceeds(getDoc(doc(poP, 'provas_online/po1/po_resultados/alu'))));
await t('prova online: aluno nao grava nota', assertFails(setDoc(doc(poA, 'provas_online/po1/po_resultados/alu'), { nota: 10 })));

console.log(`REGRAS ALUNO: ${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);

// Testa as regras do Firestore dos Aplicativos Úteis (Folha Mágica, Teleprompter e Portal do Educador TV) no emulador.
// Não toca no banco real. No Cloud Shell, na pasta do repositório:
//   mkdir -p /tmp/rt && cp scripts/teste-regras-apps.mjs /tmp/rt/ && (cd /tmp/rt && npm i --silent @firebase/rules-unit-testing@3 firebase@10)
//   firebase emulators:exec --only firestore --project demo-pe5 "node /tmp/rt/teste-regras-apps.mjs $PWD/firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp, writeBatch, increment, deleteField } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
const CH = 'Kq3mZx8LpR2tVw9Yb4Nc', CH2 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg';

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore(); const s = (p, d) => setDoc(doc(db, p), d);
  await s('municipios/m1', { nome: 'Ribas' }); await s('municipios/m2', { nome: 'Outra' });
  await s('escolas/e1', { nome: 'EM Centro', municipio_id: 'm1' }); await s('escolas/e2', { nome: 'EM Vila', municipio_id: 'm1' }); await s('escolas/e9', { nome: 'Longe', municipio_id: 'm2' });
  await s('usuarios/prof', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await s('usuarios/prof2', { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e9', escolas_ids: ['e9'], municipio_id: 'm2' });
  await s('usuarios/gest', { perfil: 'gestor', status: 'ativo', escola_id: 'e2', escolas_ids: ['e2'], municipio_id: 'm1' });
  await s('usuarios/sec', { perfil: 'secretaria', status: 'ativo', municipio_id: 'm1' });
  await s('usuarios/alu', { perfil: 'aluno', status: 'ativo', municipio_id: 'm1' });
  await s('usuarios/venc', { perfil: 'professor', status: 'ativo', licenca_tipo: 'avulsa', licenca_fim: Timestamp.fromMillis(Date.now() - 86400000), municipio_id: null, escola_id: null });
  await s(`tv_telas/${CH}`, { nome: 'TV', escola_id: 'e1', municipio_id: 'm1', playlist_id: 'p1', canal: 'c1' });
  await s('tv_playlists/p1', { nome: 'P', escola_id: 'e1', municipio_id: 'm1', itens: [] });
  await s('tv_canais/c1', { municipio_id: 'm1', avisos: [] });
  await s('tv_pareamentos/ABC234', { chave: CH2, criado_em: Timestamp.now() });
  await s('usuarios/prof/roteiros/r0', { titulo: 'x', texto: 'y', markers: [] });
  await s('usuarios/adm', { perfil: 'admin', status: 'ativo' });
  await s('tv_campanhas/padrao', { itens: [] });
});

let ok = 0, falhas = 0;
async function t(nome, p) { try { await p; ok++; } catch (e) { falhas++; console.log('FALHA:', nome, '-', String(e.message || e).slice(0, 160)); } }
// um contexto por usuário: criar de novo o mesmo usuário reconfigura um Firestore já iniciado
const _ctx = {};
const ctx = uid => _ctx[uid] || (_ctx[uid] = env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore());
const anon = env.unauthenticatedContext().firestore();
const prof = ctx('prof'), prof2 = ctx('prof2'), gest = ctx('gest'), sec = ctx('sec'), alu = ctx('alu'), venc = ctx('venc');

// ---------- Folha Mágica
const folha = { nome: 'Pauta', tipo: 'music', cfg: { type: 'music' }, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('professor salva folha', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/folhas/f1'), folha)));
await t('folha com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/folhas/f2'), { ...folha, x: 1 })));
await t('folha na conta de outro', assertFails(setDoc(doc(prof2, 'usuarios/prof/folhas/f3'), folha)));
await t('outro nao le minhas folhas', assertFails(getDoc(doc(prof2, 'usuarios/prof/folhas/f1'))));
await t('licenca vencida nao grava folha', assertFails(setDoc(doc(venc, 'usuarios/venc/folhas/f1'), folha)));
await t('gestor salva folha', assertSucceeds(setDoc(doc(gest, 'usuarios/gest/folhas/f1'), folha)));
await t('aluno nao salva folha', assertFails(setDoc(doc(alu, 'usuarios/alu/folhas/f1'), folha)));

// Notas e Medias
const regra = { periodos: 4, pesos: [1, 1, 1, 1], media_minima: 6, nota_max: 10, arredondamento: 'decimo', composicao: 'media', rec_periodo: 'maior', rec_final: true,
  peso_media: 1, peso_exame: 1, media_final_minima: 5, freq_minima: 75, atualizado_em: serverTimestamp(), atualizado_por: 'sec' };
await t('secretaria define a regra do municipio', assertSucceeds(setDoc(doc(sec, 'notas_regras/m1'), regra)));
await t('secretaria nao define regra de outro municipio', assertFails(setDoc(doc(sec, 'notas_regras/m2'), regra)));
await t('professor nao altera a regra', assertFails(setDoc(doc(prof, 'notas_regras/m1'), regra)));
await t('regra com pesos errados', assertFails(setDoc(doc(sec, 'notas_regras/m1'), { ...regra, pesos: [1, 1] })));
await t('regra com media acima da escala', assertFails(setDoc(doc(sec, 'notas_regras/m1'), { ...regra, media_minima: 11 })));
await t('professor do municipio le a regra', assertSucceeds(getDoc(doc(prof, 'notas_regras/m1'))));
await t('professor de outro municipio nao le', assertFails(getDoc(doc(prof2, 'notas_regras/m1'))));
const plan = { professor_uid: 'prof', professor_nome: 'P', escola_id: 'e1', municipio_id: 'm1', turma_id: 't1', turma_nome: '5A', disciplina: 'Matemática', ano_letivo: 2026,
  avaliacoes: [{ id: 'x', periodo: 1, nome: 'Prova', peso: 1, max: 10, tipo: 'nota' }], notas: { a1: { x: 7.5 } }, faltas: {}, aulas: { 1: 40 }, exame: {}, conselho: {}, atualizado_em: serverTimestamp() };
await t('professor salva planilha de notas', assertSucceeds(setDoc(doc(prof, 'notas_planilhas/prof_t1_matematica_2026'), plan)));
await t('planilha com id de outro dono', assertFails(setDoc(doc(prof, 'notas_planilhas/gest_t1_matematica_2026'), plan)));
await t('planilha em nome de outro', assertFails(setDoc(doc(prof2, 'notas_planilhas/prof2_t1_x_2026'), plan)));
await t('planilha com campo extra', assertFails(setDoc(doc(prof, 'notas_planilhas/prof_t1_y_2026'), { ...plan, x: 1 })));
await t('licenca vencida nao salva planilha', assertFails(setDoc(doc(venc, 'notas_planilhas/venc_t1_matematica_2026'), { ...plan, professor_uid: 'venc' })));
await t('dono lista as proprias planilhas', assertSucceeds(getDocs(query(collection(prof, 'notas_planilhas'), where('professor_uid', '==', 'prof')))));
await t('outro professor nao le a planilha', assertFails(getDoc(doc(prof2, 'notas_planilhas/prof_t1_matematica_2026'))));
await t('secretaria do municipio le a planilha', assertSucceeds(getDoc(doc(sec, 'notas_planilhas/prof_t1_matematica_2026'))));
await t('gestor de outra escola nao le', assertFails(getDoc(doc(gest, 'notas_planilhas/prof_t1_matematica_2026'))));
await t('aluno nao le notas', assertFails(getDoc(doc(alu, 'notas_planilhas/prof_t1_matematica_2026'))));

// Turma na Lousa
const lousa = { turma_nome: '5 Ano A', nomes: [], sorteados: ['a1', 'a2'], ausentes: { dia: '2026-10-24', ids: [] },
  grupos: { modo: 'qtd', num: 4, lista: [{ ids: ['a1', 'a2'] }] }, mapa: { linhas: 5, colunas: 6, lugares: { '0_0': 'a1' }, fundo: false },
  placar: { modo: 'equipes', equipes: [{ nome: 'Equipe 1', pontos: 3 }], alunos: {} }, atualizado_em: serverTimestamp() };
await t('professor salva turma na lousa', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/turma_lousa/t1'), lousa)));
await t('turma na lousa com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/turma_lousa/t2'), { ...lousa, x: 1 })));
await t('turma na lousa com lista enorme', assertFails(setDoc(doc(prof, 'usuarios/prof/turma_lousa/t3'), { ...lousa, nomes: Array(81).fill('a') })));
await t('turma na lousa na conta de outro', assertFails(setDoc(doc(prof2, 'usuarios/prof/turma_lousa/t1'), lousa)));
await t('outro nao le minha turma na lousa', assertFails(getDoc(doc(prof2, 'usuarios/prof/turma_lousa/t1'))));
await t('dono le turma na lousa', assertSucceeds(getDoc(doc(prof, 'usuarios/prof/turma_lousa/t1'))));
await t('gestor salva turma na lousa', assertSucceeds(setDoc(doc(gest, 'usuarios/gest/turma_lousa/manual'), lousa)));
await t('aluno nao salva turma na lousa', assertFails(setDoc(doc(alu, 'usuarios/alu/turma_lousa/t1'), lousa)));

// ---------- Teleprompter
const rot = { titulo: 'Aula', texto: 'Texto', settings: {}, markers: [], locked: false, cursor: 0, elapsed: 0, palavras: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('professor salva roteiro', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/roteiros/r1'), rot)));
await t('roteiro grande demais', assertFails(setDoc(doc(prof, 'usuarios/prof/roteiros/r2'), { ...rot, texto: 'a'.repeat(200001) })));
await t('roteiro com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/roteiros/r3'), { ...rot, dono: 'x' })));
await t('outro nao le roteiro', assertFails(getDoc(doc(prof2, 'usuarios/prof/roteiros/r0'))));
await t('dono apaga roteiro', assertSucceeds(deleteDoc(doc(prof, 'usuarios/prof/roteiros/r0'))));
const TK = 'AbCdEfGhJkMnPqRsTuVwXyZ2';
await t('computador cria sessao do controle', assertSucceeds(setDoc(doc(prof, `tele_sessoes/${TK}`), { dono: 'prof', ativo: true, titulo: 'Aula', bloco: 1 })));
await t('sessao em nome de outro', assertFails(setDoc(doc(prof2, 'tele_sessoes/ZyXwVuTsRqPnMkJhGfEdCbA2'), { dono: 'prof', ativo: true })));
await t('chave curta', assertFails(setDoc(doc(prof, 'tele_sessoes/curta'), { dono: 'prof', ativo: true })));
await t('aluno nao cria sessao', assertFails(setDoc(doc(alu, 'tele_sessoes/AaAaAaAaAaAaAaAaAaAaAaA2'), { dono: 'alu', ativo: true })));
await t('celular le a sessao sem login', assertSucceeds(getDoc(doc(anon, `tele_sessoes/${TK}`))));
await t('celular manda comando sem login', assertSucceeds(addDoc(collection(anon, `tele_sessoes/${TK}/cmd`), { acao: 'proximo', em: serverTimestamp() })));
await t('comando desconhecido', assertFails(addDoc(collection(anon, `tele_sessoes/${TK}/cmd`), { acao: 'apagar_tudo', em: serverTimestamp() })));
await t('comando com campo extra', assertFails(addDoc(collection(anon, `tele_sessoes/${TK}/cmd`), { acao: 'proximo', em: serverTimestamp(), x: 1 })));
await t('anonimo nao le comandos', assertFails(getDocs(collection(anon, `tele_sessoes/${TK}/cmd`))));
await t('dono le comandos', assertSucceeds(getDocs(collection(prof, `tele_sessoes/${TK}/cmd`))));
await t('celular nao altera a sessao', assertFails(updateDoc(doc(anon, `tele_sessoes/${TK}`), { bloco: 9 })));
await t('outro professor nao altera a sessao', assertFails(updateDoc(doc(prof2, `tele_sessoes/${TK}`), { bloco: 9 })));
await t('dono atualiza a sessao', assertSucceeds(updateDoc(doc(prof, `tele_sessoes/${TK}`), { bloco: 2 })));
await t('controle desligado nao recebe comando', assertSucceeds(updateDoc(doc(prof, `tele_sessoes/${TK}`), { ativo: false })));
await t('comando para sessao desligada', assertFails(addDoc(collection(anon, `tele_sessoes/${TK}/cmd`), { acao: 'proximo', em: serverTimestamp() })));
await t('anonimo nao lista sessoes', assertFails(getDocs(collection(anon, 'tele_sessoes'))));
await t('dono encerra a sessao', assertSucceeds(deleteDoc(doc(prof, `tele_sessoes/${TK}`))));

// ---------- TV: pareamento (a TV não tem login)
const par = cod => ({ chave: CH2, criado_em: serverTimestamp(), orientacao: 'h', resolucao: '1920x1080' });
await t('tv cria codigo sem login', assertSucceeds(setDoc(doc(anon, 'tv_pareamentos/XYZ789'), par())));
await t('tv nao sobrescreve codigo existente', assertFails(setDoc(doc(anon, 'tv_pareamentos/ABC234'), par())));
await t('codigo fora do alfabeto', assertFails(setDoc(doc(anon, 'tv_pareamentos/ABC10O'), par())));
await t('chave curta', assertFails(setDoc(doc(anon, 'tv_pareamentos/QWE234'), { ...par(), chave: 'abc' })));
await t('anonimo nao le codigo', assertFails(getDoc(doc(anon, 'tv_pareamentos/ABC234'))));
await t('aluno nao le codigo', assertFails(getDoc(doc(alu, 'tv_pareamentos/ABC234'))));
await t('professor le codigo', assertSucceeds(getDoc(doc(prof, 'tv_pareamentos/ABC234'))));

// ---------- TV: telas
const tela = (esc, m) => ({ nome: 'TV pátio', escola_id: esc, municipio_id: m, orientacao: 'v', playlist_id: 'p1', agenda: {}, canal: 'c1', criado_em: serverTimestamp() });
await t('professor conecta tv da escola', assertSucceeds(setDoc(doc(prof, `tv_telas/${CH2}`), tela('e1', 'm1'))));
await t('municipio errado na tela', assertFails(setDoc(doc(prof, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e1', 'm2'))));
await t('professor nao conecta tv de outra escola', assertFails(setDoc(doc(prof, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e2', 'm1'))));
await t('gestor conecta tv da escola dele', assertSucceeds(setDoc(doc(gest, 'tv_telas/Zz9Yy8Xx7Ww6Vv5Uu4Tt'), tela('e2', 'm1'))));
await t('secretaria conecta tv do municipio', assertSucceeds(setDoc(doc(sec, 'tv_telas/Qq1Ww2Ee3Rr4Tt5Yy6Uu'), tela('e1', 'm1'))));
await t('chave fora do padrao', assertFails(setDoc(doc(prof, 'tv_telas/curta'), tela('e1', 'm1'))));
await t('tv le a propria tela sem login', assertSucceeds(getDoc(doc(anon, `tv_telas/${CH}`))));
await t('anonimo nao lista telas', assertFails(getDocs(collection(anon, 'tv_telas'))));
await t('professor lista telas da escola', assertSucceeds(getDocs(query(collection(prof, 'tv_telas'), where('escola_id', '==', 'e1'), where('municipio_id', '==', 'm1')))));
await t('professor nao lista telas de outra escola', assertFails(getDocs(query(collection(prof, 'tv_telas'), where('escola_id', '==', 'e2'), where('municipio_id', '==', 'm1')))));
await t('secretaria lista telas de escola do municipio', assertSucceeds(getDocs(query(collection(sec, 'tv_telas'), where('escola_id', '==', 'e2'), where('municipio_id', '==', 'm1')))));
await t('tv manda batimento', assertSucceeds(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: serverTimestamp(), resolucao: '1920x1080', aparelho: 'tv-5.0' })));
await t('tv nao troca a playlist sozinha', assertFails(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: serverTimestamp(), playlist_id: 'p9' })));
await t('tv nao inventa horario', assertFails(updateDoc(doc(anon, `tv_telas/${CH}`), { visto_em: Timestamp.fromMillis(1), resolucao: 'x', aparelho: 'y' })));
await t('professor configura tela', assertSucceeds(updateDoc(doc(prof, `tv_telas/${CH}`), { nome: 'TV da entrada', orientacao: 'h' })));
await t('nao muda a tela de escola', assertFails(updateDoc(doc(prof, `tv_telas/${CH}`), { escola_id: 'e2' })));
await t('outro municipio nao configura', assertFails(updateDoc(doc(prof2, `tv_telas/${CH}`), { nome: 'x' })));
await t('aluno nao configura', assertFails(updateDoc(doc(alu, `tv_telas/${CH}`), { nome: 'x' })));

// ---------- TV: playlists
const pl = (esc, m, n = 1) => ({ nome: 'Manhã', escola_id: esc, municipio_id: m, itens: Array.from({ length: n }, (_, i) => ({ id: 'i' + i, tipo: 'texto', titulo: 'Aviso' })), criado_em: serverTimestamp(), atualizado_em: serverTimestamp(), atualizado_por: 'prof' });
await t('professor cria playlist', assertSucceeds(addDoc(collection(prof, 'tv_playlists'), pl('e1', 'm1'))));
await t('playlist acima de 80 itens', assertFails(addDoc(collection(prof, 'tv_playlists'), pl('e1', 'm1', 81))));
await t('playlist de outra escola', assertFails(addDoc(collection(prof, 'tv_playlists'), pl('e2', 'm1'))));
await t('tv le playlist sem login', assertSucceeds(getDoc(doc(anon, 'tv_playlists/p1'))));
await t('anonimo nao lista playlists', assertFails(getDocs(collection(anon, 'tv_playlists'))));
await t('professor edita playlist', assertSucceeds(updateDoc(doc(prof, 'tv_playlists/p1'), { itens: [{ id: 'a', tipo: 'texto' }] })));
await t('outro municipio nao edita playlist', assertFails(updateDoc(doc(prof2, 'tv_playlists/p1'), { itens: [] })));

// ---------- TV: comunicados da secretaria
await t('tv le canal sem login', assertSucceeds(getDoc(doc(anon, 'tv_canais/c1'))));
await t('anonimo nao lista canais', assertFails(getDocs(collection(anon, 'tv_canais'))));
await t('secretaria publica comunicado', assertSucceeds(updateDoc(doc(sec, 'tv_canais/c1'), { avisos: [{ id: 'a1', titulo: 'Matrículas' }] })));
await t('professor nao publica comunicado', assertFails(updateDoc(doc(prof, 'tv_canais/c1'), { avisos: [] })));
await t('gestor nao publica comunicado', assertFails(updateDoc(doc(gest, 'tv_canais/c1'), { avisos: [] })));
await t('professor cria canal vazio do municipio', assertSucceeds(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm1', avisos: [], criado_em: serverTimestamp() })));
await t('canal ja nasce com aviso', assertFails(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm1', avisos: [{ id: 'x' }] })));
await t('canal de outro municipio', assertFails(addDoc(collection(prof, 'tv_canais'), { municipio_id: 'm2', avisos: [] })));
await t('professor lista canal do municipio', assertSucceeds(getDocs(query(collection(prof, 'tv_canais'), where('municipio_id', '==', 'm1')))));
await t('mais de 30 comunicados', assertFails(updateDoc(doc(sec, 'tv_canais/c1'), { avisos: Array.from({ length: 31 }, (_, i) => ({ id: 'a' + i })) })));

// ---------- TV: campanhas do Portal do Educador
await t('tv le campanhas sem login', assertSucceeds(getDoc(doc(anon, 'tv_campanhas/padrao'))));
await t('professor nao edita campanhas', assertFails(setDoc(doc(prof, 'tv_campanhas/padrao'), { itens: [] })));
await t('secretaria nao edita campanhas', assertFails(setDoc(doc(sec, 'tv_campanhas/padrao'), { itens: [] })));
await t('administrador edita campanhas', assertSucceeds(setDoc(doc(ctx('adm'), 'tv_campanhas/padrao'), { itens: [{ id: 'c1', titulo: 'Dengue' }] })));
await t('anonimo nao lista campanhas', assertFails(getDocs(collection(anon, 'tv_campanhas'))));

// ---------- Recursos da escola
const QA = 'Rr1Ss2Tt3Uu4Vv5Ww6Xx', QB = 'Hh1Jj2Kk3Mm4Nn5Pp6Qq';
const item = (esc, m, qr, extra = {}) => ({ escola_id: esc, municipio_id: m, nome: 'Carrinho 1', tipo: 'carrinho', local: 'Sala 3', patrimonio: 'NPC-2500', serie: '', marca: 'Samsung', modelo: 'XE310',
  origem: 'prefeitura', contrato_id: '', entregue_em: '', garantia_ate: '2027-01-31', situacao: 'em_uso', reservavel: true, obs: '', qr, criado_em: serverTimestamp(), criado_por: 'gest', atualizado_em: serverTimestamp(), atualizado_por: 'gest', ...extra });
const qrDoc = (esc, m, it) => ({ item_id: it, escola_id: esc, municipio_id: m, escola_nome: 'EM Vila', nome: 'Carrinho 1', tipo: 'carrinho', local: 'Sala 3', patrimonio: 'NPC-2500', chamado_aberto: null, chamado_status: '', chamado_conf: 0 });
async function criarItem(db, id, qr, esc = 'e2', m = 'm1', extra) { const b = writeBatch(db); b.set(doc(db, `rec_itens/${id}`), item(esc, m, qr, extra)); b.set(doc(db, `rec_qr/${qr}`), qrDoc(esc, m, id)); return b.commit(); }
await t('gestor cadastra recurso com etiqueta', assertSucceeds(criarItem(gest, 'i1', QA)));
await t('professor nao cadastra recurso', assertFails(criarItem(prof, 'i2', QB, 'e1')));
await t('gestor nao cadastra em outra escola', assertFails(criarItem(gest, 'i2', QB, 'e1')));
await t('municipio errado no recurso', assertFails(criarItem(gest, 'i2', QB, 'e2', 'm2')));
await t('etiqueta apontando para outro recurso', assertFails(setDoc(doc(gest, `rec_qr/${QB}`), qrDoc('e2', 'm1', 'i1'))));
await t('gestor nao liga recurso a contrato', assertFails(criarItem(gest, 'i2', QB, 'e2', 'm1', { contrato_id: 'ct1' })));
await t('situacao invalida', assertFails(criarItem(gest, 'i2', QB, 'e2', 'm1', { situacao: 'sumiu' })));
await t('administrador cadastra recurso com contrato', assertSucceeds(criarItem(ctx('adm'), 'i3', QB, 'e1', 'm1', { reservavel: false, nome: 'Chromebook 01', origem: 'newpc', contrato_id: 'ct1' })));
await t('qualquer um le a etiqueta', assertSucceeds(getDoc(doc(anon, `rec_qr/${QA}`))));
await t('anonimo nao lista etiquetas', assertFails(getDocs(collection(anon, 'rec_qr'))));
await t('professor da escola lista recursos', assertSucceeds(getDocs(query(collection(prof, 'rec_itens'), where('escola_id', '==', 'e1')))));
await t('professor de fora nao lista recursos', assertFails(getDocs(query(collection(prof2, 'rec_itens'), where('escola_id', '==', 'e1')))));
await t('gestor edita recurso', assertSucceeds(updateDoc(doc(gest, 'rec_itens/i1'), { local: 'Biblioteca', atualizado_em: serverTimestamp() })));
await t('gestor nao troca a etiqueta do recurso', assertFails(updateDoc(doc(gest, 'rec_itens/i1'), { qr: QB })));
await t('gestor muda situacao', assertSucceeds(updateDoc(doc(gest, 'rec_itens/i1'), { situacao: 'manutencao' })));
await t('gestor nao transfere de escola', assertFails(updateDoc(doc(gest, 'rec_itens/i1'), { escola_id: 'e1' })));
await t('gestor nao muda contrato', assertFails(updateDoc(doc(gest, 'rec_itens/i1'), { contrato_id: 'ct1' })));
const mov = (uid, extra = {}) => ({ tipo: 'situacao', de: 'Em uso', para: 'Em manutenção', obs: '', por: uid, por_nome: 'G', em: serverTimestamp(), ...extra });
await t('gestor registra movimentacao', assertSucceeds(addDoc(collection(gest, 'rec_itens/i1/mov'), mov('gest'))));
await t('movimentacao em nome de outro', assertFails(addDoc(collection(gest, 'rec_itens/i1/mov'), mov('adm'))));
await t('professor nao registra movimentacao', assertFails(addDoc(collection(prof, 'rec_itens/i3/mov'), mov('prof'))));
await t('ninguem edita movimentacao', assertFails((async () => { const r = await addDoc(collection(gest, 'rec_itens/i1/mov'), mov('gest')); await updateDoc(r, { obs: 'x' }); })()));
await t('gestor le movimentacao', assertSucceeds(getDocs(collection(gest, 'rec_itens/i1/mov'))));
await t('professor de fora nao le movimentacao', assertFails(getDocs(collection(prof2, 'rec_itens/i1/mov'))));
// contratos
const contrato = { municipio_id: 'm1', numero: '012/2025', tipo: 'locacao', processo: '', objeto: 'Chromebooks', inicio: '2025-01-01', fim: '2026-12-31', sla_atendimento_h: 24, sla_solucao_h: 72, renovacoes: [], obs: '', criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('administrador cria contrato', assertSucceeds(setDoc(doc(ctx('adm'), 'rec_contratos/ct1'), contrato)));
await t('gestor nao cria contrato', assertFails(setDoc(doc(gest, 'rec_contratos/ct2'), contrato)));
await t('secretaria nao edita contrato', assertFails(updateDoc(doc(sec, 'rec_contratos/ct1'), { fim: '2030-01-01' })));
await t('gestor do municipio le contratos', assertSucceeds(getDocs(query(collection(gest, 'rec_contratos'), where('municipio_id', '==', 'm1')))));
await t('professor de outro municipio nao le contratos', assertFails(getDocs(query(collection(prof2, 'rec_contratos'), where('municipio_id', '==', 'm1')))));
await t('anonimo nao le contratos', assertFails(getDoc(doc(anon, 'rec_contratos/ct1'))));
// transferencia pela NEWPC
{ const a = ctx('adm'), b = writeBatch(a); b.update(doc(a, 'rec_itens/i3'), { escola_id: 'e2', municipio_id: 'm1', local: 'Sala 1' }); b.update(doc(a, `rec_qr/${QB}`), { escola_id: 'e2', escola_nome: 'EM Vila' });
  await t('administrador transfere de escola', assertSucceeds(b.commit())); }
await t('transferencia com municipio errado', assertFails(updateDoc(doc(ctx('adm'), 'rec_itens/i3'), { escola_id: 'e9', municipio_id: 'm1' })));
// estoque do municipio (sem escola) e busca por patrimonio e serie
const QE = 'Ee1Ee2Ee3Ee4Ee5Ee6Ee', QF = 'Ff1Ff2Ff3Ff4Ff5Ff6Ff';
await t('gestor nao cria item no estoque', assertFails(criarItem(gest, 'est1', QE, '', 'm1')));
await t('estoque em municipio inexistente', assertFails(criarItem(ctx('adm'), 'est1', QE, '', 'mX')));
await t('administrador cria item no estoque', assertSucceeds(criarItem(ctx('adm'), 'est1', QE, '', 'm1', { situacao: 'estoque', patrimonio: 'NPC-3001', serie: 'SN3001' })));
await t('secretaria le o estoque do municipio', assertSucceeds(getDocs(query(collection(sec, 'rec_itens'), where('municipio_id', '==', 'm1')))));
await t('gestor nao mexe no estoque', assertFails(updateDoc(doc(gest, 'rec_itens/est1'), { local: 'x' })));
const busca = (qr, extra = {}) => ({ itens: { [qr]: { n: 'Notebook', e: 'Estoque', p: 'NPC-3001', s: 'SN3001' } }, ultimo: qr, ...extra });
await t('administrador indexa patrimonio', assertSucceeds(setDoc(doc(ctx('adm'), 'rec_busca/NPC3001'), busca(QE), { merge: true })));
await t('anonimo busca por patrimonio', assertSucceeds(getDoc(doc(anon, 'rec_busca/NPC3001'))));
await t('anonimo nao grava busca', assertFails(setDoc(doc(anon, 'rec_busca/XYZ1'), busca(QE))));
await t('anonimo nao lista busca', assertFails(getDocs(collection(anon, 'rec_busca'))));
await t('chave de busca fora do padrao', assertFails(setDoc(doc(ctx('adm'), 'rec_busca/npc-3001'), busca(QE))));
await t('gestor nao indexa equipamento de outra escola', assertFails(setDoc(doc(gest, 'rec_busca/SN3001'), busca(QE))));
await t('gestor indexa equipamento da escola dele', assertSucceeds(setDoc(doc(gest, 'rec_busca/NPC3001'), busca(QA, { ultimo: QA, itens: { [QA]: { n: 'Carrinho', e: 'EM Vila', p: 'NPC-3001', s: '' } } }), { merge: true })));
await t('gestor nao apaga entrada de outra escola', assertFails(setDoc(doc(gest, 'rec_busca/NPC3001'), { itens: { [QE]: deleteField() }, ultimo: QE }, { merge: true })));
await t('gestor nao mexe em duas entradas de uma vez', assertFails(setDoc(doc(gest, 'rec_busca/NPC3001'), { itens: { [QE]: deleteField(), [QA]: { n: 'x' } }, ultimo: QA }, { merge: true })));
await t('gestor remove a entrada da escola dele', assertSucceeds(setDoc(doc(gest, 'rec_busca/NPC3001'), { itens: { [QA]: deleteField() }, ultimo: QA }, { merge: true })));
// entrega do estoque para a escola
{ const a = ctx('adm'), b = writeBatch(a);
  b.update(doc(a, 'rec_itens/est1'), { escola_id: 'e2', municipio_id: 'm1', local: 'Carrinho 2', situacao: 'em_uso', entregue_em: '2026-10-24' });
  b.update(doc(a, `rec_qr/${QE}`), { escola_id: 'e2', municipio_id: 'm1', escola_nome: 'EM Vila', local: 'Carrinho 2' });
  b.set(doc(a, 'rec_itens/est1/mov/m1'), { tipo: 'transferencia', de: 'Estoque', para: 'EM Vila', obs: 'Entrega', por: 'adm', por_nome: 'A', em: serverTimestamp() });
  b.set(doc(a, 'rec_busca/NPC3001'), { itens: { [QE]: { n: 'Notebook', e: 'EM Vila', p: 'NPC-3001', s: 'SN3001' } }, ultimo: QE }, { merge: true });
  await t('administrador entrega do estoque para a escola', assertSucceeds(b.commit())); }
await t('depois da entrega o gestor cuida do item', assertSucceeds(updateDoc(doc(gest, 'rec_itens/est1'), { local: 'Sala 4' })));

// cartaz da escola
const PUB = 'Pp1Pp2Pp3Pp4Pp5Pp6Pp';
async function cartaz(db, esc, chave) { const b = writeBatch(db); b.set(doc(db, `rec_config/${esc}`), { chave_pub: chave, atualizado_em: serverTimestamp(), atualizado_por: 'x' }, { merge: true });
  b.set(doc(db, `rec_pub/${chave}`), { escola_id: esc, municipio_id: 'm1', escola_nome: 'EM Vila', itens: [{ q: QA, n: 'Carrinho 1', l: 'Sala 3', p: 'NPC-2500', t: 'carrinho' }], atualizado_em: serverTimestamp() }); return b.commit(); }
await t('professor nao publica cartaz', assertFails(cartaz(prof, 'e1', 'Zz9Zz8Zz7Zz6Zz5Zz4Zz')));
await t('gestor publica cartaz da escola', assertSucceeds(cartaz(gest, 'e2', PUB)));
await t('cartaz com chave diferente da escola', assertFails(setDoc(doc(gest, 'rec_pub/Qq9Qq8Qq7Qq6Qq5Qq4Qq'), { escola_id: 'e2', municipio_id: 'm1', escola_nome: 'x', itens: [], atualizado_em: serverTimestamp() })));
await t('qualquer um le o cartaz', assertSucceeds(getDoc(doc(anon, `rec_pub/${PUB}`))));
await t('anonimo nao lista cartazes', assertFails(getDocs(collection(anon, 'rec_pub'))));
await t('anonimo nao altera cartaz', assertFails(updateDoc(doc(anon, `rec_pub/${PUB}`), { itens: [] })));
// chamado sem login
const ch = (qr, it, esc = 'e2', extra = {}) => ({ qr, item_id: it, escola_id: esc, municipio_id: 'm1', item_nome: 'Carrinho 1', patrimonio: 'NPC-2500', local: 'Sala 3', problema: 'Não liga', descricao: 'tela preta', nome: 'Ana', funcao: 'Professor(a)', contato: '', status: 'aberto', criado_em: serverTimestamp(), ...extra });
async function abrir(db, id, qr, it, esc, extra) { const b = writeBatch(db); b.set(doc(db, `rec_chamados/${id}`), ch(qr, it, esc, extra)); b.update(doc(db, `rec_qr/${qr}`), { chamado_aberto: id, chamado_status: 'aberto', chamado_desde: serverTimestamp(), chamado_conf: 1 }); return b.commit(); }
await t('chamado sem marcar a etiqueta', assertFails(setDoc(doc(anon, 'rec_chamados/c0'), ch(QA, 'i1'))));
await t('chamado com escola trocada', assertFails(abrir(anon, 'c0', QA, 'i1', 'e1')));
await t('chamado com campo extra', assertFails(abrir(anon, 'c0', QA, 'i1', 'e2', { x: 1 })));
await t('anonimo abre chamado pela etiqueta', assertSucceeds(abrir(anon, 'c1', QA, 'i1')));
await t('segundo chamado no mesmo equipamento', assertFails(abrir(anon, 'c2', QA, 'i1')));
await t('anonimo confirma aconteceu comigo', assertSucceeds(updateDoc(doc(anon, `rec_qr/${QA}`), { chamado_conf: increment(1) })));
await t('anonimo nao pula contagem', assertFails(updateDoc(doc(anon, `rec_qr/${QA}`), { chamado_conf: 50 })));
await t('anonimo nao fecha chamado', assertFails(updateDoc(doc(anon, `rec_qr/${QA}`), { chamado_aberto: null })));
await t('anonimo nao muda nome da etiqueta', assertFails(updateDoc(doc(anon, `rec_qr/${QA}`), { nome: 'x' })));
await t('anonimo nao le chamados', assertFails(getDoc(doc(anon, 'rec_chamados/c1'))));
await t('gestor lista chamados da escola', assertSucceeds(getDocs(query(collection(gest, 'rec_chamados'), where('escola_id', '==', 'e2')))));
await t('secretaria lista chamados do municipio', assertSucceeds(getDocs(query(collection(sec, 'rec_chamados'), where('municipio_id', '==', 'm1')))));
await t('professor nao atende chamado de outra escola', assertFails(updateDoc(doc(prof, 'rec_chamados/c1'), { status: 'resolvido' })));
{ const b = writeBatch(gest); b.update(doc(gest, 'rec_chamados/c1'), { status: 'resolvido', resposta: 'trocado carregador', confirmacoes: 2, atendido_por: 'gest', atendido_nome: 'G', atualizado_em: serverTimestamp(), atendimento_em: serverTimestamp(), resolvido_em: serverTimestamp() });
  b.update(doc(gest, `rec_qr/${QA}`), { chamado_aberto: null, chamado_status: '', chamado_conf: 0 });
  await t('gestor resolve e libera a etiqueta', assertSucceeds(b.commit())); }
await t('depois de resolvido abre novo chamado', assertSucceeds(abrir(anon, 'c3', QA, 'i1')));
// reservas
const res = (it, d, tu, a, uid = 'prof', esc = 'e1', extra = {}) => ({ item_id: it, item_nome: 'Carrinho', escola_id: esc, municipio_id: 'm1', data: d, turno: tu, aula: a, uid, nome: 'Prof', turma: '5A', atividade: '', criado_em: serverTimestamp(), ...extra });
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'rec_itens/i4'), item('e1', 'm1', 'Zz1Zz2Zz3Zz4Zz5Zz6Zz')); });
await t('professor reserva aula', assertSucceeds(setDoc(doc(prof, 'rec_reservas/i4_2026-11-03_M_2'), res('i4', '2026-11-03', 'M', 2))));
await t('mesma aula ja reservada', assertFails(setDoc(doc(gest, 'rec_reservas/i4_2026-11-03_M_2'), res('i4', '2026-11-03', 'M', 2, 'gest'))));
await t('dono nao sobrescreve a reserva', assertFails(setDoc(doc(prof, 'rec_reservas/i4_2026-11-03_M_2'), res('i4', '2026-11-03', 'M', 2))));
await t('id da reserva nao confere', assertFails(setDoc(doc(prof, 'rec_reservas/i4_2026-11-03_M_3'), res('i4', '2026-11-03', 'M', 2))));
await t('reserva em nome de outro', assertFails(setDoc(doc(prof, 'rec_reservas/i4_2026-11-03_M_4'), res('i4', '2026-11-03', 'M', 4, 'gest'))));
await t('recurso nao reservavel', assertFails(setDoc(doc(ctx('adm'), 'rec_reservas/i3_2026-11-03_M_1'), res('i3', '2026-11-03', 'M', 1, 'adm'))));
await t('professor de fora nao reserva', assertFails(setDoc(doc(prof2, 'rec_reservas/i4_2026-11-03_M_5'), res('i4', '2026-11-03', 'M', 5, 'prof2'))));
await t('licenca vencida nao reserva', assertFails(setDoc(doc(venc, 'rec_reservas/i4_2026-11-03_M_5'), res('i4', '2026-11-03', 'M', 5, 'venc'))));
await t('professor lista reservas do dia', assertSucceeds(getDocs(query(collection(prof, 'rec_reservas'), where('escola_id', '==', 'e1'), where('data', '==', '2026-11-03')))));
await t('professor lista as proprias reservas', assertSucceeds(getDocs(query(collection(prof, 'rec_reservas'), where('uid', '==', 'prof')))));
await t('outro professor nao cancela', assertFails(deleteDoc(doc(prof2, 'rec_reservas/i4_2026-11-03_M_2'))));
await t('dono cancela a reserva', assertSucceeds(deleteDoc(doc(prof, 'rec_reservas/i4_2026-11-03_M_2'))));
await t('gestor configura horarios', assertSucceeds(setDoc(doc(gest, 'rec_config/e2'), { turnos: [{ id: 'M', n: 5, horarios: [] }], atualizado_em: serverTimestamp(), atualizado_por: 'gest' }, { merge: true })));
await t('professor nao configura horarios', assertFails(setDoc(doc(prof, 'rec_config/e1'), { turnos: [] })));
await t('professor le horarios da escola', assertSucceeds(getDoc(doc(prof, 'rec_config/e1'))));
await t('gestor exclui recurso', assertSucceeds((async () => { const b = writeBatch(gest); b.delete(doc(gest, 'rec_itens/i1')); b.delete(doc(gest, `rec_qr/${QA}`)); await b.commit(); })()));

await t('anonimo abre chamado de item entregue', assertSucceeds(abrir(anon, 'cE', QE, 'est1')));
// respostas das Avaliacoes: so o dono da prova, o gestor da escola e a secretaria do municipio
await env.withSecurityRulesDisabled(async (c) => { const d = c.firestore();
  await setDoc(doc(d, 'avaliacoes/avP'), { professor_uid: 'prof', turma_id: 't1', escola_id: 'e2', municipio_id: 'm1' });
  await setDoc(doc(d, 'respostas/rP'), { avaliacao_id: 'avP', escola_id: 'e2', municipio_id: 'm1', aluno_id: 'a1', nota_final: 7 }); });
await t('dono le respostas da prova', assertSucceeds(getDocs(query(collection(prof, 'respostas'), where('avaliacao_id', '==', 'avP')))));
await t('outro professor nao le respostas', assertFails(getDocs(query(collection(prof2, 'respostas'), where('avaliacao_id', '==', 'avP')))));
await t('outro professor nao abre resposta', assertFails(getDoc(doc(prof2, 'respostas/rP'))));
await t('professor nao lista todas as respostas', assertFails(getDocs(collection(prof, 'respostas'))));
await t('gestor da escola le respostas', assertSucceeds(getDocs(query(collection(gest, 'respostas'), where('avaliacao_id', '==', 'avP')))));
await t('secretaria le resposta da rede', assertSucceeds(getDoc(doc(sec, 'respostas/rP'))));
await t('dono corrige a resposta', assertSucceeds(updateDoc(doc(prof, 'respostas/rP'), { nota_final: 8 })));
await t('gestor nao altera nota', assertFails(updateDoc(doc(gest, 'respostas/rP'), { nota_final: 10 })));
await t('aluno sem login ainda responde', assertSucceeds(addDoc(collection(anon, 'respostas'), { avaliacao_id: 'avP', aluno_id: 'a2' })));
await t('anonimo nao le respostas', assertFails(getDoc(doc(anon, 'respostas/rP'))));

// Calendario e Dias Letivos: secretaria monta a base da rede, gestor ajusta a escola dele, professor so le
const calR = { municipio_id: 'm1', ano: 2026, inicio: '2026-02-02', fim: '2026-12-18', dias_semana: [1, 2, 3, 4, 5], horas_dia: 4, meta_dias: 200, meta_horas: 800,
  periodos: [{ inicio: '2026-02-02', fim: '2026-04-23' }], facultativos_letivos: [], eventos: [{ id: 'a', ini: '2026-07-13', fim: '2026-07-24', tipo: 'recesso', titulo: 'Recesso' }],
  token: CH, atualizado_em: serverTimestamp(), atualizado_por: 'sec' };
const calE = { escola_id: 'e2', municipio_id: 'm1', ano: 2026, horas_dia: null, eventos: [{ id: 'b', ini: '2026-08-29', fim: '2026-08-29', tipo: 'sabado', titulo: 'Sábado letivo' }],
  atualizado_em: serverTimestamp(), atualizado_por: 'gest' };
await t('professor ve que o calendario ainda nao existe', assertSucceeds(getDoc(doc(prof, 'cal_rede/m1_2026'))));
await t('secretaria cria o calendario da rede', assertSucceeds(setDoc(doc(sec, 'cal_rede/m1_2026'), calR)));
await t('secretaria nao cria calendario de outra rede', assertFails(setDoc(doc(sec, 'cal_rede/m2_2026'), { ...calR, municipio_id: 'm2' })));
await t('calendario com id trocado', assertFails(setDoc(doc(sec, 'cal_rede/m1_2027'), calR)));
await t('calendario com chave fraca', assertFails(setDoc(doc(sec, 'cal_rede/m1_2026'), { ...calR, token: 'abc' })));
await t('calendario com campo extra', assertFails(setDoc(doc(sec, 'cal_rede/m1_2026'), { ...calR, x: 1 })));
await t('calendario com fim antes do inicio', assertFails(setDoc(doc(sec, 'cal_rede/m1_2026'), { ...calR, fim: '2026-01-01' })));
await t('gestor nao altera a base da rede', assertFails(setDoc(doc(gest, 'cal_rede/m1_2026'), calR)));
await t('professor nao altera a base da rede', assertFails(setDoc(doc(prof, 'cal_rede/m1_2026'), calR)));
await t('professor da rede le o calendario', assertSucceeds(getDoc(doc(prof, 'cal_rede/m1_2026'))));
await t('professor de outra rede nao le', assertFails(getDoc(doc(prof2, 'cal_rede/m1_2026'))));
await t('aluno nao le o calendario', assertFails(getDoc(doc(alu, 'cal_rede/m1_2026'))));
await t('anonimo nao le o calendario', assertFails(getDoc(doc(anon, 'cal_rede/m1_2026'))));
await t('admin cria calendario de qualquer rede', assertSucceeds(setDoc(doc(ctx('adm'), 'cal_rede/m2_2026'), { ...calR, municipio_id: 'm2' })));
await t('gestor ajusta a escola dele', assertSucceeds(setDoc(doc(gest, 'cal_escola/e2_2026'), calE)));
await t('gestor nao ajusta outra escola', assertFails(setDoc(doc(gest, 'cal_escola/e1_2026'), { ...calE, escola_id: 'e1' })));
await t('escola com municipio errado', assertFails(setDoc(doc(sec, 'cal_escola/e2_2026'), { ...calE, municipio_id: 'm2' })));
await t('secretaria ajusta escola da rede', assertSucceeds(setDoc(doc(sec, 'cal_escola/e1_2026'), { ...calE, escola_id: 'e1' })));
await t('secretaria nao ajusta escola de outra rede', assertFails(setDoc(doc(sec, 'cal_escola/e9_2026'), { ...calE, escola_id: 'e9', municipio_id: 'm2' })));
await t('professor nao ajusta a escola', assertFails(setDoc(doc(prof, 'cal_escola/e1_2026'), { ...calE, escola_id: 'e1' })));
await t('escola com horas absurdas', assertFails(setDoc(doc(gest, 'cal_escola/e2_2026'), { ...calE, horas_dia: 30 })));
await t('professor le o ajuste da escola dele', assertSucceeds(getDoc(doc(prof, 'cal_escola/e1_2026'))));
await t('professor ve ajuste inexistente', assertSucceeds(getDoc(doc(prof, 'cal_escola/e1_2027'))));
await t('professor de outra rede nao le ajuste', assertFails(getDoc(doc(prof2, 'cal_escola/e1_2026'))));
await t('secretaria lista as escolas do ano', assertSucceeds(getDocs(query(collection(sec, 'cal_escola'), where('municipio_id', '==', 'm1'), where('ano', '==', 2026)))));
await t('gestor nao lista a rede inteira', assertFails(getDocs(query(collection(gest, 'cal_escola'), where('municipio_id', '==', 'm1')))));
await t('ninguem apaga o calendario', assertFails(deleteDoc(doc(sec, 'cal_rede/m1_2026'))));

// Minha agenda: lembretes só do dono (nem admin, nem gestor)
const lem = { titulo: 'Entregar notas', tipo: 'escola', data: '2026-10-30', hora: '14:00', repetir: 'nao', ate: '', avisar: 'hora', antes_min: 15, notas: '', feitos: [], tz_min: 240,
  proxima: '2026-10-30', proximo_aviso: Timestamp.fromMillis(Date.now() + 86400000), avisado: null, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() };
await t('professor cria lembrete', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/lembretes/l1'), lem)));
await t('professor le os proprios lembretes', assertSucceeds(getDocs(collection(prof, 'usuarios/prof/lembretes'))));
await t('admin nao le lembretes do professor', assertFails(getDoc(doc(ctx('adm'), 'usuarios/prof/lembretes/l1'))));
await t('gestor nao le lembretes do professor', assertFails(getDoc(doc(gest, 'usuarios/prof/lembretes/l1'))));
await t('outro nao grava na agenda alheia', assertFails(setDoc(doc(prof2, 'usuarios/prof/lembretes/l2'), lem)));
await t('lembrete com tipo invalido', assertFails(setDoc(doc(prof, 'usuarios/prof/lembretes/l3'), { ...lem, tipo: 'x' })));
await t('lembrete com hora invalida', assertFails(setDoc(doc(prof, 'usuarios/prof/lembretes/l3'), { ...lem, hora: '9h' })));
await t('lembrete com campo extra', assertFails(setDoc(doc(prof, 'usuarios/prof/lembretes/l3'), { ...lem, x: 1 })));
await t('lembrete sem titulo', assertFails(setDoc(doc(prof, 'usuarios/prof/lembretes/l3'), { ...lem, titulo: '' })));
await t('lembrete pessoal semanal sem aviso', assertSucceeds(setDoc(doc(prof, 'usuarios/prof/lembretes/l4'), { ...lem, tipo: 'pessoal', repetir: 'semanal', ate: '2026-12-31', avisar: 'nao', proximo_aviso: null })));
await t('gestor tambem tem agenda', assertSucceeds(setDoc(doc(gest, 'usuarios/gest/lembretes/g1'), lem)));
await t('aluno nao cria lembrete', assertFails(setDoc(doc(alu, 'usuarios/alu/lembretes/a1'), lem)));
await t('professor apaga o proprio lembrete', assertSucceeds(deleteDoc(doc(prof, 'usuarios/prof/lembretes/l4'))));

// Frequencia digital: professor lanca a chamada das turmas da escola dele; gestor le; resumo so a funcao grava
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'turmas/tf1'), { nome: '5A', escola_id: 'e1', municipio_id: 'm1', criado_por: 'prof' });
  await setDoc(doc(db, 'turmas/tf9'), { nome: 'Longe', escola_id: 'e9', municipio_id: 'm2', criado_por: 'prof2' });
  await setDoc(doc(db, 'usuarios/gest1'), { perfil: 'gestor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'freq_resumo/tf1_2026'), { turma_id: 'tf1', escola_id: 'e1', municipio_id: 'm1', ano: 2026, alunos: {}, dias: {} });
});
const cham = { professor_uid: 'prof', professor_nome: 'P', escola_id: 'e1', municipio_id: 'm1', turma_id: 'tf1', turma_nome: '5A', disciplina: 'Matemática', disc_id: 'matematica',
  dia: '2026-10-22', ano: 2026, aulas: 2, lista: ['a1', 'a2'], nomes: { a1: 'Ana', a2: 'Bia' }, faltas: { a1: 2 }, just: {}, conteudo: 'Frações', atualizado_em: serverTimestamp() };
const IDC = 'freq_chamadas/prof_tf1_2026-10-22_matematica', gest1 = ctx('gest1');
await t('professor lanca a chamada', assertSucceeds(setDoc(doc(prof, IDC), cham)));
await t('professor corrige a chamada', assertSucceeds(setDoc(doc(prof, IDC), { ...cham, faltas: {} })));
await t('chamada com id diferente do conteudo', assertFails(setDoc(doc(prof, 'freq_chamadas/prof_tf1_2026-10-23_matematica'), cham)));
await t('chamada em nome de outro', assertFails(setDoc(doc(prof2, IDC.replace('prof_', 'prof2_')), cham)));
await t('chamada em turma de outra escola', assertFails(setDoc(doc(prof, 'freq_chamadas/prof_tf9_2026-10-22_matematica'), { ...cham, turma_id: 'tf9' })));
await t('chamada com escola trocada', assertFails(setDoc(doc(prof, IDC), { ...cham, escola_id: 'e2' })));
await t('chamada com 7 aulas', assertFails(setDoc(doc(prof, IDC), { ...cham, aulas: 7 })));
await t('chamada com ano errado', assertFails(setDoc(doc(prof, IDC), { ...cham, ano: 2025 })));
await t('chamada com campo extra', assertFails(setDoc(doc(prof, IDC), { ...cham, x: 1 })));
await t('chamada com lista enorme', assertFails(setDoc(doc(prof, IDC), { ...cham, lista: Array(81).fill('a') })));
await t('gestor nao lanca chamada', assertFails(setDoc(doc(gest1, 'freq_chamadas/gest1_tf1_2026-10-22_matematica'), { ...cham, professor_uid: 'gest1' })));
await t('licenca vencida nao lanca', assertFails(setDoc(doc(venc, 'freq_chamadas/venc_tf1_2026-10-22_matematica'), { ...cham, professor_uid: 'venc' })));
await t('professor lista as proprias chamadas', assertSucceeds(getDocs(query(collection(prof, 'freq_chamadas'), where('professor_uid', '==', 'prof'), where('turma_id', '==', 'tf1')))));
await t('professor abre chamada que ainda nao existe', assertSucceeds(getDoc(doc(prof, 'freq_chamadas/prof_tf1_2026-10-01_matematica'))));
await t('gestor da escola le a chamada', assertSucceeds(getDoc(doc(gest1, IDC))));
await t('gestor de outra escola nao le', assertFails(getDoc(doc(gest, IDC))));
await t('secretaria nao le chamada com nomes', assertFails(getDoc(doc(sec, IDC))));
await t('outro professor nao le', assertFails(getDoc(doc(prof2, IDC))));
await t('gestor le o resumo da escola', assertSucceeds(getDocs(query(collection(gest1, 'freq_resumo'), where('escola_id', '==', 'e1'), where('ano', '==', 2026)))));
await t('professor da escola le o resumo', assertSucceeds(getDoc(doc(prof, 'freq_resumo/tf1_2026'))));
await t('gestor de outra escola nao le o resumo', assertFails(getDoc(doc(gest, 'freq_resumo/tf1_2026'))));
await t('secretaria nao le o resumo com nomes', assertFails(getDoc(doc(sec, 'freq_resumo/tf1_2026'))));
await t('ninguem grava o resumo', assertFails(setDoc(doc(prof, 'freq_resumo/tf1_2026'), { escola_id: 'e1' })));
await t('outro nao apaga minha chamada', assertFails(deleteDoc(doc(prof2, IDC))));
await t('professor apaga a propria chamada', assertSucceeds(deleteDoc(doc(prof, IDC))));

// Ficha de busca ativa: so a gestao da escola
const caso = { escola_id: 'e1', municipio_id: 'm1', aluno_id: 'a1', aluno_nome: 'Ana', turma_id: 'tf1', turma_nome: '5A', ano: 2026, status: 'contato',
  registros: [{ em: 1, por: 'gest1', tipo: 'ligacao', texto: 'Mae informou febre' }], atualizado_em: serverTimestamp(), atualizado_por: 'gest1' };
const IDB = 'busca_ativa/e1_a1_2026';
await t('gestor abre ficha de busca ativa', assertSucceeds(setDoc(doc(gest1, IDB), caso)));
await t('gestor atualiza a ficha', assertSucceeds(setDoc(doc(gest1, IDB), { ...caso, status: 'encaminhado' })));
await t('gestor le as fichas da escola', assertSucceeds(getDocs(query(collection(gest1, 'busca_ativa'), where('escola_id', '==', 'e1'), where('ano', '==', 2026)))));
await t('gestor de outra escola nao le a ficha', assertFails(getDoc(doc(gest, IDB))));
await t('gestor de outra escola nao grava', assertFails(setDoc(doc(gest, 'busca_ativa/e1_a2_2026'), { ...caso, aluno_id: 'a2', atualizado_por: 'gest' })));
await t('professor nao le a ficha', assertFails(getDoc(doc(prof, IDB))));
await t('professor nao grava ficha', assertFails(setDoc(doc(prof, 'busca_ativa/e1_a3_2026'), { ...caso, aluno_id: 'a3', atualizado_por: 'prof' })));
await t('secretaria nao le ficha com nomes', assertFails(getDoc(doc(sec, IDB))));
await t('ficha com id diferente', assertFails(setDoc(doc(gest1, 'busca_ativa/e1_a9_2026'), caso)));
await t('ficha com status invalido', assertFails(setDoc(doc(gest1, IDB), { ...caso, status: 'x' })));
await t('ficha com municipio trocado', assertFails(setDoc(doc(gest1, 'busca_ativa/e1_a5_2026'), { ...caso, aluno_id: 'a5', municipio_id: 'm2' })));
await t('ficha em nome de outro', assertFails(setDoc(doc(gest1, IDB), { ...caso, atualizado_por: 'prof' })));
await t('ficha com campo extra', assertFails(setDoc(doc(gest1, IDB), { ...caso, x: 1 })));
await t('gestor nao apaga ficha', assertFails(deleteDoc(doc(gest1, IDB))));

// Portaria: entradas pela carteirinha (gestor da escola) e leitura de turmas e alunos pelo gestor
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'alunos/al1'), { nome: 'Ana', turma_id: 'tf1', escola_id: 'e1' }); });
const ent = { escola_id: 'e1', municipio_id: 'm1', turma_id: 'tf1', turma_nome: '5A', dia: '2026-10-26', ano: 2026, entradas: { al1: '07:12' }, nomes: { al1: 'Ana' }, atualizado_em: serverTimestamp() };
const IDE = 'freq_entradas/tf1_2026-10-26';
await t('gestor registra entrada', assertSucceeds(setDoc(doc(gest1, IDE), ent)));
await t('gestor registra outra entrada (merge)', assertSucceeds(setDoc(doc(gest1, IDE), { ...ent, entradas: { al2: '07:13' }, nomes: { al2: 'Bia' } }, { merge: true })));
await t('gestor le entradas do dia', assertSucceeds(getDocs(query(collection(gest1, 'freq_entradas'), where('escola_id', '==', 'e1'), where('dia', '==', '2026-10-26')))));
await t('gestor de outra escola nao registra', assertFails(setDoc(doc(gest, IDE), ent, { merge: true })));
await t('gestor de outra escola nao le entradas', assertFails(getDoc(doc(gest, IDE))));
await t('professor nao registra entrada', assertFails(setDoc(doc(prof, 'freq_entradas/tf1_2026-10-27'), { ...ent, dia: '2026-10-27' })));
await t('secretaria nao le entradas com nomes', assertFails(getDoc(doc(sec, IDE))));
await t('entrada com id diferente', assertFails(setDoc(doc(gest1, 'freq_entradas/tf1_2026-10-28'), ent)));
await t('entrada com escola trocada', assertFails(setDoc(doc(gest1, 'freq_entradas/tf1_2026-10-29'), { ...ent, dia: '2026-10-29', escola_id: 'e2' })));
await t('entrada com campo extra', assertFails(setDoc(doc(gest1, 'freq_entradas/tf1_2026-10-30'), { ...ent, dia: '2026-10-30', x: 1 })));
await t('cliente nao grava foto da entrada', assertFails(setDoc(doc(gest1, IDE), { fotos: { al1: 'portaria/e1/x.jpg' } }, { merge: true })));
await t('gestor le turmas da escola', assertSucceeds(getDocs(query(collection(gest1, 'turmas'), where('escola_id', '==', 'e1')))));
await t('gestor le alunos da escola', assertSucceeds(getDocs(query(collection(gest1, 'alunos'), where('escola_id', '==', 'e1')))));
await t('gestor nao le alunos de outra escola', assertFails(getDocs(query(collection(gest, 'alunos'), where('escola_id', '==', 'e1')))));
await t('gestor nao cria aluno', assertFails(setDoc(doc(gest1, 'alunos/novo1'), { nome: 'X', turma_id: 'tf1', escola_id: 'e1', criado_por: 'gest1' })));

// registro de quem abriu foto da entrada
const vista = { escola_id: 'e1', aluno_id: 'al1', aluno_nome: 'Ana', dia: '2026-10-26', foto: 'portaria/e1/2026-10-26/al1_0705.jpg', por_uid: 'gest1', por_nome: 'G', em: serverTimestamp(), mes: '2026-10' };
await t('gestor registra que abriu a foto', assertSucceeds(setDoc(doc(gest1, 'portaria_vistas/v1'), vista)));
await t('gestor le quem abriu fotos da escola', assertSucceeds(getDocs(query(collection(gest1, 'portaria_vistas'), where('escola_id', '==', 'e1'), where('mes', '==', '2026-10')))));
await t('gestor de outra escola nao le registro', assertFails(getDoc(doc(gest, 'portaria_vistas/v1'))));
await t('registro nao pode ser apagado', assertFails(deleteDoc(doc(gest1, 'portaria_vistas/v1'))));
await t('registro nao pode ser alterado', assertFails(setDoc(doc(gest1, 'portaria_vistas/v1'), { ...vista, por_nome: 'Outro' })));
await t('registro em nome de outro', assertFails(setDoc(doc(gest1, 'portaria_vistas/v2'), { ...vista, por_uid: 'gest' })));
await t('registro com hora falsa', assertFails(setDoc(doc(gest1, 'portaria_vistas/v3'), { ...vista, em: new Date(2020, 0, 1) })));
await t('registro de foto de outra escola', assertFails(setDoc(doc(gest1, 'portaria_vistas/v4'), { ...vista, escola_id: 'e2', foto: 'portaria/e2/2026-10-26/al1_0705.jpg' })));
await t('registro com caminho que nao bate', assertFails(setDoc(doc(gest1, 'portaria_vistas/v5'), { ...vista, foto: 'portaria/e1/2026-10-26/outro_0705.jpg' })));
await t('professor nao registra nem le', assertFails(setDoc(doc(prof, 'portaria_vistas/v6'), { ...vista, por_uid: 'prof' })));

// backup: so o administrador le; ninguem grava pelo aplicativo
await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await setDoc(doc(f, 'backup_config/atual'), { pasta_id: 'x' }); await setDoc(doc(f, 'backups_log/b1'), { status: 'ok' }); });
await t('administrador le o backup', assertSucceeds(getDoc(doc(ctx('adm'), 'backups_log/b1'))));
await t('gestor nao le o backup', assertFails(getDoc(doc(gest1, 'backup_config/atual'))));
await t('administrador nao grava log de backup pelo app', assertFails(setDoc(doc(ctx('adm'), 'backups_log/b2'), { status: 'ok' })));

// familia do aluno (contatos dos responsaveis)
const fam = { aluno_id: 'al1', aluno_nome: 'Ana', escola_id: 'e1', municipio_id: 'm1', turma_id: 'tf1', turma_nome: '5A', responsaveis: [{ nome: 'Maria', parentesco: 'Mãe', whatsapp: '5567999990000', email: '', principal: true }], aceita_avisos: true, atualizado_em: serverTimestamp(), atualizado_por: 'gest1', atualizado_por_nome: 'G' };
await t('gestor grava familia do aluno da escola', assertSucceeds(setDoc(doc(gest1, 'alunos_familia/al1'), fam)));
await t('gestor le familias da escola', assertSucceeds(getDocs(query(collection(gest1, 'alunos_familia'), where('escola_id', '==', 'e1')))));
await t('professor nao le telefone da familia', assertFails(getDoc(doc(prof, 'alunos_familia/al1'))));
await t('gestor de outra escola nao le familia', assertFails(getDoc(doc(gest, 'alunos_familia/al1'))));
await t('familia com escola trocada', assertFails(setDoc(doc(gest1, 'alunos_familia/al1'), { ...fam, escola_id: 'e2' })));
await t('familia com id de outro aluno', assertFails(setDoc(doc(gest1, 'alunos_familia/outro'), fam)));
await t('familia com mais de 4 responsaveis', assertFails(setDoc(doc(gest1, 'alunos_familia/al1'), { ...fam, responsaveis: [1, 2, 3, 4, 5].map(() => fam.responsaveis[0]) })));
await t('familia com campo extra', assertFails(setDoc(doc(gest1, 'alunos_familia/al1'), { ...fam, cpf: '1' })));
await t('secretaria nao le familia', assertFails(getDoc(doc(sec, 'alunos_familia/al1'))));

// avisos as familias
const cfgAv = { falta_dia: true, seguidos: true, fora_sala: false, chegada: false, atualizado_em: serverTimestamp(), atualizado_por: 'gest1', atualizado_por_nome: 'G' };
await t('gestor liga avisos da escola', assertSucceeds(setDoc(doc(gest1, 'avisos_config/e1'), cfgAv)));
await t('gestor nao liga avisos de outra escola', assertFails(setDoc(doc(gest1, 'avisos_config/e2'), cfgAv)));
await t('professor nao liga avisos', assertFails(setDoc(doc(prof, 'avisos_config/e1'), cfgAv)));
await t('config de avisos com campo extra', assertFails(setDoc(doc(gest1, 'avisos_config/e1'), { ...cfgAv, whatsapp: true })));
const com = { escola_id: 'e1', escola_nome: 'E', municipio_id: 'm1', titulo: 'Reunião de pais', texto: 'Sexta às 19h.', turmas: ['*'], status: 'pendente', criado_em: serverTimestamp(), criado_por: 'gest1', criado_por_nome: 'G' };
await t('gestor cria comunicado', assertSucceeds(setDoc(doc(gest1, 'comunicados_familia/c1'), com)));
await t('gestor le comunicados da escola', assertSucceeds(getDocs(query(collection(gest1, 'comunicados_familia'), where('escola_id', '==', 'e1')))));
await t('comunicado ja enviado nao pode ser criado assim', assertFails(setDoc(doc(gest1, 'comunicados_familia/c2'), { ...com, status: 'enviado' })));
await t('comunicado em nome de outro', assertFails(setDoc(doc(gest1, 'comunicados_familia/c3'), { ...com, criado_por: 'gest' })));
await t('comunicado nao pode ser alterado', assertFails(setDoc(doc(gest1, 'comunicados_familia/c1'), { ...com, titulo: 'Outro' })));
await t('professor nao cria comunicado', assertFails(setDoc(doc(prof, 'comunicados_familia/c4'), { ...com, criado_por: 'prof' })));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'avisos_familia/falta_al1_2026-10-26'), { escola_id: 'e1', status: 'enviado' }); });
await t('gestor le avisos enviados da escola', assertSucceeds(getDocs(query(collection(gest1, 'avisos_familia'), where('escola_id', '==', 'e1'), where('dia', '==', '2026-10-26')))));
await t('gestor de outra escola nao le avisos', assertFails(getDoc(doc(gest, 'avisos_familia/falta_al1_2026-10-26'))));
await t('ninguem grava aviso pelo app', assertFails(setDoc(doc(gest1, 'avisos_familia/x'), { escola_id: 'e1' })));

const portA = ctx('port1'), sece = ctx('sece1'), semconv = ctx('semconv'), IDC2 = 'freq_chamadas/prof_tf1_2026-10-23_matematica';
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), IDC2), { ...cham, dia: '2026-10-23' }); });
// equipe de apoio da escola: portaria e secretaria escolar, convidadas pelo gestor
const conv = (email, perfil, extra = {}) => ({ nome: 'Maria Souza', email, perfil, status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', municipio_nome: 'Ribas',
  escola_id: 'e1', escola_nome: 'EM Centro', escolas_ids: ['e1'], escolas_nomes: ['EM Centro'], turmas_ids: [], convidado_por: 'gest1', convidado_por_nome: 'G', atualizado_em: serverTimestamp(), atualizado_por: 'gest1', ...extra });
await t('gestor convida portaria', assertSucceeds(setDoc(doc(gest1, 'pre_cadastros/port1@x.com'), conv('port1@x.com', 'portaria'))));
await t('gestor convida secretaria escolar', assertSucceeds(setDoc(doc(gest1, 'pre_cadastros/sece1@x.com'), conv('sece1@x.com', 'secretaria_escolar'))));
await t('gestor nao convida professor', assertFails(setDoc(doc(gest1, 'pre_cadastros/p9@x.com'), conv('p9@x.com', 'professor'))));
await t('gestor nao convida gestor', assertFails(setDoc(doc(gest1, 'pre_cadastros/g9@x.com'), conv('g9@x.com', 'gestor'))));
await t('gestor nao convida para outra escola', assertFails(setDoc(doc(gest1, 'pre_cadastros/o9@x.com'), conv('o9@x.com', 'portaria', { escola_id: 'e2', escolas_ids: ['e2'] }))));
await t('convite com duas escolas', assertFails(setDoc(doc(gest1, 'pre_cadastros/d9@x.com'), conv('d9@x.com', 'portaria', { escolas_ids: ['e1', 'e2'] }))));
await t('convite com municipio errado', assertFails(setDoc(doc(gest1, 'pre_cadastros/m9@x.com'), conv('m9@x.com', 'portaria', { municipio_id: 'm2' }))));
await t('convite com turmas', assertFails(setDoc(doc(gest1, 'pre_cadastros/t9@x.com'), conv('t9@x.com', 'portaria', { turmas_ids: ['tf1'] }))));
await t('convite com campo extra', assertFails(setDoc(doc(gest1, 'pre_cadastros/x9@x.com'), conv('x9@x.com', 'portaria', { admin: true }))));
await t('convite com e-mail diferente do id', assertFails(setDoc(doc(gest1, 'pre_cadastros/y9@x.com'), conv('outro@x.com', 'portaria'))));
await t('convite em nome de outro gestor', assertFails(setDoc(doc(gest1, 'pre_cadastros/z9@x.com'), conv('z9@x.com', 'portaria', { convidado_por: 'gest' }))));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'pre_cadastros/prof9@x.com'), { perfil: 'professor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1', turmas_ids: [] }); });
await t('gestor nao sobrescreve pre-cadastro de professor', assertFails(setDoc(doc(gest1, 'pre_cadastros/prof9@x.com'), conv('prof9@x.com', 'portaria'))));
await t('gestor nao le pre-cadastro de professor', assertFails(getDoc(doc(gest1, 'pre_cadastros/prof9@x.com'))));
await t('gestor nao apaga pre-cadastro de professor', assertFails(deleteDoc(doc(gest1, 'pre_cadastros/prof9@x.com'))));
await t('gestor ve se um e-mail esta livre', assertSucceeds(getDoc(doc(gest1, 'pre_cadastros/livre@x.com'))));
await t('gestor lista convites da escola', assertSucceeds(getDocs(query(collection(gest1, 'pre_cadastros'), where('escola_id', '==', 'e1'), where('perfil', 'in', ['portaria', 'secretaria_escolar'])))));
await t('gestor de outra escola nao le o convite', assertFails(getDoc(doc(gest, 'pre_cadastros/port1@x.com'))));
await t('gestor de outra escola nao apaga o convite', assertFails(deleteDoc(doc(gest, 'pre_cadastros/port1@x.com'))));
await t('professor nao convida', assertFails(setDoc(doc(prof, 'pre_cadastros/q9@x.com'), conv('q9@x.com', 'portaria', { convidado_por: 'prof' }))));
// primeiro login do convidado
const usrApoio = (perfil, extra = {}) => ({ nome: 'Maria Souza', perfil, status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1'], turmas_ids: [], ...extra });
await t('convidado com escola trocada nao entra', assertFails(setDoc(doc(portA, 'usuarios/port1'), { ...usrApoio('portaria', { escola_id: 'e2', escolas_ids: ['e2'] }), email: 'port1@x.com' })));
await t('convidado nao vira gestor', assertFails(setDoc(doc(portA, 'usuarios/port1'), { ...usrApoio('gestor'), email: 'port1@x.com' })));
await t('convidado da portaria entra', assertSucceeds(setDoc(doc(portA, 'usuarios/port1'), { ...usrApoio('portaria'), email: 'port1@x.com' })));
await t('convidado da secretaria escolar entra', assertSucceeds(setDoc(doc(sece, 'usuarios/sece1'), { ...usrApoio('secretaria_escolar'), email: 'sece1@x.com' })));
await t('sem convite nao vira portaria', assertFails(setDoc(doc(semconv, 'usuarios/semconv'), { ...usrApoio('portaria'), email: 'semconv@x.com' })));
await t('portaria nao troca a propria escola', assertFails(updateDoc(doc(portA, 'usuarios/port1'), { escolas_ids: ['e1', 'e2'], escola_id: 'e1' })));
await t('secretaria escolar nao troca a propria escola', assertFails(updateDoc(doc(sece, 'usuarios/sece1'), { escolas_ids: ['e2'], escola_id: 'e2' })));
await t('gestor nao adiciona outra escola a si mesmo', assertFails(updateDoc(doc(gest1, 'usuarios/gest1'), { escolas_ids: ['e1', 'e2'] })));
await t('professor ainda troca as proprias escolas', assertSucceeds(updateDoc(doc(prof, 'usuarios/prof'), { escolas_ids: ['e1', 'e2'], escola_id: 'e1', vinculo_alterado_por: 'prof' })));
await t('portaria altera o proprio nome', assertSucceeds(updateDoc(doc(portA, 'usuarios/port1'), { nome: 'Maria A. Souza' })));
// gestor ve e pausa a equipe
await t('gestor lista a equipe da escola', assertSucceeds(getDocs(query(collection(gest1, 'usuarios'), where('escola_id', '==', 'e1'), where('perfil', 'in', ['portaria', 'secretaria_escolar'])))));
await t('gestor pausa a portaria', assertSucceeds(updateDoc(doc(gest1, 'usuarios/port1'), { status: 'inativo', atualizado_em: serverTimestamp(), atualizado_por: 'gest1' })));
await t('gestor nao muda o perfil da equipe', assertFails(updateDoc(doc(gest1, 'usuarios/port1'), { perfil: 'gestor' })));
await t('gestor nao pausa professor', assertFails(updateDoc(doc(gest1, 'usuarios/prof'), { status: 'inativo' })));
await t('gestor de outra escola nao pausa', assertFails(updateDoc(doc(gest, 'usuarios/sece1'), { status: 'inativo' })));
await t('gestor nao le usuario professor', assertFails(getDoc(doc(gest1, 'usuarios/prof'))));
await t('portaria pausada nao le alunos', assertFails(getDocs(query(collection(portA, 'alunos'), where('escola_id', '==', 'e1')))));
await t('gestor reativa a portaria', assertSucceeds(updateDoc(doc(gest1, 'usuarios/port1'), { status: 'ativo', atualizado_em: serverTimestamp(), atualizado_por: 'gest1' })));
// o que cada um ve
await t('portaria le turmas da escola', assertSucceeds(getDocs(query(collection(portA, 'turmas'), where('escola_id', '==', 'e1')))));
await t('portaria le alunos da escola', assertSucceeds(getDocs(query(collection(portA, 'alunos'), where('escola_id', '==', 'e1')))));
await t('portaria nao le alunos de outra escola', assertFails(getDocs(query(collection(portA, 'alunos'), where('escola_id', '==', 'e2')))));
await t('portaria registra entrada', assertSucceeds(setDoc(doc(portA, IDE), { ...ent, entradas: { al3: '07:20' }, nomes: { al3: 'Caio' } }, { merge: true })));
await t('portaria le entradas do dia', assertSucceeds(getDocs(query(collection(portA, 'freq_entradas'), where('escola_id', '==', 'e1'), where('dia', '==', '2026-10-26')))));
await t('portaria nao le resumo de faltas', assertFails(getDocs(query(collection(portA, 'freq_resumo'), where('escola_id', '==', 'e1'), where('ano', '==', 2026)))));
await t('portaria nao le chamada', assertFails(getDoc(doc(portA, IDC2))));
await t('portaria nao le busca ativa', assertFails(getDoc(doc(portA, IDB))));
await t('portaria nao le telefone da familia', assertFails(getDoc(doc(portA, 'alunos_familia/al1'))));
await t('portaria nao le avisos', assertFails(getDocs(query(collection(portA, 'avisos_familia'), where('escola_id', '==', 'e1'), where('dia', '==', '2026-10-26')))));
await t('portaria nao manda comunicado', assertFails(setDoc(doc(portA, 'comunicados_familia/cp'), { ...com, criado_por: 'port1' })));
await t('secretaria escolar le o resumo de faltas', assertSucceeds(getDocs(query(collection(sece, 'freq_resumo'), where('escola_id', '==', 'e1'), where('ano', '==', 2026)))));
await t('secretaria escolar le a chamada', assertSucceeds(getDoc(doc(sece, IDC2))));
await t('secretaria escolar nao lanca chamada', assertFails(setDoc(doc(sece, 'freq_chamadas/sece1_tf1_2026-10-22_matematica'), { ...cham, professor_uid: 'sece1' })));
await t('secretaria escolar registra na busca ativa', assertSucceeds(setDoc(doc(sece, IDB), { ...caso, atualizado_por: 'sece1' })));
await t('secretaria escolar le as fichas', assertSucceeds(getDocs(query(collection(sece, 'busca_ativa'), where('escola_id', '==', 'e1'), where('ano', '==', 2026)))));
await t('secretaria escolar nao apaga ficha', assertFails(deleteDoc(doc(sece, IDB))));
await t('secretaria escolar grava familia', assertSucceeds(setDoc(doc(sece, 'alunos_familia/al1'), { ...fam, atualizado_por: 'sece1' })));
await t('secretaria escolar le familias', assertSucceeds(getDocs(query(collection(sece, 'alunos_familia'), where('escola_id', '==', 'e1')))));
await t('secretaria escolar nao apaga familia', assertFails(deleteDoc(doc(sece, 'alunos_familia/al1'))));
await t('secretaria escolar ve a config de avisos', assertSucceeds(getDoc(doc(sece, 'avisos_config/e1'))));
await t('secretaria escolar nao liga avisos', assertFails(setDoc(doc(sece, 'avisos_config/e1'), { ...cfgAv, atualizado_por: 'sece1' })));
await t('secretaria escolar manda comunicado', assertSucceeds(setDoc(doc(sece, 'comunicados_familia/cs'), { ...com, criado_por: 'sece1' })));
await t('secretaria escolar le avisos enviados', assertSucceeds(getDocs(query(collection(sece, 'avisos_familia'), where('escola_id', '==', 'e1'), where('dia', '==', '2026-10-26')))));
await t('secretaria escolar nao le registro de fotos vistas', assertFails(getDocs(query(collection(sece, 'portaria_vistas'), where('escola_id', '==', 'e1')))));
await t('secretaria escolar nao convida ninguem', assertFails(setDoc(doc(sece, 'pre_cadastros/w9@x.com'), conv('w9@x.com', 'portaria', { convidado_por: 'sece1' }))));
await t('secretaria escolar nao le dados de outra escola', assertFails(getDocs(query(collection(sece, 'busca_ativa'), where('escola_id', '==', 'e2'), where('ano', '==', 2026)))));
await t('gestor cancela convite', assertSucceeds(deleteDoc(doc(gest1, 'pre_cadastros/port1@x.com'))));

// gestor e Secretaria de Educação importados pelo administrador
const gestImp = ctx('gimp'), secImp = ctx('simp'), falso = ctx('gfalso');
await t('admin importa gestor', assertSucceeds(setDoc(doc(ctx('adm'), 'pre_cadastros/gimp@x.com'), { nome: 'G', email: 'gimp@x.com', perfil: 'gestor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1', 'e2'], turmas_ids: [] })));
await t('admin importa secretaria de educacao', assertSucceeds(setDoc(doc(ctx('adm'), 'pre_cadastros/simp@x.com'), { nome: 'S', email: 'simp@x.com', perfil: 'secretaria', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: null, escolas_ids: [], turmas_ids: [] })));
await t('gestor importado com escola a mais nao entra', assertFails(setDoc(doc(gestImp, 'usuarios/gimp'), { nome: 'G', email: 'gimp@x.com', perfil: 'gestor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1', 'e2', 'e9'], turmas_ids: [] })));
await t('gestor importado nao vira secretaria', assertFails(setDoc(doc(gestImp, 'usuarios/gimp'), { nome: 'G', email: 'gimp@x.com', perfil: 'secretaria', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1', 'e2'], turmas_ids: [] })));
await t('gestor importado entra', assertSucceeds(setDoc(doc(gestImp, 'usuarios/gimp'), { nome: 'G', email: 'gimp@x.com', perfil: 'gestor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1', 'e2'], turmas_ids: [] })));
await t('secretaria de educacao importada entra', assertSucceeds(setDoc(doc(secImp, 'usuarios/simp'), { nome: 'S', email: 'simp@x.com', perfil: 'secretaria', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: null, escolas_ids: [], turmas_ids: [] })));
await t('sem pre-cadastro nao vira gestor', assertFails(setDoc(doc(falso, 'usuarios/gfalso'), { nome: 'X', email: 'gfalso@x.com', perfil: 'gestor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1', escola_id: 'e1', escolas_ids: ['e1'], turmas_ids: [] })));
await t('gestor nao cria pre-cadastro de gestor', assertFails(setDoc(doc(gest1, 'pre_cadastros/novo-g@x.com'), conv('novo-g@x.com', 'gestor'))));

await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await setDoc(doc(f, 'videos/vp'), { publicado: true, para_alunos: false }); await setDoc(doc(f, 'videos/vr'), { publicado: false }); });
await t('professor reage ao video', assertSucceeds(setDoc(doc(prof, 'videos_reacoes/vp_prof'), { video_id: 'vp', uid: 'prof', reacao: 'gostei', perfil: 'professor', em: serverTimestamp() })));
await t('professor nao reage a rascunho', assertFails(setDoc(doc(prof, 'videos_reacoes/vr_prof'), { video_id: 'vr', uid: 'prof', reacao: 'gostei', perfil: 'professor', em: serverTimestamp() })));
await t('licenca vencida nao reage', assertFails(setDoc(doc(venc, 'videos_reacoes/vp_venc'), { video_id: 'vp', uid: 'venc', reacao: 'gostei', perfil: 'professor', em: serverTimestamp() })));
await t('outro professor nao le minha reacao', assertFails(getDoc(doc(prof2, 'videos_reacoes/vp_prof'))));
await t('admin tambem vota', assertSucceeds(setDoc(doc(ctx('adm'), 'videos_reacoes/vp_adm'), { video_id: 'vp', uid: 'adm', reacao: 'amei', perfil: 'admin', em: serverTimestamp() })));
await t('admin le as reacoes', assertSucceeds(getDocs(query(collection(ctx('adm'), 'videos_reacoes'), where('video_id', '==', 'vp')))));

// mural de notícias
await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await setDoc(doc(f, 'noticias/n1'), { titulo: 'Novo episódio', publicado: true }); await setDoc(doc(f, 'noticias/n2'), { titulo: 'Rascunho', publicado: false }); });
await t('professor le noticias publicadas', assertSucceeds(getDocs(query(collection(prof, 'noticias'), where('publicado', '==', true)))));
await t('professor nao le rascunho', assertFails(getDoc(doc(prof, 'noticias/n2'))));
await t('professor nao publica noticia', assertFails(setDoc(doc(prof, 'noticias/n3'), { titulo: 'x', publicado: true })));
await t('admin publica noticia', assertSucceeds(setDoc(doc(ctx('adm'), 'noticias/n3'), { titulo: 'x', publicado: true })));
await t('professor reage a noticia', assertSucceeds(setDoc(doc(prof, 'noticias_reacoes/n1_prof'), { noticia_id: 'n1', uid: 'prof', reacao: 'amei', perfil: 'professor', em: serverTimestamp() })));
await t('reacao em rascunho', assertFails(setDoc(doc(prof, 'noticias_reacoes/n2_prof'), { noticia_id: 'n2', uid: 'prof', reacao: 'amei', perfil: 'professor', em: serverTimestamp() })));
await t('reacao de noticia em nome de outro', assertFails(setDoc(doc(prof, 'noticias_reacoes/n1_prof2'), { noticia_id: 'n1', uid: 'prof2', reacao: 'amei', perfil: 'professor', em: serverTimestamp() })));
await t('anonimo nao le noticias', assertFails(getDocs(query(collection(anon, 'noticias'), where('publicado', '==', true)))));

console.log(`REGRAS DOS APLICATIVOS: ${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);

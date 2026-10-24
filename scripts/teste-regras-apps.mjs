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
const ctx = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
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
console.log(`REGRAS DOS APLICATIVOS: ${ok} ok, ${falhas} falha(s)`);
await env.cleanup();
process.exit(falhas ? 1 : 0);

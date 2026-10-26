// Cadastro manual de usuário pela rede (sem Google e sem autocadastro):
//  - quem cadastra informa nome, e-mail, perfil e vínculo (escolas e turmas; para aluno, a matrícula da Ficha do Aluno);
//  - o Portal cria a conta (ou aproveita a conta que a pessoa já criou e ainda não tem cadastro) com uma SENHA PROVISÓRIA
//    que aparece uma vez para quem cadastrou; no 1º login a pessoa é obrigada a criar a própria senha (mesmo fluxo da senha provisória).
//  - contasSemCadastro: lista quem criou conta (e-mail/senha ou Google) mas ainda não tem cadastro no Portal (só admin).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { gerarSenha, podeResetar } from './senha-provisoria.js';

const REGIAO = 'southamerica-east1';
const VALIDADE_H = 72;
const PERFIS = ['professor', 'gestor', 'secretaria_escolar', 'portaria', 'secretaria', 'aluno'];
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DOM_TECNICO = '@aluno.portaldoeducador.com.br';
const txt = (v, n) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, n);

export async function cadastrar({ db, auth, uid, d }) {
  const nome = txt(d.nome, 80), email = String(d.email || '').trim().toLowerCase(), perfil = String(d.perfil || '');
  if (nome.length < 3) throw new HttpsError('invalid-argument', 'Informe o nome completo.');
  if (!/^[^\s@\/]{1,64}@[^\s@\/]{1,190}\.[^\s@\/]{2,}$/.test(email) || email.endsWith(DOM_TECNICO)) throw new HttpsError('invalid-argument', 'E-mail inválido.');
  if (!PERFIS.includes(perfil)) throw new HttpsError('invalid-argument', 'Perfil inválido.');
  const eu = (await db.doc(`usuarios/${uid}`).get()).data();
  const muniId = String(d.municipio_id || '');
  if (!ID.test(muniId)) throw new HttpsError('invalid-argument', 'Escolha o município.');
  const muni = (await db.doc(`municipios/${muniId}`).get()).data();
  if (!muni) throw new HttpsError('not-found', 'Município não encontrado.');
  // escolas e turmas: só do município escolhido
  let escolas = [...new Set((Array.isArray(d.escolas_ids) ? d.escolas_ids : []).map(String).filter(x => ID.test(x)))].slice(0, 10);
  let turmas = [...new Set((Array.isArray(d.turmas_ids) ? d.turmas_ids : []).map(String).filter(x => ID.test(x)))].slice(0, 60);
  let aluno = null;
  if (perfil === 'aluno') {
    const aid = String(d.aluno_id || '');
    if (!ID.test(aid)) throw new HttpsError('invalid-argument', 'Escolha a matrícula do aluno.');
    const s = await db.doc(`alunos/${aid}`).get();
    if (!s.exists || s.data().status === 'inativo') throw new HttpsError('not-found', 'Matrícula não encontrada ou inativa.');
    aluno = { id: aid, ...s.data() };
    escolas = aluno.escola_id ? [aluno.escola_id] : []; turmas = aluno.turma_id ? [aluno.turma_id] : [];
  }
  const escDocs = await Promise.all(escolas.map(e => db.doc(`escolas/${e}`).get()));
  if (escDocs.some(s => !s.exists || s.data().municipio_id !== muniId)) throw new HttpsError('invalid-argument', 'Escola fora do município escolhido.');
  const turDocs = await Promise.all(turmas.map(t => db.doc(`turmas/${t}`).get()));
  if (turDocs.some(s => !s.exists || !escolas.includes(s.data().escola_id))) throw new HttpsError('invalid-argument', 'Turma fora das escolas escolhidas.');
  if (perfil !== 'secretaria' && perfil !== 'aluno' && !escolas.length) throw new HttpsError('invalid-argument', 'Marque ao menos uma escola.');
  const novo = { nome, email, perfil, status: 'ativo', municipio_id: muniId, escola_id: escolas[0] || null, escolas_ids: escolas };
  if (!podeResetar(eu, novo, uid, '__novo__')) throw new HttpsError('permission-denied', 'Você não pode cadastrar este usuário.');
  // conta: cria ou aproveita a que a pessoa já criou (sem cadastro); com cadastro, o caminho é "Gerenciar"
  const senha = gerarSenha();
  let conta = null; try { conta = await auth.getUserByEmail(email); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  if (conta) {
    if ((await db.doc(`usuarios/${conta.uid}`).get()).exists) throw new HttpsError('already-exists', 'Este e-mail já tem cadastro no Portal. Use "Gerenciar" na lista de usuários.');
    await auth.updateUser(conta.uid, { password: senha, displayName: conta.displayName || nome, emailVerified: true, disabled: false });
  } else conta = await auth.createUser({ email, password: senha, displayName: nome, emailVerified: true });
  const reg = { uid: conta.uid, ...novo, licenca_tipo: 'institucional', municipio_nome: txt(muni.nome, 80),
    escolas_nomes: escDocs.map(s => txt(s.data().nome, 120)), turmas_ids: perfil === 'aluno' ? [] : turmas, origem: 'cadastro_manual',
    criado_em: FieldValue.serverTimestamp(), criado_por: uid, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: uid };
  if (aluno) {
    const t = turDocs[0] ? turDocs[0].data() : {};
    Object.assign(reg, { aluno_id: aluno.id, turma_id: aluno.turma_id || '', turma_nome: txt(t.nome || aluno.turma_nome, 80), escola_nome: reg.escolas_nomes[0] || '' });
    delete reg.escolas_ids; delete reg.escolas_nomes;
    await auth.setCustomUserClaims(conta.uid, { aluno_id: aluno.id, escola_id: aluno.escola_id || '', turma_id: aluno.turma_id || '' });
    await db.doc(`alunos/${aluno.id}`).update({ email, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: uid });
  }
  await db.doc(`usuarios/${conta.uid}`).set(reg);
  const expira = Timestamp.fromMillis(Date.now() + VALIDADE_H * 3600e3);
  await db.doc(`senhas_provisorias/${conta.uid}`).set({ email, expira_em: expira, gerada_em: FieldValue.serverTimestamp(), gerada_por: uid, gerada_por_nome: txt(eu && eu.nome, 80), origem: 'cadastro_manual' });
  await db.collection('auditoria').add({ uid, acao: 'cadastro_manual', alvo: conta.uid, alvo_email: email, perfil, em: FieldValue.serverTimestamp() });
  return { uid: conta.uid, senha, expira_ms: expira.toMillis(), nome, google: (conta.providerData || []).some(p => p.providerId === 'google.com') };
}

export async function semCadastro({ db, auth }) {
  const contas = []; let pagina;
  do { const r = await auth.listUsers(1000, pagina); r.users.forEach(u => { if (u.email && !u.email.endsWith(DOM_TECNICO)) contas.push(u); }); pagina = r.pageToken; } while (pagina && contas.length < 20000);
  const faltam = [];
  for (let i = 0; i < contas.length; i += 300) {
    const bloco = contas.slice(i, i + 300), docs = await db.getAll(...bloco.map(u => db.doc(`usuarios/${u.uid}`)));
    docs.forEach((s, k) => { if (!s.exists) { const u = bloco[k]; faltam.push({ uid: u.uid, email: u.email, nome: u.displayName || '', criado: u.metadata.creationTime || '',
      ultimo: u.metadata.lastSignInTime || '', google: u.providerData.some(p => p.providerId === 'google.com'), verificado: !!u.emailVerified }); } });
  }
  return { contas: faltam.sort((a, b) => String(b.criado).localeCompare(String(a.criado))).slice(0, 500) };
}

export const criarUsuarioManual = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return cadastrar({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, d: req.data || {} });
});
export const contasSemCadastro = onCall({ region: REGIAO, maxInstances: 2, timeoutSeconds: 120 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const eu = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!eu || eu.perfil !== 'admin' || eu.status !== 'ativo') throw new HttpsError('permission-denied', 'Somente o administrador.');
  return semCadastro({ db: getFirestore(), auth: getAuth() });
});

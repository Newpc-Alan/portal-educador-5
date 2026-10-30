// Acesso do aluno ligado à MATRÍCULA (Ficha do Aluno), sem depender de e-mail:
//  1) Código + PIN: o professor (ou a escola) gera para a turma; cada aluno recebe um código de 6 letras e um PIN de 4 números,
//     impressos num cartão com o QR da carteirinha. Por trás existe uma conta técnica "al-<id da matrícula>".
//  2) Google da escola: a Ficha do Aluno guarda o e-mail do aluno; no 1º login com o Google a conta se liga à matrícula.
// Nos dois casos a conta recebe o claim aluno_id (assinado pelo Firebase, o navegador não consegue forjar). A prova online
// usa esse aluno_id: o aluno que entra pelos dois caminhos continua sendo uma pessoa só, com uma tentativa só.
//   alunos_acesso/{alunoId}       código, PIN, turma (só as funções leem e gravam)
//   alunos_acesso_cod/{codigo}    código -> aluno (garante código único)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { randomInt, randomBytes, timingSafeEqual } from 'node:crypto';

const REGIAO = 'southamerica-east1';
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DOMINIO = 'aluno.portaldoeducador.com.br';
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export const gerarCodigo = () => { let s = ''; for (let i = 0; i < 6; i++) s += ALFA[randomInt(ALFA.length)]; return s; };
export const gerarPin = () => { for (;;) { const p = String(randomInt(10000)).padStart(4, '0'); if (!/^(\d)\1{3}$/.test(p) && !['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '4321'].includes(p)) return p; } };
// a senha da conta técnica sai do código + PIN (o aluno só digita os dois); o navegador monta a mesma coisa
export const senhaAluno = (codigo, pin) => `pde.${codigo}.${pin}`;
export const emailAluno = codigo => `${codigo.toLowerCase()}@${DOMINIO}`;
export const uidAluno = alunoId => `al-${alunoId}`;
// QR de entrada (cartão de acesso): leva a matrícula e uma chave secreta; o link abre o Portal e entra sem digitar nada
export const URL_ENTRADA = 'https://app.portaldoeducador.com.br/entrar/';
export const gerarChaveQr = () => randomBytes(18).toString('base64url');
export const linkQr = (alunoId, chave) => `${URL_ENTRADA}#q=${alunoId}.${chave}`;
export const HORAS_QR = 4;
const escolasDe = u => [...new Set([...(u.escolas_ids || []), u.escola_id].filter(Boolean))];

// quem gera o acesso da turma: o professor da turma, a direção/secretaria da escola e o admin
export function podeGerar(u, uid, turma, turmaId) {
  if (!u || u.status !== 'ativo') return false;
  if (u.perfil === 'admin') return true;
  if (['gestor', 'secretaria_escolar'].includes(u.perfil)) return escolasDe(u).includes(turma.escola_id);
  if (u.perfil === 'professor') return (u.turmas_ids || []).includes(turmaId) || turma.criado_por === uid;
  return false;
}

export async function gerarAcesso({ db, auth, uid, turmaId, alunoId = '', novoPin = false }) {
  if (!ID.test(String(turmaId || ''))) throw new HttpsError('invalid-argument', 'Turma inválida.');
  const [us, ts] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`turmas/${turmaId}`).get()]);
  if (!ts.exists) throw new HttpsError('not-found', 'Turma não encontrada.');
  const turma = ts.data();
  if (!podeGerar(us.data(), uid, turma, turmaId)) throw new HttpsError('permission-denied', 'Você não pode gerar o acesso desta turma.');
  const sn = await db.collection('alunos').where('turma_id', '==', turmaId).get();
  let alunos = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'inativo' && a.nome);
  if (alunoId) { alunos = alunos.filter(a => a.id === alunoId); if (!alunos.length) throw new HttpsError('not-found', 'Aluno não está nesta turma.'); }
  const escola = turma.escola_id ? ((await db.doc(`escolas/${turma.escola_id}`).get()).data() || {}) : {};
  const lista = [];
  for (const a of alunos) {
    const ref = db.doc(`alunos_acesso/${a.id}`), atual = (await ref.get()).data();
    let codigo = atual && atual.codigo, pin = atual && atual.pin;
    const mudouSenha = !atual || (novoPin && !!alunoId);
    if (!codigo) {
      for (let i = 0; i < 8 && !codigo; i++) { const c = gerarCodigo(); try { await db.doc(`alunos_acesso_cod/${c}`).create({ aluno_id: a.id }); codigo = c; } catch (e) { if (e.code !== 6) throw e; } }
      if (!codigo) throw new HttpsError('internal', 'Não foi possível gerar um código único. Tente de novo.');
    }
    if (mudouSenha) pin = gerarPin();
    // chave do QR: nasce junto com o acesso e muda junto com o PIN (cartão perdido = gerar outro)
    let qrChave = atual && atual.qr_chave;
    const novaChave = !qrChave || mudouSenha;
    if (novaChave) qrChave = gerarChaveQr();
    const conta = uidAluno(a.id), nome = String(a.nome_social || a.nome).slice(0, 80);
    const claims = { aluno_id: a.id, escola_id: a.escola_id || turma.escola_id || '', turma_id: turmaId };
    if (novaChave && !mudouSenha && atual) await ref.set({ qr_chave: qrChave, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    if (mudouSenha || !atual || atual.turma_id !== turmaId || atual.nome !== nome) {
      try { await auth.updateUser(conta, { email: emailAluno(codigo), password: senhaAluno(codigo, pin), displayName: nome, disabled: false }); }
      catch (e) { if (e.code !== 'auth/user-not-found') throw e; await auth.createUser({ uid: conta, email: emailAluno(codigo), password: senhaAluno(codigo, pin), displayName: nome }); }
      await auth.setCustomUserClaims(conta, claims);
      await db.doc(`usuarios/${conta}`).set({ uid: conta, nome, email: emailAluno(codigo), perfil: 'aluno', status: 'ativo', licenca_tipo: 'institucional',
        municipio_id: a.municipio_id || turma.municipio_id || '', escola_id: claims.escola_id, escola_nome: String(escola.nome || turma.escola_nome || '').slice(0, 120),
        turma_id: turmaId, turma_nome: String(turma.nome || '').slice(0, 80), aluno_id: a.id, origem: 'matricula', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      await ref.set({ codigo, pin, qr_chave: qrChave, aluno_id: a.id, nome, escola_id: claims.escola_id, municipio_id: a.municipio_id || turma.municipio_id || '', turma_id: turmaId,
        gerado_por: uid, atualizado_em: FieldValue.serverTimestamp(), ...(atual ? {} : { criado_em: FieldValue.serverTimestamp() }) }, { merge: true });
    }
    lista.push({ aluno_id: a.id, nome, codigo, pin, qr: linkQr(a.id, qrChave), foto: a.foto || '' });
  }
  if (lista.length) await db.collection('auditoria').add({ uid, acao: alunoId ? (novoPin ? 'aluno_novo_pin' : 'aluno_acesso') : 'turma_acesso', alvo: alunoId || turmaId, em: FieldValue.serverTimestamp() });
  lista.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  return { turma: String(turma.nome || ''), escola: String(escola.nome || turma.escola_nome || ''), lista };
}

// QR da carteirinha ("PDEA:<id da matrícula>") -> código de acesso. Sem login: quem tem a carteirinha na mão ainda precisa do PIN.
// (desde a entrada por QR, o QR da carteirinha da portaria não abre mais a conta: só o cartão de acesso da turma)
export async function codigoDoQr({ qr }) {
  if (/^PDEA:/.test(String(qr || '').trim())) throw new HttpsError('failed-precondition', 'Esta é a carteirinha da portaria. Para entrar, use o cartão de acesso da turma (peça ao professor).');
  throw new HttpsError('invalid-argument', 'Este QR não é de um cartão do Portal.');
}

// entrada por QR: "<id da matrícula>.<chave>" (o que vem depois de #q= no link do cartão)
export function lerQr(txt) {
  const t = String(txt || '').trim(), m = /(?:#q=|^PDEQ:|^)([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{20,40})$/.exec(t);
  return m ? { alunoId: m[1], chave: m[2] } : null;
}
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
// só entra com a "aula aberta": o professor abre a entrada da turma no Portal e ela vale HORAS_QR horas
export async function entrarPorQr({ db, auth, q, agora = Date.now() }) {
  const r = lerQr(q);
  if (!r) throw new HttpsError('invalid-argument', 'Este QR não é de um cartão de acesso do Portal.');
  const a = (await db.doc(`alunos_acesso/${r.alunoId}`).get()).data();
  if (!a || !a.qr_chave || !igual(a.qr_chave, r.chave)) throw new HttpsError('permission-denied', 'Este cartão não vale mais. Peça um novo ao professor.');
  const aula = (await db.doc(`qr_aulas/${a.turma_id}`).get()).data();
  const ate = aula && aula.aberta_ate && aula.aberta_ate.toMillis ? aula.aberta_ate.toMillis() : 0;
  if (ate <= agora) throw new HttpsError('failed-precondition', 'A entrada por QR da sua turma está fechada. Peça ao professor para abrir a aula.');
  const token = await auth.createCustomToken(uidAluno(r.alunoId));
  await db.collection('auditoria').add({ uid: uidAluno(r.alunoId), acao: 'aluno_entrada_qr', alvo: a.turma_id || '', em: FieldValue.serverTimestamp() });
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  await db.doc('stats/entrada_qr').set({ por_dia: { [dia]: FieldValue.increment(1) }, total: FieldValue.increment(1) }, { merge: true }).catch(() => {});
  return { token, nome: a.nome || '' };
}
// abrir/fechar/consultar a entrada por QR de uma turma (mesmas pessoas que geram o acesso)
export async function entradaTurma({ db, uid, turmaId, acao, agora = Date.now() }) {
  if (!ID.test(String(turmaId || ''))) throw new HttpsError('invalid-argument', 'Turma inválida.');
  const [us, ts] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`turmas/${turmaId}`).get()]);
  if (!ts.exists) throw new HttpsError('not-found', 'Turma não encontrada.');
  if (!podeGerar(us.data(), uid, ts.data(), turmaId)) throw new HttpsError('permission-denied', 'Você não pode abrir a entrada desta turma.');
  const ref = db.doc(`qr_aulas/${turmaId}`);
  if (acao === 'abrir' || acao === 'fechar') {
    const ate = acao === 'abrir' ? new Date(agora + HORAS_QR * 3600e3) : new Date(agora);
    await ref.set({ aberta_ate: ate, por: uid, turma_nome: String(ts.data().nome || '').slice(0, 80), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    return { aberta_ate: acao === 'abrir' ? ate.getTime() : 0 };
  }
  const d = (await ref.get()).data(), ate = d && d.aberta_ate && d.aberta_ate.toMillis ? d.aberta_ate.toMillis() : 0;
  return { aberta_ate: ate > agora ? ate : 0 };
}

// conta Google (ou outro login com e-mail confirmado) do aluno: liga à matrícula pelo e-mail gravado na Ficha do Aluno
export async function vincular({ db, auth, uid, token }) {
  if (token.aluno_id) return { ok: true, ja: true };
  const email = String(token.email || '').toLowerCase();
  if (!email || token.email_verified !== true || email.endsWith('@' + DOMINIO)) return { ok: false };
  const sn = await db.collection('alunos').where('email', '==', email).limit(3).get();
  const ativos = sn.docs.filter(d => d.data().status !== 'inativo');
  if (ativos.length !== 1) return { ok: false, motivo: ativos.length ? 'duplicado' : 'nao_encontrado' };
  const ref = db.doc(`usuarios/${uid}`), atual = (await ref.get()).data();
  if (atual && atual.perfil && atual.perfil !== 'aluno') return { ok: false, motivo: 'outro_perfil' };
  const a = { id: ativos[0].id, ...ativos[0].data() };
  const turma = a.turma_id ? ((await db.doc(`turmas/${a.turma_id}`).get()).data() || {}) : {};
  await auth.setCustomUserClaims(uid, { aluno_id: a.id, escola_id: a.escola_id || '', turma_id: a.turma_id || '' });
  await ref.set({ uid, nome: String(a.nome_social || a.nome).slice(0, 80), email, perfil: 'aluno', status: 'ativo', licenca_tipo: 'institucional',
    municipio_id: a.municipio_id || turma.municipio_id || '', escola_id: a.escola_id || '', escola_nome: String(a.escola_nome || turma.escola_nome || '').slice(0, 120),
    turma_id: a.turma_id || '', turma_nome: String(turma.nome || a.turma_nome || '').slice(0, 80), aluno_id: a.id, origem: (atual && atual.origem) || 'google_matricula',
    atualizado_em: FieldValue.serverTimestamp(), ...(atual ? {} : { criado_em: FieldValue.serverTimestamp(), criado_por: uid }) }, { merge: true });
  await db.collection('auditoria').add({ uid, acao: 'aluno_vinculo_google', alvo: a.id, em: FieldValue.serverTimestamp() });
  return { ok: true, renovar: true };
}

export const gerarAcessoTurma = onCall({ region: REGIAO, timeoutSeconds: 300, memory: '512MiB', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const d = req.data || {};
  return gerarAcesso({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, turmaId: String(d.turma_id || ''), alunoId: ID.test(String(d.aluno_id || '')) ? String(d.aluno_id) : '', novoPin: !!d.novo_pin });
});
export const codigoAlunoQr = onCall({ region: REGIAO, maxInstances: 5 }, async req => codigoDoQr({ qr: (req.data || {}).qr }));
export const entrarAlunoQr = onCall({ region: REGIAO, maxInstances: 20 }, async req => entrarPorQr({ db: getFirestore(), auth: getAuth(), q: (req.data || {}).q }));
export const entradaQrTurma = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const d = req.data || {};
  return entradaTurma({ db: getFirestore(), uid: req.auth.uid, turmaId: String(d.turma_id || ''), acao: ['abrir', 'fechar'].includes(d.acao) ? d.acao : 'ver' });
});
export const vincularContaAluno = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return vincular({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, token: req.auth.token });
});

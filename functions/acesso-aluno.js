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
import { expiraAuditoria } from './auditoria.js';
import { fotoLoginLigada, registrarLoginCarteirinha } from './login-carteirinha.js';

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
  if (lista.length) await db.collection('auditoria').add({ uid, acao: alunoId ? (novoPin ? 'aluno_novo_pin' : 'aluno_acesso') : 'turma_acesso', alvo: alunoId || turmaId, em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria() });
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
// nov/2026: a carteirinha da escola ("PDEA:<id da matrícula>") também entra, mas só com a aula da turma do aluno aberta,
// a sessão é a mesma do cartão (via_qr: sai sozinha quando a aula acaba) e fica marcada na auditoria como entrada pela carteirinha.
export function lerQr(txt) {
  const t = String(txt || '').trim(), c = /^PDEA:([A-Za-z0-9_-]{1,64})$/.exec(t);
  if (c) return { alunoId: c[1], chave: null, carteirinha: true };
  const m = /(?:#q=|^PDEQ:|^)([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{20,40})$/.exec(t);
  return m ? { alunoId: m[1], chave: m[2] } : null;
}
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
// só entra com a "aula aberta": o professor abre a entrada da turma no Portal e ela vale HORAS_QR horas
export async function entrarPorQr({ db, auth, q, foto, fotoFalhou, ua, agora = Date.now(), fotoDaEscola = fotoLoginLigada, registrar = registrarLoginCarteirinha }) {
  const r = lerQr(q);
  if (!r) throw new HttpsError('invalid-argument', 'Este QR não é de um cartão de acesso do Portal.');
  const a = (await db.doc(`alunos_acesso/${r.alunoId}`).get()).data();
  if (r.carteirinha) {
    if (!a || !a.turma_id) throw new HttpsError('failed-precondition', 'Sua turma ainda não tem acesso ao Portal. Peça ao professor para gerar os cartões da turma.');
    if (a.carteirinha_bloqueada === true) throw new HttpsError('permission-denied', 'Esta carteirinha não entra mais no Portal. Use o cartão de acesso ou o código e PIN.');
  } else if (!a || !a.qr_chave || !igual(a.qr_chave, r.chave)) throw new HttpsError('permission-denied', 'Este cartão não vale mais. Peça um novo ao professor.');
  const aula = (await db.doc(`qr_aulas/${a.turma_id}`).get()).data();
  const ate = aula && aula.aberta_ate && aula.aberta_ate.toMillis ? aula.aberta_ate.toMillis() : 0;
  if (ate <= agora) throw new HttpsError('failed-precondition', 'A entrada por QR da sua turma está fechada. Peça ao professor para abrir a aula.');
  // carteirinha: com a "foto ao entrar" ligada pela escola, a tela tira a foto (câmera da frente) e chama de novo; sem câmera, entra marcado "sem foto"
  if (r.carteirinha) {
    const al = (await db.doc(`alunos/${r.alunoId}`).get()).data() || {};
    if (await fotoDaEscola(db, al.escola_id || a.escola_id)) {
      if (!foto && fotoFalhou !== true) return { precisa_foto: true, nome: a.nome || '' };
      await registrar({ db, alunoId: r.alunoId, acesso: a, foto, falhou: fotoFalhou === true, ua });
    }
  }
  // via_qr: a tela do aluno sabe que esta sessão vale só enquanto a aula estiver aberta (sai sozinha quando o tempo acaba)
  const token = await auth.createCustomToken(uidAluno(r.alunoId), { via_qr: true });
  await db.collection('auditoria').add({ uid: uidAluno(r.alunoId), acao: r.carteirinha ? 'aluno_entrada_carteirinha' : 'aluno_entrada_qr', alvo: a.turma_id || '', em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria() });
  const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  await db.doc('stats/entrada_qr').set({ por_dia: { [dia]: FieldValue.increment(1) }, total: FieldValue.increment(1) }, { merge: true }).catch(() => {});
  return { token, nome: a.nome || '' };
}
// abrir/fechar/consultar a entrada por QR de uma turma (mesmas pessoas que geram o acesso)
// tempo de aula escolhido pelo professor ao abrir (minutos) e as prorrogações; nunca passa de MAX_AULA_MIN a partir de agora
export const TEMPOS_AULA = [30, 40, 50, 60, 120], TEMPOS_PRORROGA = [5, 10, 15, 20, 30, 60], MAX_AULA_MIN = 360;
// tempo personalizado: qualquer número inteiro de minutos entre MIN_AULA_MIN e MAX_AULA_MIN (prorrogação até 120)
export const MIN_AULA_MIN = 5;
const minutosOk = (v, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= MIN_AULA_MIN && n <= max ? n : 0; };
// Portal Maestro dentro do "Dar aula" (nov/2026): ao abrir a aula no Portal, a aula do Maestro (banco newpc-sala) nasce junto,
// com o mesmo professor e a mesma turma. O aluno entra pela conta do Portal (cartão QR, código + PIN ou Google) e o Portal
// passa o número ao aparelho (extensão do Chromebook ou app do tablet): ninguém digita número. Falha no Maestro não impede a aula.
const MAESTRO_URL = 'https://newpc-sala-default-rtdb.firebaseio.com';
async function maestroFb(caminho, metodo, corpo) {
  const r = await fetch(`${MAESTRO_URL}/${caminho}.json`, { method: metodo || 'GET', headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('maestro ' + r.status);
  return r.json();
}
export async function abrirAulaMaestro({ atual, professor, turmaId, turmaNome, ate }) {
  if (/^\d{6}$/.test(String(atual || ''))) {
    const a = await maestroFb(`aulas/${atual}/controle`).catch(() => null);
    if (a && a.encerrada !== true) { await maestroFb(`aulas/${atual}/controle/ate`, 'PUT', ate); return atual; }   // a aula do Maestro desta turma ainda está aberta: reaproveita
  }
  for (let i = 0; i < 8; i++) {
    const c = String(randomInt(100000, 1000000));
    if ((await maestroFb(`aulas/${c}/criadaEm`)) !== null) continue;
    await maestroFb(`aulas/${c}`, 'PUT', { professor: String(professor || '').slice(0, 60), turma_id: turmaId, turma_nome: String(turmaNome || '').slice(0, 80), origem: 'portal',
      criadaEm: { '.sv': 'timestamp' }, controle: { encerrada: false, bloqueioGeral: false, ate, professorVivo: { '.sv': 'timestamp' } } });
    return c;
  }
  throw new Error('maestro: sem número livre');
}
export async function encerrarAulaMaestro(codigo) {
  if (!/^\d{6}$/.test(String(codigo || ''))) return;
  await maestroFb(`aulas/${codigo}/controle`, 'PATCH', { encerrada: true, bloqueioGeral: false, bloqueio: null });
  await maestroFb(`aulas/${codigo}/encerradaEm`, 'PUT', { '.sv': 'timestamp' });
}

export async function entradaTurma({ db, uid, turmaId, acao, minutos, agora = Date.now(), maestro = true }) {
  if (!ID.test(String(turmaId || ''))) throw new HttpsError('invalid-argument', 'Turma inválida.');
  const [us, ts] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`turmas/${turmaId}`).get()]);
  if (!ts.exists) throw new HttpsError('not-found', 'Turma não encontrada.');
  if (!podeGerar(us.data(), uid, ts.data(), turmaId)) throw new HttpsError('permission-denied', 'Você não pode abrir a entrada desta turma.');
  const ref = db.doc(`qr_aulas/${turmaId}`);
  if (acao === 'abrir' || acao === 'fechar' || acao === 'prorrogar') {
    const nome = String(ts.data().nome || '').slice(0, 80);
    if (acao === 'fechar') {
      const cod = maestro ? ((await ref.get()).data() || {}).maestro_codigo : '';
      await ref.set({ aberta_ate: new Date(agora), por: uid, turma_nome: nome, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      if (cod) await encerrarAulaMaestro(cod).catch(e => console.warn('maestro (fechar):', e.message));
      return { aberta_ate: 0 };
    }
    let ate;
    if (acao === 'abrir') {
      const min = minutosOk(minutos, MAX_AULA_MIN) || 60;
      ate = new Date(agora + min * 60e3);
      let maestro_codigo = '';
      if (maestro) {
        const ant = (await ref.get()).data() || {}, aberta = ant.aberta_ate && ant.aberta_ate.toMillis && ant.aberta_ate.toMillis() > agora;
        maestro_codigo = await abrirAulaMaestro({ atual: aberta ? ant.maestro_codigo : '', professor: (us.data() || {}).nome, turmaId, turmaNome: nome, ate: ate.getTime() }).catch(e => { console.warn('maestro (abrir):', e.message); return ''; });
      }
      await ref.set({ aberta_ate: ate, aberta_em: new Date(agora), duracao_min: min, prorrogado_min: 0, por: uid, turma_nome: nome, maestro_codigo, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    } else {
      const min = minutosOk(minutos, 120) || 10;
      const d0 = (await ref.get()).data() || {}, atual = d0.aberta_ate && d0.aberta_ate.toMillis ? d0.aberta_ate.toMillis() : 0;
      ate = new Date(Math.min(Math.max(atual, agora) + min * 60e3, agora + MAX_AULA_MIN * 60e3));
      await ref.set({ aberta_ate: ate, por: uid, turma_nome: nome, prorrogado_min: FieldValue.increment(min), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      const mc = maestro ? String(d0.maestro_codigo || '') : '';
      if (/^\d{6}$/.test(mc)) await maestroFb(`aulas/${mc}/controle/ate`, 'PUT', ate.getTime()).catch(e => console.warn('maestro (prorrogar):', e.message));
    }
    return { aberta_ate: ate.getTime(), maestro_codigo: String(((await ref.get()).data() || {}).maestro_codigo || '') };
  }
  const d = (await ref.get()).data(), ate = d && d.aberta_ate && d.aberta_ate.toMillis ? d.aberta_ate.toMillis() : 0;
  return { aberta_ate: ate > agora ? ate : 0, maestro_codigo: ate > agora ? String((d && d.maestro_codigo) || '') : '' };
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
  await db.collection('auditoria').add({ uid, acao: 'aluno_vinculo_google', alvo: a.id, em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria() });
  return { ok: true, renovar: true };
}

export const gerarAcessoTurma = onCall({ region: REGIAO, timeoutSeconds: 300, memory: '512MiB', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const d = req.data || {};
  return gerarAcesso({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, turmaId: String(d.turma_id || ''), alunoId: ID.test(String(d.aluno_id || '')) ? String(d.aluno_id) : '', novoPin: !!d.novo_pin });
});
export const codigoAlunoQr = onCall({ region: REGIAO, maxInstances: 5 }, async req => codigoDoQr({ qr: (req.data || {}).qr }));
export const entrarAlunoQr = onCall({ region: REGIAO, maxInstances: 20, memory: '512MiB' }, async req => { const d = req.data || {};
  return entrarPorQr({ db: getFirestore(), auth: getAuth(), q: d.q, foto: d.foto, fotoFalhou: d.foto_falhou === true, ua: req.rawRequest && req.rawRequest.headers ? req.rawRequest.headers['user-agent'] : '' }); });
export const entradaQrTurma = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const d = req.data || {};
  return entradaTurma({ db: getFirestore(), uid: req.auth.uid, turmaId: String(d.turma_id || ''), acao: ['abrir', 'fechar', 'prorrogar'].includes(d.acao) ? d.acao : 'ver', minutos: d.minutos });
});
export const vincularContaAluno = onCall({ region: REGIAO, maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return vincular({ db: getFirestore(), auth: getAuth(), uid: req.auth.uid, token: req.auth.token });
});

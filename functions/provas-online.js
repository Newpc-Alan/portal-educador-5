// Prova online: o professor aplica uma prova do Gerador para a turma, o aluno faz no Portal em modo protegido
// e as questões objetivas são corrigidas aqui no servidor (o aluno nunca recebe o gabarito).
//   provas_online/{id}                       questões sem gabarito, janela, turma e alunos (o aluno lê)
//   provas_online_gab/{id}                   gabarito (só o professor dono e as funções)
//   provas_online/{id}/po_tentativas/{uid}   respostas do aluno, prazo, desvios e situação
//   provas_online/{id}/po_resultados/{uid}   nota e correção (o aluno só lê depois do fim da janela)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { fimDoAnoLetivo } from './fotos-provas.js';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';

const REGIAO = 'southamerica-east1';
const ABRE_EM_MS = 10000;
const ESPERA_MAX_MS = 6 * 3600e3;   // sala de espera sem o professor iniciar: cancela depois de 6 h   // "aplicar agora": a prova abre 10 s depois (todos começam juntos)
const TIPOS = ['multipla', 'checkbox', 'vf', 'curta', 'dissertativa', 'grade_radio', 'grade_check'];
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const txt = (s, n) => String(s == null ? '' : s).slice(0, n);
const ms = t => t && t.toMillis ? t.toMillis() : 0;

async function quem(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Cadastro inativo.');
  return { uid: req.auth.uid, ...u };
}
const ehProf = u => ['professor', 'gestor', 'admin'].includes(u.perfil);

// imagem da questão: data URL vira arquivo no Storage; link https fica como está
async function guardarImagem(provaId, i, src) {
  src = String(src || '');
  if (/^https:\/\//.test(src)) return src.slice(0, 1000);
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(src);
  if (!m) return '';
  const buf = Buffer.from(m[3], 'base64'); if (buf.length > 3 * 1024 * 1024) return '';
  const bucket = getStorage().bucket(), token = randomUUID(), caminho = `provas_online/${provaId}/img-${i}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  await bucket.file(caminho).save(buf, { contentType: m[1], metadata: { cacheControl: 'private, max-age=86400', metadata: { firebaseStorageDownloadTokens: token } } });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

// alunos da turma:
//  - pela MATRÍCULA (Ficha do Aluno): todo aluno ativo da turma, com ou sem conta; ele entra com código + PIN ou com o Google da escola
//    e é reconhecido pelo claim aluno_id. A tentativa fica em po_tentativas/m-<id da matrícula>.
//  - contas antigas de aluno sem matrícula ligada: mesma escola e mesmo nome de turma (sem diferenciar acento, espaço e "º")
async function alunosDaTurma(turmaId, turma) {
  const db = getFirestore(), alvo = semAcento(turma.nome).replace(/\bano\b|º|ª/g, '').replace(/\s+/g, '');
  const [sm, s] = await Promise.all([db.collection('alunos').where('turma_id', '==', turmaId).get(),
    db.collection('usuarios').where('perfil', '==', 'aluno').where('escola_id', '==', turma.escola_id).get()]);
  const mat = [], contas = [];
  sm.forEach(d => { const a = d.data(); if (a.status === 'inativo' || !a.nome) return; mat.push({ uid: 'm-' + d.id, aluno_id: d.id, nome: txt(a.nome_social || a.nome, 80) }); });
  s.forEach(d => { const u = d.data(); if (u.status !== 'ativo' || u.aluno_id) return;
    const t = semAcento(u.turma_nome).replace(/\bano\b|º|ª/g, '').replace(/\s+/g, '');
    if (t && t === alvo) contas.push({ uid: d.id, nome: txt(u.nome || u.email, 80) }); });
  const ord = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
  return { lista: [...mat, ...contas].sort(ord), ids: mat.map(a => a.aluno_id), uids: contas.map(a => a.uid) };
}
// quem é o aluno nesta prova: a matrícula (claim aluno_id) ou, nas contas antigas, o próprio uid
export const chaveAluno = (auth) => auth.token && auth.token.aluno_id ? 'm-' + auth.token.aluno_id : auth.uid;
function alunoDaProva(p, auth) {
  if (auth.token && auth.token.aluno_id && (p.alunos_ids || []).includes(auth.token.aluno_id)) return 'm-' + auth.token.aluno_id;
  if ((p.alunos_uids || []).includes(auth.uid)) return auth.uid;
  return '';
}

// Classificação da prova (vem de Provas e Avaliações): diz se vale nota e em qual período entra em Notas e Médias.
export const FINALIDADES = { avaliacao: true, trabalho: true, recuperacao: true, diagnostica: false, exercicio: false, simulado: false };
export function classificar(d) {
  const finalidade = Object.prototype.hasOwnProperty.call(FINALIDADES, d.finalidade) ? d.finalidade : null;
  const periodos = [2, 3, 4].includes(Number(d.periodos)) ? Number(d.periodos) : 4;
  const p = Number(d.periodo), periodo = Number.isInteger(p) && p >= 1 && p <= periodos ? p : null;
  const a = Number(d.ano_letivo), ano = Number.isInteger(a) && a >= 2020 && a <= 2100 ? a : new Date().getFullYear();
  if (finalidade && FINALIDADES[finalidade] && !periodo) throw new HttpsError('invalid-argument', 'Escolha o bimestre (ou trimestre/semestre) da prova.');
  // sem finalidade = prova aplicada por uma versão antiga da tela: fica como antes (o professor escolhe na hora de puxar)
  return { finalidade, vale_nota: finalidade ? FINALIDADES[finalidade] : null, periodo, periodos, ano_letivo: ano };
}
// erros de português: em Língua Portuguesa contam na nota; nas outras disciplinas avalia-se o conteúdo (o professor pode mudar)
export const criterioPadrao = disc => /portugu|reda[cç][aã]o|l[ií]ngua materna|literatura/i.test(String(disc || '')) ? 'descontar' : 'conteudo';
export const CRITERIOS = ['conteudo', 'apontar', 'descontar'];
export const publicarProvaOnline = onCall({ region: REGIAO, timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  const u = await quem(req); if (!ehProf(u)) throw new HttpsError('permission-denied', 'Somente professores.');
  const d = req.data || {}, db = getFirestore();
  const turma = d.turma_id ? (await db.doc(`turmas/${d.turma_id}`).get()).data() : null;
  if (!turma) throw new HttpsError('invalid-argument', 'Escolha a turma.');
  const minhas = new Set(u.turmas_ids || []), escolas = new Set(u.escolas_ids && u.escolas_ids.length ? u.escolas_ids : [u.escola_id]);
  if (u.perfil !== 'admin' && !(minhas.has(d.turma_id) || turma.criado_por === u.uid || (u.perfil === 'gestor' && escolas.has(turma.escola_id))))
    throw new HttpsError('permission-denied', 'Essa turma não é sua.');
  // recurso contratado: o município da turma precisa ter "Prova online" no plano
  if (u.perfil !== 'admin') {
    const mid = turma.municipio_id || (turma.escola_id ? ((await db.doc(`escolas/${turma.escola_id}`).get()).data() || {}).municipio_id : '');
    const m = mid ? (await db.doc(`municipios/${mid}`).get()).data() : null;
    // ...ou liberada só para este professor pelo administrador (usuarios.recursos_extra; o usuário não grava esse campo)
    const extra = Array.isArray(u.recursos_extra) && u.recursos_extra.includes('prova_online');
    if (!extra && (!m || !Array.isArray(m.recursos) || !m.recursos.includes('prova_online')))
      throw new HttpsError('failed-precondition', 'A Prova online não está incluída no plano da sua rede. Fale com a NEWPC.');
  }
  const dur = Math.round(Number(d.duracao_min));
  if (!(dur >= 5 && dur <= 300)) throw new HttpsError('invalid-argument', 'A duração vai de 5 a 300 minutos.');
  const cls = classificar(d);
  // "aplicar agora": o horário vem do servidor (relógio errado em tablet ou computador não atrapalha);
  // fica aberta pelo tempo de prova + a tolerância para entrar, e o professor encerra quando quiser
  const agoraModo = d.modo === 'agora', tol = Math.min(120, Math.max(0, Math.round(Number(d.tolerancia_min ?? 10)) || 0));
  // "aplicar agora": a prova vai para a SALA DE ESPERA dos alunos e só abre quando o professor clicar em "Iniciar"
  // (contagem de 10 s no tablet). Até lá a janela fica num prazo de segurança: se ninguém iniciar em 6 h, ela é cancelada.
  const abre = agoraModo ? Date.now() + ESPERA_MAX_MS : Number(d.abre_em), fecha = agoraModo ? abre + 60000 : Number(d.fecha_em);
  if (!(abre > 0 && fecha > abre)) throw new HttpsError('invalid-argument', 'Confira o horário de abertura e de encerramento.');
  if (fecha < Date.now()) throw new HttpsError('invalid-argument', 'O encerramento já passou.');
  const qs = Array.isArray(d.questoes) ? d.questoes.filter(q => q && TIPOS.includes(q.tipo) && String(q.enun || '').trim()) : [];
  if (!qs.length) throw new HttpsError('invalid-argument', 'A prova não tem questões.');
  if (qs.length > 100) throw new HttpsError('invalid-argument', 'Máximo de 100 questões.');
  const R = await alunosDaTurma(d.turma_id, turma), alunos = R.lista;
  if (!alunos.length) throw new HttpsError('failed-precondition', 'A turma "' + turma.nome + '" ainda não tem alunos matriculados. Cadastre na Ficha do Aluno.');
  const ref = db.collection('provas_online').doc(), pub = [], gab = {};
  let total = 0, objetivas = 0;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i], id = 'q' + (i + 1), valor = Math.max(0, Math.min(100, Number(String(q.valor ?? 1).replace(',', '.')) || 0));
    const imgs = [];
    for (const [k, src] of (Array.isArray(q.imgs) ? q.imgs : (q.img ? [q.img] : [])).slice(0, 4).entries()) { const x = await guardarImagem(ref.id, i + '-' + k, src); if (x) imgs.push(x); }
    const p = { id, tipo: q.tipo, enun: txt(q.enun, 4000), valor, imgs };
    if (q.tipo === 'multipla' || q.tipo === 'checkbox') p.alts = (q.alts || []).map(a => txt(a, 600)).filter(Boolean).slice(0, 8);
    if (q.tipo.startsWith('grade')) { p.linhas = (q.linhas || []).map(a => txt(a, 300)).slice(0, 12); p.cols = (q.cols || q.colunas || []).map(a => txt(a, 120)).slice(0, 8); }
    if (q.bncc) p.bncc = txt(q.bncc, 20);
    pub.push(p); total += valor;
    // gabarito: só o que dá para corrigir sozinho
    const g = { tipo: q.tipo, valor };
    if (q.tipo === 'multipla' && Number.isInteger(q.gab) && q.gab >= 0 && q.gab < (p.alts || []).length) { g.gab = q.gab; objetivas++; }
    else if (q.tipo === 'vf' && (q.gab === 'V' || q.gab === 'F')) { g.gab = q.gab; objetivas++; }
    else if (q.tipo === 'checkbox' && gabVarias(q.gab, (p.alts || []).length)) { g.gab = gabVarias(q.gab, p.alts.length); g.n = p.alts.length; if (q.pont === 'tudo') g.pont = 'tudo'; objetivas++; }
    else if (q.tipo.startsWith('grade') && gabGrade(q.tipo, q.gab, p.linhas.length, p.cols.length)) { g.gab = gabGrade(q.tipo, q.gab, p.linhas.length, p.cols.length); objetivas++; }
    else if (q.tipo === 'curta' && String(q.exp || '').trim()) { g.aceitas = String(q.exp).split(/[;|\n]/).map(x => semAcento(x)).filter(Boolean).slice(0, 10); g.exp = txt(q.exp, 300); }
    else if (q.exp) g.exp = txt(q.exp, 1000);
    gab[id] = g;
  }
  const doc = {
    professor_uid: u.uid, professor_nome: txt(u.nome, 80), titulo: txt(d.titulo || 'Prova', 120), disciplina: txt(d.disciplina, 60),
    turma_id: d.turma_id, turma_nome: txt(turma.nome, 80), escola_id: turma.escola_id || '', municipio_id: turma.municipio_id || u.municipio_id || '',
    abre_em: Timestamp.fromMillis(abre), fecha_em: Timestamp.fromMillis(fecha), duracao_min: dur, embaralhar: !!d.embaralhar, avisos_max: Math.min(3, Math.max(0, Number(d.avisos ?? 1))),
    questoes: pub, total_pontos: Math.round(total * 100) / 100, objetivas, alunos_uids: R.uids, alunos_ids: R.ids, alunos: alunos.slice(0, 200).map(a => ({ uid: a.uid, nome: a.nome })),
    status: 'agendada', notas: d.notas === 'reter' ? 'reter' : 'fim', modo: agoraModo ? 'agora' : 'horario', tolerancia_min: agoraModo ? tol : null, nota_liberada: false, criado_em: FieldValue.serverTimestamp(),
    aguardando: agoraModo, fotos: d.fotos === true, criterio_lingua: criterioPadrao(d.disciplina), ...(d.fotos === true ? { fotos_ate: Timestamp.fromMillis(fimDoAnoLetivo()) } : {}), ...cls
  };
  if (JSON.stringify(doc).length > 900000) throw new HttpsError('invalid-argument', 'A prova ficou grande demais (imagens). Use imagens menores.');
  const b = db.batch(); b.set(ref, doc); b.set(db.doc(`provas_online_gab/${ref.id}`), { professor_uid: u.uid, gab }); await b.commit();
  return { id: ref.id, alunos: alunos.length, objetivas, questoes: pub.length, matriculas: R.ids.length, modo: agoraModo ? 'agora' : 'horario', abre_em: abre, fecha_em: fecha };
});

// Recuperação (LDB art. 24, V, "e": estudos de recuperação para baixo rendimento, de preferência paralelos ao período letivo):
// o professor reaplica a mesma prova só para os alunos escolhidos que já entregaram. A prova original NÃO é alterada
// (fica o registro); a recuperação é uma prova nova, ligada à original, e guarda a nota original de cada aluno.
export const aplicarRecuperacao = onCall({ region: REGIAO, timeoutSeconds: 60 }, async (req) => {
  const u = await quem(req), d = req.data || {}, db = getFirestore(), id = String(d.id || '');
  const oref = db.doc(`provas_online/${id}`), [os, gs] = await Promise.all([oref.get(), db.doc(`provas_online_gab/${id}`).get()]);
  const o = os.data(); if (!o) throw new HttpsError('not-found', 'Prova não encontrada.');
  if (o.professor_uid !== u.uid && u.perfil !== 'admin') throw new HttpsError('permission-denied', 'Somente o professor da prova.');
  if (o.recuperacao_de) throw new HttpsError('failed-precondition', 'Aplique a recuperação a partir da prova original.');
  const pedidos = [...new Set((Array.isArray(d.uids) ? d.uids : []).map(String))].slice(0, 200);
  const [ts, rs] = await Promise.all([oref.collection('po_tentativas').get(), oref.collection('po_resultados').get()]);
  const tent = {}, res = {}; ts.forEach(x => { tent[x.id] = x.data(); }); rs.forEach(x => { res[x.id] = x.data(); });
  const alunos = (o.alunos || []).filter(a => pedidos.includes(a.uid) && tent[a.uid] && tent[a.uid].status === 'entregue');
  if (!alunos.length) throw new HttpsError('invalid-argument', 'Escolha alunos que já entregaram a prova.');
  const dur = Math.round(Number(d.duracao_min || o.duracao_min));
  if (!(dur >= 5 && dur <= 300)) throw new HttpsError('invalid-argument', 'A duração vai de 5 a 300 minutos.');
  const agoraModo = d.modo !== 'horario', tol = Math.min(120, Math.max(0, Math.round(Number(d.tolerancia_min ?? 10)) || 0));
  const abre = agoraModo ? Date.now() + ABRE_EM_MS : Number(d.abre_em), fecha = agoraModo ? abre + (dur + tol) * 60000 : Number(d.fecha_em);
  if (!(abre > 0 && fecha > abre) || fecha < Date.now()) throw new HttpsError('invalid-argument', 'Confira o horário da recuperação.');
  const ref = db.collection('provas_online').doc(), originais = {};
  alunos.forEach(a => { const r = res[a.uid]; originais[a.uid] = r ? { nota: r.nota, total: r.total, pendentes: r.pendentes || 0 } : null; });
  const doc = { professor_uid: o.professor_uid, professor_nome: o.professor_nome, titulo: txt('Recuperação · ' + o.titulo, 120), disciplina: o.disciplina || '',
    turma_id: o.turma_id, turma_nome: o.turma_nome, escola_id: o.escola_id || '', municipio_id: o.municipio_id || '',
    abre_em: Timestamp.fromMillis(abre), fecha_em: Timestamp.fromMillis(fecha), duracao_min: dur, embaralhar: d.embaralhar !== false, avisos_max: o.avisos_max ?? 1,
    questoes: o.questoes, total_pontos: o.total_pontos, objetivas: o.objetivas,
    alunos_uids: alunos.filter(a => !a.uid.startsWith('m-')).map(a => a.uid), alunos_ids: alunos.filter(a => a.uid.startsWith('m-')).map(a => a.uid.slice(2)), alunos,
    status: 'agendada', notas: d.notas === 'reter' ? 'reter' : 'fim', modo: agoraModo ? 'agora' : 'horario', tolerancia_min: agoraModo ? tol : null, nota_liberada: false,
    fotos: !!o.fotos && !o.fotos_apagadas, ...(o.fotos && !o.fotos_apagadas ? { fotos_ate: o.fotos_ate || Timestamp.fromMillis(fimDoAnoLetivo()) } : {}), finalidade: 'recuperacao', vale_nota: true, periodo: o.periodo ?? null, periodos: o.periodos ?? null, ano_letivo: o.ano_letivo ?? new Date().getFullYear(),
    recuperacao_de: id, recuperacao_de_titulo: o.titulo, notas_originais: originais, regra_nota: 'maior', criado_em: FieldValue.serverTimestamp(), criado_por_nome: txt(u.nome, 60) };
  const b = db.batch();
  b.set(ref, doc); b.set(db.doc(`provas_online_gab/${ref.id}`), { professor_uid: o.professor_uid, gab: (gs.data() || {}).gab || {} });
  b.update(oref, { recuperacoes: FieldValue.arrayUnion({ id: ref.id, alunos: alunos.length, em: Date.now(), por: txt(u.nome, 60) }) });
  await b.commit();
  return { id: ref.id, alunos: alunos.length, abre_em: abre, fecha_em: fecha };
});

// embaralha de forma determinística por aluno
function embaralhar(arr, semente) {
  const a = arr.slice(); let s = 0; for (const c of semente) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const iniciarProvaOnline = onCall({ region: REGIAO }, async (req) => {
  const u = await quem(req), id = String((req.data || {}).id || ''), db = getFirestore();
  const pref = db.doc(`provas_online/${id}`), p = (await pref.get()).data();
  const chave = p ? alunoDaProva(p, req.auth) : '';
  if (!chave) throw new HttpsError('not-found', 'Prova não encontrada para você.');
  const agora = Date.now();
  const tref = pref.collection('po_tentativas').doc(chave);
  return db.runTransaction(async tx => {
    const t = (await tx.get(tref)).data();
    if (t) return { situacao: t.status, prazo: ms(t.prazo), agora };
    if (p.status !== 'agendada') throw new HttpsError('failed-precondition', 'Esta prova foi encerrada.');
    if (p.aguardando) throw new HttpsError('failed-precondition', 'Aguarde: o professor ainda não iniciou a prova.');
    if (agora < ms(p.abre_em)) throw new HttpsError('failed-precondition', 'A prova ainda não abriu.');
    if (agora > ms(p.fecha_em)) throw new HttpsError('failed-precondition', 'O horário da prova terminou.');
    const prazo = Math.min(agora + p.duracao_min * 60000, ms(p.fecha_em));
    const ordem = p.embaralhar ? embaralhar(p.questoes.map(q => q.id), chave + id) : p.questoes.map(q => q.id);
    const alts = {};
    if (p.embaralhar) p.questoes.forEach(q => { if (q.alts) alts[q.id] = embaralhar(q.alts.map((_, i) => i), chave + q.id); });
    tx.set(tref, { uid: chave, conta_uid: u.uid, nome: txt(((p.alunos || []).find(a => a.uid === chave) || {}).nome || u.nome || u.email, 80), status: 'em_andamento', inicio: Timestamp.fromMillis(agora), prazo: Timestamp.fromMillis(prazo),
      ordem, ordem_alts: alts, respostas: {}, desvios: 0, avisos_max: p.avisos_max, eventos: [], atualizado_em: FieldValue.serverTimestamp() });
    return { situacao: 'em_andamento', prazo, agora };
  });
});

// resposta curta: além de ignorar acento e maiúscula, aceita erro pequeno de digitação e número escrito de outro jeito
export function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// "3,5", "3.5", "7/2", "R$ 3,50", "12 cm" -> { n, resto }
export function numero(s) {
  const m = /^\s*(?:r\$\s*)?(-?\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*(.*)$/i.exec(String(s == null ? '' : s).replace(/^\s*=\s*/, ''));
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.')), q = m[2] ? parseFloat(m[2].replace(',', '.')) : 1;
  if (!isFinite(v) || !q) return null;
  return { n: v / q, resto: semAcento(m[3]) };
}
export function conferirCurta(g, r) {
  const resp = semAcento(r); if (!resp) return null;
  if (g.aceitas.includes(resp)) return 'exata';
  const nr = numero(r), esperadas = String(g.exp || '').split(/[;|\n]/).map(x => x.trim()).filter(Boolean);
  if (nr && esperadas.some(e => { const ne = numero(e); return ne && Math.abs(ne.n - nr.n) < 1e-9 && (!ne.resto || !nr.resto || ne.resto === nr.resto); })) return 'numero';
  // erro de digitação: até 1 letra em palavras curtas (5 a 9) e até 2 nas longas; números não entram aqui
  if (!/\d/.test(resp) && g.aceitas.some(a => !/\d/.test(a) && a.length >= 5 && distancia(a, resp) <= (a.length >= 10 ? 2 : 1))) return 'aproximada';
  return null;
}
// gabarito de "várias respostas": índices únicos e válidos, pelo menos um
export function gabVarias(gab, n) {
  const c = [...new Set((Array.isArray(gab) ? gab : []).filter(x => Number.isInteger(x) && x >= 0 && x < n))].sort((a, b) => a - b);
  return c.length ? c : null;
}
// gabarito da grade: uma resposta por linha (todas preenchidas). Na de várias respostas vira mapa
// { "0": [..], "1": [..] }, porque o Firestore não guarda lista dentro de lista.
export function gabGrade(tipo, gab, L, C) {
  if (!Array.isArray(gab) || !L || !C || gab.length < L) return null;
  const ok = c => Number.isInteger(c) && c >= 0 && c < C;
  if (tipo === 'grade_radio') return gab.slice(0, L).every(ok) ? gab.slice(0, L) : null;
  const m = {};
  for (let i = 0; i < L; i++) { const x = Array.isArray(gab[i]) ? [...new Set(gab[i])].filter(ok).sort((a, b) => a - b) : []; if (!x.length) return null; m[String(i)] = x; }
  return m;
}
const r2 = n => Math.round(n * 100) / 100;
// várias respostas: cada certa marcada soma 1/(nº de certas); cada errada marcada desconta 1/(nº de erradas); mínimo zero.
// Quem marca tudo fica com zero. Com "tudo ou nada", só pontua se marcar exatamente as certas.
export function notaVarias(q, g, r) {
  const marc = new Set((Array.isArray(r) ? r : []).map(Number).filter(Number.isInteger));
  if (!marc.size) return { auto: true, ok: false, pontos: 0, branco: true };
  const certas = g.gab.filter(i => marc.has(i)).length, erradas = [...marc].filter(i => !g.gab.includes(i)).length;
  const nErr = Math.max(0, (g.n || (q.alts || []).length) - g.gab.length), ok = certas === g.gab.length && erradas === 0;
  const frac = g.pont === 'tudo' ? (ok ? 1 : 0) : Math.max(0, certas / g.gab.length - (nErr ? erradas / nErr : 0));
  return { auto: true, ok, pontos: r2(q.valor * frac), certas, erradas, n_certas: g.gab.length, ...(g.pont === 'tudo' ? { tudo: true } : {}) };
}
// grade: cada linha vale uma parte; na de várias respostas a linha só conta se estiver toda certa
export function notaGrade(q, g, r) {
  const v = r && typeof r === 'object' && !Array.isArray(r) ? r : {}, L = (q.linhas || []).length;
  if (!Object.keys(v).length) return { auto: true, ok: false, pontos: 0, branco: true };
  let lok = 0;
  for (let i = 0; i < L; i++) {
    const resp = v[i] ?? v[String(i)];
    if (q.tipo === 'grade_radio') { if (resp != null && Number(resp) === g.gab[i]) lok++; }
    else { const esp = g.gab[String(i)] || [], m = [...new Set((Array.isArray(resp) ? resp : []).map(Number))].sort((a, b) => a - b);
      if (m.length === esp.length && m.every((x, k) => x === esp[k])) lok++; }
  }
  return { auto: true, ok: lok === L, pontos: r2(q.valor * lok / L), linhas_ok: lok, linhas: L };
}
// correção: objetivas automáticas; curta confere com as respostas aceitas; o resto fica para o professor
export function corrigir(p, gab, respostas) {
  const por = {}; let pontos = 0, max = 0, pendentes = 0;
  for (const q of p.questoes) {
    const g = gab[q.id] || {}, r = respostas ? respostas[q.id] : undefined; max += q.valor;
    if (q.tipo === 'multipla' && 'gab' in g) { const ok = Number(r) === g.gab; por[q.id] = { auto: true, ok, pontos: ok ? q.valor : 0 }; }
    else if (q.tipo === 'vf' && 'gab' in g) { const ok = r === g.gab; por[q.id] = { auto: true, ok, pontos: ok ? q.valor : 0 }; }
    else if (q.tipo === 'checkbox' && Array.isArray(g.gab) && g.gab.length) por[q.id] = notaVarias(q, g, r);
    else if (q.tipo.startsWith('grade') && g.gab) por[q.id] = notaGrade(q, g, r);
    else if (q.tipo === 'curta' && g.aceitas && g.aceitas.length) {
      const como = conferirCurta(g, r);
      por[q.id] = como ? { auto: true, ok: true, pontos: q.valor, ...(como === 'aproximada' ? { aproximada: true } : {}) } : (r == null || String(r).trim() === '' ? { auto: true, ok: false, pontos: 0 } : { auto: false, pendente: true, pontos: 0 });
      if (por[q.id].pendente) pendentes++;
    } else if (r == null || (typeof r === 'string' && !r.trim()) || (typeof r === 'object' && !Object.keys(r).length)) por[q.id] = { auto: true, ok: false, pontos: 0, branco: true };
    else { por[q.id] = { auto: false, pendente: true, pontos: 0 }; pendentes++; }
    pontos += por[q.id].pontos;
  }
  return { por_questao: por, pontos_auto: Math.round(pontos * 100) / 100, total: Math.round(max * 100) / 100, pendentes, situacao: pendentes ? 'aguardando_correcao' : 'corrigida' };
}
async function finalizar(provaId, uid, motivo) {
  const db = getFirestore(), pref = db.doc(`provas_online/${provaId}`), tref = pref.collection('po_tentativas').doc(uid);
  const [ps, gs] = await Promise.all([pref.get(), db.doc(`provas_online_gab/${provaId}`).get()]);
  const p = ps.data(), gab = (gs.data() || {}).gab || {};
  return db.runTransaction(async tx => {
    const t = (await tx.get(tref)).data();
    if (!t || t.status === 'entregue') return { ja: true };
    const r = corrigir(p, gab, t.respostas || {});
    tx.update(tref, { status: 'entregue', entregue_em: FieldValue.serverTimestamp(), motivo_entrega: motivo });
    tx.set(pref.collection('po_resultados').doc(uid), { uid, nome: t.nome, ...r, nota: r.pontos_auto, motivo_entrega: motivo, corrigido_em: FieldValue.serverTimestamp() });
    return { ok: true, pendentes: r.pendentes };
  });
}
export const entregarProvaOnline = onCall({ region: REGIAO }, async (req) => {
  await quem(req); const id = String((req.data || {}).id || '');
  const p = (await getFirestore().doc(`provas_online/${id}`).get()).data() || {}, chave = alunoDaProva(p, req.auth) || chaveAluno(req.auth);
  const t = (await getFirestore().doc(`provas_online/${id}/po_tentativas/${chave}`).get()).data();
  if (!t) throw new HttpsError('not-found', 'Tentativa não encontrada.');
  if (t.status === 'bloqueada') throw new HttpsError('failed-precondition', 'A prova está bloqueada. Chame o professor.');
  const r = await finalizar(id, chave, ms(t.prazo) < Date.now() ? 'tempo' : 'aluno');
  return { ok: true, ja: !!r.ja };
});

// ações do professor no painel ao vivo
export const acaoProvaOnline = onCall({ region: REGIAO }, async (req) => {
  const u = await quem(req), d = req.data || {}, db = getFirestore();
  const pref = db.doc(`provas_online/${String(d.id || '')}`), p = (await pref.get()).data();
  if (!p) throw new HttpsError('not-found', 'Prova não encontrada.');
  if (p.professor_uid !== u.uid && u.perfil !== 'admin') throw new HttpsError('permission-denied', 'Somente o professor da prova.');
  const agora = Date.now();
  if (d.acao === 'liberar' || d.acao === 'tempo') {
    const tref = pref.collection('po_tentativas').doc(String(d.uid || '')), t = (await tref.get()).data();
    if (!t) throw new HttpsError('not-found', 'O aluno ainda não começou.');
    if (d.acao === 'tempo') {
      const min = Math.min(60, Math.max(1, Math.round(Number(d.min) || 10)));
      await tref.update({ prazo: Timestamp.fromMillis(Math.max(ms(t.prazo), agora) + min * 60000), eventos: FieldValue.arrayUnion({ t: agora, e: 'mais_tempo', min, por: txt(u.nome, 60) }) });
      return { ok: true };
    }
    if (t.status === 'entregue') throw new HttpsError('failed-precondition', 'O aluno já entregou.');
    const zerar = d.modo === 'zerar';
    const restante = zerar ? p.duracao_min * 60000 : Math.max(5 * 60000, ms(t.prazo) - (ms(t.bloqueado_em) || agora));
    await tref.update({ status: 'em_andamento', desvios: 0, prazo: Timestamp.fromMillis(agora + restante), ...(zerar ? { respostas: {} } : {}),
      eventos: FieldValue.arrayUnion({ t: agora, e: zerar ? 'liberada_zerada' : 'liberada', por: txt(u.nome, 60) }), liberacoes: FieldValue.increment(1) });
    return { ok: true };
  }
  if (d.acao === 'encerrar') {
    const s = await pref.collection('po_tentativas').where('status', 'in', ['em_andamento', 'bloqueada']).get();
    for (const x of s.docs) await finalizar(pref.id, x.id, 'encerrada_professor');
    // nota para o aluno: mostrar agora, ou guardar até o fechamento do bimestre (o professor libera depois)
    const notas = d.notas === 'agora' ? { nota_liberada: true, notas: 'liberada' } : d.notas === 'reter' ? { nota_liberada: false, notas: 'reter' } : {};
    await pref.update({ status: 'encerrada', fecha_em: Timestamp.fromMillis(Math.min(ms(p.fecha_em), agora)), encerrada_em: FieldValue.serverTimestamp(), encerrada_por: txt(u.nome, 60), ...notas });
    return { ok: true, finalizadas: s.size };
  }
  // professor abre antes do horário marcado: abre já (hora do servidor) e garante a janela do tempo de prova + 10 min
  if (d.acao === 'abrir_agora') {
    if (p.status !== 'agendada') throw new HttpsError('failed-precondition', 'Esta prova já foi encerrada.');
    if (!p.aguardando && ms(p.abre_em) <= agora) return { ok: true, ja: true };
    // o professor inicia: os tablets mostram 10, 9, 8... e a prova abre junto para todos
    const abre = agora + ABRE_EM_MS, fecha = p.aguardando ? abre + (p.duracao_min + (p.tolerancia_min ?? 10)) * 60000 : Math.max(ms(p.fecha_em), abre + (p.duracao_min + 10) * 60000);
    await pref.update({ aguardando: false, abre_em: Timestamp.fromMillis(abre), fecha_em: Timestamp.fromMillis(fecha), aberta_pelo_professor_em: FieldValue.serverTimestamp(), aberta_por: txt(u.nome, 60) });
    return { ok: true, abre_em: abre, fecha_em: fecha };
  }
  if (d.acao === 'liberar_notas') { await pref.update({ nota_liberada: true, notas: 'liberada', notas_liberadas_em: FieldValue.serverTimestamp(), notas_liberadas_por: txt(u.nome, 60) }); return { ok: true }; }
  if (d.acao === 'reter_notas') { await pref.update({ nota_liberada: false, notas: 'reter' }); return { ok: true }; }
  if (d.acao === 'cancelar') { await pref.update({ status: 'cancelada' }); return { ok: true }; }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

// Correção do professor (questões abertas, ou revisão de qualquer questão): pontos, comentário e observação de português.
//   itens: [{ uid, qid, pontos, comentario, lingua }]  (até 80 por chamada: uma questão da turma inteira)
// A nota é recalculada no servidor; o aluno e o Notas e Médias leem o resultado já somado.
export function aplicarCorrecao(r, q, it, porQuem) {
  const pontos = Math.round(Math.min(q.valor, Math.max(0, Number(String(it.pontos).replace(',', '.')))) * 100) / 100;
  if (!isFinite(pontos)) throw new HttpsError('invalid-argument', 'Pontuação inválida.');
  const por = { ...(r.por_questao || {}) };
  por[q.id] = { ...(por[q.id] || {}), auto: false, pendente: false, manual: true, ok: pontos >= q.valor, pontos,
    comentario: txt(String(it.comentario || '').trim(), 600), lingua: txt(String(it.lingua || '').trim(), 600), corrigido_por: porQuem, corrigido_em: Date.now() };
  delete por[q.id].aproximada;
  const nota = Math.round(Object.values(por).reduce((t, x) => t + (Number(x.pontos) || 0), 0) * 100) / 100;
  const pendentes = Object.values(por).filter(x => x.pendente).length;
  return { por_questao: por, nota, pendentes, situacao: pendentes ? 'aguardando_correcao' : 'corrigida' };
}
export const corrigirProvaOnline = onCall({ region: REGIAO, timeoutSeconds: 60 }, async (req) => {
  const u = await quem(req), d = req.data || {}, db = getFirestore(), id = String(d.id || '');
  const pref = db.doc(`provas_online/${id}`), p = (await pref.get()).data();
  if (!p) throw new HttpsError('not-found', 'Prova não encontrada.');
  if (p.professor_uid !== u.uid && u.perfil !== 'admin') throw new HttpsError('permission-denied', 'Somente o professor da prova corrige.');
  if (d.criterio !== undefined) {
    if (!CRITERIOS.includes(d.criterio)) throw new HttpsError('invalid-argument', 'Critério inválido.');
    await pref.update({ criterio_lingua: d.criterio });
  }
  const itens = Array.isArray(d.itens) ? d.itens.slice(0, 80) : [];
  const qs = Object.fromEntries((p.questoes || []).map(q => [q.id, q])), feitos = [];
  for (const it of itens) {
    const q = qs[String(it.qid || '')], chave = String(it.uid || '');
    if (!q || !/^[A-Za-z0-9_-]{1,80}$/.test(chave)) throw new HttpsError('invalid-argument', 'Questão ou aluno inválido.');
    const rref = pref.collection('po_resultados').doc(chave);
    await db.runTransaction(async tx => {
      const r = (await tx.get(rref)).data();
      if (!r) throw new HttpsError('failed-precondition', 'Este aluno ainda não entregou a prova.');
      const novo = aplicarCorrecao(r, q, it, txt(u.nome, 60));
      tx.update(rref, { ...novo, corrigido_em: FieldValue.serverTimestamp() });
      feitos.push({ uid: chave, nota: novo.nota, pendentes: novo.pendentes });
    });
  }
  return { ok: true, feitos };
});

// a cada 5 minutos: entrega as tentativas com prazo vencido e encerra as provas que passaram do horário
export const fecharProvasOnline = onSchedule({ region: REGIAO, schedule: 'every 5 minutes', timeZone: 'America/Campo_Grande' }, async () => {
  const db = getFirestore(), agora = Timestamp.fromMillis(Date.now() - 60000);
  const s = await db.collectionGroup('po_tentativas').where('status', '==', 'em_andamento').where('prazo', '<', agora).limit(300).get();
  for (const t of s.docs) { const provaId = t.ref.parent.parent.id; try { await finalizar(provaId, t.id, 'tempo'); } catch (e) { console.warn('fechar', provaId, t.id, e.message); } }
  const ps = await db.collection('provas_online').where('status', '==', 'agendada').where('fecha_em', '<', agora).limit(50).get();
  for (const p of ps.docs) {
    const b = await p.ref.collection('po_tentativas').where('status', '==', 'bloqueada').get();
    for (const x of b.docs) await finalizar(p.id, x.id, 'bloqueada_no_fim');
    // sala de espera que o professor nunca iniciou: cancelada (não aparece como prova feita)
    if (p.data().aguardando) { await p.ref.update({ status: 'cancelada', aguardando: false, cancelada_em: FieldValue.serverTimestamp(), motivo_cancelamento: 'nao_iniciada' }); continue; }
    await p.ref.update({ status: 'encerrada', encerrada_em: FieldValue.serverTimestamp() });
  }
});

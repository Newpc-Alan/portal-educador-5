// Prova online: o professor aplica uma prova do Gerador para a turma, o aluno faz no Portal em modo protegido
// e as questões objetivas são corrigidas aqui no servidor (o aluno nunca recebe o gabarito).
//   provas_online/{id}                       questões sem gabarito, janela, turma e alunos (o aluno lê)
//   provas_online_gab/{id}                   gabarito (só o professor dono e as funções)
//   provas_online/{id}/po_tentativas/{uid}   respostas do aluno, prazo, desvios e situação
//   provas_online/{id}/po_resultados/{uid}   nota e correção (o aluno só lê depois do fim da janela)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';

const REGIAO = 'southamerica-east1';
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
    if (!m || !Array.isArray(m.recursos) || !m.recursos.includes('prova_online'))
      throw new HttpsError('failed-precondition', 'A Prova online não está incluída no plano da sua rede. Fale com a NEWPC.');
  }
  const abre = Number(d.abre_em), fecha = Number(d.fecha_em), dur = Math.round(Number(d.duracao_min));
  if (!(abre > 0 && fecha > abre)) throw new HttpsError('invalid-argument', 'Confira o horário de abertura e de encerramento.');
  if (fecha < Date.now()) throw new HttpsError('invalid-argument', 'O encerramento já passou.');
  if (!(dur >= 5 && dur <= 300)) throw new HttpsError('invalid-argument', 'A duração vai de 5 a 300 minutos.');
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
    else if (q.tipo === 'curta' && String(q.exp || '').trim()) { g.aceitas = String(q.exp).split(/[;|\n]/).map(x => semAcento(x)).filter(Boolean).slice(0, 10); g.exp = txt(q.exp, 300); }
    else if (q.exp) g.exp = txt(q.exp, 1000);
    gab[id] = g;
  }
  const doc = {
    professor_uid: u.uid, professor_nome: txt(u.nome, 80), titulo: txt(d.titulo || 'Prova', 120), disciplina: txt(d.disciplina, 60),
    turma_id: d.turma_id, turma_nome: txt(turma.nome, 80), escola_id: turma.escola_id || '', municipio_id: turma.municipio_id || u.municipio_id || '',
    abre_em: Timestamp.fromMillis(abre), fecha_em: Timestamp.fromMillis(fecha), duracao_min: dur, embaralhar: !!d.embaralhar, avisos_max: Math.min(3, Math.max(0, Number(d.avisos ?? 1))),
    questoes: pub, total_pontos: Math.round(total * 100) / 100, objetivas, alunos_uids: R.uids, alunos_ids: R.ids, alunos: alunos.slice(0, 200).map(a => ({ uid: a.uid, nome: a.nome })),
    status: 'agendada', nota_liberada: false, criado_em: FieldValue.serverTimestamp()
  };
  if (JSON.stringify(doc).length > 900000) throw new HttpsError('invalid-argument', 'A prova ficou grande demais (imagens). Use imagens menores.');
  const b = db.batch(); b.set(ref, doc); b.set(db.doc(`provas_online_gab/${ref.id}`), { professor_uid: u.uid, gab }); await b.commit();
  return { id: ref.id, alunos: alunos.length, objetivas, questoes: pub.length, matriculas: R.ids.length };
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

// correção: objetivas automáticas; curta confere com as respostas aceitas; o resto fica para o professor
export function corrigir(p, gab, respostas) {
  const por = {}; let pontos = 0, max = 0, pendentes = 0;
  for (const q of p.questoes) {
    const g = gab[q.id] || {}, r = respostas ? respostas[q.id] : undefined; max += q.valor;
    if (q.tipo === 'multipla' && 'gab' in g) { const ok = Number(r) === g.gab; por[q.id] = { auto: true, ok, pontos: ok ? q.valor : 0 }; }
    else if (q.tipo === 'vf' && 'gab' in g) { const ok = r === g.gab; por[q.id] = { auto: true, ok, pontos: ok ? q.valor : 0 }; }
    else if (q.tipo === 'curta' && g.aceitas && g.aceitas.length) {
      const ok = g.aceitas.includes(semAcento(r));
      por[q.id] = ok ? { auto: true, ok: true, pontos: q.valor } : (r == null || String(r).trim() === '' ? { auto: true, ok: false, pontos: 0 } : { auto: false, pendente: true, pontos: 0 });
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
      await tref.update({ prazo: Timestamp.fromMillis(Math.max(ms(t.prazo), agora) + min * 60000), eventos: FieldValue.arrayUnion({ t: agora, e: 'mais_tempo', min }) });
      return { ok: true };
    }
    if (t.status === 'entregue') throw new HttpsError('failed-precondition', 'O aluno já entregou.');
    const zerar = d.modo === 'zerar';
    const restante = zerar ? p.duracao_min * 60000 : Math.max(5 * 60000, ms(t.prazo) - (ms(t.bloqueado_em) || agora));
    await tref.update({ status: 'em_andamento', desvios: 0, prazo: Timestamp.fromMillis(agora + restante), ...(zerar ? { respostas: {} } : {}),
      eventos: FieldValue.arrayUnion({ t: agora, e: zerar ? 'liberada_zerada' : 'liberada' }), liberacoes: FieldValue.increment(1) });
    return { ok: true };
  }
  if (d.acao === 'encerrar') {
    const s = await pref.collection('po_tentativas').where('status', 'in', ['em_andamento', 'bloqueada']).get();
    for (const x of s.docs) await finalizar(pref.id, x.id, 'encerrada_professor');
    await pref.update({ status: 'encerrada', fecha_em: Timestamp.fromMillis(Math.min(ms(p.fecha_em), agora)), encerrada_em: FieldValue.serverTimestamp() });
    return { ok: true, finalizadas: s.size };
  }
  if (d.acao === 'liberar_notas') { await pref.update({ nota_liberada: true }); return { ok: true }; }
  if (d.acao === 'cancelar') { await pref.update({ status: 'cancelada' }); return { ok: true }; }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
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
    await p.ref.update({ status: 'encerrada', encerrada_em: FieldValue.serverTimestamp() });
  }
});

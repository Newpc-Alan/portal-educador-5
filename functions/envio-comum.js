// Envio de materiais (Portal IA e Meus trabalhos): quem a pessoa alcança, destinatários de e-mail, limite diário,
// o e-mail em si e a publicação em "Materiais da turma" (Portal do Aluno). Usado por portal-ia.js e trabalhos-rede.js.
import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { transporte, escHtml as esc, SMTP_USUARIO } from './dicas.js';

export const PERFIS_REDE = ['gestor', 'secretaria', 'admin'];
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
export const okEm = e => /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/.test(e);

/* alcance: professor = escolas dele; gestor = escolas dele; secretaria/admin = o município */
export async function escolasDoAlcance(db, eu) {
  const p = eu.perfil;
  if (p === 'secretaria' || p === 'admin') {
    if (!eu.municipio_id) return [];
    const s = await db.collection('escolas').where('municipio_id', '==', eu.municipio_id).get();
    return s.docs.map(d => ({ id: d.id, nome: d.data().nome || 'Escola' }));
  }
  const ids = [...new Set([...(eu.escolas_ids || []), eu.escola_id].filter(Boolean))].slice(0, 30);
  const ds = await Promise.all(ids.map(i => db.doc(`escolas/${i}`).get()));
  return ds.filter(d => d.exists).map(d => ({ id: d.id, nome: d.data().nome || 'Escola' }));
}
export async function turmasDasEscolas(db, escIds) {
  const out = [];
  for (let i = 0; i < escIds.length; i += 10) {
    const s = await db.collection('turmas').where('escola_id', 'in', escIds.slice(i, i + 10)).get();
    s.forEach(d => { const t = d.data(); if (t.status !== 'inativa') out.push({ id: d.id, ...t }); });
  }
  return out;
}
export const anoDaTurma = t => String(t.ano_serie || t.serie || '').trim() || ((String(t.nome || '').match(/(\d+)\s*[ºª°o]?\s*(ano|série|serie)/i) || [])[1] ? (String(t.nome).match(/(\d+)/) || [])[1] + 'º ano' : 'Sem série');
export async function turmasDoFiltro(db, eu, f) {
  const esc2 = await escolasDoAlcance(db, eu), ok = new Set(esc2.map(e => e.id));
  const escIds = (Array.isArray(f && f.escolas) && f.escolas.length ? f.escolas.map(String).filter(x => ok.has(x)) : [...ok]);
  const series = new Set((Array.isArray(f && f.series) ? f.series : []).map(String));
  return (await turmasDasEscolas(db, escIds)).filter(t => !series.size || series.has(anoDaTurma(t)));
}
export const htmlSeguro = h => String(h || '').slice(0, 400000).replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)[\s\S]*?(<\/\1>|>)/gi, '')
  .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');

export async function opcoesEnvio(db, eu) {
  if (!PERFIS_REDE.includes(eu.perfil)) return { rede: false };
  const escs = await escolasDoAlcance(db, eu), ts = await turmasDasEscolas(db, escs.map(e => e.id));
  const series = [...new Set(ts.map(anoDaTurma))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const discs = [...new Set(ts.flatMap(t => (t.grade || []).map(g => g && g.disciplina).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return { rede: true, escolas: escs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), series, disciplinas: discs, turmas: ts.length };
}

/* destinatários: e-mails avulsos + colegas das turmas escolhidas (grade) + professores da rede pelo filtro (gestor/secretaria) */
export async function destinatarios(db, eu, uid, admin, d) {
  let para = (Array.isArray(d.para) ? d.para : []).map(e => String(e).trim().toLowerCase()).filter(okEm);
  const minhasEsc = new Set([...(eu.escolas_ids || []), eu.escola_id].filter(Boolean));
  const emailsDe = async uids => { const out = [];
    for (let i = 0; i < uids.length; i += 50) {
      const us = await Promise.all(uids.slice(i, i + 50).map(u => db.doc(`usuarios/${u}`).get()));
      us.forEach(x => { const em = x.exists && x.data().status === 'ativo' ? String(x.data().email || '').toLowerCase() : ''; if (okEm(em)) out.push(em); });
    } return out; };
  for (const tid of (Array.isArray(d.turmas) ? d.turmas : []).slice(0, 10)) {
    const t = await db.doc(`turmas/${txt(tid, 64)}`).get(); if (!t.exists) continue;
    const td = t.data(); if (!admin && !minhasEsc.has(td.escola_id)) continue;
    para.push(...await emailsDe([...new Set((td.grade || []).map(g => g && g.professor_uid).filter(x => x && x !== uid))].slice(0, 30)));
  }
  const ehRede = PERFIS_REDE.includes(eu.perfil);
  if (d.rede && ehRede) {
    const discs = new Set((Array.isArray(d.rede.disciplinas) ? d.rede.disciplinas : []).map(String)), uids = new Set();
    (await turmasDoFiltro(db, eu, d.rede)).forEach(t => (t.grade || []).forEach(g => { if (g && g.professor_uid && g.professor_uid !== uid && (!discs.size || discs.has(g.disciplina))) uids.add(g.professor_uid); }));
    para.push(...await emailsDe([...uids].slice(0, 400)));
  }
  const teto = ehRede ? 400 : 30;
  para = [...new Set(para)].slice(0, teto);
  if (!para.length) throw new HttpsError('invalid-argument', d.rede ? 'Nenhum professor encontrado com esses filtros.' : 'Informe pelo menos um e-mail válido.');
  return { para, teto };
}
export async function contarEnvioDia(db, uid, admin, n, teto) {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date());
  const cRef = db.doc(`portal_ia_envios/${uid}_${dia}`);
  await db.runTransaction(async t => { const c = await t.get(cRef), k = c.exists ? (c.data().n || 0) : 0;
    if (!admin && k + n > teto) throw new HttpsError('resource-exhausted', 'Limite de ' + teto + ' pessoas por dia no envio por e-mail. Hoje ainda dá para ' + Math.max(0, teto - k) + '.');
    t.set(cRef, { uid, dia, n: k + n, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }); });
}
export function lerAnexos(lista, max = 2) {
  const out = [];
  for (const a of (Array.isArray(lista) ? lista : []).slice(0, max)) {
    const b = Buffer.from(String((a && a.b64) || ''), 'base64');
    if (b.length < 100 || b.length > 9e6 || b.slice(0, 4).toString() !== '%PDF') throw new HttpsError('invalid-argument', 'O PDF não foi gerado direito. Tente de novo.');
    out.push({ filename: (txt(a.nome, 80).replace(/[^\w.\- À-ú]/g, '') || 'material').replace(/(\.pdf)?$/i, '.pdf'), content: b, contentType: 'application/pdf' });
  }
  return out;
}
/* o e-mail: "Fulano compartilhou com você", PDF anexo (ou o conteúdo no corpo), resposta vai para o professor */
export async function mandarMaterial({ eu, escola, mun, titulo, sub, mensagem, anexos, corpo, para }) {
  const nome = txt(eu.nome || 'Um(a) professor(a)', 80), msg = txt(mensagem, 500), remetente = SMTP_USUARIO.value();
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:680px">
<div style="background:#0f2c4a;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${esc(nome)} compartilhou um material com você</b><br><span style="color:#8DC63F;font-size:12px">${esc([escola, mun].filter(Boolean).join(' · ') || 'Portal do Educador')}</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
${msg ? `<p style="margin:0 0 14px;padding:10px 14px;background:#f4f8fb;border-left:4px solid #1a6b2a;border-radius:6px;white-space:pre-line">${esc(msg)}</p>` : ''}
<p style="margin:0 0 4px;font-size:17px"><b>${esc(titulo)}</b></p>
<p style="margin:0 0 14px;color:#5b6b7b;font-size:13px">${esc(sub || '')}</p>
${anexos.length ? `<p style="margin:0 0 14px">O material está em anexo, em PDF${anexos.length > 1 ? ' (com o gabarito ou o guia em arquivo separado)' : ''}.</p>` : `<div style="border:1px solid #e6edf4;border-radius:10px;padding:14px">${corpo || ''}</div>`}
<p style="margin:16px 0 0;color:#5b6b7b;font-size:12.5px">Para falar com ${esc(nome.split(' ')[0])}, é só responder este e-mail.</p>
<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #eef2f6;color:#8a98a6;font-size:11.5px">Preparado no <a href="https://portaldoeducador.com.br" style="color:#1a6b2a">Portal do Educador</a>, plataforma da NEWPC Tecnologia para escolas e redes de ensino.</p>
</div></div>`;
  for (let i = 0; i < para.length; i += 90) await transporte().sendMail({ from: `"${nome.replace(/["\r\n]/g, '')} via Portal do Educador" <${remetente}>`, bcc: para.slice(i, i + 90),
    replyTo: okEm(String(eu.email || '').toLowerCase()) ? eu.email : undefined, subject: (nome + ' compartilhou com você: ' + titulo).replace(/[\r\n]/g, ' ').slice(0, 150), html, attachments: anexos });
}
/* turmas do envio aos alunos: professor = turmas dele; gestor/secretaria = filtro da rede */
export async function turmasParaAlunos(db, eu, uid, admin, d) {
  let turmas = [];
  if (d.filtro && PERFIS_REDE.includes(eu.perfil)) turmas = await turmasDoFiltro(db, eu, d.filtro);
  else {
    const minhas = new Set((eu.turmas_ids || []).map(String));
    const ds = await Promise.all((Array.isArray(d.turmas) ? d.turmas : []).slice(0, 20).map(t => db.doc(`turmas/${txt(t, 64)}`).get()));
    turmas = ds.filter(x => x.exists).map(x => ({ id: x.id, ...x.data() }))
      .filter(t => admin || minhas.has(t.id) || t.criado_por === uid || (t.grade || []).some(g => g && g.professor_uid === uid));
  }
  turmas = turmas.slice(0, 300);
  if (!turmas.length) throw new HttpsError('invalid-argument', 'Escolha pelo menos uma turma.');
  return turmas;
}
// copia um arquivo do Storage para a pasta de materiais da turma, com link de acesso próprio (o aluno não lê a pasta do professor)
export async function linkPublico(origem, destino, conteudo, tipo) {
  const bucket = getStorage().bucket(), tk = randomUUID(), f = bucket.file(destino);
  if (conteudo) await f.save(conteudo, { contentType: tipo || 'image/jpeg', metadata: { metadata: { firebaseStorageDownloadTokens: tk } } });
  else { await bucket.file(origem).copy(f); await f.setMetadata({ metadata: { firebaseStorageDownloadTokens: tk } }); }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destino)}?alt=media&token=${tk}`;
}
export async function publicarNaTurma(db, turmas, chave, item) {
  for (let i = 0; i < turmas.length; i += 400) {
    const b = db.batch(); turmas.slice(i, i + 400).forEach(t => b.set(db.doc(`turma_materiais/${t.id}/itens/${chave}`), { ...item, turma_nome: txt(t.nome, 60), escola_id: t.escola_id || '', criado_em: FieldValue.serverTimestamp() }));
    await b.commit();
  }
}

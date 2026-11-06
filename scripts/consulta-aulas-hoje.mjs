// Só leitura: aulas abertas hoje (qr_aulas) e as turmas envolvidas, para diagnosticar interferência entre aulas no laboratório.
// Professores aparecem só por apelido (P1, P2...), nunca nome ou e-mail (repositório público).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 900));
const ms = t => (t && t.toMillis ? t.toMillis() : 0), hoje = Date.now() - 14 * 3600e3, hh = t => t ? new Date(t - 4 * 3600e3).toISOString().slice(11, 16) : '-';
const apel = {}; let n = 0; const P = uid => uid ? (apel[uid] = apel[uid] || 'P' + (++n)) : '-';
const qs = await db.collection('qr_aulas').get();
const recentes = qs.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => Math.max(ms(x.atualizado_em), ms(x.aberta_em), ms(x.aberta_ate)) > hoje);
aviso('Aulas mexidas nas últimas 14 h: ' + recentes.length);
for (const x of recentes) {
  const t = (await db.doc('turmas/' + x.id).get()).data() || {};
  const profs = [...new Set((t.grade || []).map(g => g && g.professor_uid).filter(Boolean))].map(P).join(',');
  aviso(`turma ${x.turma_nome || t.nome} [${x.id.slice(0, 6)}] ano=${t.ano_serie || '-'} escola=${String(t.escola_id || '').slice(0, 6)} | dono ${P(x.por)} ${x.por_disc || ''} | aberta ${hh(ms(x.aberta_em))}→${hh(ms(x.aberta_ate))} (${x.duracao_min || '-'} min) | troca ${x.troca ? P(x.troca.de_uid) + '→' + (x.troca.como || '') + ' ' + hh(ms(x.troca.em)) : '-'} | pedido ${x.pedido ? (x.pedido.status || '') + ' ' + P(x.pedido.uid) : '-'} | profs da grade: ${profs || '-'}`);
}
// professores apelidados: quantas turmas cada um tem no cadastro
for (const [uid, ap] of Object.entries(apel)) { const u = (await db.doc('usuarios/' + uid).get()).data() || {}; aviso(ap + ': perfil ' + (u.perfil || '-') + ', turmas no cadastro ' + (u.turmas_ids || []).length + ', disciplinas ' + (u.disciplinas || []).join('/')); }
// auditoria das aulas de hoje (só o tipo do evento e o apelido de quem fez; o texto tem nomes e não sai no log)
for (const x of recentes) {
  const au = await db.collection('auditoria').where('doc', '==', x.id).get();
  const ev = au.docs.map(d => d.data()).filter(a => ms(a.em) > hoje).sort((a, b) => ms(a.em) - ms(b.em));
  aviso('auditoria ' + x.id.slice(0, 6) + ': ' + (ev.map(a => hh(ms(a.em)) + ' ' + P(a.autor_uid) + '(' + (a.perfil || '-') + ') ' + String(a.detalhe || a.acao || '').split(' ')[0]).join(' | ') || 'nada'));
}
// quem abriu aula hoje em qualquer turma (log de entradas pela função): perfis dos apelidos
for (const [uid, ap] of Object.entries(apel)) { const u = (await db.doc('usuarios/' + uid).get()).data() || {}; aviso(ap + ' = ' + (u.perfil || '-')); }

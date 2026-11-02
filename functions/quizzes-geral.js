// Acervo geral de quizzes do Portal do Educador (nov/2026): todo quiz criado com IA, em qualquer rede, entra no acervo de todas as redes
// depois de aplicado a uma turma (pelo menos 1 aluno respondeu). Vai só pergunta, alternativas e gabarito, com a rede de origem:
// nada de nome de professor, de aluno ou respostas individuais.
//   quizzes_geral/{id}            o quiz no acervo (professores e gestores ativos leem; só esta função grava)
//   quizzes_geral/{id}/avisos/{u} "achei erro" de cada professor; com 3 avisos o quiz sai do ar para revisão da NEWPC
// Quem reaproveita um quiz do acervo geral (geral_id) e aplica soma uma aplicação e entra na média de acerto.
import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const OPC = { region: 'southamerica-east1', maxInstances: 10, timeoutSeconds: 60 };
const AVISOS_PARA_REVISAR = 3;
const txt = (s, n) => String(s == null ? '' : s).slice(0, n);
export function anoDaTurma(nome) { const m = String(nome || '').match(/(\d{1,2})\s*[ºo°]?\s*ano/i); return m ? m[1] + 'º ano' : ''; }
// perguntas que quase ninguém acertou (com respostas suficientes): podem estar com o gabarito errado
export function perguntasSuspeitas(res) { return ((res && res.porQuestao) || []).map((x, i) => (x && x.resp >= 3 && x.pct <= 10 ? i : -1)).filter(i => i >= 0); }
const respondeu = res => ((res && res.alunos) || []).filter(a => Array.isArray(a.r) && a.r.some(v => v >= 0)).length;

export const quizParaAcervoGeral = onDocumentWritten({ ...OPC, document: 'usuarios/{uid}/quizzes/{id}' }, async ev => {
  const depois = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  const antes = ev.data && ev.data.before && ev.data.before.exists ? ev.data.before.data() : null;
  if (!depois || depois.status !== 'encerrado' || (antes && antes.status === 'encerrado')) return;   // só na hora em que o quiz é encerrado
  const res = depois.resultado || {}, n = respondeu(res);
  if (!n) return;                                                                                       // ninguém respondeu: não conta como aplicado
  const db = getFirestore();
  // reaproveitado do acervo geral: soma a aplicação e atualiza a média de acerto
  if (depois.geral_id && /^[A-Za-z0-9_-]{1,80}$/.test(depois.geral_id)) {
    const ref = db.doc(`quizzes_geral/${depois.geral_id}`);
    await db.runTransaction(async t => { const g = await t.get(ref); if (!g.exists) return; const x = g.data(), ap = (x.aplicacoes || 0), alunos = (x.alunos || 0);
      const media = Math.round(((x.media || 0) * alunos + (res.media || 0) * n) / Math.max(1, alunos + n));
      t.update(ref, { aplicacoes: ap + 1, alunos: alunos + n, media, atualizado_em: FieldValue.serverTimestamp() }); }).catch(e => console.warn('acervo geral (uso):', e.message));
    return;
  }
  if (depois.origem !== 'ia') return;                                                                   // escrito pelo professor: autoria dele, não entra sozinho
  const perg = (depois.perguntas || []).slice(0, 30).map(q => ({ p: txt(q.p, 400), ops: (q.ops || []).slice(0, 5).map(o => txt(o, 160)), gab: Number(q.gab) || 0 })).filter(q => q.p && q.ops.length >= 2);
  if (!perg.length) return;
  const eu = (await db.doc(`usuarios/${ev.params.uid}`).get()).data() || {}, mun = String(eu.municipio_id || '');
  const m = mun ? (await db.doc(`municipios/${mun}`).get()).data() || {} : {};
  const susp = perguntasSuspeitas(res);
  await db.doc(`quizzes_geral/${ev.params.id}`).set({
    titulo: txt(depois.titulo || 'Quiz', 120), disciplina: txt(depois.disciplina, 80), ano: anoDaTurma(depois.turma_nome), perguntas: perg, n: perg.length,
    rede_nome: txt(m.nome ? m.nome + (m.uf ? '/' + m.uf : '') : 'Portal do Educador', 80), municipio_id: mun, origem: 'ia',
    aplicacoes: 1, alunos: n, media: Math.round(res.media || 0), revisar: susp, avisos: 0,
    status: 'publicado', criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp()
  }, { merge: true });
});

// "Achei erro": cada professor avisa uma vez; com 3 avisos o quiz sai do acervo geral até a NEWPC revisar
export const avisoQuizGeral = onDocumentCreated({ ...OPC, document: 'quizzes_geral/{id}/avisos/{uid}' }, async ev => {
  const ref = getFirestore().doc(`quizzes_geral/${ev.params.id}`);
  await getFirestore().runTransaction(async t => { const g = await t.get(ref); if (!g.exists) return; const av = (g.data().avisos || 0) + 1;
    t.update(ref, { avisos: av, ...(av >= AVISOS_PARA_REVISAR ? { status: 'revisao' } : {}), atualizado_em: FieldValue.serverTimestamp() }); });
});

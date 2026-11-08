// Fábrica de cursos com IA (Formação Continuada). Só a equipe da Formação (papel admin ou editor) usa.
// gerarCursoIA: tema, público, carga horária e material base opcional (texto colado ou PDF) viram um curso
// completo em RASCUNHO: módulos, aulas com texto e atividade prática, banco de questões com gabarito.
// revisarCursoIA: alguém da equipe confirma que leu e revisou; sem isso o curso não publica (domain.js).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { geminiFluxo, RESERVA_TEXTO, PADRAO } from './portal-ia.js';
import { registrarConsumo } from './creditos.js';
import { expiraAuditoria } from './auditoria.js';
import { NIVEIS, ESQUEMA_PLANO, ESQUEMA_AULAS, pedidoPlano, pedidoAulas, limparPlano, montarCurso, slugCurso } from './curso-ia.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const LIMITE_DIA = 10, PDF_MAX = 7 * 1024 * 1024, TEXTO_MAX = 60000;
const equipe = req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  if (!['admin', 'editor'].includes(req.auth.token.papel)) throw new HttpsError('permission-denied', 'Acesso restrito à equipe da Formação.');
  return req.auth.uid;
};
const diaBR = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);

async function pedirJson(chave, modelos, sistema, partes, esquema, limiteMs) {
  const r = await geminiFluxo(chave, modelos, { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: partes }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 32000 } }, limiteMs);
  const bruto = r.partes.filter(p => !p.thought).map(p => p.text || '').join('');
  let json = null; try { json = JSON.parse(bruto); } catch { json = null; console.warn('formacao-ia: JSON inválido', r.modelo, r.fim, bruto.length); }
  return { ...r, json };
}

export const gerarCursoIA = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 540, memory: '1GiB', maxInstances: 5 }, async req => {
  const uid = equipe(req), db = getFirestore(), d = req.data || {};
  const tema = String(d.tema || '').trim().slice(0, 300), publico = String(d.publico || '').trim().slice(0, 300), foco = String(d.foco || '').trim().slice(0, 3000);
  const horas = Math.round(Number(d.horas)), nivel = NIVEIS.includes(d.nivel) ? d.nivel : 'iniciante';
  const material = String(d.material || '').trim().slice(0, TEXTO_MAX);
  const pdf = typeof d.pdf === 'string' && d.pdf ? d.pdf.replace(/^data:[^,]*,/, '') : '';
  if (tema.length < 5) throw new HttpsError('invalid-argument', 'Descreva o tema do curso (pelo menos uma frase curta).');
  if (!(horas >= 1 && horas <= 40)) throw new HttpsError('invalid-argument', 'Carga horária de 1 a 40 horas.');
  if (pdf && (pdf.length * 0.75 > PDF_MAX || !/^[A-Za-z0-9+/=]+$/.test(pdf.slice(0, 2000)))) throw new HttpsError('invalid-argument', 'PDF inválido ou maior que 7 MB.');

  // limite por pessoa por dia: cada curso custa algumas chamadas grandes
  const limRef = db.doc(`formacao_ia_uso/${uid}_${diaBR()}`);
  const usados = await db.runTransaction(async tx => {
    const n = ((await tx.get(limRef)).data()?.n || 0);
    if (n >= LIMITE_DIA) throw new HttpsError('resource-exhausted', `Limite de ${LIMITE_DIA} cursos gerados por dia atingido. Tente amanhã.`);
    tx.set(limRef, { uid, n: n + 1, em: FieldValue.serverTimestamp() }, { merge: true }); return n + 1;
  });
  const devolver = () => limRef.set({ n: FieldValue.increment(-1) }, { merge: true }).catch(() => {});

  const cs = await db.doc('config/portal_ia').get(), cfgRaw = cs.exists ? cs.data() : {};
  const cfg = { ...PADRAO, ...cfgRaw }, chave = GEMINI.value();
  const ctx = { uid, cfgRaw, eu: {} }, gasto = { entrada: 0, saida: 0, modelo: cfg.modelo_texto };
  const conta = r => { gasto.entrada += r.entrada || 0; gasto.saida += r.saida || 0; gasto.modelo = r.modelo || gasto.modelo; };
  try {
    // 1) plano
    const p = pedidoPlano({ tema, publico, horas, nivel, foco, temMaterial: Boolean(material || pdf) });
    const partes = [];
    if (pdf) partes.push({ inlineData: { mimeType: 'application/pdf', data: pdf } });
    if (material) partes.push({ text: 'MATERIAL BASE:\n' + material });
    partes.push({ text: p.pedido });
    let plano = null, prob = [];
    for (let t = 0; t < 2 && !plano; t++) {
      const ordem = t === 0 ? [cfg.modelo_texto, ...RESERVA_TEXTO] : ['gemini-flash-latest', cfg.modelo_texto];
      const r = await pedirJson(chave, ordem, p.sistema, t ? [...partes, { text: 'ATENÇÃO: a tentativa anterior veio com problema (' + prob.join('; ') + '). Corrija.' }] : partes, ESQUEMA_PLANO, 170000);
      conta(r);
      const x = limparPlano(r.json, horas); prob = x.prob;
      if (!prob.length) plano = x.plano;
    }
    if (!plano) throw new HttpsError('unavailable', 'A IA não conseguiu montar o plano do curso (' + prob.join('; ') + '). Tente de novo ou detalhe melhor o tema.');

    // 2) aulas, um pedido por módulo, em paralelo
    const aulasPorModulo = await Promise.all(plano.modulos.map(async (m, i) => {
      const q = pedidoAulas({ plano, modulo: m, indice: i, tema, publico });
      for (let t = 0; t < 2; t++) {
        const ordem = t === 0 ? [cfg.modelo_texto, ...RESERVA_TEXTO] : ['gemini-flash-latest', cfg.modelo_rapido];
        try {
          const r = await pedirJson(chave, ordem, q.sistema, [{ text: q.pedido }], ESQUEMA_AULAS, 200000); conta(r);
          if (Array.isArray(r.json?.aulas) && r.json.aulas.length >= Math.ceil(m.aulas.length / 2)) return r.json.aulas;
        } catch (e) { console.warn('formacao-ia: módulo', i + 1, e.message); }
      }
      return [];
    }));
    const { modulos, aulas, questoes, pendencias } = montarCurso(plano, aulasPorModulo);

    // 3) grava como rascunho
    const cursoId = (slugCurso(plano.titulo) || 'curso') + '-' + randomBytes(3).toString('hex');
    const qtd = (await db.collection('cursos').count().get()).data().count;
    const competencias = plano.competencias.length ? '<h3>Competências desenvolvidas (BNC-Formação Continuada)</h3><ul>' + plano.competencias.map(c => `<li>${c.replace(/[<>&]/g, '')}</li>`).join('') + '</ul>' : '';
    const descricao = plano.descricao.split(/\n+/).filter(Boolean).map(t => `<p>${t.replace(/[<>&]/g, '')}</p>`).join('') + competencias;
    const b = db.batch(), ref = db.doc(`cursos/${cursoId}`);
    b.create(ref, { titulo: plano.titulo, resumo: plano.resumo, descricao, nivel: plano.nivel, horas, ordem: qtd + 1, status: 'rascunho', trilhas: [], totalAulas: aulas.length,
      quizAtivo: questoes.length >= 5, quizNotaCorte: 70, quizTentativasMax: 3, quizPorProva: Math.min(10, questoes.length),
      ia: { gerado: true, revisado: false, por: uid, em: FieldValue.serverTimestamp(), modelo: gasto.modelo, tema, publico, base: pdf ? 'pdf' : material ? 'texto' : 'nenhuma', pendencias },
      criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() });
    modulos.forEach(({ id, ...m }) => b.set(ref.collection('modulos').doc(id), m));
    aulas.forEach(({ id, ...a }) => b.set(ref.collection('aulas').doc(id), a));
    questoes.forEach(({ id, correta, explicacao, ...q }) => { b.set(ref.collection('questoes').doc(id), q); b.set(ref.collection('gabarito').doc(id), { correta, explicacao }); });
    b.create(db.collection('auditoria').doc(), { uid, acao: 'gerarCursoIA', cursoId, aulas: aulas.length, questoes: questoes.length, em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria() });
    await b.commit();
    await registrarConsumo(db, ctx, { acao: 'formacao_curso', conta: 'admin' }, gasto);
    return { ok: true, cursoId, titulo: plano.titulo, modulos: modulos.length, aulas: aulas.length, questoes: questoes.length, pendencias, usados, limite: LIMITE_DIA };
  } catch (e) {
    await devolver();
    if (e instanceof HttpsError) throw e;
    console.error('formacao-ia', e);
    throw new HttpsError('internal', 'Não foi possível gerar o curso agora. Tente de novo em alguns minutos.');
  }
});

export const revisarCursoIA = onCall({ region: 'southamerica-east1' }, async req => {
  const uid = equipe(req), db = getFirestore(), cursoId = String(req.data?.cursoId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cursoId)) throw new HttpsError('invalid-argument', 'Curso inválido.');
  const ref = db.doc(`cursos/${cursoId}`);
  return db.runTransaction(async tx => {
    const s = await tx.get(ref); if (!s.exists) throw new HttpsError('not-found', 'Curso não encontrado.');
    const c = s.data(); if (!c.ia?.gerado) throw new HttpsError('failed-precondition', 'Este curso não foi gerado por IA.');
    const nome = req.auth.token.name || req.auth.token.email || uid;
    tx.update(ref, { 'ia.revisado': true, 'ia.revisado_por': uid, 'ia.revisado_nome': String(nome).slice(0, 120), 'ia.revisado_em': FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() });
    tx.create(db.collection('auditoria').doc(), { uid, acao: 'revisarCursoIA', cursoId, em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria() });
    return { ok: true };
  });
});

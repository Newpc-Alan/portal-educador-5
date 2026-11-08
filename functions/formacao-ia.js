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
import { montarAcompanhamento } from './formacao-uso.js';
import { agregarFormacao, ESQUEMA_RELATORIO, pedidoRelatorio, limparRelatorio, ESQUEMA_PRATICA, atividadeDaAula, pedidoPratica, limparPratica } from './relatorio-formacao.js';
import { expiraAuditoria } from './auditoria.js';
import { NIVEIS, ESQUEMA_PLANO, pedidoPlano, pedidoAula, pedidoRevisao, aceitarRevisao, textoDegenerado, limparMd, mdParaHtml, limparPlano, montarCurso, slugCurso } from './curso-ia.js';

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

// texto livre (sem JSON): textos longos dentro de JSON degeneram com mais frequência
async function pedirTexto(chave, modelos, sistema, texto, limiteMs) {
  const r = await geminiFluxo(chave, modelos, { systemInstruction: { parts: [{ text: sistema }] }, contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: { maxOutputTokens: 8000 } }, limiteMs, Infinity);
  return { ...r, texto: r.partes.filter(p => !p.thought).map(p => p.text || '').join('') };
}

export const gerarCursoIA = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 540, memory: '1GiB', maxInstances: 5 }, async req => {
  const uid = equipe(req), db = getFirestore(), d = req.data || {};
  const tema = String(d.tema || '').trim().slice(0, 300), publico = String(d.publico || '').trim().slice(0, 300), foco = String(d.foco || '').trim().slice(0, 3000);
  const horas = Math.round(Number(d.horas)), nivel = NIVEIS.includes(d.nivel) ? d.nivel : 'iniciante';
  const material = String(d.material || '').trim().slice(0, TEXTO_MAX);
  const tituloFixo = String(d.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 90);
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
    if (tituloFixo.length >= 5) plano.titulo = tituloFixo;   // título definido pela equipe (ex.: casar com o cartão "Em breve")

    // 2) aulas: um pedido por aula, todas em paralelo; até 3 tentativas com modelos diferentes; depois revisão de língua
    let revisados = 0;
    const escrever = async (m, i, k) => {
      const q = pedidoAula({ plano, modulo: m, indice: i, alvo: k, tema, publico }), titulo = m.aulas[k].titulo;
      const ordens = [[cfg.modelo_texto, ...RESERVA_TEXTO], ['gemini-flash-latest', cfg.modelo_texto], [cfg.modelo_texto, cfg.modelo_rapido]];
      let reserva = null;
      for (const ordem of ordens) {
        try {
          const r = await pedirTexto(chave, ordem, q.sistema, q.pedido, 120000); conta(r);
          const md = limparMd(r.texto, titulo);
          if (md.split(/\s+/).length < 250 || !/^##\s/m.test(md)) { console.warn('formacao-ia: aula curta', i + 1, k + 1, r.modelo, r.fim); continue; }
          // a revisão também conserta frase degenerada; só tenta de novo se, depois dela, o texto ainda estiver ruim
          try {
            const v = pedidoRevisao(md);
            const rv = await pedirTexto(chave, [cfg.modelo_rapido, cfg.modelo_texto], v.sistema, v.pedido, 90000); conta(rv);
            const mdR = limparMd(rv.texto, titulo);
            if (aceitarRevisao(md, mdR)) { revisados++; return { html: mdParaHtml(mdR) }; }
            console.warn('formacao-ia: revisão recusada', i + 1, k + 1);
          } catch (e) { console.warn('formacao-ia: revisão', i + 1, k + 1, e.message); }
          if (!textoDegenerado(md)) return { html: mdParaHtml(md) };
          console.warn('formacao-ia: texto degenerado', i + 1, k + 1, r.modelo);
          reserva = reserva || md;
        } catch (e) { console.warn('formacao-ia: aula', i + 1, k + 1, e.message); }
      }
      return reserva ? { html: mdParaHtml(reserva), suspeito: true } : null;
    };
    const aulasPorModulo = await Promise.all(plano.modulos.map((m, i) => Promise.all(m.aulas.map((_, k) => escrever(m, i, k)))));
    const { modulos, aulas, questoes, pendencias } = montarCurso(plano, aulasPorModulo);

    // 3) grava como rascunho
    const cursoId = (slugCurso(plano.titulo) || 'curso') + '-' + randomBytes(3).toString('hex');
    const qtd = (await db.collection('cursos').count().get()).data().count;
    const competencias = plano.competencias.length ? '<h3>Competências desenvolvidas (BNC-Formação Continuada)</h3><ul>' + plano.competencias.map(c => `<li>${c.replace(/[<>&]/g, '')}</li>`).join('') + '</ul>' : '';
    const descricao = plano.descricao.split(/\n+/).filter(Boolean).map(t => `<p>${t.replace(/[<>&]/g, '')}</p>`).join('') + competencias;
    const b = db.batch(), ref = db.doc(`cursos/${cursoId}`);
    b.create(ref, { titulo: plano.titulo, resumo: plano.resumo, descricao, nivel: plano.nivel, horas, ordem: qtd + 1, status: 'rascunho', trilhas: [], totalAulas: aulas.length,
      exclusivo: false, quizAtivo: questoes.length >= 5, quizNotaCorte: 70, quizTentativasMax: 3, quizPorProva: Math.min(10, questoes.length),
      ia: { gerado: true, revisado: false, por: uid, em: FieldValue.serverTimestamp(), modelo: gasto.modelo, tema, publico, base: pdf ? 'pdf' : material ? 'texto' : 'nenhuma', pendencias, aulas_revisadas_ia: revisados },
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

// Relatório da Formação para a Secretaria (ou para a direção): números do acompanhamento + leitura e recomendações da IA.
// Quem pode: os mesmos do acompanhamento (admin, secretaria, gestor). A IA recebe só números por escola e curso, sem nomes.
export const relatorioFormacaoIA = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 180, memory: '512MiB', maxInstances: 10 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid;
  const a = await montarAcompanhamento(db, uid, req.data || {}, true);
  const ag = agregarFormacao(a);
  // título da aula onde pararam (só das aulas que aparecem na lista)
  await Promise.all((ag.abandono || []).map(async x => { if (!x.aulaId) { x.aula = '(abriu o curso, não entrou em aula)'; return; }
    const s = await db.doc(`cursos/${x.cursoId}/aulas/${x.aulaId}`).get(); x.aula = s.exists ? String(s.data().titulo || x.aulaId).slice(0, 100) : 'aula removida'; }));
  (ag.abandono || []).forEach(x => { delete x.cursoId; delete x.aulaId; });
  const limRef = db.doc(`formacao_ia_uso/rel_${uid}_${diaBR()}`);
  await db.runTransaction(async tx => {
    const n = ((await tx.get(limRef)).data()?.n || 0);
    if (n >= 10) throw new HttpsError('resource-exhausted', 'Limite de 10 relatórios por dia atingido. Tente amanhã.');
    tx.set(limRef, { uid, n: n + 1, em: FieldValue.serverTimestamp() }, { merge: true });
  });
  const cs = await db.doc('config/portal_ia').get(), cfgRaw = cs.exists ? cs.data() : {};
  const cfg = { ...PADRAO, ...cfgRaw }, p = pedidoRelatorio(ag);
  let ia = null, r = null;
  for (const ordem of [[cfg.modelo_texto, ...RESERVA_TEXTO], ['gemini-flash-latest', cfg.modelo_rapido]]) {
    try { r = await pedirJson(GEMINI.value(), ordem, p.sistema, [{ text: p.pedido }], ESQUEMA_RELATORIO, 90000); ia = limparRelatorio(r.json); if (ia) break; }
    catch (e) { console.warn('formacao-ia: relatório', e.message); }
  }
  if (r) await registrarConsumo(db, { uid, cfgRaw, eu: {} }, { acao: 'formacao_relatorio', conta: 'admin' }, { modelo: r.modelo, entrada: r.entrada, saida: r.saida });
  if (!ia) await limRef.set({ n: FieldValue.increment(-1) }, { merge: true }).catch(() => {});
  return { gerado_em: Date.now(), dados: ag, ia };   // ia nulo: o painel mostra os números e avisa que a leitura da IA falhou
});

// Atividade prática: o professor registra o que aplicou; a IA comenta (só texto, sem nomes de alunos). Fica em users/{uid}/praticas.
export const praticaFormacao = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 90, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const cursoId = String(d.cursoId || ''), aulaId = String(d.aulaId || ''), texto = String(d.texto || '').replace(/\r/g, '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cursoId) || !/^[A-Za-z0-9_-]{1,64}$/.test(aulaId)) throw new HttpsError('invalid-argument', 'Aula inválida.');
  if (texto.length < 80) throw new HttpsError('invalid-argument', 'Conte um pouco mais (pelo menos umas três frases): o que fez, com qual turma e como os alunos reagiram.');
  if (texto.length > 3000) throw new HttpsError('invalid-argument', 'Relato longo demais: até 3.000 caracteres.');
  const [us, cs, as] = await Promise.all([db.doc(`usuarios/${uid}`).get(), db.doc(`cursos/${cursoId}`).get(), db.doc(`cursos/${cursoId}/aulas/${aulaId}`).get()]);
  const u = us.data() || {}, c = cs.data();
  if (u.status !== 'ativo') throw new HttpsError('permission-denied', 'Seu acesso ao Portal do Educador não está ativo.');
  if (!c || c.status !== 'publicado' || !as.exists) throw new HttpsError('failed-precondition', 'Esta aula não está disponível.');
  if (c.exclusivo && u.perfil !== 'admin' && !(c.redes || []).includes(u.municipio_id)) throw new HttpsError('permission-denied', 'Este curso é exclusivo de outra rede de ensino.');
  const ref = db.doc(`users/${uid}/praticas/${cursoId}__${aulaId}`), dia = diaBR(), limRef = db.doc(`formacao_ia_uso/prat_${uid}_${dia}`);
  const antes = (await ref.get()).data() || {};
  if ((antes.envios || 0) >= 3) throw new HttpsError('resource-exhausted', 'Você já enviou 3 versões desta atividade. A última ficou registrada.');
  await db.runTransaction(async tx => {
    const n = ((await tx.get(limRef)).data()?.n || 0);
    if (n >= 20) throw new HttpsError('resource-exhausted', 'Limite de 20 relatos por dia. Continue amanhã.');
    tx.set(limRef, { uid, n: n + 1, em: FieldValue.serverTimestamp() }, { merge: true });
  });
  const cfgRaw = (await db.doc('config/portal_ia').get()).data() || {}, cfg = { ...PADRAO, ...cfgRaw };
  const p = pedidoPratica({ curso: c.titulo, aula: as.data().titulo, atividade: atividadeDaAula(as.data().texto), texto });
  let r = null, fb = null;
  for (const ordem of [[cfg.modelo_texto, ...RESERVA_TEXTO], [cfg.modelo_rapido, 'gemini-flash-latest']]) {
    try { r = await pedirJson(GEMINI.value(), ordem, p.sistema, [{ text: p.pedido }], ESQUEMA_PRATICA, 60000); fb = limparPratica(r.json); if (fb) break; }
    catch (e) { console.warn('formacao-ia: prática', e.message); }
  }
  if (r) await registrarConsumo(db, { uid, cfgRaw, eu: {} }, { acao: 'formacao_pratica', conta: 'admin' }, { modelo: r.modelo, entrada: r.entrada, saida: r.saida });
  // o relato fica salvo mesmo se a IA falhar; o retorno pode ser pedido de novo reenviando
  await ref.set({ cursoId, aulaId, cursoTitulo: String(c.titulo || '').slice(0, 120), aulaTitulo: String(as.data().titulo || '').slice(0, 120), texto,
    retorno: fb || null, situacao: fb ? fb.situacao : (antes.situacao || null), envios: (antes.envios || 0) + 1,
    municipio_id: u.municipio_id || '', escola_id: u.escola_id || '', em: FieldValue.serverTimestamp() }, { merge: true });
  if (!fb) await limRef.set({ n: FieldValue.increment(-1) }, { merge: true }).catch(() => {});
  return { ok: true, retorno: fb, envios: (antes.envios || 0) + 1, restam: Math.max(0, 2 - (antes.envios || 0)) };
});

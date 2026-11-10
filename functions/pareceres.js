// Pareceres da turma (nov/2026): o parecer descritivo do bimestre, aluno por aluno, a partir dos dados que o Portal já tem.
//   dados   frequência do período (freq_resumo), médias (notas_planilhas / notas_escola), habilidades da BNCC das provas online
//           (po_resultados), alertas pedagógicos da ficha (só plano individual e apoio) e o parecer já salvo de cada aluno
//   gerar   1 crédito do Portal IA por aluno: a IA recebe "o aluno" com números, habilidades e as observações do professor,
//           NUNCA o nome, o CPF ou dado de saúde. O nome entra só no texto que volta para a tela do professor.
//   salvar  o professor edita e aprova; só com o parecer aprovado ele entra no PDF da turma
// pareceres/{turma}_{ano}_{periodo}_{aluno}: só esta função grava e lê (regras: nada pelo navegador)
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { contexto, geminiJson, RESERVA_TEXTO, etapaDaTurma } from './portal-ia.js';
import { SMTP_SENHA } from './dicas.js';   // alerta de crédito do Google esgotado (portal-ia.js)
import { reservarCreditos, estornarCreditos, registrarConsumo, usoJustoDiario } from './creditos.js';
import { acessoIA, mensagemAcesso, NOMES_IA } from './ia-acesso.js';
import { periodoDisciplina, PADRAO as REGRAS_NOTAS } from './notas-fechamento.js';
import { decodificar } from './frequencia-nucleo.js';
import { expiraAuditoria } from './auditoria.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const REGIAO = 'southamerica-east1', ID = /^[A-Za-z0-9_-]{1,64}$/;
const BNCC = JSON.parse(readFileSync(new URL('./bncc-textos.json', import.meta.url), 'utf8'));
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const ms = v => v && v.toMillis ? v.toMillis() : 0;
const diaMS = t => new Date(t - 4 * 3600e3).toISOString().slice(0, 10);

// observações rápidas: o professor toca, sem escrever (o código vai para o banco; o texto, para a IA)
export const OBS = {
  participa: 'participa das aulas com interesse', colabora: 'colabora com os colegas', organiza: 'é organizado(a) com as tarefas e o material',
  autonomia: 'realiza as atividades com autonomia', respeita: 'respeita as combinações da turma', criativo: 'é criativo(a) nas propostas',
  le_avanco: 'avançou na leitura', le_apoio: 'precisa de incentivo na leitura', escrita_avanco: 'avançou na escrita', escrita_apoio: 'precisa de apoio na escrita',
  calculo_avanco: 'avançou em cálculo e raciocínio matemático', calculo_apoio: 'precisa de apoio em matemática',
  distrai: 'se distrai com facilidade', timido: 'participa pouco, precisa de incentivo para se expressar', tarefas: 'nem sempre traz as tarefas de casa'
};
const ALERTAS_PED = { pei: 'tem plano educacional individual (PEI) e as atividades seguem as adaptações previstas', apoio: 'recebe apoio pedagógico' };

async function quem(db, uid) {
  const u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Acesso não liberado.');
  return u;
}
const escolasDe = u => [...new Set([...(Array.isArray(u.escolas_ids) ? u.escolas_ids : []), u.escola_id].filter(Boolean))];
// quem faz o parecer: o professor da escola da turma (como na chamada), a gestão da escola e o administrador
async function turmaDoUsuario(db, u, turmaId) {
  if (!ID.test(String(turmaId || ''))) throw new HttpsError('invalid-argument', 'Turma inválida.');
  const t = (await db.doc(`turmas/${turmaId}`).get()).data();
  if (!t) throw new HttpsError('not-found', 'Turma não encontrada.');
  const ok = u.perfil === 'admin' || (['professor', 'gestor'].includes(u.perfil) && escolasDe(u).includes(t.escola_id) && (!u.municipio_id || !t.municipio_id || u.municipio_id === t.municipio_id));
  if (!ok) throw new HttpsError('permission-denied', 'Esta turma não é de uma escola sua.');
  return { id: turmaId, ...t };
}
// período (bimestre) pelo calendário da rede; sem calendário, os bimestres de costume
async function periodoDe(db, t, ano, p) {
  const R = { ...REGRAS_NOTAS, ...((await db.doc(`notas_regras/${t.municipio_id || '-'}`).get()).data() || {}) };
  const n = Math.min(4, Math.max(1, +R.periodos || 4));
  if (!(p >= 1 && p <= n)) throw new HttpsError('invalid-argument', 'Período fora da regra da rede.');
  const cal = (await db.doc(`cal_rede/${t.municipio_id || '-'}_${ano}`).get()).data() || {};
  const pc = Array.isArray(cal.periodos) && cal.periodos[p - 1];
  const padrao = n === 4 ? [['02-01', '04-30'], ['05-01', '07-31'], ['08-01', '09-30'], ['10-01', '12-31']][p - 1] : n === 3 ? [['02-01', '05-15'], ['05-16', '09-15'], ['09-16', '12-31']][p - 1] : [['02-01', '07-31'], ['08-01', '12-31']][p - 1];
  const inicio = pc && pc.inicio ? pc.inicio : ano + '-' + padrao[0], fim = pc && pc.fim ? pc.fim : ano + '-' + padrao[1];
  const nome = (n === 4 ? 'bimestre' : n === 3 ? 'trimestre' : 'semestre');
  return { R, n, inicio, fim, nome, rotulo: p + 'º ' + nome, do_calendario: !!(pc && pc.inicio) };
}

// os dados do período de cada aluno (lista de ids) numa turma
export async function dadosTurma(db, t, ano, per, p, ids) {
  const [fr, pls, nes, pos] = await Promise.all([
    db.doc(`freq_resumo/${t.id}_${ano}`).get(),
    db.collection('notas_planilhas').where('turma_id', '==', t.id).get(),
    db.collection('notas_escola').where('turma_id', '==', t.id).get(),
    db.collection('provas_online').where('turma_id', '==', t.id).get()
  ]);
  // frequência: só os dias do período, entre o primeiro e o último dia em que o aluno esteve na lista
  const F = fr.data() || {}, dias = Object.keys(F.dias || {}).filter(d => d >= per.inicio && d <= per.fim).sort(), dec = {};
  dias.forEach(d => { dec[d] = decodificar(F.dias[d]); });
  const freq = {};
  ids.forEach(id => {
    const b = (F.alunos || {})[id] || {}; let a = 0, f = 0, j = 0, seg = 0, maior = 0;
    dias.forEach(d => { if ((b.d && d < b.d) || (b.t && d > b.t)) return; const x = dec[d], fa = +x.f[id] || 0; a += x.a; f += fa; if (fa && x.j.includes(id)) j += fa;
      if (x.a && fa >= x.a && !x.j.includes(id)) { seg++; maior = Math.max(maior, seg); } else seg = 0; });
    freq[id] = a ? { aulas: a, faltas: f, justificadas: j, pct: Math.round((a - f) / a * 1000) / 10, seguidos: maior } : null;
  });
  // médias do período por disciplina (planilha do professor ou o que a escola digitou)
  const porDisc = {};
  const recente = (x, y) => !x || ms(y.atualizado_em) > ms(x.atualizado_em) ? y : x;
  pls.docs.forEach(d => { const x = d.data(); if (+x.ano_letivo !== ano) return; const k = slug(x.disciplina); (porDisc[k] = porDisc[k] || { nome: x.disciplina }).P = recente(porDisc[k].P, x); });
  nes.docs.forEach(d => { const x = d.data(); if (+x.ano_letivo !== ano) return; const k = x.disc_id || slug(x.disciplina); (porDisc[k] = porDisc[k] || { nome: x.disciplina }).Esc = x; });
  const medias = {}; ids.forEach(id => { medias[id] = []; });
  Object.values(porDisc).forEach(x => { const r = periodoDisciplina(x.P, x.Esc, per.R, ids, p); if (!r.fonte) return;
    ids.forEach(id => { const v = r.alunos[id]; if (v && v.m !== null && v.m !== undefined) medias[id].push({ disciplina: txt(x.nome, 60), media: v.m }); }); });
  // habilidades da BNCC: questões com código nas provas online do período (acertou 60% ou mais = consolidada)
  const provas = pos.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.status !== 'cancelada' && (x.questoes || []).some(q => q.bncc) &&
    (x.periodo ? +x.ano_letivo === ano && +x.periodo === p : (() => { const dd = diaMS(ms(x.fecha_em) || ms(x.abre_em)); return dd >= per.inicio && dd <= per.fim; })()));
  const hab = {}; ids.forEach(id => { hab[id] = {}; });
  const nProvas = {};
  for (const pr of provas.slice(0, 20)) {
    const refs = ids.map(id => db.doc(`provas_online/${pr.id}/po_resultados/m-${id}`));
    const rs = refs.length ? await db.getAll(...refs) : [];
    rs.forEach((s, i) => { if (!s.exists) return; const id = ids[i], r = s.data(), por = r.por_questao || {}; nProvas[id] = (nProvas[id] || 0) + 1;
      (pr.questoes || []).forEach(q => { const c = String(q.bncc || '').toUpperCase(), x = por[q.id]; if (!c || !x || x.pendente) return;
        const h = (hab[id][c] = hab[id][c] || { ok: 0, n: 0 }); h.n++; if (x.ok || (q.valor && x.pontos >= q.valor * 0.6)) h.ok++; }); });
  }
  const out = {};
  ids.forEach(id => {
    const hs = Object.entries(hab[id]).map(([c, h]) => ({ codigo: c, texto: txt(BNCC[c] || '', 220), pct: Math.round(h.ok / h.n * 100), consolidada: h.ok / h.n >= 0.6 }));
    out[id] = { freq: freq[id], medias: medias[id], provas: nProvas[id] || 0, habilidades: hs.slice(0, 24) };
  });
  return out;
}
async function alunosDaTurma(db, t) {
  const s = await db.collection('alunos').where('turma_id', '==', t.id).where('escola_id', '==', t.escola_id).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.nome && a.status !== 'inativo')
    .map(a => ({ id: a.id, nome: txt(a.nome_social || a.nome, 80), sexo: a.sexo === 'F' || a.sexo === 'M' ? a.sexo : '',
      apoio: [...new Set((Array.isArray(a.alertas) ? a.alertas : []).map(x => x && x.t).filter(k => ALERTAS_PED[k]))] }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
const chaveParecer = (t, ano, p, aid) => `pareceres/${t.id}_${ano}_${p}_${aid}`;

// o pedido para a IA: sem nome (o texto usa {NOME}), sem saúde; só o que o Portal mediu e o que o professor marcou
export function pedidoIA(t, per, a, d, obs, livre, regras) {
  const g = a.sexo === 'F' ? 'feminino (a aluna)' : a.sexo === 'M' ? 'masculino (o aluno)' : 'não informado (evite marcar gênero; prefira "a criança", "o(a) estudante")';
  const L = ['ALUNO: {NOME} · gênero gramatical: ' + g, 'Turma: ' + txt(t.nome, 60) + (t.serie ? ' (' + txt(t.serie, 30) + ')' : ''), 'Período: ' + per.rotulo];
  if (d.freq) L.push('Frequência no período: ' + String(d.freq.pct).replace('.', ',') + '% (' + d.freq.faltas + ' faltas em ' + d.freq.aulas + ' aulas' + (d.freq.justificadas ? ', ' + d.freq.justificadas + ' justificadas' : '') + ')' + (d.freq.seguidos >= 3 ? '; chegou a faltar ' + d.freq.seguidos + ' dias seguidos' : '') + '. Mínimo da rede: ' + (regras.freq_minima || 75) + '%.');
  else L.push('Frequência no período: sem chamada registrada.');
  if (d.medias.length) L.push('Médias do período (mínimo ' + String(regras.media_minima || 6).replace('.', ',') + ' de ' + (regras.nota_max || 10) + '): ' + d.medias.map(m => m.disciplina + ' ' + String(m.media).replace('.', ',')).join('; ') + '.');
  else L.push('Médias do período: nenhuma nota lançada.');
  if (d.habilidades.length) {
    const ok = d.habilidades.filter(h => h.consolidada), nao = d.habilidades.filter(h => !h.consolidada);
    if (ok.length) L.push('Habilidades da BNCC consolidadas nas provas: ' + ok.map(h => h.codigo + (h.texto ? ' (' + h.texto + ')' : '')).join('; ') + '.');
    if (nao.length) L.push('Habilidades da BNCC ainda em desenvolvimento nas provas: ' + nao.map(h => h.codigo + (h.texto ? ' (' + h.texto + ')' : '')).join('; ') + '.');
  } else L.push('Provas com habilidades da BNCC no período: nenhuma registrada.');
  if (a.apoio.length) L.push('Atendimento: ' + a.apoio.map(k => ALERTAS_PED[k]).join('; ') + '.');
  L.push('OBSERVAÇÕES DO PROFESSOR: ' + (obs.length ? obs.map(k => OBS[k]).join('; ') : 'nenhuma marcada') + '.');
  if (livre) L.push('COMENTÁRIO DO PROFESSOR: ' + livre);
  return L.join('\n');
}
const SISTEMA = 'Você é um(a) professor(a) experiente da rede pública brasileira e escreve o PARECER DESCRITIVO do período de um aluno, que vai para o boletim e é lido pela família e pela coordenação. ' +
  'Escreva em português do Brasil, em linguagem clara, acolhedora e profissional, sem jargão. Três parágrafos curtos, sem títulos: (1) o desenvolvimento e os avanços no período; (2) o que ainda está em desenvolvimento, dito de forma construtiva; (3) sugestões para a família em casa e, quando a frequência estiver abaixo do mínimo, a importância da presença. ' +
  'Entre 110 e 200 palavras no total. Use {NOME} (exatamente assim, com chaves) no lugar do nome, no máximo 2 vezes; nas outras vezes use o pronome conforme o gênero informado. ' +
  'REGRAS: afirme só o que os DADOS e as OBSERVAÇÕES sustentam; não invente atividade, conteúdo, comportamento ou nota. Sem prova ou sem nota no período, diga com naturalidade que a avaliação do período não foi registrada e baseie-se na frequência e na observação. ' +
  'Fale das habilidades da BNCC pelo que elas significam (o que o aluno sabe fazer), sem citar os códigos. Não cite números de média; frequência só quando estiver abaixo do mínimo ou for um destaque. ' +
  'Nunca mencione diagnóstico, laudo, saúde ou medicação; para quem tem plano individual, fale das adaptações e do progresso dentro delas. Sem rótulos negativos (preguiçoso, fraco, bagunceiro) e sem comparar com colegas. ' +
  'Educação Infantil: não fale de notas; fale de interações, brincadeiras e dos campos de experiência. Responda somente no formato JSON pedido.';
const ESQUEMA = { type: 'OBJECT', properties: { texto: { type: 'STRING', description: 'o parecer, três parágrafos separados por linha em branco' } }, required: ['texto'] };
// tira o nome do aluno do comentário livre antes de mandar para a IA
export function semNome(livre, nome) {
  let s = txt(livre, 400);
  String(nome || '').split(/\s+/).filter(w => w.length >= 3).forEach(w => { s = s.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), '{NOME}'); });
  s = s.replace(/(\{NOME\}\s*)+/g, "{NOME} ").trim();
  return s.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[número retirado]');
}
const primeiroNome = n => (String(n || '').trim().split(/\s+/)[0] || '').replace(/^./, c => c.toUpperCase());

export const pareceres = onCall({ region: REGIAO, secrets: [GEMINI, SMTP_SENHA], timeoutSeconds: 180, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {}, u = await quem(db, uid);
  const t = await turmaDoUsuario(db, u, d.turma_id), ano = +d.ano || new Date().getFullYear(), p = +d.periodo;
  if (!(ano >= 2020 && ano <= 2100)) throw new HttpsError('invalid-argument', 'Ano inválido.');
  const per = await periodoDe(db, t, ano, p);

  if (d.acao === 'dados') {
    const alunos = await alunosDaTurma(db, t);
    const periodo = { inicio: per.inicio, fim: per.fim, rotulo: per.rotulo, nome: per.nome, do_calendario: per.do_calendario, freq_minima: per.R.freq_minima, media_minima: per.R.media_minima };
    const turma = { id: t.id, nome: t.nome || '', escola_id: t.escola_id, municipio_id: t.municipio_id || '', etapa: etapaDaTurma(t.serie || t.nome) };
    if (!alunos.length) return { alunos: [], periodo, periodos: per.n, obs: OBS, turma };
    const ids = alunos.map(a => a.id).slice(0, 80), dados = await dadosTurma(db, t, ano, per, p, ids);
    const salvos = await db.getAll(...ids.map(id => db.doc(chaveParecer(t, ano, p, id))));
    const sv = {}; salvos.forEach((s, i) => { if (s.exists) { const x = s.data(); sv[ids[i]] = { texto: x.texto || '', status: x.status || 'rascunho', obs: x.obs || [], livre: x.livre || '', aprovado_por_nome: x.aprovado_por_nome || '', editado: !!x.editado,
      com_ia: !!x.gerado_em, aprovado_em: ms(x.aprovado_em) }; } });
    return { periodo, periodos: per.n, obs: OBS, turma,
      alunos: alunos.slice(0, 80).map(a => ({ id: a.id, nome: a.nome, apoio: a.apoio, ...dados[a.id], salvo: sv[a.id] || null })) };
  }

  const aid = String(d.aluno_id || '');
  if (!ID.test(aid)) throw new HttpsError('invalid-argument', 'Aluno inválido.');
  const al = (await alunosDaTurma(db, t)).find(a => a.id === aid);
  if (!al) throw new HttpsError('not-found', 'Aluno não está nesta turma.');
  const ref = db.doc(chaveParecer(t, ano, p, aid));
  const base = { escola_id: t.escola_id || '', municipio_id: t.municipio_id || '', turma_id: t.id, turma_nome: txt(t.nome, 80), ano, periodo: p, aluno_id: aid, aluno_nome: al.nome };

  if (d.acao === 'gerar') {
    const ctx = await contexto(db, uid); ctx.uid = uid;
    const a = acessoIA('portalia', ctx.ia); if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso('portalia', a.motivo));
    const obs = (Array.isArray(d.obs) ? d.obs : []).map(String).filter(k => OBS[k]).slice(0, 8), livreOrig = txt(d.livre, 400), livre = semNome(livreOrig, al.nome);
    const dados = (await dadosTurma(db, t, ano, per, p, [aid]))[aid];
    // grátis (nov/2026): sem crédito, com limite diário por professor (dá para a turma inteira e mais um pouco)
    const uj = await usoJustoDiario(db, ctx, 'parecer', 150);
    if (!uj.ok) throw new HttpsError('resource-exhausted', 'Você chegou ao limite de ' + uj.limite + ' pareceres gerados hoje. Amanhã libera de novo.');
    const res = { acao: 'parecer_turma' };
    let r = null, erro = null, texto = '';
    try {
      for (let k = 0; k < 3 && !texto; k++) {
        r = await geminiJson(GEMINI.value(), k < 2 ? [ctx.cfg.modelo_texto, ...RESERVA_TEXTO] : [ctx.cfg.modelo_rapido, ctx.cfg.modelo_texto], SISTEMA, pedidoIA(t, per, al, dados, obs, livre, per.R), ESQUEMA, 0.7);
        const bruto = txt(r.json && r.json.texto, 3000);
        if (bruto.split(/\s+/).length >= 60) texto = bruto;
      }
    } catch (e) { erro = e; }
    if (!texto) await uj.desfazer();
    await registrarConsumo(db, ctx, texto ? { ...res, acao: 'parecer_turma' } : null, { modelo: r && r.modelo, entrada: r && r.entrada, saida: r && r.saida });
    if (!texto) throw erro instanceof HttpsError ? erro : new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo.');
    const nome = primeiroNome(al.nome);
    texto = texto.replace(/\{\s*NOME\s*\}/g, nome).replace(/\n{3,}/g, '\n\n');
    await ref.set({ ...base, texto, status: 'rascunho', obs, livre: livreOrig, editado: false, gerado_por: uid, gerado_por_nome: txt(u.nome, 80), gerado_em: FieldValue.serverTimestamp(),
      gerados: FieldValue.increment(1), aprovado_por: '', aprovado_por_nome: '', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    return { texto, status: 'rascunho' };
  }

  if (d.acao === 'salvar') {
    const texto = String(d.texto ?? '').replace(/\r/g, '').trim().slice(0, 4000), aprovar = d.aprovar === true;
    if (texto.length < 40) throw new HttpsError('invalid-argument', 'O parecer está curto demais.');
    const atual = (await ref.get()).data() || {}, comIA = !!atual.gerado_em;
    // Diretrizes CNE/MEC (nov/2026): parecer é documento de avaliação (risco alto); com rascunho da IA, a aprovação exige
    // a confirmação explícita de que o professor leu e revisou, e fica registrada (quem, quando, se editou) na Auditoria
    if (aprovar && comIA && d.revisado !== true) throw new HttpsError('failed-precondition', 'Marque "Li e revisei este parecer" antes de aprovar.');
    const editado = atual.texto ? atual.texto !== texto || !!atual.editado : true;
    await ref.set({ ...base, texto, status: aprovar ? 'aprovado' : 'rascunho', editado, com_ia: comIA,
      obs: Array.isArray(d.obs) ? d.obs.map(String).filter(k => OBS[k]).slice(0, 8) : (atual.obs || []), livre: d.livre !== undefined ? txt(d.livre, 400) : (atual.livre || ''),
      aprovado_por: aprovar ? uid : '', aprovado_por_nome: aprovar ? txt(u.nome, 80) : '', ...(aprovar ? { aprovado_em: FieldValue.serverTimestamp(), revisado_confirmado: comIA } : {}), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    if (aprovar) await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: expiraAuditoria(), acao: 'alterou', origem: 'funcao', colecao: 'pareceres', doc: ref.id,
      autor_uid: uid, autor_tipo: 'usuario', autor_email: txt(u.email, 120), perfil: txt(u.perfil, 30), municipio_id: txt(t.municipio_id, 64), escola_id: txt(t.escola_id, 64),
      detalhe: 'Aprovou o parecer de ' + txt(al.nome, 80) + ' (' + txt(t.nome, 60) + ', ' + per.rotulo + ')' + (comIA ? ', elaborado com apoio de IA; o professor confirmou que leu e revisou; ' + (editado ? 'texto editado pelo professor' : 'texto da IA mantido sem edição') : ', escrito pelo professor'),
      campos: ['status'], valores: { status: { de: atual.status || 'rascunho', para: 'aprovado' } } });
    // aprovado pelo professor: entra na Central de Relatórios (modelo Parecer / Relatório Bimestral) e vai para a coordenação conferir
    if (aprovar) {
      const rref = db.doc(`relatorios/par_${t.id}_${ano}_${p}_${aid}`), rel = (await rref.get()).data();
      const esc = t.escola_id ? ((await db.doc(`escolas/${t.escola_id}`).get()).data() || {}) : {};
      const mudou = !rel || ((rel.dados || {}).parecer || '') !== texto;
      if (mudou) await rref.set({ modelo: 'RBA', titulo: 'Parecer / Relatório Bimestral · ' + al.nome, escola_id: t.escola_id || '', escola_nome: txt(esc.nome || t.escola_nome || '', 120),
        municipio_id: t.municipio_id || '', turma_id: t.id, turma_nome: txt(t.nome, 80), aluno_id: aid, aluno_nome: al.nome, periodo: ano + ' · ' + per.rotulo,
        dados: { ...((rel && rel.dados) || {}), parecer: texto, origem: 'pareceres_turma', apoio_ia: comIA, aprovado_por_nome: txt(u.nome, 80) }, status: 'enviado', autor_uid: rel ? rel.autor_uid : uid, autor_nome: rel ? rel.autor_nome : txt(u.nome, 80),
        ...(rel ? {} : { criado_em: FieldValue.serverTimestamp(), comentario: '' }), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    }
    return { status: aprovar ? 'aprovado' : 'rascunho' };
  }
  throw new HttpsError('invalid-argument', 'Ação inválida.');
});

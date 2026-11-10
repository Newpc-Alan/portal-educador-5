// Relatório de execução contratual (nov/2026) · Lei 14.133/2021, art. 117 (fiscalização do contrato).
// Junta, para uma rede e um mês, as evidências de que o serviço foi prestado: disponibilidade da plataforma, acesso e uso real
// dos professores, Formação Continuada, equipamentos e chamados técnicos. A IA só ESCREVE o parecer a partir destes números
// (nenhum nome de pessoa vai para a IA) e o texto fica editável antes de imprimir. Cada emissão é guardada em
// relatorios_execucao/{rede}_{AAAA-MM} (números + parecer + quem emitiu), para auditoria e Tribunal de Contas.
// Só o administrador NEWPC emite (o fiscal recebe o PDF assinado).
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { semanaDe } from './uso-real.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const MODELOS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const TZ = 4 * 3600e3;                                   // Campo Grande, UTC-4
const ms = t => (t && t.toMillis ? t.toMillis() : 0);
const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const MODULOS = { portalia: 'Portal IA', provas: 'Provas e avaliações', formacao: 'Formação Continuada', lousa: 'Lousa interativa', atividades: 'Atividades',
  videos: 'Vídeos', jogos: 'Jogos', portal360: 'Portal 360º VR', biblioteca: 'Biblioteca', turmas: 'Minhas turmas', frequencia: 'Frequência', notas: 'Notas e médias' };
const ACOES = { ia: 'materiais criados com o Portal IA', lousa: 'aulas preparadas na Lousa', prova: 'provas montadas no Gerador', prova_online: 'provas aplicadas online',
  correcoes: 'provas corrigidas', envio_turma: 'conteúdos enviados às turmas', familias: 'materiais enviados às famílias', reuso: 'materiais reaproveitados da rede' };

function periodo(mes) {
  const [a, m] = mes.split('-').map(Number);
  const ini = Date.UTC(a, m - 1, 1) + TZ, fim = Date.UTC(a, m, 1) + TZ - 1;
  return { ini, fim, diaIni: `${mes}-01`, diaFim: new Date(fim - TZ).toISOString().slice(0, 10), nome: new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

export async function montarExecucao(db, mun, mes) {
  const P = periodo(mes), ag = Date.now();
  const mu = (await db.doc(`municipios/${mun}`).get()).data();
  if (!mu) throw new HttpsError('not-found', 'Rede não encontrada.');
  const tsIni = Timestamp.fromMillis(P.ini), tsFim = Timestamp.fromMillis(P.fim);
  const tenta = async (f, padrao) => { try { return await f(); } catch (e) { console.warn('execucao:', e.message); return padrao; } };

  // cadastro e acesso
  const [escS, usS] = await Promise.all([db.collection('escolas').where('municipio_id', '==', mun).select('nome', 'status').get(),
    db.collection('usuarios').where('municipio_id', '==', mun).select('perfil', 'status', 'demo', 'escola_id', 'email').get()]);
  const us = usS.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.status === 'ativo' && !u.demo);
  const profs = new Set(us.filter(u => u.perfil === 'professor').map(u => u.id));
  const gestao = us.filter(u => ['gestor', 'secretaria', 'secretaria_escolar'].includes(u.perfil)).length;
  // convites enviados pela rede/NEWPC que ainda não viraram conta (licença disponibilizada, aguardando o primeiro acesso)
  const convidados = await tenta(async () => {
    const contas = new Set(usS.docs.map(d => String(d.get('email') || '').toLowerCase()).filter(Boolean));
    let n = 0; (await db.collection('pre_cadastros').where('municipio_id', '==', mun).where('status', '==', 'ativo').select('email', 'perfil').get())
      .forEach(d => { const u = d.data(), e = String(u.email || d.id).trim().toLowerCase(); if (u.perfil !== 'aluno' && !contas.has(e)) n++; });
    return n; }, 0);
  const acesso = await tenta(async () => {
    const s = await db.collection('acessos_dia').where('municipio', '==', mu.nome || '').where('dia', '>=', P.diaIni).get();
    const quem = new Set(), dias = new Set(), mods = {}; let n = 0;
    s.forEach(d => { const x = d.data(); if (x.dia > P.diaFim || !profs.has(x.uid)) return; n++; quem.add(x.uid); dias.add(x.dia); (x.modulos || []).forEach(m => { mods[m] = (mods[m] || 0) + 1; }); });
    return { professores: quem.size, acessos: n, dias_com_uso: dias.size, recursos: Object.entries(mods).map(([id, q]) => ({ nome: MODULOS[id] || id, n: q })).sort((a, b) => b.n - a.n).slice(0, 8) };
  }, { professores: 0, acessos: 0, dias_com_uso: 0, recursos: [] });

  // uso real (ações de valor) nas semanas que começam dentro do mês
  const uso = await tenta(async () => {
    // semanas (segunda a domingo) que começam dentro do mês
    const ids = []; for (let t = P.ini; t <= P.fim; t += 864e5) { const w = semanaDe(t + 3600e3); if (w.ini >= P.ini - 3600e3 && !ids.includes(w.id)) ids.push(w.id); }
    const docs = await Promise.all(ids.map(id => db.doc(`uso_real/${id}_${mun}`).get()));
    const acoes = {}; let pico = 0; const semanas = [];
    docs.forEach(d => { if (!d.exists) return; const x = d.data();
      semanas.push(x.semana); pico = Math.max(pico, x.ativos || 0); Object.entries(x.acoes || {}).forEach(([k, v]) => { acoes[k] = (acoes[k] || 0) + v; }); });
    return { semanas: semanas.length, pico_semanal: pico, acoes: Object.entries(acoes).map(([k, v]) => ({ nome: ACOES[k] || k, n: v })).sort((a, b) => b.n - a.n) };
  }, { semanas: 0, pico_semanal: 0, acoes: [] });

  // provas online aplicadas no mês nas escolas da rede
  const provas = await tenta(async () => {
    const esc = new Set(escS.docs.map(d => d.id));
    const s = await db.collection('provas_online').where('abre_em', '>=', tsIni).where('abre_em', '<=', tsFim).select('escola_id', 'status', 'alunos').get();
    let n = 0, alunos = 0; s.forEach(d => { const x = d.data(); if (!esc.has(x.escola_id) || x.status === 'cancelada') return; n++; alunos += (x.alunos || []).length; });
    return { aplicadas: n, alunos_convocados: alunos };
  }, { aplicadas: 0, alunos_convocados: 0 });

  // Formação Continuada: certificados emitidos no mês e acumulado do ano
  const formacao = await tenta(async () => {
    const fs = await db.collection('users').where('municipio_id', '==', mun).select('nome').get();
    const uids = [...new Set([...profs, ...fs.docs.map(d => d.id)])];
    let mesN = 0, mesH = 0, anoN = 0, anoH = 0; const pessoas = new Set();
    const anoIni = Date.UTC(Number(mes.slice(0, 4)), 0, 1) + TZ;
    for (let i = 0; i < uids.length; i += 30) (await db.collection('certificados').where('uid', 'in', uids.slice(i, i + 30)).get()).forEach(d => {
      const c = d.data(); if (c.ativo === false) return; const t = ms(c.emitidoEm), h = Number(c.cargaHoraria || 0);
      if (t >= anoIni && t <= P.fim) { anoN++; anoH += h; }
      if (t >= P.ini && t <= P.fim) { mesN++; mesH += h; pessoas.add(c.uid); } });
    return { cursistas: fs.size, certificados_mes: mesN, horas_mes: Math.round(mesH), concluintes_mes: pessoas.size, certificados_ano: anoN, horas_ano: Math.round(anoH) };
  }, { cursistas: 0, certificados_mes: 0, horas_mes: 0, concluintes_mes: 0, certificados_ano: 0, horas_ano: 0 });

  // equipamentos e chamados técnicos
  const equip = await tenta(async () => {
    const [it, ch] = await Promise.all([db.collection('rec_itens').where('municipio_id', '==', mun).select('tipo', 'situacao', 'ativo', 'escola_id').get(),
      db.collection('rec_chamados').where('municipio_id', '==', mun).select('status', 'criado_em', 'resolvido_em').get()]);
    // situação como no app Recursos da Escola: em uso, em manutenção, em estoque, baixado
    const SIT = { em_uso: 'Em uso', manutencao: 'Em manutenção', estoque: 'Em estoque', baixado: 'Baixado' };
    const tipos = {}, sit = {}, porEsc = {};
    it.forEach(d => { const x = d.data(), t = x.tipo || 'Outro', st = x.situacao || (x.ativo === false ? 'baixado' : 'em_uso');
      tipos[t] = (tipos[t] || 0) + 1; sit[st] = (sit[st] || 0) + 1;
      const e = porEsc[x.escola_id || ''] = porEsc[x.escola_id || ''] || { n: 0, uso: 0, man: 0 }; e.n++; if (st === 'em_uso') e.uso++; if (st === 'manutencao') e.man++; });
    const escNome = {}; escS.docs.forEach(d => { escNome[d.id] = d.data().nome || d.id; });
    const escolas = Object.entries(porEsc).map(([id, e]) => ({ nome: id ? escNome[id] || 'Escola' : 'Estoque (ainda não entregue)', ...e })).sort((a, b) => b.n - a.n);
    let abertos = 0, resolvidos = 0, horas = 0, abertosAgora = 0;
    ch.forEach(d => { const x = d.data(), c = ms(x.criado_em), r = ms(x.resolvido_em);
      if (c >= P.ini && c <= P.fim) abertos++;
      if (r >= P.ini && r <= P.fim) { resolvidos++; if (c) horas += (r - c) / 36e5; }
      if (x.status !== 'resolvido' && c <= P.fim) abertosAgora++; });
    return { itens: it.size, tipos: Object.entries(tipos).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
      situacao: Object.entries(sit).map(([k, n]) => ({ nome: SIT[k] || k, n })).sort((a, b) => b.n - a.n), escolas: escolas.slice(0, 40), chamados_abertos: abertos,
      chamados_resolvidos: resolvidos, horas_media: resolvidos ? Math.round(horas / resolvidos) : null, em_aberto_fim: abertosAgora };
  }, { itens: 0, tipos: [], situacao: [], escolas: [], chamados_abertos: 0, chamados_resolvidos: 0, horas_media: null, em_aberto_fim: 0 });

  // disponibilidade da plataforma (verificação automática a cada 30 min, GitHub Actions)
  const disp = await tenta(async () => { const d = (await db.doc(`stats/disponibilidade_${mes.replace('-', '')}`).get()).data() || {};
    const v = d.verificacoes || 0, f = d.falhas || 0; return { verificacoes: v, falhas: f, pct: v ? Math.round((v - f) / v * 10000) / 100 : null }; }, { verificacoes: 0, falhas: 0, pct: null });

  return {
    rede: { id: mun, nome: mu.nome || '', uf: mu.uf || '', tipo: mu.tipo_rede || 'municipal', contrato: mu.contrato_numero || '', vigencia_fim: ms(mu.vigencia_fim) || ms(mu.vigencia_fim_ts) || null,
      escolas_rede: (mu.rede && mu.rede.escolas) || null, alunos_rede: (mu.rede && mu.rede.alunos) || null, censo_ano: (mu.rede && mu.rede.ano) || null,
      modulos: (mu.modulos_professor || []).map(m => MODULOS[m] || m) },
    periodo: { mes, nome: P.nome, inicio: P.diaIni, fim: P.diaFim, parcial: ag < P.fim },
    cadastro: { escolas: escS.size, professores: profs.size, gestao, convidados },
    acesso, uso, provas, formacao, equipamentos: equip, disponibilidade: disp, gerado_em: ag
  };
}

async function parecerIA(d) {
  // seções fora do relatório não entram no texto
  const instrucao = 'Você redige, em português formal do Brasil, o PARECER TÉCNICO de um relatório mensal de execução contratual (Lei 14.133/2021, art. 117) ' +
    'da contratada NEWPC Tecnologia para o fiscal do contrato de uma rede pública de ensino. Use SOMENTE os números do JSON; não invente dado, percentual nem comparação. ' +
    'O JSON traz só as seções que fazem parte deste contrato (plataforma, Formação Continuada e/ou equipamentos); comente apenas o que estiver nele. ' +
    'Estrutura: 3 parágrafos curtos. 1) O que foi disponibilizado e está em operação: plataforma (disponibilidade, licenças ativas e convites enviados) e/ou equipamentos (quantidade, situação, escolas atendidas), citando números. ' +
    '2) Entregas do período: uso pedagógico, Formação Continuada e suporte técnico, conforme o JSON (cite números; se um item estiver zerado, diga de forma neutra que não houve registro no período). ' +
    '3) Conclusão: declare que os serviços foram prestados conforme o contrato no período e aponte, com tom propositivo, até 2 pontos de atenção para a rede (ex.: baixa adesão, chamados em aberto). ' +
    'Não use travessão. Não use adjetivos de marketing. Sem títulos, sem listas, sem assinatura. Máximo de 220 palavras.' + (d.periodo.parcial ? ' O mês ainda está em andamento: diga que os dados são parciais.' : '');
  for (const modelo of MODELOS) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelo) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI.value() }, signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: instrucao }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ ...d, gerado_em: undefined }) }] }],
          generationConfig: { maxOutputTokens: 900, temperature: 0.3 } }) });
      if (!r.ok) continue;
      const j = await r.json(), t = (((j.candidates || [])[0] || {}).content?.parts || []).map(p => p.text || '').join('').trim();
      if (t) return t.replace(/\s*[—–]\s*/g, ', ');
    } catch (e) { /* próximo modelo */ }
  }
  return '';
}

export const relatorioExecucao = onCall({ region: 'southamerica-east1', timeoutSeconds: 300, memory: '1GiB', secrets: [GEMINI], maxInstances: 3 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), eu = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!eu || eu.status !== 'ativo' || eu.perfil !== 'admin') throw new HttpsError('permission-denied', 'Só o administrador NEWPC emite o relatório de execução.');
  const d = req.data || {}, mun = String(d.municipio_id || ''), mes = String(d.mes || '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(mun) || !/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) throw new HttpsError('invalid-argument', 'Escolha a rede e o mês.');
  const ref = db.doc(`relatorios_execucao/${mun}_${mes}`);
  if (d.acao === 'salvar') {   // grava a versão final (números + parecer revisado) no histórico
    const dados = await montarExecucao(db, mun, mes);
    await ref.set({ municipio_id: mun, mes, dados, secoes: d.secoes && typeof d.secoes === 'object' ? { portal: d.secoes.portal !== false, formacao: d.secoes.formacao !== false, equipamentos: d.secoes.equipamentos !== false } : null, parecer: txt(d.parecer, 4000), emitido_por: eu.nome || eu.email || req.auth.uid, emitido_uid: req.auth.uid,
      emitido_em: FieldValue.serverTimestamp(), versoes: FieldValue.increment(1) }, { merge: true });
    return { ok: true };
  }
  const dados = await montarExecucao(db, mun, mes);
  const salvo = (await ref.get()).data();
  const sec = d.secoes && typeof d.secoes === 'object' ? d.secoes : {};
  const paraIA = { ...dados };   // a IA só comenta o que vai no relatório (o contrato pode ser só de equipamentos)
  if (sec.portal === false) { delete paraIA.acesso; delete paraIA.uso; delete paraIA.provas; delete paraIA.cadastro; }
  if (sec.formacao === false) delete paraIA.formacao;
  if (sec.equipamentos === false) delete paraIA.equipamentos;
  const parecer = d.parecer_ia ? await parecerIA(paraIA) : '';
  return { dados, parecer, salvo: salvo ? { parecer: salvo.parecer || '', emitido_por: salvo.emitido_por || '', emitido_em: ms(salvo.emitido_em), versoes: salvo.versoes || 1 } : null };
});

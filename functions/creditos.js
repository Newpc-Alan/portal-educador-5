// Créditos do Portal IA · pré-pago, sem surpresa na fatura.
// Cada município (plano Intermediário ou Completo) tem uma carteira: creditos/mun_{municipioId}.
// Cada professor pode ter a sua, comprada à parte: creditos/prof_{uid}.
// A carteira guarda pacotes com validade (12 meses); o consumo tira do pacote que vence primeiro.
// 1 material = 1 crédito, 1 ajuste = 1 crédito, 1 imagem = 5 créditos (config/portal_ia.creditos.precos).
// A rede gasta primeiro (com teto mensal por professor); acabou ou bateu o teto, usa os créditos do próprio professor.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { transporte, destinos, escHtml as esc, SMTP_SENHA, SMTP_USUARIO, REGIAO_FIRESTORE } from './dicas.js';

export const CREDITOS_PADRAO = {
  precos: { texto: 1, ajuste: 1, imagem: 5 },
  teto_padrao: 60,            // créditos da rede por professor por mês (0 = sem teto)
  alertas: [20, 5],           // % do saldo para avisar a NEWPC e a Secretaria
  validade_meses: 12,
  dolar: 5.6,
  // custo real em US$ por milhão de tokens (entrada, saída) e por imagem, para o relatório de margem
  custo_modelo: { 'gemini-3.6-flash': [0.75, 3.75], 'gemini-3.1-flash-lite': [0.1, 0.4], 'gemini-flash-latest': [0.75, 3.75] },
  custo_imagem: 0.067,
  // sugestões: o administrador ajusta valores e quantidades no painel
  pacotes_rede: [
    { id: 'rede-1000', nome: '1.000 créditos', creditos: 1000, valor: 250 },
    { id: 'rede-5000', nome: '5.000 créditos', creditos: 5000, valor: 1000 },
    { id: 'rede-20000', nome: '20.000 créditos', creditos: 20000, valor: 3600 }
  ],
  pacotes_professor: [
    { id: 'prof-100', nome: '100 créditos', creditos: 100, valor: 29.9 },
    { id: 'prof-300', nome: '300 créditos', creditos: 300, valor: 79.9 }
  ]
};
export const PLANOS_COM_IA = ['intermediario', 'completo', 'personalizado'];
const LINK_PAINEL = 'https://app.portaldoeducador.com.br/entrar/#creditos';

export const mesAtual = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '');
const ms = v => !v ? 0 : typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : typeof v === 'string' ? (Date.parse(v) || 0) : (v._seconds || v.seconds || 0) * 1000;
const inteiro = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min; };
const txt = (v, n) => String(v ?? '').trim().slice(0, n);

export function cfgCreditos(c) {
  const x = (c && c.creditos) || {};
  return { ...CREDITOS_PADRAO, ...x, precos: { ...CREDITOS_PADRAO.precos, ...(x.precos || {}) }, custo_modelo: { ...CREDITOS_PADRAO.custo_modelo, ...(x.custo_modelo || {}) } };
}

/* ---------------------------------------------------------------- contas da carteira (funções puras, testáveis) */
export function saldoDe(carteira, agora = Date.now()) {
  const ativos = ((carteira && carteira.pacotes) || []).filter(p => ms(p.validade) > agora && (p.restante || 0) > 0);
  const vivos = ((carteira && carteira.pacotes) || []).filter(p => ms(p.validade) > agora);
  const saldo = ativos.reduce((a, p) => a + (p.restante || 0), 0);
  const total = vivos.reduce((a, p) => a + (p.creditos || 0), 0);
  const prox = ativos.map(p => ms(p.validade)).sort((a, b) => a - b)[0] || 0;
  return { saldo, total, validade: prox };
}
// tira n créditos dos pacotes que vencem primeiro; devolve null se não houver saldo
export function debitarPacotes(pacotes, n, agora = Date.now()) {
  const novo = (pacotes || []).map(p => ({ ...p }));
  const ordem = novo.filter(p => ms(p.validade) > agora && (p.restante || 0) > 0).sort((a, b) => ms(a.validade) - ms(b.validade));
  if (ordem.reduce((a, p) => a + p.restante, 0) < n) return null;
  let falta = n; const tirado = [];
  for (const p of ordem) { if (!falta) break; const t = Math.min(p.restante, falta); p.restante -= t; falta -= t; tirado.push({ id: p.id, n: t }); }
  return { pacotes: novo, tirado };
}
export function devolverPacotes(pacotes, tirado) {
  const novo = (pacotes || []).map(p => ({ ...p }));
  (tirado || []).forEach(t => { const p = novo.find(x => x.id === t.id); if (p) p.restante = Math.min(p.creditos, (p.restante || 0) + t.n); });
  return novo;
}

/* ---------------------------------------------------------------- uso pelo Portal IA */
// quem paga: a rede (se o plano tem Portal IA, com teto mensal) e, depois, os créditos do professor
// opc (Central de IA): redeTexto / redeImagem dizem se a carteira da rede paga texto e imagem para esta pessoa;
// sem opc, vale a regra antiga do plano (Intermediário e Completo pagam texto; só o Completo paga imagem)
export async function situacao(db, ctx, opc = {}) {
  const cc = cfgCreditos(ctx.cfgRaw);
  if (ctx.admin) return { admin: true, plano: ctx.plano, precos: cc.precos, pode_usar: true, pode_imagem: true, rede: null, pessoal: null };
  const mun = ctx.eu.municipio_id || '', temRede = !!mun && (opc.redeTexto ?? PLANOS_COM_IA.includes(ctx.plano));
  const [ms_, ps, us] = await Promise.all([temRede ? db.doc(`creditos/mun_${mun}`).get() : null, db.doc(`creditos/prof_${ctx.uid}`).get(), db.doc(`portal_ia_uso/${ctx.uid}_${mesAtual()}`).get()]);
  const uso = us.exists ? us.data() : {};
  let rede = null;
  if (temRede) {
    const c = ms_ && ms_.exists ? ms_.data() : {}, s = saldoDe(c), teto = c.teto_professor ?? cc.teto_padrao;
    const usado = uso.creditos_rede || 0;
    rede = { saldo: s.saldo, validade: s.validade, teto, usado_mes: usado, restante_mes: teto > 0 ? Math.max(0, Math.min(teto - usado, s.saldo)) : s.saldo, imagem: opc.redeImagem ?? ctx.plano === 'completo' };
  }
  const p = ps.exists ? saldoDe(ps.data()) : { saldo: 0, validade: 0 };
  const pessoal = { saldo: p.saldo, validade: p.validade };
  const pode_usar = (rede ? rede.restante_mes : 0) + pessoal.saldo >= cc.precos.texto;
  const pode_imagem = ((rede && rede.imagem) ? rede.restante_mes : 0) + pessoal.saldo >= cc.precos.imagem;
  let motivo = '';
  if (!pode_usar) motivo = !temRede ? (pessoal.saldo ? '' : 'O Portal IA faz parte dos planos Intermediário e Completo da rede. Você também pode comprar créditos avulsos.')
    : rede.saldo <= 0 ? 'Os créditos da sua rede acabaram. A Secretaria de Educação já foi avisada. Enquanto isso, você pode usar créditos avulsos.'
    : 'Você chegou ao limite mensal de ' + rede.teto + ' créditos da rede. Ele renova no dia 1º. Enquanto isso, você pode usar créditos avulsos.';
  return { admin: false, plano: ctx.plano, precos: cc.precos, pode_usar, pode_imagem, motivo, rede, pessoal };
}

// reserva o custo da ação (texto, ajuste ou imagem); devolve o que foi tirado para estornar se a IA falhar
// opc.rede (Central de IA): a carteira da rede pode pagar este uso? opc.nome: nome do recurso, para a mensagem
export async function reservarCreditos(db, ctx, acao, opc = {}) {
  const cc = cfgCreditos(ctx.cfgRaw), custo = cc.precos[acao] || 1, campo = acao === 'imagem' ? 'imagens' : 'textos';
  const usoRef = db.doc(`portal_ia_uso/${ctx.uid}_${mesAtual()}`);
  if (ctx.admin) { await usoRef.set({ uid: ctx.uid, mes: mesAtual(), [campo]: FieldValue.increment(1), atualizado_em: FieldValue.serverTimestamp() }, { merge: true }); return { conta: 'admin', custo: 0, campo, usoRef }; }
  const mun = ctx.eu.municipio_id || '', temRede = !!mun && (opc.rede ?? PLANOS_COM_IA.includes(ctx.plano)), imagemRede = opc.rede ?? ctx.plano === 'completo';
  const refMun = temRede ? db.doc(`creditos/mun_${mun}`) : null, refProf = db.doc(`creditos/prof_${ctx.uid}`);
  const r = await db.runTransaction(async t => {
    const [m, p, u] = await Promise.all([refMun ? t.get(refMun) : null, t.get(refProf), t.get(usoRef)]);
    const uso = u.exists ? u.data() : {}, agora = Date.now();
    let motivo = !temRede ? 'plano' : 'saldo';
    if (refMun && (acao !== 'imagem' || imagemRede)) {
      const c = m && m.exists ? m.data() : null, teto = c ? (c.teto_professor ?? cc.teto_padrao) : 0;
      if (c && teto > 0 && (uso.creditos_rede || 0) + custo > teto) motivo = 'teto';
      else if (c) {
        const d = debitarPacotes(c.pacotes, custo, agora);
        if (d) {
          const s = saldoDe({ pacotes: d.pacotes }, agora), pct = s.total ? s.saldo / s.total * 100 : 0;
          const [a20, a5] = cc.alertas; let alerta = '';
          if (pct <= a5 && !c.alerta5) alerta = 'a5'; else if (pct <= a20 && !c.alerta20) alerta = 'a20';
          t.set(refMun, { pacotes: d.pacotes, saldo: s.saldo, ...(alerta === 'a5' ? { alerta5: true, alerta20: true } : alerta === 'a20' ? { alerta20: true } : {}), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
          t.set(usoRef, { uid: ctx.uid, mes: mesAtual(), municipio_id: mun, plano: ctx.plano, [campo]: (uso[campo] || 0) + 1, creditos_rede: (uso.creditos_rede || 0) + custo, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
          return { conta: 'mun_' + mun, tirado: d.tirado, alerta, saldo: s.saldo, total: s.total, pct };
        }
        motivo = 'saldo';
      }
    } else if (refMun && acao === 'imagem') motivo = 'imagem';
    const pc = p.exists ? p.data() : null, d = pc && debitarPacotes(pc.pacotes, custo, agora);
    if (d) {
      t.set(refProf, { pacotes: d.pacotes, saldo: saldoDe({ pacotes: d.pacotes }, agora).saldo, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      t.set(usoRef, { uid: ctx.uid, mes: mesAtual(), municipio_id: mun, plano: ctx.plano, [campo]: (uso[campo] || 0) + 1, creditos_pessoais: (uso.creditos_pessoais || 0) + custo, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      return { conta: 'prof_' + ctx.uid, tirado: d.tirado };
    }
    return { erro: motivo };
  });
  if (r.erro) {
    const avulso = ' Você pode comprar créditos avulsos no Portal IA.';
    const msg = { plano: (opc.rede === false ? 'Este uso não é pago pela sua rede e você não tem créditos avulsos suficientes.' : 'O Portal IA faz parte dos planos Intermediário e Completo da rede.') + avulso, imagem: 'Gerar imagens faz parte do plano Completo.' + avulso,
      teto: 'Você chegou ao limite mensal de créditos da rede. Ele renova no dia 1º.' + avulso, saldo: 'Os créditos da sua rede acabaram. A Secretaria de Educação já foi avisada.' + avulso }[r.erro];
    throw new HttpsError('resource-exhausted', msg);
  }
  if (r.alerta) await db.collection('creditos_alertas').add({ conta: r.conta, municipio_id: mun, nivel: r.alerta === 'a5' ? cc.alertas[1] : cc.alertas[0], saldo: r.saldo, total: r.total, em: FieldValue.serverTimestamp() });
  return { ...r, custo, campo, usoRef, acao };
}
export async function estornarCreditos(db, res) {
  if (!res || res.conta === 'admin' || !res.tirado) return;
  const ref = db.doc(`creditos/${res.conta}`), rede = res.conta.startsWith('mun_');
  await db.runTransaction(async t => {
    const s = await t.get(ref); if (!s.exists) return;
    const pac = devolverPacotes(s.data().pacotes, res.tirado);
    t.set(ref, { pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo }, { merge: true });
    t.set(res.usoRef, { [res.campo]: FieldValue.increment(-1), [rede ? 'creditos_rede' : 'creditos_pessoais']: FieldValue.increment(-res.custo), falhas: FieldValue.increment(1) }, { merge: true });
  });
}
// registra o consumo com o custo real (para o relatório de margem da NEWPC)
export async function registrarConsumo(db, ctx, res, info) {
  const cc = cfgCreditos(ctx.cfgRaw), preco = cc.custo_modelo[info.modelo] || cc.custo_modelo['gemini-3.6-flash'];
  const usd = (info.entrada || 0) / 1e6 * preco[0] + (info.saida || 0) / 1e6 * preco[1] + (info.imagem ? cc.custo_imagem : 0);
  const mes = mesAtual(), usoRef = db.doc(`portal_ia_uso/${ctx.uid}_${mes}`);
  const ops = [usoRef.set({ uid: ctx.uid, tokens_entrada: FieldValue.increment(info.entrada || 0), tokens_saida: FieldValue.increment(info.saida || 0), custo_usd: FieldValue.increment(usd), atualizado_em: FieldValue.serverTimestamp() }, { merge: true })];
  if (res && res.conta && res.conta !== 'admin' && res.custo) {
    const ref = db.doc(`creditos/${res.conta}`);
    ops.push(ref.set({ consumo: { [mes]: { creditos: FieldValue.increment(res.custo), custo_usd: FieldValue.increment(usd), usos: FieldValue.increment(1) } } }, { merge: true }));
    ops.push(ref.collection('movimentos').add({ tipo: 'consumo', creditos: -res.custo, acao: res.acao, uid: ctx.uid, escola_id: ctx.eu.escola_id || '', doc_id: info.doc_id || '', modelo: info.modelo || '', custo_usd: usd, em: FieldValue.serverTimestamp() }));
  } else if (res && res.conta === 'admin') {
    ops.push(db.doc('creditos/admin').set({ consumo: { [mes]: { custo_usd: FieldValue.increment(usd), usos: FieldValue.increment(1) } } }, { merge: true }));
  }
  await Promise.all(ops).catch(e => console.warn('creditos: registro', e.message));
}

/* ---------------------------------------------------------------- pedidos de recarga */
async function quem(db, uid) { const s = await db.doc(`usuarios/${uid}`).get(); const u = s.exists ? s.data() : null; if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Cadastro inativo.'); return u; }
async function cfgAtual(db) { const s = await db.doc('config/portal_ia').get(); return cfgCreditos(s.exists ? s.data() : {}); }

export const creditosPedido = onCall({ region: 'southamerica-east1', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {}, u = await quem(db, uid), cc = await cfgAtual(db);
  const rede = d.tipo === 'rede';
  let conta, municipio_id = u.municipio_id || '', nomeConta = '';
  if (rede) {
    if (u.perfil === 'admin') municipio_id = txt(d.municipio_id, 64) || municipio_id;
    else if (u.perfil !== 'secretaria') throw new HttpsError('permission-denied', 'A recarga da rede é pedida pela Secretaria de Educação.');
    if (!municipio_id) throw new HttpsError('failed-precondition', 'Conta sem município.');
    const m = await db.doc(`municipios/${municipio_id}`).get(); if (!m.exists) throw new HttpsError('not-found', 'Município não encontrado.');
    conta = 'mun_' + municipio_id; nomeConta = (m.data().nome || '') + (m.data().uf ? '/' + m.data().uf : '');
  } else {
    if (!['professor', 'gestor', 'admin'].includes(u.perfil)) throw new HttpsError('permission-denied', 'Créditos avulsos são para professores.');
    conta = 'prof_' + uid; nomeConta = u.nome || u.email || '';
  }
  const lista = rede ? cc.pacotes_rede : cc.pacotes_professor, pac = lista.find(p => p.id === d.pacote_id);
  if (!pac) throw new HttpsError('invalid-argument', 'Escolha um pacote.');
  const pend = await db.collection('recargas_pedidos').where('conta', '==', conta).where('status', '==', 'pendente').limit(5).get();
  if (pend.size >= 3) throw new HttpsError('resource-exhausted', 'Já há 3 pedidos aguardando a NEWPC para esta conta.');
  const ref = await db.collection('recargas_pedidos').add({ tipo: rede ? 'rede' : 'avulso', conta, conta_nome: txt(nomeConta, 120), municipio_id, uid, solicitante: txt(u.nome || '', 80), email: txt(u.email || '', 120),
    pacote_id: pac.id, pacote_nome: pac.nome, creditos: pac.creditos, valor: pac.valor, obs: txt(d.obs, 500), status: 'pendente', em: FieldValue.serverTimestamp() });
  return { ok: true, id: ref.id };
});

/* ---------------------------------------------------------------- administração (só NEWPC) */
export const creditosAdmin = onCall({ region: 'southamerica-east1', secrets: [SMTP_SENHA], maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {}, u = await quem(db, uid);
  if (u.perfil !== 'admin') throw new HttpsError('permission-denied', 'Só a NEWPC administra créditos.');
  const cc = await cfgAtual(db);
  const contaOk = c => /^(mun|prof)_[A-Za-z0-9_-]{1,64}$/.test(String(c || ''));

  if (d.acao === 'recarregar') {
    if (!contaOk(d.conta)) throw new HttpsError('invalid-argument', 'Conta inválida.');
    const creditos = inteiro(d.creditos, 0, 1000000), meses = inteiro(d.meses || cc.validade_meses, 1, 36);
    if (creditos < 1) throw new HttpsError('invalid-argument', 'Informe a quantidade de créditos.');
    const ref = db.doc(`creditos/${d.conta}`), pacId = 'p' + Date.now().toString(36);
    const validade = new Date(); validade.setMonth(validade.getMonth() + meses);
    let pedido = null;
    if (d.pedido_id) { const ps = await db.doc(`recargas_pedidos/${txt(d.pedido_id, 64)}`).get(); if (ps.exists && ps.data().status === 'pendente' && ps.data().conta === d.conta) pedido = ps; }
    const tipo = d.conta.startsWith('mun_') ? 'municipio' : 'professor', refId = d.conta.slice(d.conta.indexOf('_') + 1);
    let nome = '';
    if (tipo === 'municipio') { const m = await db.doc(`municipios/${refId}`).get(); if (!m.exists) throw new HttpsError('not-found', 'Município não encontrado.'); nome = (m.data().nome || '') + (m.data().uf ? '/' + m.data().uf : ''); }
    else { const p = await db.doc(`usuarios/${refId}`).get(); if (!p.exists) throw new HttpsError('not-found', 'Professor não encontrado.'); nome = p.data().nome || p.data().email || ''; }
    await db.runTransaction(async t => {
      const s = await t.get(ref), c = s.exists ? s.data() : {};
      const pac = [...(c.pacotes || []).filter(p => ms(p.validade) > Date.now() - 400 * 864e5), { id: pacId, creditos, restante: creditos, validade: Timestamp.fromDate(validade), origem: pedido ? 'pedido' : 'manual', obs: txt(d.obs, 300), pedido_id: pedido ? pedido.id : '', criado_em: Timestamp.now(), por: uid }];
      t.set(ref, { tipo, ref_id: refId, nome: txt(nome, 120), pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo, alerta20: false, alerta5: false, atualizado_em: FieldValue.serverTimestamp(), ...(s.exists ? {} : { criado_em: FieldValue.serverTimestamp() }) }, { merge: true });
      t.set(ref.collection('movimentos').doc(), { tipo: 'recarga', creditos, validade: Timestamp.fromDate(validade), obs: txt(d.obs, 300), pedido_id: pedido ? pedido.id : '', por: uid, em: FieldValue.serverTimestamp() });
      if (pedido) t.update(pedido.ref, { status: 'aprovado', aprovado_em: FieldValue.serverTimestamp(), aprovado_por: uid, creditos_liberados: creditos });
    });
    // avisa quem pediu
    if (pedido && pedido.data().email) {
      const p = pedido.data();
      await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: p.email, subject: `Créditos do Portal IA liberados: ${creditos.toLocaleString('pt-BR')}`,
        html: moldura('Créditos liberados', `<p>Olá, ${esc(String(p.solicitante || '').split(' ')[0])}.</p><p>Foram liberados <b>${creditos.toLocaleString('pt-BR')} créditos</b> do Portal IA para <b>${esc(p.conta_nome)}</b>, válidos até <b>${validade.toLocaleDateString('pt-BR')}</b>.</p>`, 'https://app.portaldoeducador.com.br/apps/portal-ia/', 'Abrir o Portal IA') }).catch(e => console.warn('creditos: e-mail', e.message));
    }
    return { ok: true };
  }
  if (d.acao === 'teto') {
    if (!contaOk(d.conta) || !d.conta.startsWith('mun_')) throw new HttpsError('invalid-argument', 'Conta inválida.');
    await db.doc(`creditos/${d.conta}`).set({ teto_professor: inteiro(d.teto, 0, 100000), tipo: 'municipio', ref_id: d.conta.slice(4), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  }
  if (d.acao === 'cancelar_pedido') {
    const ref = db.doc(`recargas_pedidos/${txt(d.id, 64)}`), s = await ref.get();
    if (!s.exists || s.data().status !== 'pendente') throw new HttpsError('failed-precondition', 'Pedido não está pendente.');
    await ref.update({ status: 'cancelado', motivo: txt(d.motivo, 300), cancelado_em: FieldValue.serverTimestamp(), cancelado_por: uid });
    return { ok: true };
  }
  if (d.acao === 'retirar_pacote') {
    if (!contaOk(d.conta)) throw new HttpsError('invalid-argument', 'Conta inválida.');
    const ref = db.doc(`creditos/${d.conta}`);
    await db.runTransaction(async t => {
      const s = await t.get(ref); if (!s.exists) throw new HttpsError('not-found', 'Carteira não encontrada.');
      const p = (s.data().pacotes || []).find(x => x.id === d.pacote_id); if (!p) throw new HttpsError('not-found', 'Pacote não encontrado.');
      const pac = s.data().pacotes.filter(x => x.id !== d.pacote_id);
      t.update(ref, { pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo, atualizado_em: FieldValue.serverTimestamp() });
      t.set(ref.collection('movimentos').doc(), { tipo: 'retirada', creditos: -(p.restante || 0), obs: txt(d.motivo, 300), por: uid, em: FieldValue.serverTimestamp() });
    });
    return { ok: true };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

/* ---------------------------------------------------------------- e-mails */
function moldura(titulo, corpo, link, rotulo) {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:600px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">${esc(titulo)}</b><br><span style="color:#8DC63F;font-size:12px">Portal IA · Portal do Educador</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">${corpo}
<p style="margin:16px 0 0"><a href="${link}" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">${esc(rotulo)}</a></p></div></div>`;
}
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const emailPedidoRecarga = onDocumentCreated({ document: 'recargas_pedidos/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] }, async ev => {
  const p = ev.data && ev.data.data(); if (!p) return;
  const tr = transporte(), de = `"Portal do Educador" <${SMTP_USUARIO.value()}>`;
  const rede = p.tipo === 'rede';
  await tr.sendMail({ from: de, to: destinos().join(','), subject: `Pedido de créditos do Portal IA: ${p.conta_nome} · ${p.pacote_nome}`,
    html: moldura('Novo pedido de créditos', `<p><b>${rede ? 'Rede municipal' : 'Professor (avulso)'}:</b> ${esc(p.conta_nome)}<br><b>Pedido por:</b> ${esc(p.solicitante)} (${esc(p.email)})<br>
<b>Pacote:</b> ${esc(p.pacote_nome)} · ${Number(p.creditos).toLocaleString('pt-BR')} créditos · ${brl(p.valor)}</p>${p.obs ? `<p><b>Observação:</b> ${esc(p.obs)}</p>` : ''}
<p>${rede ? 'Próximo passo: proposta e empenho com a Secretaria. Depois do empenho, libere em Créditos de IA.' : 'Próximo passo: enviar ao professor os dados de pagamento (Pix ou boleto). Depois do pagamento, libere em Créditos de IA.'}</p>`, LINK_PAINEL, 'Abrir Créditos de IA') }).catch(e => console.warn('creditos: e-mail NEWPC', e.message));
  if (p.email) await tr.sendMail({ from: de, to: p.email, subject: 'Recebemos seu pedido de créditos do Portal IA',
    html: moldura('Pedido recebido', `<p>Olá, ${esc(String(p.solicitante || '').split(' ')[0])}.</p><p>Recebemos o pedido de <b>${esc(p.pacote_nome)}</b> (${brl(p.valor)}) para <b>${esc(p.conta_nome)}</b>.</p>
<p>${rede ? 'A equipe da NEWPC vai entrar em contato para a proposta e o empenho. Os créditos são liberados assim que o empenho for emitido.' : 'A equipe da NEWPC vai enviar por e-mail os dados para pagamento. Os créditos são liberados assim que o pagamento for confirmado.'}</p>`, 'https://app.portaldoeducador.com.br/apps/portal-ia/', 'Abrir o Portal IA') }).catch(e => console.warn('creditos: e-mail solicitante', e.message));
});

export const emailAlertaCreditos = onDocumentCreated({ document: 'creditos_alertas/{id}', region: REGIAO_FIRESTORE, secrets: [SMTP_SENHA] }, async ev => {
  const a = ev.data && ev.data.data(); if (!a) return;
  const db = getFirestore(), m = a.municipio_id ? await db.doc(`municipios/${a.municipio_id}`).get() : null;
  const nome = m && m.exists ? (m.data().nome || '') + (m.data().uf ? '/' + m.data().uf : '') : a.conta;
  const sec = a.municipio_id ? await db.collection('usuarios').where('municipio_id', '==', a.municipio_id).where('perfil', '==', 'secretaria').limit(20).get() : null;
  const emails = sec ? sec.docs.map(x => x.data()).filter(x => x.status === 'ativo' && x.email).map(x => x.email) : [];
  const corpo = `<p>Os créditos do Portal IA de <b>${esc(nome)}</b> chegaram a <b>${a.nivel}%</b> do total: restam <b>${Number(a.saldo).toLocaleString('pt-BR')}</b> de ${Number(a.total).toLocaleString('pt-BR')} créditos.</p>
<p>Quando o saldo zerar, os professores deixam de gerar materiais pela rede. O sistema é pré-pago: não há cobrança além do que foi contratado.</p>`;
  const tr = transporte(), de = `"Portal do Educador" <${SMTP_USUARIO.value()}>`;
  await tr.sendMail({ from: de, to: destinos().join(','), subject: `Créditos do Portal IA em ${a.nivel}%: ${nome}`, html: moldura('Créditos acabando', corpo, LINK_PAINEL, 'Abrir Créditos de IA') }).catch(e => console.warn('creditos: alerta NEWPC', e.message));
  if (emails.length) await tr.sendMail({ from: de, to: emails.join(','), subject: `Créditos do Portal IA em ${a.nivel}%`, html: moldura('Créditos acabando', corpo + '<p>Para pedir uma recarga, abra o Painel da Rede e toque em Solicitar recarga.</p>', 'https://app.portaldoeducador.com.br/painel/', 'Abrir o Painel da Rede') }).catch(e => console.warn('creditos: alerta Secretaria', e.message));
});

// Pagamentos do professor avulso pelo Asaas (nov/2026).
// Fluxo: o professor escolhe o item (licença mensal ou pacote de créditos) -> a função cria a cobrança no Asaas
// -> o professor paga na página do Asaas (Pix, boleto ou cartão) -> o Asaas avisa o webhook -> a função libera
// sozinha a licença ou os créditos, lança a venda no Financeiro (fin_pagamentos) e a nota a emitir (fin_notas).
// A chave fica no cofre do Google (ASAAS_CHAVE); a chave de teste ($aact_hmlg_) usa o sandbox, a oficial ($aact_prod_) a produção.
// O webhook só aceita chamadas com o token combinado (ASAAS_WEBHOOK_TOKEN), e cada pagamento é liberado uma única vez.
// O CPF vai só para o Asaas (cadastro do cliente); aqui fica apenas o id do cliente e o CPF mascarado.
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { saldoDe, cfgCreditos } from './creditos.js';
import { emailAlerta, SMTP_SENHA } from './dicas.js';

const REGIAO = 'southamerica-east1';
const ASAAS_CHAVE = defineSecret('ASAAS_CHAVE');
const ASAAS_WEBHOOK_TOKEN = defineSecret('ASAAS_WEBHOOK_TOKEN');
const AVISAR = 'alan@newpc.com.br';

// licenças avulsas à venda (valores propostos em nov/2026; ajustar aqui)
export const LICENCAS = {
  'intermediario-mensal': { nome: 'Licença Intermediário · 1 mês', plano: 'intermediario', meses: 1, valor: 59.9 },
  'completo-mensal': { nome: 'Licença Completo · 1 mês', plano: 'completo', meses: 1, valor: 99.9 }
};

const txt = (v, n) => String(v ?? '').trim().slice(0, n);
const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : (Date.parse(v || '') || 0));
const base = chave => /^\$?aact_prod_/.test(chave) ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
export const ambienteDaChave = chave => /^\$?aact_prod_/.test(chave) ? 'producao' : 'teste';

export function cpfValido(v) {
  const c = String(v || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const dv = (s * 10) % 11 % 10; if (dv !== Number(c[n])) return false;
  }
  return true;
}
const mascararCpf = c => { const d = String(c).replace(/\D/g, ''); return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : ''; };

async function asaas(caminho, opc = {}) {
  const chave = ASAAS_CHAVE.value();
  const r = await fetch(base(chave) + caminho, { method: opc.method || 'GET', headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'PortalDoEducador' },
    body: opc.body ? JSON.stringify(opc.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const m = (j.errors && j.errors[0] && j.errors[0].description) || ('HTTP ' + r.status); const e = new Error(m); e.status = r.status; throw e; }
  return j;
}

// item pedido -> { tipo, nome, valor, ... }
function itemDe(produto, cfgRaw) {
  if (LICENCAS[produto]) return { tipo: 'licenca', id: produto, ...LICENCAS[produto] };
  const m = /^credito:(.+)$/.exec(produto || '');
  if (m) {
    const p = (cfgCreditos(cfgRaw).pacotes_professor || []).find(x => x.id === m[1]);
    if (p && p.creditos > 0 && p.valor > 0) return { tipo: 'credito', id: p.id, nome: (p.nome || p.creditos + ' créditos') + ' do Portal IA', creditos: Number(p.creditos), valor: Number(p.valor) };
  }
  return null;
}

/* ------------------------------------------------------------ o professor compra */
export const pagamentos = onCall({ region: REGIAO, secrets: [ASAAS_CHAVE], timeoutSeconds: 60 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const us = await db.doc(`usuarios/${uid}`).get(), u = us.data();
  if (!u || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Sua conta precisa estar ativa.');

  if (d.acao === 'opcoes') {
    const cfg = (await db.doc('config/portal_ia').get()).data() || {};
    const cli = (await db.doc(`fin_clientes/${uid}`).get()).data();
    // enquanto a chave for a de teste (sandbox), só o administrador e os testadores (config/pagamentos.testadores) veem a compra direta
    const pc = (await db.doc('config/pagamentos').get()).data() || {};
    const ativo = ambienteDaChave(ASAAS_CHAVE.value()) === 'producao' ? pc.ligado !== false
      : (u.perfil === 'admin' || (Array.isArray(pc.testadores) && pc.testadores.map(x => String(x).toLowerCase()).includes(String(u.email || '').toLowerCase())));
    // professor tentou comprar créditos e o pagamento online ainda não está liberado: a equipe é avisada (1 vez por dia por pessoa)
    if (d.interesse === 'credito' && !ativo && u.perfil !== 'admin') {
      const dia = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
      const plano = ({ gratuito: 'Plano Gratuito', teste: 'teste grátis', avulsa: 'licença avulsa', cortesia: 'cortesia', institucional: 'rede' })[u.licenca_tipo] || String(u.licenca_tipo || '');
      await db.doc(`alertas_equipe/compra_credito_${uid}_${dia}`).create({ tipo: 'compra_credito', uid, quem: String(u.nome || u.email || 'Professor').slice(0, 60) + (u.cidade ? ' (' + String(u.cidade).slice(0, 30) + ')' : ''),
        situacao: 'quer comprar créditos de IA (' + plano + ')', detalhe: 'E-mail: ' + (u.email || '') + (u.telefone ? ' · Telefone: ' + u.telefone : '') + '. Abriu a compra de créditos no Portal IA, mas o pagamento online ainda não está liberado.',
        em: FieldValue.serverTimestamp() }).catch(() => {});   // já avisado hoje
    }
    const ped = await db.collection('fin_pedidos').where('uid', '==', uid).orderBy('criado_em', 'desc').limit(10).get().catch(() => ({ docs: [] }));
    return {
      ativo, ambiente: ambienteDaChave(ASAAS_CHAVE.value()),
      licencas: u.licenca_tipo === 'institucional' ? [] : Object.entries(LICENCAS).map(([id, l]) => ({ id, nome: l.nome, valor: l.valor, plano: l.plano })),
      creditos: (cfgCreditos(cfg).pacotes_professor || []).map(p => ({ id: 'credito:' + p.id, nome: p.nome, creditos: p.creditos, valor: p.valor })),
      temCpf: !!(cli && cli.asaas_id), cpf: cli ? cli.cpf_mascarado || '' : '',
      pedidos: ped.docs.map(x => { const p = x.data(); return { id: x.id, item: p.item, valor: p.valor, status: p.status, link: p.status === 'aguardando' ? p.link : '', em: ms(p.criado_em) }; })
    };
  }

  if (d.acao === 'criar') {
    const cfg = (await db.doc('config/portal_ia').get()).data() || {}, pc = (await db.doc('config/pagamentos').get()).data() || {};
    if (ambienteDaChave(ASAAS_CHAVE.value()) !== 'producao' && u.perfil !== 'admin' && !(Array.isArray(pc.testadores) && pc.testadores.map(x => String(x).toLowerCase()).includes(String(u.email || '').toLowerCase())))
      throw new HttpsError('failed-precondition', 'O pagamento online ainda está em teste. Fale com a NEWPC pelo WhatsApp.');
    const item = itemDe(txt(d.produto, 60), cfg);
    if (!item) throw new HttpsError('invalid-argument', 'Item não encontrado.');
    if (item.tipo === 'licenca' && u.licenca_tipo === 'institucional') throw new HttpsError('failed-precondition', 'Sua licença vem da sua rede de ensino. Você pode comprar créditos de IA avulsos.');
    const abertos = await db.collection('fin_pedidos').where('uid', '==', uid).where('status', '==', 'aguardando').limit(6).get();
    if (abertos.size >= 5) throw new HttpsError('resource-exhausted', 'Você já tem 5 cobranças aguardando pagamento. Pague ou espere vencerem para gerar outra.');
    // cliente no Asaas (uma vez por professor)
    const cliRef = db.doc(`fin_clientes/${uid}`); let cli = (await cliRef.get()).data();
    if (!cli || !cli.asaas_id) {
      const cpf = String(d.cpf || '').replace(/\D/g, '');
      if (!cpfValido(cpf)) throw new HttpsError('invalid-argument', 'Informe um CPF válido para a cobrança.');
      let c;
      try { c = await asaas('/customers', { method: 'POST', body: { name: txt(u.nome || u.email, 100), cpfCnpj: cpf, email: txt(u.email, 120), externalReference: uid, notificationDisabled: false } }); }
      catch (e) { console.error('asaas cliente', e.message); throw new HttpsError('unavailable', 'Não consegui registrar seus dados no sistema de pagamento: ' + e.message); }
      cli = { asaas_id: c.id, cpf_mascarado: mascararCpf(cpf), nome: txt(u.nome, 100), email: txt(u.email, 120) };
      await cliRef.set({ uid, ...cli, ambiente: ambienteDaChave(ASAAS_CHAVE.value()), criado_em: FieldValue.serverTimestamp() });
    }
    const pedRef = db.collection('fin_pedidos').doc();
    const venc = new Date(Date.now() - 4 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10);
    let pg;
    try {
      pg = await asaas('/payments', { method: 'POST', body: { customer: cli.asaas_id, billingType: 'UNDEFINED', value: item.valor, dueDate: venc,
        description: 'Portal do Educador · ' + item.nome, externalReference: pedRef.id } });
    } catch (e) { console.error('asaas cobrança', e.message); throw new HttpsError('unavailable', 'Não consegui gerar a cobrança agora: ' + e.message); }
    await pedRef.set({ uid, email: txt(u.email, 120), cliente: txt(u.nome || u.email, 120), tipo: item.tipo, produto: item.id, item: item.nome, valor: item.valor,
      plano: item.plano || '', meses: item.meses || 0, creditos: item.creditos || 0, status: 'aguardando', link: pg.invoiceUrl || '', asaas_id: pg.id,
      vencimento: venc, ambiente: ambienteDaChave(ASAAS_CHAVE.value()), criado_em: FieldValue.serverTimestamp() });
    await db.collection('fin_auditoria').add({ acao: 'cobranca_criada', autor: 'sistema', detalhe: `Cobrança gerada: ${item.nome} · R$ ${item.valor.toFixed(2)} · ${txt(u.nome || u.email, 80)}`, em: FieldValue.serverTimestamp() });
    return { id: pedRef.id, link: pg.invoiceUrl };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

/* ------------------------------------------------------------ libera o que foi pago (uma vez só) */
async function liberar(db, pedRef, pag) {
  const r = await db.runTransaction(async t => {
    const s = await t.get(pedRef); if (!s.exists) return { erro: 'pedido não encontrado' };
    const p = s.data(); if (p.status === 'pago') return { repetido: true };
    const uRef = db.doc(`usuarios/${p.uid}`), us = await t.get(uRef), u = us.data() || {};
    const cliD = (await t.get(db.doc(`fin_clientes/${p.uid}`))).data() || {};
    let detalhe = '';
    if (p.tipo === 'licenca') {
      const agora = Date.now(), de = Math.max(agora, ms(u.licenca_tipo === 'avulsa' ? u.licenca_fim : 0));
      const fim = new Date(de); fim.setMonth(fim.getMonth() + (p.meses || 1));
      t.update(uRef, { licenca_tipo: 'avulsa', plano_avulso: p.plano, licenca_plano: 'mensal', licenca_fim: Timestamp.fromDate(fim),
        ...(u.licenca_tipo === 'avulsa' && ms(u.licenca_fim) > agora ? {} : { licenca_inicio: new Date(agora - 4 * 3600e3).toISOString().slice(0, 10) }),
        licenca_valor: p.valor.toFixed(2).replace('.', ','), licenca_ref: 'Asaas ' + (pag.id || ''), licenca_alterada_em: FieldValue.serverTimestamp(), licenca_alterada_por: 'asaas' });
      detalhe = `licença ${p.plano} até ${fim.toLocaleDateString('pt-BR')}`;
    } else {
      const cRef = db.doc(`creditos/prof_${p.uid}`), cs = await t.get(cRef), c = cs.exists ? cs.data() : {};
      const validade = new Date(); validade.setMonth(validade.getMonth() + 12);
      const pac = [...(c.pacotes || []).filter(x => ms(x.validade) > Date.now() - 400 * 864e5),
        { id: 'p' + Date.now().toString(36), creditos: p.creditos, restante: p.creditos, validade: Timestamp.fromDate(validade), origem: 'compra', obs: 'Compra pelo Asaas · ' + (pag.id || ''), pedido_id: pedRef.id, criado_em: Timestamp.now(), por: 'asaas' }];
      t.set(cRef, { tipo: 'professor', ref_id: p.uid, nome: txt(u.nome || u.email, 120), pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo, alerta20: false, alerta5: false,
        atualizado_em: FieldValue.serverTimestamp(), ...(cs.exists ? {} : { criado_em: FieldValue.serverTimestamp() }) }, { merge: true });
      t.set(cRef.collection('movimentos').doc(), { tipo: 'recarga', creditos: p.creditos, validade: Timestamp.fromDate(validade), obs: 'Compra pelo Asaas', pedido_id: pedRef.id, por: 'asaas', em: FieldValue.serverTimestamp() });
      detalhe = `${p.creditos} créditos`;
    }
    const bruto = Number(pag.value || p.valor) || 0, liquido = Number(pag.netValue || bruto) || 0;
    const forma = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito' }[pag.billingType] || pag.billingType || '';
    t.update(pedRef, { status: 'pago', pago_em: FieldValue.serverTimestamp(), forma, liberado: detalhe });
    t.set(db.doc(`fin_pagamentos/${pedRef.id}`), { pedido_id: pedRef.id, asaas_id: pag.id || '', uid: p.uid, cliente: p.cliente, item: p.item, forma, bruto, taxa: Math.max(0, +(bruto - liquido).toFixed(2)), liquido,
      status: 'confirmado', mes: new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7), ambiente: p.ambiente || '', em: FieldValue.serverTimestamp() });
    t.set(db.doc(`fin_notas/${pedRef.id}`), { pedido_id: pedRef.id, cliente: p.cliente, documento_mascarado: cliD.cpf_mascarado || '', email: p.email, valor: bruto, descricao: 'Portal do Educador · ' + p.item, status: 'a_emitir', em: FieldValue.serverTimestamp() });
    t.set(db.collection('fin_auditoria').doc(), { acao: 'pagamento_confirmado', autor: 'asaas', detalhe: `Pago (${forma}): ${p.item} · R$ ${bruto.toFixed(2)} · ${p.cliente} · liberado: ${detalhe}`, em: FieldValue.serverTimestamp() });
    return { ok: true, p, detalhe, bruto, forma };
  });
  return r;
}

/* ------------------------------------------------------------ aviso do Asaas */
export const asaasWebhook = onRequest({ region: REGIAO, secrets: [ASAAS_CHAVE, ASAAS_WEBHOOK_TOKEN, SMTP_SENHA], maxInstances: 5, timeoutSeconds: 60 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send(''); return; }
  if (String(req.get('asaas-access-token') || '') !== ASAAS_WEBHOOK_TOKEN.value()) { res.status(401).send('token'); return; }
  const db = getFirestore(), ev = String((req.body && req.body.event) || ''), pag = (req.body && req.body.payment) || {};
  try {
    const pedId = txt(pag.externalReference, 64);
    if (!pedId) { res.status(200).send('ignorado'); return; }   // cobrança feita fora do Portal
    const pedRef = db.doc(`fin_pedidos/${pedId}`);
    if (ev === 'PAYMENT_CONFIRMED' || ev === 'PAYMENT_RECEIVED') {
      const r = await liberar(db, pedRef, pag);
      if (r && r.ok) {
        await emailAlerta(r.p.email, 'Pagamento confirmado · Portal do Educador', `<p>Olá, ${String(r.p.cliente || '').split(' ')[0]}.</p><p>Recebemos o pagamento de <b>${r.p.item}</b> (R$ ${r.bruto.toFixed(2).replace('.', ',')}). Já está liberado: <b>${r.detalhe}</b>.</p><p><a href="https://www.portaldoeducador.com.br/entrar/">Abrir o Portal do Educador</a></p>`).catch(e => console.warn('asaas e-mail professor', e.message));
        await emailAlerta(AVISAR, `Venda confirmada: ${r.p.item}`, `<p><b>${r.p.cliente}</b> pagou <b>${r.p.item}</b> por ${r.forma}: R$ ${r.bruto.toFixed(2).replace('.', ',')}.</p><p>Liberado: ${r.detalhe}. A nota a emitir está no Financeiro.</p>`).catch(e => console.warn('asaas e-mail venda', e.message));
      }
    } else if (ev === 'PAYMENT_OVERDUE') {
      await pedRef.set({ status: 'vencido', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    } else if (['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'].includes(ev)) {
      const s = await pedRef.get();
      if (s.exists) {
        const pago = s.data().status === 'pago';
        await pedRef.set({ status: ev === 'PAYMENT_DELETED' && !pago ? 'cancelado' : 'estornado', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
        if (pago) {
          await db.doc(`fin_pagamentos/${pedId}`).set({ status: 'estornado' }, { merge: true });
          await db.collection('fin_auditoria').add({ acao: 'estorno', autor: 'asaas', detalhe: `Estorno ou contestação (${ev}): ${s.data().item} · ${s.data().cliente}. Conferir se a licença ou os créditos devem ser retirados.`, em: FieldValue.serverTimestamp() });
          await emailAlerta(AVISAR, 'Atenção: estorno no Portal do Educador', `<p>${ev}: <b>${s.data().item}</b> de <b>${s.data().cliente}</b>. A liberação não foi desfeita sozinha; confira no admin.</p>`).catch(() => {});
        }
      }
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error('asaasWebhook', ev, e.message);
    res.status(500).send('erro');   // o Asaas tenta de novo
  }
});

/* ------------------------------------------------------------ administrador: confere a ligação e cadastra o webhook */
export const asaasAdmin = onCall({ region: REGIAO, secrets: [ASAAS_CHAVE, ASAAS_WEBHOOK_TOKEN], timeoutSeconds: 60 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), eu = (await db.doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!eu || eu.perfil !== 'admin') throw new HttpsError('permission-denied', 'Só o administrador.');
  return situacaoAsaas(req.data && req.data.webhook === true);
});

export async function situacaoAsaas(cadastrarWebhook) {
  const amb = ambienteDaChave(ASAAS_CHAVE.value());
  const conta = await asaas('/myAccount').catch(e => ({ erro: e.message }));
  const url = `https://${REGIAO}-portal-educador-5.cloudfunctions.net/asaasWebhook`;
  let webhook = null;
  if (cadastrarWebhook) {
    const lista = await asaas('/webhooks').catch(() => ({ data: [] }));
    const ja = (lista.data || []).find(w => w.url === url);
    const corpo = { name: 'Portal do Educador', url, email: AVISAR, enabled: true, interrupted: false, apiVersion: 3, authToken: ASAAS_WEBHOOK_TOKEN.value(), sendType: 'SEQUENTIALLY',
      events: ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'] };
    webhook = ja ? await asaas('/webhooks/' + ja.id, { method: 'PUT', body: corpo }).then(() => 'atualizado').catch(e => 'erro: ' + e.message)
      : await asaas('/webhooks', { method: 'POST', body: corpo }).then(() => 'cadastrado').catch(e => 'erro: ' + e.message);
  }
  return { ambiente: amb, conta: conta.erro ? { erro: conta.erro } : { nome: conta.name || conta.companyName || '', pessoa: conta.personType || '' }, url, webhook };
}

// Limpeza do Financeiro de teste (sandbox do Asaas). Sem "-gravar": só conta e lista (sem nomes, e-mails ou CPF).
// Com "-gravar" (consulta-financeiro-teste-gravar): apaga os pedidos, pagamentos, notas e clientes do ambiente de teste,
// os registros de auditoria do Financeiro ligados a eles e os créditos de teste liberados por esses pedidos.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), GRAVAR = process.env.GRAVAR === '1', dt = v => v && v.toDate ? v.toDate().toISOString().slice(0, 16).replace('T', ' ') : '-';
const ped = (await db.collection('fin_pedidos').get()).docs.filter(d => (d.data().ambiente || 'teste') === 'teste');
const ids = new Set(ped.map(d => d.id));
const pag = (await db.collection('fin_pagamentos').get()).docs.filter(d => ids.has(d.id) || d.data().ambiente === 'teste');
const notas = (await db.collection('fin_notas').get()).docs.filter(d => ids.has(d.data().pedido_id || d.id));
const cli = (await db.collection('fin_clientes').get()).docs.filter(d => d.data().ambiente === 'teste' || !d.data().ambiente);
const aud = (await db.collection('fin_auditoria').get()).docs.filter(d => { const x = d.data(); return ['pagamento_confirmado', 'estorno'].includes(x.acao) && [...ids].some(i => String(x.detalhe || '').includes(i)) || (x.acao === 'pagamento_confirmado' && ped.length && String(x.detalhe || '').includes('100 créditos do Portal IA')); });
let todos = (await db.collection('fin_pedidos').get()).size;
console.log(`::notice::fin_pedidos: ${ped.length} de teste (de ${todos} no total)`);
ped.forEach(d => { const x = d.data(); console.log(`::notice::  pedido ${dt(x.criado_em)} · ${x.item} · R$ ${x.valor} · ${x.status} · ambiente ${x.ambiente || '?'}`); });
console.log(`::notice::fin_pagamentos: ${pag.length} · fin_notas: ${notas.length} · fin_clientes de teste: ${cli.length} · fin_auditoria ligados: ${aud.length}`);
// créditos liberados pelos pedidos de teste (pacotes com pedido_id dos pedidos de teste)
const credMov = [];
for (const d of ped) { const x = d.data(); if (x.status !== 'pago' || x.tipo !== 'credito') continue;
  const ref = db.doc('creditos/prof_' + x.uid), c = (await ref.get()).data() || {};
  const p = (c.pacotes || []).filter(k => k.pedido_id === d.id); if (p.length) credMov.push({ ref, ids: p.map(k => k.id), restante: p.reduce((a, k) => a + (k.restante || 0), 0) }); }
console.log(`::notice::créditos de teste ainda na carteira: ${credMov.reduce((a, c) => a + c.restante, 0)} (em ${credMov.length} pacote(s))`);
if (!GRAVAR) { console.log('::notice::Só leitura. Nada foi apagado.'); process.exit(0); }
const ms = v => v && v.toMillis ? v.toMillis() : 0, saldoDe = c => ({ saldo: (c.pacotes || []).filter(k => ms(k.validade) > Date.now()).reduce((a, k) => a + (Number(k.restante) || 0), 0) });
for (const c of credMov) await db.runTransaction(async t => { const s = await t.get(c.ref), x = s.data() || {}; const pac = (x.pacotes || []).filter(k => !c.ids.includes(k.id));
  t.update(c.ref, { pacotes: pac, saldo: saldoDe({ pacotes: pac }).saldo, atualizado_em: FieldValue.serverTimestamp() }); });
const lote = [...ped, ...pag, ...notas, ...cli, ...aud].map(d => d.ref);
for (let i = 0; i < lote.length; i += 400) { const b = db.batch(); lote.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); }
await db.collection('fin_auditoria').add({ acao: 'limpeza_teste', autor: 'admin (pedido do Alan)', detalhe: `Removidos os registros do ambiente de teste do Asaas: ${ped.length} pedidos, ${pag.length} pagamentos, ${notas.length} notas, ${cli.length} clientes e os créditos de teste`, em: FieldValue.serverTimestamp() });
console.log(`::notice::Apagados ${lote.length} registros de teste e ${credMov.length} pacote(s) de crédito de teste.`);

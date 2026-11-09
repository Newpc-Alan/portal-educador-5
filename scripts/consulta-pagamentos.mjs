// Só leitura: últimos pedidos de pagamento (fin_pedidos) e lançamentos do Financeiro, sem e-mail nem CPF.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), dt = v => v && v.toDate ? v.toDate().toISOString().slice(0, 16).replace('T', ' ') : '-';
const p = await db.collection('fin_pedidos').orderBy('criado_em', 'desc').limit(10).get();
p.forEach(d => { const x = d.data(); console.log(`::notice::PEDIDO ${dt(x.criado_em)} · ${x.item} · R$ ${x.valor} · ${x.status}${x.forma ? ' · ' + x.forma : ''}${x.liberado ? ' · liberado: ' + x.liberado : ''} · ${x.ambiente}`); });
const f = await db.collection('fin_pagamentos').orderBy('em', 'desc').limit(5).get();
f.forEach(d => { const x = d.data(); console.log(`::notice::FINANCEIRO ${dt(x.em)} · ${x.item} · bruto ${x.bruto} · taxa ${x.taxa} · líquido ${x.liquido} · ${x.status}`); });
const a = await db.collection('fin_auditoria').orderBy('em', 'desc').limit(5).get();
a.forEach(d => { const x = d.data(); console.log(`::notice::AUDITORIA ${dt(x.em)} · ${x.acao}`); });
if (p.empty) console.log('::notice::Nenhum pedido ainda.');

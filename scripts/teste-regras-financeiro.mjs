// Financeiro (nov/2026): só o dono (alan@newpc.com.br) e os e-mails da lista fin_acesso/lista entram; só o dono mexe na lista;
// o financeiro marca nota emitida e repasse conciliado (só esses campos); a auditoria só recebe registros novos.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-financeiro.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'fin_acesso/lista'), { emails: ['fin@newpc.com.br'] });
  await setDoc(doc(db, 'fin_pagamentos/p1'), { cliente: 'Teste', bruto: 59.9, status: 'confirmado' });
  await setDoc(doc(db, 'fin_repasses/r1'), { liquido: 100, status: 'a conferir' });
  await setDoc(doc(db, 'fin_notas/n1'), { cliente: 'Teste', valor: 59.9, status: 'pendente' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const como = (uid, email, verificado = true) => env.authenticatedContext(uid, { email, email_verified: verificado }).firestore();
const dono = como('alan', 'alan@newpc.com.br'), fin = como('fin', 'fin@newpc.com.br'), outro = como('x', 'outro@newpc.com.br');
const adm = como('adm', 'adm@x.com'), naoVerif = como('nv', 'fin@newpc.com.br', false);

await t('dono lê pagamentos', assertSucceeds(getDoc(doc(dono, 'fin_pagamentos/p1'))));
await t('financeiro da lista lê pagamentos', assertSucceeds(getDoc(doc(fin, 'fin_pagamentos/p1'))));
await t('e-mail fora da lista não lê', assertFails(getDoc(doc(outro, 'fin_pagamentos/p1'))));
await t('admin do Portal fora da lista não lê', assertFails(getDoc(doc(adm, 'fin_pagamentos/p1'))));
await t('e-mail não verificado não lê', assertFails(getDoc(doc(naoVerif, 'fin_pagamentos/p1'))));
await t('sem login não lê', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'fin_pagamentos/p1'))));
await t('ninguém grava pagamento pelo navegador', assertFails(setDoc(doc(dono, 'fin_pagamentos/p2'), { bruto: 1 })));

await t('dono altera a lista', assertSucceeds(setDoc(doc(dono, 'fin_acesso/lista'), { emails: ['fin@newpc.com.br', 'b@newpc.com.br'], atualizado_por: 'alan@newpc.com.br', atualizado_em: serverTimestamp() })));
await t('financeiro não altera a lista', assertFails(setDoc(doc(fin, 'fin_acesso/lista'), { emails: ['fin@newpc.com.br', 'eu2@x.com'], atualizado_por: 'fin@newpc.com.br', atualizado_em: serverTimestamp() })));
await t('lista com campo estranho recusada', assertFails(setDoc(doc(dono, 'fin_acesso/lista'), { emails: [], atualizado_por: 'alan@newpc.com.br', atualizado_em: serverTimestamp(), admin: true })));
await t('financeiro lê a lista', assertSucceeds(getDoc(doc(fin, 'fin_acesso/lista'))));
await t('fora da lista não lê a lista', assertFails(getDoc(doc(outro, 'fin_acesso/lista'))));

await t('financeiro marca nota emitida', assertSucceeds(updateDoc(doc(fin, 'fin_notas/n1'), { status: 'emitida', numero: '1204', emitida_por: 'fin@newpc.com.br', emitida_em: serverTimestamp() })));
await t('não muda o valor da nota', assertFails(updateDoc(doc(fin, 'fin_notas/n1'), { valor: 1 })));
await t('não marca nota em nome de outro', assertFails(updateDoc(doc(dono, 'fin_notas/n1'), { status: 'emitida', numero: '1', emitida_por: 'fin@newpc.com.br', emitida_em: serverTimestamp() })));
await t('não apaga nota', assertFails(deleteDoc(doc(dono, 'fin_notas/n1'))));
await t('financeiro concilia repasse', assertSucceeds(updateDoc(doc(fin, 'fin_repasses/r1'), { status: 'conciliado', conciliado_por: 'fin@newpc.com.br', conciliado_em: serverTimestamp() })));
await t('não muda o líquido do repasse', assertFails(updateDoc(doc(fin, 'fin_repasses/r1'), { liquido: 1 })));
await t('fora da lista não concilia', assertFails(updateDoc(doc(outro, 'fin_repasses/r1'), { status: 'conciliado', conciliado_por: 'outro@newpc.com.br', conciliado_em: serverTimestamp() })));

const com = { imposto_pct: 11, descontar_taxas: true, outros_custos: 500, equipe: [{ nome: 'Fulano', funcao: 'Comercial', pct: 5 }] };
await t('dono salva comissões', assertSucceeds(setDoc(doc(dono, 'fin_config/comissoes'), { ...com, atualizado_por: 'alan@newpc.com.br', atualizado_em: serverTimestamp() })));
await t('financeiro lê comissões', assertSucceeds(getDoc(doc(fin, 'fin_config/comissoes'))));
await t('financeiro não altera comissões', assertFails(setDoc(doc(fin, 'fin_config/comissoes'), { ...com, atualizado_por: 'fin@newpc.com.br', atualizado_em: serverTimestamp() })));
await t('fora da lista não vê comissões', assertFails(getDoc(doc(outro, 'fin_config/comissoes'))));
await t('dono salva comissão por projeto', assertSucceeds(setDoc(doc(dono, 'fin_config/comissoes'), { ...com, equipe: [{ nome: 'Vendedor', funcao: 'Comercial', pct: 10, base: 'pj1' }], projetos: [{ id: 'pj1', nome: 'Rede X', cliente: 'Contrato 1', recebido: 10000, custos: 1000 }], atualizado_por: 'alan@newpc.com.br', atualizado_em: serverTimestamp() })));
await t('imposto acima de 50% recusado', assertFails(setDoc(doc(dono, 'fin_config/comissoes'), { ...com, imposto_pct: 80, atualizado_por: 'alan@newpc.com.br', atualizado_em: serverTimestamp() })));

let reg;
await t('financeiro registra na auditoria', (async () => { reg = await assertSucceeds(addDoc(collection(fin, 'fin_auditoria'), { acao: 'entrada', detalhe: 'Entrou', autor: 'fin@newpc.com.br', em: serverTimestamp() })); })());
await t('não registra em nome de outro', assertFails(addDoc(collection(fin, 'fin_auditoria'), { acao: 'entrada', detalhe: 'x', autor: 'alan@newpc.com.br', em: serverTimestamp() })));
await t('auditoria não se altera', assertFails(updateDoc(doc(dono, 'fin_auditoria/' + (reg ? reg.id : 'x')), { detalhe: 'apagado' })));
await t('auditoria não se apaga', assertFails(deleteDoc(doc(dono, 'fin_auditoria/' + (reg ? reg.id : 'x')))));
await t('fora da lista não registra', assertFails(addDoc(collection(outro, 'fin_auditoria'), { acao: 'x', detalhe: 'x', autor: 'outro@newpc.com.br', em: serverTimestamp() })));

console.log((falha ? '::error::' : '::notice::') + 'FINANCEIRO: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

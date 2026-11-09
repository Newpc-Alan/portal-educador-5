// Só leitura: ranking dos recursos de IA pelo custo real (Google Gemini), somando todos os meses de stats/ia_uso,
// mais os créditos cobrados por ação (movimentos de consumo das carteiras). Só números agregados, sem nomes.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 1800));
const cfg = (await db.doc('config/portal_ia').get()).data() || {};
const dol = Number((cfg.creditos || {}).dolar) || 5.6;
const st = (await db.doc('stats/ia_uso').get()).data() || {};
const R = {}, meses = Object.keys(st).sort();
for (const m of meses) for (const [acao, v] of Object.entries(st[m] || {})) {
  const r = R[acao] = R[acao] || { acao, usos: 0, usd: 0, cred: 0, mesUsd: {} };
  r.usos += v.usos || 0; r.usd += v.custo_usd || 0; r.mesUsd[m] = (r.mesUsd[m] || 0) + (v.custo_usd || 0);
}
const carteiras = await db.collection('creditos').get();
for (const c of carteiras.docs) { const mv = await c.ref.collection('movimentos').where('tipo', '==', 'consumo').get();
mv.forEach(d => { const x = d.data(); if (!x.acao) return; const r = R[x.acao] = R[x.acao] || { acao: x.acao, usos: 0, usd: 0, cred: 0, mesUsd: {} }; r.cred += -(x.creditos || 0); }); }
const L = Object.values(R).sort((a, b) => b.usd - a.usd), tot = L.reduce((a, r) => a + r.usd, 0);
const brl = v => 'R$ ' + (v * dol).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
aviso(`RANKING IA (meses ${meses[0] || '-'} a ${meses.at(-1) || '-'}, dólar ${dol}): ${L.length} recursos, custo total ${brl(tot)}, ${L.reduce((a, r) => a + r.usos, 0)} usos`);
L.forEach((r, i) => aviso(`#${i + 1} ${r.acao}: custo ${brl(r.usd)} (${tot ? Math.round(r.usd / tot * 100) : 0}%) · ${r.usos} usos · ${r.usos ? brl(r.usd / r.usos) : '-'} por uso · ${r.cred} créditos cobrados · ${r.cred ? brl(r.usd / r.cred) : '-'} por crédito · mês a mês ${Object.entries(r.mesUsd).map(([m, u]) => m + '=' + brl(u)).join(' ')}`));

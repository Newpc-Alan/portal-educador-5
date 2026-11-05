// Só leitura: inventário do Recursos da Escola por rede (quantos equipamentos, na escola ou no estoque, por tipo) e contratos. Nenhum dado de pessoa.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const [ms, its, cts] = await Promise.all([db.collection('municipios').select('nome').get(), db.collection('rec_itens').select('municipio_id', 'escola_id', 'tipo', 'situacao').get(), db.collection('rec_contratos').select('municipio_id', 'numero').get()]);
const nm = {}; ms.forEach(d => nm[d.id] = d.data().nome); const R = {};
its.forEach(d => { const i = d.data(), r = R[i.municipio_id] = R[i.municipio_id] || { n: 0, esc: 0, est: 0, man: 0, tipos: {}, escolas: new Set() }; r.n++; i.escola_id ? (r.esc++, r.escolas.add(i.escola_id)) : r.est++; if (i.situacao === 'manutencao') r.man++; r.tipos[i.tipo] = (r.tipos[i.tipo] || 0) + 1; });
const C = {}; cts.forEach(d => { const c = d.data(); (C[c.municipio_id] = C[c.municipio_id] || []).push(c.numero); });
for (const [m, r] of Object.entries(R).sort((a, b) => b[1].n - a[1].n)) console.log('::notice::' + (nm[m] || m) + ' · ' + r.n + ' equipamentos · ' + r.esc + ' em ' + r.escolas.size + ' escola(s) · ' + r.est + ' no estoque · ' + r.man + ' em manutenção · contratos ' + (C[m] || []).join(', ') + ' · ' + Object.entries(r.tipos).map(([t, n]) => t + ' ' + n).join(', '));
console.log('::notice::TOTAL ' + its.size + ' equipamentos');
process.exit(0);

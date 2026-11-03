// Só leitura: municípios e escolas cadastradas (nome, INEP) e quantos professores e pré-cadastros cada rede já tem.
// Não imprime e-mail nem nome de pessoa (o log do GitHub não é lugar de dado pessoal).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: process.env.PROJETO || 'portal-educador-5' });
const db = getFirestore();
const [mu, es, us, pre] = await Promise.all([db.collection('municipios').get(), db.collection('escolas').get(), db.collection('usuarios').select('perfil', 'municipio_id', 'status').get(), db.collection('pre_cadastros').select('perfil', 'municipio_id').get()]);
const prof = {}, preC = {};
us.forEach(d => { const u = d.data(); if (u.perfil === 'professor') prof[u.municipio_id || '-'] = (prof[u.municipio_id || '-'] || 0) + 1; });
pre.forEach(d => { const u = d.data(); if ((u.perfil || 'professor') === 'professor') preC[u.municipio_id || '-'] = (preC[u.municipio_id || '-'] || 0) + 1; });
const porMuni = {}; es.forEach(d => { const e = d.data(); (porMuni[e.municipio_id] = porMuni[e.municipio_id] || []).push({ id: d.id, nome: e.nome || '', inep: e.inep || '', status: e.status || '' }); });
const out = [];
mu.forEach(d => { const m = d.data(); out.push({ id: d.id, nome: m.nome, uf: m.uf, status: m.status || '', plano: m.plano_nome || '', professores: prof[d.id] || 0, pre_cadastros: preC[d.id] || 0, escolas: (porMuni[d.id] || []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }); });
out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
for (const m of out) console.log('::notice::' + [m.nome + '/' + m.uf, m.id, m.status, 'plano ' + (m.plano || '-'), m.escolas.length + ' escolas', m.professores + ' professores', m.pre_cadastros + ' pré-cadastros'].join(' · '));
console.log('JSON_ESCOLAS ' + JSON.stringify(out));

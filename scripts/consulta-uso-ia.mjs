// Só leitura: quantos professores abriram cada aplicação do IA Studio (acessos_dia.ia) nos últimos 90 dias.
// Resultado em avisos (::notice::) do GitHub Actions. Não grava nada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 1800));
const desde = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const apps = {}; (await db.collection('ia_apps').get()).forEach(d => { apps[d.id] = d.data().titulo || d.id; });
const ab = {}, us = {}, dias = new Set(), usuarios = new Set();
const s = await db.collection('acessos_dia').where('dia', '>=', desde).get();
let comIa = 0;
s.forEach(d => { const x = d.data(); if (x.demo) return; dias.add(x.dia); if (Array.isArray(x.ia) && x.ia.length) { comIa++; usuarios.add(x.uid);
  x.ia.forEach(id => { ab[id] = (ab[id] || 0) + 1; (us[id] = us[id] || new Set()).add(x.uid); }); } });
const lista = Object.keys(apps).map(id => ({ t: apps[id], dias: ab[id] || 0, prof: us[id] ? us[id].size : 0 })).sort((a, b) => b.dias - a.dias);
aviso(`USO IA STUDIO desde ${desde}: ${s.size} registros de acesso, ${comIa} dias-professor com IA Studio, ${usuarios.size} professores distintos, ${Object.keys(apps).length} aplicações no catálogo`);
for (let i = 0; i < lista.length; i += 16) aviso('USO ' + (i / 16 + 1) + ': ' + lista.slice(i, i + 16).map(x => `${x.t}=${x.dias}d/${x.prof}p`).join(' || '));

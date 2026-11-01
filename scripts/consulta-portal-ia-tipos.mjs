// Quantos materiais de cada tipo os professores geraram no Portal IA (sem administrador e sem conta de teste). Só leitura.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const us = await db.collection('usuarios').select('perfil', 'email').get(), fora = new Set();
us.forEach(d => { const u = d.data(); if (u.perfil === 'admin' || /teste|lab|prof\.ciencias|demo/i.test(u.email || '')) fora.add(d.id); });
const s = await db.collection('portal_ia_docs').select('uid', 'tipo', 'criado_em').get();
const tot = {}, prof = {}, rec = {}; const lim = Date.now() - 60 * 864e5;
s.forEach(d => { const x = d.data(); if (fora.has(x.uid) || !x.tipo) return; tot[x.tipo] = (tot[x.tipo] || 0) + 1; (prof[x.tipo] = prof[x.tipo] || new Set()).add(x.uid);
  if (x.criado_em && x.criado_em.toMillis() > lim) rec[x.tipo] = (rec[x.tipo] || 0) + 1; });
const l = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
console.log('::notice::total ' + Object.values(tot).reduce((a, b) => a + b, 0) + ' materiais de ' + new Set(s.docs.map(d => d.data().uid).filter(u => !fora.has(u))).size + ' professores · ' + l.map(t => t + ' ' + tot[t] + ' (' + prof[t].size + ' prof, ' + (rec[t] || 0) + ' em 60 dias)').join(' · '));

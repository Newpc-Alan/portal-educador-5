// GRAVA: corrige de uma vez os cadastros que não são de professor mas ainda carregam licença de teste, avulsa ou cortesia
// (o gatilho coerenciaLicenca cuida dos próximos). Mostra só contagens por perfil, nunca nome ou e-mail (o log é público).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { licencaIncoerente, correcaoLicenca } = await import(pathToFileURL(process.cwd() + '/licencas.js').href);
const db = getFirestore();
const s = await db.collection('usuarios').where('licenca_tipo', 'in', ['teste', 'avulsa', 'cortesia']).get();
const porPerfil = {}; let n = 0;
for (const d of s.docs) { const u = d.data(); if (!licencaIncoerente(u)) continue; porPerfil[u.perfil] = (porPerfil[u.perfil] || 0) + 1; await d.ref.update(correcaoLicenca()); n++; }
console.log('::notice::licenças de professor lidas: ' + s.size + ' · corrigidas: ' + n + ' · por perfil: ' + (Object.entries(porPerfil).map(([k, v]) => k + ' ' + v).join(', ') || 'nenhuma'));
process.exit(0);

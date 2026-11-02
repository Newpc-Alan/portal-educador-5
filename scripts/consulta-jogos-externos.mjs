// Só leitura: jogos com link de fora (catálogo atual + histórico da auditoria: excluídos ou trocados)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const DO_PORTAL = /^https:\/\/(app\.portaldoeducador\.com\.br\/jogos\/|jogos\.portaldoeducador\.com\.br\/)/;
const atuais = new Set();
(await db.collection('jogos').get()).forEach(d => atuais.add(d.id));
const a = await db.collection('auditoria').where('colecao', '==', 'jogos').get();
console.log('::notice::registros de jogos na auditoria: ' + a.size);
const vistos = {};
a.forEach(d => { const x = d.data(); const txt = JSON.stringify(x.valores || {}) + ' ' + (x.detalhe || '');
  (txt.match(/https?:\/\/[^\s"'\\]+/g) || []).forEach(u => { if (DO_PORTAL.test(u) || /firebasestorage|ytimg|youtube/.test(u)) return;
    const k = u; if (!vistos[k]) vistos[k] = { doc: x.doc, acao: x.acao, existe: atuais.has(x.doc), quando: x.em && x.em.toDate ? x.em.toDate().toISOString().slice(0, 10) : '', tit: String((x.valores || {}).titulo || '').slice(0, 60) }; }); });
for (const [u, v] of Object.entries(vistos)) console.log('::notice::' + u.slice(0, 90) + ' · ' + v.acao + ' em ' + v.quando + ' · ' + (v.existe ? 'ainda no catálogo' : 'NÃO está mais no catálogo') + ' · ' + v.tit);

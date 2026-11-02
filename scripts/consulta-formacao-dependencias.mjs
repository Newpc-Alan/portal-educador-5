// Só leitura: a Formação depende de algo fora do Portal 5.0? (link do botão, endereços usados nos cursos, certificados antigos)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const mod = ((await db.doc('config/modulos').get()).data() || {}).itens || {};
console.log('::notice::botão Formação no Início: ' + JSON.stringify(mod.formacao || {}).replace(/[{}"]/g, ' '));
const hosts = {}, ex = {}, conta = u => { const m = String(u || '').match(/^https?:\/\/([^/?#]+)/i); if (!m) return; let h = m[1].toLowerCase(); if (h === 'firebasestorage.googleapis.com') { const b = String(u).match(/\/b\/([^/]+)\//); h += ' [' + (b ? b[1] : '?') + ']'; } hosts[h] = (hosts[h] || 0) + 1; if (!/firebasestorage|gov\.br|unesco|ibm|instagram/.test(h)) (ex[h] = ex[h] || new Set()).add(String(u).slice(0, 90)); };
const varre = v => { if (typeof v === 'string') { (v.match(/https?:\/\/[^\s"'<>)]+/g) || []).forEach(conta); } else if (v && typeof v === 'object') Object.values(v).forEach(varre); };
const cs = await db.collection('cursos').get(); let aulas = 0;
for (const c of cs.docs) { varre(c.data()); for (const sub of ['aulas', 'modulos', 'materiais']) { const s = await c.ref.collection(sub).get(); s.forEach(d => { varre(d.data()); if (sub === 'aulas') aulas++; }); } }
console.log('::notice::cursos: ' + cs.size + ' · aulas: ' + aulas + ' · endereços usados: ' + Object.entries(hosts).sort((a, b) => b[1] - a[1]).map(([h, n]) => h + ' (' + n + ')').join(', '));
const cert = await db.collection('certificados').get(); let antigos = 0, semUid = 0; cert.forEach(d => { const x = d.data(); if (x.uidAnterior) antigos++; if (!x.uid) semUid++; });
for (const [h, l] of Object.entries(ex)) console.log('::notice::exemplos ' + h + ': ' + [...l].slice(0, 4).join(' | '));
const pub = cs.docs.filter(c => c.data().status === 'publicado').length; console.log('::notice::cursos publicados: ' + pub + ' de ' + cs.size);
console.log('::notice::certificados: ' + cert.size + ' · trazidos da Academia antiga: ' + antigos + ' · sem dono ainda (esperando o professor entrar): ' + semUid);
const tr = await db.collection('trilhas').get(); tr.forEach(d => varre(d.data()));
const us = await db.collection('users').get(); let sem = 0; us.forEach(d => { if (!d.data().municipio_id) sem++; });
console.log('::notice::perfis da Formação: ' + us.size + ' · sem ligação com o cadastro do Portal: ' + sem);

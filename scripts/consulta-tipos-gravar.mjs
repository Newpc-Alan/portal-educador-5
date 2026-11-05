// GRAVA: reclassifica equipamentos importados como "outro"/"tv"/"lousa" que na verdade são suporte de tela ou nobreak
// (tipos novos do Recursos da Escola). Atualiza rec_itens.tipo, rec_qr.tipo e o tipo no cartaz público (rec_pub). Nenhum dado de pessoa.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const novoTipo = i => { const t = (String(i.nome || '') + ' ' + String(i.modelo || '')).toUpperCase();
  if (/SUPORTE|PEDESTAL/.test(t)) return 'suporte'; if (/NOBREAK|\bUPS\b/.test(t)) return 'nobreak'; return null; };
const its = await db.collection('rec_itens').where('tipo', 'in', ['outro', 'tv', 'lousa']).get();
const mud = []; its.forEach(d => { const i = d.data(), t = novoTipo(i); if (t && t !== i.tipo) mud.push({ id: d.id, qr: i.qr, de: i.tipo, para: t, escola: i.escola_id || '' }); });
const cont = {}; mud.forEach(m => { const k = m.de + '→' + m.para; cont[k] = (cont[k] || 0) + 1; });
console.log('::notice::Reclassificar ' + mud.length + ' de ' + its.size + ' · ' + Object.entries(cont).map(([k, n]) => k + ' ' + n).join(', '));
for (let k = 0; k < mud.length; k += 200) {
  const b = db.batch();
  for (const m of mud.slice(k, k + 200)) {
    b.update(db.doc('rec_itens/' + m.id), { tipo: m.para, atualizado_em: FieldValue.serverTimestamp() });
    if (m.qr) b.set(db.doc('rec_qr/' + m.qr), { tipo: m.para }, { merge: true });
  }
  await b.commit();
}
const qrT = new Map(mud.map(m => [m.qr, m.para])), escolas = [...new Set(mud.map(m => m.escola).filter(Boolean))];
let pubs = 0;
for (let k = 0; k < escolas.length; k += 10) {
  const s = await db.collection('rec_pub').where('escola_id', 'in', escolas.slice(k, k + 10)).get();
  for (const d of s.docs) { const l = d.data().itens || []; let n = 0; const nl = l.map(x => qrT.has(x.q) ? (n++, { ...x, t: qrT.get(x.q) }) : x); if (n) { await d.ref.update({ itens: nl }); pubs++; } }
}
console.log('::notice::Pronto · ' + mud.length + ' equipamentos · ' + pubs + ' cartaz(es) público(s) atualizados');
process.exit(0);

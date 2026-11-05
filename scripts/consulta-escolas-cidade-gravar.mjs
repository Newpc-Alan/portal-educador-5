// GRAVA: preenche a cidade das escolas que ainda não têm (campo novo do cadastro da escola). Rede municipal: o próprio
// município; rede particular ou instituição: a cidade cadastrada na rede. Rede estadual fica para o CEP de cada escola.
// Dados públicos (nome de cidade). Não mexe em escola que já tem cidade.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const ms = await db.collection('municipios').get(), M = {}; ms.forEach(d => M[d.id] = d.data());
const es = await db.collection('escolas').get();
let feitas = 0, sem = 0; const porTipo = {}; let b = db.batch(), n = 0;
for (const d of es.docs) {
  const e = d.data(); if (e.cidade) continue;
  const m = M[e.municipio_id] || {}, t = m.tipo_rede || 'municipal';
  const cidade = t === 'municipal' ? (m.nome || e.municipio_nome || '') : (m.cidade || '');
  if (!cidade) { sem++; continue; }
  b.update(d.ref, { cidade, cidade_uf: m.uf || e.municipio_uf || '' }); feitas++; porTipo[t] = (porTipo[t] || 0) + 1;
  if (++n === 400) { await b.commit(); b = db.batch(); n = 0; }
}
if (n) await b.commit();
console.log('::notice::Escolas com cidade preenchida agora: ' + feitas + ' (' + Object.entries(porTipo).map(([k, v]) => k + ' ' + v).join(', ') + ') · sem cidade possível: ' + sem + ' · total de escolas: ' + es.size);
process.exit(0);

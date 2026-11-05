// GRAVA: nº do contrato das redes que ainda estão "sem nº", a partir dos contratos de locação já importados da planilha de
// equipamentos (rec_contratos). Só preenche contrato_numero vazio; não mexe em vigência nem em quem já tem número.
// Número de contrato público é dado público.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const [ms, cts] = await Promise.all([db.collection('municipios').get(), db.collection('rec_contratos').get()]);
const C = {}; cts.forEach(d => { const c = d.data(); if (c.numero) (C[c.municipio_id] = C[c.municipio_id] || new Set()).add(String(c.numero)); });
const feitas = [];
for (const d of ms.docs) {
  const m = d.data(); if (m.contrato_numero || !C[d.id]) continue;
  const num = [...C[d.id]].sort().join(', ').slice(0, 40);
  await d.ref.update({ contrato_numero: num, atualizado_em: FieldValue.serverTimestamp() });
  feitas.push((m.nome || d.id) + ' ' + num);
}
console.log('::notice::Nº de contrato preenchido em ' + feitas.length + ' rede(s): ' + feitas.join(' · '));
process.exit(0);

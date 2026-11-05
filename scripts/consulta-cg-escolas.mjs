// Só leitura: a rede "Campo Grande/MS" (escolas e tipo), para separar escolas particulares em redes próprias. Nomes de escola são públicos; nenhum dado de pessoa.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), M = 'SjTBI1ztvWAsbrOQAhX9';
const m = (await db.doc('municipios/' + M).get()).data() || {};
console.log('::notice::rede ' + m.nome + '/' + m.uf + ' · tipo ' + (m.tipo_rede || 'municipal') + ' · status ' + m.status + ' · contrato ' + (m.contrato_numero || '-') + ' · plano ' + (m.plano_nome || '-'));
const es = await db.collection('escolas').where('municipio_id', '==', M).get();
for (const d of es.docs) { const e = d.data(); const t = await db.collection('turmas').where('escola_id', '==', d.id).count().get(); const a = await db.collection('alunos').where('escola_id', '==', d.id).count().get();
  console.log('::notice::escola ' + d.id + ' · ' + (e.nome || '?') + ' · INEP ' + (e.inep || '-') + ' · dependência ' + (e.dependencia || e.rede || '-') + ' · turmas ' + t.data().count + ' · alunos ' + a.data().count); }
process.exit(0);

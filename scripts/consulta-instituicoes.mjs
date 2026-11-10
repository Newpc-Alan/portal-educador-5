// Instituições ativas (municípios, estados, particulares): tipo, se tem dado oficial (Censo/IDEB) e contagem de escolas e alunos cadastrados.
// Só leitura. Usada para decidir o que o Painel da TV conta como "instituições atendidas".
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const sn = await db.collection('municipios').where('status', '==', 'ativo').get();
for (const d of sn.docs) {
  const m = d.data(), r = m.rede || {}, i = m.ideb || {};
  const esc = (await db.collection('escolas').where('municipio_id', '==', d.id).count().get()).data().count;
  const alu = (await db.collection('alunos').where('municipio_id', '==', d.id).count().get()).data().count;
  console.log(`::notice::${d.id} | ${m.nome} | ${m.uf || ''} | tipo=${m.tipo_rede || '-'} | censo esc=${r.escolas ?? '-'} alu=${r.alunos ?? '-'} | ideb=${i.ai ?? '-'}/${i.af ?? '-'} | portal esc=${esc} alu=${alu} | demo=${!!m.demo}`);
}

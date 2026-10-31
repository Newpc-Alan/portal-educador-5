// Diagnóstico (só leitura): últimos itens de Materiais da turma do laboratório e a configuração de CORS do bucket.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
const [meta] = await getStorage().bucket().getMetadata(); aviso('CORS do bucket: ' + JSON.stringify(meta.cors || 'nenhum'));
const ts = await db.collection('turmas').where('escola_id', '!=', '').limit(1).get();
for (const t of (await db.collection('turma_materiais').listDocuments())) {
  const it = await t.collection('itens').orderBy('criado_em', 'desc').limit(4).get();
  it.forEach(d => { const x = d.data(); aviso(t.id + ' · ' + x.titulo + ' · ' + x.tipo_item + ' · ' + x.arquivo_tipo + ' · ' + x.arquivo_ct + ' · ' + (x.arquivo_url || '').slice(0, 120)); });
}

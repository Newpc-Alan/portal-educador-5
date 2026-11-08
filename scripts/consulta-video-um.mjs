// Só leitura: situação de um vídeo do catálogo pelo começo do título (variável TITULO; padrão: "O mosquito").
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), alvo = (process.env.TITULO || 'O mosquito').toLowerCase();
const vs = (await db.collection('videos').get()).docs.filter(d => String(d.data().titulo || '').toLowerCase().startsWith(alvo));
for (const d of vs) {
  const v = d.data(), i = (await db.doc('videos_interativos/cat_' + d.id).get()).data();
  console.log('::notice::' + String(v.titulo).replace(/[{}"]/g, ' ') + ' · duração ' + v.duracao_seg + 's · publicado ' + v.publicado + ' · interativo ' + v.interativo + ' · situação ' + (v.interativo_status || '-') + (v.interativo_erro ? ' (' + v.interativo_erro + ')' : '') +
    ' · desligado ' + !!v.interativo_desligado + (i ? ' · pausas ' + (i.interacoes || []).length + ' · publicado no catálogo ' + i.publicado + ' · editado ' + (i.atualizado_em ? i.atualizado_em.toDate().toISOString().slice(0, 16) : '-') : ' · sem versão interativa'));
}

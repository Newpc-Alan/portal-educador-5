// Marca como públicas as notícias já publicadas (pedido do Alan em 31/10/2026) e grava a cópia pública de cada uma.
// Depois confere: sem login, a cópia abre; a notícia original continua fechada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 600));
let falhas = 0; const ok = (c, t) => { if (!c) falhas++; aviso((c ? 'OK · ' : 'FALHOU · ') + t); };
const base = 'https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/';
const sn = await db.collection('noticias').where('publicado', '==', true).get();
aviso('notícias publicadas: ' + sn.size);
for (const d of sn.docs) {
  const n = d.data();
  if (n.tipo === 'pesquisa') { aviso('pesquisa fica de fora: ' + n.titulo); continue; }
  await d.ref.update({ publica: true });
  await db.doc('noticias_publicas/' + d.id).set({ tipo: n.tipo || 'noticia', titulo: n.titulo || '', resumo: n.resumo || '', corpo: n.corpo || '', midia_url: n.midia_url || '',
    imagem_url: n.imagem_url || '', inicio: n.inicio || n.criado_em || FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
  const pub = await fetch(base + 'noticias_publicas/' + d.id), orig = await fetch(base + 'noticias/' + d.id);
  ok(pub.status === 200 && orig.status === 403, '"' + n.titulo + '" · cópia pública abre sem login (HTTP ' + pub.status + ') · original fechada (HTTP ' + orig.status + ') · link https://www.portaldoeducador.com.br/noticia/?id=' + d.id);
}
process.exit(falhas ? 1 : 0);

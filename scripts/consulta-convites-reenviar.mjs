// GRAVA: reenvia as falhas dos convites "Seu acesso ao Portal do Educador" (limite diário do servidor), um comunicado novo por rede.
// Pula o comunicado de teste e o que já foi reenviado. O robô respeita o máximo por dia e pausa sozinho se o servidor recusar.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { reenviarFalhas } = await import(pathToFileURL(process.cwd() + '/comunicados.js').href);
const db = getFirestore();
const cs = await db.collection('comunicados_email').orderBy('criado_em', 'desc').limit(15).get();
let total = 0;
for (const c of cs.docs) {
  const x = c.data();
  if (x.status !== 'concluido' || !x.falhas || x.reenviado_para || !/^Seu acesso ao Portal do Educador/.test(x.assunto || '')) continue;
  try { const r = await reenviarFalhas(db, c.id, { nome: 'NEWPC (reenvio)', uid: '' }); total += r.total; console.log('::notice::reenvio criado: ' + r.total + ' pessoa(s) (de ' + x.falhas + ' falhas)'); }
  catch (e) { console.log('::notice::pulado: ' + String(e.message).slice(0, 100)); }
}
console.log('::notice::TOTAL na fila de reenvio: ' + total);

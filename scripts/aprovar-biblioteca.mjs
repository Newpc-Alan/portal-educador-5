// Aprova e traz títulos da triagem da Biblioteca quando o administrador autoriza fora do painel.
// Uso no Cloud Shell (pasta scripts, depois de "cd ../functions && npm ci"):
//   node aprovar-biblioteca.mjs dominio-publico "Autorizado por Alan em 23/10/2026" ID1 ID2 ...
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const { importarTitulo } = await import('../functions/biblioteca.js');
const [licenca, obs, ...ids] = process.argv.slice(2);
const db = getFirestore();
const alan = (await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get()).docs[0];
const quem = { uid: alan ? alan.id : 'admin', nome: (alan && alan.data().nome) || 'Alan' };
for (const id of ids) {
  try { const r = await importarTitulo({ id, licenca, obs }, quem); console.log('OK', id, r.ja ? '(já estava)' : ''); }
  catch (e) { console.log('ERRO', id, e.message); }
}

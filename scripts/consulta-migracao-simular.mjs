// Simula a migração de progresso entre versões dos cursos publicados (só leitura): quantos professores seriam levados.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { migrarProgresso } = await import(pathToFileURL(process.cwd() + '/domain.js').href);
const db = getFirestore(), arr = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
const pubs = (await db.collection('cursos').where('status', '==', 'publicado').get()).docs.filter(d => d.data().origemId);
const progs = await db.collectionGroup('progresso').get();
for (const c of pubs) {
  const o = c.data().origemId;
  const [a, b] = await Promise.all([db.collection(`cursos/${o}/aulas`).get(), c.ref.collection('aulas').get()]);
  let quem = 0, ja = 0, mantidas = 0;
  for (const d of progs.docs) { if (d.id !== o) continue; const p = migrarProgresso(d.data(), arr(a), arr(b), new Date().toISOString()); if (p) { quem++; mantidas += p.aulasVerificadas.length; } else ja++; }
  console.log(`::notice::${String(c.data().titulo).slice(0, 50)} (v${c.data().versao || '?'}): na versão anterior ${quem + ja} com progresso; migrariam ${quem} (${mantidas} aulas mantidas); concluídos ou sem aula: ${ja}`);
}

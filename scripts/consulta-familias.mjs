import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const tk = async uid => (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid), returnSecureToken: true }) })).json()).idToken;
const fn = async (t, dados) => (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/trabalhoRede', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ data: dados }) })).json().catch(() => ({}));
// Teste do envio às famílias pelo professor (sem mandar e-mail): com a escola desligada, nada sai e a turma aparece como "fora";
// com a escola ligada, o professor vê a turma e a cobertura de e-mails. Devolve a configuração da escola como estava.
let falhas = 0; const ok = (c, t) => { if (!c) falhas++; aviso((c ? 'OK · ' : 'FALHOU · ') + t); };
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const turmaId = (prof.data().turmas_ids || [])[0], turma = (await db.doc('turmas/' + turmaId).get()).data();
const cfgRef = db.doc('avisos_config/' + turma.escola_id), antes = (await cfgRef.get()).data() || null;
const tP = await tk(prof.id);
try {
  await cfgRef.set({ professor_familias: false }, { merge: true });
  const i1 = await fn(tP, { acao: 'familias_info' });
  ok(i1.result && i1.result.turmas.length === 0, 'escola desligada: professor não vê turma liberada ' + limpo(JSON.stringify(i1.result || i1.error)));
  const e1 = await fn(tP, { acao: 'enviar_link', titulo: 'Teste famílias (escola desligada)', url: 'https://pt.khanacademy.org/', turmas: [turmaId], familias: true });
  const fm = e1.result && e1.result.familias;
  ok(fm && fm.enviados === 0 && fm.fora && fm.fora.length === 1, 'escola desligada: nenhum e-mail e turma marcada como fora ' + limpo(JSON.stringify(fm || e1.error)));
  if (e1.result) { const its = await db.collection(`turma_materiais/${turmaId}/itens`).where('titulo', '==', 'Teste famílias (escola desligada)').get(); await Promise.all(its.docs.map(x => x.ref.delete())); }
  await cfgRef.set({ professor_familias: true }, { merge: true });
  const i2 = await fn(tP, { acao: 'familias_info' });
  const cob = i2.result && i2.result.cobertura && i2.result.cobertura[turmaId];
  ok(i2.result && i2.result.turmas.includes(turmaId) && cob, 'escola ligada: turma liberada · cobertura ' + limpo(JSON.stringify(cob || i2.error)));
  const cota = await db.doc(`avisos_prof/${prof.id}_${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande' }).format(new Date())}`).get();
  ok(!cota.exists || !cota.data().n, 'escola desligada não gastou a cota do dia do professor');
} finally {
  if (antes) await cfgRef.set(antes); else await cfgRef.delete();
  aviso('configuração da escola devolvida');
}
process.exit(falhas ? 1 : 0);

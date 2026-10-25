// Teste real da função portaria com um totem temporário da Rede Modelo (demonstração). Apaga tudo no fim.
// Rodar no Cloud Shell: cd functions && node ../scripts/teste-portaria.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), URL_F = 'https://southamerica-east1-portal-educador-5.cloudfunctions.net/portaria';
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', chave = Array.from(randomBytes(20), b => ABC[b % ABC.length]).join('');
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const post = async b => { const r = await fetch(URL_F, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave, ...b }) }); return [r.status, await r.json()]; };
let ok = 0, falhas = 0; const t = (n, c) => { if (c) ok++; else { falhas++; console.log('FALHOU:', n); } };
const al = (await db.collection('alunos').where('escola_id', '==', 'demo-e1').limit(1).get()).docs[0];
const outro = (await db.collection('alunos').where('escola_id', '==', 'demo-e2').limit(1).get()).docs[0];
if (!al || !outro) { console.log('Crie a Rede Modelo antes (demo-rede.mjs --criar).'); process.exit(1); }
const ref = db.doc(`tv_telas/${chave}`), entRef = db.doc(`freq_entradas/${al.data().turma_id}_${hoje}`);
const antes = (await entRef.get()).data();
try {
  let [s, d] = await post({ acao: 'lista' }); t('tela inexistente recusada', s === 403);
  await ref.set({ nome: 'Totem de teste', escola_id: 'demo-e1', escola_nome: 'Escola Modelo NEWPC Educação', municipio_id: 'demo-rede', modo: 'tv', playlist_id: '' });
  [s, d] = await post({ acao: 'lista' }); t('tela fora do modo portaria recusada', s === 403);
  await ref.update({ modo: 'portaria' });
  [s, d] = await post({ acao: 'lista' }); t('lista ok', s === 200 && Object.keys(d.alunos || {}).length > 50);
  const nomes = Object.values(d.alunos || {}); t('só primeiro nome', nomes.every(([n]) => !/\s/.test(n)));
  [s, d] = await post({ acao: 'entrar', entradas: [{ id: al.id, hora: '07:05', dia: hoje }, { id: outro.id, hora: '07:06', dia: hoje }, { id: 'naoexiste', hora: '07:07', dia: hoje }] });
  t('entrada aceita só da escola', s === 200 && d.ok.includes(al.id) && d.recusados.includes(outro.id) && d.recusados.includes('naoexiste'));
  const e = (await entRef.get()).data() || {};
  t('gravou a entrada', !!(e.entradas && e.entradas[al.id]) && e.escola_id === 'demo-e1' && e.nomes[al.id] === al.data().nome);
  [s, d] = await post({ acao: 'entrar', entradas: [{ id: al.id, hora: '09:30', dia: hoje }] });
  t('primeira hora fica', (await entRef.get()).data().entradas[al.id] === ((antes && antes.entradas && antes.entradas[al.id]) || '07:05'));
  [s, d] = await post({ acao: 'entrar', entradas: [{ id: al.id, hora: '07:00', dia: '2026-01-01' }] }); t('data antiga recusada', s === 200 && d.ok.length === 0);
  // foto na entrada: outro aluno da mesma turma, com a tela em "foto ligada"
  const al2 = (await db.collection('alunos').where('turma_id', '==', al.data().turma_id).limit(3).get()).docs.find(x => x.id !== al.id && !((antes && antes.entradas) || {})[x.id]);
  await ref.update({ foto_entrada: true });
  const JPG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP' + 'A'.repeat(300) + '/9k=';
  [s, d] = await post({ acao: 'entrar', entradas: [{ id: al2.id, hora: '07:10', dia: hoje, foto: JPG }] });
  const caminho = `portaria/demo-e1/${hoje}/${al2.id}_0710.jpg`;
  const doc2 = (await entRef.get()).data() || {};
  t('foto gravada no Storage', (await getStorage().bucket('portal-educador-5-portaria').file(caminho).exists())[0] && (doc2.fotos || {})[al2.id] === caminho);
  await getStorage().bucket('portal-educador-5-portaria').file(caminho).delete().catch(() => {});
} finally {
  await ref.delete();
  if (!antes) await entRef.delete(); else await entRef.set(antes);
}
console.log(`PORTARIA: ${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);

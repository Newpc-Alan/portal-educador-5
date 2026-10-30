// GRAVA: coloca na posição 1 (aparecem primeiro) os jogos que o Alan escolheu em 30/10/2026, pelo título exato.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LISTA = ['Batalha de Português', 'Caça-Palavras', 'Jogo da Forca', 'Batalha Matemática', 'Mãos em Ação · Coordenação Motora', 'Prática de Mouse e Teclado'];
const vs = (await db.collection('jogos').get()).docs.map(d => ({ ref: d.ref, ...d.data() }));
let feitos = 0;
for (const t of LISTA) {
  const a = vs.filter(v => norm(v.titulo) === norm(t));
  if (a.length !== 1) { console.log('::warning::' + (a.length ? 'mais de um jogo: ' : 'nao encontrado: ') + limpo(t)); continue; }
  await a[0].ref.update({ prioridade: 1, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'script-posicao1' });
  console.log('::notice::posicao 1: ' + limpo(a[0].titulo)); feitos++;
}
console.log('::notice::jogos na posicao 1: ' + feitos + ' de ' + LISTA.length);

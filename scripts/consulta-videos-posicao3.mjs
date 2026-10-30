// GRAVA: coloca na posição 3 (fim da fila) os vídeos que o Alan listou em 30/10/2026, pelo título.
// Só altera "prioridade"; títulos que não batem exatamente (ou batem com mais de um vídeo) são só relatados.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LISTA = [
  'Ciclo da água', 'Andy, a formiga e a importância do trabalho em equipe', 'A jornada das pequenas árvores', 'Planeta Terra', 'Higiene bucal',
  'Tsunami A Onda Gigante', 'A incrível aventura da água na natureza', 'O Mistério dos Germes Invisíveis',
  'Proteja se do fogo Curiosidades sobre segurança contra incêndio', 'O Impacto dos Pensamentos nas Ações',
  'Diversidade Cultural e Formação do Povo Brasileiro', 'Obras no Ensino de Música', 'Maravilhas do Clima',
  '*do Carnaval na Cultura Brasileira', 'A Aventura de Kody o Dragão de Komodo', 'Prevenção e Proteção',
  'Aprendendo a Economizar e Poupar Recursos', 'Hábitos de Poupança e Consumo Consciente', 'Planejamento, Gastos e Poupança',
  'A Origem do Dinheiro e Trocas Comerciais', 'Educação Financeira', 'Explorando o Incrível rio Amazonas'
];
const snap = await db.collection('videos').get();
const vs = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));
const usados = new Set(); let feitos = 0;
for (const t of LISTA) {
  const fim = t.startsWith('*'), alvo = norm(t.replace(/^\*/, ''));
  const achados = vs.filter(v => fim ? norm(v.titulo).endsWith(alvo) : norm(v.titulo) === alvo);
  if (achados.length !== 1) { console.log('::warning::' + (achados.length ? 'mais de um video com o titulo: ' : 'nao encontrado: ') + limpo(t)); continue; }
  const v = achados[0]; usados.add(v.ref.id);
  if (v.prioridade === 3) { console.log('::notice::ja estava na posicao 3: ' + limpo(v.titulo)); continue; }
  await v.ref.update({ prioridade: 3, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'script-posicao3' });
  feitos++;
}
console.log('::notice::videos movidos para a posicao 3: ' + feitos + ' de ' + LISTA.length);
const fora = vs.filter(v => !usados.has(v.ref.id));
console.log('::notice::videos que NAO estavam na lista (' + fora.length + '): ' + limpo(fora.map(v => (v.titulo || '?') + (v.publicado ? '' : ' [rascunho]') + ' (pos ' + (v.prioridade || 2) + ')').join(' | ')));

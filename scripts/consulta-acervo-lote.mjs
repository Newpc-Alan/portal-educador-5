// Aulas prontas: começa (ou cutuca) o lote oficial no servidor. Grava acervo_lote/atual com as aulas que ainda não existem
// em acervo_aulas; a função acervoFila gera uma por vez. Não mostra dado pessoal no log (repositório público).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const L = JSON.parse(readFileSync(new URL('../lousa/acervo-lote.json', import.meta.url), 'utf8'));
const lote = L.temas.flatMap(t => L.faixas.map(f => ({ id: t.id + '_' + f.id, tema: t.tema, disciplina: t.disciplina, macroarea: t.macroarea, obs: t.obs,
  faixa: f.id, turma: f.turma, qtd: f.qtd, imagens: 2, status: 'fila', erro: '', titulo: '' })));
const existentes = new Set((await db.collection('acervo_aulas').select().get()).docs.map(d => d.id));
const ref = db.doc('acervo_lote/atual'), atual = await ref.get();
const andando = atual.exists && (atual.data().itens || []).some(i => i.status === 'fila' || i.status === 'gerando');
if (andando) {
  await ref.update({ atualizado_em: FieldValue.serverTimestamp(), parado: false });
  const it = atual.data().itens; const n = s => it.filter(i => i.status === s).length;
  console.log('::notice::' + `Lote já em andamento: ${n('ok')} prontas, ${n('erro')} com erro, ${n('fila')} na fila, ${n('gerando')} gerando. Cutucado para seguir.`);
} else {
  const falta = lote.filter(x => !existentes.has(x.id));
  if (!falta.length) { console.log('::notice::Nada a gerar: as ' + lote.length + ' aulas do lote já existem.'); process.exit(0); }
  // a aula é gerada em nome de um administrador ativo (o servidor confere o perfil)
  const adm = (await db.collection('usuarios').where('perfil', '==', 'admin').where('status', '==', 'ativo').limit(1).get()).docs[0];
  if (!adm) { console.log('::error::Nenhum administrador ativo.'); process.exit(1); }
  await ref.set({ uid: adm.id, criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(), parado: false, terminado_em: null, itens: falta, origem: 'script' });
  console.log('::notice::' + `Lote começado no servidor: ${falta.length} aulas na fila (${existentes.size} já existiam).`);
}

// Reações aos vídeos (4 carinhas). Cada pessoa tem um voto por vídeo em videos_reacoes/{video}_{uid} e pode trocar.
// A contagem fica no próprio vídeo (videos/{id}.reacoes), que todo mundo que vê o vídeo já pode ler:
// ninguém precisa ler os votos dos outros (os votos só são lidos pelo dono e pelo administrador).
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { REGIAO_FIRESTORE } from './dicas.js';

const VALIDAS = ['amei', 'gostei', 'meh', 'nao'];

export const contarReacaoVideo = onDocumentWritten({ region: REGIAO_FIRESTORE, document: 'videos_reacoes/{id}', maxInstances: 10 }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  const r0 = antes && VALIDAS.includes(antes.reacao) ? antes.reacao : null;
  const r1 = depois && VALIDAS.includes(depois.reacao) ? depois.reacao : null;
  if (r0 === r1) return;
  const videoId = (depois || antes).video_id;
  if (!videoId || typeof videoId !== 'string') return;
  const mudar = {};
  if (r0) mudar['reacoes.' + r0] = FieldValue.increment(-1);
  if (r1) mudar['reacoes.' + r1] = FieldValue.increment(1);
  try { await getFirestore().doc('videos/' + videoId).update(mudar); }
  catch (e) { console.warn('reacao: video', videoId, e.code || e.message); }
});

// O mesmo para os títulos da Biblioteca (Histórias Educativas e demais estantes): biblioteca_reacoes/{livro}_{uid} -> biblioteca/{id}.reacoes
export const contarReacaoLivro = onDocumentWritten({ region: REGIAO_FIRESTORE, document: 'biblioteca_reacoes/{id}', maxInstances: 10 }, async (event) => {
  const antes = event.data.before.exists ? event.data.before.data() : null;
  const depois = event.data.after.exists ? event.data.after.data() : null;
  const r0 = antes && VALIDAS.includes(antes.reacao) ? antes.reacao : null;
  const r1 = depois && VALIDAS.includes(depois.reacao) ? depois.reacao : null;
  if (r0 === r1) return;
  const livroId = (depois || antes).livro_id;
  if (!livroId || typeof livroId !== 'string') return;
  const mudar = {};
  if (r0) mudar['reacoes.' + r0] = FieldValue.increment(-1);
  if (r1) mudar['reacoes.' + r1] = FieldValue.increment(1);
  try { await getFirestore().doc('biblioteca/' + livroId).update(mudar); }
  catch (e) { console.warn('reacao: livro', livroId, e.code || e.message); }
});

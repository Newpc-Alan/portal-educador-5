// Remonta e grava agora o índice da busca geral (o mesmo que a rotina indiceBusca faz a cada 2 horas). Sem dados de pessoas.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { montarIndiceBusca, gravarIndiceBusca } = await import(pathToFileURL(process.cwd() + '/busca.js').href);
const db = getFirestore(), r = await montarIndiceBusca(db), ids = await gravarIndiceBusca(db, r);
const livros = r.partes.flat().filter(x => x.c === 'biblioteca'), doAluno = livros.filter(x => x.m === 'historias' || ['aprender', 'gibiteca'].includes(x.sc)).length;
console.log(`::notice::Índice gravado: ${r.total} conteúdos em ${ids.length} parte(s). Livros: ${livros.length}, que o aluno abre: ${doAluno}.`);

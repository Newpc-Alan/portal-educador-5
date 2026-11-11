// Acervo NEWPC de quizzes (nov/2026): grava em quizzes_geral os quizzes prontos de scripts/acervo-quiz/*.json (1º ao 9º ano, 5 disciplinas).
// As alternativas são embaralhadas de forma fixa (a mesma ordem a cada execução); o id é estável, então rodar de novo só atualiza.
// Não mexe nos números de uso (aplicações, alunos, média) de quiz que já foi aplicado.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), pasta = '../scripts/acervo-quiz/';
const h = s => createHash('sha1').update(s).digest('hex');
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
let n = 0, novos = 0;
for (const arq of readdirSync(pasta).filter(f => f.endsWith('.json')).sort()) {
  for (const [ano, disciplina, titulo, qs] of JSON.parse(readFileSync(pasta + arq, 'utf8'))) {
    const perguntas = qs.map(([p, ops, gab]) => {
      const certo = ops[gab], ord = ops.map((o, i) => ({ o, k: h(p + '|' + o + '|' + i) })).sort((a, b) => a.k < b.k ? -1 : 1).map(x => x.o);
      return { p, ops: ord, gab: ord.indexOf(certo) };
    });
    const id = 'newpc-' + slug(ano + '-' + disciplina + '-' + titulo), ref = db.doc('quizzes_geral/' + id), atual = await ref.get();
    await ref.set({ titulo, disciplina, ano, perguntas, n: perguntas.length, rede_nome: 'Acervo NEWPC', municipio_id: '', origem: 'acervo_newpc',
      revisar: [], status: 'publicado', atualizado_em: FieldValue.serverTimestamp(),
      ...(atual.exists ? {} : { aplicacoes: 0, alunos: 0, media: 0, avisos: 0, criado_em: FieldValue.serverTimestamp() }) }, { merge: true });
    n++; if (!atual.exists) novos++;
  }
}
console.log(`::notice::Acervo NEWPC de quizzes: ${n} quizzes gravados (${novos} novos).`);

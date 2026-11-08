// Só leitura: pergunta ativa da aula ao vivo e o que cada aluno gravou (para conferir o termômetro durante um teste).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), h = ms => new Date(ms - 4 * 3600e3).toISOString().slice(11, 19);
for (const d of (await db.collection('aula_vivo').get()).docs) {
  const x = d.data(); if (!x.pesquisa || !x.atualizado_em || Date.now() - x.atualizado_em.toMillis() > 3 * 3600e3) continue;
  console.log('::notice::turma ' + d.id + ' · pesquisa ' + JSON.stringify(x.pesquisa).replace(/[{}"]/g, ' ') + ' · pausa ' + !!x.pausa + ' · pausa_alunos ' + Object.entries(x.pausa_alunos || {}).map(([k, v]) => k.replace('lab-', '') + '=' + (v ? 'sim' : 'nao')).join(' '));
  for (const a of (await d.ref.collection('alunos').get()).docs) { const y = a.data();
    console.log('::notice::  aluno ' + a.id + ' ' + (y.nome || '') + ' · em ' + (y.em ? h(y.em.toMillis()) : '-') + ' · campos ' + Object.keys(y).join(',') + ' · mao ' + (y.mao === undefined ? 'ausente' : y.mao === null ? 'null' : (y.mao.toMillis ? 'hora' : typeof y.mao)) + ' · pesquisa ' + JSON.stringify(y.pesquisa || null).replace(/[{}"]/g, ' ').slice(0, 200)); }
  for (const p of (await db.collection('turma_presenca').doc(d.id).collection('alunos').get()).docs) { const y = p.data(); if (y.em && Date.now() - y.em.toMillis() < 3600e3) console.log('::notice::  presença ' + p.id + ' ' + y.nome + ' ' + h(y.em.toMillis()) + ' fora ' + !!y.fora); }
}

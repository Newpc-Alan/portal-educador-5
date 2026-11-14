// Rede de demonstração: confere (só leitura) os resultados simulados dos jogos com a MESMA consulta da visão da rede
// (municipio_id + dia, que depende do índice composto). Mostra o resumo por escola. Não grava nada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), M = 'demo-rede', de = new Date(Date.now() - 4 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
const nomes = {}; (await db.collection('escolas').where('municipio_id', '==', M).get()).forEach(d => { nomes[d.id] = d.data().nome; });
const s = await db.collection('jogo_resultados').where('municipio_id', '==', M).where('dia', '>=', de).limit(20000).get();
const E = {}; let fora = 0;
s.forEach(x => { const r = x.data(); if (r.demo !== true) fora++; const e = E[r.escola_id] || (E[r.escola_id] = { n: 0, lousa: 0, c: 0, t: 0, al: new Set() });
  if (r.perfil === 'aluno') { e.n++; e.c += r.acertos; e.t += r.total; e.al.add(r.aluno_id); } else e.lousa++; });
console.log(`::notice::Índice ok · ${s.size} rodadas desde ${de} · ` + Object.keys(nomes).sort().map(id => { const e = E[id] || { n: 0, lousa: 0, c: 0, t: 0, al: new Set() };
  return `${nomes[id]}: ${e.al.size} alunos, ${e.n} rodadas, ${e.lousa} na lousa, ${e.t ? Math.round(e.c / e.t * 100) + '%' : 'sem dados'}`; }).join(' | ') + (fora ? ` · ATENÇÃO: ${fora} sem a marca demo` : ''));

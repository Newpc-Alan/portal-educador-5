// Só leitura: lista dos jogos (publicado, destaque, posição e data de cadastro), para o Alan escolher a ordem.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const ms = v => (v && v.toMillis ? v.toMillis() : 0), dia = m => m ? new Date(m).toISOString().slice(0, 10) : '-';
const s = await db.collection('jogos').get();
const l = s.docs.map(d => d.data()).sort((a, b) => (!!b.publicado - !!a.publicado) || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
console.log('::notice::jogos: ' + l.length + ' (' + l.filter(j => j.publicado).length + ' publicados)');
for (let i = 0; i < l.length; i += 15)
  console.log('::notice::' + limpo(l.slice(i, i + 15).map(j => (j.publicado ? '' : '[rascunho] ') + (j.destaque ? '[destaque] ' : '') + j.titulo + ' (pos ' + (j.prioridade || 2) + ', ' + (j.componente || '-') + ', cad ' + dia(ms(j.publicado_em) || ms(j.criado_em)) + ')').join(' | ')));

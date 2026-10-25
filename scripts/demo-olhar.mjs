// Somente leitura: procura o município "NEWPC Educação" e conta o que já existe nele. Rodar no Cloud Shell: node scripts/demo-olhar.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const ms = (await db.collection('municipios').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const alvo = ms.filter(m => /newpc/i.test(String(m.nome || '') + ' ' + d0(m)));
function d0(m){ return m.id; }
console.log('MUNICIPIOS', ms.length, '| com NEWPC no nome:', alvo.map(m => `${m.id} = ${m.nome}/${m.uf || ''} status=${m.status || ''} demo=${m.demo || ''} prof=${JSON.stringify(m.modulos_professor || [])} sec=${JSON.stringify(m.modulos_secretaria || [])}`).join(' || ') || 'nenhum');
for (const m of alvo) {
  const esc = await db.collection('escolas').where('municipio_id', '==', m.id).get();
  const cont = async (c, f = 'municipio_id') => (await db.collection(c).where(f, '==', m.id).count().get()).data().count;
  console.log('MUNI', m.id, '| escolas', esc.size, esc.docs.map(d => d.id + '=' + d.data().nome).join('; '));
  console.log('  turmas', await cont('turmas'), '| alunos', await cont('alunos'), '| usuarios', await cont('usuarios'), '| chamadas', await cont('freq_chamadas'), '| resumos', await cont('freq_resumo'));
  const us = await db.collection('usuarios').where('municipio_id', '==', m.id).get();
  console.log('  perfis', JSON.stringify(us.docs.reduce((o, d) => { const p = d.data().perfil; o[p] = (o[p] || 0) + 1; return o; }, {})));
  for (const e of esc.docs) { const t = await db.collection('turmas').where('escola_id', '==', e.id).count().get(); const a = await db.collection('alunos').where('escola_id', '==', e.id).count().get(); console.log('  escola', e.id, 'turmas', t.data().count, 'alunos', a.data().count); }
}

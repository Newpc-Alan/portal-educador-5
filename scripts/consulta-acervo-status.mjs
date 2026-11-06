// Só leitura: andamento do lote das Aulas prontas (acervo_lote/atual) e o que já está em acervo_aulas. Sem dado pessoal.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 900));
const L = (await db.doc('acervo_lote/atual').get()).data() || {}, it = L.itens || [], n = s => it.filter(i => i.status === s).length;
aviso(`Lote: ${n('ok')} ok, ${n('erro')} erro, ${n('gerando')} gerando, ${n('fila')} na fila (de ${it.length})`);
const g = it.find(i => i.status === 'gerando'); if (g) aviso('Gerando agora: ' + g.id + ' há ' + Math.round((Date.now() - g.inicio) / 1000) + ' s');
const feitos = it.filter(i => i.fim && i.inicio).map(i => (i.fim - i.inicio) / 1000); if (feitos.length) aviso('Tempo médio por aula: ' + Math.round(feitos.reduce((a, b) => a + b, 0) / feitos.length) + ' s');
it.filter(i => i.status === 'erro').slice(0, 8).forEach(i => aviso('Erro ' + i.id + ': ' + i.erro));
const ac = await db.collection('acervo_aulas').select('status', 'qtd', 'contas_erradas', 'imagens', 'aviso').get();
const por = {}; ac.forEach(d => { const x = d.data(); por[x.status] = (por[x.status] || 0) + 1; });
aviso('acervo_aulas: ' + JSON.stringify(por));
ac.docs.slice(-5).forEach(d => { const x = d.data(); aviso(d.id + ': ' + x.qtd + ' slides, ' + Object.keys(x.imagens || {}).length + ' ilustr., contas ' + (x.contas_erradas || 0) + (x.aviso ? ', aviso: ' + x.aviso : '')); });

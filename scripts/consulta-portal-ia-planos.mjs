// Só leitura: situação do botão Portal IA e o plano de cada município (quem tem Portal IA e quem tem imagens).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ');
const cm = await db.doc('config/modulos').get(); const it = (cm.exists && cm.data().itens) || {};
console.log('::notice::botão portalia no config: ' + limpo(JSON.stringify(it.portalia || 'sem registro (vale o padrão: liberado)')) + ' · botão ia: ' + limpo(JSON.stringify(it.ia || 'sem registro')));
const ms = await db.collection('municipios').get(); const linhas = [];
ms.forEach(d => { const m = d.data(), p = m.plano_nome || '(sem plano)'; linhas.push(m.nome + '/' + (m.uf || '') + ': ' + p + (['intermediario', 'completo'].includes(p) ? ' · Portal IA' + (p === 'completo' ? ' com imagens' : ' sem imagens') : ' · sem Portal IA')); });
for (let i = 0; i < linhas.length; i += 8) console.log('::notice::' + limpo(linhas.slice(i, i + 8).join(' | ')));

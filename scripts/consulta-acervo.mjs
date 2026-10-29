// Só leitura: como está o Acervo (endereço do serviço, quantos arquivos por botão, acervo das redes).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ');
const c = await db.doc('config/acervo').get();
const api = c.exists ? (c.data().api || '') : '';
console.log('::notice::servico do acervo: ' + (api ? api.replace(/^https:\/\//, '') : 'NAO CONFIGURADO'));
const a = await db.collection('acervo').get(); const por = {};
a.forEach(d => { const x = d.data(); const k = (x.modulo || '?') + (x.publicado ? '' : ' (oculto)'); por[k] = (por[k] || 0) + 1; });
console.log('::notice::acervo NEWPC: ' + a.size + ' arquivo(s) · ' + limpo(Object.entries(por).map(([k, v]) => k + ' ' + v).join(', ') || 'nenhum'));
const r = await db.collection('acervo_rede').get();
console.log('::notice::acervo das redes: ' + r.size + ' arquivo(s)');
if (api) { try { const t = await fetch(api.replace(/\/$/, '') + '/saude'); console.log('::notice::teste do servico: HTTP ' + t.status + ' ' + limpo((await t.text()).slice(0, 40))); } catch (e) { console.log('::notice::teste do servico: falhou ' + limpo(e.message)); } }

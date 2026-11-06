// Só leitura: tabela de créditos e pacotes em vigor (config/portal_ia) e uso/custo real da IA por recurso (stats/ia_uso). Sem dado pessoal.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 1500));
const cfg = (await db.doc('config/portal_ia').get()).data() || {};
const c = cfg.creditos || {};
aviso('precos: ' + JSON.stringify(c.precos || 'padrao'));
aviso('franquia: ' + JSON.stringify(c.franquia || 'padrao') + ' teto: ' + (c.teto_padrao ?? 'padrao') + ' demo: ' + (c.demo_teste ?? 'padrao') + ' dolar: ' + (c.dolar ?? 'padrao'));
aviso('pacotes_rede: ' + JSON.stringify(c.pacotes_rede || 'padrao'));
aviso('pacotes_professor: ' + JSON.stringify(c.pacotes_professor || 'padrao'));
const st = (await db.doc('stats/ia_uso').get()).data() || {};
for (const mes of Object.keys(st).sort().slice(-3)) aviso('uso ' + mes + ': ' + JSON.stringify(Object.fromEntries(Object.entries(st[mes]).map(([k, v]) => [k, { usos: v.usos, usd: Math.round((v.custo_usd || 0) * 1000) / 1000 }]))));

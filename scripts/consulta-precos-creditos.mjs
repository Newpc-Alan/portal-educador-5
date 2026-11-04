// Só leitura: tabela de pacotes de créditos, franquia e teto gravados em config/portal_ia (o que vale hoje no Portal).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { cfgCreditos } = await import(pathToFileURL(process.cwd() + '/creditos.js').href);
const db = getFirestore(), raw = ((await db.doc('config/portal_ia').get()).data() || {}).creditos || {}, cc = cfgCreditos({ creditos: raw });
const lista = l => (l || []).map(p => p.nome + ' R$ ' + p.valor + ' (R$ ' + (p.valor / p.creditos).toFixed(2) + '/crédito)').join(' · ');
console.log('::notice::gravado no banco: pacotes_rede ' + (raw.pacotes_rede ? 'sim' : 'não (usa o padrão do código)') + ', pacotes_professor ' + (raw.pacotes_professor ? 'sim' : 'não') + ', franquia ' + (raw.franquia ? 'sim' : 'não'));
console.log('::notice::rede: ' + lista(cc.pacotes_rede));
console.log('::notice::professor: ' + lista(cc.pacotes_professor));
console.log('::notice::franquia por educador/mês: ' + JSON.stringify(cc.franquia).replace(/[{}"]/g, ' ') + ' · teto padrão ' + cc.teto_padrao + ' · demonstração do teste ' + cc.demo_teste);

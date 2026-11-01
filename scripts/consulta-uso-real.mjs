// Calcula o Uso real (mesma rotina da função usoRealDiario) e mostra o resumo das últimas semanas.
// Grava uso_real/{semana}_* (só números agregados, o mesmo que a rotina da madrugada grava).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const aviso = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
const { calcularUsoReal } = await import(pathToFileURL(process.cwd() + '/uso-real.js').href);
const db = getFirestore(), t0 = Date.now();
const r = await calcularUsoReal(db);
aviso('calculado em ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + r.professores + ' professores ativos · ' + r.envios + ' envios para turmas na janela');
for (const s of r.semanas.slice(-6)) {
  const g = (await db.doc(`uso_real/${s}_geral`).get()).data() || {};
  aviso(s + ' · usaram ' + g.ativos + ' de ' + g.professores + ' · acessaram ' + g.acessaram + ' · ações ' + JSON.stringify(g.acoes || {}));
}
process.exit(0);

// GRAVA: aplica em config/portal_ia a tabela de nov/2026 (pacotes com pelo menos o dobro do custo real e franquia mensal da rede).
// Não mexe em preços por ação, teto, alertas, validade nem dólar.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { CREDITOS_PADRAO } = await import(pathToFileURL(process.cwd() + '/creditos.js').href);
const db = getFirestore();
await db.doc('config/portal_ia').set({ creditos: { pacotes_rede: CREDITOS_PADRAO.pacotes_rede, pacotes_professor: CREDITOS_PADRAO.pacotes_professor, franquia: CREDITOS_PADRAO.franquia },
  atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'tabela-nov-2026' }, { merge: true });
const lista = l => l.map(p => p.nome + ' R$ ' + p.valor).join(' · ');
console.log('::notice::gravado · rede: ' + lista(CREDITOS_PADRAO.pacotes_rede) + ' · professor: ' + lista(CREDITOS_PADRAO.pacotes_professor) + ' · franquia: ' + JSON.stringify(CREDITOS_PADRAO.franquia).replace(/[{}"]/g, ' '));

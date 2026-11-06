// GRAVA: tabela de créditos com 200% de margem (nov/2026) em config/portal_ia.creditos.
// Preço por ação = custo real ajustado × 3 no pior caso (R$ 0,36 o crédito): material 2, Aula IA 6, imagem 6, Aula avançada 24;
// texto 1 e ajuste 1 continuam. Franquia 60/120/60, teto padrão 120 e fator_custo 1,6 (fatura do Google ÷ custo pelos tokens).
// Não mexe em pacotes, alertas, validade nem dólar. Mostra o antes e o depois.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { CREDITOS_PADRAO } = await import(pathToFileURL(process.cwd() + '/creditos.js').href);
const db = getFirestore(), ref = db.doc('config/portal_ia');
const resumo = c => 'precos ' + JSON.stringify(c.precos || {}) + ' · franquia ' + JSON.stringify(c.franquia || {}) + ' · teto ' + c.teto_padrao + ' · fator ' + c.fator_custo;
const antes = ((await ref.get()).data() || {}).creditos || {};
console.log('::notice::antes · ' + resumo(antes));
await ref.set({ creditos: { precos: CREDITOS_PADRAO.precos, franquia: CREDITOS_PADRAO.franquia, teto_padrao: CREDITOS_PADRAO.teto_padrao, fator_custo: CREDITOS_PADRAO.fator_custo },
  atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'margem-200-nov-2026' }, { merge: true });
const depois = ((await ref.get()).data() || {}).creditos || {};
console.log('::notice::depois · ' + resumo(depois));

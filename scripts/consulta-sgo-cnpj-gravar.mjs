// São Gabriel do Oeste/MS: CNPJ pagador do contrato de equipamentos (FEMSGO, conforme a relação de equipamentos da NEWPC).
// Grava o CNPJ da Secretaria / Fundo de Educação do cadastro da rede. CNPJ de órgão público é dado público.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), ref = db.doc('municipios/VOeU9ZOannWqIYe46x8M'), CNPJ = '30941262000111';
const m = (await ref.get()).data();
if (!m) { console.log('::notice::rede não encontrada'); process.exit(1); }
const f = c => c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '(vazio)';
console.log('::notice::' + m.nome + '/' + m.uf + ' · CNPJ Prefeitura ' + f(m.cnpj_prefeitura) + ' · CNPJ Secretaria/Fundo ' + f(m.cnpj_educacao) + ' · tipo ' + (m.tipo_rede || 'municipal'));
await ref.update({ cnpj_educacao: CNPJ, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'newpc-planilha-equipamentos' }); const n = (await ref.get()).data(); console.log('::notice::GRAVADO · CNPJ Secretaria/Fundo agora ' + f(n.cnpj_educacao));
process.exit(0);

// GRAVA 1 documento: acervo/teste-ponte-nc, um PDF do Nextcloud publicado para testar a ponte (link assinado) como professor.
// Para retirar depois: apagar acervo/teste-ponte-nc no admin do Acervo (o PDF continua no Nextcloud).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const c = '01-Acervo-NEWPC/Atividades/Anos-Iniciais/Ciências/Perigos em casa (Fixação) [UPZ6ab].pdf';
const m = (await db.collection('nc_mapa').where('nc', '==', c).limit(1).get()).docs[0];
if (!m) { console.log('::error::caminho não está no mapa da cópia: ' + c); process.exit(1); }
await db.doc('acervo/teste-ponte-nc').set({ titulo: 'TESTE · Perigos em casa (servidor NEWPC)', modulo: '', disciplina: 'Ciências', etapas: ['Anos Iniciais'], bncc: [], descricao: '',
  arquivo_key: '', nc_caminho: c, arquivo_nome: 'Perigos em casa.pdf', mime: 'application/pdf', tamanho: m.get('tamanho') || 0, publicado: true,
  criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
console.log('::notice::acervo/teste-ponte-nc publicado (Ciências, Anos Iniciais) apontando para ' + c);

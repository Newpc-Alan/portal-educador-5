// Adiciona um e-mail à lista de testadores do pagamento online (config/pagamentos.testadores) e mostra a situação da conta.
// Uso: consulta pagamentos-testador-gravar, com o e-mail no input "valor". Não imprime o e-mail inteiro no log (repositório público).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), email = String(process.env.VALOR || 'prof.ciencias@portaldoeducador.com.br').trim().toLowerCase();   // conta de teste da NEWPC
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.log('::error::E-mail inválido no input "valor".'); process.exit(1); }
const masc = email.replace(/^(.{3}).*@/, '$1***@');
await db.doc('config/pagamentos').set({ testadores: FieldValue.arrayUnion(email), atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
const u = await db.collection('usuarios').where('email', '==', email).limit(1).get();
const x = u.empty ? null : u.docs[0].data();
console.log(`::notice::${masc} incluído nos testadores do pagamento. Conta: ${x ? `perfil ${x.perfil}, status ${x.status}, licença ${x.licenca_tipo || '-'} ${x.plano_avulso || ''}` : 'não encontrada em usuarios'}`);

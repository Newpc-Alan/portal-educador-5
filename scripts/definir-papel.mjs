// Define o papel editorial da Formação Continuada (claim "papel") para uma conta do Portal 5.0.
// Uso no Cloud Shell:  node definir-papel.mjs alan@newpc.com.br admin
// Papéis: admin | editor | nenhum. Depois disso a pessoa precisa sair e entrar de novo.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const [email, papel] = process.argv.slice(2);
if (!email || !['admin', 'editor', 'nenhum'].includes(papel)) { console.error('Uso: node definir-papel.mjs EMAIL admin|editor|nenhum'); process.exit(1); }
const app = initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const u = await getAuth(app).getUserByEmail(email);
const claims = { ...(u.customClaims || {}) };
if (papel === 'nenhum') delete claims.papel; else claims.papel = papel;
await getAuth(app).setCustomUserClaims(u.uid, claims);
const ref = getFirestore(app).doc(`equipe/${u.uid}`);
if (papel === 'nenhum') await ref.delete();
else await ref.set({ email: u.email, papel, nome: u.displayName || '', atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
console.log(`OK: ${u.email} agora tem papel "${papel}" (uid ${u.uid}).`);

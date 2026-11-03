// Atualização cadastral do professor (nov/2026): CPF, nascimento, disciplinas e a data da atualização só pelo próprio professor, no formato certo.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-cadastro.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1', nome: 'Júlio' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const p1 = () => doc(fs('p1'), 'usuarios/p1');
await t('professor grava a atualização completa', assertSucceeds(updateDoc(p1(), { cpf: '123.456.789-09', nascimento: '1984-05-20', disciplinas: ['Matemática', 'Ciências'],
  whatsapp: '67999990000', funcao: 'Professor(a)', anos_aula: ['6'], etapas: ['Anos Finais (6º ao 9º)'], cadastro_atualizado_em: serverTimestamp(), privacidade_aceite_em: serverTimestamp() })));
await t('CPF fora do formato não', assertFails(updateDoc(p1(), { cpf: '12345678909' })));
await t('nascimento fora do formato não', assertFails(updateDoc(p1(), { nascimento: '20/05/1984' })));
await t('disciplinas demais não', assertFails(updateDoc(p1(), { disciplinas: Array.from({ length: 25 }, (_, i) => 'd' + i) })));
await t('data da atualização inventada não', assertFails(updateDoc(p1(), { cadastro_atualizado_em: Timestamp.fromMillis(Date.now() + 365 * 864e5) })));
await t('outro usuário não mexe no CPF', assertFails(updateDoc(doc(fs('p2'), 'usuarios/p1'), { cpf: '123.456.789-09' })));
await t('perfil continua protegido', assertFails(updateDoc(p1(), { cpf: '123.456.789-09', perfil: 'admin' })));
console.log((falha ? '::error::' : '::notice::') + 'Atualização cadastral: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

// Aparelhos conectados (sessoes/{uid}): cada conta lê só a própria lista; ninguém grava pelo navegador (só a função). Emulador.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo' });
  await setDoc(doc(db, 'sessoes/p1'), { lista: [{ sid: 'a'.repeat(20) }] });
  await setDoc(doc(db, 'sessoes/al-x'), { lista: [{ sid: 'b'.repeat(20) }] });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid).firestore();
await t('professor lê os próprios aparelhos', assertSucceeds(getDoc(doc(fs('p1'), 'sessoes/p1'))));
await t('aluno lê os próprios aparelhos', assertSucceeds(getDoc(doc(fs('al-x'), 'sessoes/al-x'))));
await t('professor não lê os do aluno', assertFails(getDoc(doc(fs('p1'), 'sessoes/al-x'))));
await t('sem login não lê', assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'sessoes/p1'))));
await t('ninguém grava pelo navegador', assertFails(setDoc(doc(fs('p1'), 'sessoes/p1'), { lista: [] })));
console.log((falha ? '::error::' : '::notice::') + 'Aparelhos conectados: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

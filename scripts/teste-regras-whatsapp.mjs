// Robô do WhatsApp: administrador e equipe de atendimento leem; ninguém grava conversa pelo navegador;
// cada membro só liga e desliga o próprio "disponível".
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-whatsapp.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'municipios/m1'), { nome: 'M1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/adm'), { perfil: 'admin', status: 'ativo' });
  await setDoc(doc(db, 'usuarios/at1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/at2'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', municipio_id: 'm1' });
  await setDoc(doc(db, 'wa_equipe/at1'), { nome: 'Ana', setores: ['suporte'], ativo: true, disponivel: true });
  await setDoc(doc(db, 'wa_equipe/at2'), { nome: 'Bia', setores: ['comercial'], ativo: false, disponivel: true });
  await setDoc(doc(db, 'wa_conversas/5567999990000'), { estado: 'atendente', atribuido_uid: 'at1' });
  await setDoc(doc(db, 'wa_conversas/5567999990000/mensagens/a'), { de: 'pessoa', texto: 'oi' });
  await setDoc(doc(db, 'wa_chamados/c1'), { status: 'aberto', descricao: 'x' });
  await setDoc(doc(db, 'wa_config/geral'), { ligado: true });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
await t('admin lê conversas', assertSucceeds(getDocs(collection(fs('adm'), 'wa_conversas'))));
await t('membro ativo lê conversas', assertSucceeds(getDocs(collection(fs('at1'), 'wa_conversas'))));
await t('membro ativo lê mensagens', assertSucceeds(getDocs(collection(fs('at1'), 'wa_conversas/5567999990000/mensagens'))));
await t('membro ativo lê a equipe', assertSucceeds(getDocs(collection(fs('at1'), 'wa_equipe'))));
await t('membro ativo marca chamado resolvido', assertSucceeds(updateDoc(doc(fs('at1'), 'wa_chamados/c1'), { status: 'resolvido' })));
await t('membro liga/desliga o próprio disponível', assertSucceeds(updateDoc(doc(fs('at1'), 'wa_equipe/at1'), { disponivel: false })));
await t('membro registra o próprio aparelho para notificação', assertSucceeds(updateDoc(doc(fs('at1'), 'wa_equipe/at1'), { tokens: ['tok1'] })));
await t('no máximo 10 aparelhos', assertFails(updateDoc(doc(fs('at1'), 'wa_equipe/at1'), { tokens: Array.from({ length: 11 }, (_, i) => 't' + i) })));
await t('membro não muda os próprios setores', assertFails(updateDoc(doc(fs('at1'), 'wa_equipe/at1'), { setores: ['comercial'] })));
await t('membro não mexe no outro', assertFails(updateDoc(doc(fs('at1'), 'wa_equipe/at2'), { disponivel: false })));
await t('membro não muda a configuração', assertFails(setDoc(doc(fs('at1'), 'wa_config/geral'), { ligado: false })));
await t('membro não grava conversa', assertFails(setDoc(doc(fs('at1'), 'wa_conversas/5567999990000'), { estado: 'menu' })));
await t('membro inativo não lê conversas', assertFails(getDocs(collection(fs('at2'), 'wa_conversas'))));
await t('professor não lê conversas', assertFails(getDoc(doc(fs('p1'), 'wa_conversas/5567999990000'))));
await t('professor não lê a equipe', assertFails(getDocs(collection(fs('p1'), 'wa_equipe'))));
await t('professor não se cadastra na equipe', assertFails(setDoc(doc(fs('p1'), 'wa_equipe/p1'), { ativo: true, setores: ['suporte'] })));
await t('admin cadastra equipe só pela função', assertFails(setDoc(doc(fs('adm'), 'wa_equipe/p1'), { ativo: true })));
console.log((falha ? '::error::' : '::notice::') + 'WhatsApp: ' + ok + ' ok, ' + falha + ' falha(s)');
await env.cleanup();
process.exit(falha ? 1 : 0);

// Grava o WhatsApp de avisos do Alan na equipe de atendimento (pedido dele, 04/11/2026). Sem dado pessoal no log.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const sn = await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(2).get();
if (sn.size !== 1) { console.log('::error::cadastro não encontrado ou duplicado (' + sn.size + ')'); process.exit(1); }
const u = sn.docs[0], ud = u.data(), ref = db.doc('wa_equipe/' + u.id), antes = await ref.get();
const base = { whatsapp_aviso: '67998104121', avisos_wa: true, atualizado_em: FieldValue.serverTimestamp() };
if (antes.exists) await ref.set(base, { merge: true });
else await ref.set({ ...base, nome: ud.nome || 'Alan', email: ud.email, setores: ['suporte', 'tecnico', 'comercial'], ativo: true, disponivel: true, criado_em: FieldValue.serverTimestamp(), ultimo_em: Timestamp.fromMillis(0) });
await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), acao: 'alterou', origem: 'funcao', colecao: 'wa_equipe', doc: u.id, autor_uid: '', autor_tipo: 'sistema', autor_email: '', perfil: 'whatsapp', detalhe: 'Equipe de atendimento: WhatsApp para avisos cadastrado a pedido do próprio membro', campos: ['whatsapp_aviso'], valores: {} });
const eq = await db.collection('wa_equipe').where('ativo', '==', true).get();
console.log('::notice::' + (antes.exists ? 'atualizado' : 'criado na equipe (suporte, técnico, comercial)') + ' · equipe ativa: ' + eq.size + ' · com aviso no WhatsApp: ' + eq.docs.filter(d => d.data().whatsapp_aviso).length);

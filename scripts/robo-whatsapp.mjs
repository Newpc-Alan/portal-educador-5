// Robô do WhatsApp: configuração e situação. Não imprime nome, número nem texto de conversa (o log do GitHub é público).
//   node scripts/robo-whatsapp.mjs configurar   (PNID e LIGADO no ambiente)
//   node scripts/robo-whatsapp.mjs situacao
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: process.env.PROJETO || 'portal-educador-5' });
const db = getFirestore(), ref = db.doc('wa_config/geral'), acao = process.argv[2];

if (acao === 'configurar') {
  const pnid = String(process.env.PNID || '').trim(), ligado = process.env.LIGADO === 'true';
  if (pnid && !/^\d{10,20}$/.test(pnid)) { console.log('ERRO: a identificação do número tem só dígitos (copie do painel da Meta)'); process.exit(1); }
  const atual = (await ref.get()).data() || {};
  if (ligado && !pnid && !atual.phone_number_id) { console.log('ERRO: para ligar, informe a identificação do número'); process.exit(1); }
  await ref.set({ ...(pnid ? { phone_number_id: pnid } : {}), ligado, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  console.log('Robô ' + (ligado ? 'LIGADO' : 'desligado') + ' · número ' + (pnid || atual.phone_number_id || '-'));
} else {
  const c = (await ref.get()).data() || {};
  const [conv, fila, cham, abertos, base] = await Promise.all([
    db.collection('wa_conversas').count().get(), db.collection('wa_conversas').where('estado', '==', 'atendente').count().get(),
    db.collection('wa_chamados').count().get(), db.collection('wa_chamados').where('status', '==', 'aberto').count().get(),
    db.collection('bot_conhecimento').count().get()]);
  console.log('Robô ' + (c.ligado ? 'LIGADO' : 'desligado') + ' · número ' + (c.phone_number_id || 'não configurado'));
  console.log('Conversas: ' + conv.data().count + ' · aguardando atendente: ' + fila.data().count);
  console.log('Chamados: ' + cham.data().count + ' · abertos: ' + abertos.data().count);
  console.log('Base de conhecimento: ' + base.data().count + ' trechos');
}

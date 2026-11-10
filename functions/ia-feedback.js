// "A IA errou aqui" (nov/2026). Diretrizes CNE/MEC de IA na educação: acompanhar erros e vieses da IA.
// O professor aponta o problema num recurso com IA; fica em ia_feedback (só o administrador lê e marca como tratado).
// Sem dado de aluno: o texto é curto, números de CPF são apagados e o aviso pede para não escrever nomes.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { usoJustoDiario } from './creditos.js';

const RECURSOS = ['portal_ia', 'termometro', 'parecer', 'lousa', 'video', 'formacao', 'lara', 'outro'];
const TIPOS = ['conteudo', 'turma', 'vies', 'outro'];
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export const iaFeedback = onCall({ region: 'southamerica-east1', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const u = (await db.doc(`usuarios/${uid}`).get()).data();
  if (!u || u.status !== 'ativo' || u.perfil === 'aluno') throw new HttpsError('permission-denied', 'Cadastro inativo.');
  const recurso = RECURSOS.includes(d.recurso) ? d.recurso : 'outro', tipo = TIPOS.includes(d.tipo) ? d.tipo : 'outro';
  const uj = await usoJustoDiario(db, { uid, admin: u.perfil === 'admin', cfgRaw: {} }, 'ia_feedback', 30);
  if (!uj.ok) throw new HttpsError('resource-exhausted', 'Muitos avisos hoje. Obrigado! Fale com a NEWPC pelo WhatsApp se for urgente.');
  await db.collection('ia_feedback').add({
    uid, nome: txt(u.nome, 80), perfil: txt(u.perfil, 30), municipio_id: txt(u.municipio_id, 64), escola_id: txt(u.escola_id, 64),
    recurso, tipo, ref: txt(d.ref, 120).replace(/[^\w:.\-]/g, ''), pagina: txt(d.pagina, 120),
    texto: txt(d.texto, 500).replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[número retirado]'),
    status: 'novo', em: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

// Ficha do Aluno: fotos do cadastro (aluno e autorizados a buscar) têm prazo de guarda.
// Aluno transferido ou que concluiu: 1 ano depois da saída, as fotos são apagadas. A ficha e os documentos continuam.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const GUARDA_FOTOS_DIAS = 365;
const hojeMS = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const diasAtras = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - n); return t.toISOString().slice(0, 10); };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

// data em que o aluno saiu: campo saida_em (gravado pela ficha); cadastros antigos usam a última alteração
export function dataSaida(a) {
  if (typeof a.saida_em === 'string' && /^\d{4}-\d\d-\d\d$/.test(a.saida_em)) return a.saida_em;
  const t = a.atualizado_em && a.atualizado_em.toDate ? a.atualizado_em.toDate() : null;
  return t ? t.toISOString().slice(0, 10) : '';
}

export const limparFotosAlunos = onSchedule({ schedule: '40 3 * * 0', timeZone: 'America/Campo_Grande', region: 'southamerica-east1', timeoutSeconds: 540 }, async () => {
  const db = getFirestore(), bucket = getStorage().bucket(), hoje = hojeMS(), limite = diasAtras(hoje, GUARDA_FOTOS_DIAS);
  const sn = await db.collection('alunos').where('status', '==', 'inativo').get();
  let alunos = 0, arquivos = 0;
  for (const d of sn.docs) {
    const a = d.data(), esc = String(a.escola_id || '');
    if (a.fotos_apagadas_em || !ID.test(esc) || !ID.test(d.id)) continue;
    const saida = dataSaida(a);
    if (!saida || saida >= limite) continue;
    for (const pasta of ['fotos_alunos', 'fotos_autorizados']) {
      const [arqs] = await bucket.getFiles({ prefix: `${pasta}/${esc}/${d.id}/` });
      await Promise.all(arqs.map(f => f.delete().catch(() => {}))); arquivos += arqs.length;
    }
    await d.ref.update({ foto: '', fotos_apagadas_em: hoje });
    const au = db.doc(`alunos_autorizados/${d.id}`), sa = await au.get();
    if (sa.exists) await au.update({ lista: (sa.data().lista || []).map(x => ({ ...x, foto: '' })), atualizado_em: FieldValue.serverTimestamp(), atualizado_por: 'limpeza-automatica' });
    alunos++;
  }
  console.log('limparFotosAlunos', { limite, alunos, arquivos });
});

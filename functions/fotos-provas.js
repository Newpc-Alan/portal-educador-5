// Fotos de confirmação da prova online (início e entrega): o aluno envia direto para o Storage
//   provas_online/{prova}/fotos/{aluno}/{inicio|entrega}.jpg
// e só o professor da prova, a gestão da escola e o admin veem (storage.rules).
// Guarda: até o fim do ano letivo. Todo dia, de madrugada, apaga as fotos das provas de anos anteriores.
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const REGIAO = 'southamerica-east1';
// 1º de janeiro do ano corrente, 00:00 em Mato Grosso do Sul (UTC-4)
export const inicioDoAno = (agora = new Date()) => Date.UTC(new Date(agora.getTime() - 4 * 3600e3).getUTCFullYear(), 0, 1, 4);

// prazo das fotos de uma prova criada agora: 1º de janeiro do ano seguinte
export const fimDoAnoLetivo = (agora = new Date()) => Date.UTC(new Date(agora.getTime() - 4 * 3600e3).getUTCFullYear() + 1, 0, 1, 4);

// cada prova com fotos guarda "fotos_ate"; vencido o prazo, apaga a pasta e tira o campo (consulta de um campo só, sem índice composto)
export async function limpar({ db, bucket, agora = new Date(), lote = 200 }) {
  const s = await db.collection('provas_online').where('fotos_ate', '<', Timestamp.fromMillis(agora.getTime())).limit(lote).get();
  let n = 0;
  for (const d of s.docs) {
    await bucket.deleteFiles({ prefix: `provas_online/${d.id}/fotos/` }).catch(e => console.warn('fotos', d.id, e.message));
    await d.ref.update({ fotos_apagadas: true, fotos_apagadas_em: FieldValue.serverTimestamp(), fotos_ate: FieldValue.delete() });
    n++;
  }
  return n;
}

export const limparFotosProvas = onSchedule({ region: REGIAO, schedule: '15 3 * * *', timeZone: 'America/Campo_Grande', timeoutSeconds: 540 }, async () => {
  const n = await limpar({ db: getFirestore(), bucket: getStorage().bucket() });
  if (n) console.log('fotos de provas apagadas:', n);
});

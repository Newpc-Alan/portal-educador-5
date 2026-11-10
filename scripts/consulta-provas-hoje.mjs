// Provas online com janela nas últimas 36 h: id, turma, situação, horários e tentativas por situação. Só leitura, sem nomes de alunos.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const h = t => t && t.toDate ? t.toDate().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' }) : '-';
const sn = await db.collection('provas_online').where('fecha_em', '>=', Timestamp.fromMillis(Date.now() - 36 * 36e5)).get();
for (const d of sn.docs) {
  const p = d.data();
  const ts = await d.ref.collection('po_tentativas').get(), sala = await d.ref.collection('po_sala').get(), res = await d.ref.collection('po_resultados').get();
  const st = {}; ts.forEach(x => { const s = x.data().status; st[s] = (st[s] || 0) + 1; });
  const det = ts.docs.map(x => { const t = x.data(); return `${x.id.slice(0, 6)}… ${t.status} ini=${h(t.inicio)} ent=${h(t.entregue_em)} motivo=${t.motivo_entrega || '-'} resp=${Object.keys(t.respostas || {}).length}`; });
  console.log(`::notice::prova ${d.id} | "${p.titulo}" | turma=${p.turma_nome} | status=${p.status} aguardando=${!!p.aguardando} | abre=${h(p.abre_em)} fecha=${h(p.fecha_em)} | criada=${h(p.criado_em)} | alunos=${(p.alunos || []).length} | tentativas=${JSON.stringify(st)} sala=${sala.size} resultados=${res.size}`);
  det.forEach(l => console.log('::notice::   ' + l));
}
console.log(`::notice::${sn.size} prova(s) na janela`);

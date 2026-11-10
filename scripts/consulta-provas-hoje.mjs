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
  ts.docs.forEach(x => { const t = x.data();
    console.log(`::notice::   ${x.id.slice(0, 6)}… aparelho=${t.aparelho || '-'} trocas=${t.trocas || 0} desvios=${t.desvios || 0} prazo=${h(t.prazo)} conta=${String(t.conta_uid || '').slice(0, 6)}…`);
    (t.eventos || []).forEach(e => console.log(`::notice::      evento ${new Date(e.t).toLocaleTimeString('pt-BR', { timeZone: 'America/Campo_Grande' })} ${e.e}${e.m ? ' · ' + String(e.m).slice(0, 80) : ''}`)); });
  sala.docs.forEach(x => { const s0 = x.data(); const o = {}; Object.keys(s0).filter(k => !/nome/i.test(k)).forEach(k => { const v = s0[k]; o[k] = v && v.toDate ? h(v) : v; }); console.log(`::notice::   sala ${x.id.slice(0, 6)}… ${JSON.stringify(o).slice(0, 300)}`); });
}
console.log(`::notice::${sn.size} prova(s) na janela`);

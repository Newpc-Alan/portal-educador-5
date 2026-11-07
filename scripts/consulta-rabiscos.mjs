// SÓ LEITURA: rabiscos soltos em Meus trabalhos (Lousa com 1 página, até 2 traços de caneta e nada mais: sem texto, imagem ou PDF).
// Mesma regra que a Lousa usa hoje para não salvar rabisco solto. Não apaga nada.
// Log sem nomes nem títulos (LGPD, repositório público): só código curto do trabalho, data, traços e tamanho.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();
const sn = await db.collectionGroup('trabalhos').get();
let total = 0, aulas = 0, falhas = 0, semArquivo = 0; const achados = [], donos = new Set();
for (const d of sn.docs) {
  const t = d.data();
  if (t.tipo !== 'lousa') continue;
  total++;
  if (t.origem === 'aula') { aulas++; continue; }
  if (!t.arquivo) { semArquivo++; continue; }
  try {
    const [buf] = await bucket.file(t.arquivo).download();
    const txt = (t.formato === 'application/gzip' || /\.gz$/.test(t.arquivo)) ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
    const snap = JSON.parse(txt), pags = snap.paginas || [];
    if (pags.length !== 1) continue;
    const p = pags[0]; if ((p.pdfs && p.pdfs.length) || p.pdf) continue;
    const objs = (JSON.parse(p.json || '{}').objects) || [];
    if (objs.length < 3 && objs.every(o => o.type === 'path')) {
      const quando = t.atualizado_em || t.criado_em; const data = quando && quando.toDate ? quando.toDate().toISOString().slice(0, 10) : '?';
      achados.push({ cod: d.id.slice(0, 6), data, tracos: objs.length, kb: Math.round(buf.length / 1024) });
      donos.add(d.ref.parent.parent ? d.ref.parent.parent.id : '?');
    }
  } catch (e) { falhas++; }
}
achados.sort((a, b) => a.data < b.data ? -1 : 1);
console.log(`::notice::Lousa em Meus trabalhos: ${total} · Aulas IA/prontas: ${aulas} · sem arquivo: ${semArquivo} · falhas de leitura: ${falhas}`);
console.log(`::notice::Rabiscos soltos (1 página, até 2 traços): ${achados.length}, de ${donos.size} conta(s)`);
const traco0 = achados.filter(a => a.tracos === 0).length;
console.log(`::notice::Vazios (0 traços): ${traco0} · 1 traço: ${achados.filter(a => a.tracos === 1).length} · 2 traços: ${achados.filter(a => a.tracos === 2).length}`);
for (const a of achados) console.log(`${a.cod} · ${a.data} · ${a.tracos} traço(s) · ${a.kb} KB`);
process.exit(0);

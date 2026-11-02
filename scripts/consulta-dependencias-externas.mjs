// Só leitura: inventário de tudo que o Portal 5.0 ainda busca fora dele (endereços gravados no banco, por coleção).
// Ignora o próprio Storage, YouTube e coleções técnicas (auditoria, acessos, índice da busca).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const PULA = new Set(['auditoria', 'acessos_dia', 'busca_indice', 'buscas_mes', 'envio_lotes', 'comunicados_email', 'comunicados_pref', 'turma_presenca', 'logs', 'uso_ia', 'po_respostas']);
const IGN = /(firebasestorage\.googleapis\.com\/v0\/b\/portal-educador-5|portal-educador-5\.firebasestorage|youtube\.com|youtu\.be|ytimg\.com|youtube-nocookie|app\.portaldoeducador\.com\.br)/i;
const tab = {}; // host -> { n, col: {c:n}, ex:Set }
const varre = (v, col) => {
  if (typeof v === 'string') { for (const u of (v.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])) { if (IGN.test(u)) continue; const h = (u.match(/^https?:\/\/([^/?#]+)/i) || [])[1]; if (!h) continue; const k = h.toLowerCase(); const t = tab[k] = tab[k] || { n: 0, col: {}, ex: new Set() }; t.n++; t.col[col] = (t.col[col] || 0) + 1; if (t.ex.size < 3) t.ex.add(u.slice(0, 100)); } }
  else if (v && typeof v === 'object') Object.values(v).forEach(x => varre(x, col));
};
const cols = await db.listCollections(); let docs = 0;
for (const c of cols) {
  if (PULA.has(c.id)) continue;
  const s = await c.get(); docs += s.size;
  for (const d of s.docs) { varre(d.data(), c.id); if (['cursos', 'trilhas'].includes(c.id)) for (const sub of await d.ref.listCollections()) (await sub.get()).forEach(x => { docs++; varre(x.data(), c.id + '/' + sub.id); }); }
}
console.log('::notice::documentos varridos: ' + docs + ' em ' + cols.length + ' coleções');
for (const [h, t] of Object.entries(tab).sort((a, b) => b[1].n - a[1].n).slice(0, 45))
  console.log('::notice::' + h + ' (' + t.n + ') · ' + Object.entries(t.col).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => c + ':' + n).join(', ') + ' · ex: ' + [...t.ex][0]);
// botões do Início que apontam para fora
const mod = ((await db.doc('config/modulos').get()).data() || {}).itens || {};
for (const [k, m] of Object.entries(mod)) if (/^https?:/i.test(String(m.url || '')) && !/app\.portaldoeducador/.test(m.url)) console.log('::notice::botão "' + k + '" (' + (m.status || '?') + ') abre fora: ' + m.url);

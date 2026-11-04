// GRAVA: troca https://app.portaldoeducador.com.br/ por https://www.portaldoeducador.com.br/ nos campos que a varredura achou
// (catálogo de jogos, Biblioteca e campanhas da TV). O endereço antigo ainda redireciona, mas sem depender dele os links
// abrem mais rápido e não quebram se o app. for desligado. Só contagens no log.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), ANT = /https:\/\/app\.portaldoeducador\.com\.br\//gi, NOVA = 'https://www.portaldoeducador.com.br/';
const troca = v => typeof v === 'string' ? v.replace(ANT, NOVA) : Array.isArray(v) ? v.map(troca) : v && typeof v === 'object' && !v.toDate && !v._path ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, troca(x)])) : v;
for (const [col, campos] of [['jogos', ['url']], ['biblioteca', ['paginas', 'capa_url']], ['tv_campanhas', ['itens']]]) {
  const s = await db.collection(col).get(); let n = 0;
  for (const d of s.docs) {
    const x = d.data(), upd = {};
    campos.forEach(c => { if (x[c] !== undefined) { const novo = troca(x[c]); if (JSON.stringify(novo) !== JSON.stringify(x[c])) upd[c] = novo; } });
    if (Object.keys(upd).length) { await d.ref.update(upd); n++; }
  }
  console.log('::notice::' + col + ': ' + n + ' documento(s) corrigido(s) de ' + s.size);
}
process.exit(0);

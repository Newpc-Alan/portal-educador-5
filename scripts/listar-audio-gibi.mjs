// Resumo da triagem de Audiolivros e Gibiteca (Drive antigo) para decidir o que pode subir.
// node listar-audio-gibi.mjs   -> imprime contagens, pastas e todos os títulos "revisar" e "dominio-publico"
import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' }));
const s = await db.collection('biblioteca_triagem').where('secao', 'in', ['audiolivros', 'gibiteca']).get();
const l = s.docs.map(d => ({ id: d.id, ...d.data() }));
const conta = (f) => l.reduce((o, x) => { const k = f(x); o[k] = (o[k] || 0) + 1; return o; }, {});
console.log('TOTAL', l.length, JSON.stringify(conta(x => `${x.secao}|${x.sugestao}|${x.status}`)));
for (const sec of ['audiolivros', 'gibiteca']) {
  console.log(`\n== ${sec}: pastas`, JSON.stringify(conta(x => x.secao === sec ? (x.pasta || '(raiz)') : null)));
  l.filter(x => x.secao === sec && x.sugestao !== 'comercial').sort((a, b) => (a.pasta || '').localeCompare(b.pasta || '') || a.titulo.localeCompare(b.titulo))
    .forEach(x => console.log(`${sec === 'audiolivros' ? 'A' : 'G'} | ${x.sugestao} | ${x.tipo} | ${Math.round((x.tamanho || 0) / 1e6)}MB | ${x.pasta || ''} | ${x.titulo}`));
}

// Só leitura: como os documentos do acervo apontam para os arquivos (para montar o mapa Firebase -> Nextcloud).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), L = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
const conta = (arr, k) => { const m = {}; arr.forEach(x => { const v = Array.isArray(x[k]) ? x[k].join('+') : String(x[k] ?? '-'); m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([a, b]) => a + ' ' + b).join(', '); };
const camposUrl = d => Object.entries(d).filter(([k, v]) => typeof v === 'string' && v.includes('firebasestorage')).map(([k, v]) => k + '=' + decodeURIComponent((v.split('/o/')[1] || '').split('?')[0]).slice(0, 60)).join(' ; ');
for (const [col, ks] of [['atividades', ['etapa', 'componente', 'tipo', 'categoria']], ['biblioteca', ['tipo', 'categoria', 'genero', 'formato']], ['colorir', ['categoria', 'tema', 'etapa']], ['aulas', ['curso_id', 'tipo']], ['cursos', ['tipo']]]) {
  const s = await db.collection(col).get(), ds = s.docs.map(d => d.data());
  L(col + ' ' + ds.length + ' docs · campos: ' + [...new Set(ds.flatMap(d => Object.keys(d)))].join(','));
  for (const k of ks) L('  ' + col + '.' + k + ': ' + conta(ds, k));
  ds.slice(0, 2).forEach(d => L('  ex: ' + camposUrl(d) + ' | titulo=' + (d.titulo || d.nome || '') ));
}
const [fs] = await getStorage().bucket().getFiles({ prefix: 'materiais/', maxResults: 6 });
L('materiais/: ' + fs.map(f => f.name).join(' ; '));
const [fs2] = await getStorage().bucket().getFiles({ prefix: 'biblioteca/', maxResults: 6 });
L('biblioteca/: ' + fs2.map(f => f.name).join(' ; '));

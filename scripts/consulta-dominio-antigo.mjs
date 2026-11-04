// Varredura (somente leitura): onde o banco ainda guarda o endereço antigo app.portaldoeducador.com.br
// (links de catálogo, logos, imagens, notícias, configurações). Percorre todas as coleções de nível 1 e as subcoleções
// de primeiro nível. Mostra só coleção, campo e contagem (nunca o conteúdo: o log do Actions é público).
// Também confere os domínios autorizados do login (Firebase Authentication).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const app = initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), ALVO = /app\.portaldoeducador\.com\.br/i;
const achados = {}; let docsLidos = 0;
function varrer(v, caminho, onde) {
  if (typeof v === 'string') { if (ALVO.test(v)) { const k = onde + ' · ' + caminho.replace(/\.\d+/g, '[]'); achados[k] = (achados[k] || 0) + 1; } return; }
  if (Array.isArray(v)) { v.forEach((x, i) => varrer(x, caminho + '.' + i, onde)); return; }
  if (v && typeof v === 'object' && !v.toDate && !v._path) Object.entries(v).forEach(([k, x]) => varrer(x, caminho ? caminho + '.' + k : k, onde));
}
const PULAR = new Set(['auditoria', 'stats', 'uso_real', 'busca_indice', 'buscas_mes', 'wa_metricas', 'portal_ia_uso', 'ia_uso']);
const SUBS = new Set(['config', 'municipios', 'tv_campanhas', 'catalogos', 'acervo_rede', 'noticias']);
const cols = await db.listCollections();
for (const c of cols) {
  if (PULAR.has(c.id)) continue;
  let ult = null;
  for (;;) {
    let q = c.orderBy('__name__').limit(500); if (ult) q = q.startAfter(ult);
    const s = await q.get(); if (s.empty) break;
    for (const d of s.docs) { docsLidos++; varrer(d.data(), '', c.id);
      // subcoleções só nas coleções de configuração e catálogo (as de alunos e de uso são grandes e não guardam link)
      if (SUBS.has(c.id)) for (const sc of await d.ref.listCollections()) { const ss = await sc.limit(500).get(); ss.forEach(x => { docsLidos++; varrer(x.data(), '', c.id + '/*/' + sc.id); }); }
    }
    ult = s.docs[s.docs.length - 1]; if (s.size < 500) break;
  }
}
const l = Object.entries(achados).sort((a, b) => b[1] - a[1]);
console.log('::notice::documentos lidos: ' + docsLidos + ' · campos com o endereço antigo: ' + l.length + ' · ocorrências: ' + l.reduce((t, x) => t + x[1], 0));
l.slice(0, 60).forEach(([k, n]) => console.log('::notice::' + k + ' → ' + n));
// domínios autorizados do login
try {
  const tok = (await app.options.credential.getAccessToken()).access_token;
  const r = await fetch('https://identitytoolkit.googleapis.com/admin/v2/projects/portal-educador-5/config', { headers: { Authorization: 'Bearer ' + tok, 'x-goog-user-project': 'portal-educador-5' } });
  const j = await r.json(); console.log('::notice::login · domínios autorizados: ' + JSON.stringify(j.authorizedDomains || j.error && j.error.status));
} catch (e) { console.log('::notice::login: não consegui ler (' + e.message + ')'); }
process.exit(0);

// Verificação de disponibilidade do Portal (nov/2026), rodada de fora do Google pelo GitHub Actions a cada 15 minutos.
// Confere o site, a página do vídeo interativo, as funções e o banco. Grava o placar do mês em stats/disponibilidade_AAAAMM
// (é o número que comprova a meta de 99,5% do TR). Se algo falhar, o passo termina com erro e o GitHub avisa por e-mail.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const tempo = ms => AbortSignal.timeout(ms);
async function conferir(nome, fn) {
  // até 2 tentativas: uma oscilação de rede do próprio GitHub não conta como queda do Portal
  for (let t = 0; t < 2; t++) {
    const t0 = Date.now();
    try { const ok = await fn(); if (ok === true) return { nome, ok: true, ms: Date.now() - t0 }; if (t) return { nome, ok: false, motivo: String(ok) }; }
    catch (e) { if (t) return { nome, ok: false, motivo: e.name === 'TimeoutError' ? 'sem resposta em 20 s' : e.message }; }
    await new Promise(r => setTimeout(r, 5000));
  }
}
const site = 'https://www.portaldoeducador.com.br';
const testes = await Promise.all([
  conferir('site (entrar)', async () => { const r = await fetch(site + '/entrar/', { signal: tempo(20000) }); const h = await r.text(); return r.ok && /Portal do Educador/.test(h) || 'HTTP ' + r.status; }),
  conferir('vídeo interativo', async () => { const r = await fetch(site + '/video/', { signal: tempo(20000) }); return r.ok || 'HTTP ' + r.status; }),
  // função sem login: tem que responder "não autenticado" (prova que está no ar)
  conferir('funções', async () => { const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/videoIa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}', signal: tempo(20000) });
    const j = await r.json().catch(() => ({})); return (j.error && j.error.status === 'UNAUTHENTICATED') || 'HTTP ' + r.status; }),
  conferir('banco de dados', async () => { const s = await db.doc('config/portal_ia').get(); return s.exists || 'config não encontrada'; })
]);
const falhas = testes.filter(t => !t.ok);
const agora = new Date(Date.now() - 4 * 3600e3), mes = agora.toISOString().slice(0, 7).replace('-', ''), dia = agora.toISOString().slice(0, 10);
const ref = db.doc(`stats/disponibilidade_${mes}`);
await ref.set({ verificacoes: FieldValue.increment(1), falhas: FieldValue.increment(falhas.length ? 1 : 0), atualizado_em: FieldValue.serverTimestamp(),
  ...(falhas.length ? { ultimas_falhas: FieldValue.arrayUnion({ dia, quando: agora.toISOString().slice(0, 16).replace('T', ' '), o_que: falhas.map(f => f.nome + ': ' + f.motivo).join('; ').slice(0, 300) }) } : {}) }, { merge: true });
console.log(testes.map(t => (t.ok ? 'ok ' : 'FALHOU ') + t.nome + (t.ok ? ' (' + t.ms + ' ms)' : ' · ' + t.motivo)).join('\n'));
if (falhas.length) { console.log('::error::Portal com problema: ' + falhas.map(f => f.nome + ' · ' + f.motivo).join('; ')); process.exit(1); }

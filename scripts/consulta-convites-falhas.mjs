// Só leitura: motivo das falhas dos comunicados (agrupa a mensagem de erro do servidor de e-mail; mostra só o domínio, nunca o e-mail inteiro).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const cs = await db.collection('comunicados_email').orderBy('criado_em', 'desc').limit(10).get();
const motivo = {}, dominio = {}, hora = {};
for (const c of cs.docs) {
  for (const l of (await c.ref.collection('envio_lotes').get()).docs) for (const f of (l.data().falhas || [])) {
    const m = String(f.erro || '').replace(/[\w.+-]+@[\w.-]+/g, '<e-mail>').replace(/\d{3,}/g, n => n.length === 3 ? n : '#').slice(0, 110);
    motivo[m] = (motivo[m] || 0) + 1;
    const d = String(f.email || '').split('@')[1] || '?'; dominio[d] = (dominio[d] || 0) + 1;
  }
}
Object.entries(motivo).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([m, n]) => console.log('::notice::' + n + ' × ' + m.replace(/[{}"]/g, ' ')));
Object.entries(dominio).sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log('::notice::domínio ' + d + ': ' + n + ' falha(s)'));

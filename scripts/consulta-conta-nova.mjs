// Contas criadas nas últimas 24 h (autocadastro): licença, plano e créditos. Só leitura; no log vai só o primeiro nome e o domínio do e-mail.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const ms = v => v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : Date.parse(v || '') || 0);
const desde = Timestamp.fromMillis(Date.now() - 864e5);
const s = await db.collection('usuarios').where('criado_em', '>=', desde).get();
const cfg = (await db.doc('config/portal_ia').get()).data() || {};
console.log('::notice::config creditos: demo_teste=' + JSON.stringify((cfg.creditos || {}).demo_teste ?? cfg.demo_teste) + ' gratuito_mes=' + JSON.stringify((cfg.creditos || {}).gratuito_mes));
for (const d of s.docs) {
  const u = d.data(); if (u.perfil === 'aluno') continue;
  const c = (await db.doc('creditos/prof_' + d.id).get()).data() || {};
  console.log('::notice::' + String(u.nome || '?').split(' ')[0] + ' @' + String(u.email || '').split('@')[1] + ' · perfil ' + u.perfil + ' · licenca ' + u.licenca_tipo + '/' + (u.licenca_plano || '') + ' · plano_avulso ' + (u.plano_avulso || '-') +
    ' · fim ' + new Date(ms(u.licenca_fim)).toISOString().slice(0, 10) + ' · municipio ' + (u.municipio_id ? 'sim' : 'não') + ' · saldo ' + (c.saldo ?? '-') + ' · pacotes ' + JSON.stringify((c.pacotes || []).map(p => ({ o: p.origem, n: p.creditos, r: p.restante, v: new Date(ms(p.validade)).toISOString().slice(0, 10) }))));
}

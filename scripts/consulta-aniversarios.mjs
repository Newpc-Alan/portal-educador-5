// Aniversariantes de hoje e dos próximos 7 dias (professores e equipe ativos). Só leitura.
// No log público vai só o primeiro nome, o perfil e se tem e-mail/WhatsApp (sem sobrenome, e-mail, telefone ou data completa).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const s = await db.collection('usuarios').where('status', '==', 'ativo').select('nome', 'email', 'whatsapp', 'nascimento', 'perfil', 'municipio_id', 'demo').get();
const base = Date.now() - 4 * 3600e3, dias = [...Array(8)].map((_, i) => new Date(base + i * 864e5).toISOString().slice(5, 10));
let comData = 0, ativos = 0; const achou = [];
s.forEach(d => { const u = d.data(); if (u.perfil === 'aluno' || u.demo === true || u.municipio_id === 'lab-muni' || String(u.email || '').endsWith('@portaldoeducador.com.br')) return; ativos++;
  if (!/^\d{4}-\d\d-\d\d$/.test(u.nascimento || '')) return; comData++;
  const i = dias.indexOf(u.nascimento.slice(5)); if (i >= 0) achou.push({ i, txt: String(u.nome || '?').trim().split(/\s+/)[0] + ' · ' + u.perfil + ' · ' + (u.email ? 'e-mail' : 'sem e-mail') + ' · ' + (u.whatsapp ? 'WhatsApp' : 'sem WhatsApp') }); });
console.log(`::notice::${ativos} professores/equipe ativos · ${comData} com data de nascimento no cadastro`);
achou.sort((a, b) => a.i - b.i).forEach(a => console.log(`::notice::${a.i === 0 ? 'HOJE' : 'em ' + a.i + ' dia(s) (' + dias[a.i].split('-').reverse().join('/') + ')'}: ${a.txt}`));
if (!achou.length) console.log('::notice::Nenhum aniversariante hoje nem nos próximos 7 dias.');

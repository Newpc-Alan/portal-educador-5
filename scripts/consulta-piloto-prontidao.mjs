// Só leitura: prontidão de cada rede para o piloto em escola real. Números agregados por rede e por escola
// (escolas, turmas, alunos, professores com conta, pré-cadastros, quem entrou nos últimos 7/30 dias). Nenhum nome de pessoa.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 900)), agora = Date.now(), D = 864e5;
const ms = t => (t && t.toMillis ? t.toMillis() : typeof t === 'number' ? t : 0);
const [mus, es, ts, als, us, pcs] = await Promise.all([db.collection('municipios').get(), db.collection('escolas').select('nome', 'municipio_id').get(),
  db.collection('turmas').select('municipio_id', 'escola_id').get(), db.collection('alunos').select('municipio_id', 'escola_id', 'status').get(),
  db.collection('usuarios').select('municipio_id', 'perfil', 'status', 'ultimo_acesso', 'escolas_ids', 'escola_id', 'licenca_tipo').get(),
  db.collection('pre_cadastros').select('municipio_id', 'escola_id').get().catch(() => ({ docs: [] }))]);
const R = {};
const r = id => R[id] || (R[id] = { escolas: 0, turmas: 0, alunos: 0, prof: 0, prof7: 0, prof30: 0, gestao: 0, pre: 0, porEsc: {} });
const pe = (id, e) => { const x = r(id).porEsc; return x[e] || (x[e] = { turmas: 0, alunos: 0, prof: 0, prof30: 0 }); };
es.forEach(d => r(d.data().municipio_id || '-').escolas++);
ts.forEach(d => { const t = d.data(); r(t.municipio_id || '-').turmas++; if (t.escola_id) pe(t.municipio_id, t.escola_id).turmas++; });
als.forEach(d => { const a = d.data(); if (a.status === 'inativo') return; r(a.municipio_id || '-').alunos++; if (a.escola_id) pe(a.municipio_id, a.escola_id).alunos++; });
us.forEach(d => { const u = d.data(); if (u.status !== 'ativo') return; const x = r(u.municipio_id || '-'), ua = ms(u.ultimo_acesso);
  if (u.perfil === 'professor') { x.prof++; if (agora - ua < 7 * D) x.prof7++; if (agora - ua < 30 * D) x.prof30++;
    for (const e of (u.escolas_ids && u.escolas_ids.length ? u.escolas_ids : [u.escola_id]).filter(Boolean)) { pe(u.municipio_id, e).prof++; if (agora - ua < 30 * D) pe(u.municipio_id, e).prof30++; } }
  else if (['gestor', 'secretaria', 'coordenador', 'secretario_escolar'].includes(u.perfil)) x.gestao++; });
pcs.docs.forEach(d => r(d.data().municipio_id || '-').pre++);
const nomeE = {}; es.forEach(d => nomeE[d.id] = d.data().nome);
for (const d of mus.docs) {
  const m = d.data(), x = R[d.id]; if (!x || m.status === 'inativo') continue;
  aviso(`${m.nome} [${m.tipo_rede || 'municipal'} · ${m.status || '-'}]: ${x.escolas} escolas, ${x.turmas} turmas, ${x.alunos} alunos · professores com conta ${x.prof} (entraram 7d ${x.prof7} · 30d ${x.prof30}) · gestão ${x.gestao} · pré-cadastros ${x.pre}`);
  if (/ribas/i.test(m.nome || '')) Object.entries(x.porEsc).sort((a, b) => b[1].prof - a[1].prof).forEach(([e, v]) => aviso(`   Ribas · ${nomeE[e] || e}: ${v.turmas} turmas, ${v.alunos} alunos, ${v.prof} professores (30d ${v.prof30})`));
}
process.exit(0);

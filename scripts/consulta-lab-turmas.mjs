// Laboratório NEWPC (escola lab-es): turmas, grade e professores de teste. Leitura; com GRAVAR=1 cria as turmas B que faltam
// (mesmo ano da turma A) e distribui os professores de teste na grade. Professores só por apelido no log.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 900));
const apel = {}; let n = 0; const P = uid => uid ? (apel[uid] = apel[uid] || 'P' + (++n)) : '-';
const ts = (await db.collection('turmas').where('escola_id', '==', 'lab-es').get()).docs.map(d => ({ id: d.id, ...d.data() }));
ts.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
for (const t of ts) aviso(`${t.id}: ${t.nome} | ano ${t.ano_serie || '-'} | status ${t.status || '-'} | grade: ${(t.grade || []).map(g => (g.disciplina || '?') + '=' + P(g.professor_uid)).join(', ') || '-'} | campos: ${Object.keys(t).sort().join(',')}`);
const us = (await db.collection('usuarios').where('escola_id', '==', 'lab-es').get()).docs.map(d => ({ id: d.id, ...d.data() }));
for (const u of us) aviso(`${P(u.id)} perfil ${u.perfil} status ${u.status} turmas ${(u.turmas_ids || []).join('/')} disc ${(u.disciplinas || []).join('/')}`);
const al = await db.collection('alunos').where('escola_id', '==', 'lab-es').get();
const porT = {}; al.forEach(d => { const t = d.data().turma_id; porT[t] = (porT[t] || 0) + 1; }); aviso('alunos por turma: ' + JSON.stringify(porT));

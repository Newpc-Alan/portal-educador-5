// Laboratório NEWPC (lab-escola): cria as turmas B (5º ao 9º, lab-t5b ... lab-t9b) copiando a turma A do mesmo ano,
// põe a grade de teste no 6º Ano A (estava vazia) e nas turmas B, e liga as turmas novas aos professores da grade.
// Não move alunos nem apaga nada. Pode rodar de novo (só cria o que falta). Professores só por apelido no log.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).slice(0, 900));
const modelo = (await db.doc('turmas/lab-t5a').get()).data();
if (!modelo || !Array.isArray(modelo.grade) || !modelo.grade.length) { console.log('::error::lab-t5a sem grade para servir de modelo'); process.exit(1); }
const grade = modelo.grade.map(g => ({ ...g })), chaves = grade.map(g => g.professor_uid + '|' + g.disciplina);
const profs = [...new Set(grade.map(g => g.professor_uid))];
// 6º Ano A: estava sem grade (por isso a porta não tinha professor da turma para responder)
const t6 = await db.doc('turmas/lab-t6a').get();
if (t6.exists && !(t6.data().grade || []).length) { await t6.ref.set({ grade, grade_chaves: chaves, grade_em: FieldValue.serverTimestamp(), grade_por: 'script-lab', etapa: modelo.etapa || '', turma_letra: 'A', ano_serie: '6' }, { merge: true }); aviso('6º Ano A: grade de teste colocada'); }
const novas = [];
for (const n of [5, 6, 7, 8, 9]) {
  const id = `lab-t${n}b`, ja = await db.doc('turmas/' + id).get();
  if (ja.exists) { aviso(id + ' já existe'); continue; }
  const a = (await db.doc(`turmas/lab-t${n}a`).get()).data() || modelo;
  const { atualizado_em, atualizado_por, grade_em, grade_por, grade_por_nome, ...base } = a;
  await db.doc('turmas/' + id).set({ ...base, id, nome: `${n}º Ano B`, turma_letra: 'B', ano_serie: String(n), lab: true, grade, grade_chaves: chaves,
    grade_em: FieldValue.serverTimestamp(), grade_por: 'script-lab', criado_em: FieldValue.serverTimestamp(), criado_por: 'script-lab', status: 'ativa' });
  novas.push(id); aviso(`${id}: ${n}º Ano B criada (turno ${a.turno || '-'}, sem alunos)`);
}
// as turmas novas entram no cadastro dos professores da grade (e o 6º A, para quem ainda não tinha)
for (const uid of profs) await db.doc('usuarios/' + uid).set({ turmas_ids: FieldValue.arrayUnion('lab-t6a', ...novas) }, { merge: true });
aviso('Professores da grade atualizados: ' + profs.length + ' · turmas novas: ' + (novas.join(', ') || 'nenhuma'));

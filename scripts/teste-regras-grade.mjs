// Testa a grade das turmas (turmas/{id}.grade) no emulador: a Direção e a Secretaria da escola gravam só a grade, da própria escola.
//   firebase emulators:exec --only firestore --project demo-pe5 "node scripts/teste-regras-grade.mjs firestore.rules"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-pe5', firestore: { rules: readFileSync(process.argv[2], 'utf8'), host, port: Number(port) } });
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'usuarios/g1'), { perfil: 'gestor', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/se1'), { perfil: 'secretaria_escolar', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/g2'), { perfil: 'gestor', status: 'ativo', escola_id: 'e2', escolas_ids: ['e2'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/po'), { perfil: 'portaria', status: 'ativo', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'usuarios/p1'), { perfil: 'professor', status: 'ativo', licenca_tipo: 'institucional', escola_id: 'e1', escolas_ids: ['e1'], municipio_id: 'm1' });
  await setDoc(doc(db, 'turmas/t1'), { nome: '6º Ano A', escola_id: 'e1', municipio_id: 'm1', criado_por: 'outro' });
});
let ok = 0, falha = 0;
const t = async (nome, p) => { try { await p; ok++; } catch (e) { falha++; console.log('::error::FALHA: ' + nome + ' | ' + String(e.message).split('\n')[0]); } };
const fs = uid => env.authenticatedContext(uid, { email: uid + '@x.com', email_verified: true }).firestore();
const grade = [{ disciplina: 'Ciências', disc_id: 'ciencias', professor_uid: 'p1', professor_nome: 'Júlia', dias: [2, 4] }];
await t('direção grava a grade', assertSucceeds(updateDoc(doc(fs('g1'), 'turmas/t1'), { grade, grade_por: 'g1' })));
await t('secretaria da escola grava a grade', assertSucceeds(updateDoc(doc(fs('se1'), 'turmas/t1'), { grade: [], grade_por: 'se1' })));
await t('direção não muda o nome da turma junto', assertFails(updateDoc(doc(fs('g1'), 'turmas/t1'), { grade, nome: 'Outra' })));
await t('direção de outra escola: não', assertFails(updateDoc(doc(fs('g2'), 'turmas/t1'), { grade })));
await t('portaria: não', assertFails(updateDoc(doc(fs('po'), 'turmas/t1'), { grade })));
await t('professor que não criou a turma: não', assertFails(updateDoc(doc(fs('p1'), 'turmas/t1'), { grade })));
await t('grade grande demais: não', assertFails(updateDoc(doc(fs('g1'), 'turmas/t1'), { grade: Array.from({ length: 31 }, () => grade[0]) })));
await t('grade precisa ser lista', assertFails(updateDoc(doc(fs('g1'), 'turmas/t1'), { grade: 'x' })));
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'notas_planilhas/p1_t1_ciencias_2026'), { professor_uid: 'p1', escola_id: 'e1', municipio_id: 'm1', turma_id: 't1' }); });
await t('secretaria da escola lê as notas (boletim)', assertSucceeds(getDoc(doc(fs('se1'), 'notas_planilhas/p1_t1_ciencias_2026'))));
await t('secretaria da escola não grava notas', assertFails(setDoc(doc(fs('se1'), 'notas_planilhas/se1_t1_ciencias_2026'), { professor_uid: 'se1', escola_id: 'e1', municipio_id: 'm1', turma_id: 't1' })));
await t('portaria não lê as notas', assertFails(getDoc(doc(fs('po'), 'notas_planilhas/p1_t1_ciencias_2026'))));
const ne = (o) => ({ escola_id: 'e1', municipio_id: 'm1', turma_id: 't1', turma_nome: '6º Ano A', disciplina: 'Arte', disc_id: 'arte', ano_letivo: 2026, notas: { a1: { 1: 7 } }, faltas: {}, aulas: { 1: 10 }, ...o });
await t('secretaria da escola lança nota do diário', assertSucceeds(setDoc(doc(fs('se1'), 'notas_escola/e1_t1_arte_2026'), ne())));
await t('direção lança nota do diário', assertSucceeds(setDoc(doc(fs('g1'), 'notas_escola/e1_t1_arte_2026'), ne({ notas: { a1: { 1: 8 } } }))));
await t('direção de outra escola não lança', assertFails(setDoc(doc(fs('g2'), 'notas_escola/e1_t1_arte_2026'), ne())));
await t('professor não lança pela escola', assertFails(setDoc(doc(fs('p1'), 'notas_escola/e1_t1_arte_2026'), ne())));
await t('id fora do padrão: não', assertFails(setDoc(doc(fs('se1'), 'notas_escola/qualquer'), ne())));
await t('campo estranho: não', assertFails(setDoc(doc(fs('se1'), 'notas_escola/e1_t1_arte_2026'), ne({ conselho: {} }))));
await t('portaria não lê', assertFails(getDoc(doc(fs('po'), 'notas_escola/e1_t1_arte_2026'))));
console.log(`grade: ${ok} ok, ${falha} falha(s)`);
await env.cleanup(); process.exit(falha ? 1 : 0);

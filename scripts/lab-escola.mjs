// Escola de laboratório NEWPC: contas reais de teste (e-mails @portaldoeducador.com.br) numa turma de 30 alunos fictícios.
// Roda pelo GitHub Actions (workflow "Escola de laboratório"), na pasta functions:
//   node ../scripts/lab-escola.mjs --diagnostico    só lê: escolas com "NEWPC" no nome e a situação das 9 contas (não grava nada)
// O resultado sai como avisos (::notice::) no resumo da execução, porque o log completo não é baixado daqui.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();

export const CONTAS = [
  ['prof.matematica@portaldoeducador.com.br', 'professor', 'Matemática'],
  ['prof.portugues@portaldoeducador.com.br', 'professor', 'Língua Portuguesa'],
  ['prof.historia@portaldoeducador.com.br', 'professor', 'História'],
  ['prof.ciencias@portaldoeducador.com.br', 'professor', 'Ciências'],
  ['direcao@portaldoeducador.com.br', 'gestor', 'Direção'],
  ['coordenacao@portaldoeducador.com.br', 'gestor', 'Coordenação'],
  ['secretaria.escola@portaldoeducador.com.br', 'secretaria_escolar', 'Secretaria da escola'],
  ['portaria@portaldoeducador.com.br', 'portaria', 'Portaria'],
  ['semed@portaldoeducador.com.br', 'secretaria', 'Secretaria de Educação']
];
const aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 900));

async function diagnostico() {
  const munis = {}; (await db.collection('municipios').get()).forEach(d => { munis[d.id] = d.data(); });
  const escolas = (await db.collection('escolas').get()).docs.filter(d => /newpc/i.test(d.data().nome || ''));
  const linhas = [];
  for (const d of escolas) {
    const e = d.data(), m = munis[e.municipio_id] || {};
    const [t, a] = await Promise.all([db.collection('turmas').where('escola_id', '==', d.id).count().get(), db.collection('alunos').where('escola_id', '==', d.id).count().get()]);
    linhas.push(`escola ${d.id} "${e.nome}" status=${e.status || '-'} · município ${e.municipio_id} "${m.nome || '?'}" plano=${m.plano_nome || '-'} demo=${!!m.demo} · ${t.data().count} turmas, ${a.data().count} alunos`);
  }
  aviso(`ESCOLAS COM NEWPC (${escolas.length}): ` + (linhas.join(' || ') || 'nenhuma'));
  const contas = [];
  for (const [email, perfil] of CONTAS) {
    const u = (await db.collection('usuarios').where('email', '==', email).limit(2).get()).docs[0];
    const p = (await db.doc(`pre_cadastros/${email}`).get()).exists;
    contas.push(`${email.split('@')[0]}: ${u ? `uid ${u.id} perfil=${u.data().perfil || '-'} status=${u.data().status || '-'} escola=${u.data().escola_id || '-'}` : 'ainda não entrou no Portal'}${p ? ' (tem pré-cadastro)' : ''}`);
  }
  aviso('CONTAS: ' + contas.join(' || '));
}

const cmd = process.argv[2];
if (cmd === '--diagnostico') await diagnostico();
else { console.log('Use --diagnostico'); process.exit(1); }

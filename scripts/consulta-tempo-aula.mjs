import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0', limpo = t => String(t).replace(/[{}"]/g, ' ');
let falhas = 0; const ok = (c, t) => { if (!c) falhas++; console.log('::notice::' + (c ? 'OK · ' : 'FALHOU · ') + limpo(t)); };
const tk = async (uid, claims) => (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid, claims), returnSecureToken: true }) })).json()).idToken;
const base = 'https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/';
// Tempo de aula (entrada por QR): professor abre com 30 min, prorroga 10, aluno da turma lê o fim da aula (outro não lê),
// a entrada pelo cartão dá sessão com via_qr; fechar encerra. Devolve a aula da turma como estava.
const call = async (nome, t, dados) => (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/' + nome, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify({ data: dados }) })).json();
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const tid = (prof.data().turmas_ids || [])[0], ref = db.doc('qr_aulas/' + tid), antes = (await ref.get()).data() || null;
const tP = await tk(prof.id);
const acesso = (await db.collection('alunos_acesso').where('turma_id', '==', tid).limit(5).get()).docs.find(d => d.data().qr_chave);
try {
  const t0 = Date.now(), r1 = await call('entradaQrTurma', tP, { turma_id: tid, acao: 'abrir', minutos: 30 });
  const d1 = r1.result && r1.result.aberta_ate - t0;
  ok(d1 > 29 * 60e3 && d1 < 31 * 60e3, 'abrir com 30 min: fecha em ' + Math.round(d1 / 60e3) + ' min');
  const r2 = await call('entradaQrTurma', tP, { turma_id: tid, acao: 'prorrogar', minutos: 10 });
  ok(r2.result && r2.result.aberta_ate - r1.result.aberta_ate === 10 * 60e3, 'prorrogar +10 min soma no fim da aula');
  const r9 = await call('entradaQrTurma', tP, { turma_id: tid, acao: 'abrir', minutos: 999 });
  ok(r9.result && Math.abs(r9.result.aberta_ate - Date.now() - 60 * 60e3) < 60e3, 'tempo acima de 6 horas vira 1 hora');
  const r8 = await call('entradaQrTurma', tP, { turma_id: tid, acao: 'abrir', minutos: 45 });
  ok(r8.result && Math.abs(r8.result.aberta_ate - Date.now() - 45 * 60e3) < 60e3, 'tempo personalizado de 45 min aceito');
  if (acesso) {
    const e = await call('entrarAlunoQr', null, { q: acesso.id + '.' + acesso.data().qr_chave });
    const s = e.result ? await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: e.result.token, returnSecureToken: true }) })).json() : {};
    const claims = s.idToken ? JSON.parse(Buffer.from(s.idToken.split('.')[1], 'base64url').toString()) : {};
    ok(claims.via_qr === true, 'entrada pelo cartão marca a sessão como via_qr (sai sozinha no fim da aula)');
    const l = await fetch(base + 'qr_aulas/' + tid, { headers: { Authorization: 'Bearer ' + s.idToken } });
    ok(l.status === 200, 'aluno da turma lê quando a aula acaba (HTTP ' + l.status + ')');
    const o = await fetch(base + 'qr_aulas/outra-turma-teste', { headers: { Authorization: 'Bearer ' + s.idToken } });
    ok(o.status === 403 || o.status === 404, 'aluno não lê a aula de outra turma (HTTP ' + o.status + ')');
  } else console.log('::notice::sem cartão de acesso gerado na turma: parte do aluno pulada');
  const r3 = await call('entradaQrTurma', tP, { turma_id: tid, acao: 'fechar' });
  ok(r3.result && r3.result.aberta_ate === 0, 'encerrar fecha a entrada na hora');
  if (acesso) { const e2 = await call('entrarAlunoQr', null, { q: acesso.id + '.' + acesso.data().qr_chave }); ok(e2.error && /fechada/.test(e2.error.message), 'com a aula encerrada, o cartão não entra'); }
} finally {
  if (antes) await ref.set(antes); else await ref.delete();
  console.log('::notice::aula da turma devolvida como estava');
}
process.exit(falhas ? 1 : 0);

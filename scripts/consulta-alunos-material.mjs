// Teste do "Enviar para os alunos" (Portal IA -> Materiais da turma) no Laboratório NEWPC:
// prof.ciencias envia um material de teste para uma turma dele; um aluno dessa turma lê com as regras; um aluno de outra turma não lê;
// o gestor do laboratório recebe as opções de envio da rede. No fim, apaga o item de teste.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 900));
const API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const tokenUid = async (uid, claims) => (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(uid, claims), returnSecureToken: true }) })).json()).idToken;
const chamar = async (tk, dados) => (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ data: dados }) })).json().catch(() => ({}));
let falhas = 0;
const prof = (await db.collection('usuarios').where('email', '==', 'prof.ciencias@portaldoeducador.com.br').limit(1).get()).docs[0];
const tkProf = await tokenUid(prof.id);
const ts = (await db.collection('turmas').where('escola_id', '==', prof.data().escola_id).get()).docs;
const minha = ts.find(t => (t.data().grade || []).some(g => g && g.professor_uid === prof.id)) || ts.find(t => (prof.data().turmas_ids || []).includes(t.id));
const outra = ts.find(t => minha && t.id !== minha.id);
if (!minha) { console.log('::error::prof.ciencias sem turma na grade'); process.exit(1); }
const mat = (await db.collection('portal_ia_docs').where('uid', '==', prof.id).limit(50).get()).docs.find(d => d.data().publico === 'aluno' && !['parecer', 'recado'].includes(d.data().tipo));
const r1 = await chamar(tkProf, { acao: 'enviar_turma', id: mat.id, turmas: [minha.id], html: '<h1>Teste do envio para a turma</h1><p>Material de teste do Portal IA, pode ignorar.</p><script>alert(1)</script><img src="x" onerror="alert(2)">', css: 'h1{color:#0f2c4a}' });
if (!r1.result) falhas++; aviso('envio para a turma ' + (minha.data().nome || minha.id) + ': ' + limpo(JSON.stringify(r1.result || r1.error)) + ' · material ' + mat.data().titulo);
const item = (await db.doc(`turma_materiais/${minha.id}/itens/${mat.id}`).get()).data() || {};
aviso('limpeza do HTML: script ' + (/<script/i.test(item.html) ? 'FICOU (erro)' : 'removido') + ' · onerror ' + (/onerror/i.test(item.html) ? 'FICOU (erro)' : 'removido'));
if (/<script|onerror/i.test(item.html)) falhas++;
const ler = async (tk, tid) => (await fetch(`https://firestore.googleapis.com/v1/projects/portal-educador-5/databases/(default)/documents/turma_materiais/${tid}/itens/${mat.id}`, { headers: { Authorization: 'Bearer ' + tk } })).status;
const alunoDa = async t => (await db.collection('alunos').where('turma_id', '==', t.id).limit(1).get()).docs[0];
const a1 = await alunoDa(minha);
if (a1) { const st = await ler(await tokenUid('teste-al-' + a1.id, { aluno_id: a1.id, escola_id: a1.data().escola_id || '', turma_id: minha.id }), minha.id); if (st !== 200) falhas++; aviso('aluno da turma lê o material: HTTP ' + st); }
if (outra) { const a2 = await alunoDa(outra);
  if (a2) { const st = await ler(await tokenUid('teste-al-' + a2.id, { aluno_id: a2.id, escola_id: a2.data().escola_id || '', turma_id: outra.id }), minha.id); if (st === 200) falhas++; aviso('aluno de OUTRA turma tenta ler: HTTP ' + st + (st === 403 ? ' (bloqueado, certo)' : ' (ERRO)')); } }
const gest = (await db.collection('usuarios').where('municipio_id', '==', 'lab-muni').where('perfil', '==', 'gestor').limit(1).get()).docs[0];
if (gest) { const r2 = await chamar(await tokenUid(gest.id), { acao: 'opcoes_envio' }); const o = r2.result || {};
  if (!o.rede) falhas++; aviso('opções do gestor: escolas ' + (o.escolas || []).length + ' · séries ' + (o.series || []).join(', ') + ' · disciplinas ' + (o.disciplinas || []).length + ' · turmas ' + o.turmas); }
const r3 = await chamar(tkProf, { acao: 'opcoes_envio' }); aviso('opções do professor (deve ser rede:false): ' + limpo(JSON.stringify(r3.result || r3.error)));
await db.doc(`turma_materiais/${minha.id}/itens/${mat.id}`).delete(); await getAuth().deleteUsers(['teste-al-' + (a1 && a1.id), 'teste-al-' + (outra && (await alunoDa(outra))?.id)].filter(Boolean)).catch(() => {});
aviso('item de teste apagado');
process.exit(falhas ? 1 : 0);

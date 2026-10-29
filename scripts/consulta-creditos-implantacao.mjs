// ATENÇÃO: este não é só leitura. Carga única de créditos de implantação do Portal IA (cortesia, 12 meses):
// 1.000 créditos para cada rede no plano Completo ou Intermediário que ainda não tem carteira. Entra como o administrador
// (alan@newpc.com.br) e usa a função creditosAdmin, para ficar registrado como qualquer outro lançamento. Rodar de novo não duplica.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"]/g, ' '), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const adm = await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get();
if (adm.empty || adm.docs[0].data().perfil !== 'admin') { console.log('::error::administrador não encontrado'); process.exit(1); }
const j1 = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(adm.docs[0].id), returnSecureToken: true }) })).json();
const ms = await db.collection('municipios').get();
let falhas = 0;
for (const m of ms.docs) {
  const d = m.data(); if (!['completo', 'intermediario', 'personalizado'].includes(d.plano_nome)) continue;
  const ja = await db.doc('creditos/mun_' + m.id).get();
  if (ja.exists && (ja.data().pacotes || []).length) { console.log('::notice::' + limpo(d.nome) + ': já tem carteira, nada a fazer'); continue; }
  const r = await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/creditosAdmin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + j1.idToken },
    body: JSON.stringify({ data: { acao: 'recarregar', conta: 'mun_' + m.id, creditos: 1000, meses: 12, obs: 'Cortesia de implantação do Portal IA' } }) });
  const j = await r.json().catch(() => ({}));
  if (j.result && j.result.ok) console.log('::notice::' + limpo(d.nome) + ' (' + d.plano_nome + '): 1.000 créditos lançados, válidos por 12 meses');
  else { falhas++; console.log('::error::' + limpo(d.nome) + ': ' + limpo((j.error || {}).message || r.status)); }
}
process.exit(falhas ? 1 : 0);

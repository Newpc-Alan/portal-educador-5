// Só leitura: quem tem a Lousa IA liberada (municípios e professores) e a chave geral.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const c = await db.doc('config/portal_ia').get();
console.log('::notice::chave geral: ' + limpo(JSON.stringify((c.exists && c.data().lousa) || 'padrao (basica ligada, ultra desligada)')));
const ms = await db.collection('municipios').get();
console.log('::notice::municipios: ' + limpo(ms.docs.map(d => (d.data().nome || d.id) + ' [' + ((d.data().recursos || []).join(',') || '-') + ']').join(' | ')));
const us = await db.collection('usuarios').where('recursos_extra', 'array-contains-any', ['lousa_ia', 'lousa_ia_ultra']).get();
console.log('::notice::professores liberados: ' + (us.size ? limpo(us.docs.map(d => (d.data().nome || '?') + ' (' + d.data().perfil + ', ' + (d.data().municipio_id ? 'rede' : 'avulso') + ') [' + d.data().recursos_extra.join(',') + ']').join(' | ')) : 'nenhum'));

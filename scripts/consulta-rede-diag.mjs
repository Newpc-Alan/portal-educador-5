// Diagnóstico: quem recebeu os e-mails do teste da moderação (lab-muni) e quais endereços são de grupo
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), aviso = t => console.log('::notice::' + String(t).replace(/\r?\n/g, ' | ').slice(0, 900));
const us = (await db.collection('usuarios').where('municipio_id', '==', 'lab-muni').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const por = {}; us.forEach(u => { const e = String(u.email || '').toLowerCase(); (por[e] = por[e] || []).push(u.perfil + ':' + (u.nome || '').split(' ')[0] + (u.status === 'ativo' ? '' : '(' + u.status + ')')); });
aviso('lab-muni: ' + us.length + ' contas');
for (const p of ['secretaria', 'gestor', 'professor']) aviso(p + ': ' + us.filter(u => u.perfil === p).map(u => (u.nome || '').split(' ')[0] + ' <' + u.email + '> ' + u.status + (u.escola_id ? ' esc ' + u.escola_id.slice(0, 6) : '')).join(' ; '));
const repetidos = Object.entries(por).filter(([e, l]) => l.length > 1).map(([e, l]) => e + ' = ' + l.join(','));
aviso('mesmo e-mail em mais de uma conta: ' + (repetidos.join(' ; ') || 'nenhum'));
const log = (await db.collection('rede_moderacao_log').orderBy('em', 'desc').limit(10).get()).docs.map(d => d.data().decisao + ' ' + d.data().titulo + ' por ' + d.data().nome);
aviso('últimas decisões: ' + (log.join(' ; ') || 'nenhuma'));

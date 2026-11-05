// Só leitura: quem está ligado à rede "Campo Grande/MS" (a escola de teste "Newpc Tecnologia Ltda"), antes de apagar a rede.
// Não imprime nome nem e-mail completo: só perfil, situação e o domínio do e-mail (a parte depois do @).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), M = 'SjTBI1ztvWAsbrOQAhX9', E = 'lFGnVPAAzeVYKcN1tSMM';
const us = await db.collection('usuarios').where('municipio_id', '==', M).select('perfil', 'status', 'email', 'licenca_tipo', 'escolas_ids', 'escola_id').get();
us.forEach(d => { const u = d.data(); console.log('::notice::usuário ' + (u.perfil || '-') + ' · ' + (u.status || '-') + ' · licença ' + (u.licenca_tipo || '-') + ' · domínio @' + String(u.email || '').split('@')[1] + ' · ligado à escola de teste: ' + ((u.escolas_ids || []).includes(E) || u.escola_id === E ? 'sim' : 'não')); });
const conta = async (c, f) => (await db.collection(c).where(f, '==', M).count().get()).data().count;
for (const c of ['escolas', 'turmas', 'alunos', 'rec_itens', 'tv_telas', 'provas_online', 'freq_chamadas', 'avisos_familia']) console.log('::notice::' + c + ': ' + await conta(c, 'municipio_id'));
process.exit(0);

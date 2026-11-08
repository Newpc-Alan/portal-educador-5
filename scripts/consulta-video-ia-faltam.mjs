// Só leitura: vídeos publicados do catálogo que ainda não têm versão interativa, com o motivo.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore();
const vs = (await db.collection('videos').where('publicado', '==', true).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(v => !v.interativo);
const mm = t => t ? Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') : 'sem duração';
const motivo = v => !v.duracao_seg ? 'sem duração' : v.duracao_seg < 90 ? 'curto' : v.duracao_seg > 600 ? 'longo' : /^(bebes|cbp)$/.test(v.faixa_de || '') ? 'bebês' : v.para_professores === false ? 'só alunos' : 'outro';
const linhas = vs.map(v => motivo(v) + ' · ' + v.titulo + ' (' + mm(v.duracao_seg) + ', ' + (v.faixa_de || '?') + ')').sort();
for (let i = 0; i < linhas.length; i += 8) console.log('::notice::' + linhas.slice(i, i + 8).join(' || ').replace(/[{}"]/g, ' '));
console.log('::notice::total sem interativo: ' + vs.length);

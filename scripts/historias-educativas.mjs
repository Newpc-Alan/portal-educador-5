// Histórias Educativas: traz as histórias ilustradas da página antiga (Webnode -> Google Drive) para a estante
// "Histórias Educativas" da Biblioteca do Portal 5.0 (Storage), com capa e leitor.
// Material próprio da NEWPC (licença confirmada por Alan em 25/10/2026).
// Uso no Cloud Shell (pasta scripts, com functions/node_modules instalado):
//   node historias-educativas.mjs            -> só lista o que vai entrar
//   node historias-educativas.mjs --gravar   -> cria a triagem e importa (cada PDF leva alguns segundos)
import { createRequire } from 'node:module';
const req = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = req('firebase-admin/app');
const { getFirestore, FieldValue } = req('firebase-admin/firestore');
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const { importarTitulo } = await import('../functions/biblioteca.js');

const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave pública das páginas antigas da Webnode
const REFERER = 'https://www.portaldoeducador.com.br/';
const PASTA = '1LPFEtv4si3MYvevTAQorM15xmPgqPGe-'; // pasta "Histórias educativas" no Drive do newpc.educador
const GRAVAR = process.argv.includes('--gravar');
const OBS = 'Material próprio da NEWPC (Histórias Educativas). Autorizado por Alan em 25/10/2026.';
const db = getFirestore();

const p = new URLSearchParams({ key: CHAVE, q: `'${PASTA}' in parents and trashed=false and mimeType='application/pdf'`, fields: 'files(id,name,size)', pageSize: '200' });
const r = await fetch('https://www.googleapis.com/drive/v3/files?' + p, { headers: { Referer: REFERER } });
if (!r.ok) { console.log('Drive respondeu', r.status, await r.text()); process.exit(1); }
let arquivos = (await r.json()).files || [];
// a pasta não é pública: usa os IDs dos links da página antiga (scripts/historias-ids.json, extraídos do HTML salvo)
if (!arquivos.length) {
  const { readFileSync } = await import('node:fs');
  const ids = JSON.parse(readFileSync(new URL('./historias-ids.json', import.meta.url), 'utf8'));
  for (const id of ids) {
    const x = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,size,mimeType&key=${CHAVE}`, { headers: { Referer: REFERER } });
    if (x.ok) arquivos.push(await x.json()); else console.log('Sem acesso ao arquivo', id, x.status);
  }
}
const titulo = n => n.replace(/\.pdf$/i, '').replace(/\s+[–-]\s+/g, ': ').replace(/\s+/g, ' ').trim();
console.log(arquivos.length, 'histórias encontradas');
arquivos.forEach(f => console.log(' -', titulo(f.name), '·', Math.round(Number(f.size || 0) / 1e6), 'MB'));
if (!GRAVAR) { console.log('Simulação. Use --gravar para importar.'); process.exit(0); }

const alan = (await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get()).docs[0];
const quem = { uid: alan ? alan.id : 'admin', nome: (alan && alan.data().nome) || 'Alan' };
let ok = 0, erro = 0;
for (const f of arquivos) {
  await db.doc(`biblioteca_triagem/${f.id}`).set({ titulo: titulo(f.name), nome: f.name, secao: 'historias', tipo: 'pdf', mime: 'application/pdf',
    tamanho: Number(f.size || 0), pasta: 'Histórias educativas', sugestao: 'revisar', motivo: 'Material próprio da NEWPC', drive_id: f.id,
    status: 'pendente', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  try { const x = await importarTitulo({ id: f.id, licenca: 'propria', obs: OBS, titulo: titulo(f.name), autor: 'Portal do Educador' }, quem); ok++; console.log('OK', titulo(f.name), x.ja ? '(já estava)' : ''); }
  catch (e) { erro++; console.log('ERRO', titulo(f.name), e.message); }
}
console.log('FIM', ok, 'importadas,', erro, 'com erro');

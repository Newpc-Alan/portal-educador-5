// Importa os Desenhos para Colorir da pasta do Google Drive para o Portal 5.0.
// Cada desenho vira: colorir/{colecao}/{arquivo}.webp (até 1600 px, para colorir e imprimir)
//                  + colorir/{colecao}/miniaturas/{arquivo}.webp (360 px, para a galeria)
//                  + documento em Firestore colorir/{idDoDrive}
// Rodar no Cloud Shell (pasta scripts):
//   npm i --silent sharp && node importar-colorir.mjs            -> simulação (só lista)
//   node importar-colorir.mjs --gravar                           -> importa (pode rodar de novo: pula o que já existe)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const PASTA = '1UDefxrWWrUYDbtNNLAwGa41RHM24-AcV';
const CHAVE = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; // chave pública que já estava no app antigo
const REFERER = 'https://www.portaldoeducador.com.br/';
const BUCKET = 'portal-educador-5.firebasestorage.app';
const GRAVAR = process.argv.includes('--gravar');

const app = initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: BUCKET });
const db = getFirestore(app), bucket = getStorage(app).bucket();

// coleção -> nome bonito, tema e se é conteúdo religioso
const COLECOES = [
  [/bobbie\s*goods/i, 'Bobbie Goods', 'Personagens', false],
  [/bob\s*esponja/i, 'Bob Esponja', 'Personagens', false],
  [/chaves/i, 'Chaves', 'Personagens', false],
  [/branca\s*de\s*neve/i, 'Branca de Neve', 'Contos e fábulas', false],
  [/capivara/i, 'Capivara', 'Animais e natureza', false],
  [/cactos/i, 'Cactos Fofos', 'Animais e natureza', false],
  [/astronauta/i, 'Astronauta', 'Aventuras e profissões', false],
  [/boiadeira/i, 'Boiadeira', 'Aventuras e profissões', false],
  [/copa|missao_copa/i, 'Copa do Mundo 2026', 'Esportes', false],
  [/crist[aã]o\s*menino/i, 'Cristão Menino', 'Bíblico', true],
  [/jonas/i, 'Jonas e a Baleia', 'Bíblico', true],
  [/yeshua/i, 'Yeshua', 'Bíblico', true],
  [/frutos\s*do\s*esp/i, 'Frutos do Espírito', 'Bíblico', true],
  [/jesus\s*acalma/i, 'Jesus acalma a tempestade', 'Bíblico', true],
  [/b[ií]blico/i, 'Histórias Bíblicas', 'Bíblico', true]
];
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function classificar(nome) {
  const base = nome.replace(/\.[^.]+$/, '');
  const c = COLECOES.find(([re]) => re.test(base)) || [null, base.replace(/[_-]+/g, ' ').replace(/\s*page.*$/i, '').trim() || 'Outros', 'Outros', false];
  const num = (base.match(/(\d+)\s*$/) || base.match(/page[ _-]*(\d+)/i) || [])[1];
  const vol = (base.match(/b[ií]blico\s*0?(\d)/i) || [])[1];
  return { colecao: c[1], colecao_id: slug(c[1]), tema: c[2], religioso: c[3], ordem: (vol ? Number(vol) * 1000 : 0) + (num ? Number(num) : 0) };
}

async function listar() {
  let todos = [], token = '';
  do {
    const p = new URLSearchParams({ key: CHAVE, q: `'${PASTA}' in parents and trashed=false and mimeType contains 'image/'`, fields: 'nextPageToken,files(id,name,mimeType,size)', pageSize: '1000' });
    if (token) p.set('pageToken', token);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + p, { headers: { Referer: REFERER } });
    if (!r.ok) throw new Error('Drive ' + r.status + ' ' + await r.text());
    const d = await r.json(); todos = todos.concat(d.files || []); token = d.nextPageToken || '';
  } while (token);
  return todos;
}

async function subir(caminho, buf) {
  const token = randomUUID();
  await bucket.file(caminho).save(buf, { contentType: 'image/webp', resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

async function importar(f) {
  const ref = db.doc(`colorir/${f.id}`);
  if ((await ref.get()).exists) return 'existe';
  const info = classificar(f.name);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${CHAVE}`, { headers: { Referer: REFERER } });
  if (!r.ok) throw new Error('download ' + r.status);
  const original = Buffer.from(await r.arrayBuffer());
  const img = sharp(original).flatten({ background: '#ffffff' }).rotate();
  const grande = await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const mini = await img.clone().resize({ width: 360, height: 360, fit: 'inside' }).webp({ quality: 72 }).toBuffer();
  const nomeArq = slug(f.name.replace(/\.[^.]+$/, '')) || f.id;
  const path = `colorir/${info.colecao_id}/${nomeArq}.webp`, thumb_path = `colorir/${info.colecao_id}/miniaturas/${nomeArq}.webp`;
  const [url, thumb_url] = await Promise.all([subir(path, grande.data), subir(thumb_path, mini)]);
  await ref.set({
    titulo: `${info.colecao} · ${info.ordem % 1000 || ''}`.replace(/ · $/, ''), ...info,
    url, thumb_url, path, thumb_path, w: grande.info.width, h: grande.info.height,
    origem: 'drive', drive_nome: f.name, publicado: true, criado_em: FieldValue.serverTimestamp()
  });
  return 'ok';
}

const lista = await listar();
const resumo = {};
lista.forEach(f => { const c = classificar(f.name); const k = `${c.tema} › ${c.colecao}${c.religioso ? ' (religioso)' : ''}`; resumo[k] = (resumo[k] || 0) + 1; });
console.table(resumo);
console.log(`${lista.length} imagens na pasta.`);
if (!GRAVAR) { console.log('SIMULAÇÃO: nada foi gravado. Rode com --gravar para importar.'); process.exit(0); }

let ok = 0, existe = 0, erro = 0, i = 0;
const fila = [...lista];
async function trabalhador() {
  while (fila.length) {
    const f = fila.shift();
    try { const r = await importar(f); r === 'ok' ? ok++ : existe++; }
    catch (e) { erro++; console.error('ERRO', f.name, e.message); }
    if (++i % 50 === 0) console.log(`${i}/${lista.length}...`);
  }
}
await Promise.all(Array.from({ length: 6 }, trabalhador));
console.log(`PRONTO: ${ok} importados, ${existe} já existiam, ${erro} com erro.`);

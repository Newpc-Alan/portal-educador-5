// Copia o acervo NEWPC do Firebase Storage para o Nextcloud da NEWPC (pasta "Drive Portal do Educador").
// O original no Firebase fica intacto. Cada arquivo copiado vira um registro em nc_mapa/{id}: é o mapa
// "arquivo do Portal = caminho no Nextcloud" usado depois para virar a chave (ponte com link assinado).
//
//   etapa=teste   copia uma amostra (alguns de cada tipo) e para
//   etapa=copiar  copia tudo o que ainda não está no mapa (pode rodar de novo: retoma de onde parou)
//   etapa=conferir só leitura: compara o mapa com o Nextcloud (quantos existem lá e com o mesmo tamanho)
//
// Ambiente: NC_URL (https://cloud.portaldoeducador.com.br), NC_USUARIO, NC_APP_SENHA (secret), NC_RAIZ, COLECOES, LIMITE
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const imp = m => import(pathToFileURL(req.resolve(m)).href);
const { initializeApp, applicationDefault } = await imp('firebase-admin/app');
const { getFirestore, FieldValue } = await imp('firebase-admin/firestore');
const { getStorage } = await imp('firebase-admin/storage');
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), bucket = getStorage().bucket();

const etapa = process.argv[2] || 'teste';
const NC_URL = (process.env.NC_URL || 'https://cloud.portaldoeducador.com.br').replace(/\/$/, '');
const USUARIO = (process.env.NC_USUARIO || '').trim(), SENHA = process.env.NC_APP_SENHA || '';
const RAIZ = (process.env.NC_RAIZ || 'Drive Portal do Educador').replace(/^\/|\/$/g, '');
const COLECOES = (process.env.COLECOES || 'atividades,biblioteca,colorir,materiais').split(',').map(s => s.trim()).filter(Boolean);
const LIMITE = Number(process.env.LIMITE || 0) || Infinity;
const PARALELO = 4;
const log = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
const aviso = t => console.log('::warning::' + String(t).replace(/[{}"]/g, ' ').slice(0, 900));
if (!USUARIO || !SENHA) { console.log('::error::Falta o usuário do Nextcloud ou o secret NC_APP_SENHA.'); process.exit(1); }
const AUT = 'Basic ' + Buffer.from(USUARIO + ':' + SENHA).toString('base64');
const DAV = NC_URL + '/remote.php/dav/files/' + encodeURIComponent(USUARIO);

// ---------- nomes e pastas ----------
const ETAPAS = { infantil: 'Educacao-Infantil', alfa: 'Alfabetizacao', iniciais: 'Anos-Iniciais', finais: 'Anos-Finais', medio: 'Ensino-Medio' };
const SECOES = { livros: 'Livros', audiolivros: 'Audiolivros', historias: 'Historias', gibiteca: 'Gibiteca' };
const limpo = (t, max = 90) => String(t || '').normalize('NFC').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).replace(/[ .]+$/, '') || 'sem-nome';
const extDe = p => { const m = /\.([a-z0-9]{2,5})$/i.exec(p || ''); return m ? m[1].toLowerCase() : 'bin'; };
const caminhoDaUrl = u => { try { return decodeURIComponent(String(u).split('/o/')[1].split('?')[0]); } catch (e) { return ''; } };
const enc = p => p.split('/').map(encodeURIComponent).join('/');

// cada item: { id (do mapa), col, doc, campo, storage, nc }
async function itens() {
  const out = [];
  if (COLECOES.includes('atividades')) {
    (await db.collection('atividades').get()).forEach(d => {
      const x = d.data(), sp = caminhoDaUrl(x.url); if (!sp) return;
      const nome = limpo(x.titulo || x.arquivo_nome) + (x.categoria ? ' (' + limpo(x.categoria, 30) + ')' : '') + ' [' + d.id.slice(-6) + '].' + extDe(sp);
      out.push({ col: 'atividades', doc: d.id, campo: 'url', storage: sp,
        nc: ['01-Acervo-NEWPC', 'Atividades', ETAPAS[x.etapa] || limpo(x.etapa || 'Outras'), limpo(x.componente || 'Outros', 60), nome].join('/') });
    });
  }
  if (COLECOES.includes('biblioteca')) {
    (await db.collection('biblioteca').get()).forEach(d => {
      const x = d.data(), sp = caminhoDaUrl(x.url); if (!sp) return;
      const nome = limpo(x.titulo) + (x.autor ? ' - ' + limpo(x.autor, 40) : '') + ' [' + d.id.slice(-6) + '].' + extDe(sp);
      out.push({ col: 'biblioteca', doc: d.id, campo: 'url', storage: sp,
        nc: ['01-Acervo-NEWPC', 'Biblioteca', SECOES[x.secao] || limpo(x.secao || 'Outros'), nome].join('/') });
    });
  }
  if (COLECOES.includes('colorir')) {
    (await db.collection('colorir').get()).forEach(d => {
      const x = d.data(), sp = x.path || caminhoDaUrl(x.url); if (!sp) return;
      const nome = (x.ordem != null ? String(x.ordem).padStart(3, '0') + ' - ' : '') + limpo(x.titulo || sp.split('/').pop().replace(/\.[^.]+$/, '')) + ' [' + d.id.slice(-6) + '].' + extDe(sp);
      out.push({ col: 'colorir', doc: d.id, campo: 'url', storage: sp,
        nc: ['01-Acervo-NEWPC', 'Colorir', limpo(x.tema || 'Outros', 40), limpo(x.colecao || x.colecao_id || 'Avulsas', 70), nome].join('/') });
    });
  }
  if (COLECOES.includes('materiais')) {
    const cursos = {}; (await db.collection('cursos').get()).forEach(d => { cursos[d.id] = d.get('titulo') || d.id; });
    const [fs] = await bucket.getFiles({ prefix: 'materiais/' });
    fs.forEach(f => {
      const [, cid, ...resto] = f.name.split('/'); if (!cid || !resto.length || f.name.endsWith('/')) return;
      out.push({ col: 'materiais', doc: cid, campo: '', storage: f.name,
        nc: ['02-Formacao-Continuada', limpo(cursos[cid] || cid, 80), limpo(resto.join(' - '), 140)].join('/') });
    });
  }
  out.forEach(i => { i.id = (i.col + '__' + i.storage).replace(/\//g, '|').slice(0, 1400); });
  return out;
}

// ---------- WebDAV ----------
async function dav(metodo, caminho, opc = {}) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(DAV + '/' + enc(RAIZ + (caminho ? '/' + caminho : '')), { method: metodo, headers: { Authorization: AUT, ...(opc.headers || {}) }, body: opc.body, signal: AbortSignal.timeout(opc.prazo || 120000) });
      if (r.status >= 500 || r.status === 429) { await r.arrayBuffer().catch(() => {}); throw new Error('HTTP ' + r.status); }
      return r;
    } catch (e) { if (t === 3) throw e; await new Promise(ok => setTimeout(ok, 3000 * (t + 1))); }
  }
}
const pastas = new Set();
async function garantirPasta(dir) {
  const partes = dir.split('/'); let acc = '';
  for (const p of partes) {
    acc = acc ? acc + '/' + p : p;
    if (pastas.has(acc)) continue;
    const r = await dav('MKCOL', acc); await r.arrayBuffer().catch(() => {});
    if (![201, 405].includes(r.status)) throw new Error('não criou a pasta ' + acc + ' (HTTP ' + r.status + ')');
    pastas.add(acc);
  }
}
async function tamanhoNoNc(caminho) {
  const r = await dav('PROPFIND', caminho, { headers: { Depth: '0', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/></d:prop></d:propfind>' });
  const x = await r.text(); if (r.status !== 207) return -1;
  const m = /<d:getcontentlength>(\d+)</.exec(x); return m ? Number(m[1]) : -1;
}

// ---------- conferências iniciais ----------
async function conferirAcesso() {
  const r = await dav('PROPFIND', '', { headers: { Depth: '1' } }); const x = await r.text();
  if (r.status === 401) { console.log('::error::O Nextcloud recusou o usuário/senha de aplicativo (HTTP 401). Confira o usuário e o secret NC_APP_SENHA.'); process.exit(1); }
  if (r.status === 404) { console.log('::error::A pasta "' + RAIZ + '" não existe na conta ' + USUARIO + '. Confira o nome (foi renomeada?) e o usuário dono.'); process.exit(1); }
  if (r.status !== 207) { console.log('::error::Resposta inesperada do Nextcloud: HTTP ' + r.status); process.exit(1); }
  const nomes = [...x.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map(m => decodeURIComponent(m[1]).replace(/\/$/, '').split('/').pop()).slice(1);
  log('Nextcloud ok: ' + USUARIO + ' / ' + RAIZ + ' · pastas: ' + nomes.join(', '));
}

// ---------- etapas ----------
const lista = await itens();
const porCol = {}; lista.forEach(i => { porCol[i.col] = (porCol[i.col] || 0) + 1; });
log('arquivos do acervo no Firebase: ' + lista.length + ' · ' + Object.entries(porCol).map(([k, v]) => k + ' ' + v).join(', '));
await conferirAcesso();

const mapa = new Map(); (await db.collection('nc_mapa').get()).forEach(d => mapa.set(d.id, d.data()));

if (etapa === 'conferir') {
  let ok = 0, falta = 0, dif = 0; const ex = [];
  for (const [, m] of mapa) {
    const t = await tamanhoNoNc(m.nc);
    if (t < 0) { falta++; if (ex.length < 5) ex.push('faltando: ' + m.nc); } else if (t !== m.tamanho) { dif++; if (ex.length < 5) ex.push('tamanho diferente: ' + m.nc); } else ok++;
  }
  log('conferência: ' + mapa.size + ' no mapa · ' + ok + ' ok · ' + falta + ' faltando · ' + dif + ' com tamanho diferente');
  ex.forEach(aviso);
  process.exit(0);
}

let fila = lista.filter(i => !(mapa.get(i.id) || {}).copiado_em);
if (etapa === 'teste') {
  const am = []; for (const c of COLECOES) am.push(...fila.filter(i => i.col === c).slice(0, 5)); fila = am;
}
fila = fila.slice(0, LIMITE);
log('a copiar agora: ' + fila.length + ' (já copiados antes: ' + (lista.length - lista.filter(i => !(mapa.get(i.id) || {}).copiado_em).length) + ')');

let feitos = 0, bytes = 0, erros = 0; const errosEx = [], exemplos = [], t0 = Date.now();
async function copiar(i) {
  const f = bucket.file(i.storage);
  const [existe] = await f.exists(); if (!existe) throw new Error('não existe no Firebase: ' + i.storage);
  const [buf] = await f.download();
  await garantirPasta(i.nc.split('/').slice(0, -1).join('/'));
  const r = await dav('PUT', i.nc, { body: buf, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buf.length) }, prazo: 600000 });
  await r.arrayBuffer().catch(() => {});
  if (![201, 204].includes(r.status)) throw new Error('PUT HTTP ' + r.status + ' em ' + i.nc);
  await db.doc('nc_mapa/' + i.id).set({ col: i.col, doc: i.doc, campo: i.campo, storage: i.storage, nc: i.nc, raiz: RAIZ, usuario: USUARIO, tamanho: buf.length, copiado_em: FieldValue.serverTimestamp() });
  feitos++; bytes += buf.length; if (exemplos.length < 8) exemplos.push(i.nc);
  if (feitos % 250 === 0) console.log('… ' + feitos + '/' + fila.length + ' · ' + (bytes / 1048576).toFixed(0) + ' MB');
}
let pos = 0;
await Promise.all(Array.from({ length: PARALELO }, async () => {
  while (pos < fila.length) {
    const i = fila[pos++];
    try { await copiar(i); } catch (e) { erros++; if (errosEx.length < 6) errosEx.push(i.storage + ': ' + e.message); }
  }
}));
const min = ((Date.now() - t0) / 60000).toFixed(1);
log('copiados: ' + feitos + ' · ' + (bytes / 1048576).toFixed(1) + ' MB em ' + min + ' min · erros: ' + erros);
exemplos.forEach(e => log('  ' + RAIZ + '/' + e));
errosEx.forEach(aviso);
const resta = lista.length - (mapa.size + feitos);
log(resta > 0 ? 'faltam ' + resta + ' arquivo(s): rode de novo a etapa copiar para continuar.' : 'acervo inteiro copiado.');
if (erros && !feitos) process.exit(1);

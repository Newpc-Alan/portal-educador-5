// Migração do espaço de arquivos principal (EUA) para São Paulo.
//   etapa=levantar  só leitura: o que há no bucket antigo e quantos documentos do banco apontam para ele
//   etapa=preparar  cria o bucket em São Paulo (se não existir), liga ao Firebase, copia o CORS e copia os arquivos (o antigo fica intacto)
//   etapa=links     troca, no banco, os links do bucket antigo pelo novo (mesmo caminho e mesmo token de download)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const imp = m => import(pathToFileURL(req.resolve(m)).href);
const { initializeApp, applicationDefault } = await imp('firebase-admin/app');
const { getFirestore } = await imp('firebase-admin/firestore');
const { Storage } = await imp('@google-cloud/storage');
const { GoogleAuth } = await imp('google-auth-library');
const P = 'portal-educador-5', VELHO = 'portal-educador-5.firebasestorage.app', NOVO = 'portal-educador-5-arquivos', REGIAO = 'southamerica-east1';
const etapa = process.argv[2] || 'levantar';
initializeApp({ credential: applicationDefault(), projectId: P });
const db = getFirestore(), gcs = new Storage({ projectId: P }), velho = gcs.bucket(VELHO), novo = gcs.bucket(NOVO);
const log = t => console.log('::notice::' + String(t).replace(/[{}"]/g, ' '));

async function listar(b) { const [fs] = await b.getFiles(); return fs; }

// procura no banco os documentos com texto contendo o bucket antigo. Em vez de descer coleção por coleção (lento),
// usa um collectionGroup por nome de coleção que aparece nas regras do Firestore (top-level e subcoleções).
import { readFileSync } from 'node:fs';
const NOMES = [...new Set([...readFileSync('../firestore.rules', 'utf8').matchAll(/match \/([a-z_]+)\/\{/g)].map(m => m[1]))].filter(n => n !== 'databases');
async function docsComVelho(trocar) {
  let vistos = 0, achados = 0, trocados = 0; const porCol = {};
  const mexe = v => typeof v === 'string' ? (v.includes(VELHO) ? v.split(VELHO).join(NOVO) : v)
    : Array.isArray(v) ? v.map(mexe) : (v && typeof v === 'object' && v.constructor === Object) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mexe(x)])) : v;
  const tem = v => typeof v === 'string' ? v.includes(VELHO) : Array.isArray(v) ? v.some(tem) : (v && typeof v === 'object' && v.constructor === Object) ? Object.values(v).some(tem) : false;
  for (const nome of NOMES) {
    const sn = await db.collectionGroup(nome).get();
    let lote = db.batch(), n = 0;
    for (const d of sn.docs) {
      vistos++;
      const dados = d.data();
      if (!tem(dados)) continue;
      achados++; porCol[nome] = (porCol[nome] || 0) + 1;
      if (trocar) { lote.set(d.ref, mexe(dados)); n++; trocados++; if (n === 400) { await lote.commit(); lote = db.batch(); n = 0; } }
    }
    if (trocar && n) await lote.commit();
  }
  log('banco: ' + NOMES.length + ' colecoes, ' + vistos + ' documentos lidos, ' + achados + ' com link do bucket antigo' + (trocar ? ', ' + trocados + ' trocados' : ''));
  const l = Object.entries(porCol).map(([k, v]) => k + ' ' + v);
  for (let i = 0; i < l.length; i += 10) log('  ' + l.slice(i, i + 10).join(' | '));
}

if (etapa === 'levantar') {
  const [m] = await velho.getMetadata();
  log('bucket antigo: ' + VELHO + ' regiao ' + m.location + ' acesso uniforme ' + !!(m.iamConfiguration && m.iamConfiguration.uniformBucketLevelAccess && m.iamConfiguration.uniformBucketLevelAccess.enabled) + ' cors ' + JSON.stringify(m.cors || []).slice(0, 200));
  const fs = await listar(velho); const pre = {}; let tot = 0;
  fs.forEach(f => { const p = f.name.split('/')[0]; const t = Number(f.metadata.size || 0); tot += t; pre[p] = pre[p] || [0, 0]; pre[p][0]++; pre[p][1] += t; });
  log('arquivos: ' + fs.length + ' · ' + (tot / 1048576).toFixed(1) + ' MB');
  const l = Object.entries(pre).sort((a, b) => b[1][1] - a[1][1]).map(([k, [n, t]]) => k + ' ' + n + ' arq ' + (t / 1048576).toFixed(1) + ' MB');
  for (let i = 0; i < l.length; i += 8) log('  ' + l.slice(i, i + 8).join(' | '));
  const [existe] = await novo.exists(); log('bucket novo ' + NOVO + ' ja existe: ' + existe);
  await docsComVelho(false);
}

if (etapa === 'preparar') {
  const [existe] = await novo.exists();
  if (!existe) {
    const [m] = await velho.getMetadata();
    await gcs.createBucket(NOVO, { location: REGIAO, storageClass: 'STANDARD',
      iamConfiguration: { uniformBucketLevelAccess: { enabled: !!(m.iamConfiguration && m.iamConfiguration.uniformBucketLevelAccess && m.iamConfiguration.uniformBucketLevelAccess.enabled) }, publicAccessPrevention: 'inherited' } });
    log('bucket criado: ' + NOVO + ' em ' + REGIAO);
  } else log('bucket ja existia: ' + NOVO);
  const [mv] = await velho.getMetadata();
  const cors = (mv.cors && mv.cors.length) ? mv.cors : [{ origin: ['https://app.portaldoeducador.com.br', 'https://www.portaldoeducador.com.br'], method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Encoding', 'Content-Length'], maxAgeSeconds: 3600 }];
  await novo.setCorsConfiguration(cors); log('cors copiado (' + cors.length + ' regra)');
  // liga o bucket ao Firebase (regras do Storage e SDK passam a valer nele)
  const cli = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  try { await cli.request({ url: `https://firebasestorage.googleapis.com/v1beta/projects/${P}/buckets/${NOVO}:addFirebase`, method: 'POST', data: {} }); log('bucket ligado ao Firebase'); }
  catch (e) { log('ligar ao Firebase: ' + (e.response && e.response.status) + ' ' + String(e.message).slice(0, 120)); }
  // copia o que ainda não está lá (ou mudou de tamanho), preservando metadados e token de download
  const fs = await listar(velho), [ja] = await novo.getFiles(), tam = new Map(ja.map(f => [f.name, f.metadata.size]));
  let copiados = 0, pulados = 0, erros = 0;
  const fila = fs.filter(f => { if (tam.get(f.name) === f.metadata.size) { pulados++; return false; } return true; });
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 24 }, async () => {
    for (let f; (f = fila.shift());) {
      try { await f.copy(novo.file(f.name)); copiados++; } catch (e) { erros++; if (erros <= 5) log('erro ' + f.name + ': ' + String(e.message).slice(0, 100)); }
      if (Date.now() - t0 > 40 * 60000) { log('parei por tempo; rode de novo para continuar'); fila.length = 0; }
    }
  }));
  const [fim] = await novo.getFiles();
  log('copia: ' + copiados + ' copiados, ' + pulados + ' ja estavam, ' + erros + ' erros · antigo ' + fs.length + ' arquivos, novo ' + fim.length);
}

if (etapa === 'links') await docsComVelho(true);

// Backup da APLICAÇÃO INTEIRA no servidor da NEWPC (Nextcloud), criptografado. Roda pelo GitHub Actions (backup-servidor.yml).
//
//   etapa=backup   (toda madrugada) banco + contas de login + código -> pacote datado; arquivos do Storage -> espelho incremental
//   etapa=teste    (todo mês) baixa o último pacote, decifra, confere banco, contas, código e uma amostra de arquivos
//
// No Nextcloud (conta NC_USUARIO, pasta "Drive Portal do Educador/04-Backups"):
//   diario/AAAA-MM-DD.tar.enc      últimos 30 dias           (banco em NDJSON, contas, git bundle, resumo)
//   mensal/AAAA-MM.tar.enc         últimos 12 meses          (a primeira cópia de cada mês)
//   arquivos/xx/<hash>.enc         espelho dos arquivos do Storage (só o que é novo ou mudou); some do espelho 30 dias depois de sumir do Portal
//   arquivos/_manifesto.json.enc   qual hash é qual arquivo (bucket, caminho, tamanho, md5)
// Tudo é cifrado com AES-256 (openssl enc -aes-256-cbc -pbkdf2 -iter 200000) com a senha do segredo BACKUP_SENHA do GitHub.
// Abrir à mão:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in AAAA-MM-DD.tar.enc | tar -x
// Restaurar: scripts/restaurar-backup.mjs (POP de restauração). As fotos da portaria (apagadas em 15 dias) NÃO entram no espelho.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, createWriteStream, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGzip, gunzipSync } from 'node:zlib';
const req = createRequire(process.cwd() + '/');
const imp = m => import(pathToFileURL(req.resolve(m)).href);
const { initializeApp, applicationDefault } = await imp('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath, Timestamp, GeoPoint, DocumentReference } = await imp('firebase-admin/firestore');
const { getAuth } = await imp('firebase-admin/auth');
const { getStorage } = await imp('firebase-admin/storage');
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore();

const etapa = process.argv[2] || 'backup';
const SENHA = process.env.BACKUP_SENHA || '';
const NC_URL = (process.env.NC_URL || 'https://cloud.portaldoeducador.com.br').replace(/\/$/, '');
const USUARIO = (process.env.NC_USUARIO || 'alan').trim(), NC_SENHA = process.env.NC_APP_SENHA || '';
const RAIZ = 'Drive Portal do Educador/04-Backups';
const REPO = process.env.REPO_DIR || '..';
const TMP = process.env.RUNNER_TEMP ? process.env.RUNNER_TEMP + '/bk' : '/tmp/bk';
const BUCKETS = ['portal-educador-5.firebasestorage.app'];   // portaria fica de fora (fotos com prazo de 15 dias)
const DIAS_DIARIO = 30, MESES_MENSAL = 12, DIAS_SUMIDO = 30;
const log = t => console.log('::notice::' + String(t).replace(/[{}"\n]/g, ' ').slice(0, 900));
const falha = async (t) => {
  console.log('::error::' + t);
  await db.collection('backups_log').add({ em: FieldValue.serverTimestamp(), status: 'erro', tipo: etapa === 'teste' ? 'teste' : 'automatico', destino: 'servidor', por_nome: 'Robô do servidor NEWPC', erro: String(t).slice(0, 300) }).catch(() => {});
  process.exit(1);
};
if (!SENHA || SENHA.length < 12) await falha('Falta o segredo BACKUP_SENHA (mínimo 12 caracteres) no GitHub: Settings > Secrets and variables > Actions.');
if (!NC_SENHA) await falha('Falta o segredo NC_APP_SENHA (senha de aplicativo do Nextcloud).');
const AUT = 'Basic ' + Buffer.from(USUARIO + ':' + NC_SENHA).toString('base64');
const DAV = NC_URL + '/remote.php/dav/files/' + encodeURIComponent(USUARIO);
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const hojeMT = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });

// ---------- WebDAV ----------
async function dav(metodo, caminho, opc = {}) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(DAV + '/' + enc(RAIZ + (caminho ? '/' + caminho : '')), { method: metodo, headers: { Authorization: AUT, ...(opc.headers || {}) }, body: opc.body, duplex: opc.body && typeof opc.body.pipe === 'function' ? 'half' : undefined, signal: AbortSignal.timeout(opc.prazo || 300000) });
      if (r.status >= 500 || r.status === 429 || r.status === 423) { await r.arrayBuffer().catch(() => {}); throw new Error('HTTP ' + r.status); }
      return r;
    } catch (e) { if (t === 3) throw e; await new Promise(ok => setTimeout(ok, 4000 * (t + 1))); }
  }
}
const pastasOk = new Set();
async function pasta(c) {
  let acc = '';
  for (const p of ['', ...c.split('/').filter(Boolean)]) {
    acc = acc ? acc + '/' + p : p; if (pastasOk.has(acc)) continue;
    const r = await dav('MKCOL', acc); await r.arrayBuffer().catch(() => {});
    if (![201, 405].includes(r.status)) throw new Error('não criou a pasta ' + (acc || '(raiz)') + ' HTTP ' + r.status);
    pastasOk.add(acc);
  }
}
async function enviar(caminho, buf) {
  const r = await dav('PUT', caminho, { body: buf, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(buf.length) }, prazo: 1800000 });
  await r.arrayBuffer().catch(() => {});
  if (![201, 204].includes(r.status)) throw new Error('PUT HTTP ' + r.status + ' em ' + caminho);
}
async function baixar(caminho) {
  const r = await dav('GET', caminho, { prazo: 1800000 });
  if (r.status !== 200) { await r.arrayBuffer().catch(() => {}); return null; }
  return Buffer.from(await r.arrayBuffer());
}
async function listar(caminho) {
  const r = await dav('PROPFIND', caminho, { headers: { Depth: '1' } }); const x = await r.text();
  if (r.status !== 207) return [];
  return [...x.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map(m => decodeURIComponent(m[1]).replace(/\/$/, '').split('/').pop()).slice(1);
}

// ---------- cifra (openssl: qualquer técnico abre com o comando padrão, sem depender deste código) ----------
function openssl(args, entrada) {
  return new Promise((ok, erro) => {
    const p = spawn('openssl', ['enc', ...args, '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-pass', 'env:BACKUP_SENHA'], { env: { ...process.env, BACKUP_SENHA: SENHA } });
    const out = []; let errTxt = '';
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => { errTxt += d; });
    p.on('close', c => c === 0 ? ok(Buffer.concat(out)) : erro(new Error('openssl: ' + errTxt.slice(0, 200))));
    p.stdin.end(entrada);
  });
}
const cifrar = buf => openssl(['-salt'], buf);
const decifrar = buf => openssl(['-d'], buf);
const hashDe = (b, c) => createHash('sha256').update(b + '|' + c).digest('hex').slice(0, 40);

// ---------- banco: tudo, inclusive subcoleções, em NDJSON (um documento por linha) ----------
function codificar(v) {
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof Timestamp) return { __t: 'ts', s: v.seconds, n: v.nanoseconds };
  if (v instanceof GeoPoint) return { __t: 'geo', la: v.latitude, lo: v.longitude };
  if (v instanceof DocumentReference) return { __t: 'ref', p: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __t: 'bytes', b: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(codificar);
  if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = codificar(v[k]); return o; }
  return v;
}
async function despejarBanco(arquivo) {
  const gz = createGzip(), out = createWriteStream(arquivo); gz.pipe(out);
  const fim = new Promise(ok => out.on('finish', ok));
  let docs = 0; const porColecao = {}, existentes = new Set();
  async function colecao(ref) {
    let ultimo = null;
    for (;;) {
      let q = ref.orderBy(FieldPath.documentId()).limit(500); if (ultimo) q = q.startAfter(ultimo);
      const sn = await q.get(); if (sn.empty) break;
      for (const d of sn.docs) {
        gz.write(JSON.stringify({ p: d.ref.path, d: codificar(d.data()) }) + '\n'); docs++; existentes.add(d.ref.path);
        const raiz = d.ref.path.split('/')[0]; porColecao[raiz] = (porColecao[raiz] || 0) + 1;
      }
      // subcoleções de cada documento desta página (em paralelo, de 20 em 20)
      for (let i = 0; i < sn.docs.length; i += 20)
        await Promise.all(sn.docs.slice(i, i + 20).map(async d => { for (const sub of await d.ref.listCollections()) await colecao(sub); }));
      ultimo = sn.docs[sn.docs.length - 1];
      if (sn.size < 500) break;
    }
  }
  // documentos "fantasmas" (só com subcoleções) também têm as subcoleções visitadas
  for (const c of await db.listCollections()) {
    await colecao(c);
    // documentos que só existem como "pasta" de subcoleções (sem dados próprios)
    for (const r of await c.listDocuments()) if (!existentes.has(r.path)) for (const sub of await r.listCollections()) await colecao(sub);
  }
  gz.end(); await fim;
  return { docs, porColecao };
}
// ---------- contas de login ----------
async function despejarContas(arquivo) {
  const todos = []; let pg;
  do { const r = await getAuth().listUsers(1000, pg); r.users.forEach(u => todos.push(u.toJSON())); pg = r.pageToken; } while (pg);
  writeFileSync(arquivo, JSON.stringify({ gerado_em: new Date().toISOString(), total: todos.length, usuarios: todos }));
  return todos.length;
}

// ---------- etapa: backup ----------
async function backup() {
  const t0 = Date.now(), dia = hojeMT(), dir = TMP + '/pacote'; mkdirSync(dir, { recursive: true });
  const logRef = db.collection('backups_log').doc();
  await logRef.set({ em: FieldValue.serverTimestamp(), status: 'exportando', tipo: 'automatico', destino: 'servidor', por_nome: 'Robô do servidor NEWPC' });
  try {
    const banco = await despejarBanco(dir + '/banco.ndjson.gz');
    log('banco: ' + banco.docs + ' documentos em ' + Object.keys(banco.porColecao).length + ' coleções');
    const contas = await despejarContas(dir + '/contas.json');
    log('contas de login: ' + contas);
    execFileSync('git', ['-C', REPO, 'bundle', 'create', dir + '/codigo.bundle', '--all'], { stdio: 'pipe' });
    log('código: ' + (statSync(dir + '/codigo.bundle').size / 1048576).toFixed(1) + ' MB (todos os ramos)');
    writeFileSync(dir + '/LEIAME.txt', ['Backup do Portal do Educador 5.0 · ' + dia, '', 'banco.ndjson.gz  todos os documentos do Firestore (uma linha por documento: p = caminho, d = dados)',
      'contas.json      contas de login (Firebase Authentication)', 'codigo.bundle    repositório completo (git clone codigo.bundle)', 'resumo.json      contagens para conferir',
      '', 'Arquivos do Storage: pasta arquivos/ (espelho cifrado, ver _manifesto.json.enc).', 'Restaurar: POP de restauração em caso de desastre e scripts/restaurar-backup.mjs.'].join('\n'));
    writeFileSync(dir + '/resumo.json', JSON.stringify({ dia, documentos: banco.docs, por_colecao: banco.porColecao, contas, commit: execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD']).toString().trim() }, null, 1));
    execFileSync('tar', ['-cf', TMP + '/pacote.tar', '-C', dir, '.']);
    await logRef.update({ status: 'enviando', documentos: banco.docs });
    const cifrado = await cifrar(readFileSync(TMP + '/pacote.tar'));
    await pasta('diario'); await enviar('diario/' + dia + '.tar.enc', cifrado);
    log('pacote do dia: diario/' + dia + '.tar.enc · ' + (cifrado.length / 1048576).toFixed(1) + ' MB (cifrado)');
    // cópia do mês: a primeira de cada mês fica 12 meses
    await pasta('mensal');
    const mes = dia.slice(0, 7), mensais = await listar('mensal');
    if (!mensais.includes(mes + '.tar.enc')) { await enviar('mensal/' + mes + '.tar.enc', cifrado); log('cópia mensal: mensal/' + mes + '.tar.enc'); }
    // arquivos
    const arq = await espelharArquivos();
    // retenção
    const limite = new Date(Date.now() - DIAS_DIARIO * 864e5).toISOString().slice(0, 10);
    for (const n of await listar('diario')) { const m = /^(\d{4}-\d{2}-\d{2})\.tar\.enc$/.exec(n); if (m && m[1] < limite) { const r = await dav('DELETE', 'diario/' + n); await r.arrayBuffer().catch(() => {}); log('apagado (mais de 30 dias): diario/' + n); } }
    const ms = (await listar('mensal')).filter(n => /^\d{4}-\d{2}\.tar\.enc$/.test(n)).sort();
    for (const n of ms.slice(0, Math.max(0, ms.length - MESES_MENSAL))) { const r = await dav('DELETE', 'mensal/' + n); await r.arrayBuffer().catch(() => {}); log('apagado (mais de 12 meses): mensal/' + n); }
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    await logRef.update({ status: 'ok', bytes: cifrado.length + arq.bytesNovos, documentos: banco.docs, contas, arquivos: arq.total, arquivos_novos: arq.novos, minutos: Number(min), terminado_em: FieldValue.serverTimestamp() });
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + 183 * 864e5), acao: 'criou', origem: 'robo', colecao: 'backup_servidor',
      doc: 'diario/' + dia, autor_uid: '', autor_tipo: 'sistema', municipio_id: '', escola_id: '', campos: ['documentos', 'contas', 'arquivos'], valores: { documentos: { de: null, para: String(banco.docs) }, contas: { de: null, para: String(contas) }, arquivos: { de: null, para: String(arq.total) } } });
    log('backup concluído em ' + min + ' min');
  } catch (e) { await logRef.update({ status: 'erro', erro: String(e.message || e).slice(0, 300) }).catch(() => {}); throw e; }
}

// espelho incremental dos arquivos do Storage (cada arquivo cifrado com nome por hash; o manifesto diz quem é quem)
async function espelharArquivos() {
  const manBuf = await baixar('arquivos/_manifesto.json.enc');
  const man = manBuf ? JSON.parse((await decifrar(manBuf)).toString()) : { arquivos: {} };
  const agora = Date.now(); let novos = 0, bytesNovos = 0, total = 0, erros = 0, apagados = 0; const vivos = new Set();
  const fila = [];
  for (const b of BUCKETS) {
    const [fs] = await getStorage().bucket(b).getFiles();
    for (const f of fs) {
      if (f.name.endsWith('/')) continue;
      const h = hashDe(b, f.name); vivos.add(h); total++;
      const m = man.arquivos[h], md5 = f.metadata.md5Hash || '', tam = Number(f.metadata.size || 0);
      if (m && m.md5 === md5 && m.tam === tam) { if (m.sumiu_em) delete m.sumiu_em; continue; }
      fila.push({ f, b, h, md5, tam });
    }
  }
  log('arquivos no Portal: ' + total + ' · a copiar agora: ' + fila.length);
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < fila.length) {
      const x = fila[i++];
      try {
        const [buf] = await x.f.download(); const c = await cifrar(buf);
        await pasta('arquivos/' + x.h.slice(0, 2)); await enviar('arquivos/' + x.h.slice(0, 2) + '/' + x.h + '.enc', c);
        man.arquivos[x.h] = { b: x.b, c: x.f.name, md5: x.md5, tam: x.tam, tipo: x.f.metadata.contentType || '', em: new Date().toISOString() };
        novos++; bytesNovos += c.length;
        if (novos % 200 === 0) { console.log('… ' + novos + '/' + fila.length); await gravarManifesto(man); }
      } catch (e) { erros++; if (erros <= 5) console.log('::warning::' + x.f.name + ': ' + e.message); }
    }
  }));
  // sumiram do Portal: marca; depois de 30 dias, apaga do espelho (mesmo prazo das cópias diárias)
  for (const [h, m] of Object.entries(man.arquivos)) {
    if (vivos.has(h)) continue;
    if (!m.sumiu_em) m.sumiu_em = new Date().toISOString();
    else if (agora - Date.parse(m.sumiu_em) > DIAS_SUMIDO * 864e5) {
      const r = await dav('DELETE', 'arquivos/' + h.slice(0, 2) + '/' + h + '.enc'); await r.arrayBuffer().catch(() => {});
      delete man.arquivos[h]; apagados++;
    }
  }
  await gravarManifesto(man);
  log('espelho de arquivos: ' + novos + ' novos ou alterados (' + (bytesNovos / 1048576).toFixed(1) + ' MB) · ' + erros + ' erro(s) · ' + apagados + ' removido(s) após 30 dias fora do Portal');
  if (erros && !novos && fila.length) throw new Error('nenhum arquivo foi copiado (' + erros + ' erros)');
  return { total, novos, bytesNovos };
}
async function gravarManifesto(man) {
  man.atualizado_em = new Date().toISOString();
  await pasta('arquivos'); await enviar('arquivos/_manifesto.json.enc', await cifrar(Buffer.from(JSON.stringify(man))));
}

// ---------- etapa: teste de restauração ----------
async function teste() {
  const logRef = db.collection('backups_log').doc();
  await logRef.set({ em: FieldValue.serverTimestamp(), status: 'exportando', tipo: 'teste', destino: 'servidor', por_nome: 'Robô do servidor NEWPC' });
  const problemas = [];
  try {
    const nomes = (await listar('diario')).filter(n => /\.tar\.enc$/.test(n)).sort();
    if (!nomes.length) throw new Error('nenhum pacote diário no servidor');
    const ultimo = nomes[nomes.length - 1], buf = await baixar('diario/' + ultimo);
    const tar = await decifrar(buf); writeFileSync(TMP + '/t.tar', tar);
    mkdirSync(TMP + '/t', { recursive: true }); execFileSync('tar', ['-xf', TMP + '/t.tar', '-C', TMP + '/t']);
    const resumo = JSON.parse(readFileSync(TMP + '/t/resumo.json'));
    const linhas = gunzipSync(readFileSync(TMP + '/t/banco.ndjson.gz')).toString().split('\n').filter(Boolean);
    let validas = 0; for (const l of linhas) { const o = JSON.parse(l); if (o.p && o.d) validas++; }
    if (validas !== resumo.documentos) problemas.push('banco: ' + validas + ' linhas válidas, o resumo diz ' + resumo.documentos);
    // usuários: o pacote tem que bater com a contagem feita NA HORA do backup (resumo.json). Comparar com o Portal de agora dava
    // falso alarme, porque entra gente nova entre o backup e o teste. O Portal de agora só acusa se tiver MENOS de 90% do pacote
    // (sinal de exclusão em massa, que é exatamente quando o backup vai ser preciso).
    const vivo = (await db.collection('usuarios').count().get()).data().count, noPacote = linhas.filter(l => l.startsWith('{"p":"usuarios/') && l.split('"p":"')[1].split('"')[0].split('/').length === 2).length;
    const naHora = resumo.por_colecao && resumo.por_colecao.usuarios;
    if (typeof naHora === 'number' && noPacote !== naHora) problemas.push('usuarios: ' + noPacote + ' no pacote, mas o backup contou ' + naHora + ' na hora');
    if (vivo < noPacote * 0.9) problemas.push('usuarios: o Portal hoje tem ' + vivo + ', menos de 90% dos ' + noPacote + ' do pacote (houve exclusão?)');
    const contas = JSON.parse(readFileSync(TMP + '/t/contas.json'));
    if (contas.total !== (contas.usuarios || []).length) problemas.push('contas: total não confere');
    try { execFileSync('git', ['bundle', 'verify', TMP + '/t/codigo.bundle'], { stdio: 'pipe', cwd: REPO }); } catch (e) { problemas.push('código: o bundle não passou na verificação do git'); }
    // amostra de arquivos do espelho: decifra e confere o md5 com o manifesto
    const man = JSON.parse((await decifrar(await baixar('arquivos/_manifesto.json.enc'))).toString());
    const hs = Object.keys(man.arquivos).filter(h => !man.arquivos[h].sumiu_em).sort(() => Math.random() - 0.5).slice(0, 15);
    let okArq = 0;
    for (const h of hs) {
      const c = await baixar('arquivos/' + h.slice(0, 2) + '/' + h + '.enc'); if (!c) { problemas.push('arquivo ausente no espelho: ' + man.arquivos[h].c); continue; }
      const b = await decifrar(c), md5 = createHash('md5').update(b).digest('base64');
      if (md5 === man.arquivos[h].md5 || !man.arquivos[h].md5) okArq++; else problemas.push('arquivo diferente do original: ' + man.arquivos[h].c);
    }
    const res = 'pacote ' + ultimo + ': ' + validas + ' documentos, ' + contas.total + ' contas, código ok' + (problemas.some(p => p.startsWith('código')) ? ' (não)' : '') + ', ' + okArq + '/' + hs.length + ' arquivos conferidos';
    log(res); problemas.forEach(p => console.log('::warning::' + p));
    await logRef.update({ status: problemas.length ? 'erro' : 'ok', documentos: validas, contas: contas.total, arquivos: okArq, resultado: res.slice(0, 300), erro: problemas.join(' | ').slice(0, 300), terminado_em: FieldValue.serverTimestamp() });
    await db.doc('stats/backup_servidor').set({ ultimo_teste: FieldValue.serverTimestamp(), ultimo_teste_ok: !problemas.length, ultimo_teste_resultado: res.slice(0, 300) }, { merge: true });
    if (problemas.length) process.exit(1);
  } catch (e) { await logRef.update({ status: 'erro', erro: String(e.message || e).slice(0, 300) }).catch(() => {}); throw e; }
}

if (etapa === 'teste') await teste(); else await backup();
if (etapa !== 'teste') await db.doc('stats/backup_servidor').set({ ultimo_backup: FieldValue.serverTimestamp() }, { merge: true });
process.exit(0);

// Restauração a partir do backup do servidor NEWPC (gerado por scripts/backup-servidor.mjs). Usar SÓ seguindo o POP de restauração.
// Nada é gravado sem --gravar. Sempre restaurar primeiro num projeto de TESTE e conferir antes de tocar no projeto real.
//
//   node scripts/restaurar-backup.mjs abrir    --pacote AAAA-MM-DD.tar.enc --saida ./restauro
//        decifra e extrai (precisa de BACKUP_SENHA no ambiente). Equivale a:
//        openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in AAAA-MM-DD.tar.enc | tar -x -C ./restauro
//   node scripts/restaurar-backup.mjs banco    --pasta ./restauro --projeto ID [--colecao usuarios] [--gravar]
//        grava os documentos do banco.ndjson.gz no Firestore do projeto (credencial: GOOGLE_APPLICATION_CREDENTIALS)
//   node scripts/restaurar-backup.mjs arquivos --projeto ID --bucket NOME [--prefixo acervo/] [--gravar]
//        baixa o espelho cifrado do Nextcloud (NC_USUARIO, NC_APP_SENHA), decifra e sobe cada arquivo ao bucket
//   Contas de login: contas.json; importar com `firebase auth:import` (hashes de senha exigem os parâmetros do projeto original,
//   em Authentication > Usuários > Parâmetros de hash da senha). Quem entra com Google ou link por e-mail não depende de hash.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const req = createRequire(new URL('../functions/package.json', import.meta.url));
const imp = m => import(pathToFileURL(req.resolve(m)).href);
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : ''; };
const gravar = process.argv.includes('--gravar'), etapa = process.argv[2];
const SENHA = process.env.BACKUP_SENHA || '';
if (!SENHA) { console.log('Defina BACKUP_SENHA no ambiente (a mesma senha do segredo do GitHub).'); process.exit(1); }
const decifrar = buf => { const r = spawnSync('openssl', ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-pass', 'env:BACKUP_SENHA'], { input: buf, env: { ...process.env }, maxBuffer: 4 * 1024 ** 3 });
  if (r.status !== 0) throw new Error('não decifrou (senha errada ou arquivo corrompido): ' + String(r.stderr).slice(0, 120)); return r.stdout; };

if (etapa === 'abrir') {
  const pac = arg('pacote'), saida = arg('saida') || './restauro'; if (!pac) { console.log('Informe --pacote'); process.exit(1); }
  mkdirSync(saida, { recursive: true }); writeFileSync(saida + '/pacote.tar', decifrar(readFileSync(pac)));
  execFileSync('tar', ['-xf', saida + '/pacote.tar', '-C', saida]); console.log('Extraído em ' + saida + ':'); console.log(readFileSync(saida + '/resumo.json').toString());
  process.exit(0);
}

const projeto = arg('projeto'); if (!projeto) { console.log('Informe --projeto (de preferência um projeto de TESTE).'); process.exit(1); }
const { initializeApp, applicationDefault } = await imp('firebase-admin/app');
const { getFirestore, Timestamp, GeoPoint } = await imp('firebase-admin/firestore');
const { getStorage } = await imp('firebase-admin/storage');
initializeApp({ credential: applicationDefault(), projectId: projeto });

if (etapa === 'banco') {
  const db = getFirestore(), so = arg('colecao');
  const dec = v => { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(dec);
    if (v.__t === 'ts') return new Timestamp(v.s, v.n); if (v.__t === 'geo') return new GeoPoint(v.la, v.lo); if (v.__t === 'ref') return db.doc(v.p); if (v.__t === 'bytes') return Buffer.from(v.b, 'base64');
    const o = {}; for (const k of Object.keys(v)) o[k] = dec(v[k]); return o; };
  const linhas = gunzipSync(readFileSync((arg('pasta') || './restauro') + '/banco.ndjson.gz')).toString().split('\n').filter(Boolean);
  const alvo = linhas.map(l => JSON.parse(l)).filter(o => !so || o.p.split('/')[0] === so);
  console.log((gravar ? 'Gravando ' : 'Simulação: gravaria ') + alvo.length + ' documento(s) no projeto ' + projeto + (so ? ' (coleção ' + so + ')' : ''));
  if (!gravar) process.exit(0);
  for (let i = 0; i < alvo.length; i += 400) { const b = db.batch(); alvo.slice(i, i + 400).forEach(o => b.set(db.doc(o.p), dec(o.d))); await b.commit(); console.log('… ' + Math.min(i + 400, alvo.length)); }
  console.log('Banco restaurado.'); process.exit(0);
}

if (etapa === 'arquivos') {
  const USU = process.env.NC_USUARIO || 'alan', NS = process.env.NC_APP_SENHA || '', URL0 = (process.env.NC_URL || 'https://cloud.portaldoeducador.com.br').replace(/\/$/, '');
  const AUT = 'Basic ' + Buffer.from(USU + ':' + NS).toString('base64'), base = URL0 + '/remote.php/dav/files/' + encodeURIComponent(USU) + '/' + ['Drive Portal do Educador', '04-Backups', 'arquivos'].map(encodeURIComponent).join('/');
  const get = async c => { const r = await fetch(base + '/' + c, { headers: { Authorization: AUT } }); if (r.status !== 200) throw new Error('GET ' + r.status + ' ' + c); return Buffer.from(await r.arrayBuffer()); };
  const man = JSON.parse(decifrar(await get('_manifesto.json.enc')).toString()), pref = arg('prefixo');
  const lista = Object.entries(man.arquivos).filter(([, m]) => !m.sumiu_em && (!pref || m.c.startsWith(pref)));
  console.log((gravar ? 'Restaurando ' : 'Simulação: restauraria ') + lista.length + ' arquivo(s) no bucket ' + (arg('bucket') || '(informe --bucket)'));
  if (!gravar) process.exit(0);
  const bucket = getStorage().bucket(arg('bucket')); let n = 0;
  for (const [h, m] of lista) { const b = decifrar(await get(h.slice(0, 2) + '/' + h + '.enc')); await bucket.file(m.c).save(b, { contentType: m.tipo || 'application/octet-stream', resumable: false }); if (++n % 100 === 0) console.log('… ' + n); }
  console.log('Arquivos restaurados: ' + n); process.exit(0);
}
console.log('Etapas: abrir | banco | arquivos'); process.exit(1);

// Migra a Formação Continuada do projeto antigo (Academia) para o Portal do Educador 5.0.
// Rodar no Cloud Shell, com uma conta que tenha acesso aos dois projetos:
//   node scripts/migrar-academia.mjs            -> simulação (só conta o que seria copiado)
//   node scripts/migrar-academia.mjs --gravar   -> copia de verdade
// Copia: cursos (com modulos, aulas, questoes, gabarito), trilhas, certificados, cpfs
// e os arquivos de Storage em materiais/ e capas/ (raiz). Reescreve os links do bucket antigo.
// Não copia: equipe (papéis são refeitos no projeto novo), users (o identificador muda de projeto; certificados são religados pelo e-mail
// na primeira entrada, via vincularContaFormacao), municipios (legado) e auditoria.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const ORIGEM = { projectId: 'portal-educador-academia-a1b2c', bucket: 'portal-educador-academia-a1b2c.firebasestorage.app' };
const DESTINO = { projectId: 'portal-educador-5', bucket: 'portal-educador-5.firebasestorage.app' };
const GRAVAR = process.argv.includes('--gravar');

const appO = initializeApp({ credential: applicationDefault(), projectId: ORIGEM.projectId, storageBucket: ORIGEM.bucket }, 'origem');
const appD = initializeApp({ credential: applicationDefault(), projectId: DESTINO.projectId, storageBucket: DESTINO.bucket }, 'destino');
const dbO = getFirestore(appO), dbD = getFirestore(appD);
const stO = getStorage(appO).bucket(), stD = getStorage(appD).bucket();

// troca o nome do bucket em qualquer texto dentro do documento (links de capa e materiais)
function reescrever(v) {
  if (typeof v === 'string') return v.split(ORIGEM.bucket).join(DESTINO.bucket);
  if (Array.isArray(v)) return v.map(reescrever);
  if (v && typeof v === 'object' && v.constructor === Object) {
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = reescrever(x); return o;
  }
  return v; // Timestamp, GeoPoint, referências: ficam como estão
}

const cont = {};
async function copiarColecao(caminho, sub = []) {
  const snap = await dbO.collection(caminho).get();
  cont[caminho.replace(/\/[^/]+\//g, '/*/')] = (cont[caminho.replace(/\/[^/]+\//g, '/*/')] || 0) + snap.size;
  for (const d of snap.docs) {
    const alvo = dbD.doc(`${caminho}/${d.id}`);
    if (GRAVAR) {
      const existe = (await alvo.get()).exists;
      if (existe) { cont['ja_existia'] = (cont['ja_existia'] || 0) + 1; }
      else await alvo.set(reescrever(d.data()));
    }
    for (const s of sub) await copiarColecao(`${caminho}/${d.id}/${s}`);
  }
}

async function copiarArquivos(prefixo, soRaiz) {
  const [arquivos] = await stO.getFiles({ prefix: prefixo });
  let n = 0;
  for (const f of arquivos) {
    if (soRaiz && f.name.slice(prefixo.length).includes('/')) continue; // capas/jogos/... é do Portal
    n++;
    if (!GRAVAR) continue;
    const destino = stD.file(f.name);
    const [existe] = await destino.exists();
    if (existe) continue;
    await f.copy(destino); // cópia entre buckets preserva metadados, inclusive o token de download
    const [meta] = await f.getMetadata();
    if (meta.metadata) await destino.setMetadata({ metadata: meta.metadata, contentType: meta.contentType, cacheControl: meta.cacheControl });
  }
  cont[`storage:${prefixo}`] = n;
}

await copiarColecao('cursos', ['modulos', 'aulas', 'questoes', 'gabarito']);
await copiarColecao('trilhas');
await copiarColecao('certificados');
await copiarColecao('cpfs');
await copiarArquivos('materiais/', false);
await copiarArquivos('capas/', true);

console.log(GRAVAR ? 'COPIADO:' : 'SIMULAÇÃO (nada foi gravado):');
console.table(cont);

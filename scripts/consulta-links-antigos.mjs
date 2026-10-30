// Só leitura: procura no banco links que apontam para o site antigo (www.portaldoeducador.com.br / Webnode),
// que vão quebrar quando o www passar a ser o Portal 5.0.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), limpo = t => String(t).replace(/[{}"\n]/g, ' ');
const ANTIGO = /(https?:\/\/)?(www\.)?portaldoeducador\.com\.br(?!\.)|webnode/i;
const achados = [];
function varrer(onde, v, cam) {
  if (typeof v === 'string') { if (ANTIGO.test(v) && !/(app|jogos|portal360|sala|studio|lousa|cloud|restrito)\.portaldoeducador/.test(v) && !/@portaldoeducador\.com\.br/.test(v)) achados.push(onde + ' ' + cam + ' = ' + v.slice(0, 120)); return; }
  if (Array.isArray(v)) return v.forEach((x, i) => varrer(onde, x, cam + '[' + i + ']'));
  if (v && typeof v === 'object' && !v.toMillis) for (const [k, x] of Object.entries(v)) varrer(onde, x, cam ? cam + '.' + k : k);
}
const cont = [];
for (const c of ['config', 'jogos', 'videos', 'museus', 'dicas', 'apps', 'aplicativos', 'noticias', 'acervo', 'municipios', 'cursos', 'datas', 'historias', 'colorir']) {
  try { const s = await db.collection(c).get(); s.forEach(d => varrer(c + '/' + d.id, d.data(), '')); cont.push(c + ' ' + s.size); }
  catch (e) { cont.push(c + ' ERRO'); }
}
console.log('::notice::varridos: ' + cont.join(', ') + ' · links para o site antigo: ' + achados.length);
for (let i = 0; i < achados.length; i += 8) console.log('::warning::' + limpo(achados.slice(i, i + 8).join(' | ')));

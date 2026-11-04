// Jogos para dentro do Portal (nov/2026): troca jogos.portaldoeducador.com.br/X/ por app.portaldoeducador.com.br/jogos/X/ no catálogo.
// Sem o -gravar só mostra o que mudaria. Com o -gravar grava e registra na auditoria (o link antigo fica guardado em url_antiga).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue, Timestamp } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), GRAVAR = globalThis.GRAVAR === true;
const ANT = 'https://jogos.portaldoeducador.com.br/', NOVA = 'https://www.portaldoeducador.com.br/jogos/';
const s = await db.collection('jogos').get(); const muda = [];
s.forEach(d => { const u = String(d.data().url || ''); if (u.startsWith(ANT)) muda.push({ ref: d.ref, id: d.id, de: u, para: NOVA + u.slice(ANT.length) }); });
console.log('::notice::jogos no catálogo: ' + s.size + ' · com o endereço antigo: ' + muda.length + (GRAVAR ? ' · GRAVANDO' : ' · só simulação'));
s.forEach(d => { const x = d.data(), u = String(x.url || ''); if (!u.startsWith(ANT) && !u.startsWith(NOVA)) console.log('::notice::FORA: ' + (x.titulo || '-') + ' · ' + (x.publicado ? 'publicado' : 'rascunho') + ' · ' + (u || '(sem link)')); });
muda.slice(0, 5).forEach(m => console.log('::notice::' + m.de + ' -> ' + m.para));
if (GRAVAR && muda.length) {
  for (let i = 0; i < muda.length; i += 200) { const b = db.batch(); muda.slice(i, i + 200).forEach(m => b.update(m.ref, { url: m.para, url_antiga: m.de, origem: 'portal' })); await b.commit(); }
  await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: Timestamp.fromMillis(Date.now() + 183 * 864e5), acao: 'alterou', origem: 'funcao', colecao: 'jogos', doc: '(' + muda.length + ' jogos)',
    autor_tipo: 'sistema', autor_email: 'manutencao', perfil: 'admin', detalhe: 'Jogos trazidos para dentro do Portal: ' + muda.length + ' links trocados de jogos.portaldoeducador.com.br para app.portaldoeducador.com.br/jogos/', campos: ['url'], valores: {} });
  console.log('::notice::gravado: ' + muda.length + ' jogos');
}

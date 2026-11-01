// Fotos dos cards do Portal IA com os personagens da NEWPC (uniforme), geradas a partir das fotos de referência
// (scripts/referencias/personagens). Como administrador, pela ação foto_ref do Portal IA. Grava em functions/saida/ (2 opções por card).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const db = getFirestore(), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const ad = (await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get()).docs[0];
const tk = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(ad.id), returnSecureToken: true }) })).json()).idToken;
const ref = n => ({ mime: 'image/webp', dados: readFileSync('../scripts/referencias/personagens/' + n + '.webp').toString('base64') });
// [card, personagens (na ordem da cena), cena]
const CARDS = [
  ['plano', ['prof-loira'], 'a professora sentada à mesa do professor, sorrindo, escrevendo o plano de aula num caderno ao lado de um notebook aberto, livros didáticos empilhados'],
  ['sequencia', ['prof-barba'], 'o professor em pé ao lado do quadro branco, colando em sequência cartões coloridos numerados de 1 a 5 ligados por setas desenhadas'],
  ['planejamento', ['prof-colar'], 'a professora diante de um grande planejador anual de parede, com post-its coloridos organizados por bimestre, segurando uma caneta'],
  ['projeto', ['prof-ruiva', 'menina', 'menino'], 'a professora agachada junto de uma menina e um menino montando uma maquete de rio e cidade com garrafas pet e papelão sobre a mesa'],
  ['rubrica', ['prof-grisalho'], 'o professor sentado ao fundo da sala com uma prancheta, avaliando com atenção um seminário, marcando uma tabela de critérios'],
  ['atividade', ['menina', 'menino', 'prof-loira'], 'uma menina e um menino em carteiras lado a lado fazendo uma ficha de atividade impressa com lápis, a professora se inclinando para ajudar'],
  ['prova', ['adolescente'], 'o adolescente concentrado fazendo uma prova em papel na carteira, lápis na mão, colegas desfocados ao fundo'],
  ['inclusao', ['prof-ruiva', 'menino'], 'a professora ajoelhada ao lado do menino na carteira, mostrando cartões com figuras grandes e coloridas, clima de paciência e carinho'],
  ['explicar', ['cientista', 'menina', 'menino'], 'o cientista de jaleco amarelo mostrando um modelo do sistema solar com bolinhas para a menina e o menino, que olham encantados'],
  ['lista', ['menino'], 'o menino resolvendo exercícios num caderno, com três adesivos de estrela coloridos na folha, expressão de quem está conseguindo'],
  ['simulado', ['adolescente', 'jovem-oculos'], 'dois estudantes em carteiras preenchendo um cartão-resposta de múltipla escolha com bolinhas, concentrados'],
  ['diagnostica', ['prof-colar'], 'a professora à mesa analisando pilhas de folhas dos alunos e anotando num gráfico simples de barras no caderno, pensativa'],
  ['resumo', ['adolescente'], 'o adolescente estudando com o caderno aberto, marca-texto amarelo na mão e post-its coloridos na página, mochila ao lado'],
  ['cacapalavras', ['menina'], 'a menina sorrindo circulando palavras numa folha de caça-palavras sobre a carteira com um lápis de cor'],
  ['parecer', ['prof-loira'], 'a professora escrevendo com cuidado um relatório no notebook, com uma pasta de trabalhos dos alunos aberta ao lado, xícara de café'],
  ['redacao', ['prof-grisalho'], 'o professor corrigindo redações manuscritas com caneta vermelha na mesa, pilha de folhas pautadas, óculos, concentrado'],
  ['recado', ['prof-barba'], 'o professor no corredor da escola digitando uma mensagem no celular, sorrindo, mural de avisos ao fundo'],
  ['dinamica', ['prof-ruiva', 'menina', 'menino'], 'a professora conduzindo uma brincadeira com as crianças em roda no centro da sala, todos animados, carteiras afastadas']
];
const so = (process.env.SO || '').split(',').filter(Boolean);
mkdirSync('saida', { recursive: true });
let ok = 0, falhas = 0;
const fila = CARDS.filter(c => !so.length || so.includes(c[0])).flatMap(c => [[...c, 1], [...c, 2]]);
async function um([k, pers, cena, n]) {
  for (let t = 0; t < 2; t++) {
    const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ data: { acao: 'foto_ref', descricao: cena, refs: pers.map(ref) } }) })).json().catch(e => ({ error: { message: e.message } }));
    if (r.result && r.result.dados) { writeFileSync(`saida/${k}-${n}.${/png/.test(r.result.mime) ? 'png' : 'jpg'}`, Buffer.from(r.result.dados, 'base64')); ok++; return; }
    if (t) { falhas++; console.log('::warning::' + k + '-' + n + ': ' + JSON.stringify(r.error || r).slice(0, 200)); }
  }
}
for (let i = 0; i < fila.length; i += 4) await Promise.all(fila.slice(i, i + 4).map(um));
console.log('::notice::fotos geradas: ' + ok + ' de ' + fila.length + (falhas ? ' (' + falhas + ' falharam)' : ''));

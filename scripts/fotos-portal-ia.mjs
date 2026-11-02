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
// o tablet da NEWPC nas carteiras: EduDock (Galaxy Tab A7 10,4" SM-T505 num suporte de proteção impresso, perna rebatível a 45°)
const EDUDOCK = 'um tablet na horizontal dentro do suporte EduDock (moldura azul, perna verde atrás) apoiado sobre a carteira, tela acesa com conteúdo educativo colorido';
const TABLET_MAO = 'um tablet dentro do suporte EduDock (moldura azul com o logo NEWPC), tela acesa';
const DOCK = ['edudock-frente', 'edudock-verso'].map(n => ({ mime: 'image/webp', dados: readFileSync('../scripts/referencias/' + n + '.webp').toString('base64') }));
// padrão visual de todas as fotos: fidelidade total aos personagens + luz e profundidade de cinema
const ESTILO = '. Fidelidade total às pessoas de referência: mesmo rosto, idade, cabelo, óculos, tom de pele e uniforme, sem embelezar nem mudar traços. Estética de fotografia cinematográfica de campanha publicitária: imagem clara e luminosa, luz suave de janela com contraluz quente, cores ricas e vibrantes, profundidade de campo rasa (fundo levemente desfocado, bokeh), sensação de volume e profundidade 3D, nitidez alta nos rostos e no tablet, lente de 50mm';
// [card, personagens (na ordem da cena), cena]
const CARDS = [
  ['defeito', ['prof-barba'], 'o professor no corredor da escola apontando o celular para uma pequena etiqueta com QR code colada num carrinho de Chromebooks, a tela do celular mostrando um formulário de chamado técnico, expressão tranquila de quem resolve rápido'],
  ['relatorios', ['prof-colar'], 'a professora sentada à mesa da sala dos professores escrevendo o parecer de um aluno no notebook, com uma pasta de registros aberta ao lado e um caderno de anotações, expressão atenta e cuidadosa'],
  ['plano', ['prof-loira'], 'a professora em pé na frente da sala, sorrindo, segurando nas mãos ' + TABLET_MAO + ' enquanto planeja a aula, notebook e livros na mesa ao lado'],
  ['sequencia', ['prof-barba'], 'o professor em pé ao lado do quadro branco, colando em sequência cartões coloridos numerados de 1 a 5 ligados por setas desenhadas'],
  ['planejamento', ['prof-colar'], 'a professora diante de um grande planejador anual de parede, com post-its coloridos organizados por bimestre, segurando uma caneta'],
  ['projeto', ['prof-ruiva', 'menina', 'menino'], 'a professora agachada junto de uma menina e um menino montando uma maquete de rio e cidade com garrafas pet e papelão sobre a mesa'],
  ['rubrica', ['prof-grisalho'], 'o professor sentado ao fundo da sala segurando ' + TABLET_MAO + ', avaliando com atenção um seminário dos alunos e marcando critérios na tela'],
  ['atividade', ['menina', 'menino', 'prof-loira'], 'uma menina e um menino em carteiras lado a lado fazendo a atividade, cada um com ' + EDUDOCK + ', a professora se inclinando para ajudar'],
  ['prova', ['adolescente'], 'o adolescente concentrado fazendo uma prova online na carteira em ' + EDUDOCK + ', colegas desfocados ao fundo também com tablets nas carteiras'],
  ['inclusao', ['prof-ruiva', 'menino'], 'a professora ajoelhada ao lado do menino na carteira, apontando para ' + EDUDOCK + ' que mostra figuras grandes e coloridas, clima de paciência e carinho'],
  ['explicar', ['cientista', 'menina', 'menino'], 'o cientista de jaleco amarelo segurando ' + TABLET_MAO + ' que mostra o sistema solar, explicando para a menina e o menino, que olham encantados'],
  ['lista', ['menino'], 'o menino resolvendo exercícios em ' + EDUDOCK + ' sobre a carteira, com um caderno aberto ao lado, expressão de quem está conseguindo'],
  ['simulado', ['adolescente', 'jovem-oculos'], 'dois estudantes em carteiras, cada um com ' + EDUDOCK + ', respondendo um simulado de múltipla escolha na tela, concentrados'],
  ['diagnostica', ['prof-colar'], 'a professora em pé entre as carteiras segurando ' + TABLET_MAO + ' que mostra um gráfico de barras com o resultado da turma, pensativa; alunos ao fundo com tablets nas carteiras'],
  ['resumo', ['adolescente'], 'o adolescente estudando com o caderno aberto, marca-texto amarelo na mão e post-its coloridos na página, mochila ao lado'],
  ['cacapalavras', ['menina'], 'a menina sorrindo circulando palavras numa folha de caça-palavras sobre a carteira com um lápis de cor'],
  ['parecer', ['prof-loira'], 'a professora escrevendo com cuidado um relatório no notebook, com uma pasta de trabalhos dos alunos aberta ao lado, xícara de café'],
  ['redacao', ['prof-grisalho'], 'o professor corrigindo redações manuscritas com caneta vermelha na mesa, pilha de folhas pautadas, óculos, concentrado'],
  ['recado', ['prof-barba'], 'o professor no corredor da escola digitando uma mensagem no celular, sorrindo, mural de avisos ao fundo'],
  ['dinamica', ['prof-ruiva', 'menina', 'menino'], 'a professora segurando ' + TABLET_MAO + ' conduzindo uma brincadeira com as crianças em roda no centro da sala, todos animados, carteiras afastadas']
];
const so = (process.env.SO || '').split(',').filter(Boolean);
mkdirSync('saida', { recursive: true });
let ok = 0, falhas = 0;
const fila = CARDS.filter(c => !so.length || so.includes(c[0])).flatMap(c => [[...c, 1], [...c, 2]]);
async function um([k, pers, cena, n]) {
  for (let t = 0; t < 2; t++) {
    const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ data: { acao: 'foto_ref', descricao: cena + ESTILO, refs: pers.map(ref), objetos: /EduDock/.test(cena) ? DOCK : [] } }) })).json().catch(e => ({ error: { message: e.message } }));
    if (r.result && r.result.dados) { writeFileSync(`saida/${k}-${n}.${/png/.test(r.result.mime) ? 'png' : 'jpg'}`, Buffer.from(r.result.dados, 'base64')); ok++; return; }
    if (t) { falhas++; console.log('::warning::' + k + '-' + n + ': ' + JSON.stringify(r.error || r).slice(0, 200)); }
  }
}
for (let i = 0; i < fila.length; i += 4) await Promise.all(fila.slice(i, i + 4).map(um));
console.log('::notice::fotos geradas: ' + ok + ' de ' + fila.length + (falhas ? ' (' + falhas + ' falharam)' : ''));

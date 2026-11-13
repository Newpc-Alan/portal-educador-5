// Artes dos modelos do Gerador de Certificados (nov/2026): personagens em estilo animação 3D, fundo branco, sem texto.
// Gera pelo Portal IA (acao imagem, formato quadrado) como administrador e guarda em functions/saida/ para revisão. Não publica nada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getAuth } = await import(pathToFileURL(req.resolve('firebase-admin/auth')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { getStorage } = await import(pathToFileURL(req.resolve('firebase-admin/storage')).href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5', storageBucket: 'portal-educador-5.firebasestorage.app' });
const db = getFirestore(), API = 'AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0';
const ad = (await db.collection('usuarios').where('email', '==', 'alan@newpc.com.br').limit(1).get()).docs[0];
const tk = (await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await getAuth().createCustomToken(ad.id), returnSecureToken: true }) })).json()).idToken;
const BASE = 'personagem em estilo de filme de animação 3D, fofo e expressivo, olhos grandes, corpo inteiro visível, uniforme escolar liso (camiseta branca com gola e detalhes azul-marinho, bermuda ou saia azul-marinho, tênis branco) SEM logotipo nem escrita; fundo branco puro e liso, sem chão, sem sombra no fundo, sem moldura; iluminação suave de estúdio; ';
const ARTES = {
  'escritor-menino': 'menino brasileiro de 8 anos, cabelo castanho bagunçado, correndo feliz segurando um lápis gigante azul como uma lança, sorriso largo',
  'escritor-menina': 'menina brasileira de 8 anos, cabelos castanhos longos com laço azul, pulando de alegria abraçada a um caderno espiral azul, piscando um olho',
  'trofeu-menino': 'menino brasileiro negro de 9 anos, cabelo crespo curto, erguendo com as duas mãos um troféu dourado brilhante, rindo orgulhoso',
  'medalha-menina': 'menina brasileira de 9 anos de pele morena, tranças, com uma medalha dourada no peito, punho erguido em comemoração',
  'globo-menino': 'menino brasileiro de 10 anos de óculos, sorrindo, apoiado numa pilha de livros com um globo terrestre ao lado',
  'leitora-menina': 'menina brasileira loira de 8 anos sentada sobre uma pilha de livros coloridos, lendo um livro aberto encantada',
  'formatura-dupla': 'menino e menina brasileiros de 10 anos com beca azul-marinho e capelo, jogando o capelo para cima, felizes',
  'infantil-blocos': 'criança brasileira de 5 anos sentada brincando com blocos de montar coloridos e estrelinhas douradas ao redor, encantada',
  'ciencia-menina': 'menina brasileira de 10 anos de pele parda, cabelo cacheado preso, segurando uma lupa grande e um tubo de ensaio com líquido verde, curiosa',
  'arte-menino': 'menino brasileiro de 8 anos de origem asiática, segurando um pincel e uma paleta de tintas coloridas, com respingos de tinta, rindo',
  'esporte-menino': 'menino brasileiro de 9 anos chutando uma bola de futebol, em movimento, alegre',
  'amizade-dupla': 'duas crianças brasileiras de 8 anos, um menino negro e uma menina de cabelo castanho, abraçados de lado e sorrindo, fazendo sinal de positivo',
  'matematica-menina': 'menina brasileira de 9 anos segurando uma régua grande e cubos de montar coloridos empilhados, sorrindo confiante',
  'adolescente-trofeu': 'adolescente brasileira de 14 anos, cabelo preto liso, segurando um troféu dourado e um certificado enrolado com fita azul, sorriso confiante'
};
const so = String(process.env.SO || '').split(',').map(s => s.trim()).filter(Boolean);
mkdirSync('saida', { recursive: true });
for (const [nome, desc] of Object.entries(ARTES)) {
  if (so.length && !so.includes(nome)) continue;
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'imagem', descricao: BASE + desc, estilo: 'cartoon', onde: 'q1' } }) })).json().catch(() => ({}));
  const cam = r.result && r.result.caminho;
  console.log('::notice::' + nome + ': ' + (cam ? 'ok' : JSON.stringify(r.error || {}).slice(0, 200)));
  if (cam) { const [b] = await getStorage().bucket().file(cam).download(); writeFileSync(`saida/cert-${nome}.${cam.split('.').pop()}`, b); await getStorage().bucket().file(cam).delete().catch(() => {}); }
}

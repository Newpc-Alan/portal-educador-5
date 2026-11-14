// Ilustrações dos jogos de Ciências do Motor de Jogos (nov/2026): uma por nível, em estilo animação 3D, sem texto.
// São ilustrações de AMBIENTAÇÃO do tema, não esquemas científicos: nada de órgãos rotulados nem planetas em ordem, para não ensinar errado.
// Gera pelo Portal IA (acao imagem, horizontal 4:3) como administrador e guarda em functions/saida/ para revisão. Não publica nada.
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
const BASE = 'ilustração em estilo de filme de animação 3D infantil, colorida, alegre e acolhedora, personagens fofos de olhos grandes, composição horizontal com o assunto no centro, iluminação suave; SEM nenhuma palavra, letra, número, rótulo, seta ou legenda na imagem; ';
const ARTES = {
  'corpo-humano-1': 'duas crianças brasileiras de 7 anos, um menino negro e uma menina de cabelo castanho, se alongando e pulando felizes num pátio de escola, mostrando braços, pernas e mãos',
  'corpo-humano-2': 'menina brasileira de 7 anos de olhos fechados cheirando uma flor, com uma fatia de melancia na outra mão e um passarinho cantando ao lado, num jardim',
  'corpo-humano-3': 'menino brasileiro de 7 anos lavando as mãos com bastante espuma de sabão numa pia de escola, sorrindo, com uma escova de dentes e uma toalha ao lado',
  'corpo-humano-4': 'menina brasileira de 10 anos sentada num banco de praça comendo uma maçã e respirando fundo de olhos fechados, só árvores e céu azul ao fundo, sem prédios, sem placas, expressão de bem-estar',
  'corpo-humano-5': 'menino brasileiro de 10 anos correndo numa quadra de escola com a mão no peito sentindo o coração bater, um coração vermelho estilizado de desenho animado brilhando sobre a camiseta',
  'corpo-humano-6': 'prato de comida brasileira bem colorido com arroz, feijão, frango grelhado e salada, um copo de água e frutas ao lado, sobre uma mesa de madeira, visto de cima em ângulo',
  'sistema-solar-1': 'paisagem dividida ao meio: de um lado o dia com sol brilhante e céu azul, do outro a noite com lua e muitas estrelas, uma criança brasileira olhando para o céu no meio',
  'sistema-solar-2': 'o planeta Terra visto do espaço em estilo realista de animação, SEM rosto e SEM olhos, azul com nuvens brancas e continentes verdes e marrons mostrando a América do Sul, com uma única Lua cinzenta pequena ao fundo, também sem rosto, e estrelas',
  'sistema-solar-3': 'criança brasileira de 9 anos segurando um calendário de parede sem escrita e apontando para a Lua no céu ao entardecer, pela janela do quarto',
  'sistema-solar-4': 'criança brasileira de 10 anos num pátio ensolarado observando a própria sombra comprida no chão, com o sol baixo no horizonte',
  'sistema-solar-5': 'criança brasileira de 10 anos com um telescópio num quintal à noite observando uma grande lua cheia brilhante no céu estrelado',
  'sistema-solar-6': 'criança astronauta brasileira flutuando no espaço e acenando, traje branco liso sem emblema, sem bandeira e sem nenhuma escrita, com o planeta Saturno e seus anéis grandes ao fundo e estrelas ao redor',
  'explorando-habitats-1': 'cena dividida em três ambientes lado a lado: fundo do mar com peixes coloridos, floresta com um macaco numa árvore e um lago com um jacaré tomando sol',
  'explorando-habitats-2': 'um pato nadando num lago mostrando os pés, um peixe colorido debaixo da água e um tatu na margem, cena de natureza alegre',
  'explorando-habitats-3': 'uma planta com flores amarelas num jardim ensolarado, com as raízes aparecendo num corte do solo, uma abelha pousando na flor e um regador ao lado',
  'explorando-habitats-4': 'uma capivara comendo capim à beira de um rio, um ninho com ovos de passarinho num galho e um sapo saltando, cena de natureza brasileira',
  'explorando-habitats-5': 'cinco animais lado a lado à beira de um laguinho olhando para a frente: uma arara azul e amarela num galho, um cachorro vira-lata caramelo, um peixe dourado comum com a cabeça para fora da água do laguinho, um jabuti e um sapo verde, fundo de natureza simples',
  'explorando-habitats-6': 'paisagem do Pantanal brasileiro ao amanhecer com um tuiuiú de pescoço preto e vermelho na água rasa, um jacaré na margem, capivaras e um ipê amarelo florido'
};
const so = String(process.env.SO || '').split(',').map(s => s.trim()).filter(Boolean);
mkdirSync('saida', { recursive: true });
for (const [nome, desc] of Object.entries(ARTES)) {
  if (so.length && !so.includes(nome)) continue;
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'imagem', descricao: BASE + desc, estilo: 'cartoon', onde: 'topo' } }) })).json().catch(() => ({}));
  const cam = r.result && r.result.caminho;
  console.log('::notice::' + nome + ': ' + (cam ? 'ok' : JSON.stringify(r.error || {}).slice(0, 200)));
  if (cam) { const [b] = await getStorage().bucket().file(cam).download(); writeFileSync(`saida/jogo-${nome}.${cam.split('.').pop()}`, b); await getStorage().bucket().file(cam).delete().catch(() => {}); }
}

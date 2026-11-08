// Gera fotos candidatas para um card do Início pelo próprio Portal IA (estilo foto realista), como administrador,
// e guarda em functions/saida/ para baixar como artefato. Não publica nada.
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
const DESC = [
  'Professora brasileira de uns 40 anos, cabelo castanho preso, óculos, camiseta preta com o texto NEW PC EDUCAÇÃO em branco, sentada à mesa da sala dos professores escrevendo com atenção o parecer de um aluno no notebook; ao lado, uma pasta aberta com fotos 3x4 de alunos e fichas com anotações à mão; luz natural da janela, ambiente escolar brasileiro acolhedor, foto realista, enquadramento centralizado, sem texto na tela legível',
  'Professor brasileiro de uns 35 anos, barba curta, camiseta preta com o texto NEW PC EDUCAÇÃO em branco, sentado numa carteira da sala de aula vazia depois da aula, revisando no tablet o parecer descritivo de um aluno, com um caderno de anotações e post-its coloridos ao lado; luz do fim de tarde, cores quentes, foto realista, assunto no centro',
  'Close de uma mesa de professora: mãos digitando num notebook com um relatório de aluno na tela (texto ilegível, com uma pequena foto de criança e gráfico de evolução), ao lado uma caneca, um estojo e uma ficha de observações escrita à mão com estrelinhas; ao fundo desfocado, sala de aula brasileira colorida; foto realista, luz natural'
];
mkdirSync('saida', { recursive: true });
for (let i = 0; i < DESC.length; i++) {
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'imagem', descricao: DESC[i], estilo: 'realista' } }) })).json().catch(() => ({}));
  const cam = r.result && (r.result.caminho || (r.result.imagem && r.result.imagem.caminho));
  console.log('::notice::opção ' + (i + 1) + ': ' + JSON.stringify(r.result ? Object.keys(r.result) : r.error).slice(0, 300) + ' ' + (cam || ''));
  if (cam) { const [b] = await getStorage().bucket().file(cam).download(); writeFileSync(`saida/opcao-${i + 1}.${cam.split('.').pop()}`, b); await getStorage().bucket().file(cam).delete().catch(() => {}); }
}

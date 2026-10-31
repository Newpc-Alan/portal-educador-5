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
  'Professora brasileira de uns 35 anos, sorrindo, em pé na frente da turma, segurando um celular e tocando na tela para enviar um vídeo; ao fundo, alunos de 10 a 12 anos sentados nas carteiras olham empolgados para os tablets que acabaram de acender com o mesmo vídeo; sala de aula de escola pública brasileira, clara, iluminação natural da janela; camisetas pretas lisas; enquadramento médio, assunto no centro',
  'Close de mãos de um aluno de 11 anos segurando um tablet numa carteira escolar, a tela mostrando um vídeo educativo de ciências com um planeta; ao lado, de leve fora de foco, a professora sorrindo com um notebook; sala de aula brasileira iluminada, cores vivas, assunto no centro',
  'Professor brasileiro de uns 40 anos, sentado à mesa da sala dos professores com notebook aberto, arrastando um arquivo de apresentação de slides e um vídeo para uma turma; expressão satisfeita; na parede ao fundo um quadro de avisos escolar colorido; luz natural, assunto no centro'
];
mkdirSync('saida', { recursive: true });
for (let i = 0; i < DESC.length; i++) {
  const r = await (await fetch('https://southamerica-east1-portal-educador-5.cloudfunctions.net/portalIa', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
    body: JSON.stringify({ data: { acao: 'imagem', descricao: DESC[i], estilo: 'realista' } }) })).json().catch(() => ({}));
  const cam = r.result && (r.result.caminho || (r.result.imagem && r.result.imagem.caminho));
  console.log('::notice::opção ' + (i + 1) + ': ' + JSON.stringify(r.result ? Object.keys(r.result) : r.error).slice(0, 300) + ' ' + (cam || ''));
  if (cam) { const [b] = await getStorage().bucket().file(cam).download(); writeFileSync(`saida/opcao-${i + 1}.${cam.split('.').pop()}`, b); await getStorage().bucket().file(cam).delete().catch(() => {}); }
}

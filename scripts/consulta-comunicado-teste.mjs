// Envia UM e-mail de teste do Comunicado (mesmo modelo da tela) para o endereço em TESTE_PARA, pela conta configurada em config/comunicados.
// A senha é lida do Secret Manager (COMUNICADOS_SMTP_SENHA) com a conta de serviço; nunca aparece no log.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const nodemailer = (await import(pathToFileURL(req.resolve('nodemailer')).href)).default;
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const { montarEmail, config } = await import(pathToFileURL(process.cwd() + '/comunicados.js').href);
const para = String(process.env.TESTE_PARA || 'alan@newpc.com.br').trim().toLowerCase();
const cliente = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
let senha = '';
try { const r = await cliente.request({ url: 'https://secretmanager.googleapis.com/v1/projects/portal-educador-5/secrets/COMUNICADOS_SMTP_SENHA/versions/latest:access' });
  senha = Buffer.from(r.data.payload.data, 'base64').toString('utf8'); }
catch (e) { console.log('::error::Não consegui ler a senha no Secret Manager: ' + (e.response && e.response.status) + ' ' + String(e.message).slice(0, 120)); process.exit(1); }
const db = getFirestore(), c = await config(db);
console.log('::notice::Enviando teste de ' + c.remetente + ' por ' + c.host + ':' + c.porta + ' para ' + para);
const com = { tipo: 'info', assunto: '[TESTE] Comunicado do Portal do Educador', mensagem: 'Este é um teste da nova ferramenta de Comunicados por e-mail do Portal do Educador.\n\nSe você recebeu esta mensagem na caixa de entrada, o envio pela conta comunicados@portaldoeducador.com.br está funcionando.\n\nConfira também o remetente, o nome e a aparência no celular.', botao_texto: 'Abrir o Portal', botao_link: 'https://app.portaldoeducador.com.br/entrar/' };
for (const porta of [c.porta, c.porta === 465 ? 587 : 465]) {
  try {
    const t = nodemailer.createTransport({ host: c.host, port: porta, secure: porta === 465, requireTLS: porta === 587, auth: { user: c.remetente, pass: senha }, connectionTimeout: 20000 });
    const info = await t.sendMail(montarEmail(c, com, { email: para, nome: 'Alan' }, 'teste'));
    console.log('::notice::Enviado pela porta ' + porta + '. Resposta do servidor: ' + String(info.response || '').slice(0, 120));
    await db.collection('auditoria').add({ em: FieldValue.serverTimestamp(), expira_em: new Date(Date.now() + 183 * 86400000), acao: 'alterou', origem: 'robo', colecao: 'comunicados_email', doc: 'teste',
      autor_uid: '', autor_tipo: 'sistema', autor_email: '', perfil: '', detalhe: 'Teste de comunicado enviado pelo robô para ' + para + ' (porta ' + porta + ')', campos: [], valores: {} });
    if (porta !== c.porta) console.log('::warning::A porta ' + c.porta + ' falhou e a ' + porta + ' funcionou: ajuste a porta em Configuração do envio.');
    process.exit(0);
  } catch (e) { console.log('::warning::Porta ' + porta + ' falhou: ' + String(e.message).replace(senha, '***').slice(0, 200)); }
}
console.log('::error::O envio falhou nas duas portas.'); process.exit(1);

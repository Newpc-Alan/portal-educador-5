// Backup do banco (Firestore) para uma pasta do Google Drive escolhida pelo administrador, ou para baixar no computador
// (HD externo, servidor da empresa): o arquivo fica 7 dias em downloads/ no bucket de São Paulo, lido só pelo administrador (regras).
// Caminho: exportação oficial do Firestore (inclui subcoleções) num bucket temporário em São Paulo
// -> empacotada num .tar.gz -> enviada ao Drive. O bucket temporário apaga tudo em 7 dias.
// Restaurar: descompactar, subir a pasta para um bucket e rodar `gcloud firestore import` (procedimento guiado, nunca por botão).
// O Drive precisa ser um Drive compartilhado (Workspace) com a conta das funções como "Gerente de conteúdo":
// conta de serviço não tem espaço próprio no Drive, então não grava em "Meu Drive" de uma pessoa.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { gzipSync } from 'node:zlib';

const PROJETO = 'portal-educador-5';
export const BUCKET_BACKUP = 'portal-educador-5-backups';
const META = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default';
const OPC = { region: 'southamerica-east1' };

async function exigirAdmin(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const u = (await getFirestore().doc(`usuarios/${req.auth.uid}`).get()).data();
  if (!u || u.perfil !== 'admin' || u.status !== 'ativo') throw new HttpsError('permission-denied', 'Somente administrador.');
  return u;
}
async function token(escopo) {
  const r = await fetch(`${META}/token${escopo ? '?scopes=' + encodeURIComponent(escopo) : ''}`, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!r.ok) throw new Error('token ' + r.status);
  return (await r.json()).access_token;
}
async function emailRobo() {
  try { const r = await fetch(`${META}/email`, { headers: { 'Metadata-Flavor': 'Google' } }); return r.ok ? (await r.text()).trim() : ''; } catch (e) { return ''; }
}
const DRIVE = 'https://www.googleapis.com/auth/drive';
export function pastaDoLink(link) {
  const s = String(link || '').trim();
  const m = /\/folders\/([A-Za-z0-9_-]{10,})/.exec(s) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(s) || /^([A-Za-z0-9_-]{10,})$/.exec(s);
  return m ? m[1] : '';
}
async function drive(caminho, opcoes = {}) {
  const t = await token(DRIVE);
  const r = await fetch('https://www.googleapis.com/' + caminho, { ...opcoes, headers: { Authorization: `Bearer ${t}`, ...(opcoes.headers || {}) } });
  if (!r.ok) {
    const txt = (await r.text()).slice(0, 300);
    if (/storageQuotaExceeded|do not have storage quota/i.test(txt)) throw new HttpsError('failed-precondition', 'Essa pasta fica no "Meu Drive" de uma pessoa. Use uma pasta dentro de um Drive compartilhado da NEWPC.');
    if (r.status === 404) throw new HttpsError('not-found', 'Pasta não encontrada. Confira o link e se a conta do robô foi adicionada ao Drive compartilhado.');
    if (r.status === 403) throw new HttpsError('permission-denied', 'O robô não tem permissão nessa pasta. Adicione o e-mail dele como "Gerente de conteúdo" do Drive compartilhado.');
    throw new HttpsError('internal', 'Drive respondeu ' + r.status + ': ' + txt);
  }
  return r.status === 204 ? {} : r.json();
}
async function enviarDrive(pasta, nome, buf, tipo) {
  const ini = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,size`, {
    method: 'POST', headers: { Authorization: `Bearer ${await token(DRIVE)}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': tipo, 'X-Upload-Content-Length': String(buf.length) },
    body: JSON.stringify({ name: nome, parents: [pasta] })
  });
  if (!ini.ok) { const txt = await ini.text(); if (/storage quota/i.test(txt)) throw new HttpsError('failed-precondition', 'A pasta precisa estar num Drive compartilhado.'); throw new HttpsError('internal', 'Drive (início do envio) ' + ini.status + ': ' + txt.slice(0, 200)); }
  const r = await fetch(ini.headers.get('location'), { method: 'PUT', headers: { 'Content-Length': String(buf.length), 'Content-Type': tipo }, body: buf });
  if (!r.ok) throw new HttpsError('internal', 'Drive (envio) ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

// .tar mínimo (ustar), sem dependência externa
export function tar(arquivos) {
  const blocos = [];
  for (const { nome, dados } of arquivos) {
    const h = Buffer.alloc(512), n = Buffer.from(nome);
    if (n.length > 100) {
      // ustar: nome longo vai dividido em prefixo (até 155) + nome (até 100), cortando numa barra
      let corte = -1; for (let i = nome.indexOf('/'); i >= 0; i = nome.indexOf('/', i + 1)) if (i <= 155 && nome.length - i - 1 <= 100) { corte = i; break; }
      if (corte < 0) throw new Error('nome longo demais no pacote: ' + nome);
      h.write(nome.slice(corte + 1), 0, 100); h.write(nome.slice(0, corte), 345, 155);
    } else h.write(nome, 0, 100);
    h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
    h.write(dados.length.toString(8).padStart(11, '0') + '\0', 124); h.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136);
    h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
    let soma = 0; for (const b of h) soma += b; h.write(soma.toString(8).padStart(6, '0') + '\0 ', 148);
    blocos.push(h, dados, Buffer.alloc((512 - (dados.length % 512)) % 512));
  }
  blocos.push(Buffer.alloc(1024));
  return Buffer.concat(blocos);
}

// destino "drive" (pasta configurada) ou "computador" (o arquivo fica no bucket em downloads/ e o administrador baixa pelo painel)
async function gerarBackup(tipo, quem, destino = 'drive') {
  const db = getFirestore(), cfg = (await db.doc('backup_config/atual').get()).data() || {};
  if (destino === 'drive' && !cfg.pasta_id) throw new HttpsError('failed-precondition', 'Escolha primeiro a pasta do Drive.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19), log = db.collection('backups_log').doc();
  await log.set({ em: FieldValue.serverTimestamp(), tipo, por_uid: quem.uid || '', por_nome: quem.nome || (tipo === 'automatico' ? 'Automático' : ''), status: 'exportando', destino, pasta_nome: destino === 'drive' ? cfg.pasta_nome || '' : '' });
  try {
    // 1) exportação oficial do Firestore (todas as coleções e subcoleções)
    const prefixo = `exports/${stamp}`, t = await token();
    const op = await (await fetch(`https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default):exportDocuments`, {
      method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ outputUriPrefix: `gs://${BUCKET_BACKUP}/${prefixo}` })
    })).json();
    if (!op.name) throw new Error('exportação: ' + JSON.stringify(op).slice(0, 300));
    let fim = null, docs = 0;
    for (let i = 0; i < 300 && !fim; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const s = await (await fetch(`https://firestore.googleapis.com/v1/${op.name}`, { headers: { Authorization: `Bearer ${await token()}` } })).json();
      docs = +((s.metadata || {}).progressDocuments || {}).completedWork || docs;
      if (s.done) { if (s.error) throw new Error('exportação: ' + s.error.message); fim = s; }
    }
    if (!fim) throw new Error('exportação demorou mais que 20 minutos');
    await log.update({ status: 'enviando', documentos: docs });
    // 2) empacota e manda para o Drive
    const [arqs] = await getStorage().bucket(BUCKET_BACKUP).getFiles({ prefix: prefixo + '/' });
    const lista = [];
    for (const f of arqs) { const [dados] = await f.download(); lista.push({ nome: `backup-${stamp}/` + f.name.slice(prefixo.length + 1), dados }); }
    lista.push({ nome: `backup-${stamp}/LEIA-ME.txt`, dados: Buffer.from(
      `Backup do banco do Portal do Educador 5.0 (projeto ${PROJETO})\nGerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })} · ${tipo} · ${docs} documentos\n\n` +
      'Para restaurar (com o suporte técnico, primeiro num banco de teste):\n1. Descompacte este arquivo.\n2. Envie a pasta para um bucket do Google Cloud Storage.\n' +
      `3. gcloud firestore import gs://BUCKET/backup-${stamp} --project=PROJETO_DE_DESTINO\n\nNão contém senhas (o login fica no Firebase Authentication) nem os arquivos do Storage.\n`) });
    const gz = gzipSync(tar(lista), { level: 9 });
    const nome = `portal-educador-backup-${stamp}.tar.gz`;
    if (destino === 'computador') {
      const caminho = `downloads/${nome}`;
      await getStorage().bucket(BUCKET_BACKUP).file(caminho).save(gz, { contentType: 'application/gzip', resumable: false, metadata: { contentDisposition: `attachment; filename="${nome}"` } });
      await log.update({ status: 'ok', bytes: gz.length, documentos: docs, caminho, nome, fim: FieldValue.serverTimestamp() });
      return { ok: true, bytes: gz.length, documentos: docs, caminho, nome };
    }
    const f = await enviarDrive(cfg.pasta_id, nome, gz, 'application/gzip');
    await log.update({ status: 'ok', bytes: gz.length, documentos: docs, arquivo_id: f.id || '', link: f.webViewLink || '', nome: f.name || '', fim: FieldValue.serverTimestamp() });
    await db.doc('backup_config/atual').set({ ultimo_ok: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, bytes: gz.length, documentos: docs, link: f.webViewLink || '' };
  } catch (e) {
    await log.update({ status: 'erro', erro: String(e.message || e).slice(0, 400), fim: FieldValue.serverTimestamp() }).catch(() => {});
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('internal', String(e.message || e).slice(0, 300));
  }
}

// dados da tela: e-mail do robô (para adicionar no Drive) e a configuração atual
export const backupInfo = onCall(OPC, async req => {
  await exigirAdmin(req);
  const cfg = (await getFirestore().doc('backup_config/atual').get()).data() || {};
  return { email: await emailRobo(), pasta_id: cfg.pasta_id || '', pasta_nome: cfg.pasta_nome || '', automatico: cfg.automatico !== false };
});

// salva a pasta escolhida: testa gravando e apagando um arquivo pequeno antes de aceitar
export const backupConfigurar = onCall(OPC, async req => {
  const u = await exigirAdmin(req), id = pastaDoLink((req.data || {}).link), automatico = (req.data || {}).automatico !== false;
  if (!id) throw new HttpsError('invalid-argument', 'Cole o link da pasta do Google Drive.');
  const pasta = await drive(`drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,mimeType,driveId`);
  if (pasta.mimeType !== 'application/vnd.google-apps.folder') throw new HttpsError('invalid-argument', 'Esse link não é de uma pasta.');
  const teste = await enviarDrive(id, 'teste-de-acesso-portal.txt', Buffer.from('Teste de gravação do backup do Portal do Educador. Pode apagar.'), 'text/plain');
  await drive(`drive/v3/files/${teste.id}?supportsAllDrives=true`, { method: 'DELETE' }).catch(() => {});
  await getFirestore().doc('backup_config/atual').set({ pasta_id: id, pasta_nome: pasta.name || '', compartilhado: !!pasta.driveId, automatico, atualizado_por: req.auth.uid, atualizado_por_nome: u.nome || '', atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, pasta_nome: pasta.name || '' };
});

export const backupAgora = onCall({ ...OPC, timeoutSeconds: 1800, memory: '1GiB' }, async req => {
  const u = await exigirAdmin(req);
  return gerarBackup('manual', { uid: req.auth.uid, nome: u.nome || '' }, (req.data || {}).destino === 'computador' ? 'computador' : 'drive');
});

// automático: todo domingo às 3h23 (horário de MS), se estiver ligado
export const backupSemanal = onSchedule({ ...OPC, schedule: '23 3 * * 0', timeZone: 'America/Campo_Grande', timeoutSeconds: 1800, memory: '1GiB' }, async () => {
  const cfg = (await getFirestore().doc('backup_config/atual').get()).data() || {};
  if (!cfg.pasta_id || cfg.automatico === false) return;
  await gerarBackup('automatico', {}).catch(e => console.error('backupSemanal', e.message));
});

// Backup do banco (Firestore), e opcionalmente de todos os arquivos do Storage, para uma pasta do Google Drive escolhida
// pelo administrador ou para baixar no computador (HD externo, servidor da empresa). O pacote fica 7 dias em pacotes/ no
// bucket de São Paulo; o download é por link assinado de 30 minutos, gerado só para o administrador.
// Caminho: exportação oficial do Firestore (inclui subcoleções) num bucket temporário em São Paulo
// -> empacotada num .tar.gz -> enviada ao Drive. O bucket temporário apaga tudo em 7 dias.
// Restaurar: descompactar, subir a pasta para um bucket e rodar `gcloud firestore import` (procedimento guiado, nunca por botão).
// O Drive precisa ser um Drive compartilhado (Workspace) com a conta das funções como "Gerente de conteúdo":
// conta de serviço não tem espaço próprio no Drive, então não grava em "Meu Drive" de uma pessoa.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

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

// .tar (ustar) escrito em fluxo: nada do pacote fica inteiro na memória (o completo passa de 800 MB)
export function cabecalho(nome, tamanho) {
  const h = Buffer.alloc(512), n = Buffer.from(nome, 'utf8');
  if (n.length > 100) {
    // ustar: nome longo vai dividido em prefixo (até 155 bytes) + nome (até 100 bytes), cortando numa barra
    let corte = -1; for (let k = n.indexOf(47); k >= 0; k = n.indexOf(47, k + 1)) if (k <= 155 && n.length - k - 1 <= 100) { corte = k; break; }
    if (corte < 0) return null;
    n.copy(h, 0, corte + 1); n.copy(h, 345, 0, corte);
  } else n.copy(h, 0);
  h.write('0000644\0', 100); h.write('0000000\0', 108); h.write('0000000\0', 116);
  h.write(tamanho.toString(8).padStart(11, '0') + '\0', 124); h.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136);
  h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  let soma = 0; for (const b of h) soma += b; h.write(soma.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
// versão em memória (usada nos testes)
export function tar(arquivos) {
  const blocos = [];
  for (const { nome, dados } of arquivos) { blocos.push(cabecalho(nome, dados.length), dados, Buffer.alloc((512 - (dados.length % 512)) % 512)); }
  blocos.push(Buffer.alloc(1024));
  return Buffer.concat(blocos);
}
// entradas: { nome, dados } (Buffer) ou { nome, arquivo, tamanho } (arquivo do Storage, lido em fluxo)
async function empacotar(entradas, destino, nomeDownload) {
  const gz = createGzip({ level: 6 }), saida = destino.createWriteStream({ resumable: true, contentType: 'application/gzip', metadata: { contentDisposition: `attachment; filename="${nomeDownload}"` } });
  const fim = pipeline(gz, saida);
  const escrever = b => new Promise((ok, erro) => { if (gz.destroyed) return erro(new Error('compactação interrompida')); gz.write(b) ? ok() : gz.once('drain', ok); });
  const renomeados = [];
  // arquivos pequenos são baixados em paralelo, 24 à frente (milhares de arquivos lidos um a um levariam muitos minutos só de espera)
  const JANELA = 24, PEQUENO = 8 * 1024 * 1024, pre = new Map();
  const adiantar = k => { for (let x = k; x < Math.min(entradas.length, k + JANELA); x++) { const e = entradas[x];
    if (e.arquivo && !pre.has(x) && e.tamanho <= PEQUENO) pre.set(x, e.arquivo.download().then(r => r[0]).catch(() => null)); } };
  for (let k = 0; k < entradas.length; k++) {
    const e = entradas[k]; adiantar(k);
    if (pre.has(k)) { const b = await pre.get(k); pre.delete(k); if (b) { e.dados = b.length > e.tamanho ? b.subarray(0, e.tamanho) : b; } }
    const tam = e.tamanho ?? e.dados.length;
    let h = cabecalho(e.nome, tam), nome = e.nome;
    if (!h) { nome = e.nome.split('/')[0] + '/_nomes-longos/' + renomeados.length + '.bin'; renomeados.push(nome + '\t' + e.nome); h = cabecalho(nome, tam); }
    await escrever(h);
    let n = 0;
    if (e.dados) { await escrever(e.dados); n = e.dados.length; e.dados = null; }
    else for await (const pedaco of e.arquivo.createReadStream()) { const p = n + pedaco.length > tam ? pedaco.subarray(0, tam - n) : pedaco; n += p.length; if (p.length) await escrever(p); }
    if (n < tam) await escrever(Buffer.alloc(tam - n)); // arquivo mudou no meio: completa para não quebrar o .tar
    const pad = (512 - (tam % 512)) % 512; if (pad) await escrever(Buffer.alloc(pad));
  }
  if (renomeados.length) { const d = Buffer.from('nome no pacote\tnome original\n' + renomeados.join('\n') + '\n'); await escrever(cabecalho(entradas[0].nome.split('/')[0] + '/_nomes-longos/LISTA.tsv', d.length)); await escrever(d); const pad = (512 - d.length % 512) % 512; if (pad) await escrever(Buffer.alloc(pad)); }
  await escrever(Buffer.alloc(1024)); gz.end(); await fim;
  const [meta] = await destino.getMetadata(); return +meta.size;
}
// envio ao Drive em partes (o arquivo sai do bucket em fluxo; partes de 32 MB)
async function enviarDriveDoBucket(pasta, nome, arquivo, tamanho) {
  const ini = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,size`, {
    method: 'POST', headers: { Authorization: `Bearer ${await token(DRIVE)}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/gzip', 'X-Upload-Content-Length': String(tamanho) },
    body: JSON.stringify({ name: nome, parents: [pasta] })
  });
  if (!ini.ok) { const txt = await ini.text(); if (/storage quota/i.test(txt)) throw new HttpsError('failed-precondition', 'A pasta precisa estar num Drive compartilhado.'); throw new HttpsError('internal', 'Drive (início do envio) ' + ini.status + ': ' + txt.slice(0, 200)); }
  const url = ini.headers.get('location'), PARTE = 32 * 1024 * 1024;
  let buf = [], tam = 0, off = 0, resposta = null;
  const mandar = async () => {
    const corpo = Buffer.concat(buf), fimB = off + corpo.length - 1;
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Length': String(corpo.length), 'Content-Range': `bytes ${off}-${fimB}/${tamanho}` }, body: corpo });
    if (r.status === 308) { off = fimB + 1; buf = []; tam = 0; return; }
    if (!r.ok) throw new HttpsError('internal', 'Drive (envio) ' + r.status + ': ' + (await r.text()).slice(0, 200));
    resposta = await r.json(); // a última parte pode coincidir com o fim de uma parte de 32 MB
  };
  for await (const pedaco of arquivo.createReadStream()) {
    buf.push(pedaco); tam += pedaco.length;
    while (tam >= PARTE) { const tudo = Buffer.concat(buf); buf = [tudo.subarray(0, PARTE)]; tam = PARTE; const resto = tudo.subarray(PARTE); await mandar(); if (resto.length) { buf = [resto]; tam = resto.length; } }
  }
  if (!resposta) await mandar();
  return resposta;
}

// destino "drive" (pasta configurada) ou "computador" (fica 7 dias no bucket e o administrador baixa por um link de 30 minutos)
// completo: além do banco, todos os arquivos do Storage (aulas, provas, mídias da TV, biblioteca, colorir, materiais da Formação)
async function gerarBackup(tipo, quem, destino = 'drive', completo = false) {
  const db = getFirestore(), cfg = (await db.doc('backup_config/atual').get()).data() || {};
  if (destino === 'drive' && !cfg.pasta_id) throw new HttpsError('failed-precondition', 'Escolha primeiro a pasta do Drive.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19), log = db.collection('backups_log').doc(), raiz = `backup-${stamp}`;
  await log.set({ em: FieldValue.serverTimestamp(), tipo, destino, completo, por_uid: quem.uid || '', por_nome: quem.nome || (tipo === 'automatico' ? 'Automático' : ''), status: 'exportando', pasta_nome: destino === 'drive' ? cfg.pasta_nome || '' : '' });
  try {
    // 1) exportação oficial do Firestore (todas as coleções e subcoleções)
    const prefixo = `exports/${stamp}`;
    const op = await (await fetch(`https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default):exportDocuments`, {
      method: 'POST', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ outputUriPrefix: `gs://${BUCKET_BACKUP}/${prefixo}` })
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
    await log.update({ status: 'empacotando', documentos: docs });
    // 2) monta o pacote: banco + (se completo) arquivos do Storage
    const bk = getStorage().bucket(BUCKET_BACKUP), [exp] = await bk.getFiles({ prefix: prefixo + '/' });
    const entradas = exp.map(f => ({ nome: `${raiz}/banco/` + f.name.slice(prefixo.length + 1), arquivo: f, tamanho: +f.metadata.size }));
    let nArqs = 0, bytesArqs = 0;
    if (completo) {
      const [arqs] = await getStorage().bucket().getFiles();
      arqs.filter(f => !f.name.endsWith('/')).forEach(f => { nArqs++; bytesArqs += +f.metadata.size; entradas.push({ nome: `${raiz}/arquivos/` + f.name, arquivo: f, tamanho: +f.metadata.size }); });
      await log.update({ arquivos: nArqs, bytes_arquivos: bytesArqs });
    }
    entradas.unshift({ nome: `${raiz}/LEIA-ME.txt`, dados: Buffer.from(
      `Backup do Portal do Educador 5.0 (projeto ${PROJETO})\nGerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande' })} · ${tipo} · ${completo ? 'COMPLETO' : 'somente banco'}\n` +
      `Banco: ${docs} documentos (pasta banco/)\n` + (completo ? `Arquivos: ${nArqs} arquivos do Storage (pasta arquivos/, mesmos caminhos do bucket)\n` : '') +
      '\nPara restaurar o banco (com o suporte técnico, primeiro num projeto de teste):\n1. Descompacte este arquivo.\n2. Envie a pasta banco/ para um bucket do Google Cloud Storage.\n' +
      `3. gcloud firestore import gs://BUCKET/CAMINHO/banco --project=PROJETO_DE_DESTINO\n` +
      (completo ? '\nPara restaurar arquivos: gcloud storage cp -r arquivos/* gs://BUCKET_DE_DESTINO/\n' : '') +
      '\nNão contém senhas (o login fica no Firebase Authentication) nem as fotos da portaria (apagadas em 15 dias por regra de privacidade).\nContém dados pessoais de alunos e professores: guarde em local protegido (LGPD).\n') });
    const nome = `portal-educador-backup${completo ? '-completo' : ''}-${stamp}.tar.gz`, caminho = `pacotes/${nome}`;
    const tamanho = await empacotar(entradas, bk.file(caminho), nome);
    if (destino === 'computador') {
      await log.update({ status: 'ok', bytes: tamanho, documentos: docs, caminho, nome, fim: FieldValue.serverTimestamp() });
      return { ok: true, bytes: tamanho, documentos: docs, arquivos: nArqs, caminho, nome, url: await linkTemporario(caminho) };
    }
    await log.update({ status: 'enviando', bytes: tamanho });
    const f = await enviarDriveDoBucket(cfg.pasta_id, nome, bk.file(caminho), tamanho);
    await log.update({ status: 'ok', bytes: tamanho, documentos: docs, caminho, arquivo_id: f.id || '', link: f.webViewLink || '', nome, fim: FieldValue.serverTimestamp() });
    await db.doc('backup_config/atual').set({ ultimo_ok: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, bytes: tamanho, documentos: docs, arquivos: nArqs, link: f.webViewLink || '' };
  } catch (e) {
    await log.update({ status: 'erro', erro: String(e.message || e).slice(0, 400), fim: FieldValue.serverTimestamp() }).catch(() => {});
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('internal', String(e.message || e).slice(0, 300));
  }
}
// link assinado de 30 minutos: o navegador baixa direto do bucket, sem carregar o pacote na memória
async function linkTemporario(caminho) {
  const [url] = await getStorage().bucket(BUCKET_BACKUP).file(caminho).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 30 * 60 * 1000 });
  return url;
}
// tamanho atual do Storage (para o administrador saber o peso do backup completo)
async function tamanhoArquivos() {
  const [arqs] = await getStorage().bucket().getFiles(); let b = 0, n = 0;
  arqs.forEach(f => { if (!f.name.endsWith('/')) { n++; b += +f.metadata.size; } });
  return { n, b };
}

// dados da tela: e-mail do robô (para adicionar no Drive) e a configuração atual
export const backupInfo = onCall(OPC, async req => {
  await exigirAdmin(req);
  const cfg = (await getFirestore().doc('backup_config/atual').get()).data() || {};
  const arq = await tamanhoArquivos().catch(() => ({ n: 0, b: 0 }));
  return { email: await emailRobo(), pasta_id: cfg.pasta_id || '', pasta_nome: cfg.pasta_nome || '', automatico: cfg.automatico !== false, arquivos: arq.n, bytes_arquivos: arq.b };
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

export const backupAgora = onCall({ ...OPC, timeoutSeconds: 1800, memory: '2GiB', cpu: 2 }, async req => {
  const u = await exigirAdmin(req);
  const d = req.data || {};
  return gerarBackup('manual', { uid: req.auth.uid, nome: u.nome || '' }, d.destino === 'computador' ? 'computador' : 'drive', d.completo === true);
});

// novo link de download (30 min) para um pacote ainda guardado (até 7 dias)
export const backupLink = onCall(OPC, async req => {
  await exigirAdmin(req);
  const c = String((req.data || {}).caminho || '');
  if (!/^(pacotes|downloads)\/portal-educador-backup[\w.-]+\.tar\.gz$/.test(c)) throw new HttpsError('invalid-argument', 'Arquivo inválido.');
  const [existe] = await getStorage().bucket(BUCKET_BACKUP).file(c).exists();
  if (!existe) throw new HttpsError('not-found', 'Esse arquivo já foi apagado (fica guardado 7 dias).');
  return { url: await linkTemporario(c) };
});

// automático: todo domingo às 3h23 (horário de MS), se estiver ligado
export const backupSemanal = onSchedule({ ...OPC, schedule: '23 3 * * 0', timeZone: 'America/Campo_Grande', timeoutSeconds: 1800, memory: '2GiB', cpu: 2 }, async () => {
  const cfg = (await getFirestore().doc('backup_config/atual').get()).data() || {};
  if (!cfg.pasta_id || cfg.automatico === false) return;
  await gerarBackup('automatico', {}).catch(e => console.error('backupSemanal', e.message));
});

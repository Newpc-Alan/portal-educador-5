// Compartilhar os trabalhos do professor (Meus trabalhos): rede do município, e-mail e alunos (Materiais da turma).
// Tipos: lousa (arquivo no Storage), prova (arquivo no Storage), roteiro e folha (documento no Firestore).
// A cópia da rede fica em trabalhos_rede/{tipo}_{id} e, quando há arquivo, em trabalhos-rede/{municipio}/{tipo}_{id}/.
// "Usar uma cópia" cria um trabalho novo na conta do colega, no mesmo formato do original.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { SMTP_SENHA } from './dicas.js';
import { feedRede } from './rede-feed.js';
import { opcoesEnvio, destinatarios, contarEnvioDia, lerAnexos, mandarMaterial, htmlSeguro, turmasParaAlunos, linkPublico, publicarNaTurma } from './envio-comum.js';

const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
// onde cada tipo guarda os dados da conta do professor
const TIPOS = {
  lousa:   { col: 'trabalhos', nome: 'Aula da Lousa', arquivo: true, titulo: x => x.titulo, de: (uid, id, o) => o.arquivo, pasta: (uid, id, ext) => `professores/${uid}/lousa/${id}${ext}` },
  // a prova não guarda o caminho no documento: é sempre professores/{uid}/provas/{id}.json.gz
  prova:   { col: 'provas',    nome: 'Prova',         arquivo: true, titulo: x => x.titulo, de: (uid, id) => `professores/${uid}/provas/${id}.json.gz`, pasta: (uid, id) => `professores/${uid}/provas/${id}.json.gz`, semCaminho: true },
  roteiro: { col: 'roteiros',  nome: 'Roteiro',       arquivo: false, titulo: x => x.titulo },
  folha:   { col: 'folhas',    nome: 'Folha Mágica',  arquivo: false, titulo: x => x.nome }
};
// campos que vão na cópia de roteiros e folhas (o resto é estado de tela de quem fez)
const CAMPOS = { roteiro: ['titulo', 'texto', 'settings', 'markers', 'palavras'], folha: ['nome', 'tipo', 'cfg'] };
const LINK_REDE = '/entrar/#trabalhos-rede';
// campos simples do documento que vão junto na cópia (o resto é da conta de quem fez: pasta, turma, rede, envios)
const FORA = new Set(['rede', 'origem_rede', 'envios_email', 'turmas_enviadas', 'pasta_id', 'turma', 'turma_id', 'escola', 'criado_em', 'atualizado_em', 'arquivo', 'miniatura']);
const metaDe = o => Object.fromEntries(Object.entries(o).filter(([k, v]) => !FORA.has(k) && (v === null || ['string', 'number', 'boolean'].includes(typeof v))));

async function contexto(db, uid) {
  const s = await db.doc(`usuarios/${uid}`).get(); const eu = s.exists ? s.data() : null;
  if (!eu || eu.status !== 'ativo') throw new HttpsError('permission-denied', 'Conta sem acesso.');
  const admin = eu.perfil === 'admin';
  let muni = null; if (eu.municipio_id) { const m = await db.doc(`municipios/${eu.municipio_id}`).get(); muni = m.exists ? m.data() : null; }
  let escola = ''; if (eu.escola_id) { const e = await db.doc(`escolas/${eu.escola_id}`).get(); escola = e.exists ? txt(e.data().nome, 120) : ''; }
  return { eu, admin, muni, escola };
}

export const trabalhoRede = onCall({ region: 'southamerica-east1', secrets: [SMTP_SENHA], timeoutSeconds: 120, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {}, c = await contexto(db, uid);
  if (d.acao === 'opcoes') return opcoesEnvio(db, c.eu);

  const tipo = String(d.tipo || ''), T = TIPOS[tipo];
  if (!T) throw new HttpsError('invalid-argument', 'Tipo de trabalho desconhecido.');

  /* usar uma cópia de um trabalho da rede */
  if (d.acao === 'usar') {
    const rs = await db.doc(`trabalhos_rede/${txt(d.id, 120)}`).get();
    if (!rs.exists) throw new HttpsError('not-found', 'Este trabalho não está mais na rede.');
    const r = rs.data();
    if (!c.admin && (r.status !== 'publicado' || r.municipio_id !== c.eu.municipio_id)) throw new HttpsError('permission-denied', 'Este trabalho não é da sua rede.');
    const TT = TIPOS[r.tipo], novo = db.collection('usuarios').doc(uid).collection(TT.col).doc();
    const origem = { id: rs.id, autor_nome: r.autor_nome || '', escola_nome: r.escola_nome || '' };
    if (TT.arquivo) {
      const ext = r.arquivo.endsWith('.gz') ? '.json.gz' : '.json', destino = TT.pasta(uid, novo.id, ext);
      await getStorage().bucket().file(r.arquivo).copy(getStorage().bucket().file(destino));
      await novo.set({ ...(r.meta || {}), titulo: r.titulo, ...(TT.semCaminho ? {} : { arquivo: destino, formato: r.formato || '' }), miniatura: r.miniatura || '', origem_rede: origem,
        criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
    } else await novo.set({ ...(r.dados || {}), origem_rede: origem, criado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp() });
    if (r.uid !== uid) await rs.ref.update({ usos: FieldValue.increment(1) });
    return { ok: true, id: novo.id, tipo: r.tipo };
  }

  // daqui para baixo: um trabalho da própria conta
  const id = txt(d.id, 64), oRef = db.doc(`usuarios/${uid}/${T.col}/${id}`), os = await oRef.get();
  if (!os.exists) throw new HttpsError('not-found', 'Trabalho não encontrado. Salve antes de compartilhar.');
  const o = os.data(), titulo = txt(T.titulo(o) || T.nome, 160), redeId = `${tipo}_${id}`, mun = c.eu.municipio_id || '';
  const disciplina = txt(d.disciplina, 60), serie = txt(d.serie, 60);

  if (d.acao === 'situacao') {
    const rs = await db.doc(`trabalhos_rede/${redeId}`).get();
    return { rede: rs.exists ? { status: rs.data().status, usos: rs.data().usos || 0, disciplina: rs.data().disciplina || '', serie: rs.data().serie || '' } : null };
  }

  /* compartilhar (ou atualizar) com a rede do município */
  if (d.acao === 'rede') {
    if (!d.aceite) throw new HttpsError('failed-precondition', 'Confirme que não há nome ou foto de aluno.');
    if (!mun) throw new HttpsError('failed-precondition', 'Sua conta não está ligada a uma rede municipal.');
    const antes = await db.doc(`trabalhos_rede/${redeId}`).get(), reg = {};
    if (T.arquivo) {
      const fonte = T.de(uid, id, o);
      if (!fonte) throw new HttpsError('failed-precondition', 'Salve o trabalho antes de compartilhar.');
      const destino = `trabalhos-rede/${mun}/${redeId}/conteudo${fonte.endsWith('.gz') ? '.json.gz' : '.json'}`;
      try { await getStorage().bucket().file(fonte).copy(getStorage().bucket().file(destino)); }
      catch (e) { throw new HttpsError('failed-precondition', 'Não achei o arquivo salvo deste trabalho. Abra e salve de novo.'); }
      Object.assign(reg, { arquivo: destino, formato: o.formato || '', miniatura: typeof o.miniatura === 'string' && o.miniatura.length < 200000 ? o.miniatura : '', meta: metaDe(o) });
    } else reg.dados = Object.fromEntries(CAMPOS[tipo].filter(k => o[k] !== undefined).map(k => [k, o[k]]));
    await db.doc(`trabalhos_rede/${redeId}`).set({
      uid, origem_id: id, tipo, tipo_nome: T.nome, municipio_id: mun, status: 'publicado', titulo, disciplina, serie,
      paginas: Number(o.paginas) || 0, autor_nome: txt(c.eu.nome || '', 80), escola_nome: c.escola, escola_id: c.eu.escola_id || '', ...reg,
      usos: antes.exists ? (antes.data().usos || 0) : 0, termo_aceito_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(),
      ...(antes.exists ? {} : { criado_em: FieldValue.serverTimestamp() }) });
    await oRef.set({ rede: { municipio_id: mun, em: FieldValue.serverTimestamp() } }, { merge: true });
    await feedRede(db, mun, { id: redeId, titulo, tipo_nome: T.nome, disciplina, serie, autor_nome: txt(c.eu.nome || '', 80), autor_uid: uid, escola_nome: c.escola,
      atualizado: antes.exists, link: LINK_REDE }).catch(e => console.warn('feedRede', e.message));
    return { ok: true, id: redeId };
  }
  if (d.acao === 'descompartilhar') {
    const ref = db.doc(`trabalhos_rede/${redeId}`), rs = await ref.get();
    if (rs.exists) {
      await getStorage().bucket().deleteFiles({ prefix: `trabalhos-rede/${rs.data().municipio_id}/${redeId}/` }).catch(() => {});
      await ref.delete(); await feedRede(db, rs.data().municipio_id, null, redeId).catch(() => {});
    }
    await oRef.set({ rede: FieldValue.delete() }, { merge: true }).catch(() => {});
    return { ok: true };
  }

  /* e-mail: PDF gerado na tela do professor (ou o texto, nos roteiros) */
  if (d.acao === 'email') {
    const { para, teto } = await destinatarios(db, c.eu, uid, c.admin, d);
    const anexos = lerAnexos(d.anexos, 2);
    let corpo = '';
    if (!anexos.length) { corpo = htmlSeguro(d.html); if (corpo.replace(/<[^>]+>/g, '').trim().length < 10) throw new HttpsError('invalid-argument', 'Não encontrei o conteúdo para enviar.'); }
    await contarEnvioDia(db, uid, c.admin, para.length, teto);
    await mandarMaterial({ eu: c.eu, escola: c.escola, mun: c.muni ? txt(c.muni.nome, 80) : '', titulo, sub: [T.nome, disciplina, serie].filter(Boolean).join(' · '), mensagem: d.mensagem, anexos, corpo, para });
    await oRef.set({ envios_email: FieldValue.increment(para.length) }, { merge: true });
    return { ok: true, enviados: para.length };
  }

  /* alunos: páginas em imagem (Lousa, Prova, Folha) ou texto (Roteiro), em "Materiais da turma" */
  if (d.acao === 'alunos') {
    const turmas = await turmasParaAlunos(db, c.eu, uid, c.admin, d);
    const imgs = (Array.isArray(d.paginas) ? d.paginas : []).slice(0, 40), urls = [];
    let total = 0;
    for (let i = 0; i < imgs.length; i++) {
      const b = Buffer.from(String(imgs[i] || ''), 'base64'); total += b.length;
      if (b.length < 200 || total > 25e6 || b[0] !== 0xFF || b[1] !== 0xD8) throw new HttpsError('invalid-argument', 'As páginas não foram geradas direito. Tente de novo.');
      urls.push(await linkPublico(null, `turma-materiais/${redeId}/p${i + 1}.jpg`, b, 'image/jpeg'));
    }
    const html = urls.length ? '' : htmlSeguro(d.html);
    if (!urls.length && html.replace(/<[^>]+>/g, '').trim().length < 10) throw new HttpsError('invalid-argument', 'Não encontrei o conteúdo do trabalho.');
    await publicarNaTurma(db, turmas, redeId, { origem_id: id, origem: tipo, autor_uid: uid, autor_nome: txt(c.eu.nome || '', 80), escola_nome: c.escola, titulo,
      tipo_nome: T.nome, disciplina, serie, paginas: urls, html, css: '' });
    await oRef.set({ turmas_enviadas: FieldValue.arrayUnion(...turmas.slice(0, 50).map(t => t.id)) }, { merge: true });
    return { ok: true, turmas: turmas.length, nomes: turmas.slice(0, 8).map(t => t.nome || 'Turma') };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

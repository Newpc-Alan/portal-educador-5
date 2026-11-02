// Moderação do que os professores compartilham com a rede do município (Portal IA e Meus trabalhos).
// Cada município escolhe o modo em municipios.rede_moderacao:
//   'antes'  : o material entra como "pendente" e só aparece para os colegas depois que alguém aprova;
//   'depois' : (ou campo ausente) publica na hora; a moderação pode ocultar ou remover depois.
// Quem modera: o admin NEWPC (qualquer rede), a secretaria (a rede inteira) e o gestor (só o que vem das escolas dele).
// O modo só é trocado pelo admin ou pela secretaria.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { gunzipSync } from 'node:zlib';
import { transporte, escHtml as esc, SMTP_SENHA, SMTP_USUARIO } from './dicas.js';
import { feedRede } from './rede-feed.js';
import { escolasDoAlcance } from './envio-comum.js';

const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const APP = 'https://www.portaldoeducador.com.br';
const COLS = { ia: 'portal_ia_rede', trab: 'trabalhos_rede' };
const LINK_TRAB = '/entrar/#trabalhos-rede';

export const modoModeracao = m => (m && m.rede_moderacao === 'antes') ? 'antes' : 'depois';
// status com que um material entra (ou volta) para a rede: oculto pela moderação só volta com nova aprovação
export function statusAoCompartilhar(m, antes) {
  if (modoModeracao(m) === 'antes') return 'pendente';
  return antes && antes.exists && ['oculto', 'pendente'].includes(antes.data().status) ? 'pendente' : 'publicado';
}
// item do resumo "Novidades da rede" a partir do registro da rede
export const itemDoFeed = (col, id, r, atualizado) => ({ id, titulo: r.titulo || '', tipo_nome: r.tipo_nome || '', disciplina: r.disciplina || '', serie: r.serie || '',
  autor_nome: r.autor_nome || '', autor_uid: r.uid || '', escola_nome: r.escola_nome || '', atualizado: !!atualizado, ...(col === 'trab' ? { link: LINK_TRAB } : {}) });

// o original na conta do professor (guarda rede.status para a tela dele mostrar "aguardando" / "ajuste pedido")
const COL_ORIG = { lousa: 'trabalhos', prova: 'provas', roteiro: 'roteiros', folha: 'folhas' };
function origemRef(db, col, r) {
  if (!r.origem_id) return null;
  if (col === 'ia') return db.doc(`portal_ia_docs/${r.origem_id}`);
  return r.uid && COL_ORIG[r.tipo] ? db.doc(`usuarios/${r.uid}/${COL_ORIG[r.tipo]}/${r.origem_id}`) : null;
}
async function quem(db, uid) {
  const s = await db.doc(`usuarios/${uid}`).get(), eu = s.exists ? s.data() : null;
  if (!eu || eu.status !== 'ativo' || !['admin', 'secretaria', 'gestor'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'A moderação da rede é para a secretaria, a gestão da escola e a NEWPC.');
  return eu;
}
// o que este moderador alcança: município e (gestor) as escolas dele
async function alcance(db, eu, munPedido) {
  const admin = eu.perfil === 'admin', mun = admin ? txt(munPedido, 80) : (eu.municipio_id || '');
  if (!mun) throw new HttpsError('failed-precondition', admin ? 'Escolha o município.' : 'Sua conta não está ligada a uma rede municipal.');
  const escolas = eu.perfil === 'gestor' ? new Set((await escolasDoAlcance(db, eu)).map(e => e.id)) : null;
  return { admin, mun, escolas, pode: r => r && r.municipio_id === mun && (!escolas || escolas.has(r.escola_id || '')) };
}
const ms = t => t && t.toMillis ? t.toMillis() : 0;
function resumo(col, d) {
  const r = d.data();
  return { col, id: d.id, tipo: r.tipo || '', tipo_nome: r.tipo_nome || '', titulo: r.titulo || '', autor_nome: r.autor_nome || '', escola_nome: r.escola_nome || '',
    disciplina: r.disciplina || '', serie: r.serie || '', status: r.status || '', denuncias: r.denuncias || 0, usos: r.usos || 0,
    miniatura: typeof r.miniatura === 'string' && r.miniatura.length < 200000 ? r.miniatura : '',
    em: ms(r.atualizado_em), moderacao: r.moderacao ? { nome: r.moderacao.nome || '', decisao: r.moderacao.decisao || '', motivo: r.moderacao.motivo || '', em: ms(r.moderacao.em) } : null };
}

// texto para conferir o material sem sair da tela
const LETRAS = 'abcdefghij';
function textoDoc(d) {
  if (!d) return '';
  const L = [d.titulo || '', d.subtitulo || '']; let n = 0;
  (d.secoes || []).forEach(s => { L.push('', String(s.titulo || '').toUpperCase()); if (s.texto) L.push(s.texto); (s.itens || []).forEach(i => L.push('- ' + i));
    if (s.tabela && (s.tabela.colunas || []).length) { L.push(s.tabela.colunas.join(' | ')); (s.tabela.linhas || []).forEach(l => L.push((l.celulas || []).join(' | '))); }
    (s.questoes || []).forEach(q => { n++; L.push('', n + '. ' + (q.enunciado || '')); (q.alternativas || []).forEach((a, k) => L.push('   ' + (q.tipo === 'multipla' ? LETRAS[k] + ') ' : '(   ) ') + a));
      (q.coluna_a || []).forEach((a, k) => L.push('   ' + (k + 1) + '. ' + a)); (q.coluna_b || []).forEach(b => L.push('   (   ) ' + b)); }); });
  if ((d.gabarito || []).length) { L.push('', 'GABARITO'); d.gabarito.forEach(g => L.push(g.questao + '. ' + g.resposta)); }
  return L.join('\n');
}
const semTags = h => String(h || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ');
// arquivos da Lousa e do Gerador de Provas: junta os textos que estiverem no JSON (sem imagens)
function textosDoJson(o, out = [], prof = 0) {
  if (out.join('\n').length > 12000 || prof > 12 || o == null) return out;
  if (typeof o === 'string') { if (o.length > 1 && o.length < 3000 && !/^data:|^https?:\/\/|^[A-Za-z0-9+/=]{200,}$/.test(o)) out.push(o.includes('<') ? semTags(o) : o); return out; }
  if (Array.isArray(o)) { o.forEach(x => textosDoJson(x, out, prof + 1)); return out; }
  if (typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (!/^(id|cor|color|fonte|font|x|y|w|h|tipo|type|src|url|img|imagem|estilo|style|bg|fundo|tema|layout|formato|versao)$/i.test(k)) textosDoJson(v, out, prof + 1); });
  return out;
}

async function avisarAutor(db, r, decisao, motivo, nomeMod) {
  if (!r.uid) return;
  const u = await db.doc(`usuarios/${r.uid}`).get(), email = u.exists ? String(u.data().email || '') : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
  const frases = {
    aprovar: ['foi aprovado e já está na rede', 'Os colegas do município já podem ver e usar uma cópia. Obrigado por compartilhar!'],
    ocultar: ['saiu da vitrine da rede', 'A coordenação pediu um ajuste antes de voltar para os colegas. Corrija o material e use "Atualizar na rede": ele volta para nova análise.'],
    remover: ['foi retirado da rede', 'O material continua na sua conta, só saiu da vitrine dos colegas.']
  }[decisao];
  const corpo = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:600px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Seu material ${esc(frases[0])}</b><br><span style="color:#8DC63F;font-size:12px">Portal do Educador · Educador em Rede</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="margin:0 0 8px"><b>${esc(r.titulo || 'Material')}</b><br><span style="color:#5b6b7b;font-size:12.5px">${esc([r.tipo_nome, r.disciplina, r.serie].filter(Boolean).join(' · '))}</span></p>
<p style="margin:0 0 8px">${esc(frases[1])}</p>${motivo ? `<p style="margin:0 0 8px;padding:10px 12px;background:#f4f7fb;border-radius:8px"><b>Observação de ${esc(nomeMod || 'quem revisou')}:</b><br>${esc(motivo)}</p>` : ''}
<p style="margin:14px 0 0"><a href="${APP}/entrar/" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Abrir o Portal</a></p></div></div>`;
  await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: email, subject: `Seu material ${frases[0]}: ${txt(r.titulo, 80)}`, html: corpo })
    .catch(e => console.warn('moderacao: e-mail ao autor', e.message));
}

// material novo aguardando aprovação: avisa a secretaria e a gestão da escola do autor (um e-mail, em cópia oculta)
export async function avisarModeradores(db, mun, r) {
  if (!mun) return;
  const us = await db.collection('usuarios').where('municipio_id', '==', mun).where('status', '==', 'ativo').limit(400).get();
  const para = [...new Set(us.docs.map(x => x.data()).filter(u => u.perfil === 'secretaria'
    || (u.perfil === 'gestor' && r.escola_id && [u.escola_id, ...(u.escolas_ids || [])].includes(r.escola_id)))
    .map(u => String(u.email || '').toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 90);
  if (!para.length) return;
  const corpo = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0c2338;max-width:600px">
<div style="background:#0c2338;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0"><b style="font-size:16px">Material aguardando aprovação</b><br><span style="color:#8DC63F;font-size:12px">Portal do Educador · Educador em Rede</span></div>
<div style="border:1px solid #dce4ed;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
<p style="margin:0 0 8px"><b>${esc(r.titulo || 'Material')}</b><br><span style="color:#5b6b7b;font-size:12.5px">${esc([r.tipo_nome, r.disciplina, r.serie].filter(Boolean).join(' · '))}</span><br>
<span style="color:#1a6b2a;font-size:12.5px">Compartilhado por ${esc(r.autor_nome || 'um(a) professor(a)')}${r.escola_nome ? ', ' + esc(r.escola_nome) : ''}</span></p>
<p style="margin:0 0 8px">Ele só aparece para os colegas da rede depois que alguém da coordenação aprovar.</p>
<p style="margin:14px 0 0"><a href="${APP}/entrar/#moderacao" style="display:inline-block;background:#1a6b2a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Conferir e aprovar</a></p></div></div>`;
  await transporte().sendMail({ from: `"Portal do Educador" <${SMTP_USUARIO.value()}>`, to: SMTP_USUARIO.value(), bcc: para, subject: `Aguardando aprovação: ${txt(r.titulo, 80)}`, html: corpo })
    .catch(e => console.warn('moderacao: aviso aos moderadores', e.message));
}

export const moderarRede = onCall({ region: 'southamerica-east1', secrets: [SMTP_SENHA], timeoutSeconds: 60, memory: '512MiB', maxInstances: 10 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), d = req.data || {}, eu = await quem(db, req.auth.uid);

  /* lista do município (os dois tipos juntos) e o modo atual */
  if (d.acao === 'listar') {
    const A = await alcance(db, eu, d.municipio_id);
    const m = await db.doc(`municipios/${A.mun}`).get();
    const [ia, tr] = await Promise.all(Object.values(COLS).map(c => db.collection(c).where('municipio_id', '==', A.mun).limit(600).get()));
    const itens = [...ia.docs.map(x => resumo('ia', x)), ...tr.docs.map(x => resumo('trab', x))]
      .filter((x, i) => A.pode((i < ia.size ? ia.docs[i] : tr.docs[i - ia.size]).data()))
      .sort((a, b) => (a.status === 'pendente' ? 0 : 1) - (b.status === 'pendente' ? 0 : 1) || b.em - a.em);
    return { itens, modo: modoModeracao(m.exists ? m.data() : null), municipio: m.exists ? txt(m.data().nome, 80) : '',
      podeModo: eu.perfil === 'admin' || eu.perfil === 'secretaria', escopo: A.escolas ? 'escola' : 'rede' };
  }

  /* conferir o conteúdo e as denúncias */
  if (d.acao === 'ver') {
    const col = COLS[d.col]; if (!col) throw new HttpsError('invalid-argument', 'Material inválido.');
    const rs = await db.doc(`${col}/${txt(d.id, 120)}`).get(); if (!rs.exists) throw new HttpsError('not-found', 'Este material não está mais na rede.');
    const r = rs.data(), A = await alcance(db, eu, r.municipio_id); if (!A.pode(r)) throw new HttpsError('permission-denied', 'Este material não é da sua área.');
    let texto = '';
    if (d.col === 'ia') texto = r.html ? semTags(r.html) : textoDoc(r.doc);
    else if (r.dados) texto = r.tipo === 'roteiro' ? String(r.dados.texto || '') : textosDoJson(r.dados).join('\n');
    else if (r.arquivo) {
      try { const [buf] = await getStorage().bucket().file(r.arquivo).download(); if (buf.length < 25 * 1024 * 1024) { const j = JSON.parse((r.arquivo.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')); texto = textosDoJson(j).join('\n'); } }
      catch (e) { console.warn('moderacao: ver arquivo', e.message); }
    }
    const den = d.col === 'ia' && r.denuncias ? (await rs.ref.collection('denuncias').limit(20).get()).docs.map(x => ({ nome: x.data().nome || '', motivo: x.data().motivo || '', em: ms(x.data().em) })) : [];
    return { texto: texto.replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000), denuncias: den, miniatura: typeof r.miniatura === 'string' && r.miniatura.length < 200000 ? r.miniatura : '' };
  }

  /* aprovar, ocultar ou remover */
  if (d.acao === 'decidir') {
    const col = COLS[d.col], decisao = String(d.decisao || ''), motivo = txt(d.motivo, 500);
    if (!col || !['aprovar', 'ocultar', 'remover'].includes(decisao)) throw new HttpsError('invalid-argument', 'Decisão inválida.');
    if (decisao !== 'aprovar' && motivo.length < 5) throw new HttpsError('invalid-argument', 'Escreva em poucas palavras o motivo. O professor recebe essa observação.');
    const ref = db.doc(`${col}/${txt(d.id, 120)}`), rs = await ref.get(); if (!rs.exists) throw new HttpsError('not-found', 'Este material não está mais na rede.');
    const r = rs.data(), A = await alcance(db, eu, r.municipio_id); if (!A.pode(r)) throw new HttpsError('permission-denied', 'Este material não é da sua área.');
    const mod = { uid: req.auth.uid, nome: txt(eu.nome, 80), perfil: eu.perfil, decisao, motivo, em: FieldValue.serverTimestamp() };
    if (decisao === 'aprovar') {
      if (r.status === 'publicado') return { ok: true, status: 'publicado' };
      await ref.update({ status: 'publicado', denuncias: 0, moderacao: mod, aprovado_em: FieldValue.serverTimestamp() });
      await feedRede(db, r.municipio_id, itemDoFeed(d.col, rs.id, r, false)).catch(e => console.warn('feedRede', e.message));
    } else if (decisao === 'ocultar') {
      await ref.update({ status: 'oculto', moderacao: mod });
      await feedRede(db, r.municipio_id, null, rs.id).catch(() => {});
    } else {
      // remover da rede: apaga a cópia da rede (o original continua na conta do professor)
      const pasta = d.col === 'ia' ? `portal-ia-rede/${r.municipio_id}/${rs.id}/` : `trabalhos-rede/${r.municipio_id}/${rs.id}/`;
      await getStorage().bucket().deleteFiles({ prefix: pasta }).catch(() => {});
      if (d.col === 'ia') { const ds = await ref.collection('denuncias').get(); await Promise.all(ds.docs.map(x => x.ref.delete())); }
      await ref.delete();
      await feedRede(db, r.municipio_id, null, rs.id).catch(() => {});
      const o = origemRef(db, d.col, r); if (o) await o.set({ rede: FieldValue.delete() }, { merge: true }).catch(() => {});
    }
    if (decisao !== 'remover') { const o = origemRef(db, d.col, r);
      if (o) await o.set({ rede: { status: decisao === 'aprovar' ? 'publicado' : 'oculto', motivo: decisao === 'ocultar' ? motivo : '' } }, { merge: true }).catch(() => {}); }
    await db.collection('rede_moderacao_log').add({ municipio_id: r.municipio_id, col: d.col, item_id: rs.id, titulo: r.titulo || '', autor_uid: r.uid || '', ...mod });
    await avisarAutor(db, r, decisao, motivo, eu.nome);
    return { ok: true, status: decisao === 'aprovar' ? 'publicado' : decisao === 'ocultar' ? 'oculto' : 'removido' };
  }

  /* modo do município: aprovação antes (pendente) ou moderação depois */
  if (d.acao === 'modo') {
    if (!['admin', 'secretaria'].includes(eu.perfil)) throw new HttpsError('permission-denied', 'Só a secretaria ou a NEWPC mudam o modo da rede.');
    const A = await alcance(db, eu, d.municipio_id), modo = d.modo === 'antes' ? 'antes' : 'depois';
    await db.doc(`municipios/${A.mun}`).set({ rede_moderacao: modo, rede_moderacao_em: FieldValue.serverTimestamp(), rede_moderacao_por: txt(eu.nome, 80) }, { merge: true });
    return { ok: true, modo };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});


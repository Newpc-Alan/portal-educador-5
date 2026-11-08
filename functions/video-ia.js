// Vídeo interativo (nov/2026): o vídeo do YouTube pausa nos momentos certos e a turma responde na lousa.
// Duas entradas: o catálogo de Vídeos educativos (a NEWPC gera e revisa uma vez, todas as redes liberadas usam sem gastar crédito)
// e o "cole o link" do professor (gasta créditos da carteira, como o Portal IA).
// Quem pode usar é decidido na Central de IA (ia-acesso.js): video_ia (gerar por link) e video_interativo (usar os do catálogo).
// Os vídeos ficam em videos_interativos/{id}; o navegador só lê (regras), quem grava é esta função.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { contexto, RESERVA_TEXTO } from './portal-ia.js';
import { reservarCreditos, estornarCreditos, registrarConsumo, cfgCreditos } from './creditos.js';
import { acessoIA, mensagemAcesso, NOMES_IA } from './ia-acesso.js';
import { idYoutube, sistemaVideo, pedidoVideo, conferirVideo, corpoVideo, TIPOS_INTERACAO } from './video-ia-nucleo.js';

const GEMINI = defineSecret('GEMINI_API_KEY');
const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const FAIXA_SERIE = { bebes: 'Bebês (Educação Infantil)', cbp: 'Crianças bem pequenas (Educação Infantil)', cp: 'Crianças pequenas, 4 e 5 anos (Educação Infantil)' };
const serieDaFaixa = f => FAIXA_SERIE[f] || (/^em\d$/.test(f || '') ? f.slice(2) + 'ª série do Ensino Médio' : f ? f + 'º ano do Ensino Fundamental' : '');

async function chamarGemini(chave, modelos, corpo, limiteMs) {
  for (const mod of [...new Set(modelos.filter(Boolean))]) {
    let r;
    try {
      r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mod) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(limiteMs || 150000) });
    } catch (e) { console.warn('video-ia: tempo esgotado', mod, e.name); continue; }
    if (r.status === 404) { console.warn('video-ia: modelo fora do ar', mod); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = JSON.stringify(j).slice(0, 400); console.error('video-ia gemini', mod, r.status, msg);
      // vídeo privado, removido, com restrição de idade ou longo demais: o Google recusa o arquivo
      if (r.status === 400 || r.status === 403) return { erroVideo: true, modelo: mod, detalhe: msg };
      continue;
    }
    const u = j.usageMetadata || {}, cand = (j.candidates || [])[0] || {};
    const texto = ((cand.content || {}).parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    let json = null; try { json = JSON.parse(texto); } catch (e) { console.warn('video-ia: JSON inválido', mod, cand.finishReason); }
    return { modelo: mod, json, entrada: u.promptTokenCount || 0, saida: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) };
  }
  throw new HttpsError('unavailable', 'A IA não respondeu agora. Tente de novo em instantes. Seus créditos não foram descontados.');
}

// o que o professor ou o administrador gravou na tela de edição (sem IA): mesma limpeza da geração
function limparEdicao(lista, duracao) {
  const j = { interacoes: (Array.isArray(lista) ? lista : []).slice(0, 20).map(x => ({ tempo_seg: Number(x && x.t), tipo: x && x.tipo, pergunta: x && x.pergunta, opcoes: x && x.opcoes, correta: x && x.correta, explicacao: x && x.explicacao, trecho: x && x.trecho })) };
  return conferirVideo(j, { duracao, qtd: 0, tipos: TIPOS_INTERACAO }).interacoes;
}

// a geração em si (professor, catálogo manual e catálogo automático usam a mesma): até 2 tentativas, conferência das pausas
const MSG_SEM_CUSTO = ' Seus créditos não foram descontados.';
async function gerarPausas(chave, modelos, { youtube, serie, disciplina, tipos, qtd, duracao }) {
  const sistema = sistemaVideo(), base = pedidoVideo({ serie, disciplina, tipos, qtd, duracao });
  // vídeo longo (ou sem duração conhecida): a IA leva mais tempo para assistir
  const limite = !duracao || duracao > 900 ? 420000 : 150000;
  let r = null, c = null, ent = 0, sai = 0;
  const falha = (cod, msg) => { const e = new HttpsError(cod, msg + MSG_SEM_CUSTO); e.gasto = r ? { modelo: r.modelo, entrada: ent, saida: sai } : null; return e; };
  for (let t = 0; t < 2; t++) {
    const pedido = base + (t && c ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + c.problemas.join('; ') + '). Corrija.' : '');
    r = await chamarGemini(chave, modelos, corpoVideo(youtube, sistema, pedido), limite);
    if (r.erroVideo) throw falha('failed-precondition', 'Não consegui assistir este vídeo. Ele precisa ser público no YouTube, sem restrição de idade e com até 1 hora.');
    ent += r.entrada; sai += r.saida;
    if (!r.json) { c = { interacoes: [], problemas: ['resposta incompleta'] }; continue; }
    if (r.json.adequado === false) throw falha('failed-precondition', 'A IA achou que este vídeo não serve para virar aula interativa' + (r.json.motivo ? ': ' + txt(r.json.motivo, 200) : '.'));
    c = conferirVideo(r.json, { duracao, qtd, tipos });
    if (!c.problemas.length || c.interacoes.length >= Math.ceil(qtd * 0.6)) break;
  }
  if (!c || !c.interacoes.length) throw falha('unavailable', 'A IA não conseguiu montar as perguntas deste vídeo. Tente de novo.');
  return { r, c, ent, sai };
}

function exigirAcesso(ctx, recurso) {
  const a = acessoIA(recurso, ctx.ia);
  if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso(recurso, a.motivo));
  return { rede: a.via === 'rede' ? true : a.via === 'admin' ? undefined : false, nome: NOMES_IA[recurso] };
}

export const videoIa = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 540, memory: '512MiB', maxInstances: 20 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  const db = getFirestore(), uid = req.auth.uid, d = req.data || {};
  const ctx = await contexto(db, uid); ctx.uid = uid;

  // o que esta pessoa pode fazer (a tela decide os botões; as regras e esta função conferem de novo)
  if (d.acao === 'acesso') {
    const g = acessoIA('video_ia', ctx.ia), u = acessoIA('video_interativo', ctx.ia);
    return { admin: ctx.admin, gerar: g.ok, usar: u.ok, motivo_gerar: g.ok ? '' : mensagemAcesso('video_ia', g.motivo), motivo_usar: u.ok ? '' : mensagemAcesso('video_interativo', u.motivo), custo: cfgCreditos(ctx.cfgRaw).precos.video || 3 };
  }

  if (d.acao === 'gerar') {
    const catalogoId = txt(d.catalogo_id, 64).replace(/[^\w-]/g, '');
    let youtube = idYoutube(d.url || d.youtube_id), duracao = 0, serie = txt(d.serie, 60), disciplina = txt(d.disciplina, 60), titulo = txt(d.titulo, 140), canal = '';
    if (catalogoId) {
      // catálogo: só a NEWPC gera (a versão vale para todas as redes e passa por revisão antes de aparecer)
      if (!ctx.admin) throw new HttpsError('permission-denied', 'Os vídeos interativos do catálogo são preparados pela equipe do Portal.');
      const v = await db.doc(`videos/${catalogoId}`).get();
      if (!v.exists) throw new HttpsError('not-found', 'Vídeo do catálogo não encontrado.');
      const x = v.data(); youtube = x.youtube_id || ''; duracao = Number(x.duracao_seg) || 0; titulo = titulo || txt(x.titulo, 140); canal = txt(x.canal, 80);
      serie = serie || serieDaFaixa(x.faixa_de); disciplina = disciplina || txt(x.componente, 60);
    }
    if (!youtube) throw new HttpsError('invalid-argument', 'Cole o link de um vídeo do YouTube.');
    const tipos = (Array.isArray(d.tipos) ? d.tipos : []).filter(t => TIPOS_INTERACAO.includes(t));
    const qtd = Math.min(10, Math.max(2, Math.round(Number(d.qtd)) || 5));
    const pago = catalogoId ? { rede: undefined } : exigirAcesso(ctx, 'video_ia');
    const res = await reservarCreditos(db, ctx, 'video', pago);
    let g = null;
    try { g = await gerarPausas(GEMINI.value(), [ctx.cfg.modelo_texto, ...RESERVA_TEXTO], { youtube, serie, disciplina, tipos, qtd, duracao }); }
    catch (e) { await estornarCreditos(db, res); if (e.gasto && e.gasto.modelo) await registrarConsumo(db, ctx, null, e.gasto); throw e; }
    const { r, c, ent, sai } = g;
    const ref = catalogoId ? db.doc(`videos_interativos/cat_${catalogoId}`) : db.collection('videos_interativos').doc();
    const anterior = catalogoId ? await ref.get() : null;
    const doc = {
      origem: catalogoId ? 'catalogo' : 'link', catalogo_id: catalogoId || '', youtube_id: youtube, titulo: titulo || txt(r.json.titulo, 140) || 'Vídeo interativo',
      resumo: txt(r.json.resumo, 400), canal, serie, disciplina, duracao_seg: c.duracao || duracao, interacoes: c.interacoes,
      dono: catalogoId ? '' : uid, dono_nome: catalogoId ? '' : txt(ctx.eu.nome, 80), municipio_id: catalogoId ? '' : (ctx.eu.municipio_id || ''), escola_id: catalogoId ? '' : (ctx.eu.escola_id || ''),
      // catálogo: a geração nova fica em rascunho (some do catálogo) até o administrador revisar e publicar
      publicado: catalogoId ? false : true, modelo: r.modelo, gerado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(),
      ...(anterior && anterior.exists ? {} : { criado_em: FieldValue.serverTimestamp() })
    };
    await ref.set(doc, { merge: true });
    if (catalogoId) await db.doc(`videos/${catalogoId}`).set({ interativo: false }, { merge: true });
    await registrarConsumo(db, ctx, res, { modelo: r.modelo, entrada: ent, saida: sai, doc_id: ref.id });
    return { id: ref.id, pausas: c.interacoes.length, custo: res.custo || 0 };
  }

  // gravar a edição (perguntas e tempos); no catálogo, publicar ou recolher
  if (d.acao === 'salvar' || d.acao === 'excluir') {
    const id = txt(d.id, 64).replace(/[^\w-]/g, ''); if (!id) throw new HttpsError('invalid-argument', 'Vídeo não informado.');
    const ref = db.doc(`videos_interativos/${id}`), s = await ref.get();
    if (!s.exists) throw new HttpsError('not-found', 'Vídeo interativo não encontrado.');
    const x = s.data();
    if (!(ctx.admin || (x.origem === 'link' && x.dono === uid))) throw new HttpsError('permission-denied', 'Só quem criou pode alterar este vídeo.');
    if (d.acao === 'excluir') {
      await ref.delete();
      if (x.catalogo_id) await db.doc(`videos/${x.catalogo_id}`).set({ interativo: false }, { merge: true });
      return { ok: true };
    }
    const interacoes = limparEdicao(d.interacoes, x.duracao_seg);
    if (!interacoes.length) throw new HttpsError('invalid-argument', 'Deixe pelo menos uma pausa com pergunta.');
    const mudar = { interacoes, titulo: txt(d.titulo, 140) || x.titulo, atualizado_em: FieldValue.serverTimestamp() };
    if (x.origem === 'catalogo' && typeof d.publicado === 'boolean') mudar.publicado = d.publicado;
    await ref.set(mudar, { merge: true });
    if (x.catalogo_id && typeof d.publicado === 'boolean') await db.doc(`videos/${x.catalogo_id}`).set({ interativo: d.publicado }, { merge: true });
    return { ok: true, pausas: interacoes.length };
  }
  // professor avisa problema numa pergunta do catálogo; o administrador vê os avisos no painel e na edição do vídeo
  if (d.acao === 'avisar') {
    const id = txt(d.id, 64).replace(/[^\w-]/g, ''), i = Math.round(Number(d.pausa));
    const s = await db.doc(`videos_interativos/${id}`).get();
    if (!s.exists || s.data().origem !== 'catalogo') throw new HttpsError('not-found', 'Vídeo não encontrado.');
    const x = s.data(), p = (x.interacoes || [])[i]; if (!p) throw new HttpsError('invalid-argument', 'Pausa não encontrada.');
    const MOTIVOS = { errada: 'Resposta marcada como certa está errada', confusa: 'Pergunta confusa ou mal escrita', tempo: 'Pausa no momento errado', serie: 'Não serve para a série', outro: 'Outro' };
    const motivo = MOTIVOS[d.motivo] ? d.motivo : 'outro';
    // um aviso por pessoa, vídeo e pausa (tocar de novo só atualiza)
    const ref = db.doc(`videos_avisos/${id}_${i}_${uid}`), ja = await ref.get();
    await ref.set({ video_id: id, catalogo_id: x.catalogo_id || '', titulo: txt(x.titulo, 140), pausa: i, t: p.t, pergunta: txt(p.pergunta, 220), motivo, motivo_txt: MOTIVOS[motivo], texto: txt(d.texto, 500),
      uid, nome: txt(ctx.eu.nome, 80), municipio_id: ctx.eu.municipio_id || '', resolvido: false, em: FieldValue.serverTimestamp() }, { merge: true });
    if (!(ja.exists && ja.data().resolvido === false) && x.catalogo_id) await db.doc(`videos/${x.catalogo_id}`).set({ avisos_abertos: FieldValue.increment(1) }, { merge: true });
    return { ok: true };
  }
  if (d.acao === 'avisos' || d.acao === 'resolver') {
    if (!ctx.admin) throw new HttpsError('permission-denied', 'Só a equipe do Portal vê os avisos.');
    const id = txt(d.id, 64).replace(/[^\w-]/g, '');
    if (d.acao === 'resolver') {
      const ref = db.doc(`videos_avisos/${txt(d.aviso, 160).replace(/[^\w-]/g, '')}`), a = await ref.get();
      if (a.exists && a.data().resolvido === false) {
        await ref.set({ resolvido: true, resolvido_em: FieldValue.serverTimestamp(), resolvido_por: uid }, { merge: true });
        if (a.data().catalogo_id) await db.doc(`videos/${a.data().catalogo_id}`).set({ avisos_abertos: FieldValue.increment(-1) }, { merge: true });
      }
      return { ok: true };
    }
    const q = await db.collection('videos_avisos').where('video_id', '==', id).where('resolvido', '==', false).limit(100).get();
    return { avisos: q.docs.map(a => { const x = a.data(); return { id: a.id, pausa: x.pausa, t: x.t, pergunta: x.pergunta, motivo: x.motivo_txt, texto: x.texto, nome: x.nome, em: x.em ? x.em.toMillis() : 0 }; }).sort((a, b) => a.pausa - b.pausa) };
  }
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

// Catálogo automático (nov/2026): vídeo publicado no catálogo ganha a versão interativa sozinho, já publicada (o botão ▶ Interativo aparece).
// Interruptor no cadastro: videos.interativo_desligado = true tira do ar (as perguntas ficam guardadas). "Refazer" no painel: muda videos.interativo_refazer.
// Situação para o painel em videos.interativo_status: gerando | ok | erro | desligado (+ interativo_erro).
// Só reage a youtube_id, publicado, interativo_desligado e interativo_refazer: as gravações desta função (interativo, status) e as reações não disparam nada.
const qtdPorDuracao = d => d > 1800 ? 10 : d > 600 ? 8 : d > 300 || !d ? 6 : d > 150 ? 5 : d >= 90 ? 4 : 2;
export const videoInterativoAuto = onDocumentWritten({ document: 'videos/{id}', region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 540, memory: '512MiB', maxInstances: 3 }, async ev => {
  const db = getFirestore(), id = ev.params.id;
  const antes = ev.data.before.exists ? ev.data.before.data() : null, depois = ev.data.after.exists ? ev.data.after.data() : null;
  const refInt = db.doc(`videos_interativos/cat_${id}`), refVid = db.doc(`videos/${id}`);
  if (!depois) { await refInt.delete().catch(() => {}); return; }
  const mudou = k => k === 'interativo_desligado' ? !!(antes && antes[k]) !== !!depois[k] : JSON.stringify(antes ? antes[k] ?? null : null) !== JSON.stringify(depois[k] ?? null);
  if (depois.interativo_desligado === true) {
    if (mudou('interativo_desligado')) {
      const s = await refInt.get(); if (s.exists) await refInt.set({ publicado: false, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
      await refVid.set({ interativo: false, interativo_status: 'desligado' }, { merge: true });
    }
    return;
  }
  const pronto = depois.publicado === true && !!depois.youtube_id && depois.para_professores !== false;
  if (!pronto) return;
  const gatilho = !antes || mudou('youtube_id') || mudou('interativo_refazer') || (mudou('publicado') && depois.publicado) || mudou('interativo_desligado');
  if (!gatilho) return;
  const atual = await refInt.get();
  // já existe para este mesmo vídeo e ninguém pediu para refazer: só republica
  if (atual.exists && atual.data().youtube_id === depois.youtube_id && !mudou('interativo_refazer')) {
    await refInt.set({ publicado: true, atualizado_em: FieldValue.serverTimestamp() }, { merge: true });
    await refVid.set({ interativo: true, interativo_status: 'ok', interativo_erro: FieldValue.delete() }, { merge: true });
    return;
  }
  const dc = depois.duracao_seg > 0 && depois.duracao_seg < 7200 ? depois.duracao_seg : 0;
  if (dc && dc < 60) { await refVid.set({ interativo: false, interativo_status: 'erro', interativo_erro: 'Vídeo curto demais para ter pausas com pergunta.' }, { merge: true }); return; }
  await refVid.set({ interativo_status: 'gerando', interativo_erro: FieldValue.delete() }, { merge: true });
  const cs = await db.doc('config/portal_ia').get(); const cfg = cs.exists ? cs.data() : {};
  const serie = serieDaFaixa(depois.faixa_de), disciplina = txt(depois.componente, 60), qtd = qtdPorDuracao(dc);
  try {
    const { r, c, ent, sai } = await gerarPausas(GEMINI.value(), [cfg.modelo_texto || 'gemini-3.6-flash', ...RESERVA_TEXTO], { youtube: depois.youtube_id, serie, disciplina, tipos: [], qtd, duracao: dc });
    await refInt.set({ origem: 'catalogo', catalogo_id: id, youtube_id: depois.youtube_id, titulo: txt(depois.titulo, 140) || txt(r.json.titulo, 140), resumo: txt(r.json.resumo, 400), canal: txt(depois.canal, 80),
      serie, disciplina, duracao_seg: c.duracao || dc, interacoes: c.interacoes, dono: '', dono_nome: '', municipio_id: '', escola_id: '', publicado: true, modelo: r.modelo, automatico: true,
      gerado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(), criado_em: FieldValue.serverTimestamp() });
    // duração cadastrada vazia ou absurda: fica a que a IA mediu
    const durOk = c.duracao > 0 && (!dc || Math.abs(c.duracao - dc) > 120) ? { duracao_seg: c.duracao } : {};
    await refVid.set({ interativo: true, interativo_status: 'ok', interativo_erro: FieldValue.delete(), ...durOk }, { merge: true });
    const cc = cfgCreditos(cfg), pr = cc.custo_modelo[r.modelo] || cc.custo_modelo['gemini-3.6-flash'];
    const mes = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '');
    await db.doc('stats/ia_uso').set({ [mes]: { video_catalogo: { usos: FieldValue.increment(1), custo_usd: FieldValue.increment((ent / 1e6 * pr[0] + sai / 1e6 * pr[1]) * (Number(cc.fator_custo) || 1)) } } }, { merge: true });
  } catch (e) {
    console.warn('video-ia auto', id, e.message);
    await refVid.set({ interativo: atual.exists && atual.data().publicado === true, interativo_status: 'erro', interativo_erro: String(e.message || 'falhou').replace(MSG_SEM_CUSTO, '').slice(0, 240) }, { merge: true });
  }
});

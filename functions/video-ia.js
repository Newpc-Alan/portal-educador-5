// Vídeo interativo (nov/2026): o vídeo do YouTube pausa nos momentos certos e a turma responde na lousa.
// Duas entradas: o catálogo de Vídeos educativos (a NEWPC gera e revisa uma vez, todas as redes liberadas usam sem gastar crédito)
// e o "cole o link" do professor (gasta créditos da carteira, como o Portal IA).
// Quem pode usar é decidido na Central de IA (ia-acesso.js): video_ia (gerar por link) e video_interativo (usar os do catálogo).
// Os vídeos ficam em videos_interativos/{id}; o navegador só lê (regras), quem grava é esta função.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
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

async function chamarGemini(chave, modelos, corpo) {
  for (const mod of [...new Set(modelos.filter(Boolean))]) {
    let r;
    try {
      r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(mod) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(150000) });
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

function exigirAcesso(ctx, recurso) {
  const a = acessoIA(recurso, ctx.ia);
  if (!a.ok) throw new HttpsError('failed-precondition', mensagemAcesso(recurso, a.motivo));
  return { rede: a.via === 'rede' ? true : a.via === 'admin' ? undefined : false, nome: NOMES_IA[recurso] };
}

export const videoIa = onCall({ region: 'southamerica-east1', secrets: [GEMINI], timeoutSeconds: 300, memory: '512MiB', maxInstances: 20 }, async req => {
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
    let r = null, c = null, ent = 0, sai = 0;
    try {
      const sistema = sistemaVideo(), base = pedidoVideo({ serie, disciplina, tipos, qtd, duracao });
      for (let t = 0; t < 2; t++) {
        const pedido = base + (t && c ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + c.problemas.join('; ') + '). Corrija.' : '');
        r = await chamarGemini(GEMINI.value(), [ctx.cfg.modelo_texto, ...RESERVA_TEXTO], corpoVideo(youtube, sistema, pedido));
        if (r.erroVideo) throw new HttpsError('failed-precondition', 'Não consegui assistir este vídeo. Ele precisa ser público no YouTube, sem restrição de idade e com até 1 hora. Seus créditos não foram descontados.');
        ent += r.entrada; sai += r.saida;
        if (!r.json) { c = { interacoes: [], problemas: ['resposta incompleta'] }; continue; }
        if (r.json.adequado === false) throw new HttpsError('failed-precondition', 'A IA achou que este vídeo não serve para virar aula interativa' + (r.json.motivo ? ': ' + txt(r.json.motivo, 200) : '.') + ' Seus créditos não foram descontados.');
        c = conferirVideo(r.json, { duracao, qtd, tipos });
        if (!c.problemas.length || c.interacoes.length >= Math.ceil(qtd * 0.6)) break;
      }
      if (!c || !c.interacoes.length) throw new HttpsError('unavailable', 'A IA não conseguiu montar as perguntas deste vídeo. Tente de novo. Seus créditos não foram descontados.');
    } catch (e) { await estornarCreditos(db, res); if (r) await registrarConsumo(db, ctx, null, { modelo: r.modelo, entrada: ent, saida: sai }); throw e; }
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
  throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});

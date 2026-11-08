// GRAVA. Vídeo interativo (nov/2026): gera RASCUNHOS (publicado = false) para vídeos curtos do catálogo, um de cada componente,
// para a equipe revisar em /video/ e publicar. Não mexe em vídeo que já tem versão interativa. Custo: ~R$ 0,30 por vídeo.
// QTD (padrão 8) vídeos por execução.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore, FieldValue } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const N = await import(pathToFileURL(process.cwd() + '/video-ia-nucleo.js').href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 2000));
const QTD = Math.min(100, Number(process.env.QTD) || 8);
// PUBLICAR=1: já publica (aparece o botão Interativo no catálogo) e publica também os rascunhos que existirem
const PUBLICAR = process.env.PUBLICAR === '1';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const tk = await (await auth.getClient()).getAccessToken();
const rs = await fetch('https://secretmanager.googleapis.com/v1/projects/portal-educador-5/secrets/GEMINI_API_KEY/versions/latest:access', { headers: { Authorization: 'Bearer ' + tk.token } });
const js = await rs.json(); if (!js.payload) { console.log('::error::sem acesso ao segredo GEMINI_API_KEY'); process.exit(1); }
const CHAVE = Buffer.from(js.payload.data, 'base64').toString().trim(); console.log('::add-mask::' + CHAVE);

const db = getFirestore();
const cfg = (await db.doc('config/portal_ia').get()).data() || {};
const MODELOS = [...new Set([cfg.modelo_texto, 'gemini-3.6-flash', 'gemini-flash-latest'].filter(Boolean))];
const FX = { bebes: 'Bebês (Educação Infantil)', cbp: 'Crianças bem pequenas (Educação Infantil)', cp: 'Crianças pequenas, 4 e 5 anos (Educação Infantil)' };
const serieDe = f => FX[f] || (/^em\d$/.test(f || '') ? f.slice(2) + 'ª série do Ensino Médio' : f ? f + 'º ano do Ensino Fundamental' : '');
const ja = new Set((await db.collection('videos_interativos').where('origem', '==', 'catalogo').get()).docs.map(d => d.id.replace(/^cat_/, '')));
const todos = (await db.collection('videos').where('publicado', '==', true).get()).docs.map(d => ({ id: d.id, ...d.data() }))
  // TODOS=1: também os longos (até ~1h, o limite do Gemini), os sem duração cadastrada e os de crianças bem pequenas; só fica de fora o que tem menos de 1 minuto
  .filter(v => v.youtube_id && !ja.has(v.id) && v.para_professores !== false && (process.env.TODOS === '1' ? !(v.duracao_seg > 0 && v.duracao_seg < 60) && v.faixa_de !== 'bebes' : v.duracao_seg >= 90 && v.duracao_seg <= 600 && !/^(bebes|cbp)$/.test(v.faixa_de || '')));
// um de cada componente primeiro, os mais bem colocados (prioridade 1) antes
todos.sort((a, b) => ((a.prioridade || 2) - (b.prioridade || 2)) || String(a.titulo).localeCompare(String(b.titulo)));
const escolha = [], comp = new Set();
for (const v of todos) { if (escolha.length >= QTD) break; if (comp.has(v.componente)) continue; comp.add(v.componente); escolha.push(v); }
for (const v of todos) { if (escolha.length >= QTD) break; if (!escolha.includes(v)) escolha.push(v); }
aviso('catálogo: ' + todos.length + ' vídeos sem versão interativa; gerando ' + escolha.length);
let ok = 0;
if (PUBLICAR) {
  const rasc = await db.collection('videos_interativos').where('origem', '==', 'catalogo').where('publicado', '==', false).get();
  for (const d of rasc.docs) { await d.ref.set({ publicado: true, atualizado_em: FieldValue.serverTimestamp() }, { merge: true }); await db.doc('videos/' + d.data().catalogo_id).set({ interativo: true }, { merge: true }); }
  aviso('rascunhos publicados: ' + rasc.size);
}
async function um(v) {
  // duração cadastrada errada ou ausente em alguns (ex.: 1257 min): acima de 2 h, trata como desconhecida
  const dc = v.duracao_seg > 0 && v.duracao_seg < 7200 ? v.duracao_seg : 0;
  const serie = serieDe(v.faixa_de), qtd = dc > 1800 ? 10 : dc > 600 ? 8 : dc > 300 || !dc ? 6 : dc > 150 ? 5 : dc >= 90 ? 4 : 2;
  let c = null, mod = '', o = null, ent = 0, sai = 0;
  for (let t = 0; t < 2 && !(c && !c.problemas.length); t++) {
    for (const m of MODELOS) {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
        body: JSON.stringify(N.corpoVideo(v.youtube_id, N.sistemaVideo(), N.pedidoVideo({ serie, disciplina: v.componente, qtd, duracao: dc }) + (c ? '\n\nATENÇÃO: a tentativa anterior veio com problema (' + c.problemas.join('; ') + '). Corrija.' : ''))), signal: AbortSignal.timeout(dc > 900 || !dc ? 420000 : 170000) }).catch(() => null);
      if (!r || r.status === 404) continue;
      const j = await r.json().catch(() => ({})); if (!r.ok) { aviso('ERRO ' + v.titulo + ' HTTP ' + r.status); break; }
      const u = j.usageMetadata || {}; ent += u.promptTokenCount || 0; sai += (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
      try { o = JSON.parse(((j.candidates || [])[0] || {}).content.parts.filter(p => !p.thought).map(p => p.text || '').join('')); } catch (e) { o = null; }
      mod = m; break;
    }
    if (!o) continue;
    if (o.adequado === false) { aviso('PULADO ' + v.titulo + ': ' + o.motivo); break; }
    c = N.conferirVideo(o, { duracao: dc, qtd });
  }
  if (!c || !c.interacoes.length || (o && o.adequado === false)) { aviso('SEM RESULTADO ' + v.titulo); return; }
  await db.doc('videos_interativos/cat_' + v.id).set({ origem: 'catalogo', catalogo_id: v.id, youtube_id: v.youtube_id, titulo: v.titulo || o.titulo, resumo: String(o.resumo || '').slice(0, 400), canal: v.canal || '',
    serie, disciplina: v.componente || '', duracao_seg: c.duracao || dc, interacoes: c.interacoes, dono: '', dono_nome: '', municipio_id: '', escola_id: '', publicado: PUBLICAR, modelo: mod,
    gerado_em: FieldValue.serverTimestamp(), atualizado_em: FieldValue.serverTimestamp(), criado_em: FieldValue.serverTimestamp() });
  await db.doc('stats/ia_uso').set({ [new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 7).replace('-', '')]: { video_catalogo: { usos: FieldValue.increment(1), custo_usd: FieldValue.increment((ent * 0.75 + sai * 3.75) / 1e6 * 1.6) } } }, { merge: true });
  if (PUBLICAR) await db.doc('videos/' + v.id).set({ interativo: true }, { merge: true });
  ok++; aviso((PUBLICAR ? 'PUBLICADO ' : 'RASCUNHO ') + v.titulo + ' (' + (v.componente || '') + ', ' + serie + ') · ' + c.interacoes.length + ' pausas' + (c.problemas.length ? ' · avisos: ' + c.problemas.join('; ') : ''));
}
// 4 de cada vez (cabe no tempo da rotina)
for (let i = 0; i < escolha.length; i += 6) await Promise.all(escolha.slice(i, i + 6).map(v => um(v).catch(e => aviso('ERRO ' + v.titulo + ' ' + e.message))));
aviso('pronto: ' + ok + (PUBLICAR ? ' publicados.' : ' rascunhos.') + ' Revise e publique em www.portaldoeducador.com.br/video/ (aba Do catálogo do Portal).');

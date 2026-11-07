// Teste do Vídeo interativo (nov/2026), só leitura no banco: pega 3 vídeos curtos do catálogo, pede ao Gemini as pausas com pergunta
// e mostra o resultado em avisos (tempo, tipo, pergunta, o trecho que o vídeo mostrou antes). Gasta poucos centavos de IA. Não grava nada.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const req = createRequire(process.cwd() + '/');
const { initializeApp, applicationDefault } = await import(pathToFileURL(req.resolve('firebase-admin/app')).href);
const { getFirestore } = await import(pathToFileURL(req.resolve('firebase-admin/firestore')).href);
const { GoogleAuth } = await import(pathToFileURL(req.resolve('google-auth-library')).href);
const N = await import(pathToFileURL(process.cwd() + '/video-ia-nucleo.js').href);
initializeApp({ credential: applicationDefault(), projectId: 'portal-educador-5' });
const limpo = t => String(t).replace(/[{}"]/g, ' ').replace(/\r?\n/g, ' | ');
const aviso = t => console.log('::notice::' + limpo(t).slice(0, 3000));

// chave do Gemini direto do Secret Manager (a mesma das funções); nunca aparece no log
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const tk = await (await auth.getClient()).getAccessToken();
const rs = await fetch('https://secretmanager.googleapis.com/v1/projects/portal-educador-5/secrets/GEMINI_API_KEY/versions/latest:access', { headers: { Authorization: 'Bearer ' + tk.token } });
const js = await rs.json(); if (!js.payload) { console.log('::error::sem acesso ao segredo GEMINI_API_KEY (HTTP ' + rs.status + ')'); process.exit(1); }
const CHAVE = Buffer.from(js.payload.data, 'base64').toString().trim(); console.log('::add-mask::' + CHAVE);

const db = getFirestore();
const cfg = (await db.doc('config/portal_ia').get()).data() || {};
const MODELOS = [...new Set([cfg.modelo_texto, 'gemini-3.6-flash', 'gemini-flash-latest'].filter(Boolean))];
const q = await db.collection('videos').where('publicado', '==', true).limit(300).get();
const curtos = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.youtube_id && v.duracao_seg >= 90 && v.duracao_seg <= 420);
aviso('catálogo: ' + q.size + ' publicados, ' + curtos.length + ' entre 1min30 e 7min · modelos ' + MODELOS.join(', '));
// variedade: componentes diferentes
const escolha = []; const vistos = new Set();
for (const v of curtos.sort(() => Math.random() - 0.5)) { const c = v.componente || v.disciplina || '?'; if (vistos.has(c)) continue; vistos.add(c); escolha.push(v); if (escolha.length === 3) break; }

for (const v of escolha) {
  const FX = { bebes: 'Bebês', cbp: 'Crianças bem pequenas', cp: 'Crianças pequenas (4 e 5 anos)' }; const fx = v.faixa_de || ''; const serie = FX[fx] || (/^em\d/.test(fx) ? fx.slice(2) + 'ª série do Ensino Médio' : fx ? fx + 'º ano do Ensino Fundamental' : '5º ano do Ensino Fundamental');
  const disciplina = v.componente || v.disciplina || '';
  const qtd = v.duracao_seg > 240 ? 6 : 4;
  const t0 = Date.now();
  let r = null, j = null, mod = '';
  for (const m of MODELOS) {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
      body: JSON.stringify(N.corpoVideo(v.youtube_id, N.sistemaVideo(), N.pedidoVideo({ serie, disciplina, qtd, duracao: v.duracao_seg }))) , signal: AbortSignal.timeout(170000) }).catch(e => ({ ok: false, status: 0, json: async () => ({ erro: String(e) }) }));
    j = await r.json().catch(() => ({})); mod = m;
    if (r.status !== 404) break;
  }
  const s = ((Date.now() - t0) / 1000).toFixed(0);
  if (!r.ok) { console.log('::error::' + v.titulo + ' · HTTP ' + r.status + ' · ' + limpo(JSON.stringify(j)).slice(0, 600)); continue; }
  const u = j.usageMetadata || {};
  const texto = ((j.candidates || [])[0] || {}).content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
  let o = null; try { o = JSON.parse(texto); } catch (e) { console.log('::error::JSON inválido em ' + v.titulo); continue; }
  const c = N.conferirVideo(o, { duracao: v.duracao_seg, qtd });
  const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  aviso('VÍDEO ' + v.titulo + ' (' + mmss(v.duracao_seg) + ', ' + disciplina + ', ' + serie + ') · ' + mod + ' em ' + s + 's · tokens entrada ' + u.promptTokenCount + ' saída ' + ((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) +
    ' · adequado ' + o.adequado + (o.motivo ? ' (' + o.motivo + ')' : '') + ' · problemas: ' + (c.problemas.join('; ') || 'nenhum') + ' · duração percebida ' + o.duracao_seg + 's');
  aviso('PAUSAS ' + v.titulo.slice(0, 40) + ' :: ' + c.interacoes.map(x => '[' + mmss(x.t) + ' ' + x.tipo + '] ' + x.pergunta + (x.opcoes.length ? ' (' + x.opcoes.map((op, i) => (i === x.correta ? '*' : '') + op).join(' / ') + ')' : '') + ' <trecho: ' + x.trecho + '>').join(' || '));
}

// Portal Maestro dentro do Portal do Aluno (nov/2026)
// O aluno fica no Portal do Educador (Início, materiais, jogos) e, com a aula da turma aberta, este aparelho segue o professor:
// presença com o nome e a matrícula, tela pausada, conteúdo enviado e mão levantada. Vale para o app do tablet e para
// navegador sem a extensão do Maestro (no Chromebook com a extensão, quem segue o professor é a extensão).
// Banco: Realtime Database do Maestro (newpc-sala), o mesmo da extensão e da página do aluno: aulas/{codigo}/...
const FB = "https://newpc-sala-default-rtdb.firebaseio.com";
const VERSAO = "web-portal-1.0";              // "web-" = aparelho sem extensão (tablet/celular) para o painel do professor
const INTERVALO_MS = 3000, PRESENCA_A_CADA = 5, VALIDADE_CMD_MS = 120000, PAINEL_SEM_SINAL_MS = 120000;
const MSGS = ["/maestro/aluno/bloqueio/msg1.jpg", "/maestro/aluno/bloqueio/msg2.jpg", "/maestro/aluno/bloqueio/msg3.jpg"];
const APP = /PortalMaestroApp/.test(navigator.userAgent), ANDROID = /Android/i.test(navigator.userAgent);
const S = { afResp: "", pqResp: "", afAberta: "", pqAberta: "", comp: null, aula: "", nome: "", aluno: "", dev: "", timer: null, volta: 0, offset: 0, executados: new Set(), bloqueado: false, mao: false, fora: false, ocupado: false, aoSair: null, toast: null };

async function fb(caminho, metodo, corpo, keepalive) {
  const r = await fetch(`${FB}/${caminho}.json`, { method: metodo || "GET", headers: { "Content-Type": "application/json" }, keepalive: !!keepalive,
    body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  if (!r.ok) throw new Error("maestro " + r.status);
  return r.json();
}
function idAparelho() {
  let id = ""; try { id = localStorage.getItem("pde_maestro_aparelho") || ""; } catch (e) { /* sem armazenamento */ }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) { id = "portal_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10); try { localStorage.setItem("pde_maestro_aparelho", id); } catch (e) { /* ignora */ } }
  return id;
}
const agora = () => Date.now() + S.offset;
const el = (tag, css, html) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html !== undefined) e.innerHTML = html; return e; };

// ---------- presença ----------
function aba() {
  if (S.bloqueado) return { titulo: "⏸️ Tela pausada", url: "" };
  if (S.fora) return { titulo: "⚠ Saiu da página do Portal", url: "" };
  const q = document.getElementById("mqQuadro");
  if (q && q.dataset.url) return { titulo: String(q.dataset.nome || q.dataset.url).slice(0, 120), url: q.dataset.url.slice(0, 300) };
  const t = (document.getElementById("secTitulo") || {}).textContent || document.title || "Portal do Educador";
  return { titulo: ("Portal · " + t).slice(0, 120), url: location.pathname.slice(0, 120) };
}
async function presenca(keepalive) {
  if (!S.aula) return;
  const antes = Date.now();
  const r = await fb(`aulas/${S.aula}/alunos/${S.dev}`, "PATCH", { nome: S.nome || "Aluno", aluno_id: S.aluno || null,
    email: (APP ? "📱 App do tablet" : ANDROID ? "📱 Celular" : "🌐 Navegador") + " · Portal do Aluno", bloqueado: !!S.bloqueado, aba: aba(), versao: VERSAO,
    ultimaAtividade: { ".sv": "timestamp" } }, keepalive);
  if (r && typeof r.ultimaAtividade === "number") S.offset = r.ultimaAtividade - Math.round((antes + Date.now()) / 2);
}

// ---------- tela pausada ----------
function pausar(ligar) {
  if (ligar === S.bloqueado) return;
  S.bloqueado = ligar;
  let b = document.getElementById("mqPausa");
  if (ligar) {
    if (!b) {
      b = el("div", "position:fixed;inset:0;z-index:2147483000;background:#071621;display:grid;place-items:center;color:#fff;text-align:center;font-family:inherit;padding:20px");
      b.id = "mqPausa"; b.setAttribute("role", "alertdialog"); b.setAttribute("aria-label", "Tela pausada pelo professor");
      b.innerHTML = '<div style="display:grid;gap:14px;justify-items:center;max-width:620px"><img id="mqPausaImg" alt="" style="width:min(86vw,560px);border-radius:18px"><b style="font-size:26px">⏸️ Atenção ao professor</b><span style="opacity:.8">A tela volta sozinha quando o professor liberar.</span></div>';
      document.body.appendChild(b);
      b.addEventListener("contextmenu", e => e.preventDefault());
    }
    let i = 0; const troca = () => { const im = document.getElementById("mqPausaImg"); if (im) im.src = MSGS[i++ % MSGS.length]; };
    troca(); clearInterval(S.trocaPausa); S.trocaPausa = setInterval(troca, 40000);
    try { navigator.vibrate && navigator.vibrate(150); } catch (e) { /* ignora */ }
  } else { clearInterval(S.trocaPausa); if (b) b.remove(); }
  presenca().catch(() => {});
}

// ---------- conteúdo enviado pelo professor ----------
function embed(url) {
  const yt = String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return yt ? "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=1&rel=0" : url;
}
function abrirConteudo(url, nome) {
  fecharConteudo();
  const f = el("div", "position:fixed;inset:0;z-index:2147482000;background:#071621;display:flex;flex-direction:column");
  f.id = "mqConteudo";
  const topo = el("div", "display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f2c4a;color:#fff;font-family:inherit");
  topo.innerHTML = '<span style="font-size:20px">🎼</span><b style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></b><button type="button" id="mqFechar" style="font:inherit;font-weight:800;border:0;border-radius:10px;padding:9px 14px;background:#8DC63F;color:#0f2c4a;cursor:pointer">✕ Fechar</button>';
  topo.querySelector("b").textContent = nome || "Atividade do professor";
  const q = el("iframe", "flex:1;border:0;width:100%;background:#fff");
  q.id = "mqQuadro"; q.src = embed(url); q.dataset.url = url; q.dataset.nome = nome || "";
  q.setAttribute("allow", "autoplay; fullscreen; camera; microphone; clipboard-write"); q.setAttribute("allowfullscreen", "");
  f.appendChild(topo); f.appendChild(q); document.body.appendChild(f);
  document.getElementById("mqFechar").addEventListener("click", () => { fecharConteudo(); presenca().catch(() => {}); });
  presenca().catch(() => {});
}
function fecharConteudo() { const f = document.getElementById("mqConteudo"); if (f) f.remove(); }

// ---------- regência: pesquisa rápida, pergunta só para este aluno e cronômetro ----------
function folha(id, html) {
  let f = document.getElementById(id); if (f) f.remove();
  // pesquisa e pergunta podem chegar juntas: ficam empilhadas na mesma faixa de baixo, sem uma cobrir a outra
  let pilha = document.getElementById("mqFolhas");
  if (!pilha) { pilha = el("div", "position:fixed;left:0;right:0;bottom:0;z-index:2147482500;display:flex;flex-direction:column;gap:8px;max-height:85vh;overflow:auto;pointer-events:none"); pilha.id = "mqFolhas"; document.body.appendChild(pilha); }
  f = el("div", "pointer-events:auto;background:#fff;color:#0c2338;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.3);padding:18px 18px max(18px,env(safe-area-inset-bottom));font-family:inherit;display:grid;gap:12px");
  f.id = id; f.setAttribute("role", "dialog"); f.innerHTML = html; pilha.appendChild(f);
  try { navigator.vibrate && navigator.vibrate(120); } catch (e) { /* ignora */ }
  return f;
}
const btn = (cor, txt, attr) => '<button type="button" ' + attr + ' style="font:inherit;font-weight:800;font-size:17px;border:0;border-radius:14px;padding:14px;cursor:pointer;background:' + cor + ';color:#0c2338">' + txt + "</button>";
function pesquisa(a) {
  if (!a || !a.ativa || !a.id || a.id === S.afResp) { if (S.afAberta && (!a || !a.ativa || a.id !== S.afAberta)) { S.afAberta = ""; const f = document.getElementById("mqPesq"); if (f) f.remove(); } return; }
  if (S.afAberta === a.id) return;
  S.afAberta = a.id;
  const f = folha("mqPesq", '<b style="font-size:19px">📊 ' + esc(String(a.pergunta || "Entenderam?").slice(0, 140)) + "</b>" +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' + btn("#bfe5a1", "🟢 Entendi", 'data-v="verde"') + btn("#ffe58a", "🟡 Mais ou menos", 'data-v="amarelo"') + btn("#ffb4b4", "🔴 Não entendi", 'data-v="vermelho"') + "</div>");
  f.addEventListener("click", async e => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    try { await fb(`aulas/${S.aula}/respostas/afinacao/${a.id}/${S.dev}`, "PUT", { valor: b.dataset.v, nome: S.nome, ts: { ".sv": "timestamp" } });
      S.afResp = a.id; f.innerHTML = '<b style="font-size:19px;text-align:center">✅ Resposta enviada</b>'; setTimeout(() => f.remove(), 1400); }
    catch (err) { aviso("Sem conexão. Tente de novo."); }
  });
}
function pergunta(p) {
  if (!p || !p.ativa || !p.id || p.id === S.pqResp) { if (S.pqAberta && (!p || !p.ativa || p.id !== S.pqAberta)) { S.pqAberta = ""; const f = document.getElementById("mqPerg"); if (f) f.remove(); } return; }
  if (S.pqAberta === p.id) return;
  S.pqAberta = p.id;
  const ops = Array.isArray(p.opcoes) ? p.opcoes.map(o => String(o).slice(0, 80)).filter(Boolean).slice(0, 4) : [];
  const f = folha("mqPerg", '<small style="font-weight:800;color:#2671AB">💬 Pergunta do professor, só para você</small><b style="font-size:19px">' + esc(String(p.texto || "").slice(0, 300)) + "</b>" +
    (ops.length >= 2 ? '<div style="display:grid;gap:8px">' + ops.map((o, i) => btn("#eef3f8", "ABCD"[i] + ") " + esc(o), 'data-r="' + esc(o) + '"')).join("") + "</div>"
      : '<textarea id="mqResp" rows="3" maxlength="500" style="font:inherit;font-size:16px;padding:12px;border:2px solid #cfdbe7;border-radius:12px" placeholder="Escreva sua resposta"></textarea>' + btn("#8DC63F", "Enviar resposta", 'data-r=""')));
  f.addEventListener("click", async e => {
    const b = e.target.closest("[data-r]"); if (!b) return;
    const resp = (b.dataset.r || (document.getElementById("mqResp") || {}).value || "").trim().slice(0, 500);
    if (!resp) { aviso("Escreva sua resposta."); return; }
    try { await fb(`aulas/${S.aula}/respostas/perguntas/${S.dev}/${p.id}`, "PUT", { resposta: resp, ts: { ".sv": "timestamp" } });
      S.pqResp = p.id; f.innerHTML = '<b style="font-size:19px;text-align:center">✅ Resposta enviada ao professor</b>'; setTimeout(() => f.remove(), 1400); }
    catch (err) { aviso("Sem conexão. Tente de novo."); }
  });
}
function cronometro(c) {
  const ok = c && c.ativo && c.id && typeof c.inicio === "number" && c.duracaoMs > 0 && agora() < c.inicio + c.duracaoMs + 8000;
  let chip = document.getElementById("mqTempo");
  if (!ok) { S.comp = null; if (chip) chip.remove(); return; }
  if (!S.comp || S.comp.id !== c.id) S.comp = { id: c.id, titulo: String(c.titulo || "Atividade").slice(0, 40), fim: c.inicio + c.duracaoMs, total: c.duracaoMs, avisou: false };
  if (!chip) {
    chip = el("div", "position:fixed;top:12px;right:12px;z-index:2147481500;background:#0f2c4a;color:#fff;border-radius:14px;padding:8px 14px;font-family:inherit;box-shadow:0 8px 22px rgba(0,0,0,.3);min-width:150px");
    chip.id = "mqTempo"; chip.innerHTML = '<small id="mqTempoT" style="display:block;opacity:.8"></small><b id="mqTempoN" style="font-size:22px"></b><div style="height:5px;background:rgba(255,255,255,.2);border-radius:9px;margin-top:4px"><i id="mqTempoB" style="display:block;height:100%;background:#8DC63F;border-radius:9px"></i></div>';
    document.body.appendChild(chip);
  }
}
function tickTempo() {
  const c = S.comp; if (!c) return;
  const resta = c.fim - agora(), seg = Math.max(0, Math.ceil(resta / 1000));
  const t = document.getElementById("mqTempoT"), n = document.getElementById("mqTempoN"), b = document.getElementById("mqTempoB"); if (!n) return;
  t.textContent = "⏱️ " + c.titulo; n.textContent = resta > 0 ? Math.floor(seg / 60) + ":" + String(seg % 60).padStart(2, "0") : "TEMPO!";
  b.style.width = Math.max(0, Math.min(100, resta / c.total * 100)) + "%";
  if (resta <= 0 && !c.avisou) { c.avisou = true; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* ignora */ } }
}
setInterval(tickTempo, 500);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- mão levantada ----------
function botaoMao() {
  if (document.getElementById("mqMao")) return;
  const b = el("button", "position:fixed;left:16px;bottom:16px;z-index:2147481000;border:0;border-radius:40px;padding:12px 18px;font:inherit;font-weight:800;font-size:15px;background:#f5d547;color:#3d3000;box-shadow:0 8px 22px rgba(0,0,0,.25);cursor:pointer");
  b.id = "mqMao"; b.type = "button"; b.textContent = "✋ Levantar a mão";
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      if (S.mao) await fb(`aulas/${S.aula}/alunos/${S.dev}/mao`, "DELETE"); else await fb(`aulas/${S.aula}/alunos/${S.dev}/mao`, "PUT", { ".sv": "timestamp" });
      S.mao = !S.mao; desenharMao();
    } catch (e) { aviso("Sem conexão. Tente de novo."); }
    b.disabled = false;
  });
  document.body.appendChild(b); desenharMao();
}
function desenharMao() { const b = document.getElementById("mqMao"); if (!b) return; b.textContent = S.mao ? "✋ Mão levantada · baixar" : "✋ Levantar a mão"; b.style.background = S.mao ? "#fff3d6" : "#f5d547"; }
function aviso(t) {
  const a = el("div", "position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483100;background:#0f2c4a;color:#fff;padding:12px 18px;border-radius:12px;font-family:inherit;font-weight:700;box-shadow:0 8px 22px rgba(0,0,0,.3)");
  a.textContent = t; document.body.appendChild(a); setTimeout(() => a.remove(), 4000);
}

// ---------- ciclo ----------
async function ciclo() {
  if (!S.aula || S.ocupado) return;
  S.ocupado = true;
  try {
    if (S.volta++ % PRESENCA_A_CADA === 0) await presenca().catch(() => {});
    const c = await fb(`aulas/${S.aula}/controle`);
    const fim = c && typeof c.ate === "number" && agora() > c.ate + 60000;
    if (!c || c.encerrada || fim) { parar(true); return; }
    // trava de segurança: sem sinal do painel do professor por 2 minutos, a tela não fica presa
    const vivo = typeof c.professorVivo === "number" && agora() - c.professorVivo < PAINEL_SEM_SINAL_MS;
    const ind = c.bloqueio ? c.bloqueio[S.dev] : undefined;
    pausar(vivo && (typeof ind === "boolean" ? ind : !!c.bloqueioGeral));
    pesquisa(c.afinacao); pergunta(c.perguntas ? c.perguntas[S.dev] : null); cronometro(c.compasso);
    const cmd = [c.comando, c.comandos && c.comandos[S.dev]].filter(x => x && x.id && typeof x.ts === "number").sort((a, b) => b.ts - a.ts)[0];
    if (cmd && !S.executados.has(cmd.id)) {
      S.executados.add(cmd.id);
      if (cmd.tipo === "abrirLink" && /^https?:\/\//i.test(cmd.url || "") && agora() - cmd.ts < VALIDADE_CMD_MS && cmd.ts > S.entrou - 1000) {
        abrirConteudo(cmd.url, cmd.nome || "");
        fb(`aulas/${S.aula}/alunos/${S.dev}`, "PATCH", { ultimoCmd: { id: cmd.id, ts: { ".sv": "timestamp" } } }).catch(() => {});
      }
    }
    if (S.mao && S.volta % 2 === 0) { const m = await fb(`aulas/${S.aula}/alunos/${S.dev}/mao`).catch(() => 1); if (m === null) { S.mao = false; desenharMao(); aviso("👀 O professor viu sua mão!"); } }
  } catch (e) { /* rede: tenta de novo na próxima volta */ }
  finally { S.ocupado = false; }
}
function aoMudarVisibilidade() {
  if (!S.aula) return;
  S.fora = document.visibilityState === "hidden";
  presenca(S.fora).catch(() => {});
}

export async function entrarNaAulaMaestro({ codigo, nome, aluno }) {
  if (!/^\d{6}$/.test(String(codigo || ""))) return false;
  if (S.aula === codigo) return true;
  parar(false);
  Object.assign(S, { aula: codigo, nome: String(nome || "Aluno").slice(0, 60), aluno: /^[A-Za-z0-9_-]{1,64}$/.test(String(aluno || "")) ? aluno : "", dev: idAparelho(), volta: 0, executados: new Set(), mao: false });
  // ordens que já existiam antes de entrar não são repetidas
  try {
    const c = await fb(`aulas/${codigo}/controle`) || {};
    if (c.encerrada) { S.aula = ""; return false; }
    [c.comando, c.comandos && c.comandos[S.dev]].forEach(x => { if (x && x.id) S.executados.add(x.id); });
  } catch (e) { /* segue: o ciclo tenta de novo */ }
  S.entrou = agora();
  await presenca().catch(() => {});
  fb(`aulas/${codigo}/alunos/${S.dev}`, "PATCH", { entrouEm: { ".sv": "timestamp" } }).catch(() => {});
  botaoMao();
  document.addEventListener("visibilitychange", aoMudarVisibilidade);
  S.timer = setInterval(ciclo, INTERVALO_MS);
  return true;
}
export function sairDaAulaMaestro() { parar(false, true); }
function parar(encerrou, saiuDaConta) {
  clearInterval(S.timer); S.timer = null;
  document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  const aula = S.aula, dev = S.dev;
  if (aula && saiuDaConta) fb(`aulas/${aula}/alunos/${dev}`, "DELETE", undefined, true).catch(() => {});
  S.aula = ""; pausar(false); fecharConteudo(); S.comp = null;
  ["mqPesq", "mqPerg", "mqTempo"].forEach(i => { const f = document.getElementById(i); if (f) f.remove(); }); S.afAberta = S.pqAberta = "";
  const m = document.getElementById("mqMao"); if (m) m.remove();
  if (encerrou && aula) aviso("A aula terminou.");
}
export const emAulaMaestro = () => S.aula;

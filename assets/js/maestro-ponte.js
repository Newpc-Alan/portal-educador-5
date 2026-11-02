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
const S = { aula: "", nome: "", aluno: "", dev: "", timer: null, volta: 0, offset: 0, executados: new Set(), bloqueado: false, mao: false, fora: false, ocupado: false, aoSair: null, toast: null };

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
  S.aula = ""; pausar(false); fecharConteudo();
  const m = document.getElementById("mqMao"); if (m) m.remove();
  if (encerrou && aula) aviso("A aula terminou.");
}
export const emAulaMaestro = () => S.aula;

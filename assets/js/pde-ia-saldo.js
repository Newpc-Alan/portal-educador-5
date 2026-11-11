// Saldo de créditos de IA no topo de toda ferramenta que gasta crédito (nov/2026).
// Uso: import { montarSaldoIA, atualizarSaldoIA } from "/assets/js/pde-ia-saldo.js";
//      montarSaldoIA(app, document.getElementById("iaSaldoTopo"), { escuro:true });   // depois do login
//      atualizarSaldoIA();                                                             // depois de cada uso da IA
// Mesma conta da barra lateral do Portal (portalIa acao "cota") e o mesmo cache de 5 minutos (sessionStorage pde_ia_saldo).
// Verde: normal · amarelo: 20% ou menos · vermelho: acabou. O clique leva para a compra de créditos.
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const S = { app:null, el:null, opc:{} };
const nf = n => Number(n || 0).toLocaleString("pt-BR");

function estilo(){
  if(document.getElementById("pdeIaSaldoCss")) return;
  const st = document.createElement("style"); st.id = "pdeIaSaldoCss";
  st.textContent = `
.pde-iasaldo{display:inline-flex;flex-direction:column;justify-content:center;gap:3px;min-width:118px;padding:5px 11px;border-radius:999px;text-decoration:none;font:700 12px/1.1 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;
  background:#eef7f0;color:#1a6b2a;border:1.5px solid #9fd0aa;flex:none}
.pde-iasaldo b{font-size:13px}
.pde-iasaldo .pis-bar{display:block;height:3px;border-radius:3px;background:rgba(26,107,42,.18);overflow:hidden}
.pde-iasaldo .pis-bar i{display:block;height:100%;background:#1a6b2a;border-radius:3px}
.pde-iasaldo.baixo{background:#fff6e0;color:#8a5a00;border-color:#f0c66b}.pde-iasaldo.baixo .pis-bar i{background:#f29900}
.pde-iasaldo.zero{background:#fdecec;color:#b3261e;border-color:#f1a8a3;animation:pisPulsa 2.2s ease-out infinite}.pde-iasaldo.zero .pis-bar i{background:#d32f2f}
.pde-iasaldo.escuro{background:rgba(139,197,63,.14);color:#e9f6da;border-color:rgba(139,197,63,.55)}.pde-iasaldo.escuro .pis-bar{background:rgba(255,255,255,.15)}.pde-iasaldo.escuro .pis-bar i{background:#8BC53F}
.pde-iasaldo.escuro.baixo{background:rgba(255,152,0,.16);color:#ffd28a;border-color:rgba(255,152,0,.6)}.pde-iasaldo.escuro.baixo .pis-bar i{background:#ff9800}
.pde-iasaldo.escuro.zero{background:rgba(211,47,47,.2);color:#ffb4ae;border-color:rgba(239,83,80,.7)}.pde-iasaldo.escuro.zero .pis-bar i{background:#ef5350}
.pde-iasaldo:hover{filter:brightness(1.05)}
@keyframes pisPulsa{0%{box-shadow:0 0 0 0 rgba(211,47,47,.45)}70%{box-shadow:0 0 0 8px rgba(211,47,47,0)}100%{box-shadow:0 0 0 0 rgba(211,47,47,0)}}
@media (prefers-reduced-motion:reduce){.pde-iasaldo.zero{animation:none}}
@media (max-width:560px){.pde-iasaldo{min-width:0;padding:5px 9px}.pde-iasaldo .pis-l{display:none}}`;
  document.head.appendChild(st);
}

async function cota(forcar){
  const u = getAuth(S.app).currentUser; if(!u) return null;
  if(!forcar){ try{ const g = JSON.parse(sessionStorage.getItem("pde_ia_saldo") || "null"); if(g && g.uid === u.uid && Date.now() - g.em < 300000) return g.c; }catch(e){} }
  try{
    const c = (await httpsCallable(getFunctions(S.app, "southamerica-east1"), "portalIa", { timeout:20000 })({ acao:"cota" })).data;
    try{ sessionStorage.setItem("pde_ia_saldo", JSON.stringify({ uid:u.uid, em:Date.now(), c })); }catch(e){}
    return c;
  }catch(e){ console.warn("saldo IA:", e.code || e.message); return null; }
}

function pintar(c){
  const el = S.el; if(!el) return;
  if(!c){ el.hidden = true; return; }
  const escuro = S.opc.escuro ? " escuro" : "";
  if(c.admin){ el.className = "pde-iasaldo" + escuro; el.innerHTML = "<span>✨ IA <b>admin</b></span>"; el.title = "Conta de administrador: a IA não desconta créditos."; el.removeAttribute("href"); el.hidden = false; return; }
  const rede = c.rede, pessoal = (c.pessoal && c.pessoal.saldo) || 0;
  const disp = (rede ? rede.restante_mes : 0) + pessoal;
  const ref = Math.max(disp, (rede ? (rede.teto > 0 ? rede.teto : rede.saldo) : 0) + pessoal, 1), pct = Math.round(disp / ref * 100);
  const est = !c.pode_usar || disp <= 0 ? "zero" : pct <= 20 ? "baixo" : "";
  const det = [rede ? nf(rede.restante_mes) + " da rede" + (rede.teto > 0 ? " (limite de " + nf(rede.teto) + "/mês)" : "") : "", pessoal ? nf(pessoal) + " seus" : ""].filter(Boolean).join(" + ");
  el.className = "pde-iasaldo" + escuro + (est ? " " + est : "");
  el.href = "/apps/portal-ia/#comprar"; el.target = "_blank"; el.rel = "noopener";
  el.innerHTML = "<span>✨ <b>" + nf(disp) + "</b> <span class=\"pis-l\">" + (disp === 1 ? "crédito" : "créditos") + " de IA</span></span><span class=\"pis-bar\"><i style=\"width:" + Math.min(100, pct) + "%\"></i></span>";
  el.title = (est === "zero" ? (c.motivo || "Seus créditos de IA acabaram.") + " Toque para comprar." : est === "baixo" ? "Seus créditos de IA estão acabando. Toque para recarregar." : "Créditos de IA disponíveis" + (det ? ": " + det : "") + ". Toque para comprar mais.");
  el.hidden = false;
}

export async function montarSaldoIA(app, el, opc){
  if(!app || !el) return;
  estilo(); S.app = app; S.opc = opc || {};
  if(el.tagName !== "A"){ const a = document.createElement("a"); a.id = el.id; a.hidden = true; el.replaceWith(a); el = a; }
  S.el = el;
  if(S.opc.cota) pintarSaldoIA(S.opc.cota); else pintar(await cota(false));   // opc.cota: a tela já tem a cota em mãos
  if(!S.vis){ S.vis = true; document.addEventListener("visibilitychange", () => { if(!document.hidden && S.el) cota(false).then(pintar); }); }
}
// chame depois de cada uso da IA (o crédito acabou de mudar)
export async function atualizarSaldoIA(){ if(S.el) pintar(await cota(true)); }
// quando a própria resposta da IA já traz a cota nova (r.cota), pinta sem nova chamada
export function pintarSaldoIA(c){
  if(!c || !S.el) return;
  const u = S.app && getAuth(S.app).currentUser;
  if(u){ try{ sessionStorage.setItem("pde_ia_saldo", JSON.stringify({ uid:u.uid, em:Date.now(), c })); }catch(e){} }
  pintar(c);
}
window.PDEIaSaldo = { montar:montarSaldoIA, atualizar:atualizarSaldoIA, pintar:pintarSaldoIA };

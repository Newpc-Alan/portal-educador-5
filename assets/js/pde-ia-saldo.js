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
/* padrão único do selo de créditos de IA (igual ao de Provas e Avaliações) */
.pde-iasaldo{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:999px;background:rgba(141,198,63,.18);border:1px solid #8DC63F;color:#fff;font-weight:700;font-size:13px;line-height:1.2;text-decoration:none;white-space:nowrap;box-shadow:none;min-height:0;letter-spacing:0;font-family:inherit;flex:none}
.pde-iasaldo[hidden]{display:none}
.pde-iasaldo:hover{background:rgba(141,198,63,.32)}
.pde-iasaldo.claro{color:#1a6b2a}
.pde-iasaldo.baixo{border-color:#f2b632;color:#ffd36b}.pde-iasaldo.claro.baixo{color:#8a5a00}
.pde-iasaldo.zero{background:#C2362C;border-color:#C2362C;color:#fff;animation:pisPulsa 1.8s ease-in-out infinite}
@keyframes pisPulsa{50%{box-shadow:0 0 0 5px rgba(194,54,44,.25)}}
@media (prefers-reduced-motion:reduce){.pde-iasaldo.zero{animation:none}}`;
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
  const escuro = S.opc.escuro === false ? " claro" : "";
  if(c.admin){ el.className = "pde-iasaldo" + escuro; el.textContent = "✨ IA: uso livre"; el.title = "Conta de administrador: a IA não desconta créditos."; el.removeAttribute("href"); el.hidden = false; return; }
  const rede = c.rede, pessoal = (c.pessoal && c.pessoal.saldo) || 0;
  const disp = (rede ? rede.restante_mes : 0) + pessoal;
  const ref = Math.max(disp, (rede ? (rede.teto > 0 ? rede.teto : rede.saldo) : 0) + pessoal, 1), pct = Math.round(disp / ref * 100);
  const est = !c.pode_usar || disp <= 0 ? "zero" : pct <= 20 ? "baixo" : "";
  const det = [rede ? nf(rede.restante_mes) + " da rede" + (rede.teto > 0 ? " (limite de " + nf(rede.teto) + "/mês)" : "") : "", pessoal ? nf(pessoal) + " seus" : ""].filter(Boolean).join(" + ");
  el.className = "pde-iasaldo" + escuro + (est ? " " + est : "");
  el.href = "/apps/portal-ia/#comprar"; el.target = "_blank"; el.rel = "noopener";
  el.innerHTML = est === "zero" ? "✨ 0 créditos · <b>Comprar</b>" : "✨ <b>" + nf(disp) + "</b> " + (disp === 1 ? "crédito" : "créditos") + " IA";
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

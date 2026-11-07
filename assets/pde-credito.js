/* Portal do Educador · regra única (nov/2026): acabou o crédito de IA do professor, o Portal leva para abastecer.
   Vale para todo recurso de IA (Lousa, Portal IA, Provas, Pareceres, Quiz rápido). Não muda nada se o erro for outro
   (IA em manutenção, recurso fora do plano da licença, falha de internet).
   Uso: chamada.catch(e => { PDECredito.ver(e); ... })  ·  PDECredito.ver(e) devolve true quando era falta de crédito.
   A página de abastecer é a compra de créditos avulsos do Portal IA (/apps/portal-ia/#comprar). No próprio Portal IA,
   a página registra PDECredito.aoAbastecer para abrir a compra sem recarregar. */
(function () {
  if (window.PDECredito) return;
  const CAMINHO = "/apps/portal-ia/#comprar";
  function semCredito(e) {
    if (!e) return false;
    const cod = String(e.code || ""), d = e.details || {};
    if (d.semCredito) return true;
    return /resource-exhausted/.test(cod) && /cr[eé]dito/i.test(String(e.message || ""));
  }
  function destino() {
    // Lousa aberta fora do Portal (lousa.portaldoeducador...): a compra fica no www
    const base = /^lousa\./.test(location.hostname) ? "https://www.portaldoeducador.com.br" : "";
    return base + CAMINHO;
  }
  function ir() {
    if (typeof window.PDECredito.aoAbastecer === "function") { fechar(); window.PDECredito.aoAbastecer(); return; }
    const url = destino();
    // Lousa dentro do Portal (iframe): abre a compra na janela inteira, a aula já está salva
    try { if (window.top !== window.self) { window.top.location.href = url; return; } } catch (e) {}
    location.href = url;
  }
  let el = null;
  function fechar() { if (el) { el.remove(); el = null; } }
  function css() {
    if (document.getElementById("pdeCreditoCss")) return;
    const s = document.createElement("style"); s.id = "pdeCreditoCss";
    s.textContent = "#pdeCredito{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(7,22,33,.62);font-family:'Segoe UI',system-ui,sans-serif}" +
      "#pdeCredito .pc-caixa{background:#fff;color:#0f2c4a;border-radius:18px;max-width:440px;width:100%;padding:22px 22px 18px;box-shadow:0 30px 70px -20px rgba(0,0,0,.6);text-align:center}" +
      "#pdeCredito .pc-ico{font-size:44px;line-height:1}#pdeCredito h2{margin:8px 0 6px;font-size:20px}" +
      "#pdeCredito p{margin:0 0 6px;font-size:14.5px;line-height:1.45;color:#3c4b5a}#pdeCredito small{display:block;font-size:12.5px;color:#5b6b7b;margin-top:6px}" +
      "#pdeCredito .pc-bts{display:flex;flex-direction:column;gap:8px;margin-top:16px}" +
      "#pdeCredito button{border:0;border-radius:12px;padding:13px 16px;font:800 15px 'Segoe UI',system-ui,sans-serif;cursor:pointer}" +
      "#pdeCredito .pc-ir{background:#1a6b2a;color:#fff}#pdeCredito .pc-nao{background:#eef2f6;color:#0f2c4a;font-weight:700}";
    document.head.appendChild(s);
  }
  function abrir(msg) {
    css(); fechar();
    el = document.createElement("div"); el.id = "pdeCredito"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "pcTit");
    const t = String(msg || "").replace(/\s*Voc[eê] pode comprar cr[eé]ditos avulsos no Portal IA\.?/i, "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    el.innerHTML = '<div class="pc-caixa"><div class="pc-ico">🪙</div><h2 id="pcTit">Seus créditos de IA acabaram</h2>' +
      (t ? '<p>' + t + '</p>' : '') +
      '<p>Abasteça com créditos avulsos e continue de onde parou. O que você já criou continua salvo.</p>' +
      '<div class="pc-bts"><button type="button" class="pc-ir" data-pc="ir">💳 Abastecer créditos</button><button type="button" class="pc-nao" data-pc="nao">Agora não</button></div>' +
      '<small>Créditos avulsos valem 12 meses. Pagamento por Pix ou boleto.</small></div>';
    el.addEventListener("click", e => { const b = e.target.closest("[data-pc]"); if (e.target === el || (b && b.dataset.pc === "nao")) fechar(); else if (b && b.dataset.pc === "ir") ir(); });
    el.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
    document.body.appendChild(el);
    setTimeout(() => { const b = el && el.querySelector(".pc-ir"); if (b) b.focus(); }, 30);
  }
  function ver(e) { if (!semCredito(e)) return false; abrir(e.message); return true; }
  window.PDECredito = { ver, abrir, semCredito, destino, aoAbastecer: null };
})();

/* Portal do Educador · "Estou pensando": tela de espera enquanto a IA trabalha (Lousa, Portal IA).
   Uso: PDEPensando.abrir({ titulo, etapas:[...], tempo:"uns 20 segundos" })  ·  PDEPensando.fechar()
   O logo do Portal fica no centro, com as etapas trocando e o recado: a IA ajuda, quem conduz a aula é o professor. */
(function () {
  if (window.PDEPensando) return;
  // o recado é sempre o mesmo: a IA ajuda, quem domina a aula é o professor
  const RECADOS = ["Professor, a IA é a sua auxiliar. Quem domina a aula é você: revise, ajuste e coloque o seu jeito."];
  let el = null, relogio = null, inicio = 0;
  function css() {
    if (document.getElementById("pdePensandoCss")) return;
    const s = document.createElement("style"); s.id = "pdePensandoCss";
    s.textContent = `
#pdePensando{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;
  background:radial-gradient(circle at 50% 40%,rgba(26,107,42,.35),rgba(7,22,33,.92) 60%);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  font-family:Inter,"Segoe UI",system-ui,sans-serif;color:#fff;opacity:0;transition:opacity .25s}
#pdePensando.on{opacity:1}
#pdePensando .pp-caixa{display:grid;justify-items:center;gap:14px;text-align:center;max-width:560px}
#pdePensando .pp-logo{position:relative;width:150px;height:150px;display:grid;place-items:center}
#pdePensando .pp-logo img{width:118px;height:118px;border-radius:50%;box-shadow:0 10px 40px rgba(0,0,0,.45);animation:ppRespira 2.4s ease-in-out infinite}
#pdePensando .pp-logo::before,#pdePensando .pp-logo::after{content:"";position:absolute;inset:0;border-radius:50%;border:3px solid rgba(141,198,63,.55);animation:ppOnda 2.4s ease-out infinite}
#pdePensando .pp-logo::after{animation-delay:1.2s}
#pdePensando .pp-anel{position:absolute;inset:-6px;border-radius:50%;border:4px solid transparent;border-top-color:#8DC63F;border-right-color:#2E9BD6;animation:ppGira 1.4s linear infinite}
#pdePensando h2{margin:4px 0 0;font-size:28px;font-weight:800;letter-spacing:.2px}
#pdePensando h2 .pp-pts::after{content:"";animation:ppPts 1.5s steps(4,end) infinite}
#pdePensando .pp-etapa{font-size:17px;color:#d9f2bf;min-height:24px;transition:opacity .3s}
#pdePensando .pp-tempo{font-size:13.5px;color:#b8c7d6}
#pdePensando .pp-recado{margin-top:10px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-left:5px solid #8DC63F;border-radius:14px;padding:14px 18px;
  font-size:16.5px;line-height:1.45;color:#fff;max-width:520px}
#pdePensando .pp-recado b{color:#c9f08f}
@keyframes ppRespira{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes ppOnda{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.5);opacity:0}}
@keyframes ppGira{to{transform:rotate(360deg)}}
@keyframes ppPts{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
@media (prefers-reduced-motion:reduce){#pdePensando *,#pdePensando .pp-logo::before,#pdePensando .pp-logo::after{animation:none!important}}
@media (max-width:520px){#pdePensando h2{font-size:23px}#pdePensando .pp-recado{font-size:15px}}`;
    document.head.appendChild(s);
  }
  function abrir(o) {
    o = o || {}; css(); fechar(true);
    const etapas = (o.etapas && o.etapas.length ? o.etapas : ["Entendendo o seu pedido", "Organizando as ideias", "Escrevendo", "Conferindo tudo"]);
    const recado = RECADOS[Math.floor(Math.random() * RECADOS.length)];
    el = document.createElement("div"); el.id = "pdePensando"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = '<div class="pp-caixa"><div class="pp-logo"><span class="pp-anel"></span><img src="/assets/pde-logo-256.png" alt="Portal do Educador"></div>' +
      '<h2>' + (o.titulo || "Estou pensando") + '<span class="pp-pts"></span></h2><div class="pp-etapa"></div>' +
      (o.tempo ? '<div class="pp-tempo">Isso leva ' + o.tempo + '.</div>' : '') +
      '<div class="pp-recado">💡 ' + recado.replace(/^Professor,/, "<b>Professor,</b>") + '</div></div>';
    document.body.appendChild(el); requestAnimationFrame(() => el && el.classList.add("on"));
    let i = 0; const et = el.querySelector(".pp-etapa"); et.textContent = etapas[0] + "...";
    inicio = Date.now();
    relogio = setInterval(() => { if (!el) return; i = Math.min(i + 1, etapas.length - 1); et.style.opacity = 0; setTimeout(() => { if (el) { et.textContent = etapas[i] + "..."; et.style.opacity = 1; } }, 250); }, o.passoMs || 4500);
  }
  function fechar(na) {
    clearInterval(relogio); relogio = null;
    const v = el || document.getElementById("pdePensando"); el = null; if (!v) return;
    if (na) { v.remove(); return; }
    v.classList.remove("on"); setTimeout(() => v.remove(), 260);
  }
  window.PDEPensando = { abrir, fechar };
})();

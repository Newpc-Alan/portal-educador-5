/* Portal do Educador · "A IA errou aqui" (nov/2026)
   Diretrizes CNE/MEC de IA na educação: a instituição acompanha erros e vieses da IA. Em cada recurso com IA, o professor aponta o problema
   em dois toques; vai para ia_feedback (pela função iaFeedback) e a equipe NEWPC vê no administrador.
   Uso: PDEIaErrou.botao("portal_ia", "id-do-material") devolve o HTML do botão. Os cliques são escutados por delegação (data-ia-errou), sem onclick.
   Nunca peça nome de aluno: o texto livre avisa isso e a função apaga números de CPF. */
(function () {
  if (window.PDEIaErrou) return;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TIPOS = [["conteudo", "Conteúdo errado ou inventado"], ["turma", "Não serve para a série ou a turma"], ["vies", "Preconceito, estereótipo ou viés"], ["outro", "Outro problema"]];
  function botao(recurso, ref, rotulo) {
    return '<button type="button" class="pde-ia-errou" data-ia-errou="' + esc(recurso) + '" data-ia-ref="' + esc(ref || "") + '" ' +
      'style="font:inherit;font-size:.82rem;font-weight:700;background:#fff;color:#9b1c1c;border:1.5px solid #f1b5b5;border-radius:999px;padding:6px 12px;cursor:pointer">' +
      esc(rotulo || "⚠️ A IA errou aqui") + "</button>";
  }
  let caixa = null;
  function abrir(recurso, ref) {
    fechar();
    caixa = document.createElement("div");
    caixa.setAttribute("role", "dialog"); caixa.setAttribute("aria-modal", "true"); caixa.setAttribute("aria-labelledby", "pdeIaTit");
    caixa.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(7,22,33,.55);display:grid;place-items:center;padding:16px;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
    caixa.innerHTML = '<div style="background:#fff;color:#0f2c4a;border-radius:16px;max-width:460px;width:100%;padding:20px 22px;box-shadow:0 20px 50px -12px rgba(0,0,0,.45);text-align:left">' +
      '<h3 id="pdeIaTit" style="margin:0 0 6px;font-size:1.15rem">⚠️ A IA errou aqui</h3>' +
      '<p style="margin:0 0 10px;color:#4b5b6b;font-size:.9rem">Seu aviso ajuda a NEWPC a acompanhar erros e vieses da IA, como pedem as diretrizes do CNE/MEC.</p>' +
      TIPOS.map((t, i) => '<label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.95rem;cursor:pointer"><input type="radio" name="pdeIaTipo" value="' + t[0] + '"' + (i ? "" : " checked") + '> ' + t[1] + "</label>").join("") +
      '<label for="pdeIaTxt" style="display:block;margin:10px 0 4px;font-size:.85rem;font-weight:700">O que estava errado (opcional)</label>' +
      '<textarea id="pdeIaTxt" rows="3" maxlength="500" placeholder="Ex.: a questão 4 tem duas respostas certas. Não escreva nome de aluno." style="width:100%;box-sizing:border-box;border:1px solid #cfd8e3;border-radius:10px;padding:8px;font:inherit"></textarea>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button type="button" data-ia-acao="fechar" style="font:inherit;font-weight:700;border:1.5px solid #0f2c4a;background:#fff;color:#0f2c4a;border-radius:999px;padding:9px 16px;cursor:pointer">Cancelar</button>' +
      '<button type="button" data-ia-acao="enviar" style="font:inherit;font-weight:800;border:0;background:#1a6b2a;color:#fff;border-radius:999px;padding:9px 18px;cursor:pointer">Enviar</button></div></div>';
    caixa.dataset.recurso = recurso; caixa.dataset.ref = ref || "";
    document.body.appendChild(caixa);
    caixa.addEventListener("click", e => { if (e.target === caixa) fechar(); });
    caixa.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
    const r = caixa.querySelector("input"); if (r) r.focus();
  }
  function fechar() { if (caixa) { caixa.remove(); caixa = null; } }
  async function enviar(btn) {
    const tipo = (caixa.querySelector('input[name="pdeIaTipo"]:checked') || {}).value || "outro", texto = caixa.querySelector("#pdeIaTxt").value.trim();
    btn.disabled = true; btn.textContent = "Enviando...";
    try {
      const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
      await httpsCallable(getFunctions(getApp(), "southamerica-east1"), "iaFeedback")({ recurso: caixa.dataset.recurso, ref: caixa.dataset.ref, tipo, texto, pagina: location.pathname });
      caixa.querySelector("div").innerHTML = '<h3 style="margin:0 0 6px">Obrigado! 🙏</h3><p style="margin:0 0 12px;color:#4b5b6b">Seu aviso chegou à equipe NEWPC. Lembre: o que a IA produz só vale depois da sua revisão.</p><div style="text-align:right"><button type="button" data-ia-acao="fechar" style="font:inherit;font-weight:800;border:0;background:#1a6b2a;color:#fff;border-radius:999px;padding:9px 18px;cursor:pointer">Fechar</button></div>';
    } catch (e) {
      btn.disabled = false; btn.textContent = "Enviar";
      let m = caixa.querySelector(".pde-ia-msg"); if (!m) { m = document.createElement("p"); m.className = "pde-ia-msg"; m.style.cssText = "color:#9b1c1c;font-size:.85rem;margin:8px 0 0"; btn.parentNode.before(m); }
      m.textContent = (e && e.message) || "Não foi possível enviar agora.";
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-ia-errou],[data-ia-acao]"); if (!b) return;
    if (b.hasAttribute("data-ia-errou")) { e.preventDefault(); abrir(b.getAttribute("data-ia-errou"), b.getAttribute("data-ia-ref")); return; }
    if (b.getAttribute("data-ia-acao") === "fechar") fechar(); else if (b.getAttribute("data-ia-acao") === "enviar") enviar(b);
  });
  window.PDEIaErrou = { botao, abrir };
})();

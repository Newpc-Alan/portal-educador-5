/* Portal do Educador · Lara dentro do Portal (nov/2026).
   Botão flutuante da Lara (assistente virtual no WhatsApp) para quem já entrou no Portal. Na primeira tela depois de entrar,
   ela cumprimenta pelo nome e pela função ("Olá, Julio! · Professor(a) · Escola X") uma vez por sessão.
   Uso: PDELara.mostrar({ nome, cargo, escola }). PDELara.esconder() tira da tela. Aluno não recebe a Lara (a Lara não atende aluno).
   Sem onclick no HTML: os cliques são escutados por delegação (data-lara). */
(function () {
  if (window.PDELara) return;
  const NUMERO = "556798757275";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = `.pl-lara{position:fixed;right:20px;bottom:20px;z-index:65;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:inherit}
body:has(#lsFab) .pl-lara{bottom:100px}   /* o botão da Lousa fica no canto: a Lara sobe */
.pl-bt{position:relative;display:block;width:60px;height:60px;border-radius:50%;padding:3px;background:linear-gradient(135deg,#8DC63F,#25D366);box-shadow:0 10px 24px -8px rgba(7,22,33,.55);transition:transform .2s}
.pl-bt:hover,.pl-bt:focus-visible{transform:translateY(-2px) scale(1.04)}
.pl-bt img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid #fff;box-sizing:border-box}
.pl-wa{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:#25D366;border:2px solid #fff;display:grid;place-items:center}
.pl-balao{position:relative;max-width:270px;background:#fff;color:#0f2c4a;border-radius:16px 16px 4px 16px;padding:12px 34px 12px 14px;box-shadow:0 14px 34px -10px rgba(7,22,33,.45);animation:plEntra .35s ease-out;line-height:1.35}
.pl-balao[hidden]{display:none}
.pl-balao a{display:block;color:inherit;text-decoration:none}
.pl-balao b{display:block;font-size:15.5px}
.pl-balao .pl-cargo{display:block;font-size:12px;font-weight:700;color:#1a6b2a;margin-top:2px}
.pl-balao .pl-txt{display:block;font-size:14px;margin-top:6px}
.pl-balao small{display:block;font-size:11.5px;color:#5b6b7b;margin-top:6px}
.pl-x{position:absolute;top:6px;right:6px;width:26px;height:26px;border:0;border-radius:50%;background:#eef2f6;color:#0f2c4a;cursor:pointer;font-size:12px;line-height:1}
@keyframes plEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:600px){.pl-lara{right:14px;bottom:14px}body:has(#lsFab) .pl-lara{bottom:92px}.pl-bt{width:52px;height:52px}.pl-balao{max-width:220px}}
@media print{.pl-lara{display:none}}
@media (prefers-reduced-motion:reduce){.pl-bt,.pl-balao{transition:none;animation:none}}`;
  let el = null;
  function link(msg) { return "https://wa.me/" + NUMERO + "?text=" + encodeURIComponent(msg); }
  const ROTULO = { admin: "Administrador", secretaria: "Secretaria de Educação", gestor: "Gestão da escola", professor: "Professor(a)", secretaria_escolar: "Secretaria escolar", portaria: "Portaria" };
  function mostrar(o) {
    o = o || {};
    if (o.perfil === "aluno") return esconder();
    if (!document.getElementById("plCss")) { const s = document.createElement("style"); s.id = "plCss"; s.textContent = css; document.head.appendChild(s); }
    const nome = String(o.nome || "").trim().split(/\s+/)[0] || "";
    const cargo = String(o.cargo || ROTULO[o.perfil] || "").trim(), escola = String(o.escola || "").trim();
    const msg = "Olá, Lara! Sou " + (o.nome || "do Portal") + (cargo ? " (" + cargo + (escola ? ", " + escola : "") + ")" : "") + ". Estou no Portal do Educador e tenho uma dúvida.";
    if (!el) { el = document.createElement("div"); el.className = "pl-lara"; el.id = "plLara"; document.body.appendChild(el); el.addEventListener("click", clique); }
    el.innerHTML = '<div class="pl-balao" id="plBalao" role="status" hidden><button type="button" class="pl-x" data-lara="fechar" aria-label="Fechar mensagem da Lara">✕</button>' +
      '<a href="' + esc(link(msg)) + '" target="_blank" rel="noopener"><b>Olá' + (nome ? ", " + esc(nome) : "") + '! 👋</b>' +
      (cargo ? '<span class="pl-cargo">' + esc(cargo) + (escola ? " · " + esc(escola) : "") + '</span>' : "") +
      '<span class="pl-txt">A Lara está aqui. Em caso de dúvidas, é só chamar.</span><small>Assistente virtual · WhatsApp (67) 9875-7275</small></a></div>' +
      '<a class="pl-bt" href="' + esc(link(msg)) + '" target="_blank" rel="noopener" aria-label="Falar com a Lara, assistente virtual, pelo WhatsApp" title="Lara · assistente virtual">' +
      '<img src="/assets/lara-192.jpg" alt="" width="60" height="60"><span class="pl-wa"><svg viewBox="0 0 32 32" width="13" height="13" aria-hidden="true"><path d="M16 3.5C9.1 3.5 3.5 9 3.5 15.8c0 2.4.7 4.6 1.9 6.5L3.6 28.4l6.3-1.7c1.8 1 3.9 1.6 6.1 1.6 6.9 0 12.5-5.5 12.5-12.3S22.9 3.5 16 3.5z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></span></a>';
    // o cumprimento aparece uma vez por sessão, logo depois de entrar; no celular some sozinho para não cobrir a tela
    let visto = false; try { visto = sessionStorage.getItem("pde_lara_ola") === "1"; } catch (e) {}
    if (visto) return;
    setTimeout(() => {
      const b = document.getElementById("plBalao"); if (!b) return;
      b.hidden = false; try { sessionStorage.setItem("pde_lara_ola", "1"); } catch (e) {}
      setTimeout(() => { if (b.isConnected) b.hidden = true; }, window.matchMedia("(max-width:600px)").matches ? 8000 : 15000);
    }, 1500);
  }
  function clique(e) {
    const b = e.target.closest("[data-lara]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.lara === "fechar") { const x = document.getElementById("plBalao"); if (x) x.hidden = true; }
  }
  function esconder() { if (el) { el.remove(); el = null; } }
  window.PDELara = { mostrar, esconder };
})();

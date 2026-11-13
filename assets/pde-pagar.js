/* Portal do Educador · pagamento pelo Asaas (nov/2026).
   Uma janela só para comprar a licença avulsa ou créditos de IA: o professor escolhe o item, informa o CPF na primeira compra
   e vai para a página de pagamento do Asaas (Pix, boleto ou cartão). Quando o pagamento é confirmado, o Portal libera sozinho.
   Uso na página: PDEPagar.configurar(httpsCallable(funcoes, "pagamentos")); depois PDEPagar.abrir("licenca" | "credito" | "tudo"),
   ou um botão/link com data-pagar="licenca" (ou "credito") que a própria biblioteca escuta. Sem onclick no HTML. */
(function () {
  if (window.PDEPagar) return;
  let chamar = null, dados = null, filtro = "tudo";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const css = `.pp-fundo{position:fixed;inset:0;background:rgba(7,22,33,.62);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}
.pp-caixa{background:#fff;color:#0f2c4a;border-radius:18px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:22px;font-family:inherit;box-shadow:0 30px 60px -20px rgba(0,0,0,.5)}
.pp-caixa h2{font-size:1.3rem;margin:0 0 4px}.pp-sub{color:#4a5568;font-size:.92rem;margin:0 0 14px}
.pp-op{display:flex;gap:12px;align-items:center;border:1.5px solid #dce4ed;border-radius:12px;padding:12px 14px;margin:0 0 8px;cursor:pointer}
.pp-op:has(input:checked){border-color:#1a6b2a;background:#f1f8ec}.pp-op input{width:20px;height:20px;accent-color:#1a6b2a}
.pp-op b{display:block}.pp-op small{color:#4a5568}.pp-op .pp-v{margin-left:auto;font-weight:800;white-space:nowrap}
.pp-tit{font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#2671AB;margin:14px 0 8px}
.pp-cpf{display:flex;flex-direction:column;gap:4px;margin:14px 0 0;font-weight:700;font-size:.9rem}
.pp-cpf input{border:1.5px solid #cfdbe7;border-radius:10px;padding:11px 12px;font-size:1rem;min-height:44px}
.pp-nota{font-size:.82rem;color:#4a5568;margin:12px 0 0}.pp-msg{margin:10px 0 0;font-size:.9rem;color:#9a3412}
.pp-acoes{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px}
.pp-bt{border:1px solid #cfdbe7;background:#fff;border-radius:10px;padding:10px 16px;font-weight:800;min-height:44px;cursor:pointer;font-size:.95rem;color:#0f2c4a}
.pp-bt.pri{background:#1a6b2a;border-color:#1a6b2a;color:#fff}.pp-bt:disabled{opacity:.6;cursor:wait}
.pp-ped{display:flex;gap:8px;align-items:center;justify-content:space-between;border-top:1px solid #e3e9ef;padding:8px 0;font-size:.88rem}
.pp-ped a{color:#1a6b2a;font-weight:800}
.pp-eco{display:inline-block;background:#8DC63F;color:#0b1d33;font-size:.72rem;font-weight:800;border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:1px}
.pp-op .pp-v small{display:block;font-weight:600;text-align:right}
.pp-forma{display:none;gap:8px;flex-wrap:wrap;margin:2px 0 8px 32px}.pp-forma.on{display:flex}
.pp-forma label{display:flex;gap:6px;align-items:center;border:1.5px solid #dce4ed;border-radius:999px;padding:7px 12px;font-size:.88rem;font-weight:700;cursor:pointer}
.pp-forma label:has(input:checked){border-color:#1a6b2a;background:#f1f8ec}.pp-forma input{accent-color:#1a6b2a}`;
  function fechar() { const f = document.getElementById("ppFundo"); if (f) f.remove(); }
  function cpfMascara(v) { const d = String(v).replace(/\D/g, "").slice(0, 11); return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }
  function desenhar(msg) {
    const L = filtro === "credito" ? [] : (dados.licencas || []).slice().sort((a, b) => (a.plano === b.plano ? (b.meses || 1) - (a.meses || 1) : 0)), C = filtro === "licenca" ? [] : dados.creditos;
    const op = (it, desc, i) => {
      const anual = (it.meses || 1) >= 12, eco = anual && it.mensal ? Math.round((1 - it.valor / (it.mensal * it.meses)) * 100) : 0;
      return '<label class="pp-op"><input type="radio" name="ppItem" value="' + esc(it.id) + '" data-parc="' + (it.parcelas || 1) + '"' + (i === 0 ? " checked" : "") + '><span><b>' + esc(it.nome) + (eco > 0 ? '<span class="pp-eco">-' + eco + '%</span>' : '') + '</b><small>' + esc(desc) + '</small></span><span class="pp-v">' + brl(it.valor) + (anual ? '<small>= ' + brl(it.valor / it.meses) + '/mês</small>' : '') + '</span></label>' +
        ((it.parcelas || 1) > 1 ? '<div class="pp-forma" data-forma="' + esc(it.id) + '"><label><input type="radio" name="ppForma_' + esc(it.id) + '" value="vista" checked>À vista: Pix, boleto ou cartão</label><label><input type="radio" name="ppForma_' + esc(it.id) + '" value="parc">' + it.parcelas + 'x de ' + brl(it.valor / it.parcelas) + ' no cartão</label></div>' : '');
    };
    let i = 0;
    const pend = (dados.pedidos || []).filter(p => p.status === "aguardando" && p.link);
    const h = '<div class="pp-caixa" role="dialog" aria-modal="true" aria-labelledby="ppTit"><h2 id="ppTit">' + (filtro === "credito" ? "Comprar créditos de IA" : filtro === "licenca" ? "Assinar o Portal do Educador" : "Comprar") + '</h2>' +
      '<p class="pp-sub">Pagamento seguro pelo Asaas, por Pix, boleto ou cartão de crédito. Assim que o pagamento é confirmado, o Portal libera sozinho.</p>' +
      (L.length ? '<div class="pp-tit">Licença</div>' + L.map(l => op(l, (l.plano === "completo" ? "Tudo do Portal: Portal IA com imagens, Formação Continuada e Portal 360º VR · 120 créditos de IA por mês" : "Portal IA em texto (plano de aula, atividade, prova e parecer) · 60 créditos de IA por mês") + ((l.meses || 1) >= 12 ? " · 12 meses" : ""), i++)).join("") : "") +
      (C.length ? '<div class="pp-tit">Créditos de IA (valem 12 meses)</div>' + C.map(c => op(c, Number(c.creditos).toLocaleString("pt-BR") + " créditos para o Portal IA, a Lousa e as Provas", i++)).join("") : "") +
      (!L.length && !C.length ? '<p class="pp-msg">Nada disponível para compra na sua conta agora.</p>' : "") +
      (dados.temCpf ? '<p class="pp-nota">Cobrança no CPF ' + esc(dados.cpf) + '.</p>' : '<label class="pp-cpf">CPF de quem paga<input id="ppCpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14"></label><p class="pp-nota">O CPF é pedido pelo sistema de pagamento e vai só para ele.</p>') +
      (msg ? '<p class="pp-msg">' + esc(msg) + '</p>' : "") +
      (pend.length ? '<div class="pp-tit">Aguardando pagamento</div>' + pend.map(p => '<div class="pp-ped"><span>' + esc(p.item) + ' · ' + brl(p.valor) + '</span><a href="' + esc(p.link) + '" target="_blank" rel="noopener">Pagar</a></div>').join("") : "") +
      '<div class="pp-acoes"><button type="button" class="pp-bt" data-pp="fechar">Fechar</button>' + (L.length || C.length ? '<button type="button" class="pp-bt pri" data-pp="pagar">Ir para o pagamento</button>' : "") + '</div></div>';
    let f = document.getElementById("ppFundo");
    if (!f) { f = document.createElement("div"); f.id = "ppFundo"; f.className = "pp-fundo"; document.body.appendChild(f); f.addEventListener("click", clique); f.addEventListener("change", e => { if (e.target.name === "ppItem") mostrarForma(); }); f.addEventListener("input", e => { if (e.target.id === "ppCpf") e.target.value = cpfMascara(e.target.value); }); }
    f.innerHTML = h;
    mostrarForma();
  }
  // a escolha "à vista ou 12x no cartão" aparece só embaixo do plano de 12 meses marcado
  function mostrarForma() {
    const it = document.querySelector('input[name="ppItem"]:checked');
    document.querySelectorAll("#ppFundo .pp-forma").forEach(x => x.classList.toggle("on", !!it && x.dataset.forma === it.value));
  }
  async function clique(e) {
    if (e.target.id === "ppFundo") return fechar();
    const b = e.target.closest("[data-pp]"); if (!b) return;
    if (b.dataset.pp === "fechar") return fechar();
    if (b.dataset.pp === "pagar") {
      const it = document.querySelector('input[name="ppItem"]:checked'); if (!it) return;
      const cpf = document.getElementById("ppCpf");
      if (cpf && String(cpf.value).replace(/\D/g, "").length !== 11) return desenhar("Informe o CPF com 11 números.");
      const fp = document.querySelector('input[name="ppForma_' + it.value + '"]:checked'), parcelado = !!(fp && fp.value === "parc");
      const janela = window.open("", "_blank");   // abre já no clique (o navegador não bloqueia)
      b.disabled = true; b.textContent = "Gerando a cobrança...";
      try {
        const r = (await chamar({ acao: "criar", produto: it.value, parcelado, cpf: cpf ? cpf.value : "" })).data;
        if (janela) janela.location = r.link; else location.href = r.link;
        dados = (await chamar({ acao: "opcoes" })).data;
        desenhar("");
        const f = document.querySelector("#ppFundo .pp-sub"); if (f) f.innerHTML = "<b>A página de pagamento abriu em outra aba.</b> Depois de pagar, o Portal libera sozinho. Se fechar a aba sem pagar, use o botão Pagar abaixo.";
      } catch (er) { if (janela) janela.close(); b.disabled = false; b.textContent = "Ir para o pagamento"; desenhar(er.message || "Não deu certo agora. Tente de novo."); }
    }
  }
  async function abrir(qual) {
    if (!chamar) { alert("Pagamento indisponível nesta página."); return; }
    filtro = qual || "tudo";
    if (!document.getElementById("ppCss")) { const s = document.createElement("style"); s.id = "ppCss"; s.textContent = css; document.head.appendChild(s); }
    try { dados = (await chamar({ acao: "opcoes" })).data; desenhar(""); }
    catch (e) { dados = { licencas: [], creditos: [], pedidos: [] }; desenhar(e.message || "Não consegui abrir o pagamento agora."); }
  }
  document.addEventListener("click", e => { const a = e.target.closest("[data-pagar]"); if (!a || !chamar) return; e.preventDefault(); abrir(a.dataset.pagar); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
  window.PDEPagar = { configurar(fn) { chamar = fn; }, abrir, fechar };
})();

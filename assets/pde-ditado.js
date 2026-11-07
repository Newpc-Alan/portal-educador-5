/* Portal do Educador · voz que vira texto (nov/2026), sem IA e sem token.
   Usa o reconhecimento de voz do próprio navegador (Chrome, Edge, Chromebook). O Portal não grava áudio:
   no Chrome a voz vai para o serviço de voz do Google só para virar texto, e o microfone só liga quando o professor toca no botão.

   1) Microfone nos campos: ao tocar num campo de texto (ou caixa de texto), aparece um 🎤 dentro dele; o professor fala e o texto entra no campo.
      Fica de fora: senha, e-mail, número, data, telefone, campos pequenos e quem tiver data-sem-ditado.
   2) window.PDEVoz: o mesmo motor para a Lousa (Ditado no quadro e celular como microfone):
      PDEVoz.suportado · PDEVoz.ouvir({ aoParcial, aoFinal, aoFim, aoErro, continuo }) -> { parar() } · PDEVoz.aplicar(textoAtual, frase) -> { texto, comando } */
(function () {
  if (window.PDEVoz) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const suportado = !!SR;

  /* ---------- comandos de voz: pontuação e edição simples ---------- */
  const PONT = [
    [/\s*\b(ponto de interroga[cç][aã]o|interroga[cç][aã]o)\b/gi, "?"],
    [/\s*\b(ponto de exclama[cç][aã]o|exclama[cç][aã]o)\b/gi, "!"],
    [/\s*\b(ponto e v[ií]rgula)\b/gi, ";"],
    [/\s*\b(dois pontos)\b/gi, ":"],
    [/\s*\bponto final\b/gi, "."],
    [/\s*\bponto\s*$/i, "."],   // "ponto" sozinho só no fim da fala ("o ponto de ônibus" fica como está)
    [/\s*\b(v[ií]rgula)\b/gi, ","],
    [/\s*\b(novo par[aá]grafo)\b\s*/gi, "\n\n"],
    [/\s*\b(nova linha|pr[oó]xima linha)\b\s*/gi, "\n"]
  ];
  const fimDeFrase = t => !t.trim() || /[.!?]\s*$/.test(t) || /\n\s*$/.test(t);
  const maiuscula = t => t.replace(/^(\s*)(\p{L})/u, (m, a, b) => a + b.toUpperCase());
  // aplica uma frase reconhecida ao texto atual: devolve o texto novo, ou um comando (parar, pausar, apagar)
  function aplicar(atual, frase) {
    atual = String(atual || ""); let f = String(frase || "").trim();
    if (!f) return { texto: atual };
    const fn = f.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/^(parar|terminar|encerrar) (o )?ditado$/.test(fn)) return { texto: atual, comando: "parar" };
    if (/^pausar (o )?ditado$/.test(fn)) return { texto: atual, comando: "pausar" };
    if (/^apagar (a )?ultima frase$/.test(fn)) {
      const t = atual.replace(/\s+$/, ""), corte = t.replace(/[^.!?\n]*[.!?]?$/, "");
      return { texto: corte.replace(/\s+$/, "") + (corte.trim() ? " " : ""), comando: "apagou" };
    }
    if (/^apagar (a )?ultima palavra$/.test(fn)) return { texto: atual.replace(/\s*\S+\s*$/, " ").replace(/^\s+$/, ""), comando: "apagou" };
    PONT.forEach(([re, s]) => { f = f.replace(re, s); });
    f = f.replace(/\s+([,.;:!?])/g, "$1").replace(/([,.;:!?])(?=\p{L})/gu, "$1 ");
    // depois de ponto, de ponto de interrogação ou de linha nova, a próxima frase começa com maiúscula
    f = f.split(/(?<=[.!?\n])\s*/).map((p, i) => (i === 0 && !fimDeFrase(atual)) ? p : maiuscula(p)).join(" ").replace(/\n /g, "\n");
    const junta = !atual || /[\s\n]$/.test(atual) || /^[,.;:!?\n]/.test(f) ? "" : " ";
    return { texto: atual + junta + f };
  }

  /* ---------- ouvir: reconhecimento contínuo, reinicia sozinho quando o navegador corta no silêncio ---------- */
  function ouvir(o) {
    o = o || {};
    if (!suportado) { o.aoErro && o.aoErro("sem-suporte"); return { parar() {} }; }
    let r = null, ativo = true;
    const iniciar = () => {
      r = new SR(); r.lang = "pt-BR"; r.continuous = o.continuo !== false; r.interimResults = true;
      r.onresult = e => {
        let parcial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) o.aoFinal && o.aoFinal(t); else parcial += t;
        }
        o.aoParcial && o.aoParcial(parcial);
      };
      r.onerror = e => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { ativo = false; o.aoErro && o.aoErro("bloqueado"); }
        else if (e.error === "audio-capture") { ativo = false; o.aoErro && o.aoErro("sem-microfone"); }
      };
      r.onend = () => { if (ativo && o.continuo !== false) { try { iniciar(); } catch (e) { ativo = false; o.aoFim && o.aoFim(); } } else o.aoFim && o.aoFim(); };
      try { r.start(); } catch (e) {}
    };
    iniciar();
    return { parar() { ativo = false; try { r && r.stop(); } catch (e) {} } };
  }

  window.PDEVoz = { suportado, ouvir, aplicar };
  if (!suportado) return;

  /* ---------- 🎤 nos campos de digitar ---------- */
  const TIPOS_OK = ["text", "search", ""];
  const FORA = /senha|password|e-?mail|cpf|cnpj|cep|telefone|celular|whats|codigo|c[oó]digo|token|chave|login|usuario|matr[ií]cula/i;
  function serve(el) {
    if (!el || el.disabled || el.readOnly || el.closest("[data-sem-ditado]")) return false;
    if (el.isContentEditable) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") { if (el.getAttribute("data-fabric") || /hiddentextarea/i.test(el.className || "")) return false; }
    else if (tag === "INPUT") {
      if (!TIPOS_OK.includes((el.getAttribute("type") || "").toLowerCase())) return false;
      const im = (el.getAttribute("inputmode") || "").toLowerCase(); if (["numeric", "decimal", "tel", "email"].includes(im)) return false;
      if (FORA.test([el.id, el.name, el.placeholder, el.getAttribute("autocomplete"), el.getAttribute("aria-label")].join(" "))) return false;
    } else return false;
    const b = el.getBoundingClientRect();
    return b.width >= 140 && b.height >= 18;
  }
  let btn = null, alvo = null, escuta = null, base = "", aviso = null;
  function css() {
    if (document.getElementById("pdeMicCss")) return;
    const s = document.createElement("style"); s.id = "pdeMicCss";
    s.textContent = "#pdeMic{position:fixed;z-index:2147482000;width:34px;height:34px;border-radius:50%;border:0;display:none;align-items:center;justify-content:center;cursor:pointer;" +
      "background:#1a6b2a;color:#fff;font-size:17px;box-shadow:0 3px 10px rgba(0,0,0,.25);padding:0;line-height:1}" +
      "#pdeMic.on{display:flex}#pdeMic.ouvindo{background:#d92b2b;animation:pdeMicPulsa 1.1s infinite}" +
      "@keyframes pdeMicPulsa{0%{box-shadow:0 0 0 0 rgba(217,43,43,.55)}100%{box-shadow:0 0 0 12px rgba(217,43,43,0)}}" +
      "#pdeMicAviso{position:fixed;z-index:2147482000;max-width:280px;background:#0f2c4a;color:#fff;font:600 12.5px/1.35 'Segoe UI',system-ui,sans-serif;padding:7px 10px;border-radius:9px;box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:none}";
    document.head.appendChild(s);
  }
  function posicionar() {
    if (!btn || !alvo) return;
    const b = alvo.getBoundingClientRect(), tam = Math.min(34, Math.max(26, b.height - 8));
    btn.style.width = btn.style.height = tam + "px"; btn.style.fontSize = Math.round(tam * .5) + "px";
    const topo = alvo.tagName === "TEXTAREA" ? b.top + 6 : b.top + (b.height - tam) / 2;
    btn.style.left = Math.round(b.right - tam - 6) + "px"; btn.style.top = Math.round(topo) + "px";
    if (aviso) { aviso.style.left = Math.max(8, Math.round(b.right - 280)) + "px"; aviso.style.top = Math.round(b.bottom + 6) + "px"; }
  }
  function mostrarAviso(t) {
    if (!aviso) { aviso = document.createElement("div"); aviso.id = "pdeMicAviso"; aviso.setAttribute("role", "status"); document.body.appendChild(aviso); }
    aviso.textContent = t; posicionar();
  }
  function tirarAviso() { if (aviso) { aviso.remove(); aviso = null; } }
  function escrever(el, texto) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, "value").set; set.call(el, texto.slice(0, el.maxLength > 0 ? el.maxLength : undefined));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function parar() {
    if (escuta) { escuta.parar(); escuta = null; }
    if (btn) { btn.classList.remove("ouvindo"); btn.title = "Falar em vez de digitar"; btn.setAttribute("aria-label", btn.title); }
    tirarAviso();
    if (alvo) alvo.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function comecar() {
    if (!alvo) return;
    const el = alvo; base = el.value || "";
    btn.classList.add("ouvindo"); btn.title = "Parar de ouvir"; btn.setAttribute("aria-label", btn.title);
    mostrarAviso("🎤 Ouvindo… fale e toque de novo para parar. O Portal não grava áudio.");
    let atual = base;
    escuta = PDEVoz.ouvir({
      aoParcial: p => { if (p) escrever(el, (atual + (atual && !/\s$/.test(atual) ? " " : "") + p)); },
      aoFinal: f => {
        const r = aplicar(atual, el.tagName === "INPUT" ? f.replace(/\b(nova linha|novo par[aá]grafo|pr[oó]xima linha)\b/gi, "") : f);
        if (r.comando === "parar" || r.comando === "pausar") { escrever(el, atual); parar(); return; }
        atual = el.tagName === "INPUT" ? r.texto.replace(/\n+/g, " ") : r.texto; escrever(el, atual);
      },
      aoErro: e => { mostrarAviso(e === "bloqueado" ? "Libere o microfone para este site (cadeado ao lado do endereço)." : e === "sem-microfone" ? "Não encontrei um microfone neste aparelho." : "Este navegador não reconhece voz."); setTimeout(parar, 3500); },
      aoFim: () => { if (escuta) parar(); }
    });
  }
  function montar() {
    if (btn) return; css();
    btn = document.createElement("button"); btn.type = "button"; btn.id = "pdeMic"; btn.textContent = "🎤";
    btn.title = "Falar em vez de digitar"; btn.setAttribute("aria-label", btn.title); btn.setAttribute("data-sem-ditado", "");
    // não tira o foco do campo
    btn.addEventListener("pointerdown", e => e.preventDefault());
    btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); escuta ? parar() : comecar(); if (alvo) alvo.focus(); });
    document.body.appendChild(btn);
    window.addEventListener("scroll", posicionar, true); window.addEventListener("resize", posicionar);
  }
  document.addEventListener("focusin", e => {
    const el = e.target;
    if (el === btn) return;
    if (escuta && el !== alvo) parar();
    if (!serve(el)) { if (btn && !escuta) btn.classList.remove("on"); alvo = escuta ? alvo : null; return; }
    montar(); alvo = el; btn.classList.add("on"); posicionar();
  });
  document.addEventListener("focusout", e => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a === alvo || a === btn) return;
      if (escuta) parar();
      if (btn) btn.classList.remove("on"); alvo = null;
    }, 150);
  });
  // campo que some (janela fechou) leva o botão junto
  setInterval(() => { if (alvo && !document.contains(alvo)) { parar(); if (btn) btn.classList.remove("on"); alvo = null; } else if (alvo) posicionar(); }, 700);
})();

// Portal do Educador · padrão de cadastro (nov/2026)
// Um só jeito de gravar telefone, CEP, CPF, CNPJ, NIS, e-mail, site e nomes em toda a plataforma.
// Uso: <script src="/assets/js/padrao-cadastro.js"></script> no <head>; depois, nos campos, data-padrao="tel|cep|cpf|cnpj|nis|email|site|nome|municipio".
//   - Ao sair do campo, o valor é posto no padrão (ex.: 67)3255-1351 → (67) 3255-1351) e o campo fica vermelho se não tiver conserto.
//   - Antes de gravar: const e = PDE_PADRAO.conferir(formulario); if(e){ avisar(e.msg); e.el.focus(); return; }
//     conferir() também deixa os valores no padrão, prontos para ler e gravar.
//   - Para planilhas importadas: PDE_PADRAO.tel(texto) → { ok, fmt } (o mesmo para cep, cpf, cnpj, nis, email, site).
// Campo vazio é sempre aceito (obrigatoriedade é regra de cada tela).
(function(){
  "use strict";
  const dig = t => String(t == null ? "" : t).replace(/\D/g, "");
  const DDD = new Set(("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 " +
    "51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99").split(" "));
  const vazio = t => !String(t == null ? "" : t).trim();
  const R = (ok, fmt) => ({ ok, fmt });

  // telefone: (DD) 0000-0000 fixo ou (DD) 90000-0000 celular; tira +55 e o 0 + operadora
  // números especiais sem DDD: 0800/0300/0303/0500/0900 (gratuito, tarifa única) e 3003/3004/4003/4004/4020/4062 (número único nas capitais)
  const ESPECIAL_0 = /^0(800|300|303|500|900)\d{6,7}$/, ESPECIAL_4 = /^(3003|3004|4003|4004|4020|4062)\d{4}$/;
  function especial(d){
    if(ESPECIAL_0.test(d)) return d.slice(0, 4) + " " + d.slice(4, 7) + " " + d.slice(7);
    if(ESPECIAL_4.test(d)) return d.slice(0, 4) + "-" + d.slice(4);
    return "";
  }
  // opt.whatsapp: só número que pode ter WhatsApp (recusa 0800 e números únicos)
  function tel(t, opt){
    if(vazio(t)) return R(true, "");
    let d = dig(t);
    { const e = especial(d.startsWith("55") && d.length > 11 ? d.slice(2) : d); if(e) return opt && opt.whatsapp ? R(false, String(t).trim()) : R(true, e); }
    if(d.length > 11 && d.startsWith("55")) d = d.slice(2);
    if(d.startsWith("0")){ d = d.replace(/^0+/, ""); if(d.length === 12 || d.length === 13) d = d.slice(2); }
    const ddd = d.slice(0, 2), n = d.slice(2);
    const fixo = n.length === 8 && /^[2-5]/.test(n), cel = n.length === 9 && n[0] === "9";
    if(!DDD.has(ddd) || !(fixo || cel)) return R(false, String(t).trim());
    return R(true, "(" + ddd + ") " + (cel ? n.slice(0, 5) + "-" + n.slice(5) : n.slice(0, 4) + "-" + n.slice(4)));
  }
  function cep(t){
    if(vazio(t)) return R(true, "");
    const d = dig(t); if(d.length !== 8 || /^0+$/.test(d)) return R(false, String(t).trim());
    return R(true, d.slice(0, 5) + "-" + d.slice(5));
  }
  function cpfOk(c){
    if(c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    const dv = n => { let s = 0; for(let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
  }
  function cpf(t){
    if(vazio(t)) return R(true, "");
    const d = dig(t); if(!cpfOk(d)) return R(false, String(t).trim());
    return R(true, d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"));
  }
  function cnpjOk(c){
    if(c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const dv = n => { let s = 0, p = n - 7; for(let i = 0; i < n; i++){ s += Number(c[i]) * p--; if(p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
  }
  function cnpj(t){
    if(vazio(t)) return R(true, "");
    const d = dig(t); if(!cnpjOk(d)) return R(false, String(t).trim());
    return R(true, d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"));
  }
  // NIS/PIS/PASEP: 11 dígitos com dígito verificador
  function nis(t){
    if(vazio(t)) return R(true, "");
    const d = dig(t); if(d.length !== 11 || /^(\d)\1+$/.test(d)) return R(false, String(t).trim());
    const p = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for(let i = 0; i < 10; i++) s += Number(d[i]) * p[i];
    const r = 11 - (s % 11), v = r >= 10 ? 0 : r;
    if(v !== Number(d[10])) return R(false, String(t).trim());
    return R(true, d.replace(/^(\d{3})(\d{5})(\d{2})(\d)$/, "$1.$2.$3-$4"));
  }
  function email(t){
    if(vazio(t)) return R(true, "");
    const e = String(t).trim().toLowerCase();
    return /^[^@\s<>,;"']+@[^@\s<>,;"']+\.[a-z]{2,}$/.test(e) ? R(true, e) : R(false, String(t).trim());
  }
  function site(t){
    if(vazio(t)) return R(true, "");
    let u = String(t).trim().replace(/^http:\/\//i, "https://"); if(!/^https:\/\//i.test(u)) u = "https://" + u;
    u = u.replace(/^https:\/\/[^/]+/i, h => h.toLowerCase());
    return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(u) ? R(true, u) : R(false, String(t).trim());
  }
  // nome de pessoa ou lugar: espaços limpos e só as iniciais maiúsculas (de, da, do, das, dos, e em minúsculas)
  const MIUDAS = /^(de|da|do|das|dos|e|d'|di|du)$/;
  function nome(t){
    const n = String(t == null ? "" : t).replace(/\s+/g, " ").trim(); if(!n) return R(true, "");
    // só mexe quando veio TUDO em maiúsculas ou tudo em minúsculas (respeita quem digitou certo, ex.: "McArthur")
    if(n !== n.toUpperCase() && n !== n.toLowerCase()) return R(true, n);
    return R(true, n.toLowerCase().split(" ").map((w, i) => i > 0 && MIUDAS.test(w) ? w
      : w.split("-").map(x => x ? x[0].toUpperCase() + x.slice(1) : x).join("-")).join(" "));
  }
  // nome de município: sem "Município de" / "Prefeitura Municipal de"
  function municipio(t){
    const n = String(t == null ? "" : t).replace(/\s+/g, " ").trim().replace(/^(prefeitura\s+(municipal\s+)?de\s+|munic[ií]pio\s+de\s+)/i, "");
    if(!n) return R(true, "");
    return R(true, n.toLowerCase().split(" ").map((w, i) => i > 0 && MIUDAS.test(w) ? w
      : w.split("-").map(x => x ? x[0].toUpperCase() + x.slice(1) : x).join("-")).join(" "));
  }

  const whatsapp = t => tel(t, { whatsapp:true });
  const TIPOS = { tel, whatsapp, cep, cpf, cnpj, nis, email, site, nome, municipio };
  const EXEMPLO = {
    tel: "Use DDD + número: (67) 3255-1351 ou (67) 99999-0000. Também vale 0800 067 0053.",
    whatsapp: "Use DDD + número: (67) 99999-0000.",
    cep: "O CEP tem 8 dígitos (ex.: 79290-000).",
    cpf: "Confira os 11 dígitos (ex.: 123.456.789-09).",
    cnpj: "Confira os 14 dígitos (ex.: 03.073.673/0001-60).",
    nis: "O NIS tem 11 dígitos (ex.: 123.45678.90-1).",
    email: "Confira o e-mail (ex.: nome@escola.ms.gov.br).",
    site: "Confira o endereço (ex.: https://www.municipio.ms.gov.br)."
  };
  const ROTULO = { tel: "Telefone", whatsapp: "WhatsApp", cep: "CEP", cpf: "CPF", cnpj: "CNPJ", nis: "NIS", email: "E-mail", site: "Site" };

  // nome do campo para a mensagem: data-padrao-rotulo, senão o <label for>, senão o tipo
  function rotuloDe(el, tipo){
    if(el.dataset.padraoRotulo) return el.dataset.padraoRotulo;
    const l = el.id && el.ownerDocument.querySelector('label[for="' + el.id + '"]');
    const txt = l ? l.textContent.replace(/\*|\(.*?\)/g, "").trim() : "";
    return txt || ROTULO[tipo] || "Campo";
  }
  function aplicar(el){
    const tipo = el.dataset.padrao, f = TIPOS[tipo]; if(!f) return true;
    const r = f(el.value);
    if(r.ok && el.value !== r.fmt) el.value = r.fmt;
    el.classList.toggle("campo-erro", !r.ok);
    if(!r.ok) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    return r.ok;
  }
  // confere todos os campos com data-padrao dentro de "raiz"; devolve null ou { el, msg } do primeiro errado
  function conferir(raiz){
    const els = [...(raiz || document).querySelectorAll("[data-padrao]")];
    let erro = null;
    els.forEach(el => { if(!aplicar(el) && !erro) erro = { el, msg: rotuloDe(el, el.dataset.padrao) + " inválido. " + (EXEMPLO[el.dataset.padrao] || "") }; });
    return erro;
  }

  // ao sair do campo: põe no padrão (vale para campos criados depois, por delegação)
  document.addEventListener("focusout", e => { const t = e.target; if(t && t.dataset && t.dataset.padrao) aplicar(t); }, true);
  document.addEventListener("input", e => { const t = e.target; if(t && t.classList && t.classList.contains("campo-erro")) t.classList.remove("campo-erro"); }, true);
  // estilo do campo com erro (uma vez por página)
  const css = document.createElement("style");
  css.textContent = ".campo-erro{border-color:#c0392b !important;background:#fff5f4 !important;}";
  (document.head || document.documentElement).appendChild(css);

  window.PDE_PADRAO = Object.assign({ conferir, aplicar, dig, cpfOk, cnpjOk, EXEMPLO }, TIPOS);
})();

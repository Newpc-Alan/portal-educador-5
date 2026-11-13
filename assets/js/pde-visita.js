// Contador de visitantes do Portal (nov/2026): mostra no admin (/visitantes/) de onde vêm e até onde chegam os que não se cadastram.
// Anônimo: um código aleatório que vale só enquanto a aba está aberta (sessionStorage, some ao fechar), a origem (Instagram, Google, WhatsApp...), o fuso horário e, quando a pessoa
// escolhe no cadastro, o estado e o município. Sem IP, nome, e-mail ou cookie de terceiros. Respeita "Não rastrear" do navegador.
// Uso: <script src="/assets/js/pde-visita.js" defer></script>  ·  window.PDEVisita.marcar("login" | "cadastro" | "muni" | "fim" | "conta", { uf, mun, ibge })
(function(){
  if(window.PDEVisita) return;
  var fb = (window.PDE_AMBIENTE && window.PDE_AMBIENTE.fb) || {}, proj = fb.projectId || "portal-educador-5";
  var URL_ = "https://southamerica-east1-" + proj + ".cloudfunctions.net/visita";
  var dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";
  function vid(){
    var v = ""; try{ v = sessionStorage.getItem("pde_vid") || ""; }catch(e){}
    if(!/^[a-z0-9]{12,32}$/.test(v)){
      v = ""; var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function(_, i){ a[i] = Math.random() * 256; });
      a.forEach(function(b){ v += (b % 36).toString(36); }); v += Date.now().toString(36).slice(-4);
      try{ sessionStorage.setItem("pde_vid", v); }catch(e){}
    }
    return v;
  }
  function origem(){
    try{ var s = sessionStorage.getItem("pde_origem"); if(s) return s; }catch(e){}
    var q = new URLSearchParams(location.search), u = (q.get("utm_source") || q.get("origem") || "").toLowerCase(), r = "";
    try{ r = document.referrer ? new URL(document.referrer).hostname : ""; }catch(e){}
    var o = /insta/.test(u) || /instagram/.test(r) ? "instagram" : /face|fb/.test(u) || /facebook|fb\.com/.test(r) ? "facebook"
      : /whats|wa/.test(u) || /whatsapp|wa\.me/.test(r) ? "whatsapp" : /google/.test(u) || /google\./.test(r) ? "google"
      : /youtube|yt/.test(u) || /youtube|youtu\.be/.test(r) ? "youtube" : /tiktok/.test(u + r) ? "tiktok" : /linkedin/.test(u + r) ? "linkedin"
      : /bing/.test(u + r) ? "bing" : /mail/.test(u) ? "email" : /qr/.test(u) ? "qrcode" : /senacop/.test(u) ? "senacop"
      : r && !/portaldoeducador\.com\.br$/.test(r) ? "outro" : "direto";
    try{ sessionStorage.setItem("pde_origem", o); }catch(e){}
    return o;
  }
  function marcar(ev, x){
    if(dnt) return;
    try{
      var d = { v:vid(), e:ev, o:origem(), p:location.pathname.slice(0, 60), m:(matchMedia("(pointer:coarse)").matches && innerWidth < 900) ? 1 : 0 };
      try{ d.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }catch(e){}
      if(x){ if(x.uf) d.uf = String(x.uf).toUpperCase().slice(0, 2); if(x.mun) d.mun = String(x.mun).slice(0, 60); if(x.ibge) d.ibge = String(x.ibge); }
      var corpo = JSON.stringify(d);
      if(navigator.sendBeacon && navigator.sendBeacon(URL_, new Blob([corpo], { type:"text/plain" }))) return;
      fetch(URL_, { method:"POST", body:corpo, keepalive:true, mode:"no-cors", headers:{ "Content-Type":"text/plain" } }).catch(function(){});
    }catch(e){}
  }
  window.PDEVisita = { marcar:marcar };
  // quem já tem conta aberta neste aparelho não é visitante novo: a visita só conta para quem não está logado
  var logado = false; try{ logado = localStorage.getItem("pde_sessao") === "1"; }catch(e){}
  if(!logado) marcar("visita");
})();

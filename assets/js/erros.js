// Portal do Educador · captura de erros no navegador (nov/2026)
// Manda para a NEWPC os erros de JavaScript que acontecem com o professor, para a gente corrigir antes de ele reclamar.
// Carregar depois de /assets/js/ambiente.js. JavaScript antigo de propósito (roda em navegadores velhos da TV e da lousa).
// Não manda nada digitado pelo usuário: só a mensagem do erro, a página e o navegador. No máximo 8 erros por página aberta.
(function(){
  if(window.__pdeErros) return; window.__pdeErros = true;
  var amb = window.PDE_AMBIENTE; if(!amb || !amb.funcoes || amb.teste) return;
  var URL_ERRO = amb.funcoes + "registrarErro", enviados = 0, vistos = {};
  function uid(){
    try{ for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(k && k.indexOf("firebase:authUser:") === 0){ var u = JSON.parse(localStorage.getItem(k)); return (u && u.uid) || ""; } } }catch(e){}
    return "";
  }
  function mandar(msg, fonte, linha, coluna, pilha){
    try{
      msg = String(msg || "").slice(0, 300); if(!msg || enviados >= 8) return;
      var chave = msg + "|" + linha; if(vistos[chave]) return; vistos[chave] = 1; enviados++;
      var corpo = JSON.stringify({ m:msg, s:String(fonte || "").slice(0, 200), l:linha || 0, c:coluna || 0, k:String(pilha || "").slice(0, 1200),
        p:location.hostname + location.pathname, u:uid(), v:document.lastModified || "" });
      if(navigator.sendBeacon) navigator.sendBeacon(URL_ERRO, new Blob([corpo], { type:"text/plain" }));
      else { var x = new XMLHttpRequest(); x.open("POST", URL_ERRO, true); x.setRequestHeader("Content-Type", "text/plain"); x.send(corpo); }
    }catch(e){}
  }
  window.addEventListener("error", function(e){
    // erro de carregar imagem ou script também chega aqui, sem mensagem: ignora
    if(!e || !e.message) return;
    mandar(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function(e){
    var r = e && e.reason; if(!r) return;
    // erros esperados do Firebase (sem internet, sem permissão, cota) já aparecem para o usuário na tela
    var cod = String(r.code || ""); if(/unavailable|permission-denied|resource-exhausted|unauthenticated|network-request-failed|cancelled|popup-closed/.test(cod)) return;
    mandar((r.name ? r.name + ": " : "") + (r.message || String(r)), "", 0, 0, r.stack);
  });
})();

// Portal do Educador · qual ambiente esta página usa (nov/2026)
// OFICIAL: www.portaldoeducador.com.br (o antigo app. redireciona para o www) (professores e redes de verdade).
// TESTE (homologação): teste.portaldoeducador.com.br e os endereços do projeto de teste. Tudo que muda passa
// primeiro pelo teste; depois de validado, a mesma versão vai para o oficial. O teste nunca toca no banco oficial.
// Carregar ANTES dos outros scripts:  <script src="/assets/js/ambiente.js"></script>
// Escrito em JavaScript antigo (var, function) de propósito: a TV leve roda em navegadores velhos.
(function(){
  var OFICIAL = {
    apiKey: "AIzaSyCKk_t9bvP9kDhI5aUpSxNV3icR6j70tk0",
    // login com Google pelo domínio do Portal (nov/2026): a tela do Google mostra "Prosseguir para portaldoeducador.com.br".
    // Os arquivos /__/auth/ são copiados do Firebase pela rotina "Sincronizar arquivos do login". Para voltar: "portal-educador-5.firebaseapp.com"
    authDomain: "www.portaldoeducador.com.br",
    projectId: "portal-educador-5",
    storageBucket: "portal-educador-5.firebasestorage.app",
    messagingSenderId: "725103866385",
    appId: "1:725103866385:web:f38b8f3cf0a912ed3bf7b0"
  };
  // preenchido quando o projeto Firebase de teste for criado (Console > Configurações do projeto > Seus apps > Web)
  var TESTE = {
    apiKey: "",
    authDomain: "portal-educador-5-teste.firebaseapp.com",
    projectId: "portal-educador-5-teste",
    storageBucket: "portal-educador-5-teste.firebasestorage.app",
    messagingSenderId: "",
    appId: ""
  };
  var h = location.hostname || "";
  var ehTeste = /^teste\./.test(h) || h.indexOf("portal-educador-5-teste") === 0;
  var fb = ehTeste ? TESTE : OFICIAL;
  window.PDE_AMBIENTE = {
    nome: ehTeste ? "teste" : "oficial",
    teste: ehTeste,
    fb: fb,
    // endereço das funções chamadas por URL (portaria, calendário, descadastro)
    funcoes: "https://southamerica-east1-" + fb.projectId + ".cloudfunctions.net/",
    // fotos da portaria ficam num bucket próprio em São Paulo
    bucketPortaria: "gs://" + fb.projectId + "-portaria"
  };
  if(!ehTeste) return;
  // faixa fixa para ninguém confundir o teste com o oficial
  function faixa(){
    if(document.getElementById("pdeFaixaTeste")) return;
    var d = document.createElement("div"); d.id = "pdeFaixaTeste";
    d.textContent = fb.apiKey ? "AMBIENTE DE TESTES · dados fictícios" : "AMBIENTE DE TESTES · projeto de teste ainda não configurado";
    d.setAttribute("style", "position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:2147483647;background:#e67e22;color:#fff;" +
      "font:700 12px/1.2 system-ui,sans-serif;padding:6px 14px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none;letter-spacing:.3px");
    (document.body || document.documentElement).appendChild(d);
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", faixa); else faixa();
})();

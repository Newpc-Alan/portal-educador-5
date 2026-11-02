// Auditoria: registra a ENTRADA de cada pessoa em cada tela do Portal 5.0 (data, hora, IP, navegador, perfil).
// Quem grava é o servidor (função registrarEntrada); a tela só avisa. Uma vez por sessão do navegador, por tela.
// Uso: <script type="module" src="/assets/pde-entrada.js"></script> em qualquer página que tenha login.
// Funciona com qualquer app do Firebase que a página criar (espera ele aparecer; não cria nada).
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const tela = (location.pathname.replace(/\/index\.html$/, "").replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "inicio").slice(0, 40);
const vistos = new Set();

async function avisar(app, user){
  const chave = "pde_entrada_" + user.uid + "_" + tela;
  try{ if(sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, "1"); }catch(e){ if(vistos.has(chave)) return; }
  vistos.add(chave);
  try{
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
    await httpsCallable(getFunctions(app, "southamerica-east1"), "registrarEntrada", { timeout:15000 })({ tela });
  }catch(e){
    try{ sessionStorage.removeItem(chave); }catch(x){}   // tenta de novo na próxima carga
    console.warn("registro de entrada:", e.code || e.message);
  }
}
const ligados = new WeakSet();
// o módulo de login só é baixado quando a página já criou o app (não pesa nas páginas públicas)
async function ligar(){
  const apps = getApps().filter(a => !ligados.has(a)); if(!apps.length) return;
  const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  apps.forEach(app => {
    if(ligados.has(app)) return; ligados.add(app);
    try{ onAuthStateChanged(getAuth(app), u => { if(u && !u.isAnonymous){ avisar(app, u);
      // aluno com aula aberta: a página segue o professor (pausa, conteúdo, pesquisa, mão e bate-papo) em qualquer tela do Portal
      import("/assets/js/aula-vivo-aluno.js").then(m => m.iniciar(app, u)).catch(e => console.warn("aula ao vivo:", e.message || e)); } }); }catch(e){}
  });
}
// a página cria o app quando quer (algumas só depois do clique em Entrar): confere a cada 2 s por até 30 min; achou, segue ouvindo
let n = 0;
(function procurar(){ ligar(); if(++n < 900 && !getApps().length) setTimeout(procurar, 2000); else setTimeout(ligar, 3000); })();

// Portal Maestro · tela de bloqueio com mensagens motivacionais
// Sorteia uma mensagem ao bloquear e troca a cada 40 s, sem repetir a anterior.
// Para incluir novas mensagens: coloque o JPG em bloqueio/ e acrescente o nome na lista.
const MENSAGENS = ["bloqueio/msg1.jpg", "bloqueio/msg2.jpg", "bloqueio/msg3.jpg"];
const TROCA_MS = 40000;

const camadas = [document.getElementById("camadaA"), document.getElementById("camadaB")];
let atual = -1;
let frente = 0;

function sortear() {
  if (MENSAGENS.length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * MENSAGENS.length); } while (i === atual);
  return i;
}

function mostrar() {
  atual = sortear();
  const proxima = camadas[1 - frente];
  const img = new Image();
  img.onload = () => {
    proxima.style.backgroundImage = `url("${MENSAGENS[atual]}")`;
    proxima.classList.add("visivel");
    camadas[frente].classList.remove("visivel");
    frente = 1 - frente;
  };
  img.src = MENSAGENS[atual];
}

mostrar();
setInterval(mostrar, TROCA_MS);

chrome.storage.local.get("nome", (d) => {
  if (d.nome) {
    const el = document.getElementById("nome");
    el.textContent = d.nome;
    el.style.display = "inline-flex";
  }
});

// bloqueia menu de contexto e atalhos comuns dentro da tela
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) e.preventDefault();
});

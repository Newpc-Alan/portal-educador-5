// Portal Maestro · janela da Afinação, do Compasso e da Pergunta individual
const $ = (id) => document.getElementById(id);
const VAZIO = { afinacao: null, compasso: null, pergunta: null };
let estadoAtual = VAZIO;
let duracaoTotal = null;      // para a barra de progresso
let compassoAtualId = null;
let perguntaAtualId = null;
let avisouFim = false;
let enviando = false;

function formatar(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function bipe(notas) {
  try {
    const ctx = new AudioContext();
    (notas || [0, 0.35, 0.7]).forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { /* sem áudio disponível */ }
}

function montarPergunta(p) {
  perguntaAtualId = p.id;
  $("pqTexto").textContent = p.texto;
  $("pqEnviado").hidden = true;
  $("pqErro").hidden = true;
  if (p.opcoes) {
    const box = $("pqOpcoes");
    box.textContent = "";
    p.opcoes.forEach((op, i) => {
      const b = document.createElement("button");
      b.dataset.action = "escolherOpcao";
      b.dataset.valor = op;
      const letra = document.createElement("span");
      letra.className = "letra";
      letra.textContent = "ABCD"[i];
      const txt = document.createElement("span");
      txt.textContent = op;
      b.append(letra, txt);
      box.appendChild(b);
    });
    box.hidden = false;
    $("pqLivre").hidden = true;
  } else {
    $("pqOpcoes").hidden = true;
    $("pqLivre").hidden = false;
    $("pqResposta").value = "";
    setTimeout(() => $("pqResposta").focus(), 50);
  }
  bipe([0, 0.18]);
}

function render() {
  const { afinacao, compasso, pergunta } = estadoAtual;

  // Afinação
  $("blocoAfinacao").hidden = !afinacao;
  if (afinacao) {
    $("pergunta").textContent = afinacao.pergunta;
    $("opcoes").hidden = false;
    $("enviado").hidden = true;
  }

  // Pergunta individual (só reconstrói quando chega uma pergunta nova, para não apagar o que o aluno digita)
  $("blocoPergunta").hidden = !pergunta;
  if (pergunta && pergunta.id !== perguntaAtualId) montarPergunta(pergunta);
  if (!pergunta) perguntaAtualId = null;

  // Compasso
  $("blocoCompasso").hidden = !compasso;
  if (compasso) {
    if (compasso.id !== compassoAtualId) {
      compassoAtualId = compasso.id;
      duracaoTotal = Math.max(1000, compasso.fimLocal - Date.now());
      avisouFim = false;
    }
    $("tituloAtv").textContent = compasso.titulo;
  }

  if (!afinacao && !compasso && !pergunta) window.close();
}

function tick() {
  const c = estadoAtual.compasso;
  if (!c) return;
  const resta = c.fimLocal - Date.now();
  $("tempo").textContent = resta > 0 ? formatar(resta) : "TEMPO!";
  $("barra").style.width = Math.max(0, Math.min(100, (resta / duracaoTotal) * 100)) + "%";
  $("blocoCompasso").classList.toggle("fim", resta <= 0);
  if (resta <= 0 && !avisouFim) {
    avisouFim = true;
    bipe();
  }
}

async function enviarRespostaPergunta(resposta) {
  if (enviando || !estadoAtual.pergunta) return;
  enviando = true;
  $("pqErro").hidden = true;
  const r = await chrome.runtime.sendMessage({ tipo: "pergunta", id: estadoAtual.pergunta.id, resposta });
  enviando = false;
  if (r && r.ok) {
    $("pqOpcoes").hidden = true;
    $("pqLivre").hidden = true;
    $("pqEnviado").hidden = false;
  } else {
    $("pqErro").textContent = (r && r.erro) || "Não foi possível enviar.";
    $("pqErro").hidden = false;
  }
}

const acoes = {
  async responder(el) {
    if (enviando || !estadoAtual.afinacao) return;
    enviando = true;
    const r = await chrome.runtime.sendMessage({ tipo: "afinacao", id: estadoAtual.afinacao.id, valor: el.dataset.valor });
    enviando = false;
    if (r && r.ok) {
      $("opcoes").hidden = true;
      $("enviado").hidden = false;
    } else {
      $("enviado").hidden = false;
      $("enviado").textContent = (r && r.erro) || "Não foi possível enviar.";
    }
  },
  escolherOpcao(el) {
    enviarRespostaPergunta(el.dataset.valor);
  },
  enviarPergunta() {
    const txt = $("pqResposta").value.trim();
    if (!txt) {
      $("pqErro").textContent = "Escreva sua resposta.";
      $("pqErro").hidden = false;
      return;
    }
    enviarRespostaPergunta(txt);
  }
};

document.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-action]");
  if (alvo && acoes[alvo.dataset.action]) acoes[alvo.dataset.action](alvo);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && document.activeElement === $("pqResposta")) {
    e.preventDefault();
    acoes.enviarPergunta();
  }
});

chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area === "local" && mudancas.regencia) {
    estadoAtual = mudancas.regencia.newValue || VAZIO;
    // mostra o "enviado" por um instante antes de esconder o bloco respondido
    const mostrandoEnvio = !$("enviado").hidden || !$("pqEnviado").hidden;
    setTimeout(render, mostrandoEnvio ? 1200 : 0);
  }
});

chrome.storage.local.get("regencia", (d) => {
  estadoAtual = Object.assign({}, VAZIO, d.regencia || {});
  render();
  tick();
});
setInterval(tick, 250);

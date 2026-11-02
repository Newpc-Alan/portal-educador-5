// Portal Maestro · tela de entrada na aula (abre ao ligar o Chromebook)
const $ = (id) => document.getElementById(id);

function enviar(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function mensagem(texto, erro) {
  $("msg").textContent = texto || "";
  $("msg").className = "msg" + (erro ? " erro" : "");
}

function fecharEstaTela() {
  chrome.tabs.getCurrent((aba) => { if (aba) chrome.tabs.remove(aba.id); });
}

async function iniciar() {
  const st = await enviar({ tipo: "status" });
  $("conta").textContent = st.email ? "Conta: " + st.email : "";
  if (st.nome) $("nome").value = st.nome;
  if (st.obrigatoria) $("subtitulo").textContent = "Para usar o computador, entre na aula com o número que o professor mostrou.";
  if (st.aula) {
    mostrarOk(st.aula);
    return;
  }
  $("codigo").focus();
}

function mostrarOk(aula, professor) {
  $("telaForm").hidden = true;
  $("telaOk").hidden = false;
  $("okTexto").textContent = (professor ? `Aula ${aula} · ${professor}. ` : `Aula ${aula}. `) + "Esta tela fecha sozinha.";
  setTimeout(fecharEstaTela, 2500);
}

const acoes = {
  async portal() {
    await enviar({ tipo: "abrirPortal" });
    mensagem("Entre no Portal com a sua conta. Quando o professor abrir a aula, este computador entra sozinho.");
  },
  async entrar() {
    const codigo = $("codigo").value.trim();
    const nome = $("nome").value.trim();
    if (!/^\d{6}$/.test(codigo)) { mensagem("Digite os 6 números da aula.", true); $("codigo").focus(); return; }
    if (!nome) { mensagem("Digite seu nome.", true); $("nome").focus(); return; }
    $("btnEntrar").disabled = true;
    mensagem("Conectando...");
    const r = await enviar({ tipo: "entrar", aula: codigo, nome });
    $("btnEntrar").disabled = false;
    if (!r || !r.ok) { mensagem((r && r.erro) || "Não foi possível entrar.", true); return; }
    mensagem("");
    mostrarOk(codigo, r.professor);
  }
};

document.addEventListener("click", (e) => {
  const alvo = e.target.closest("[data-action]");
  if (alvo && acoes[alvo.dataset.action]) acoes[alvo.dataset.action]();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !$("telaForm").hidden) {
    if (document.activeElement === $("codigo") && /^\d{6}$/.test($("codigo").value)) $("nome").focus();
    else acoes.entrar();
  }
});

$("codigo").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  if (e.target.value.length === 6 && !$("nome").value) $("nome").focus();
});

iniciar();

// Portal Maestro · ponte com o Portal do Educador (v0.9)
// Roda só nas páginas do Portal (www e o antigo app.). O aluno entra no Portal com a conta dele (cartão QR, código + PIN ou Google);
// quando a turma tem aula aberta, o Portal avisa por aqui e o Chromebook entra na aula do Maestro sozinho, sem digitar número.
// Só aceita mensagens da própria página (mesma origem) e só repassa: número da aula (6 dígitos), nome e id da matrícula.
document.documentElement.dataset.maestroExt = chrome.runtime.getManifest().version;
window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (ev.source !== window || ev.origin !== location.origin || !d || d.fonte !== "portal-educador" || d.tipo !== "maestro-entrar") return;
  if (!/^\d{6}$/.test(String(d.aula || ""))) return;
  chrome.runtime.sendMessage({ tipo: "entrar", aula: String(d.aula), nome: String(d.nome || "").slice(0, 60), aluno: String(d.aluno || "").slice(0, 64), viaPortal: true }, (r) => {
    window.postMessage({ fonte: "maestro-extensao", tipo: "entrou", ok: !!(r && r.ok), erro: r && r.erro, ja: !!(r && r.ja) }, location.origin);
  });
});
window.postMessage({ fonte: "maestro-extensao", tipo: "pronta" }, location.origin);

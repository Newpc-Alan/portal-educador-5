// Portal Maestro na gaveta (nov/2026): este service worker só se desinstala e limpa o cache da página antiga do aluno
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: "window" }))
    .then((cs) => cs.forEach((c) => c.navigate("https://app.portaldoeducador.com.br/entrar/").catch(() => {}))));
});

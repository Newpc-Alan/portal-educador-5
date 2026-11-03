// App de atendimento: recebe a notificação do WhatsApp do Portal (Firebase Cloud Messaging) e abre a conversa no toque.
// Não guarda nada em cache: sempre a versão nova do app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j || {}; } catch (err) { d = {}; }
  const titulo = d.titulo || "Atendimento WhatsApp", corpo = d.corpo || "Nova mensagem";
  e.waitUntil(self.registration.showNotification(titulo, {
    body: corpo, icon: "/tv/icone-192.png", badge: "/assets/pde-logo-64.png",
    tag: d.wa_id ? "wa-" + d.wa_id : "wa", renotify: true, data: { link: d.link || "/atendimento/", wa_id: d.wa_id || "" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "/atendimento/", waId = e.notification.data && e.notification.data.wa_id;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
    const aberto = lista.find(c => new URL(c.url).pathname.startsWith("/atendimento/"));
    if (aberto) { aberto.focus(); if (waId) aberto.postMessage({ wa_id: waId }); return; }
    return self.clients.openWindow(link);
  }));
});

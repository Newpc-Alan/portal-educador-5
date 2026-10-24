// Portal do Educador TV: service worker mínimo para permitir instalar como aplicativo (abre sempre em tela cheia).
// Não intercepta requisições: as mídias já ficam guardadas pela própria TV (Cache API).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

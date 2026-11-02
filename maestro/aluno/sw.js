// Portal Maestro · página do aluno · service worker
// Guarda só a casca da página (abre rápido mesmo com internet ruim). O banco da aula é sempre consultado ao vivo.
const CACHE = "maestro-aluno-web-1.2.0";
const CASCA = ["./", "index.html", "manifest.webmanifest", "icons/aluno-192.png", "icons/aluno-512.png", "icons/aluno-maskable-512.png",
               "bloqueio/msg1.jpg", "bloqueio/msg2.jpg", "bloqueio/msg3.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("maestro-aluno-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Firebase e conteúdos: sempre pela rede
  // rede primeiro (pega versão nova), cache se estiver sem internet
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

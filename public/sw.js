/* Lash Bounty ERP · service worker kecil: aplikasi bisa dipasang di HP (PWA).
   Selalu ambil versi terbaru dari server (network-first); cache hanya cadangan kalau offline. Data (/api) tidak pernah di-cache. */
const CACHE = "lb-shell-1.1.0";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/")) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && r.type === "basic") { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); } return r; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("./") : Response.error()))));
});

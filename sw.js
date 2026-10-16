// Scent Drip service worker: lets the app open offline and install on phones.
// Strategy: always try the network first (so customers never see an old version),
// fall back to the last saved copy only when there's no connection.
const CACHE = "scentdrip-v1";
const CORE = ["/", "/index.html", "/css/style.css", "/js/config.js", "/js/common.js", "/js/shop.js",
  "/js/notes-data.js", "/js/chatbot.js", "/images/logo-mark.png", "/images/logo-mark-dark.png", "/images/app/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only our own files. Never touch the database, payments, or the admin page.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/index.html") : Response.error()))
      )
  );
});

const CACHE_NAME = "limove-os-v1";
const STATIC_ASSETS = ["/", "/login", "/offline.html", "/manifest.json"];

// Data endpoints whose last-known state should survive offline so the
// dashboard keeps showing cached totals.
const OFFLINE_DATA = [
  "/api/projects",
  "/api/finance/balance",
  "/api/monitoring/stats",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Network-first: freshness wins, cached copy is the offline fallback.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // API routes:
  //  - the offline-data endpoints are network-first (cached copy when offline)
  //  - all other API routes stay network-only (native behaviour)
  if (url.pathname.startsWith("/api/")) {
    const isDataEndpoint = OFFLINE_DATA.some((p) => url.pathname.startsWith(p));
    if (isDataEndpoint) {
      event.respondWith(networkFirst(request).catch(() => caches.match("/offline.html")));
    }
    return;
  }

  // Everything else (chunks, images, fonts, HTML navs): cache-first, update in
  // background, fall back to the offline page when unreachable.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate" || request.destination === "document") {
            return caches.match("/offline.html");
          }
          return undefined;
        });
      return cached || fetchPromise;
    })
  );
});
// PWA removed (2026-10-11) — kill-switch stub.
// Unregisters the old limove-os service worker and wipes its caches so no
// stale app shell can be served. Safe to delete this file once every client
// has visited the site at least once after this deploy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((c) => { try { c.navigate(c.url); } catch {} });
      } catch {}
      try { await self.registration.unregister(); } catch {}
    })()
  );
});

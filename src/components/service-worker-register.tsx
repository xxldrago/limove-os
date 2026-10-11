'use client';

import { useEffect } from 'react';

// PWA removed (2026-10-11) — one-time client cleanup. Unregisters any
// previously installed /sw.js and drops its caches so stale shells can't be
// served. TODO: delete this component (and public/sw.js) after all clients
// have visited the site at least once.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
        .catch(() => {});
    }
    try {
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) =>
            keys
              .filter((k) => k.startsWith('limove-os-'))
              .forEach((k) => caches.delete(k).catch(() => {})),
          )
          .catch(() => {});
      }
    } catch {}
  }, []);

  return null;
}

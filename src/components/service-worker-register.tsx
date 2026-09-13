"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch((err) => {
          // Only log in dev; silent in production to avoid noise.
          if (process.env.NODE_ENV === "development") {
            console.error("SW registration failed:", err);
          }
        });
    }
  }, []);

  return null;
}
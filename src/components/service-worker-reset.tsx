"use client";

import { useEffect } from "react";

const CACHE_PREFIXES = ["next-pwa", "workbox", "start-url", "pages", "apis", "next-static"];

export function ServiceWorkerReset() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    }

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          if (CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            void caches.delete(key);
          }
        }
      });
    }
  }, []);

  return null;
}

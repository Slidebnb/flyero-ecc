"use client";

import { useEffect } from "react";

const SERVICE_WORKER_CLEANUP_KEY = "flyero-distributor-sw-cleaned-v4";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const path = window.location.pathname;
    const isDistributorSurface = path === "/offline" || path.startsWith("/distributor/");
    const cleanupLegacyRegistrations = async () => {
      try {
        if (window.localStorage.getItem(SERVICE_WORKER_CLEANUP_KEY) === "1") return;
        const rootScope = `${window.location.origin}/`;
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter((registration) => registration.scope === rootScope)
            .map((registration) => registration.unregister()),
        );
        window.localStorage.setItem(SERVICE_WORKER_CLEANUP_KEY, "1");
      } catch {
        // Service-worker cleanup is best effort and must never delay navigation.
      }
    };

    if (!isDistributorSurface) {
      void cleanupLegacyRegistrations();
      return;
    }

    void cleanupLegacyRegistrations()
      .then(() => navigator.serviceWorker.register("/sw.js", { scope: "/distributor/" }))
      .catch(() => undefined);
  }, []);

  return null;
}

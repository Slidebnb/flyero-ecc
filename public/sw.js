const FLYERO_DISTRIBUTOR_CACHE = "flyero-distributor-shell-v2";
const SHELL_URLS = ["/", "/login", "/distributor/dashboard", "/offline", "/manifest.webmanifest"];

function isPrivateOrApiRequest(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/customer/") ||
    url.pathname.startsWith("/warehouse/")
  );
}

function isNextStaticRequest(request) {
  return new URL(request.url).pathname.startsWith("/_next/static/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(FLYERO_DISTRIBUTOR_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== FLYERO_DISTRIBUTOR_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (isPrivateOrApiRequest(request) || isNextStaticRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(FLYERO_DISTRIBUTOR_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))),
  );
});

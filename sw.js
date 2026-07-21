// Network-first service worker — always serves the latest deploy when online,
// falls back to cache only when offline. Cache version bumps on each deploy-relevant change.
const CACHE_NAME = "kosmic-kat-studio-v15";
const ASSETS = [
  "/index.html",
  "/audio.js",
  "/adstudio.js",
  "/editor.js",
  "/team.js",
  "/costs.js",
  "/upscaler.js",
  "/display.js",
  "/flow.js",
  "/nodecanvas.js",
  "/motion.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests from our own origin; let everything else
  // (Firebase auth, fal.ai, ElevenLabs, etc.) go straight to the network.
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Got fresh content — update the cache copy in the background
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline → serve cached
  );
});

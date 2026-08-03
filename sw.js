// Network-first service worker — always serves the latest deploy when online,
// falls back to cache only when offline. Cache version bumps on each deploy-relevant change.
const CACHE_NAME = "kosmic-kat-studio-v21";
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
  "/assets.js",
  "/gallery.js",
  "/characters.js",
  "/directors.js",
  "/home.js",
  "/kosmicengine.js",
  "/cinemastudio.js",
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
    // cache: "no-store" makes this genuinely network-first, not just
    // "SW-cache-first with a network fallback" — without it, this fetch()
    // still goes through the BROWSER's own HTTP cache first, which can
    // silently serve a stale response (e.g. a JS file GitHub Pages sent
    // with a cacheable max-age) even though this code calls it "network-
    // first." That's what caused cinemastudio.js edits to keep showing
    // stale content this session despite fresh commits deploying fine —
    // the SW cache version bump alone doesn't fix a stale BROWSER cache.
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        // Got fresh content — update the cache copy in the background
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline → serve cached
  );
});

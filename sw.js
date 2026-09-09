// Network-first service worker. Cache version is bumped whenever deploy-relevant
// runtime layers change so an offline client does not retain a stale catalog.
const CACHE_NAME = "kosmic-kat-studio-v28";
const ASSETS = [
  "/index.html","/audio.js","/adstudio.js","/editor.js","/team.js","/costs.js","/upscaler.js","/display.js","/flow.js","/nodecanvas.js","/motion.js","/assets.js","/gallery.js","/characters.js","/directors.js","/home.js","/home-models-current.js","/kosmicengine.js","/cinemastudio.js",
  "/evolink-video.js","/evolink-video-current.js","/evolink-video-expansion.js","/evolink-video-integrity.js","/evolink-video-adapter-fallback.js","/evolink-video-safety.js","/evolink-video-canvas-adapter.js","/evolink-video-final-guard.js","/evolink-video-route-hud.js","/video-settings-parity.js","/settings-layer-guard.js",
  "/ui-v2-evolink-route.css","/ui-v2.css","/ui-v2-phase1.css","/ui-v2-phase2.css","/ui-v2-phase3.css","/ui-v2-phase4.css","/ui-v2-phase5.css","/ui-v2-phase6.css","/ui-v2-phase7.css","/ui-v2-phase8.css","/ui-v2-phase9.css","/ui-v2-phase10.css","/ui-v2-home-latest.css","/ui-v2-settings-fix.css","/ui-v2-settings-immune.css","/ui-v2-layer-arbiter.css",
  "/engine-glass-ui.js","/engine-asset-review.js","/engine-strategy-ui.js","/engine-recovery.js","/manifest.json","/icon-192.png","/icon-512.png"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;event.respondWith(fetch(event.request,{cache:"no-store"}).then(response=>{const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});return response}).catch(()=>caches.match(event.request)))});

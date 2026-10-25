// Stale-while-revalidate service worker.
// Cached files are served instantly (no waiting on a slow network); each request also
// refreshes its cache entry in the background, and when a file has really changed the page
// is told ("kk-update") so it can offer a one-tap reload. Firebase / Google Fonts files
// (versioned, immutable) are cached after first use so later visits skip those downloads.
// The cache version is bumped whenever deploy-relevant layers change.
const CACHE_NAME = "kosmic-kat-studio-v56";
const ASSETS = [
  "/index.html","/audio.js","/adstudio.js","/editor.js","/team.js","/costs.js","/upscaler.js","/upscaler-registry.js","/display.js",
  "/flow.js","/nodecanvas.js","/motion.js","/assets.js","/gallery.js","/characters.js","/directors.js","/home.js",
  "/kosmicengine.js","/cinema-registry.js","/cinemastudio.js","/settings-layer-guard.js","/kosmic-video.js","/chat-glass.js","/ui-v2-evolink-route.css","/ui-v2.css","/ui-v2-phase1.css",
  "/ui-v2-phase2.css","/ui-v2-phase3.css","/ui-v2-phase4.css","/ui-v2-phase5.css","/ui-v2-phase6.css","/ui-v2-phase7.css","/ui-v2-phase8.css","/ui-v2-phase9.css",
  "/ui-v2-phase10.css","/ui-v2-home-latest.css","/ui-v2-settings-fix.css","/ui-v2-settings-immune.css","/ui-v2-layer-arbiter.css","/engine-vision-bridge.js","/engine-assembly.js","/engine-asset-review.js","/engine-strategy-ui.js",
  "/engine-recovery.js","/manifest.json","/icon-192.png","/icon-512.png"
];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
const CROSS=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
let notified=false;
async function tellClients(){
  if(notified)return;notified=true;
  const cs=await self.clients.matchAll({type:"window"});
  cs.forEach(c=>c.postMessage({type:"kk-update"}));
}
function changed(a,b){
  const ea=a.headers.get("etag"),eb=b.headers.get("etag");
  if(ea&&eb)return ea!==eb;
  const la=a.headers.get("last-modified"),lb=b.headers.get("last-modified");
  if(la&&lb)return la!==lb;
  return a.headers.get("content-length")!==b.headers.get("content-length");
}
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const same=url.origin===self.location.origin;
  if(!same&&!CROSS.test(event.request.url))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request);
    const refresh=fetch(event.request,same?{cache:"no-cache"}:undefined).then(res=>{
      if(res&&(res.ok||res.type==="opaque")){
        if(same&&cached&&res.ok&&changed(cached,res))tellClients();
        cache.put(event.request,res.clone()).catch(()=>{});
      }
      return res;
    });
    if(cached){event.waitUntil(refresh.catch(()=>{}));return cached}
    return refresh;
  })());
});

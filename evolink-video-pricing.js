/* KOSMIC KAT — EVO LINK VIDEO PRICING HINTS
 * Current public entry-rate hints, verified 2026-09-10. These are display
 * hints only: full resolution/input/reference billing remains provider-owned.
 */
(function installEvoLinkVideoPricing(){
  "use strict";
  if(window.__kosmicEvoLinkPricing)return;
  window.__kosmicEvoLinkPricing=true;
  const P={
    "seedance-2.5-reference-to-video":{from:0.085,unit:"input + output sec"},
    "seedance-2.0-reference-to-video":{from:0.057,unit:"input + output sec"},
    "seedance-2.0-fast-reference-to-video":{from:0.034,unit:"input + output sec"},
    "seedance-2.0-mini-reference-to-video":{from:0.012,unit:"output sec"},
    "minimax-h3-text-to-video":{from:0.076,unit:"output sec"},
    "grok-imagine-video-1.5-preview":{from:0.064,unit:"output sec"},
    "gemini-omni-flash-text-to-video":{from:0.015,unit:"1K video tokens"},
    "kling-v3-turbo-text-to-video":{from:0.106,unit:"output sec"},
    "happyhorse-1.1-text-to-video":{from:0.124,unit:"output sec"},
    "wan2.7-text-to-video":{from:0.087,unit:"output sec"},
    "happyhorse-1.0-text-to-video":{from:0.124,unit:"output sec"},
    "topaz-video-upscale":{from:0.055,unit:"input sec"},
    "seedance-1.5-pro":{from:0.027,unit:"output sec"},
    "kling-v3-motion-control":{from:0.121,unit:"input sec"},
    "kling-o3-text-to-video":{from:0.080,unit:"output sec"},
    "kling-v3-text-to-video":{from:0.080,unit:"output sec"},
    "wan2.6-text-to-video":{from:0.075,unit:"output sec"},
    "veo3.1-fast-beta":{from:0.318,unit:"8s video"},
    "veo3.1-pro-beta":{from:2.383,unit:"8s video"},
    "sora-2-preview":{from:0.085,unit:"output sec"},
    "sora-2-pro-preview":{from:0.255,unit:"output sec"},
    "grok-imagine-text-to-video-beta":{from:0.012,unit:"output sec"},
    "wan2.5-image-to-video":{from:0.075,unit:"output sec"},
    "MiniMax-Hailuo-2.3-Fast":{from:0.177,unit:"6s video"},
    "MiniMax-Hailuo-02":{from:0.080,unit:"6s video"},
    "kling-o1-image-to-video":{from:0.118,unit:"output sec"},
    "doubao-seedance-1.0-pro-fast":{from:0.006,unit:"output sec"},
    "omnihuman-1.5":{from:0.177,unit:"input audio sec"},
    "wan3.0-text-to-video":{from:0.0375,unit:"output sec",quality:{"480p":0.0375,"720p":0.075,"1080p":0.15}},
    "wan3.0-prime-text-to-video":{from:0.0578,unit:"output sec",quality:{"480p":0.0578,"720p":0.119,"1080p":0.238}}
  };
  window.KOSMIC_EVOLINK_VIDEO_PRICING=P;
  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog?.length)return false;
    api.catalog.forEach(card=>{
      const first=card.routes?.find(r=>P[r.id]);
      const p=first&&P[first.id];
      if(p){card.priceHint=p.from!==undefined?`from $${p.from<0.01?p.from.toFixed(4):p.from.toFixed(3)} / ${p.unit}`:"Live provider rate";}
      (card.routes||[]).forEach(route=>{if(P[route.id])route.price=P[route.id];});
    });
    return true;
  };
  if(!boot()){
    let tries=0;const t=setInterval(()=>{if(boot()||++tries>120)clearInterval(t);},50);
  }
})();

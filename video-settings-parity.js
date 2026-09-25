/* KOSMIC KAT — canonical Video ecosystem loader
 * The Video module is owned by Video Canvas V3. This file intentionally does
 * not load legacy Video Canvas, Seedance parity, request bridges, or DOM repair
 * layers. Shared catalog/pricing scripts remain available to the rest of the app.
 */
(function installCanonicalVideoEcosystem(){
  "use strict";
  if(window.__kosmicCanonicalVideoEcosystem)return;
  window.__kosmicCanonicalVideoEcosystem=true;

  const loadCss=(href,attr,value)=>{
    if(document.querySelector(`link[${attr}="${value}"]`))return;
    const css=document.createElement("link");
    css.rel="stylesheet";css.href=href;css.setAttribute(attr,value);
    document.head.appendChild(css);
  };
  loadCss("ui-v2-phase8.css","data-kosmic-ui-v2-phase","8");
  loadCss("ui-v2-settings-immune.css","data-kosmic-settings-immune","1");
  loadCss("ui-v2-layer-arbiter.css","data-kosmic-layer-arbiter","1");
  loadCss("ui-v2-evolink-route.css","data-kosmic-evolink-route-ui","1");
  loadCss("ui-v2-home-premium.css","data-kosmic-home-premium-v2","1");

  const loadScript=(src,marker,callback)=>{
    const existing=document.querySelector(`script[${marker}="1"]`);
    if(existing){if(callback)setTimeout(callback,0);return;}
    const s=document.createElement("script");
    s.src=src;s.async=false;s.setAttribute(marker,"1");
    if(callback)s.onload=callback;
    document.head.appendChild(s);
  };

  loadScript("home-models-current.js","data-kosmic-home-models-current");
  loadScript("home-premium-v2.js","data-kosmic-home-premium-v2");
  loadScript("evolink-video.js","data-kosmic-evo-video-canonical",()=>{
    loadScript("evolink-video-current.js","data-kosmic-evo-video-current",()=>{
      loadScript("evolink-video-expansion.js","data-kosmic-evo-video-expansion",()=>{
        loadScript("evolink-video-integrity.js","data-kosmic-evo-video-integrity",()=>{
          loadScript("evolink-video-pricing.js","data-kosmic-evo-video-pricing");
        });
      });
    });
  });
  loadScript("settings-layer-guard.js","data-kosmic-settings-layer-guard");
})();
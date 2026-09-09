/* KOSMIC KAT — Video Settings parity + deterministic ecosystem loaders
 * Keeps settings in a document-level layer and loads the existing Video Canvas
 * integration stack without creating a second playground.
 */
(function installVideoSettingsParity(){
  "use strict";
  if(window.__kosmicVideoSettingsParity)return;
  window.__kosmicVideoSettingsParity=true;

  const loadCss=(href,attr,value)=>{
    if(document.querySelector(`link[${attr}="${value}"]`))return;
    const css=document.createElement("link");css.rel="stylesheet";css.href=href;css.setAttribute(attr,value);document.head.appendChild(css);
  };
  loadCss("ui-v2-phase8.css","data-kosmic-ui-v2-phase","8");
  loadCss("ui-v2-settings-immune.css","data-kosmic-settings-immune","1");
  loadCss("ui-v2-layer-arbiter.css","data-kosmic-layer-arbiter","1");
  loadCss("ui-v2-evolink-route.css","data-kosmic-evolink-route-ui","1");
  loadCss("ui-v2-home-premium.css","data-kosmic-home-premium-v2","1");

  const loadScript=(src,marker,callback)=>{
    const existing=document.querySelector(`script[${marker}=""]`);
    if(existing){if(callback)setTimeout(callback,0);return;}
    const s=document.createElement("script");s.src=src;s.async=false;s.setAttribute(marker,"");
    if(callback)s.onload=callback;document.head.appendChild(s);
  };

  loadScript("home-models-current.js","data-kosmic-home-models-current");
  loadScript("home-premium-v2.js","data-kosmic-home-premium-v2");
  loadScript("evolink-video.js","data-kosmic-evo-video",()=>{
    loadScript("evolink-video-current.js","data-kosmic-evo-video-current",()=>{
      loadScript("evolink-video-expansion.js","data-kosmic-evo-video-expansion",()=>{
        loadScript("evolink-video-integrity.js","data-kosmic-evo-video-integrity",()=>{
          loadScript("evolink-video-pricing.js","data-kosmic-evo-video-pricing",()=>{
            loadScript("evolink-video-adapter-fallback.js","data-kosmic-evo-video-adapter-fallback",()=>{
              loadScript("evolink-video-safety.js","data-kosmic-evo-video-safety",()=>{
                loadScript("evolink-video-canvas-adapter.js","data-kosmic-evo-video-canvas-adapter",()=>{
                  loadScript("evolink-video-final-guard.js","data-kosmic-evo-video-final-guard",()=>{
                    loadScript("evolink-video-route-hud.js","data-kosmic-evo-video-route-hud");
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  loadScript("settings-layer-guard.js","data-kosmic-settings-layer-guard");

  function parityToggle(){
    const panel=document.getElementById("vcSettingsPanel");
    const backdrop=document.getElementById("vcSettingsBackdrop");
    if(backdrop&&backdrop.parentElement!==document.body)document.body.appendChild(backdrop);
    if(panel&&panel.parentElement!==document.body)document.body.appendChild(panel);
    return window.__kosmicOriginalToggleVcSettings.apply(this,arguments);
  }
  const install=()=>{
    const fn=window.toggleVcSettings;
    if(typeof fn!=="function"||fn.__kosmicVideoParityWrapped)return false;
    if(window.__kosmicOriginalToggleVcSettings)return true;
    window.__kosmicOriginalToggleVcSettings=fn;
    parityToggle.__kosmicVideoParityWrapped=true;
    parityToggle.__kosmicOriginal=fn;
    window.toggleVcSettings=parityToggle;
    return true;
  };
  if(!install()){
    let tries=0;const timer=setInterval(()=>{if(install()||++tries>60)clearInterval(timer);},50);
  }
})();

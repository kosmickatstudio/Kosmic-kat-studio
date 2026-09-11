/* KOSMIC KAT — canonical Video Canvas V2 loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV2Loader)return;
  window.__kosmicVideoCanvasV2Loader=true;

  /* Video Canvas V2 owns the playground. The Settings surface below is also
   * V2-owned; only the shared layer guard/CSS are reused for the sheet shell. */
  const loadCss=(href,marker,next)=>{
    const q=`link[${marker}="1"]`,old=document.querySelector(q);
    if(old){next&&next();return;}
    const link=document.createElement("link");link.rel="stylesheet";link.href=href;link.async=false;link.setAttribute(marker,"1");
    if(next)link.onload=next;
    document.head.appendChild(link);
  };
  const load=(src,marker,next)=>{
    const q=`script[${marker}="1"]`,old=document.querySelector(q);
    if(old){next&&next();return;}
    const s=document.createElement("script");s.src=src;s.async=false;s.setAttribute(marker,"1");
    if(next)s.onload=next;
    document.head.appendChild(s);
  };

  loadCss("ui-v2-settings-fix.css","data-kosmic-settings-fix-v2",()=>
    loadCss("ui-v2-settings-immune.css","data-kosmic-settings-immune-v2",()=>
      loadCss("ui-v2-layer-arbiter.css","data-kosmic-layer-arbiter-v2",()=>
        load("settings-layer-guard.js","data-kosmic-settings-layer-guard-v2",()=>
          load("evolink-video.js","data-kosmic-evo-v2-catalog",()=>
            load("evolink-video-current.js","data-kosmic-evo-v2-current",()=>
              load("evolink-video-expansion.js","data-kosmic-evo-v2-expansion",()=>
                load("evolink-video-integrity.js","data-kosmic-evo-v2-integrity",()=>
                  load("evolink-video-pricing.js","data-kosmic-evo-v2-pricing",()=>
                    load("video-canvas-v2.js","data-kosmic-video-v2",()=>
                      load("video-canvas-v2-state-fix.js","data-kosmic-video-v2-state-fix",()=>
                        load("video-canvas-v2-settings.js","data-kosmic-video-v2-settings",()=>
                          load("video-canvas-v2-settings-debounce.js","data-kosmic-video-v2-settings-debounce")
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
})();

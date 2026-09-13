/* KOSMIC KAT — canonical Video Canvas loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV3Loader)return;
  window.__kosmicVideoCanvasV3Loader=true;
  const V="20260914-chat7";

  const load=(src,marker,next)=>{
    const q=`script[${marker}="1"]`,old=document.querySelector(q);
    if(old){next&&next();return;}
    const s=document.createElement("script");
    s.src=`${src}?v=${V}`;s.async=false;s.setAttribute(marker,"1");
    if(next)s.onload=next;
    s.onerror=()=>console.error(`Kosmic Video loader failed: ${src}`);
    document.head.appendChild(s);
  };

  /* Global Settings remains the sole owner of API credentials/API slots. */
  const loadStack=()=>{
    if(window.__kosmicVideoStackLoaded||window.__kosmicVideoStackLoading)return;
    window.__kosmicVideoStackLoading=true;
    load("evolink-video.js","data-kosmic-evo-v3-catalog",()=>
      load("evolink-video-current.js","data-kosmic-evo-v3-current",()=>
        load("evolink-video-expansion.js","data-kosmic-evo-v3-expansion",()=>
          load("evolink-video-integrity.js","data-kosmic-evo-v3-integrity",()=>
            load("evolink-video-pricing.js","data-kosmic-evo-v3-pricing",()=>
              load("video-canvas-v3.js","data-kosmic-video-v3",()=>
                load("video-chat-state.js","data-kosmic-video-chat-state",()=>
                  load("video-chat-shell.js","data-kosmic-video-chat-shell",()=>
                    load("video-chat-generation.js","data-kosmic-video-chat-generation",()=>
                      load("video-chat-director.js","data-kosmic-video-chat-director",()=>
                        load("video-chat-primary.js","data-kosmic-video-chat-primary",()=>
                          load("video-v3-interaction-hardening.js","data-kosmic-video-v3-hardening",()=>
                            load("video-chat-safety.js","data-kosmic-video-safety",()=>
                              load("video-v3-ux-fixes.js","data-kosmic-video-v3-ux-fixes",()=>{
                                window.__kosmicVideoStackLoaded=true;
                                window.__kosmicVideoStackLoading=false;
                              })
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
      )
    );
  };

  window.__kosmicEnsureVideoStack=loadStack;

  function videoActive(){
    return window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  }

  function hookSwitch(){
    if(typeof window.switchMod!=="function"||window.switchMod.__kosmicVideoLazyHook)return;
    const original=window.switchMod;
    const wrapped=function(mod,el){
      const out=original.apply(this,arguments);
      if(String(mod)==="videocanvas")loadStack();
      return out;
    };
    wrapped.__kosmicVideoLazyHook=true;
    wrapped.__kosmicVideoOriginal=original;
    window.switchMod=wrapped;
  }

  hookSwitch();
  const hookTimer=setInterval(()=>{
    hookSwitch();
    if(videoActive())loadStack();
    if(window.__kosmicVideoStackLoaded)clearInterval(hookTimer);
  },150);

  document.addEventListener("click",e=>{
    const target=e.target?.closest?.('.mod-btn[data-mod="videocanvas"]');
    if(target)loadStack();
  },true);
})();

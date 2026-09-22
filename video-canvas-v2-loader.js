/* KOSMIC KAT — canonical Video Canvas loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV3Loader)return;
  window.__kosmicVideoCanvasV3Loader=true;
  const V="20260922-gallery-assets-stable-4";

  const videoActive=()=>window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  const markV3Pending=()=>document.documentElement.classList.add("kk-video-v3-pending");
  const clearV3Pending=()=>document.documentElement.classList.remove("kk-video-v3-pending");

  const load=(src,marker,next)=>{
    const q=`script[${marker}="1"]`,old=document.querySelector(q);
    const advance=()=>{
      if(videoActive()){next&&next();}
      else{clearV3Pending();window.__kosmicVideoStackLoading=false;}
    };
    if(old){advance();return;}
    const s=document.createElement("script");
    s.src=`${src}?v=${V}`;s.async=false;s.setAttribute(marker,"1");
    if(next)s.onload=advance;
    s.onerror=()=>{clearV3Pending();window.__kosmicVideoStackLoading=false;console.error(`Kosmic Video loader failed: ${src}`);};
    document.head.appendChild(s);
  };

  const loadStack=()=>{
    if(!videoActive())return false;
    markV3Pending();
    if(window.__kosmicVideoStackLoaded||window.__kosmicVideoStackLoading)return true;
    window.__kosmicVideoStackLoading=true;
    load("evolink-video-compat-fix.js","data-kosmic-evo-v3-compat",()=>
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
                                load("video-v3-ux-fixes.js","data-kosmic-video-v3-ux-fixes",()=>
                                  load("video-v3-final-fixes.js","data-kosmic-video-v3-final-fixes",()=>
                                    load("video-canvas-mobile-upload-fix-v2.js","data-kosmic-video-mobile-upload-fix-v2",()=>{
                                        window.__kosmicVideoStackLoaded=true;
                                        window.__kosmicVideoStackLoading=false;
                                        clearV3Pending();
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
          )
        )
      )
    );
    return true;
  };

  window.__kosmicEnsureVideoStack=loadStack;

  function hookSwitch(){
    if(typeof window.switchMod!=="function"||window.switchMod.__kosmicVideoLazyHook)return;
    const original=window.switchMod;
    const wrapped=function(mod,el){
      const isVideo=String(mod)==="videocanvas";
      if(isVideo)markV3Pending();else clearV3Pending();
      const out=original.apply(this,arguments);
      if(isVideo)loadStack();
      else if(window.__kosmicVideoStackLoading&&!videoActive()){window.__kosmicVideoStackLoading=false;clearV3Pending();}
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
    if(window.__kosmicVideoStackLoaded||(!videoActive()&&!window.__kosmicVideoStackLoading))clearInterval(hookTimer);
  },150);

  document.addEventListener("click",e=>{
    const target=e.target?.closest?.('.mod-btn[data-mod="videocanvas"]');
    if(target){markV3Pending();loadStack();}
  },true);
})();

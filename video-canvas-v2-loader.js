/* KOSMIC KAT — canonical Video Canvas loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV3Loader)return;
  window.__kosmicVideoCanvasV3Loader=true;

  const load=(src,marker,next)=>{
    const q=`script[${marker}="1"]`,old=document.querySelector(q);
    if(old){next&&next();return;}
    const s=document.createElement("script");
    s.src=src;s.async=false;s.setAttribute(marker,"1");
    if(next)s.onload=next;
    document.head.appendChild(s);
  };

  /* The app already owns API keys and API slots in its global Settings.
   * Video Canvas does not create, replace, or duplicate that system. */
  load("evolink-video.js","data-kosmic-evo-v3-catalog",()=>
    load("evolink-video-current.js","data-kosmic-evo-v3-current",()=>
      load("evolink-video-expansion.js","data-kosmic-evo-v3-expansion",()=>
        load("evolink-video-integrity.js","data-kosmic-evo-v3-integrity",()=>
          load("evolink-video-pricing.js","data-kosmic-evo-v3-pricing",()=>
            load("video-canvas-v3.js","data-kosmic-video-v3",()=>
              load("video-chat-state.js","data-kosmic-video-chat-state",()=>
                load("video-chat-shell.js","data-kosmic-video-chat-shell",()=>
                  load("video-chat-generation.js","data-kosmic-video-chat-generation")
                )
              )
            )
          )
        )
      )
    )
  );
})();

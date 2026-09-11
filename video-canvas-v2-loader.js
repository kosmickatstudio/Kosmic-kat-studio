/* KOSMIC KAT — canonical Video Canvas V2 loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV2Loader)return;
  window.__kosmicVideoCanvasV2Loader=true;
  const load=(src,marker,next)=>{
    const q=`script[${marker}="1"]`,old=document.querySelector(q);
    if(old){next&&next();return;}
    const s=document.createElement("script");s.src=src;s.async=false;s.setAttribute(marker,"1");
    if(next)s.onload=next;
    document.head.appendChild(s);
  };
  load("evolink-video.js","data-kosmic-evo-v2-catalog",()=>
    load("evolink-video-current.js","data-kosmic-evo-v2-current",()=>
      load("evolink-video-expansion.js","data-kosmic-evo-v2-expansion",()=>
        load("evolink-video-integrity.js","data-kosmic-evo-v2-integrity",()=>
          load("evolink-video-pricing.js","data-kosmic-evo-v2-pricing",()=>
            load("video-canvas-v2.js","data-kosmic-video-v2")
          )
        )
      )
    )
  );
})();

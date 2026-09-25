/* KOSMIC KAT — canonical Video Canvas V3 loader */
(function(){
  "use strict";
  if(window.__kosmicVideoCanvasV3Loader)return;
  window.__kosmicVideoCanvasV3Loader=true;
  const VERSION="20260925-v3-video-cleanup-3";
  const videoActive=()=>window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  const markPending=()=>document.documentElement.classList.add("kk-video-v3-pending");
  const clearPending=()=>document.documentElement.classList.remove("kk-video-v3-pending");

  function loadScript(src,marker){
    const existing=document.querySelector(`script[${marker}="1"]`);
    if(existing)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=`${src}?v=${VERSION}`;
      s.async=false;
      s.setAttribute(marker,"1");
      s.onload=resolve;
      s.onerror=()=>reject(new Error("Kosmic Video loader failed: "+src));
      document.head.appendChild(s);
    });
  }

  let stackPromise=null;
  async function loadStack(){
    if(!videoActive())return false;
    markPending();
    if(stackPromise)return true;
    if(window.__kosmicVideoStackLoaded){clearPending();return true;}
    stackPromise=(async()=>{
      try{
        const stack=[
          ["evolink-video-compat-fix.js","data-kosmic-evo-v3-compat"],
          ["evolink-video.js","data-kosmic-evo-v3-catalog"],
          ["evolink-video-current.js","data-kosmic-evo-v3-current"],
          ["evolink-video-expansion.js","data-kosmic-evo-v3-expansion"],
          ["evolink-video-integrity.js","data-kosmic-evo-v3-integrity"],
          ["evolink-video-pricing.js","data-kosmic-evo-v3-pricing"],
          ["video-canvas-v3.js","data-kosmic-video-v3"],
          ["video-v3-safety.js","data-kosmic-video-v3-safety"],
          ["video-v3-support.js","data-kosmic-video-v3-support"]
        ];
        for(const [src,marker] of stack){
          await loadScript(src,marker);
          if(src==="video-canvas-v3.js")window.__kosmicMountVideoCanvasV3?.();
        }
        window.__kosmicVideoStackLoaded=true;
        return true;
      }catch(err){
        console.error(err);
        return false;
      }finally{
        window.__kosmicVideoStackLoading=false;
        clearPending();
      }
    })();
    window.__kosmicVideoStackLoading=true;
    await stackPromise;
    return true;
  }

  window.__kosmicEnsureVideoStack=loadStack;

  function hookSwitch(){
    if(typeof window.switchMod!=="function"||window.switchMod.__kosmicVideoLazyHook)return;
    const original=window.switchMod;
    const wrapped=function(mod,el){
      const isVideo=String(mod)==="videocanvas";
      if(isVideo)markPending();else clearPending();
      const out=original.apply(this,arguments);
      if(isVideo)loadStack();
      else if(window.__kosmicVideoStackLoading&&!videoActive()){window.__kosmicVideoStackLoading=false;clearPending();}
      return out;
    };
    wrapped.__kosmicVideoLazyHook=true;
    wrapped.__kosmicVideoOriginal=original;
    window.switchMod=wrapped;
  }

  hookSwitch();
  const timer=setInterval(()=>{
    hookSwitch();
    if(videoActive())loadStack();
    if(window.__kosmicVideoStackLoaded)clearInterval(timer);
  },150);

  document.addEventListener("click",e=>{
    if(e.target?.closest?.('.mod-btn[data-mod="videocanvas"]')){markPending();loadStack();}
  },true);
})();
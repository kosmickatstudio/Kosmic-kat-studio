/* KOSMIC KAT — V2 settings click de-duplication
 * Guards the V2 settings toggle against the legacy inline onclick plus the
 * temporary compatibility listener that may already exist in a live page.
 */
(function installVideoCanvasV2SettingsDebounce(){
  "use strict";
  if(window.__kosmicVideoCanvasV2SettingsDebounce)return;
  window.__kosmicVideoCanvasV2SettingsDebounce=true;
  const install=()=>{
    const fn=window.toggleVcSettings;
    if(typeof fn!=="function"||fn.__kosmicV2Debounced)return false;
    let last=0;
    const wrapped=function(){
      const now=performance.now();
      if(now-last<80)return;
      last=now;
      return fn.apply(this,arguments);
    };
    wrapped.__kosmicV2Debounced=true;
    wrapped.__kosmicV2Original=fn;
    window.toggleVcSettings=wrapped;
    return true;
  };
  let n=0;
  const timer=setInterval(()=>{if(install()||++n>120)clearInterval(timer);},50);
  install();
})();

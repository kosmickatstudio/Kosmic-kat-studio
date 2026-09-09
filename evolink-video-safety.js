/* KOSMIC KAT — EvoLink route safety guard
 * Prevents specialized EvoLink routes from being swallowed by the generic
 * genViaFal bridge. Specialized endpoints keep their native/app-specific
 * generation path; generic T2V/I2V/R2V/edit/extend routes may use the unified
 * EvoLink adapter.
 */
(function installEvoLinkRouteSafety(){
  "use strict";
  if(window.__kosmicEvoLinkRouteSafetyInstalled)return;
  window.__kosmicEvoLinkRouteSafetyInstalled=true;

  const SPECIALIZED=new Set([
    "topaz-video-upscale",
    "kling-v3-motion-control",
    "omnihuman-1.5"
  ]);

  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    const fn=window.genViaFal;
    if(!api||typeof fn!=="function")return false;
    if(fn.__kosmicEvoSafetyWrapped)return true;

    const bridge=fn;
    const native=bridge.__kosmicOriginal || bridge;
    const safe=async function(){
      const args=[...arguments];
      const model=args[2];
      if(SPECIALIZED.has(model))return native.apply(this,args);
      return bridge.apply(this,args);
    };
    safe.__kosmicEvoSafetyWrapped=true;
    safe.__kosmicOriginal=bridge;
    safe.__kosmicEvoSpecialized=Array.from(SPECIALIZED);
    window.genViaFal=safe;
    api.specializedRoutes=Array.from(SPECIALIZED);
    api.isGenericRoute=id=>!!api.index?.[id]&&!SPECIALIZED.has(id);
    return true;
  };

  if(!boot()){
    let tries=0;
    const timer=setInterval(()=>{if(boot()||++tries>120)clearInterval(timer);},50);
  }
})();

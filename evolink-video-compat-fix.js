/* KOSMIC KAT — EvoLink video DOM compatibility shim
 * The native HTMLSelectElement exposes .options, but HTMLOptGroupElement
 * does not consistently expose an iterable .options collection. The legacy
 * EvoLink enhancer expects one, so normalize that tiny DOM contract here
 * before its scheduled enhancer runs.
 */
(function installKosmicEvoVideoCompat(){
  "use strict";
  if(window.__kosmicEvoVideoCompatFix)return;
  window.__kosmicEvoVideoCompatFix=true;
  try{
    const proto=window.HTMLOptGroupElement?.prototype;
    if(!proto)return;
    const desc=Object.getOwnPropertyDescriptor(proto,"options");
    const sample=desc?.get?Object.create(proto):null;
    let needsFix=!desc;
    if(desc?.get&&sample){
      try{needsFix=!Symbol.iterator||!(sample.options&&typeof sample.options[Symbol.iterator]==="function");}catch(_){needsFix=true;}
    }
    if(needsFix){
      Object.defineProperty(proto,"options",{
        configurable:true,
        enumerable:false,
        get(){return this.querySelectorAll("option");}
      });
    }
  }catch(err){console.warn("Kosmic EvoLink optgroup compatibility shim skipped",err);}
})();

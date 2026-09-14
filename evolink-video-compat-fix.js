/* KOSMIC KAT — EvoLink video DOM compatibility shim
 * The legacy EvoLink enhancer iterates optgroup.options even though option
 * groups do not expose the same .options collection as HTMLSelectElement in
 * all browsers. Normalize that small DOM contract before the enhancer timers.
 */
(function installKosmicEvoVideoCompat(){
  "use strict";
  if(window.__kosmicEvoVideoCompatFix)return;

  function install(proto){
    if(!proto)return false;
    try{
      const own=Object.getOwnPropertyDescriptor(proto,"options");
      if(own?.get)return true;
      Object.defineProperty(proto,"options",{
        configurable:true,
        enumerable:false,
        get(){return this?.tagName==="OPTGROUP"?this.querySelectorAll("option"):undefined;}
      });
      return true;
    }catch(_){return false;}
  }

  if(install(window.HTMLOptGroupElement?.prototype)){
    window.__kosmicEvoVideoCompatFix=true;
    return;
  }

  try{
    const element=window.Element?.prototype;
    if(element){
      const current=Object.getOwnPropertyDescriptor(element,"options");
      if(!current||current.configurable){
        Object.defineProperty(element,"options",{
          configurable:true,
          enumerable:false,
          get(){return this?.tagName==="OPTGROUP"?this.querySelectorAll("option"):undefined;}
        });
      }
    }
  }catch(err){console.warn("Kosmic EvoLink optgroup compatibility fallback skipped",err);}

  window.__kosmicEvoVideoCompatFix=true;
})();

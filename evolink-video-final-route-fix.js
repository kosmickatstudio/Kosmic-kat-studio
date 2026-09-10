/* KOSMIC KAT — EvoLink final route normalization
 * Runs after the legacy/current/integrity layers so verified public route IDs
 * cannot be overwritten by an older alias later in the boot chain.
 */
(function installEvoLinkFinalRouteFix(){
  "use strict";
  if(window.__kosmicEvoFinalRouteFix)return;
  window.__kosmicEvoFinalRouteFix=true;

  function boot(){
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog)return false;
    const normalize=(cardId,oldId,newId,label)=>{
      const card=api.catalog.find(c=>c?.id===cardId);
      if(!card?.routes)return;
      card.routes=card.routes.map(r=>r?.id===oldId?Object.assign({},r,{id:newId,label:label||r.label}):r);
    };
    normalize("wan3.0-text-to-video","wan3.0-reference-to-video","wan3.0-reference-video","Reference to Video");
    normalize("wan2.6-text-to-video","wan2.6-reference-to-video","wan2.6-reference-video","Reference Video");
    const index={};
    api.catalog.forEach(card=>(card.routes||[]).forEach(route=>{if(route?.id)index[route.id]={model:card,...route};}));
    api.index=index;
    api.liveRouteCount=Object.keys(index).length;
    window.KOSMIC_EVOLINK_VIDEO=api;
    return true;
  }
  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>120)clearInterval(timer);},50);
  }
})();

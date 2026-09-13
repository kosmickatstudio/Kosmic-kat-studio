/* KOSMIC KAT — Video generation safety gate
 * Prevents accidental paid Seedance 2.5 requests, adds a browser-local
 * budget-cap guard, and keeps retired credential/provider UI out of Video.
 * This is a client-side safety layer only; provider credentials remain owned
 * by Global Settings and no secret is persisted here.
 */
(function installKosmicVideoSafety(){
  "use strict";
  if(window.__kosmicVideoSafetyInstalled)return;
  window.__kosmicVideoSafetyInstalled=true;

  const SEED25=new Set([
    "seedance-2.5-text-to-video",
    "seedance-2.5-image-to-video",
    "seedance-2.5-reference-to-video",
    "seedance-2.5-video-edit",
    "seedance-2.5-video-extend"
  ]);
  const ARM_TTL=30_000;
  let arm=null;

  function routeIsSeed25(id){return SEED25.has(String(id||""));}
  function currentRoute(){return String(window.__kosmicVideoV3State?.route||"");}
  function armGeneration(source){
    arm={source:String(source||"user"),expiresAt:Date.now()+ARM_TTL,id:"arm_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)};
    window.__kosmicVideoGenerationArm={source:arm.source,expiresAt:arm.expiresAt,id:arm.id};
    return arm;
  }
  function consumeArm(){
    const a=arm;
    if(!a||a.expiresAt<Date.now()){arm=null;window.__kosmicVideoGenerationArm=null;return false;}
    arm=null;window.__kosmicVideoGenerationArm=null;return true;
  }
  function eventIsTrusted(e){return !!e&&e.isTrusted===true;}
  function userAction(e){
    if(!eventIsTrusted(e))return;
    const t=e.target?.closest?.("#kkv3Generate,#kkvcSend");
    if(t)armGeneration(t.id||"video-generate");
  }
  function userKeyAction(e){
    if(!eventIsTrusted(e))return;
    if(e.key!=="Enter"&&e.key!==" ")return;
    const t=e.target?.closest?.("#kkv3Generate,#kkvcSend,#kkvcInput");
    if(t)armGeneration(t.id||"video-keyboard-generate");
  }
  function budgetAllows(){
    const cap=parseFloat(typeof gs==="function"?gs("budget_cap","0"):"0")||0;
    const spent=parseFloat(typeof gs==="function"?gs("total_spent","0"):"0")||0;
    if(cap>0&&spent>=cap)throw new Error(`Generation blocked: local budget cap of $${cap.toFixed(2)} has been reached. Review Costs before starting another paid generation.`);
  }
  function routeAllowed(model){
    if(!routeIsSeed25(model))return;
    if(!consumeArm())throw new Error("Generation blocked for safety: start the video generation from the visible Generate control. This prevents accidental or programmatic paid requests.");
    budgetAllows();
  }
  function guardAdapter(){
    const api=window.KOSMIC_EVOLINK_VIDEO,original=window.generateEvoLinkVideo;
    if(!api?.index||typeof original!=="function")return false;
    if(original.__kosmicPaidSafetyGuard)return true;
    const guarded=async function(model,prompt,options={}){
      routeAllowed(model);
      return original.apply(this,arguments);
    };
    guarded.__kosmicPaidSafetyGuard=true;
    guarded.__kosmicOriginal=original;
    window.generateEvoLinkVideo=guarded;
    return true;
  }
  function closeLegacyVideoUi(){
    ["vcSettingsPanel","vcSettingsBackdrop","kkv2SettingsSheet","kkv2SettingsBackdrop"].forEach(id=>{
      const el=document.getElementById(id);if(!el)return;
      el.classList.remove("open","active","show","is-open");
      if(el.hasAttribute("aria-hidden"))el.setAttribute("aria-hidden","true");
    });
    document.body.classList.remove("kkv2-settings-open");
  }
  function monitorLegacyUi(){
    closeLegacyVideoUi();
    const obs=new MutationObserver(()=>closeLegacyVideoUi());
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style","aria-hidden"]});
    window.__kosmicVideoSafetyObserver=obs;
  }
  function boot(){
    document.addEventListener("click",userAction,true);
    document.addEventListener("pointerdown",userAction,true);
    document.addEventListener("keydown",userKeyAction,true);
    monitorLegacyUi();
    if(!guardAdapter()){
      let tries=0;const timer=setInterval(()=>{if(guardAdapter()||++tries>240)clearInterval(timer);},50);
    }
    window.__kosmicVideoSafety={
      arm:source=>armGeneration(source||"manual"),
      disarm:()=>{arm=null;window.__kosmicVideoGenerationArm=null;},
      status:()=>({armed:!!arm&&arm.expiresAt>Date.now(),expiresAt:arm?.expiresAt||0,route:currentRoute()})
    };
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

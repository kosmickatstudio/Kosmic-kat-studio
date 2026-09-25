/* KOSMIC KAT — canonical Video generation safety gate */
(function(){
  "use strict";
  if(window.__kosmicVideoV3Safety)return;
  window.__kosmicVideoV3Safety=true;
  const SEED25=new Set(["seedance-2.5-text-to-video","seedance-2.5-image-to-video","seedance-2.5-reference-to-video","seedance-2.5-video-edit","seedance-2.5-video-extend"]);
  const isSeed=id=>SEED25.has(String(id||""));
  const currentRoute=()=>String(window.__kosmicVideoV3State?.route||"");
  const TTL=30000;let arm=null,inFlight=false;
  const armUser=e=>{
    if(!e?.isTrusted)return;
    const t=e.target?.closest?.("[data-stable-generate],#kkv3StoryboardGenerate");
    if(!t)return;
    const s=window.__kosmicVideoV3State;
    const count=t.id==="kkv3StoryboardGenerate"?Math.max(1,(s?.storyboard||[]).filter(x=>String(x?.prompt||"").trim()).length):1;
    arm={expiresAt:Date.now()+TTL,source:t.id||t.dataset?.stableGenerate||"generate",remaining:count};
  };
  const consume=()=>{
    if(!arm||arm.expiresAt<Date.now()){arm=null;return false;}
    arm.remaining=Math.max(0,(arm.remaining||1)-1);
    if(arm.remaining===0)arm=null;
    return true;
  };
  const budget=()=>{
    const cap=parseFloat(typeof gs==="function"?gs("budget_cap","0"):"0")||0;
    const spent=parseFloat(typeof gs==="function"?gs("total_spent","0"):"0")||0;
    if(cap>0&&spent>=cap)throw new Error("Generation blocked: local budget cap has been reached. Review Costs before starting another paid generation.");
  };
  const install=()=>{
    const original=window.generateEvoLinkVideo;if(typeof original!=="function")return false;
    if(original.__kosmicVideoV3SafetyGuard)return true;
    const guarded=async function(model,prompt,options={}){
      if(!isSeed(model))return original.apply(this,arguments);
      if(currentRoute()&&currentRoute()!==String(model)&&isSeed(currentRoute()))throw new Error("Generation blocked: the selected Seedance 2.5 route changed before the request started.");
      if(inFlight)throw new Error("Generation already in progress. Duplicate paid requests are blocked.");
      if(!consume())throw new Error("Generation blocked for safety: use the visible Generate control.");
      budget();inFlight=true;
      try{return await original.apply(this,arguments);}finally{inFlight=false;}
    };
    guarded.__kosmicVideoV3SafetyGuard=true;guarded.__kosmicOriginal=original;window.generateEvoLinkVideo=guarded;return true;
  };
  function boot(){
    document.addEventListener("click",armUser,true);document.addEventListener("pointerdown",armUser,true);
    let tries=0;const timer=setInterval(()=>{if(install()||++tries>240)clearInterval(timer);},50);
    window.__kosmicVideoSafety={status:()=>({armed:!!arm&&arm.expiresAt>Date.now(),expiresAt:arm?.expiresAt||0,remaining:arm?.remaining||0,route:currentRoute(),inFlight}),disarm:()=>{arm=null;}};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
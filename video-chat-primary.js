/* KOSMIC KAT — Video Chat Primary Bridge
 * Makes the conversational Video surface authoritative even when the legacy
 * router does not expose renderVideoCanvasV2(). It does not create a provider
 * endpoint, generation engine, or credential store.
 */
(function installKosmicVideoChatPrimaryBridge(){
  "use strict";
  if(window.__kosmicVideoChatPrimaryBridge)return;
  window.__kosmicVideoChatPrimaryBridge=true;

  let scheduled=false;
  let running=false;
  let compatibilityShimInstalled=false;

  const moduleHost=()=>document.getElementById("moduleContent")||document.querySelector(".module-content");
  const hasVideoCanvas=()=>!!document.querySelector("#kkVideoCanvasV3,.kkv3,#kkv3Generate");
  const hasChat=()=>!!document.getElementById("kkVideoChat");

  function installCompatibilityShim(){
    if(typeof window.renderVideoCanvasV2==="function")return false;
    window.renderVideoCanvasV2=function(){
      if(typeof window.__kosmicVideoChatBoot==="function")window.__kosmicVideoChatBoot();
    };
    compatibilityShimInstalled=true;
    return true;
  }

  function schedule(){
    if(scheduled||running)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;promote();},80);
  }

  function promote(){
    if(running||hasChat()||!hasVideoCanvas())return;
    const host=moduleHost();
    if(!host)return;
    running=true;
    try{
      installCompatibilityShim();
      if(typeof window.__kosmicVideoChatBoot==="function")window.__kosmicVideoChatBoot();
      if(typeof window.renderVideoCanvasV2==="function")window.renderVideoCanvasV2();
      setTimeout(()=>{
        if(!hasChat()&&hasVideoCanvas()&&typeof window.__kosmicVideoChatBoot==="function"){
          try{window.__kosmicVideoChatBoot();if(typeof window.renderVideoCanvasV2==="function")window.renderVideoCanvasV2();}
          catch(err){console.error("Kosmic Video Chat primary retry failed",err);}
        }
      },220);
    }catch(err){
      console.error("Kosmic Video Chat primary bridge failed",err);
    }finally{
      setTimeout(()=>{running=false;},300);
    }
  }

  function boot(){
    const target=moduleHost()||document.body;
    const observer=new MutationObserver(()=>{if(hasVideoCanvas()&&!hasChat())schedule();});
    observer.observe(target,{childList:true,subtree:true});
    window.__kosmicVideoChatPrimaryObserver=observer;
    schedule();
  }

  window.__kosmicVideoChatCompatibilityShim=()=>compatibilityShimInstalled;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

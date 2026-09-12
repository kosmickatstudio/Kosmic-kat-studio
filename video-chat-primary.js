/* KOSMIC KAT — Video Chat Primary Bridge
 * The chat shell owns the UI. This bridge makes it authoritative when
 * the existing Video Canvas renderer is mounted by the legacy module router.
 * It does not create a generation engine or a second credential system.
 */
(function installKosmicVideoChatPrimaryBridge(){
  "use strict";
  if(window.__kosmicVideoChatPrimaryBridge)return;
  window.__kosmicVideoChatPrimaryBridge=true;

  let scheduled=false;
  let running=false;

  const moduleHost=()=>document.getElementById("moduleContent")||document.querySelector(".module-content");
  const hasVideoCanvas=()=>!!document.querySelector("#kkVideoCanvasV3,.kkv3,#kkv3Generate");
  const hasChat=()=>!!document.getElementById("kkVideoChat");

  function schedule(){
    if(scheduled||running)return;
    scheduled=true;
    setTimeout(()=>{
      scheduled=false;
      promote();
    },80);
  }

  function promote(){
    if(running||hasChat()||!hasVideoCanvas())return;
    const host=moduleHost();
    if(!host)return;
    running=true;
    try{
      if(typeof window.__kosmicVideoChatBoot==="function")window.__kosmicVideoChatBoot();
      if(typeof window.renderVideoCanvasV2!=="function")return;
      window.renderVideoCanvasV2();
      setTimeout(()=>{
        if(!hasChat()&&hasVideoCanvas()&&typeof window.renderVideoCanvasV2==="function"){
          try{window.renderVideoCanvasV2();}catch(err){console.error("Kosmic Video Chat primary retry failed",err);}
        }
      },160);
    }catch(err){
      console.error("Kosmic Video Chat primary bridge failed",err);
    }finally{
      setTimeout(()=>{running=false;},240);
    }
  }

  function boot(){
    const target=moduleHost()||document.body;
    const observer=new MutationObserver(()=>{
      if(hasVideoCanvas()&&!hasChat())schedule();
    });
    observer.observe(target,{childList:true,subtree:true});
    window.__kosmicVideoChatPrimaryObserver=observer;
    schedule();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
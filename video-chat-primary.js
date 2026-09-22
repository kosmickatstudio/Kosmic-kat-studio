/* KOSMIC KAT — Video Chat Primary Bridge
 * Makes the conversational Video surface authoritative when Video Canvas V3
 * is present. No legacy Canvas/V2 compatibility layer is created here.
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
    setTimeout(()=>{scheduled=false;promote();},80);
  }

  function promote(){
    if(running||hasChat()||!hasVideoCanvas())return;
    if(!moduleHost())return;
    running=true;
    try{
      if(typeof window.__kosmicVideoChatBoot==="function")window.__kosmicVideoChatBoot();
      setTimeout(()=>{
        if(!hasChat()&&hasVideoCanvas()&&typeof window.__kosmicVideoChatBoot==="function"){
          try{window.__kosmicVideoChatBoot();}
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

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
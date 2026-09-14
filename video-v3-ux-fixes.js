/* KOSMIC KAT — Video V3 UX / lifecycle fixes
 * Single-prompt composer, settings-owned references, Gallery action,
 * and hard module-boundary cleanup. No provider/credential logic.
 *
 * This layer deliberately observes only the Video roots. It disconnects
 * before repairing those roots, preventing a mutation-feedback freeze.
 */
(function installKosmicVideoV3UxFixes(){
  "use strict";
  if(window.__kosmicVideoV3UxFixes)return;
  window.__kosmicVideoV3UxFixes=true;

  const $=id=>document.getElementById(id);
  const videoIsActive=()=>window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  const v3=()=>$("kkVideoCanvasV3");
  const chat=()=>$("kkVideoChat");
  let switchWrapped=false;
  let v3Observer=null;
  let chatObserver=null;

  function stopObservers(){
    try{v3Observer?.disconnect?.();}catch(_){ }
    try{chatObserver?.disconnect?.();}catch(_){ }
    v3Observer=null;chatObserver=null;
  }

  function cleanupOutsideVideo(){
    if(videoIsActive())return;
    stopObservers();
    $("kkVideoCanvasV3")?.remove();
    $("kkVideoChat")?.remove();
    $("kk-video-legacy-mount")?.remove();
    document.querySelectorAll("#vcSettingsPanel,#vcSettingsBackdrop").forEach(el=>{
      el.classList.remove("open","active","show","is-open");
      el.setAttribute("aria-hidden","true");
    });
    document.body.classList.remove("kkv2-settings-open");
    window.__kosmicVideoGenerationArm=null;
  }

  function bridgePrompt(){
    const input=$("kkvcInput"),v=window.__kosmicVideoV3State,q=window.__kosmicVideoChatState;
    if(!input||!v)return;
    if(!input.__kkSinglePromptBridge){
      input.__kkSinglePromptBridge=true;
      input.addEventListener("input",()=>{
        v.prompt=input.value||"";
        if(q){q.composerDraft=input.value||"";q.touch?.();q.syncLegacy?.();}
      });
    }
    const wanted=String(v.prompt||q?.composerDraft||"");
    if(document.activeElement!==input&&input.value!==wanted)input.value=wanted;
  }

  function removeDuplicatePrompt(){
    const input=$("kkv3Prompt");
    if(!input)return;
    const card=input.closest(".kkv3-card");
    if(card)card.remove();
  }

  function removeComposerReferencePlus(){
    $("kkvcAttach")?.remove();
    $("kkvcFile")?.remove();
    const meta=document.querySelector("#kkVideoChat .kkvc-meta");
    if(meta){
      const count=$("kkvcRefCount");
      const value=count?.textContent||"0";
      const desired=`<span><strong id="kkvcRefCount">${value}</strong> references managed in Director settings</span><span>Settings stay global • Director controls live separately</span>`;
      if(meta.innerHTML!==desired)meta.innerHTML=desired;
    }
  }

  function ensureGalleryAction(){
    const root=v3(),generate=$("kkv3Generate");
    if(!root||!generate)return;
    let row=generate.parentElement?.querySelector(".kkv3-generate-actions");
    if(!row){
      row=document.createElement("div");
      row.className="kkv3-generate-actions";
      row.style.cssText="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:10px";
      generate.parentElement?.insertBefore(row,generate);
      row.appendChild(generate);
    }
    let gallery=row.querySelector("[data-kosmic-video-gallery]");
    if(!gallery){
      gallery=document.createElement("button");
      gallery.type="button";
      gallery.className="kkv3-secondary";
      gallery.dataset.kosmicVideoGallery="1";
      gallery.textContent="Gallery";
      gallery.title="Open Gallery";
      gallery.setAttribute("aria-label","Open Gallery");
      gallery.addEventListener("click",()=>{
        const target=document.querySelector('[data-mod="gallery"]');
        if(typeof window.switchMod==="function")window.switchMod("gallery",target);
      });
      row.appendChild(gallery);
    }
  }

  function css(){
    if($("kk-video-v3-ux-fixes-css"))return;
    const s=document.createElement("style");s.id="kk-video-v3-ux-fixes-css";
    s.textContent=`
      #kkVideoCanvasV3 .kkv3-generate-actions{align-items:stretch}
      #kkVideoCanvasV3 .kkv3-generate-actions .kkv3-generate{margin-top:0!important}
      #kkVideoCanvasV3 .kkv3-generate-actions .kkv3-secondary{margin-top:0;height:100%;white-space:nowrap}
      #kkVideoChat .kkvc-textrow{gap:10px}
      #kkVideoChat .kkvc-input{min-width:0}
    `;
    document.head.appendChild(s);
  }

  function enforce(){
    if(!videoIsActive()){
      cleanupOutsideVideo();
      return;
    }
    bridgePrompt();
    removeDuplicatePrompt();
    removeComposerReferencePlus();
    ensureGalleryAction();
  }

  function watchRoot(root,type){
    if(!root)return;
    const target=type==="v3"?v3Observer:chatObserver;
    if(target)return;
    const observer=new MutationObserver(()=>{
      if(!videoIsActive())return;
      observer.disconnect();
      try{enforce();}finally{observer.observe(root,{childList:true,subtree:true});}
    });
    observer.observe(root,{childList:true,subtree:true});
    if(type==="v3")v3Observer=observer;else chatObserver=observer;
  }

  function refreshObservers(){
    if(!videoIsActive()){
      cleanupOutsideVideo();
      return;
    }
    enforce();
    watchRoot(v3(),"v3");
    watchRoot(chat(),"chat");
  }

  function wrapSwitchMod(){
    if(switchWrapped||typeof window.switchMod!=="function")return;
    const original=window.switchMod;
    window.switchMod=function(mod,el){
      const out=original.apply(this,arguments);
      if(String(mod)==="videocanvas"){
        window.__kosmicVideoModuleActive=true;
        [0,80,220,500].forEach(delay=>setTimeout(()=>refreshObservers(),delay));
      }else{
        window.__kosmicVideoModuleActive=false;
        cleanupOutsideVideo();
      }
      return out;
    };
    window.__kosmicVideoModuleOriginalSwitchMod=original;
    switchWrapped=true;
  }

  function boot(){
    css();
    wrapSwitchMod();
    refreshObservers();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();

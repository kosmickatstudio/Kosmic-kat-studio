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
        if(q){q.composerDraft=input.value||"";q.touch?.();q.syncV3?.();}
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

  function closeAssetPicker(){document.getElementById("kkv3AssetPicker")?.remove();}
  function assetKind(a){return String(a?.kind||a?.type||"").toLowerCase()==="video"?"videos":String(a?.kind||a?.type||"").toLowerCase()==="audio"?"audios":"images";}
  function assetUrl(a){return a?.data||a?.url||"";}
  function alreadyAttached(a){
    const st=window.__kosmicVideoV3State;if(!st)return false;
    const url=assetUrl(a);const k=assetKind(a);
    return !!url && st[k]?.some(x=>x.url===url);
  }
  function addAssetReference(a){
    const st=window.__kosmicVideoV3State;if(!st)return;
    const url=assetUrl(a);if(!url||alreadyAttached(a))return;
    const k=assetKind(a);
    const limits=(()=>{try{const r=window.KOSMIC_EVOLINK_VIDEO?.index?.[st.route]||{};return r?.schema?.refs||r?.refs||{images:30,videos:10,audios:10,total:50};}catch(_){return{images:30,videos:10,audios:10,total:50};}})();
    const total=(st.images?.length||0)+(st.videos?.length||0)+(st.audios?.length||0);
    if(total>=(Number(limits.total)||50)||(st[k]?.length||0)>=(Number(limits[k])||50)){toast("Reference limit reached for this route.","error");return;}
    st[k].push({url,name:a.name||"Asset reference"});
    closeAssetPicker();
    window.__kosmicVideoCanvasV3Render?.();
    toast("Asset added as a video reference.","success");
  }
  function openAssetPicker(){
    closeAssetPicker();
    const uploads=Array.isArray(window.S?.uploads)?window.S.uploads:[];
    const overlay=document.createElement("div");
    overlay.id="kkv3AssetPicker";
    overlay.className="kkv3-asset-picker";
    overlay.innerHTML=`
      <div class="kkv3-asset-picker-backdrop" data-close-assets="1"></div>
      <section class="kkv3-asset-picker-panel" role="dialog" aria-modal="true" aria-labelledby="kkv3AssetPickerTitle">
        <div class="kkv3-asset-picker-head">
          <div><h3 id="kkv3AssetPickerTitle">Upload from Assets</h3><p>Select an existing Asset Library file to use as a Video Canvas reference.</p></div>
          <button type="button" class="kkv3-asset-picker-close" data-close-assets="1" aria-label="Close">×</button>
        </div>
        <div class="kkv3-asset-picker-list">
          ${uploads.length?uploads.map((a,i)=>{
            const url=assetUrl(a);const kind=String(a.kind||a.type||"").toLowerCase();const label=String(a.name||"Asset "+(i+1));const added=alreadyAttached(a);
            const media=kind==="video"?`<video src="${url}" muted playsinline></video>`:kind==="audio"?`<div class="kkv3-asset-picker-audio">🎧</div>`:`<img src="${url}" alt="">`;
            return `<button type="button" class="kkv3-asset-picker-item ${added?"is-added":""}" data-asset-index="${i}" ${added?"disabled":""}>
              <span class="kkv3-asset-picker-thumb">${media}</span>
              <span class="kkv3-asset-picker-copy"><b>${String(label).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}</b><small>${kind||"image"} ${added?"• already attached":""}</small></span>
              <span class="kkv3-asset-picker-add">${added?"✓":"Add"}</span>
            </button>`;
          }).join(""):`<div class="kkv3-asset-picker-empty">No uploaded assets yet. Open Asset Library to upload files first.</div>`}
        </div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click",e=>{
      if(e.target.closest("[data-close-assets]")){closeAssetPicker();return;}
      const item=e.target.closest("[data-asset-index]");if(!item)return;
      const asset=uploads[Number(item.dataset.assetIndex)];if(asset)addAssetReference(asset);
    });
  }
  function ensureActionRow(){
    const root=v3(),generate=$("kkv3Generate");if(!root||!generate)return;
    const parent=generate.parentElement;if(!parent)return;
    let stable=parent.querySelector(":scope>.kkv3-stable-actions");
    if(stable)return;
    parent.querySelectorAll(":scope>.kkv3-generate-actions,:scope>.kkv3-final-actions").forEach(x=>x.remove());
    root.querySelectorAll(".kkv3-final-gallery,[data-kosmic-video-gallery]").forEach(x=>x.closest(".kkv3-stable-actions")||x.remove());
    stable=document.createElement("div");
    stable.className="kkv3-stable-actions";
    stable.innerHTML=`
      <button type="button" class="kkv3-generate" data-stable-generate>Generate video</button>
      <button type="button" class="kkv3-secondary" data-kosmic-video-gallery aria-label="Open Gallery">Gallery</button>
      <button type="button" class="kkv3-secondary" data-kosmic-video-assets aria-label="Upload from Assets">Upload from Assets</button>`;
    const originalLabel=generate.textContent||"Generate video",disabled=!!generate.disabled;
    const replacement=stable.querySelector("[data-stable-generate]");
    replacement.textContent=originalLabel;replacement.disabled=disabled;
    replacement.className=generate.className;
    replacement.style.cssText=generate.getAttribute("style")||"";
    replacement.addEventListener("click",()=>generate.click());
    stable.querySelector("[data-kosmic-video-gallery]").addEventListener("click",()=>{
      const target=document.querySelector('.mod-btn[data-mod="gallery"]');
      if(typeof window.switchMod==="function")window.switchMod("gallery",target);
    });
    stable.querySelector("[data-kosmic-video-assets]").addEventListener("click",openAssetPicker);
    parent.insertBefore(stable,generate);
    generate.style.display="none";
  }

  function css(){
    if($("kk-video-v3-ux-fixes-css"))return;
    const s=document.createElement("style");s.id="kk-video-v3-ux-fixes-css";
    s.textContent=`
      #kkVideoCanvasV3 .kkv3-stable-actions{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;margin-top:10px;align-items:stretch}
      #kkVideoCanvasV3 .kkv3-stable-actions .kkv3-secondary{margin-top:0;height:100%;white-space:nowrap}
      .kkv3-asset-picker{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px}
      .kkv3-asset-picker-backdrop{position:absolute;inset:0;background:rgba(20,12,40,.36);backdrop-filter:blur(8px)}
      .kkv3-asset-picker-panel{position:relative;width:min(560px,100%);max-height:min(78vh,680px);overflow:hidden;border:1px solid var(--border,rgba(61,31,122,.14));border-radius:20px;background:var(--surface,#fff);box-shadow:0 24px 80px rgba(31,18,64,.28);display:flex;flex-direction:column}
      .kkv3-asset-picker-head{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:15px;border-bottom:1px solid var(--border,rgba(61,31,122,.09))}
      .kkv3-asset-picker-head h3{margin:0;font-size:14px;color:var(--violet,#3d1f7a)}
      .kkv3-asset-picker-head p{margin:4px 0 0;font-size:9px;color:var(--texts,#9488ae);line-height:1.4}
      .kkv3-asset-picker-close{width:32px;height:32px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:50%;background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);font-size:18px}
      .kkv3-asset-picker-list{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:7px}
      .kkv3-asset-picker-item{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:7px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:13px;background:var(--surface,#fff);text-align:left;color:var(--text,#1e1230)}
      .kkv3-asset-picker-item:hover:not(:disabled){border-color:rgba(98,64,176,.28);background:rgba(98,64,176,.035)}
      .kkv3-asset-picker-item.is-added{opacity:.58}
      .kkv3-asset-picker-thumb{width:54px;height:54px;border-radius:9px;overflow:hidden;background:var(--pearl2,#f3eff8);display:grid;place-items:center}
      .kkv3-asset-picker-thumb img,.kkv3-asset-picker-thumb video{width:100%;height:100%;object-fit:cover}
      .kkv3-asset-picker-audio{font-size:20px}
      .kkv3-asset-picker-copy{min-width:0;display:flex;flex-direction:column;gap:3px}
      .kkv3-asset-picker-copy b{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kkv3-asset-picker-copy small{font-size:8px;color:var(--texts,#9488ae)}
      .kkv3-asset-picker-add{font-size:9px;font-weight:850;color:var(--violet,#3d1f7a);padding:7px 9px;border-radius:9px;background:rgba(98,64,176,.08)}
      .kkv3-asset-picker-empty{padding:30px 12px;text-align:center;color:var(--texts,#9488ae);font-size:10px}
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
    ensureActionRow();
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
    window.__kosmicVideoOpenAssetPicker=openAssetPicker;
    css();
    wrapSwitchMod();
    refreshObservers();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();

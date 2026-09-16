/* KOSMIC KAT — Video Canvas mobile UX + browser upload final hardening
 * Runs after all existing V3/final guards. No provider routing or credential logic.
 */
(function installKosmicVideoCanvasMobileUploadFixV2(){
  "use strict";
  if(window.__kosmicVideoCanvasMobileUploadFixV2)return;
  window.__kosmicVideoCanvasMobileUploadFixV2=true;

  const $=id=>document.getElementById(id);
  const root=()=>$("kkVideoCanvasV3");
  const state=()=>window.__kosmicVideoV3State;
  const catalog=()=>window.KOSMIC_EVOLINK_VIDEO?.index||{};
  const currentRoute=()=>catalog()[state()?.route]||{};
  const mode=()=>{
    const r=currentRoute();
    const s=String(r?.mode||r?.id||"");
    if(s.includes("reference"))return "reference";
    if(s.includes("extend"))return "extend";
    if(s.includes("edit"))return "edit";
    if(s.includes("image"))return "image";
    return "text";
  };

  function css(){
    if($("kk-video-canvas-mobile-upload-fix-v2-css"))return;
    const s=document.createElement("style");
    s.id="kk-video-canvas-mobile-upload-fix-v2-css";
    s.textContent=`
      /* ---------- MOBILE: one continuous vertical surface ---------- */
      @media(max-width:920px){
        html,body{min-height:100%;}
        body:has(#kkVideoCanvasV3){overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;}
        #moduleContent:has(#kkVideoCanvasV3),.module-content:has(#kkVideoCanvasV3),.main-content:has(#kkVideoCanvasV3){
          height:auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;
          -webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;overscroll-behavior-y:auto!important;
        }
        .kkvc-director-host{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;}
        .kkvc-director-host>#kkVideoCanvasV3{height:auto!important;min-height:100%!important;max-height:none!important;overflow:visible!important;}
        #kkVideoCanvasV3>.kkv3{height:auto!important;min-height:100%!important;max-height:none!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-body{display:block!important;min-height:0!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-main,#kkVideoCanvasV3 .kkv3-side{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-side{border-top:1px solid var(--border,rgba(61,31,122,.08));}
        #kkVideoCanvasV3 .kkv3-mobile-scroll-cue-v2{display:flex;position:sticky;top:7px;z-index:40;justify-content:center;pointer-events:none;margin:-2px 0 -31px;}
        #kkVideoCanvasV3 .kkv3-mobile-scroll-cue-v2 span{font-size:8px;font-weight:850;letter-spacing:.02em;color:var(--textm,#5a4880);background:rgba(255,255,255,.92);border:1px solid var(--border,rgba(61,31,122,.12));box-shadow:0 5px 16px rgba(61,31,122,.08);border-radius:999px;padding:5px 9px;backdrop-filter:blur(8px);}
      }

      /* ---------- BROWSER UPLOADS: always visible in Video Canvas ---------- */
      #kkVideoCanvasV3 .kkv3-browser-refs-v2{margin-top:0;}
      #kkVideoCanvasV3 .kkv3-browser-ref-grid-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-v2{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;min-height:82px;border:1px dashed rgba(98,64,176,.28);border-radius:13px;background:linear-gradient(135deg,rgba(98,64,176,.045),rgba(74,169,217,.045));color:var(--textm,#5a4880);font-size:9px;font-weight:850;text-align:center;cursor:pointer;overflow:hidden;padding:9px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-v2 strong{display:block;font-size:9px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-v2 small{display:block;font-size:7px;color:var(--texts,#9488ae);font-weight:650;margin-top:3px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-v2 input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
      #kkVideoCanvasV3 .kkv3-browser-ref-v2:hover{border-color:rgba(98,64,176,.48);background:rgba(98,64,176,.065);}
      #kkVideoCanvasV3 .kkv3-browser-ref-status-v2{margin-top:8px;font-size:8px;color:var(--texts,#9488ae);line-height:1.45;}
      #kkVideoCanvasV3 .kkv3-browser-ref-count-v2{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-count-v2 span{font-size:7px;font-weight:800;color:#059669;background:rgba(16,185,129,.08);border-radius:999px;padding:3px 6px;}
      @media(max-width:620px){#kkVideoCanvasV3 .kkv3-browser-ref-grid-v2{grid-template-columns:1fr;}}

      /* Do not let the accidental text-only Gallery placeholders become four giant cards. */
      #kkVideoCanvasV3 .kkv3-rogue-gallery-v2{display:none!important;}
    `;
    document.head.appendChild(s);
  }

  function readFile(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result));
      r.onerror=reject;
      r.readAsDataURL(file);
    });
  }

  function videoDuration(url){
    return new Promise(resolve=>{
      const v=document.createElement("video");
      v.preload="metadata";
      v.onloadedmetadata=()=>resolve(Number.isFinite(v.duration)?v.duration:0);
      v.onerror=()=>resolve(0);
      v.src=url;
    });
  }

  async function addFiles(kind,files){
    const st=state();if(!st)return;
    const r=currentRoute();
    const lim=r?.schema?.refs||r?.refs||{images:30,videos:10,audios:10,total:50};
    for(const file of Array.from(files||[])){
      const total=st.images.length+st.videos.length+st.audios.length;
      if(total>=(Number(lim.total)||50))break;
      if(st[kind].length>=(Number(lim[kind])||50))break;
      try{
        const url=await readFile(file);
        const item={url,name:file.name};
        if(kind==="videos")item.duration=await videoDuration(url);
        st[kind].push(item);
      }catch(_){ }
    }
    refreshUploads();
  }

  function fileInputs(card){
    card.querySelectorAll("input[data-browser-ref-v2]").forEach(input=>{
      if(input.__kkBound)return;
      input.__kkBound=true;
      input.addEventListener("change",e=>{
        const kind=e.target.dataset.browserRefV2;
        const files=e.target.files;
        addFiles(kind,files);
        e.target.value="";
      });
    });
  }

  function uploadsHtml(){
    return `<section class="kkv3-card kkv3-browser-refs-v2"><h3>Reference uploads <span>From device / browser</span></h3><div class="kkv3-browser-ref-grid-v2">
      <label class="kkv3-browser-ref-v2">🖼<div><strong>Upload images</strong><small>JPG, PNG, WebP, GIF, etc. · multiple</small></div><input type="file" accept="image/*" multiple data-browser-ref-v2="images"></label>
      <label class="kkv3-browser-ref-v2">🎞<div><strong>Upload video</strong><small>MP4, WebM, MOV, etc. · multiple</small></div><input type="file" accept="video/*" multiple data-browser-ref-v2="videos"></label>
      <label class="kkv3-browser-ref-v2">🎧<div><strong>Upload audio</strong><small>MP3, WAV, M4A, etc. · multiple</small></div><input type="file" accept="audio/*" multiple data-browser-ref-v2="audios"></label>
    </div><div class="kkv3-browser-ref-status-v2">Select files directly from your browser. The existing generation adapter will use the supported media types for the selected route.</div><div class="kkv3-browser-ref-count-v2"><span data-ref-count="images">Images: 0</span><span data-ref-count="videos">Video: 0</span><span data-ref-count="audios">Audio: 0</span></div></section>`;
  }

  function installUploads(){
    const r=root();if(!r)return;
    let card=r.querySelector(".kkv3-browser-refs-v2");
    if(!card){
      card=document.createElement("div");
      card.innerHTML=uploadsHtml();
      const section=card.firstElementChild;
      const main=r.querySelector(".kkv3-main");
      if(!main)return;
      /* Put the upload controls near the end so they are reachable by scrolling. */
      main.appendChild(section);
      card=section;
    }
    fileInputs(card);
    refreshCounts(card);
  }

  function refreshCounts(card=root()?.querySelector(".kkv3-browser-refs-v2")){
    const st=state();if(!card||!st)return;
    card.querySelector('[data-ref-count="images"]')?.replaceChildren(document.createTextNode(`Images: ${st.images.length}`));
    card.querySelector('[data-ref-count="videos"]')?.replaceChildren(document.createTextNode(`Video: ${st.videos.length}`));
    card.querySelector('[data-ref-count="audios"]')?.replaceChildren(document.createTextNode(`Audio: ${st.audios.length}`));
  }

  function refreshUploads(){
    const r=root();if(!r)return;
    installUploads();
    refreshCounts();
  }

  function removeRogueGallery(){
    const r=root();if(!r)return;
    r.querySelectorAll(".kkv3-rogue-gallery-v2").forEach(el=>el.remove());
    r.querySelectorAll(".kkv3 .kkv3-card, .kkv3 .kkv3-stat, .kkv3 .kkv3-job, .kkv3 .kkv3-empty").forEach(el=>{
      if(el.closest(".kkv3-browser-refs-v2"))return;
      const text=String(el.textContent||"").trim();
      if(text!=="Gallery")return;
      /* Preserve the real Gallery action if it is a button. Remove text-only placeholders. */
      if(el.querySelector("button,input,textarea,select,video,audio"))return;
      el.classList.add("kkv3-rogue-gallery-v2");
    });
    r.querySelectorAll(".kkv3 *").forEach(el=>{
      if(el.children.length||el.matches("button,input,textarea,select,video,audio"))return;
      if(String(el.textContent||"").trim()!=="Gallery")return;
      if(el.parentElement?.closest("[data-kosmic-video-gallery],.kkv3-final-gallery"))return;
      el.classList.add("kkv3-rogue-gallery-v2");
    });
  }

  function installScrollCue(){
    const r=root();if(!r||r.querySelector(".kkv3-mobile-scroll-cue-v2"))return;
    const head=r.querySelector(".kkv3-head");if(!head)return;
    const cue=document.createElement("div");
    cue.className="kkv3-mobile-scroll-cue-v2";
    cue.innerHTML="<span>Swipe up to view all controls ↓</span>";
    head.insertAdjacentElement("afterend",cue);
    setTimeout(()=>cue.remove(),4500);
  }

  function observe(){
    if(window.__kosmicVideoCanvasMobileUploadFixV2Observer)return;
    const observer=new MutationObserver(()=>{
      if(window.__kosmicVideoCanvasMobileUploadFixV2Busy)return;
      window.__kosmicVideoCanvasMobileUploadFixV2Busy=true;
      requestAnimationFrame(()=>{
        try{css();removeRogueGallery();installUploads();installScrollCue();}
        finally{window.__kosmicVideoCanvasMobileUploadFixV2Busy=false;}
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.__kosmicVideoCanvasMobileUploadFixV2Observer=observer;
  }

  function boot(){
    css();
    removeRogueGallery();
    installUploads();
    installScrollCue();
    observe();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();

/* KOSMIC KAT — Video Canvas mobile scroll + browser reference upload hardening */
(function installKosmicVideoCanvasMobileUploadFix(){
  "use strict";
  if(window.__kosmicVideoCanvasMobileUploadFix)return;
  window.__kosmicVideoCanvasMobileUploadFix=true;

  const $=id=>document.getElementById(id);
  const root=()=>$("kkVideoCanvasV3");
  const state=()=>window.__kosmicVideoV3State;
  const catalog=()=>window.KOSMIC_EVOLINK_VIDEO?.index||{};
  const route=()=>catalog()[state()?.route]||{};
  const mode=()=>String(route()?.mode||route()?.id||"").includes("reference")?"reference":String(route()?.mode||route()?.id||"").includes("extend")?"extend":String(route()?.mode||route()?.id||"").includes("edit")?"edit":String(route()?.mode||route()?.id||"").includes("image")?"image":"text";

  function css(){
    if($("kk-video-canvas-mobile-upload-fix-css"))return;
    const s=document.createElement("style");
    s.id="kk-video-canvas-mobile-upload-fix-css";
    s.textContent=`
      /* Mobile: one natural vertical scroll surface. Do not trap the user in a
         fixed drawer with several nested scroll containers. */
      @media(max-width:920px){
        .kkvc-director-host{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;overscroll-behavior-y:auto!important;}
        .kkvc-director-host>#kkVideoCanvasV3{height:auto!important;min-height:100%!important;max-height:none!important;overflow:visible!important;}
        #kkVideoCanvasV3>.kkv3{height:auto!important;min-height:100%!important;max-height:none!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-body{display:block!important;min-height:0!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-main,#kkVideoCanvasV3 .kkv3-side{max-height:none!important;min-height:0!important;overflow:visible!important;}
        #kkVideoCanvasV3 .kkv3-side{border-top:1px solid var(--border,rgba(61,31,122,.08));}
        #kkVideoCanvasV3 .kkv3-mobile-scroll-cue{display:flex;position:sticky;top:8px;z-index:20;justify-content:center;pointer-events:none;margin:-2px 0 -30px;}
        #kkVideoCanvasV3 .kkv3-mobile-scroll-cue span{font-size:8px;font-weight:850;letter-spacing:.02em;color:var(--textm,#5a4880);background:rgba(255,255,255,.88);border:1px solid var(--border,rgba(61,31,122,.12));box-shadow:0 5px 16px rgba(61,31,122,.08);border-radius:999px;padding:5px 9px;backdrop-filter:blur(8px);}
      }
      @media(min-width:921px){#kkVideoCanvasV3 .kkv3-mobile-scroll-cue{display:none!important;}}
      #kkVideoCanvasV3 .kkv3-browser-refs{margin-top:12px;}
      #kkVideoCanvasV3 .kkv3-browser-ref-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
      #kkVideoCanvasV3 .kkv3-browser-ref{position:relative;display:flex;align-items:center;justify-content:center;min-height:72px;border:1px dashed rgba(98,64,176,.26);border-radius:13px;background:linear-gradient(135deg,rgba(98,64,176,.045),rgba(74,169,217,.045));color:var(--textm,#5a4880);font-size:9px;font-weight:850;text-align:center;cursor:pointer;overflow:hidden;}
      #kkVideoCanvasV3 .kkv3-browser-ref small{display:block;font-size:7px;color:var(--texts,#9488ae);font-weight:650;margin-top:3px;}
      #kkVideoCanvasV3 .kkv3-browser-ref input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
      #kkVideoCanvasV3 .kkv3-browser-ref[aria-disabled="true"]{opacity:.55;cursor:not-allowed;}
      #kkVideoCanvasV3 .kkv3-browser-ref-status{margin-top:7px;font-size:8px;color:var(--texts,#9488ae);line-height:1.4;}
      @media(max-width:620px){#kkVideoCanvasV3 .kkv3-browser-ref-grid{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(s);
  }

  function addBrowserRef(kind, files){
    const st=state(); if(!st)return;
    const list=Array.from(files||[]); if(!list.length)return;
    const limits=route()?.schema?.refs||route()?.refs||{images:30,videos:10,audios:10,total:50};
    const read=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});
    (async()=>{
      for(const file of list){
        const total=st.images.length+st.videos.length+st.audios.length;
        if(total>=(Number(limits.total)||50) || st[kind].length>=(Number(limits[kind])||50))break;
        try{
          const url=await read(file); const item={url,name:file.name};
          if(kind==="videos"){
            item.duration=await new Promise(resolve=>{const v=document.createElement("video");v.preload="metadata";v.onloadedmetadata=()=>resolve(Number.isFinite(v.duration)?v.duration:0);v.onerror=()=>resolve(0);v.src=url;});
          }
          st[kind].push(item);
        }catch(_){ }
      }
      document.dispatchEvent(new CustomEvent("kosmic:video-canvas-refresh"));
      installBrowserUploads();
    })();
  }

  function installBrowserUploads(){
    const r=root(); if(!r)return;
    let card=r.querySelector(".kkv3-browser-refs");
    if(!card){
      card=document.createElement("section");
      card.className="kkv3-card kkv3-browser-refs";
      card.innerHTML=`<h3>Reference uploads <span>From device</span></h3><div class="kkv3-browser-ref-grid">
        <label class="kkv3-browser-ref">🖼<div>Upload images<small>JPG, PNG, WebP, etc.</small></div><input type="file" accept="image/*" multiple data-browser-ref="images"></label>
        <label class="kkv3-browser-ref">🎞<div>Upload video<small>MP4, WebM, MOV, etc.</small></div><input type="file" accept="video/*" multiple data-browser-ref="videos"></label>
        <label class="kkv3-browser-ref">🎧<div>Upload audio<small>MP3, WAV, M4A, etc.</small></div><input type="file" accept="audio/*" multiple data-browser-ref="audios"></label>
      </div><div class="kkv3-browser-ref-status">Files are selected directly from your browser. Reference inputs are passed to the selected route when that route supports them.</div>`;
      const main=r.querySelector(".kkv3-main");
      const refs=r.querySelector("#kkv3Images,#kkv3Videos,#kkv3Audios")?.closest(".kkv3-card");
      if(refs)refs.insertAdjacentElement("afterend",card); else if(main)main.appendChild(card);
      r.querySelectorAll("[data-browser-ref]").forEach(input=>input.addEventListener("change",e=>{addBrowserRef(e.target.dataset.browserRef,e.target.files);e.target.value="";}));
    }
    const m=mode();
    card.querySelector(".kkv3-browser-ref-status").textContent = m==="reference"
      ? "Images, video and audio uploads are active for this multi-reference route."
      : m==="image" ? "Image upload is used by this image-to-video route; video/audio remain available for your workspace."
      : m==="edit"||m==="extend" ? "Video upload is used by this route; image/audio remain available for your workspace."
      : "Uploads stay in the Video Canvas workspace and are used when the selected route supports that media type.";
  }

  function cue(){
    const r=root();if(!r||r.querySelector(".kkv3-mobile-scroll-cue"))return;
    const h=r.querySelector(".kkv3-head");if(!h)return;
    const cue=document.createElement("div");cue.className="kkv3-mobile-scroll-cue";cue.innerHTML="<span>Swipe up to view all controls ↓</span>";
    h.insertAdjacentElement("afterend",cue);
    setTimeout(()=>cue.remove(),3500);
  }

  function scrubRogueGallery(){
    const r=root();if(!r)return;
    r.querySelectorAll(".kkv3, .kkv3 *").forEach(el=>{
      if(el===r||el.matches("button")||el.matches("input,textarea,select,video,audio"))return;
      if(el.querySelector("button,input,textarea,select,video,audio"))return;
      if(String(el.textContent||"").trim()!=="Gallery")return;
      const keep=el.closest("[data-kosmic-video-gallery],.kkv3-final-gallery");
      if(!keep)el.remove();
    });
  }

  function refresh(){css();scrubRogueGallery();installBrowserUploads();cue();}
  let scheduled=0;
  function schedule(){cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(refresh);}
  function boot(){schedule();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  const observer=new MutationObserver(()=>schedule());
  observer.observe(document.body,{childList:true,subtree:true});
})();

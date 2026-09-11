/* KOSMIC KAT — Video Director shutter
 * Phase 4: existing Video Canvas V3 is the advanced control layer.
 * This file only mounts/unmounts that existing V3 surface from the chat.
 * No provider request, credential UI, or duplicate settings surface is created here.
 */
(function installKosmicVideoDirector(){
  "use strict";
  if(window.__kosmicVideoDirectorInstalled)return;
  window.__kosmicVideoDirectorInstalled=true;

  const state=()=>window.__kosmicVideoChatState;
  let opened=false;
  let previousParent=null;
  let previousNext=null;
  let restoreFocus=null;

  function css(){
    if(document.getElementById("kk-video-director-css"))return;
    const s=document.createElement("style");s.id="kk-video-director-css";
    s.textContent=`
      .kkvc-director-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(31,18,48,.18);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);display:none}
      .kkvc-director-backdrop.open{display:block}
      .kkvc-director-drawer{position:absolute;top:12px;right:12px;bottom:12px;width:min(1120px,calc(100vw - 24px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.7);border-radius:24px;background:rgba(250,248,245,.94);box-shadow:0 28px 80px rgba(31,18,48,.24)}
      .kkvc-director-bar{height:54px;display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid rgba(61,31,122,.1);background:rgba(255,255,255,.58);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);flex:0 0 auto}
      .kkvc-director-mark{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff;font-size:14px}
      .kkvc-director-title{font-size:13px;font-weight:900;color:var(--text,#1e1230)}
      .kkvc-director-sub{font-size:8px;color:var(--texts,#9488ae);margin-top:2px}
      .kkvc-director-close{margin-left:auto;width:34px;height:34px;border:1px solid rgba(61,31,122,.1);border-radius:11px;background:rgba(255,255,255,.68);color:var(--textm,#5a4880);font-size:18px;line-height:1;cursor:pointer}
      .kkvc-director-host{min-height:0;flex:1;overflow:hidden}
      .kkvc-director-host>.kkv3,.kkvc-director-host>#kkVideoCanvasV3{width:100%;height:100%;min-height:0}
      @media(max-width:700px){
        .kkvc-director-drawer{inset:0;width:100%;height:100%;border-radius:0}
        .kkvc-director-bar{padding-top:calc(9px + env(safe-area-inset-top));height:calc(54px + env(safe-area-inset-top))}
        .kkvc-director-close{margin-right:2px}
      }
    `;
    document.head.appendChild(s);
  }

  function ensureUi(){
    if(document.getElementById("kkvcDirectorBackdrop"))return;
    const b=document.createElement("div");b.id="kkvcDirectorBackdrop";b.className="kkvc-director-backdrop";
    b.innerHTML=`<div class="kkvc-director-drawer" role="dialog" aria-modal="true" aria-labelledby="kkvcDirectorTitle"><div class="kkvc-director-bar"><div class="kkvc-director-mark" aria-hidden="true">✦</div><div><div class="kkvc-director-title" id="kkvcDirectorTitle">Video Director</div><div class="kkvc-director-sub">Advanced shot, reference and storyboard controls</div></div><button type="button" class="kkvc-director-close" id="kkvcDirectorClose" aria-label="Close Director controls">×</button></div><div class="kkvc-director-host" id="kkvcDirectorHost"></div></div>`;
    document.body.appendChild(b);
    b.addEventListener("click",e=>{if(e.target===b)close();});
    b.querySelector("#kkvcDirectorClose").addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&opened){e.preventDefault();close();}});
  }

  function findV3(){
    return document.getElementById("kkVideoCanvasV3")||document.querySelector(".kkv3")||document.querySelector(".kk-video-v3-host");
  }

  function lockScroll(){document.documentElement.dataset.kkvcDirectorScroll=document.documentElement.style.overflow||"";document.body.dataset.kkvcDirectorScroll=document.body.style.overflow||"";document.documentElement.style.overflow="hidden";document.body.style.overflow="hidden";}
  function unlockScroll(){document.documentElement.style.overflow=document.documentElement.dataset.kkvcDirectorScroll||"";document.body.style.overflow=document.body.dataset.kkvcDirectorScroll||"";delete document.documentElement.dataset.kkvcDirectorScroll;delete document.body.dataset.kkvcDirectorScroll;}

  function open(){
    if(opened)return;
    ensureUi();css();
    const host=findV3();
    if(!host)throw new Error("Video Canvas V3 is not mounted yet.");
    const target=document.getElementById("kkvcDirectorHost");
    if(!target)throw new Error("Video Director host is unavailable.");
    previousParent=host.parentNode;previousNext=host.nextSibling;restoreFocus=document.activeElement&&typeof document.activeElement.focus==="function"?document.activeElement:null;
    target.appendChild(host);
    opened=true;
    const note=document.getElementById("kkvcDirectorNote");if(note)note.style.display="none";
    const b=document.getElementById("kkvcDirectorBackdrop");b.classList.add("open");
    lockScroll();
    const q=state();if(q){q.directorOpen=true;q.touch();}
    const btn=document.getElementById("kkvcSettings");if(btn)btn.setAttribute("aria-expanded","true");
    requestAnimationFrame(()=>document.getElementById("kkvcDirectorClose")?.focus());
  }

  function close(){
    if(!opened)return;
    const host=findV3();
    if(host&&previousParent){
      if(previousNext&&previousNext.parentNode===previousParent)previousParent.insertBefore(host,previousNext);
      else previousParent.appendChild(host);
    }
    opened=false;
    const note=document.getElementById("kkvcDirectorNote");if(note)note.style.display="none";
    const b=document.getElementById("kkvcDirectorBackdrop");if(b)b.classList.remove("open");
    unlockScroll();
    const q=state();if(q){q.directorOpen=false;q.touch();}
    const btn=document.getElementById("kkvcSettings");if(btn)btn.setAttribute("aria-expanded","false");
    const focusTarget=restoreFocus;restoreFocus=null;
    previousParent=null;previousNext=null;
    if(focusTarget&&document.contains(focusTarget))requestAnimationFrame(()=>focusTarget.focus());
  }

  function toggle(){try{if(opened)close();else open();}catch(err){const q=state();if(q)q.addMessage("assistant",err?.message||String(err),{generationError:true});}}

  function boot(){
    ensureUi();css();
    window.addEventListener("kosmic:video-director-toggle",e=>{const want=!!e.detail?.open;if(want&&!opened)open();else if(!want&&opened)close();});
    window.__kosmicVideoDirector={open,close,toggle};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
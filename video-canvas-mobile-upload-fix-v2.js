/* KOSMIC KAT — Video Canvas stable mobile layout guard
 * Root-cause fix: do NOT inject a second upload card into the V3 DOM.
 * V3 already renders the real browser reference inputs. Re-injecting a card
 * after every render caused the upload/Gallery area to jump, duplicate, and
 * appear to fall away when state changed.
 */
(function installKosmicVideoCanvasMobileUploadFixV2(){
  "use strict";
  if(window.__kosmicVideoCanvasMobileUploadFixV2)return;
  window.__kosmicVideoCanvasMobileUploadFixV2=true;

  const root=()=>document.getElementById("kkVideoCanvasV3");

  function css(){
    if(document.getElementById("kk-video-canvas-mobile-upload-fix-v2-css"))return;
    const s=document.createElement("style");
    s.id="kk-video-canvas-mobile-upload-fix-v2-css";
    s.textContent=`
      /* ---------- MOBILE: one stable vertical surface ---------- */
      @media(max-width:920px){
        html,body{
          min-height:100%;
          overflow-x:hidden!important;
        }
        body:has(#kkVideoCanvasV3){
          overflow-y:auto!important;
          -webkit-overflow-scrolling:touch!important;
        }

        /* The V3 host is the document flow on mobile. Never create a
           competing nested scroll container that can trap/flicker content. */
        #moduleContent:has(#kkVideoCanvasV3),
        .module-content:has(#kkVideoCanvasV3),
        .main-content:has(#kkVideoCanvasV3){
          height:auto!important;
          min-height:0!important;
          max-height:none!important;
          overflow:visible!important;
          touch-action:pan-y!important;
        }
        #kkVideoCanvasV3{
          height:auto!important;
          min-height:0!important;
          max-height:none!important;
          overflow:visible!important;
        }
        #kkVideoCanvasV3>.kkv3{
          height:auto!important;
          min-height:0!important;
          max-height:none!important;
          overflow:visible!important;
          display:flex!important;
          flex-direction:column!important;
        }
        #kkVideoCanvasV3 .kkv3-body{
          display:flex!important;
          flex-direction:column!important;
          flex:0 0 auto!important;
          min-height:0!important;
          overflow:visible!important;
        }
        #kkVideoCanvasV3 .kkv3-main,
        #kkVideoCanvasV3 .kkv3-side{
          height:auto!important;
          max-height:none!important;
          min-height:0!important;
          overflow:visible!important;
        }
        #kkVideoCanvasV3 .kkv3-side{
          border-top:1px solid var(--border,rgba(61,31,122,.08));
        }

        /* Keep the real Generate action in normal flow. */
        #kkVideoCanvasV3 .kkv3-mobile-generate{
          position:static!important;
          margin:2px 0 0!important;
        }

        /* Never let the real reference controls be clipped or moved by
           nested overflow rules. */
        #kkVideoCanvasV3 .kkv3-dropgrid,
        #kkVideoCanvasV3 .kkv3-card{
          overflow:visible;
        }
        #kkVideoCanvasV3 input[type=file]{
          position:absolute!important;
          inset:0!important;
          width:100%!important;
          height:100%!important;
          opacity:0!important;
          cursor:pointer!important;
        }
      }

      /* The broken legacy Gallery text placeholders are not upload controls. */
      #kkVideoCanvasV3 .kkv3-rogue-gallery-v2{
        display:none!important;
      }

      /* If an old injected V2 card survived from a cached document, remove it
         visually without touching V3's real Reference media card. */
      #kkVideoCanvasV3 .kkv3-browser-refs-v2{
        display:none!important;
      }
    `;
    document.head.appendChild(s);
  }

  function removeRogueGallery(){
    const r=root();
    if(!r)return;

    r.querySelectorAll(".kkv3-rogue-gallery-v2").forEach(el=>el.remove());

    /* Remove only text-only accidental Gallery cards. Never remove a real
       button/input/media element or the actual Gallery navigation action. */
    r.querySelectorAll(".kkv3-card,.kkv3-stat,.kkv3-job,.kkv3-empty").forEach(el=>{
      if(el.closest(".kkv3-browser-refs-v2"))return;
      if(el.querySelector("button,input,textarea,select,video,audio,a"))return;
      if(String(el.textContent||"").trim()==="Gallery")el.classList.add("kkv3-rogue-gallery-v2");
    });
  }

  function boot(){
    css();
    removeRogueGallery();
  }

  /* No MutationObserver. V3 owns rendering and replaces its innerHTML on
     state changes. A competing observer was the source of the jumping/falling
     upload card. */
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  window.addEventListener("resize",css,{passive:true});
})();
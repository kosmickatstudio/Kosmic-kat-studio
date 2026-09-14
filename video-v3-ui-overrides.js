/* KOSMIC KAT — Video V3 UI / layout overrides
 * Surgical compatibility layer for the V3 surface.
 * Does not own provider, generation, credential, or route logic.
 */
(function installKosmicVideoV3UiOverrides(){
  "use strict";
  if(window.__kosmicVideoV3UiOverrides)return;
  window.__kosmicVideoV3UiOverrides=true;

  const $=id=>document.getElementById(id);
  const videoActive=()=>window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  const v3=()=>$("kkVideoCanvasV3");
  const host=()=>$("moduleContent")||document.querySelector(".module-content");
  let observer=null;
  let resizeObserver=null;
  let switchWrapped=false;
  let outsideHandlerInstalled=false;
  let raf=0;

  function injectCss(){
    if($("kk-video-v3-ui-overrides-css"))return;
    const s=document.createElement("style");s.id="kk-video-v3-ui-overrides-css";
    s.textContent=`
      /* ---------- bounded Video layout ---------- */
      #moduleContent.kk-video-v3-layout-root,.module-content.kk-video-v3-layout-root{
        flex:1 1 auto!important;min-height:0!important;height:100%!important;overflow:hidden!important;
        display:flex!important;flex-direction:column!important;
      }
      #moduleContent.kk-video-v3-layout-root>#kkVideoCanvasV3,
      #moduleContent.kk-video-v3-layout-root>#kkVideoChat,
      .module-content.kk-video-v3-layout-root>#kkVideoCanvasV3,
      .module-content.kk-video-v3-layout-root>#kkVideoChat{
        flex:1 1 auto!important;min-height:0!important;height:100%!important;max-height:100%!important;
      }
      #kkVideoCanvasV3{min-height:0!important;height:100%!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;}
      #kkVideoCanvasV3>.kkv3{min-height:0!important;height:100%!important;max-height:100%!important;}
      #kkVideoCanvasV3 .kkv3-body{min-height:0!important;overflow:hidden!important;}
      #kkVideoCanvasV3 .kkv3-main,#kkVideoCanvasV3 .kkv3-side{min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;}
      @media(max-width:920px){
        #kkVideoCanvasV3 .kkv3-body{display:flex!important;flex-direction:column!important;min-height:0!important;overflow:hidden!important;}
        #kkVideoCanvasV3 .kkv3-main{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;}
        #kkVideoCanvasV3 .kkv3-side{flex:0 0 auto!important;min-height:0!important;max-height:42%!important;overflow-y:auto!important;overflow-x:hidden!important;border-left:0!important;border-top:1px solid var(--border,rgba(61,31,122,.09));}
      }

      /* ---------- polished native-ish model picker ---------- */
      #kkVideoCanvasV3 .kkv3-modelbar{position:relative;grid-template-columns:minmax(0,1fr) auto;align-items:start;}
      #kkVideoCanvasV3 .kkv3-model-picker{position:relative;min-width:0;}
      #kkVideoCanvasV3 .kkv3-model-trigger{
        width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:10px;
        border:1px solid var(--border,rgba(61,31,122,.11));background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);
        border-radius:11px;padding:10px 11px;font:inherit;font-size:11px;font-weight:800;text-align:left;cursor:pointer;
        transition:border-color .16s,box-shadow .16s,background .16s;
      }
      #kkVideoCanvasV3 .kkv3-model-trigger:hover,#kkVideoCanvasV3 .kkv3-model-trigger[aria-expanded="true"]{
        border-color:rgba(98,64,176,.42);box-shadow:0 0 0 3px rgba(98,64,176,.07);background:var(--surface,#fff);
      }
      #kkVideoCanvasV3 .kkv3-model-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #kkVideoCanvasV3 .kkv3-model-trigger i{font-style:normal;color:var(--texts,#9488ae);flex:0 0 auto;transition:transform .16s;}
      #kkVideoCanvasV3 .kkv3-model-trigger[aria-expanded="true"] i{transform:rotate(180deg);}
      #kkVideoCanvasV3 .kkv3-model-menu{
        position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:50;padding:8px;
        border:1px solid var(--glass-brd,rgba(61,31,122,.14));border-radius:15px;background:var(--glass-solid,rgba(252,250,255,.98));
        box-shadow:0 18px 50px rgba(61,31,122,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
        display:none;max-height:min(52vh,330px);overflow:hidden;
      }
      #kkVideoCanvasV3 .kkv3-model-menu.open{display:block;}
      #kkVideoCanvasV3 .kkv3-model-search{width:100%;min-height:38px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:10px;background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);outline:0;padding:9px 10px;font:inherit;font-size:11px;margin-bottom:7px;}
      #kkVideoCanvasV3 .kkv3-model-options{overflow:auto;max-height:245px;display:flex;flex-direction:column;gap:3px;padding-right:2px;}
      #kkVideoCanvasV3 .kkv3-model-option{display:flex;align-items:center;gap:8px;width:100%;border:0;border-radius:9px;padding:9px 10px;background:transparent;color:var(--textm,#5a4880);font:inherit;font-size:10px;font-weight:750;text-align:left;cursor:pointer;}
      #kkVideoCanvasV3 .kkv3-model-option:hover,#kkVideoCanvasV3 .kkv3-model-option[aria-current="true"]{background:rgba(98,64,176,.09);color:var(--violet,#3d1f7a);}
      #kkVideoCanvasV3 .kkv3-model-option-dot{width:7px;height:7px;border-radius:50%;background:var(--ice,#4aa9d9);flex:0 0 auto;}
      #kkVideoCanvasV3 .kkv3-model-empty{padding:14px 10px;text-align:center;font-size:10px;color:var(--texts,#9488ae);}
      #kkVideoCanvasV3 .kkv3-model-native-hidden{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;}

      /* ---------- duration control ---------- */
      #kkVideoCanvasV3 .kkv3-duration-wrap{width:100%;}
      #kkVideoCanvasV3 .kkv3-duration-track-row{display:grid;grid-template-columns:minmax(0,1fr) 66px;gap:9px;align-items:center;}
      #kkVideoCanvasV3 .kkv3-range.kkv3-duration-range{display:block;}
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]{
        width:100%;height:30px;margin:0;appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;
      }
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]::-webkit-slider-runnable-track{
        height:7px;border-radius:999px;background:linear-gradient(90deg,var(--violet,#3d1f7a) 0%,var(--vm,#6240b0) var(--kk-duration-fill,0%),var(--lav2,#d8ccf5) var(--kk-duration-fill,0%),var(--lav2,#d8ccf5) 100%);
      }
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]::-webkit-slider-thumb{
        appearance:none;-webkit-appearance:none;width:22px;height:22px;border-radius:50%;margin-top:-7.5px;border:3px solid var(--surface,#fff);background:var(--violet,#3d1f7a);box-shadow:0 3px 10px rgba(61,31,122,.22);
      }
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]::-moz-range-track{height:7px;border-radius:999px;background:var(--lav2,#d8ccf5);}
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]::-moz-range-progress{height:7px;border-radius:999px;background:linear-gradient(90deg,var(--violet,#3d1f7a),var(--vm,#6240b0));}
      #kkVideoCanvasV3 .kkv3-duration-range input[type="range"]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;border:3px solid var(--surface,#fff);background:var(--violet,#3d1f7a);box-shadow:0 3px 10px rgba(61,31,122,.22);}
      #kkVideoCanvasV3 .kkv3-duration-value{width:66px!important;text-align:center!important;font-weight:850!important;font-variant-numeric:tabular-nums;}
      #kkVideoCanvasV3 .kkv3-duration-meta{display:flex;justify-content:space-between;padding-top:4px;font-size:8px;color:var(--texts,#9488ae);}

      /* ---------- Gallery action ---------- */
      #kkVideoCanvasV3 .kkv3-generate-actions{width:100%;}
      #kkVideoCanvasV3 .kkv3-gallery-action{min-width:84px;}

      /* ---------- no flash of the legacy V2 surface ---------- */
      html.kk-video-v3-pending .video-canvas,
      html.kk-video-v3-pending .video-studio,
      html.kk-video-v3-pending #vcModel,
      html.kk-video-v3-pending #vcSettingsPanel,
      html.kk-video-v3-pending #vcSettingsBackdrop,
      html.kk-video-v3-pending #vcGalleryView,
      html.kk-video-v3-pending #kk-video-legacy-mount{visibility:hidden!important;pointer-events:none!important;}
    `;
    document.head.appendChild(s);
  }

  function markLayout(){
    const h=host(),root=v3();
    if(!h||!root)return;
    h.classList.add("kk-video-v3-layout-root");
    let node=h.parentElement;
    while(node&&node!==document.body){
      node.classList.add("kk-video-v3-layout-root");
      if(node.classList.contains("main-content"))break;
      node=node.parentElement;
    }
  }

  function clearLayout(){
    document.querySelectorAll(".kk-video-v3-layout-root").forEach(el=>el.classList.remove("kk-video-v3-layout-root"));
  }

  function scrubLegacy(){
    if(!videoActive())return;
    [".video-canvas",".video-studio","#vcModel","#vcSettingsPanel","#vcSettingsBackdrop","#vcGalleryView","#kk-video-legacy-mount"].forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        if(el.closest("#kkVideoCanvasV3")||el.closest("#kkVideoChat"))return;
        if(sel==="#kk-video-legacy-mount")el.remove();
        else if(el.parentElement===host())el.remove();
        else{el.classList.remove("open","active","show","is-open");el.setAttribute("aria-hidden","true");}
      });
    });
  }

  function updateDurationVisual(range,num){
    if(!range)return;
    const min=Number(range.min||0),max=Number(range.max||100),value=Number(range.value||min);
    const pct=max>min?((value-min)/(max-min))*100:0;
    range.style.setProperty("--kk-duration-fill",pct.toFixed(1)+"%");
    const field=range.closest(".kkv3-field");
    field?.querySelector("label b")?.replaceChildren(document.createTextNode(value+"s"));
    const summary=v3()?.querySelector(".kkv3-stat:first-child b");
    if(summary)summary.textContent=value+"s";
    if(num&&num.value!==String(value))num.value=String(value);
  }

  function enhanceDuration(){
    const range=$("kkv3Duration"),num=$("kkv3DurationNum");
    if(!range||!num)return;
    if(!range.parentElement?.classList.contains("kkv3-duration-range")){
      const row=range.parentElement;
      row.classList.add("kkv3-duration-wrap");
      range.parentElement?.classList.add("kkv3-duration-track-row");
      const wrap=document.createElement("div");wrap.className="kkv3-duration-range";
      row.insertBefore(wrap,range);wrap.appendChild(range);
      num.classList.add("kkv3-duration-value");
      let meta=row.parentElement?.querySelector(".kkv3-duration-meta");
      if(!meta){
        meta=document.createElement("div");meta.className="kkv3-duration-meta";
        const min=range.min||"";const max=range.max||"";meta.innerHTML=`<span>Min ${min}s</span><span>Max ${max}s</span>`;
        row.parentElement?.appendChild(meta);
      }
      if(!range.__kkDurationBound){
        range.__kkDurationBound=true;
        range.addEventListener("input",()=>updateDurationVisual(range,num));
        num.addEventListener("input",()=>{
          const min=Number(range.min||0),max=Number(range.max||100);let value=Number(num.value||min);value=Math.max(min,Math.min(max,value));range.value=String(value);updateDurationVisual(range,num);
        });
      }
    }
    updateDurationVisual(range,num);
  }

  function closeModelMenu(){
    const menu=$("kkv3ModelMenu"),trigger=$("kkv3ModelTrigger");
    menu?.classList.remove("open");trigger?.setAttribute("aria-expanded","false");
  }

  function openModelMenu(){
    const menu=$("kkv3ModelMenu"),trigger=$("kkv3ModelTrigger");
    if(!menu||!trigger)return;
    const next=!menu.classList.contains("open");
    document.querySelectorAll(".kkv3-model-menu.open").forEach(m=>m.classList.remove("open"));
    menu.classList.toggle("open",next);trigger.setAttribute("aria-expanded",next?"true":"false");
    if(next){const input=$("kkv3ModelSearch");setTimeout(()=>input?.focus(),0);}
  }

  function filterModels(){
    const input=$("kkv3ModelSearch"),term=(input?.value||"").trim().toLowerCase();
    document.querySelectorAll("#kkv3ModelMenu [data-model-value]").forEach(btn=>btn.style.display=(!term||btn.dataset.modelValue.toLowerCase().includes(term))?"flex":"none");
  }

  function enhanceModel(){
    const select=$("kkv3Model");
    if(!select||select.dataset.kkEnhanced==="1")return;
    const options=Array.from(select.options||[]);if(!options.length)return;
    select.dataset.kkEnhanced="1";select.classList.add("kkv3-model-native-hidden");
    const wrap=document.createElement("div");wrap.className="kkv3-model-picker";
    const trigger=document.createElement("button");trigger.type="button";trigger.id="kkv3ModelTrigger";trigger.className="kkv3-model-trigger";trigger.setAttribute("aria-haspopup","listbox");trigger.setAttribute("aria-expanded","false");
    const label=document.createElement("span");const arrow=document.createElement("i");arrow.textContent="⌄";trigger.append(label,arrow);
    const menu=document.createElement("div");menu.id="kkv3ModelMenu";menu.className="kkv3-model-menu";menu.setAttribute("role","listbox");
    const search=document.createElement("input");search.id="kkv3ModelSearch";search.className="kkv3-model-search";search.type="search";search.placeholder="Search models…";search.autocomplete="off";
    const list=document.createElement("div");list.className="kkv3-model-options";
    options.forEach(opt=>{
      const b=document.createElement("button");b.type="button";b.className="kkv3-model-option";b.dataset.modelValue=opt.value;b.setAttribute("role","option");b.setAttribute("aria-current",opt.selected?"true":"false");
      const dot=document.createElement("span");dot.className="kkv3-model-option-dot";const text=document.createElement("span");text.textContent=opt.textContent||opt.value;b.append(dot,text);b.addEventListener("click",()=>{select.value=opt.value;select.dispatchEvent(new Event("change",{bubbles:true}));});list.appendChild(b);
    });
    menu.append(search,list);wrap.append(select,trigger,menu);select.parentElement?.replaceWith(wrap);
    function sync(){const opt=options.find(x=>x.value===select.value)||options[0];label.textContent=opt?.textContent||select.value;list.querySelectorAll("[data-model-value]").forEach(b=>b.setAttribute("aria-current",b.dataset.modelValue===select.value?"true":"false"));}
    sync();
    trigger.addEventListener("click",e=>{e.stopPropagation();openModelMenu();});
    search.addEventListener("input",filterModels);search.addEventListener("keydown",e=>{if(e.key==="Escape")closeModelMenu();});
  }

  function ensureGallery(){
    const root=v3(),generate=$("kkv3Generate");if(!root||!generate)return;
    let row=generate.parentElement?.querySelector(".kkv3-generate-actions");
    if(!row){
      row=document.createElement("div");row.className="kkv3-generate-actions";row.style.cssText="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:10px";
      generate.parentElement?.insertBefore(row,generate);row.appendChild(generate);
    }
    let gallery=row.querySelector("[data-kosmic-video-gallery]");
    if(!gallery){
      gallery=document.createElement("button");gallery.type="button";gallery.className="kkv3-secondary kkv3-gallery-action";gallery.dataset.kosmicVideoGallery="1";gallery.textContent="Gallery";gallery.title="Open Video Gallery";gallery.setAttribute("aria-label","Open Video Gallery");
      gallery.addEventListener("click",()=>{
        const target=document.querySelector('.mod-btn[data-mod="gallery"],[data-mod="gallery"]');
        if(target&&typeof target.click==="function"){target.click();return;}
        if(typeof window.switchMod==="function")window.switchMod("gallery",target||null);
      });
      row.appendChild(gallery);
    }
  }

  function closeOnOutside(e){
    const menu=$("kkv3ModelMenu"),picker=e.target?.closest?.(".kkv3-model-picker");
    if(menu?.classList.contains("open")&&!picker)closeModelMenu();
  }

  function refresh(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      if(!videoActive()){
        clearLayout();document.documentElement.classList.remove("kk-video-v3-pending");return;
      }
      markLayout();scrubLegacy();
      const root=v3();
      if(root){
        document.documentElement.classList.remove("kk-video-v3-pending");
        enhanceModel();enhanceDuration();ensureGallery();
      }else{
        document.documentElement.classList.add("kk-video-v3-pending");
      }
    });
  }

  function observeRoot(){
    const root=v3();
    if(!root||observer)return;
    observer=new MutationObserver(()=>refresh());
    observer.observe(root,{childList:true,subtree:true});
  }

  function wrapSwitch(){
    if(switchWrapped||typeof window.switchMod!=="function")return;
    const original=window.switchMod;
    window.switchMod=function(mod,el){
      const m=String(mod);
      if(m==="videocanvas")document.documentElement.classList.add("kk-video-v3-pending");
      const out=original.apply(this,arguments);
      if(m==="videocanvas"){setTimeout(refresh,0);setTimeout(refresh,100);setTimeout(refresh,350);setTimeout(refresh,700);}
      else{document.documentElement.classList.remove("kk-video-v3-pending");clearLayout();}
      return out;
    };
    window.__kosmicVideoV3UiOriginalSwitchMod=original;
    switchWrapped=true;
  }

  function boot(){
    injectCss();wrapSwitch();
    if(!outsideHandlerInstalled){document.addEventListener("click",closeOnOutside,true);outsideHandlerInstalled=true;}
    if(videoActive())document.documentElement.classList.add("kk-video-v3-pending");
    refresh();observeRoot();
    if(!resizeObserver){
      resizeObserver=new ResizeObserver(()=>{if(videoActive())refresh();});
      const main=document.querySelector(".main-content")||host();if(main)resizeObserver.observe(main);
    }
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

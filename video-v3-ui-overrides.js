/* KOSMIC KAT — Video V3 UI / layout overrides
 * Canonical interaction/layout guard for the migrated Video surface.
 * Provider routes, credentials, and generation remain elsewhere.
 */
(function installKosmicVideoV3UiOverrides(){
  "use strict";
  if(window.__kosmicVideoV3UiOverrides)return;
  window.__kosmicVideoV3UiOverrides=true;
  const $=id=>document.getElementById(id),root=()=>$("kkVideoCanvasV3"),chat=()=>$("kkVideoChat");
  const active=()=>window.S?.mod==="videocanvas"||!!document.querySelector('.mod-btn[data-mod="videocanvas"].active');
  let observer=null,chatObserver=null,raf=0,outsideBound=false;

  function css(){
    if($("kk-video-v3-ui-overrides-css"))return;
    const s=document.createElement("style");s.id="kk-video-v3-ui-overrides-css";
    s.textContent=`
      .kkvc-director-drawer{display:flex!important;flex-direction:column!important;min-height:0!important;}
      .kkvc-director-host{flex:1 1 0!important;height:auto!important;min-height:0!important;overflow:hidden!important;}
      .kkvc-director-host>#kkVideoCanvasV3{height:100%!important;min-height:0!important;max-height:100%!important;}
      #kkVideoCanvasV3>.kkv3{height:100%!important;min-height:0!important;max-height:100%!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;}
      #kkVideoCanvasV3 .kkv3-head,#kkVideoCanvasV3 .kkv3-tabs{flex:0 0 auto!important;}
      #kkVideoCanvasV3 .kkv3-body{flex:1 1 0!important;min-height:0!important;overflow:hidden!important;}
      #kkVideoCanvasV3 .kkv3-main{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain;}
      #kkVideoCanvasV3 .kkv3-side{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;}
      @media(max-width:920px){
        #kkVideoCanvasV3 .kkv3-body{display:flex!important;flex-direction:column!important;min-height:0!important;}
        #kkVideoCanvasV3 .kkv3-main{flex:1 1 0!important;min-height:0!important;max-height:none!important;}
        #kkVideoCanvasV3 .kkv3-side{flex:0 0 auto!important;max-height:38%!important;min-height:0!important;}
      }
      #kkVideoCanvasV3 .kkv3-modelbar{position:relative!important;overflow:visible!important;}
      #kkVideoCanvasV3 .kkv3-final-model-picker{position:relative;min-width:0;flex:1 1 auto;}
      #kkVideoCanvasV3 .kkv3-final-model-picker>.kkv3-select{display:none!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;position:absolute!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;}
      #kkVideoCanvasV3 .kkv3-final-model-trigger{width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:9px;border:1px solid var(--border,rgba(61,31,122,.11));background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);border-radius:11px;padding:10px 11px;font-size:11px;font-weight:850;text-align:left;}
      #kkVideoCanvasV3 .kkv3-final-model-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      #kkVideoCanvasV3 .kkv3-final-model-trigger b{font-size:13px;color:var(--texts,#9488ae);font-weight:700;}
      .kkv3-final-model-menu{position:fixed;z-index:10000;display:none;width:min(360px,calc(100vw - 20px));padding:8px;border:1px solid var(--glass-brd,rgba(61,31,122,.14));border-radius:15px;background:rgba(252,250,255,.99);box-shadow:0 18px 50px rgba(61,31,122,.2);}
      .kkv3-final-model-menu.open{display:block;}
      .kkv3-final-model-search{width:100%;height:38px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:10px;background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);outline:0;padding:8px 10px;font-size:11px;margin-bottom:7px;}
      .kkv3-final-model-list{max-height:min(48vh,330px);overflow:auto;display:flex;flex-direction:column;gap:2px;-webkit-overflow-scrolling:touch;}
      .kkv3-final-model-option{width:100%;border:0;border-radius:9px;background:transparent;color:var(--textm,#5a4880);padding:9px 10px;text-align:left;font-size:10px;font-weight:750;cursor:pointer;}
      .kkv3-final-model-option:hover,.kkv3-final-model-option.active{background:rgba(98,64,176,.09);color:var(--violet,#3d1f7a);}
      #kkVideoCanvasV3 .kkv3-duration-native{width:100%!important;height:30px!important;margin:0!important;appearance:none!important;-webkit-appearance:none!important;background:transparent!important;accent-color:var(--violet,#3d1f7a)!important;cursor:pointer!important;}
      #kkVideoCanvasV3 .kkv3-duration-native::-webkit-slider-runnable-track{height:7px;border-radius:999px;background:linear-gradient(90deg,var(--violet,#3d1f7a) 0%,var(--vm,#6240b0) var(--kk-duration-fill,0%),var(--lav2,#d8ccf5) var(--kk-duration-fill,0%),var(--lav2,#d8ccf5) 100%);}
      #kkVideoCanvasV3 .kkv3-duration-native::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:20px;height:20px;margin-top:-6.5px;border:3px solid #fff;border-radius:50%;background:var(--violet,#3d1f7a);box-shadow:0 3px 10px rgba(61,31,122,.22);}
      #kkVideoCanvasV3 .kkv3-duration-native::-moz-range-track{height:7px;border-radius:999px;background:var(--lav2,#d8ccf5);}
      #kkVideoCanvasV3 .kkv3-duration-native::-moz-range-progress{height:7px;border-radius:999px;background:linear-gradient(90deg,var(--violet,#3d1f7a),var(--vm,#6240b0));}
      #kkVideoCanvasV3 .kkv3-duration-native::-moz-range-thumb{width:18px;height:18px;border:3px solid #fff;border-radius:50%;background:var(--violet,#3d1f7a);}
      #kkVideoCanvasV3 .kkv3-duration-wrap-final{display:grid;grid-template-columns:minmax(0,1fr) 66px;gap:9px;align-items:center;width:100%;}
      #kkVideoCanvasV3 .kkv3-duration-number-final{width:66px!important;text-align:center!important;font-weight:850!important;font-variant-numeric:tabular-nums;}
      #kkVideoCanvasV3 .kkv3-duration-meta-final{display:flex;justify-content:space-between;padding-top:4px;font-size:8px;color:var(--texts,#9488ae);}
      #kkVideoCanvasV3 .kkv3-final-gallery{min-width:84px!important;white-space:nowrap!important;}
      #kkVideoChat #kkvcAttach,#kkVideoChat #kkvcFile{display:none!important;}
      #kkVideoChat .kkvc-textrow{gap:8px!important;}
      html.kk-video-v3-pending .video-canvas,html.kk-video-v3-pending .video-studio,html.kk-video-v3-pending #vcModel,html.kk-video-v3-pending #vcSettingsPanel,html.kk-video-v3-pending #vcSettingsBackdrop,html.kk-video-v3-pending #vcGalleryView,html.kk-video-v3-pending #kk-video-legacy-mount{visibility:hidden!important;pointer-events:none!important;}
    `;
    document.head.appendChild(s);
  }

  function syncDuration(){
    const r=$("kkv3Duration"),n=$("kkv3DurationNum");if(!r||!n)return;
    r.classList.add("kkv3-duration-native");n.classList.add("kkv3-duration-number-final");
    const min=Number(r.min||0),max=Number(r.max||100),value=Math.max(min,Math.min(max,Number(r.value||min)));
    r.value=String(value);n.value=String(value);r.style.setProperty("--kk-duration-fill",(max>min?((value-min)/(max-min))*100:0).toFixed(1)+"%");
    const label=r.closest(".kkv3-field")?.querySelector("label b");if(label)label.textContent=value+"s";
    let row=r.parentElement;if(row&&!row.classList.contains("kkv3-duration-wrap-final")){row.classList.add("kkv3-duration-wrap-final");let meta=row.parentElement?.querySelector(".kkv3-duration-meta-final");if(!meta){meta=document.createElement("div");meta.className="kkv3-duration-meta-final";meta.innerHTML=`<span>Min ${min}s</span><span>Max ${max}s</span>`;row.parentElement?.appendChild(meta);}}
    if(!r.__kkFinalDuration){r.__kkFinalDuration=true;r.addEventListener("input",()=>{const v=Math.max(min,Math.min(max,Number(r.value||min)));r.value=String(v);n.value=String(v);r.style.setProperty("--kk-duration-fill",(max>min?((v-min)/(max-min))*100:0).toFixed(1)+"%");const label=r.closest(".kkv3-field")?.querySelector("label b");if(label)label.textContent=v+"s";const st=window.__kosmicVideoV3State;if(st)st.duration=v;});n.addEventListener("input",()=>{const v=Math.max(min,Math.min(max,Number(n.value||min)));n.value=String(v);r.value=String(v);r.dispatchEvent(new Event("input",{bubbles:true}));});n.addEventListener("change",()=>{const st=window.__kosmicVideoV3State;if(st)st.duration=Number(n.value||min);r.dispatchEvent(new Event("change",{bubbles:true}));});}
  }

  function closeMenu(){const m=$("kkv3ModelMenu"),t=$("kkv3ModelTrigger");m?.classList.remove("open");t?.setAttribute("aria-expanded","false");}
  function positionMenu(){const t=$("kkv3ModelTrigger"),m=$("kkv3ModelMenu");if(!t||!m)return;const r=t.getBoundingClientRect(),mw=Math.min(360,window.innerWidth-20);let left=Math.max(10,Math.min(r.left,window.innerWidth-mw-10));const mh=Math.min(window.innerHeight*.52,360);let top=r.bottom+7;if(top+mh>window.innerHeight-10)top=Math.max(10,r.top-mh-7);m.style.width=mw+"px";m.style.left=left+"px";m.style.top=top+"px";m.style.maxHeight=mh+"px";}
  function syncModel(){
    const s=$("kkv3Model");if(!s)return;
    if(s.parentElement?.querySelector(".kkv3-final-model-picker"))return;
    const options=Array.from(s.options||[]);if(!options.length)return;
    const picker=document.createElement("div");picker.className="kkv3-final-model-picker";
    const trigger=document.createElement("button");trigger.type="button";trigger.id="kkv3ModelTrigger";trigger.className="kkv3-final-model-trigger";trigger.setAttribute("aria-haspopup","listbox");trigger.setAttribute("aria-expanded","false");
    const text=document.createElement("span"),arrow=document.createElement("b");arrow.textContent="⌄";trigger.append(text,arrow);
    const menu=document.createElement("div");menu.id="kkv3ModelMenu";menu.className="kkv3-final-model-menu";menu.setAttribute("role","listbox");
    const search=document.createElement("input");search.id="kkv3ModelSearch";search.className="kkv3-final-model-search";search.type="search";search.placeholder="Search models…";search.autocomplete="off";
    const list=document.createElement("div");list.className="kkv3-final-model-list";
    options.forEach(o=>{const b=document.createElement("button");b.type="button";b.className="kkv3-final-model-option";b.dataset.value=o.value;b.dataset.modelValue=o.value;b.setAttribute("role","option");b.textContent=o.textContent||o.value;b.addEventListener("click",()=>{s.value=o.value;s.dispatchEvent(new Event("change",{bubbles:true}));closeMenu();});list.appendChild(b);});
    menu.append(search,list);picker.append(trigger);s.parentElement?.insertBefore(picker,s);document.body.appendChild(menu);
    const sync=()=>{const o=options.find(x=>x.value===s.value)||options[0];text.textContent=o?.textContent||s.value;list.querySelectorAll(".kkv3-final-model-option").forEach(b=>b.classList.toggle("active",b.dataset.value===s.value));};
    sync();s.addEventListener("change",sync);
    trigger.addEventListener("click",e=>{e.stopPropagation();const open=!menu.classList.contains("open");document.querySelectorAll(".kkv3-final-model-menu.open").forEach(x=>x.classList.remove("open"));menu.classList.toggle("open",open);trigger.setAttribute("aria-expanded",open?"true":"false");if(open){positionMenu();setTimeout(()=>search.focus(),0);}});
    search.addEventListener("input",()=>{const q=search.value.trim().toLowerCase();list.querySelectorAll(".kkv3-final-model-option").forEach(b=>b.style.display=(!q||b.textContent.toLowerCase().includes(q))?"block":"none");});
    window.addEventListener("resize",()=>{if(menu.classList.contains("open"))positionMenu();},{passive:true});
    document.addEventListener("scroll",()=>{if(menu.classList.contains("open"))positionMenu();},true);
  }

  function scrubChat(){
    if(!active())return;
    $("kkvcAttach")?.remove();$("kkvcFile")?.remove();
    const meta=chat()?.querySelector(".kkvc-meta");
    if(meta){const count=$("kkvcRefCount"),value=count?.textContent||"0";meta.innerHTML=`<span><strong id="kkvcRefCount">${value}</strong> references managed in Director settings</span><span>Settings stay global • Director controls live separately</span>`;}
  }
  function scrubLegacy(){if(!active())return;[".video-canvas",".video-studio","#vcModel","#vcSettingsPanel","#vcSettingsBackdrop","#vcGalleryView","#kk-video-legacy-mount"].forEach(sel=>document.querySelectorAll(sel).forEach(el=>{if(el.closest("#kkVideoCanvasV3")||el.closest("#kkVideoChat"))return;el.style.setProperty("display","none","important");el.setAttribute("aria-hidden","true");}));}
  function refresh(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(!active()){closeMenu();return;}css();scrubLegacy();scrubChat();syncModel();syncDuration();});}
  function observe(){
    const r=root();if(r&&!observer){observer=new MutationObserver(()=>{observer.disconnect();refresh();requestAnimationFrame(()=>{if(root())observer.observe(root(),{childList:true,subtree:true});});});observer.observe(r,{childList:true,subtree:true});}
    const c=chat();if(c&&!chatObserver){chatObserver=new MutationObserver(()=>{chatObserver.disconnect();scrubChat();requestAnimationFrame(()=>{if(chat())chatObserver.observe(chat(),{childList:true,subtree:true});});});chatObserver.observe(c,{childList:true,subtree:true});}
  }
  function boot(){css();refresh();observe();if(!outsideBound){outsideBound=true;document.addEventListener("click",e=>{if(!e.target?.closest?.(".kkv3-final-model-picker")&&!e.target?.closest?.(".kkv3-final-model-menu"))closeMenu();},true);}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  setInterval(()=>{if(active()){refresh();observe();}},1000);
})();
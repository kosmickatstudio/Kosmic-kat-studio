/* KOSMIC KAT — Video V3 production interaction hardening
 * Post-render integrity layer for the existing V3 surface.
 * Does not create a second engine, provider, credential store, or renderer.
 * It only validates and repairs the existing V3 state/DOM after V3 renders.
 */
(function installKosmicVideoV3Hardening(){
  "use strict";
  if(window.__kosmicVideoV3InteractionHardening)return;
  window.__kosmicVideoV3InteractionHardening=true;

  const SEED25=[
    "seedance-2.5-text-to-video",
    "seedance-2.5-image-to-video",
    "seedance-2.5-reference-to-video",
    "seedance-2.5-video-edit",
    "seedance-2.5-video-extend"
  ];
  const $=id=>document.getElementById(id);
  const v3=()=>$("kkVideoCanvasV3")||document.querySelector(".kkv3");
  const state=()=>window.__kosmicVideoV3State;
  const catalog=()=>window.KOSMIC_EVOLINK_VIDEO?.index||{};
  const route=()=>catalog()[state()?.route]||null;
  const schema=()=>route()?.model?.schema||route()?.schema||{};
  const modeOf=r=>String(r?.mode||r?.id||"").includes("reference")?"reference":String(r?.mode||r?.id||"").includes("extend")?"extend":String(r?.mode||r?.id||"").includes("edit")?"edit":String(r?.mode||r?.id||"").includes("image")?"image":"text";
  const limits=()=>schema()?.refs||{};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const toast=(msg,type)=>{try{if(typeof window.toast==="function")window.toast(msg,type||"error");}catch(_){}};

  function css(){
    if($("kk-v3-hardening-css"))return;
    const s=document.createElement("style");s.id="kk-v3-hardening-css";
    s.textContent=`
      #kkVideoCanvasV3 .kkv3-tab[aria-selected="true"]{outline:2px solid rgba(98,64,176,.16);outline-offset:-2px}
      #kkVideoCanvasV3 .kkv3-pill[aria-pressed="true"],#kkVideoCanvasV3 .kkv3-route[aria-selected="true"]{box-shadow:0 0 0 2px rgba(98,64,176,.10) inset}
      #kkVideoCanvasV3 button:disabled{opacity:.42;cursor:not-allowed;filter:none;transform:none!important}
      #kkVideoCanvasV3 .kkv3-shot-actions{flex-wrap:wrap}
      #kkVideoCanvasV3 .kkv3-shot-actions button[disabled]{pointer-events:none}
      #kkVideoCanvasV3 .kkv3-reorder{display:inline-flex;align-items:center;justify-content:center;min-width:34px}
      #kkVideoCanvasV3 .kkv3-history-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:7px}
      #kkVideoCanvasV3 .kkv3-history-actions button{width:100%;margin:0}
      @media(max-width:700px){#kkVideoCanvasV3 .kkv3-shot-actions button{min-height:34px}}
    `;
    document.head.appendChild(s);
  }

  function rerender(){
    const root=v3();
    const tab=root?.querySelector('[data-workspace]');
    if(tab){tab.click();return;}
    window.dispatchEvent(new Event("kk-v3-hardening-rerender"));
  }

  function normalizeState(){
    const s=state(),r=route(),sc=schema();
    if(!s||!r)return false;
    const min=Number(sc.duration?.[0]??4),max=Number(sc.duration?.[1]??30);
    const qualities=Array.isArray(sc.quality)&&sc.quality.length?sc.quality:["720p"];
    const aspects=Array.isArray(sc.aspect)&&sc.aspect.length?sc.aspect.map(v=>v==="auto"?"adaptive":v):["16:9","9:16"];
    const before=JSON.stringify({d:s.duration,q:s.quality,a:s.aspect});
    s.duration=clamp(Number(s.duration)||min,min,max);
    if(!qualities.includes(s.quality))s.quality=qualities.includes("720p")?"720p":qualities[0];
    if(!aspects.includes(s.aspect))s.aspect=aspects.includes("16:9")?"16:9":aspects[0];
    const lim=limits();
    if(Array.isArray(s.images)&&Number.isFinite(Number(lim.images)))s.images=s.images.slice(0,Number(lim.images));
    if(Array.isArray(s.videos)&&Number.isFinite(Number(lim.videos)))s.videos=s.videos.slice(0,Number(lim.videos));
    if(Array.isArray(s.audios)&&Number.isFinite(Number(lim.audios)))s.audios=s.audios.slice(0,Number(lim.audios));
    return before!==JSON.stringify({d:s.duration,q:s.quality,a:s.aspect});
  }

  function enforceSeed25CatalogIntegrity(){
    const missing=SEED25.filter(id=>!catalog()[id]);
    window.__kosmicSeedance25Integrity={required:SEED25.slice(),missing,complete:missing.length===0,checkedAt:Date.now()};
    if(missing.length)console.error("Kosmic Seedance 2.5 route integrity failure",missing);
    return missing.length===0;
  }

  function enforceRouteRequirements(){
    const root=v3(),s=state(),r=route();if(!root||!s||!r)return;
    const m=modeOf(r),lim=limits();
    const reqImage=(m==="image"||m==="reference")&&Number(lim.images||0)>0;
    const reqVideo=(m==="edit"||m==="extend")&&Number(lim.videos||0)>0;
    const routeMissing=SEED25.includes(s.route)&&!catalog()[s.route];
    const genButtons=root.querySelectorAll("#kkv3Generate,#kkv3GenerateMobile,[data-stable-generate]");
    const prompt=String(root.querySelector("#kkv3Prompt")?.value||s.prompt||"").trim();
    const hasInput=(!reqImage||s.images?.length>0)&&(!reqVideo||s.videos?.length>0);
    genButtons.forEach(btn=>{
      const blocked=routeMissing||!prompt||!hasInput||!!s.busy;
      btn.disabled=blocked;
      if(routeMissing)btn.title="This Seedance 2.5 route is unavailable.";
      else if(!prompt)btn.title="Write a shot prompt first.";
      else if(!hasInput)btn.title=m==="image"||m==="reference"?"Add the required image reference first.":"Add the required video reference first.";
      else btn.removeAttribute("title");
      btn.setAttribute("aria-disabled",blocked?"true":"false");
    });
  }

  function enforceRouteButtons(){
    const root=v3(),s=state();if(!root||!s)return;
    root.querySelectorAll("[data-route]").forEach(btn=>btn.setAttribute("aria-selected",btn.dataset.route===s.route?"true":"false"));
  }

  function moveShot(field,direction){
    const s=state();if(!s||!Array.isArray(s.storyboard))return;
    const row=field?.closest(".kkv3-shot"),prompt=row?.querySelector("[data-story-prompt]");
    const id=prompt?.dataset?.storyId||row?.dataset?.storyId;
    let index=id?s.storyboard.findIndex(x=>String(x.id)===String(id)):-1;
    if(index<0){const all=Array.from(v3()?.querySelectorAll("[data-story-prompt]")||[]);index=all.indexOf(prompt||field);}
    if(index<0)return;
    const next=index+(direction===-1?-1:1);if(next<0||next>=s.storyboard.length)return;
    const [shot]=s.storyboard.splice(index,1);s.storyboard.splice(next,0,shot);rerender();
  }

  function enforceShotActions(){
    const root=v3(),s=state();if(!root||!s||!Array.isArray(s.storyboard))return;
    const fields=root.querySelectorAll("[data-story-prompt]");
    fields.forEach((field,index)=>{
      const row=field.closest(".kkv3-shot");if(!row)return;
      const remove=row.querySelector("[data-story-remove]"),copy=row.querySelector("[data-story-copy]");
      if(remove){const only=fields.length===1;remove.disabled=only;remove.title=only?"The storyboard needs at least one shot.":"Remove this shot";remove.setAttribute("aria-disabled",only?"true":"false");}
      if(copy){const first=index===0;copy.disabled=first;copy.title=first?"There is no previous shot to copy.":"Copy the previous shot's prompt";copy.setAttribute("aria-disabled",first?"true":"false");}
      let reorder=row.querySelector(".kkv3-reorder-wrap");
      if(!reorder){
        reorder=document.createElement("span");reorder.className="kkv3-reorder-wrap";reorder.style.cssText="display:inline-flex;gap:6px";
        const up=document.createElement("button"),down=document.createElement("button");
        Object.assign(up,{type:"button",className:"kkv3-reorder",textContent:"↑",title:"Move shot up"});up.setAttribute("aria-label","Move shot up");up.dataset.kkReorder="up";
        Object.assign(down,{type:"button",className:"kkv3-reorder",textContent:"↓",title:"Move shot down"});down.setAttribute("aria-label","Move shot down");down.dataset.kkReorder="down";
        reorder.append(up,down);row.querySelector(".kkv3-shot-actions")?.appendChild(reorder);
        up.addEventListener("click",()=>moveShot(field,-1));down.addEventListener("click",()=>moveShot(field,1));
      }
      const up=reorder.querySelector('[data-kk-reorder="up"]'),down=reorder.querySelector('[data-kk-reorder="down"]');
      if(up)up.disabled=index===0;if(down)down.disabled=index===fields.length-1;
    });
  }

  function normalizeRefsBeforeGenerate(){
    const s=state(),lim=limits();if(!s)return;
    const imageMax=Number(lim.images),videoMax=Number(lim.videos),audioMax=Number(lim.audios);
    if(Number.isFinite(imageMax)&&Array.isArray(s.images)&&s.images.length>imageMax){s.images=s.images.slice(0,imageMax);toast(`Only ${imageMax} image references are allowed on this route.`);}
    if(Number.isFinite(videoMax)&&Array.isArray(s.videos)&&s.videos.length>videoMax){s.videos=s.videos.slice(0,videoMax);toast(`Only ${videoMax} video references are allowed on this route.`);}
    if(Number.isFinite(audioMax)&&Array.isArray(s.audios)&&s.audios.length>audioMax){s.audios=s.audios.slice(0,audioMax);toast(`Only ${audioMax} audio references are allowed on this route.`);}
  }

  function guardFileInputs(){
    const root=v3();if(!root||root.__kkRefGuard)return;root.__kkRefGuard=true;
    root.addEventListener("change",e=>{
      const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=="file")return;
      const s=state(),lim=limits();if(!s)return;
      const kind=input.id.includes("Images")?"images":input.id.includes("Videos")?"videos":input.id.includes("Audios")?"audios":null;if(!kind)return;
      const max=Number(lim[kind]);
      if(Number.isFinite(max)&&input.files&&input.files.length>max){e.preventDefault();e.stopImmediatePropagation();input.value="";toast(`This route accepts at most ${max} ${kind.slice(0,-1)} references.`);return;}
      setTimeout(()=>{normalizeRefsBeforeGenerate();enforceRouteRequirements();},0);
    },true);
  }

  function addHistoryActions(){
    const root=v3(),s=state();if(!root||!s)return;
    root.querySelectorAll("[data-use-history]").forEach(btn=>{
      if(btn.parentElement?.querySelector(".kkv3-history-actions"))return;
      const i=Number(btn.dataset.useHistory),item=s.history?.[i];if(!item||item.error)return;
      btn.style.display="none";
      const wrap=document.createElement("div");wrap.className="kkv3-history-actions";
      [["Use as reference","reference"],["Edit","edit"],["Extend","extend"],["Regenerate","regenerate"],["Download","download"]].forEach(([label,action])=>{const b=document.createElement("button");b.type="button";b.className="kkv3-secondary";b.textContent=label;b.dataset.historyAction=action;b.dataset.historyIndex=String(i);wrap.appendChild(b);});
      btn.parentElement?.appendChild(wrap);
    });
  }

  async function useHistoryAction(action,index){
    const s=state(),item=s?.history?.[index];if(!item)return;
    if(action==="download"){
      if(!/^https?:\/\//i.test(String(item.url||""))){toast("This generated result has no downloadable URL.");return;}
      try{if(typeof window.downloadWithName==="function")await window.downloadWithName(item.url,`kosmic-kat-${Date.now()}.mp4`);else{const a=document.createElement("a");a.href=item.url;a.download=`kosmic-kat-${Date.now()}.mp4`;a.target="_blank";a.rel="noopener";document.body.appendChild(a);a.click();a.remove();}}catch(e){toast(e?.message||"Download failed.");}return;
    }
    if(action==="regenerate"){s.prompt=String(item.prompt||"");s.workspace="shot";rerender();setTimeout(()=>$("kkv3Generate")?.click(),50);return;}
    if(action==="edit"||action==="extend"){
      const target=Object.values(catalog()).find(x=>x.mode===action&&String(x.model?.name||"").toLowerCase().includes("seedance 2.5"))||Object.values(catalog()).find(x=>x.mode===action);
      if(!target){toast(`No ${action} video route is currently available.`);return;}
      s.route=target.id;s.videos=[{url:item.url,name:"Generated video"}];s.images=[];s.audios=[];s.prompt=String(item.prompt||"");s.workspace="shot";normalizeState();rerender();return;
    }
    if(action==="reference"){s.route="seedance-2.5-reference-to-video";s.videos=[{url:item.url,name:"Generated video reference"}];s.images=[];s.audios=[];s.prompt=String(item.prompt||"");s.workspace="shot";normalizeState();rerender();return;}
  }

  function bindHistoryActions(){
    const root=v3();if(!root||root.__kkHistoryBound)return;root.__kkHistoryBound=true;
    root.addEventListener("click",e=>{const b=e.target.closest?.("[data-history-action]");if(!b)return;e.preventDefault();e.stopPropagation();useHistoryAction(b.dataset.historyAction,Number(b.dataset.historyIndex));});
  }

  function harden(){
    const root=v3();if(!root||!state())return;
    enforceSeed25CatalogIntegrity();normalizeState();normalizeRefsBeforeGenerate();enforceRouteButtons();enforceShotActions();enforceRouteRequirements();guardFileInputs();addHistoryActions();bindHistoryActions();
    root.querySelectorAll("button").forEach(btn=>{if(!btn.getAttribute("type"))btn.setAttribute("type","button");});
    const prompt=root.querySelector("#kkv3Prompt");if(prompt){prompt.setAttribute("aria-label","Video shot prompt");prompt.setAttribute("autocomplete","off");}
  }

  function guardLegacyLayers(){
    const panel=$("vcSettingsPanel"),backdrop=$("vcSettingsBackdrop");
    if(panel&&panel.classList.contains("open")){panel.classList.remove("open","active","show","is-open");panel.setAttribute("aria-hidden","true");}
    if(backdrop&&backdrop.classList.contains("open")){backdrop.classList.remove("open","active","show","is-open");backdrop.setAttribute("aria-hidden","true");}
    document.body.classList.remove("kkv2-settings-open");
  }

  function boot(){
    css();
    const mo=new MutationObserver(()=>{guardLegacyLayers();if(v3())harden();});
    mo.observe(document.body,{childList:true,subtree:true});
    window.__kosmicVideoV3HardeningObserver=mo;
    document.addEventListener("click",()=>setTimeout(()=>{guardLegacyLayers();harden();},0),true);
    document.addEventListener("input",e=>{if(e.target?.id==="kkv3Prompt")setTimeout(()=>enforceRouteRequirements(),0);},true);
    harden();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

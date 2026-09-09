/* KOSMIC KAT — EvoLink Playground route/schema surface
 * Adds a non-destructive route + schema inspector to the existing playground.
 * It never replaces the generator controls.
 */
(function installEvoLinkPlaygroundComplete(){
  "use strict";
  if(window.__kosmicEvoPlaygroundComplete)return;
  window.__kosmicEvoPlaygroundComplete=true;

  const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));
  const schemaRows=schema=>Object.entries(schema||{}).map(([k,v])=>{
    const value=Array.isArray(v)?v.join(" → "):typeof v==="object"?JSON.stringify(v):String(v);
    return `<div class="evo-schema-row"><span>${esc(k)}</span><strong>${esc(value)}</strong></div>`;
  }).join("");

  function findModelControl(modal){
    return modal.querySelector('select[name="model"],select[id*="model" i],input[name="model"],input[id*="model" i]');
  }
  function selectedModel(modal,api){
    const control=findModelControl(modal);
    if(control&&control.value&&api.index?.[control.value])return api.index[control.value].model;
    return api.catalog?.find(c=>c.availability!=="coming_soon")||api.catalog?.[0];
  }
  function render(modal){
    const api=window.KOSMIC_EVOLINK_VIDEO;if(!api?.catalog)return;
    let box=modal.querySelector(".evo-route-schema-panel");
    if(!box){box=document.createElement("section");box.className="evo-route-schema-panel";(modal.querySelector(".evo-playground-sheet")||modal).appendChild(box);}
    const card=selectedModel(modal,api);if(!card)return;
    const routes=card.routes||[];
    box.innerHTML=`<div class="evo-route-schema-head"><div><div class="evo-kicker">ROUTE + SCHEMA</div><div class="evo-route-schema-title">${esc(card.name)}</div><div class="evo-route-schema-meta">${esc(card.provider)} · ${esc(card.group)}${card.availability==="coming_soon"?" · COMING SOON":""}</div></div><button type="button" class="evo-route-schema-refresh">Refresh</button></div><div class="evo-route-chips">${routes.map((r,i)=>`<button type="button" class="evo-route-chip${i===0?" active":""}" data-evo-route-id="${esc(r.id)}">${esc(r.label||r.mode||r.id)}</button>`).join("")}</div><div class="evo-route-schema-body"><div class="evo-schema-route-id">${esc(routes[0]?.id||"")}</div><div class="evo-schema-grid">${schemaRows(card.schema)}</div></div>`;
    const idEl=box.querySelector(".evo-schema-route-id");
    box.querySelectorAll(".evo-route-chip").forEach(chip=>chip.addEventListener("click",()=>{
      box.querySelectorAll(".evo-route-chip").forEach(x=>x.classList.remove("active"));chip.classList.add("active");
      const route=routes.find(r=>r.id===chip.dataset.evoRouteId)||routes[0];
      if(idEl)idEl.textContent=route?.id||"";
      const control=findModelControl(modal);
      if(control&&route?.id){
        control.value=route.id;
        control.dispatchEvent(new Event("change",{bubbles:true}));
      }
    }));
    box.querySelector(".evo-route-schema-refresh")?.addEventListener("click",()=>render(modal));
  }

  let lastSignature="";
  const watch=()=>{
    const modal=document.getElementById("evoVideoPlaygroundModal");
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!modal||!api?.catalog||getComputedStyle(modal).display==="none")return;
    const control=findModelControl(modal);
    const signature=`${control?.value||""}|${api.routeRevision||""}`;
    if(signature!==lastSignature){lastSignature=signature;render(modal);}
  };
  let tries=0;const timer=setInterval(()=>{watch();if(++tries>160)clearInterval(timer);},100);
  document.addEventListener("click",e=>{
    if(e.target.closest("#evoVideoPlaygroundLaunch"))setTimeout(()=>{lastSignature="";watch();},0);
  },true);
})();

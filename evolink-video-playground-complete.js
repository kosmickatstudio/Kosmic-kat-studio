/* KOSMIC KAT — EvoLink Video Playground
 * Phase 11: complete model + route + schema explorer.
 *
 * Non-destructive: this surface is an inspector/picker for the existing
 * playground. It does not replace the generator, settings sheet, or native
 * model routing. Selecting a route syncs an existing model <select> when one
 * is present; otherwise it changes inspector state only.
 */
(function installEvoLinkPlaygroundComplete(){
  "use strict";
  if(window.__kosmicEvoPlaygroundComplete)return;
  window.__kosmicEvoPlaygroundComplete=true;

  const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));
  const isOpen=el=>el&&getComputedStyle(el).display!=="none";
  const schemaValue=v=>Array.isArray(v)?v.join(" · "):typeof v==="object"?JSON.stringify(v):String(v);

  function findModelControl(modal){
    return modal.querySelector('select[name="model"],select[id*="model" i],input[name="model"],input[id*="model" i]');
  }
  function ensureShell(modal){
    let panel=modal.querySelector(".evo-route-schema-panel");
    if(panel)return panel;
    panel=document.createElement("section");
    panel.className="evo-route-schema-panel";
    (modal.querySelector(".evo-playground-sheet")||modal).appendChild(panel);
    return panel;
  }
  function render(modal,state){
    const api=window.KOSMIC_EVOLINK_VIDEO;if(!api?.catalog?.length)return;
    const panel=ensureShell(modal);
    const cards=api.catalog.slice();
    const activeCard=cards.find(c=>c.id===state.cardId)||cards[0];
    if(!activeCard)return;
    state.cardId=activeCard.id;
    const routes=activeCard.routes||[];
    if(!state.routeId||!routes.some(r=>r.id===state.routeId))state.routeId=routes[0]?.id||"";
    const activeRoute=routes.find(r=>r.id===state.routeId)||routes[0];

    const modelOptions=cards.map(c=>`<button type="button" class="evo-model-card${c.id===state.cardId?" active":""}" data-evo-card-id="${esc(c.id)}"><span class="evo-model-name">${esc(c.name)}</span><span class="evo-model-meta">${esc(c.provider)} · ${esc(c.group)}</span></button>`).join("");
    const routeChips=routes.map(r=>`<button type="button" class="evo-route-chip${r.id===state.routeId?" active":""}" data-evo-route-id="${esc(r.id)}">${esc(r.label||r.mode||r.id)}</button>`).join("");
    const schemaRows=Object.entries(activeCard.schema||{}).map(([k,v])=>`<div class="evo-schema-row"><span>${esc(k)}</span><strong>${esc(schemaValue(v))}</strong></div>`).join("");

    panel.innerHTML=`
      <div class="evo-route-schema-head">
        <div>
          <div class="evo-kicker">EVOLINK · LIVE CATALOG</div>
          <div class="evo-route-schema-title">${esc(activeCard.name)}</div>
          <div class="evo-route-schema-meta">${esc(activeCard.provider)} · ${esc(activeCard.group)} · ${api.liveVideoCardCount||cards.length} models · ${api.liveRouteCount||Object.keys(api.index||{}).length} routes</div>
        </div>
        <button type="button" class="evo-route-schema-refresh" data-evo-refresh>Refresh</button>
      </div>
      <div class="evo-model-browser-label">Video model</div>
      <div class="evo-model-browser" role="listbox" aria-label="EvoLink video models">${modelOptions}</div>
      <div class="evo-route-browser-label">Route</div>
      <div class="evo-route-chips">${routeChips}</div>
      <div class="evo-route-schema-body">
        <div class="evo-schema-route-id">${esc(activeRoute?.id||"")}</div>
        <div class="evo-schema-grid">${schemaRows||'<div class="evo-schema-empty">No additional schema fields documented for this route.</div>'}</div>
      </div>`;

    panel.querySelectorAll("[data-evo-card-id]").forEach(btn=>btn.addEventListener("click",()=>{
      state.cardId=btn.dataset.evoCardId;state.routeId="";render(modal,state);
    }));
    panel.querySelectorAll("[data-evo-route-id]").forEach(btn=>btn.addEventListener("click",()=>{
      state.routeId=btn.dataset.evoRouteId;render(modal,state);
      const control=findModelControl(modal);
      if(control&&state.routeId){
        const canSet=Array.from(control.options||[]).some(o=>o.value===state.routeId);
        if(canSet){control.value=state.routeId;control.dispatchEvent(new Event("change",{bubbles:true}));}
      }
    }));
    panel.querySelector("[data-evo-refresh]")?.addEventListener("click",()=>{
      const fresh=window.KOSMIC_EVOLINK_VIDEO;
      if(fresh){state.cardId=fresh.catalog?.find(c=>c.id===state.cardId)?.id||fresh.catalog?.[0]?.id;state.routeId="";render(modal,state);}
    });
  }

  function watch(){
    const modal=document.getElementById("evoVideoPlaygroundModal");
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!modal||!api?.catalog?.length||!isOpen(modal))return;
    const control=findModelControl(modal);
    const initial=control&&api.index?.[control.value]?.model?.id;
    const key=`${initial||api.catalog[0].id}|${api.routeRevision||""}`;
    const state=modal.__evoInspectorState||(modal.__evoInspectorState={cardId:initial||api.catalog[0].id,routeId:"",signature:""});
    if(state.signature!==key){state.signature=key;state.cardId=initial||state.cardId||api.catalog[0].id;state.routeId="";render(modal,state);}
  }

  document.addEventListener("click",event=>{
    const launch=event.target.closest?.("#evoVideoPlaygroundLaunch");
    if(launch)setTimeout(watch,0);
  },true);
  let tries=0;const timer=setInterval(()=>{watch();if(++tries>180)clearInterval(timer);},250);
})();

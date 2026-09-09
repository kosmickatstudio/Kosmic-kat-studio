/* KOSMIC KAT — EVO LINK VIDEO ROUTE HUD
 * Small read-only status surface inside the EXISTING Video Canvas.
 * No new playground, no generation interception, no mutation observer.
 */
(function installEvoLinkRouteHud(){
  "use strict";
  if(window.__kosmicEvoLinkRouteHud)return;
  window.__kosmicEvoLinkRouteHud=true;

  const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  const textList=v=>Array.isArray(v)?v.join(" · "):v?String(v):"";
  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    const sel=document.getElementById("vcModel");
    if(!api?.index||!sel)return false;
    const host=sel.closest(".f-group,.vc-model-wrap,.model-control,.control-group")||sel.parentElement;
    if(!host)return false;
    let hud=host.parentElement?.querySelector(".evo-route-hud");
    if(!hud){hud=document.createElement("div");hud.className="evo-route-hud";(host.parentElement||host).appendChild(hud);}
    const update=()=>{
      const route=api.index?.[sel.value];
      if(!route){hud.hidden=true;return;}
      hud.hidden=false;
      const schema=route.model?.schema||{};
      const refs=schema.refs||{};
      const modeLabel=route.label||route.mode||"Route";
      const details=[];
      if(schema.duration?.length)details.push(`${schema.duration[0]}–${schema.duration[1]}s`);
      if(schema.quality?.length)details.push(textList(schema.quality));
      if(schema.aspect?.length)details.push(`${schema.aspect.length} ratios`);
      if(refs.images)details.push(`${refs.images} img ref${Number(refs.images)===1?"":"s"}`);
      if(refs.videos)details.push(`${refs.videos} video ref${Number(refs.videos)===1?"":"s"}`);
      if(refs.audios)details.push(`${refs.audios} audio ref${Number(refs.audios)===1?"":"s"}`);
      hud.innerHTML=`<div class="evo-route-hud-top"><span class="evo-route-hud-kicker">EVOLINK ROUTE</span><span class="evo-route-hud-name">${esc(modeLabel)}</span></div><div class="evo-route-hud-id">${esc(route.id)}</div><div class="evo-route-hud-meta">${esc(details.join("  ·  ")||"Schema available in provider API")}</div>`;
    };
    sel.addEventListener("change",update,{passive:true});
    update();
    return true;
  };
  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>160)clearInterval(timer);},100);
  }
})();

/* Kosmic Engine strategy visibility. UI-only augmentation; does not alter
   generation, auth, session, API-key storage, or model routing. */
(function(){
  "use strict";
  const STYLE="kg-strategy-visibility-style";
  const css=`
.kg-production-strategy{margin:8px 0 0;padding:9px 10px;border:1px solid var(--glass-brd);border-radius:14px;background:rgba(255,255,255,.30);color:var(--textm);font-size:9px;line-height:1.45}.kg-production-strategy-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:var(--texts)}.kg-production-strategy-lock{color:var(--green);font-size:8px}.kg-production-strategy-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.kg-production-strategy-cell{min-width:0;padding:6px 7px;border-radius:9px;background:rgba(255,255,255,.32);overflow:hidden}.kg-production-strategy-k{display:block;font-size:8px;font-weight:800;color:var(--texts);margin-bottom:2px}.kg-production-strategy-v{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-weight:700}.kg-production-strategy-note{margin-top:6px}.kg-production-strategy-error{margin-top:6px;color:var(--red,#ef4444);font-weight:800}@media(max-width:700px){.kg-production-strategy{padding:8px}.kg-production-strategy-grid{grid-template-columns:1fr 1fr}}
`;
  function style(){if(document.getElementById(STYLE))return;const s=document.createElement("style");s.id=STYLE;s.textContent=css;document.head.appendChild(s)}
  function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
  function short(v){return String(v||"pending").replace(/^fal-ai\//,"").replace(/^bytedance\//,"").replace(/reference-to-video/g,"video").replace(/text-to-image/g,"image").replace(/\//g," · ")}
  function paint(){
    const bar=document.getElementById("dcInputBar"),panel=document.getElementById("kgSettingsPanel");if(!bar||!panel)return;
    style();
    let box=document.getElementById("kgProductionStrategy");
    if(!box){box=document.createElement("div");box.id="kgProductionStrategy";box.className="kg-production-strategy";panel.appendChild(box)}
    const d=window.S&&S.directorChat?S.directorChat:null;
    if(!d||!d.productionId){box.innerHTML='<div class="kg-production-strategy-head"><span>Production strategy</span><span>PRE-START</span></div><div class="kg-production-strategy-note">Your selected Engine brain locks at production start. Generation models will be chosen from the production strategy checkpoint.</div>';return}
    const p=(S.productions||[]).find(x=>x.id===d.productionId),draft=d.draft||{};
    const engine=draft.engineModel||d.engineTier||"selected",brain=draft.brainSubModel||draft.engineModel||"selected",provider=draft.brainModel||"provider";
    const image=p&&p.imageModel,video=p&&p.videoModel,error=p&&p.modelSelectionError;
    box.innerHTML=`<div class="kg-production-strategy-head"><span>Locked production strategy</span><span class="kg-production-strategy-lock">● LOCKED</span></div><div class="kg-production-strategy-grid"><div class="kg-production-strategy-cell"><span class="kg-production-strategy-k">Engine</span><span class="kg-production-strategy-v" title="${esc(engine)}">${esc(String(engine).toUpperCase())}</span></div><div class="kg-production-strategy-cell"><span class="kg-production-strategy-k">AI Brain</span><span class="kg-production-strategy-v" title="${esc(brain)}">${esc(String(provider).toUpperCase())} · ${esc(brain)}</span></div><div class="kg-production-strategy-cell"><span class="kg-production-strategy-k">Image</span><span class="kg-production-strategy-v" title="${esc(image||"pending")}">${esc(short(image))}</span></div><div class="kg-production-strategy-cell"><span class="kg-production-strategy-k">Video</span><span class="kg-production-strategy-v" title="${esc(video||"pending")}">${esc(short(video))}</span></div></div>${error?`<div class="kg-production-strategy-error">Model selection blocked: ${esc(error)}</div>`:'<div class="kg-production-strategy-note">Brain/model controls are locked for this production, preventing accidental mid-run strategy changes.</div>'}`;
  }
  function boot(){paint();const ob=new MutationObserver(paint);ob.observe(document.body,{childList:true,subtree:true});setInterval(paint,1500)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

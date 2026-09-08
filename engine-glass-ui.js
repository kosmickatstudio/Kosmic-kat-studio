/* Kosmic Engine Glass Composer UI
 * Presentation-only enhancement. It does not own generation, auth, session,
 * API-key, model-routing, or persistence logic. Existing Engine controls keep
 * their IDs and inline handlers so the production pipeline remains untouched.
 */
(function(){
  "use strict";
  const STYLE_ID="kosmic-engine-glass-ui-style";
  const ROOT_CLASS="kosmic-engine-glass-input";
  let wired=false;

  const css=`
#dcInputBar.${ROOT_CLASS}{position:relative!important;margin:10px!important;padding:12px!important;border:1px solid rgba(255,255,255,.78)!important;border-top-color:rgba(255,255,255,.94)!important;border-radius:28px!important;background:linear-gradient(135deg,rgba(255,255,255,.76),rgba(246,242,255,.58))!important;-webkit-backdrop-filter:blur(28px) saturate(150%);backdrop-filter:blur(28px) saturate(150%);box-shadow:0 18px 50px rgba(86,61,140,.13),inset 0 1px 0 rgba(255,255,255,.88)!important;overflow:visible!important}
html[data-theme="dark"] #dcInputBar.${ROOT_CLASS}{background:linear-gradient(135deg,rgba(35,27,52,.82),rgba(25,19,38,.70))!important;border-color:rgba(195,174,250,.22)!important;border-top-color:rgba(255,255,255,.16)!important;box-shadow:0 20px 54px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.10)!important}
#dcInputBar.${ROOT_CLASS}::before{content:"";position:absolute;inset:1px;border-radius:27px;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.26),transparent 36%,rgba(196,181,253,.10))}
.kg-glass-top{position:relative;z-index:2;display:flex;align-items:center;gap:8px;min-height:28px;margin:0 2px 8px;padding:0 2px}.kg-glass-title{font-family:var(--font-display,'Space Grotesk',sans-serif);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--textm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kg-glass-status{width:6px;height:6px;border-radius:50%;background:var(--green,#10B981);box-shadow:0 0 0 4px rgba(16,185,129,.10),0 0 10px rgba(16,185,129,.35);flex-shrink:0}.kg-settings-btn{margin-left:auto;width:34px;height:34px;border:1px solid var(--glass-brd);border-radius:12px;background:rgba(255,255,255,.46);color:var(--textm);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;transition:transform .18s,background .18s,border-color .18s,box-shadow .18s;flex-shrink:0}html[data-theme="dark"] .kg-settings-btn{background:rgba(255,255,255,.06)}.kg-settings-btn:hover,.kg-settings-btn:focus-visible{transform:translateY(-1px);background:var(--surface);border-color:var(--ice);box-shadow:0 6px 18px var(--glow-ice);outline:none}.kg-settings-btn[aria-expanded="true"]{background:var(--surface);border-color:var(--violet);color:var(--violet)}
.kg-settings-panel{position:relative;z-index:5;display:none;margin:0 0 9px;padding:10px;border:1px solid var(--glass-brd);border-radius:20px;background:rgba(255,255,255,.48);-webkit-backdrop-filter:blur(24px) saturate(150%);backdrop-filter:blur(24px) saturate(150%);box-shadow:0 14px 34px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.70)}html[data-theme="dark"] .kg-settings-panel{background:rgba(28,21,42,.78);box-shadow:0 18px 38px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.08)}.kg-settings-panel.open{display:block;animation:kgPanelIn .18s ease-out}@keyframes kgPanelIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}.kg-settings-label{font-size:9px;font-weight:800;letter-spacing:.12em;color:var(--texts);margin:1px 2px 7px;text-transform:uppercase}
#dcEngineModes.kg-modes{display:flex!important;gap:7px!important;margin:0 0 9px!important;padding:1px!important;overflow-x:auto!important;scrollbar-width:none!important}#dcEngineModes.kg-modes::-webkit-scrollbar{display:none}#dcEngineModes.kg-modes button{min-height:38px!important;padding:8px 12px!important;border-radius:13px!important;border:1px solid var(--glass-brd)!important;background:rgba(255,255,255,.52)!important;color:var(--textm)!important;font-size:10px!important;font-weight:800!important;white-space:nowrap!important;transition:transform .18s,box-shadow .18s,border-color .18s,background .18s!important}html[data-theme="dark"] #dcEngineModes.kg-modes button{background:rgba(255,255,255,.06)!important}#dcEngineModes.kg-modes button:hover{transform:translateY(-1px)!important;border-color:var(--ice)!important;box-shadow:0 7px 18px var(--glow-ice)!important}#dcEngineModelRow.kg-model-row{margin:0!important;padding:8px 9px!important;border:1px solid var(--glass-brd)!important;border-radius:13px!important;background:rgba(255,255,255,.38)!important}html[data-theme="dark"] #dcEngineModelRow.kg-model-row{background:rgba(255,255,255,.045)!important}#dcEngineModelRow.kg-model-row select{height:34px!important;border-radius:10px!important;background:var(--surface)!important;color:var(--text)!important}
#dcRefStrip.kg-ref-strip{position:relative!important;z-index:2;display:flex!important;gap:7px!important;flex-wrap:wrap!important;margin:0 0 8px!important;padding:2px!important}#dcRefStrip.kg-ref-strip:empty{display:none!important}#dcRefStrip.kg-ref-strip img{width:52px!important;height:52px!important;border-radius:12px!important;border:1px solid var(--glass-brd)!important;box-shadow:0 5px 14px rgba(61,31,122,.10)!important}#dcInputBar.${ROOT_CLASS}>div:last-child{position:relative!important;z-index:2}
#dcInputBar.${ROOT_CLASS} textarea#dcInput{min-height:42px!important;max-height:150px!important;background:rgba(255,255,255,.60)!important;border:1px solid rgba(61,31,122,.10)!important;border-radius:18px!important;padding:11px 14px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.72)!important;resize:none!important;line-height:1.42!important;color:var(--text)!important}html[data-theme="dark"] #dcInputBar.${ROOT_CLASS} textarea#dcInput{background:rgba(255,255,255,.06)!important;border-color:var(--glass-brd)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important}#dcInputBar.${ROOT_CLASS} textarea#dcInput:focus{border-color:var(--ice)!important;box-shadow:0 0 0 3px var(--glow-ice),inset 0 1px 0 rgba(255,255,255,.72)!important;outline:none!important}#dcInputBar.${ROOT_CLASS} textarea#dcInput::placeholder{color:var(--texts)!important}
#dcInputBar.${ROOT_CLASS} .kg-attach-btn{width:42px!important;height:42px!important;border-radius:14px!important;border:1px solid var(--glass-brd)!important;background:rgba(255,255,255,.50)!important;color:var(--violet)!important;font-size:20px!important;box-shadow:0 4px 12px rgba(61,31,122,.07)!important;transition:transform .18s,box-shadow .18s!important}html[data-theme="dark"] #dcInputBar.${ROOT_CLASS} .kg-attach-btn{background:rgba(255,255,255,.06)!important}#dcInputBar.${ROOT_CLASS} .kg-attach-btn:hover{transform:translateY(-1px);box-shadow:0 7px 18px var(--glow-ice)!important}#dcInputBar.${ROOT_CLASS} .ig-send-btn{width:44px!important;height:44px!important;border-radius:15px!important;border:0!important;background:linear-gradient(135deg,var(--violet),var(--ice))!important;color:#fff!important;box-shadow:0 8px 22px var(--glow-ice)!important;flex-shrink:0!important;transition:transform .18s,box-shadow .18s,opacity .18s!important}#dcInputBar.${ROOT_CLASS} .ig-send-btn:hover{transform:translateY(-1px) scale(1.02)!important;box-shadow:0 11px 28px var(--glow-ice)!important}#dcInputBar.${ROOT_CLASS} .ig-send-btn:active{transform:scale(.97)!important}
@media (max-width:700px){#dcInputBar.${ROOT_CLASS}{margin:7px 6px!important;padding:9px!important;border-radius:22px!important}#dcInputBar.${ROOT_CLASS}::before{border-radius:21px}.kg-glass-top{margin-bottom:6px}.kg-settings-panel{border-radius:17px;padding:9px}#dcEngineModes.kg-modes button{min-height:40px!important;padding:8px 11px!important}#dcInputBar.${ROOT_CLASS} textarea#dcInput{min-height:42px!important;font-size:13px!important;padding:10px 12px!important}#dcInputBar.${ROOT_CLASS} .kg-attach-btn{width:40px!important;height:40px!important;border-radius:13px!important}#dcInputBar.${ROOT_CLASS} .ig-send-btn{width:42px!important;height:42px!important;border-radius:14px!important}}@media (prefers-reduced-motion:reduce){.kg-settings-panel.open,.kg-settings-btn,#dcEngineModes.kg-modes button,#dcInputBar.${ROOT_CLASS} .ig-send-btn{animation:none!important;transition:none!important}}
`;

  function addStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement("style");s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s)}

  function wire(){
    const bar=document.getElementById("dcInputBar");if(!bar)return;addStyle();bar.classList.add(ROOT_CLASS);
    if(!document.getElementById("kgGlassTop")){const top=document.createElement("div");top.id="kgGlassTop";top.className="kg-glass-top";top.innerHTML='<span class="kg-glass-status" aria-hidden="true"></span><span class="kg-glass-title">Kosmic Engine · ready to create</span><button type="button" class="kg-settings-btn" id="kgSettingsBtn" aria-expanded="false" aria-controls="kgSettingsPanel" title="Engine settings">⚙</button>';bar.insertBefore(top,bar.firstChild)}
    const modes=document.getElementById("dcEngineModes"),modelRow=document.getElementById("dcEngineModelRow");let panel=document.getElementById("kgSettingsPanel");
    if(!panel){panel=document.createElement("div");panel.id="kgSettingsPanel";panel.className="kg-settings-panel";panel.setAttribute("aria-label","Engine settings");const label=document.createElement("div");label.className="kg-settings-label";label.textContent="Engine settings";panel.appendChild(label);bar.insertBefore(panel,bar.querySelector("#dcRefStrip")||bar.children[1]||null)}
    if(modes&&!panel.contains(modes)){modes.classList.add("kg-modes");panel.appendChild(modes)}if(modelRow&&!panel.contains(modelRow)){modelRow.classList.add("kg-model-row");panel.appendChild(modelRow)}
    const refStrip=document.getElementById("dcRefStrip");if(refStrip)refStrip.classList.add("kg-ref-strip");const attach=bar.querySelector('button[title="Add a reference image"]');if(attach){attach.classList.add("kg-attach-btn");attach.setAttribute("aria-label","Add reference image")}
    const btn=document.getElementById("kgSettingsBtn");if(btn&&!btn.dataset.wired){btn.dataset.wired="1";btn.addEventListener("click",function(){const open=panel.classList.toggle("open");btn.setAttribute("aria-expanded",String(open))})}wired=true;
  }

  // Engine-selected multimodal routing for the two Engine brains that were
  // previously bypassed by the shared vision helper: Grok and Kimi K3.
  // This wrapper is deliberately scoped to an active Engine production and
  // delegates every other vision call to the existing application function.
  function installEngineVisionRouting(){
    const fn=window.callAiVision;if(typeof fn!=="function"||fn.__kosmicEngineVisionRouter)return;
    const wrapped=async function(refs,prompt,system){
      const d=window.S&&S.directorChat?S.directorChat:null;
      const draft=d&&d.draft?d.draft:null;
      const provider=draft&&draft.brainModel;
      const model=draft&&draft.engineModel;
      if(!d||!d.productionId||!draft||!model||!(provider==="grok"||provider==="kimi"))return fn.apply(this,arguments);
      const keyName=provider==="grok"?"api_xai":"api_evolink";
      const key=typeof window.gs==="function"?String(gs(keyName,"")).trim():"";
      if(!key)throw new Error(`${provider==="grok"?"Grok":"Kimi"} API key is missing for the selected Kosmic Engine model.`);
      const images=(Array.isArray(refs)?refs:[]).map(x=>x&&x.dataUrl?x.dataUrl:null).filter(Boolean);
      if(!images.length)return fn.apply(this,arguments);
      const content=[...images.map(url=>({type:"image_url",image_url:{url,detail:"high"}})),{type:"text",text:String(prompt||"")}];
      const endpoint=provider==="grok"?"https://api.x.ai/v1/chat/completions":"https://direct.evolink.ai/v1/chat/completions";
      const body={model,messages:[...(system?[{role:"system",content:String(system)}]:[]),{role:"user",content}],max_tokens:2000};
      if(provider==="grok")body.reasoning_effort="high";
      else body.reasoning_effort="max";
      const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization:`Bearer ${key}`},body:JSON.stringify(body)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error?.message||data?.message||`Vision request failed (${res.status})`);
      const text=data?.choices?.[0]?.message?.content;
      if(typeof text==="string")return text;
      if(Array.isArray(text))return text.map(x=>x?.text||"").join("").trim();
      throw new Error("Selected Engine vision model returned no text response.");
    };
    wrapped.__kosmicEngineVisionRouter=true;window.callAiVision=wrapped;
  }

  function observe(){
    wire();installEngineVisionRouting();
    const observer=new MutationObserver(function(){const bar=document.getElementById("dcInputBar");if((bar&&!bar.classList.contains(ROOT_CLASS))||!document.getElementById("kgSettingsBtn"))wire();installEngineVisionRouting()});
    observer.observe(document.body,{childList:true,subtree:true});
    window.setTimeout(wire,250);window.setTimeout(wire,1000);window.setTimeout(wire,2500);window.setTimeout(installEngineVisionRouting,500);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});else observe();
})();

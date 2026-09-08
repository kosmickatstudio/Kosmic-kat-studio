/* Kosmic Engine Glass UI + selected-brain vision bridge. Presentation and
   Engine-scoped multimodal routing only. Existing Engine/auth/session/API-key
   storage and generation handlers remain untouched. */
(function(){
  "use strict";
  const STYLE_ID="kosmic-engine-glass-ui-style",ROOT="kosmic-engine-glass-input";
  const css=`
#dcInputBar.${ROOT}{position:relative!important;margin:10px!important;padding:12px!important;border:1px solid rgba(255,255,255,.78)!important;border-top-color:rgba(255,255,255,.94)!important;border-radius:28px!important;background:linear-gradient(135deg,rgba(255,255,255,.76),rgba(246,242,255,.58))!important;-webkit-backdrop-filter:blur(28px) saturate(150%);backdrop-filter:blur(28px) saturate(150%);box-shadow:0 18px 50px rgba(86,61,140,.13),inset 0 1px 0 rgba(255,255,255,.88)!important;overflow:visible!important}
html[data-theme="dark"] #dcInputBar.${ROOT}{background:linear-gradient(135deg,rgba(35,27,52,.82),rgba(25,19,38,.70))!important;border-color:rgba(195,174,250,.22)!important;box-shadow:0 20px 54px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.10)!important}
#dcInputBar.${ROOT}::before{content:"";position:absolute;inset:1px;border-radius:27px;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.26),transparent 36%,rgba(196,181,253,.10))}
.kg-glass-top{position:relative;z-index:2;display:flex;align-items:center;gap:8px;min-height:28px;margin:0 2px 8px}.kg-glass-title{font-family:var(--font-display,'Space Grotesk',sans-serif);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--textm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kg-glass-status{width:6px;height:6px;border-radius:50%;background:var(--green,#10B981);box-shadow:0 0 0 4px rgba(16,185,129,.1),0 0 10px rgba(16,185,129,.35)}.kg-settings-btn{margin-left:auto;width:34px;height:34px;border:1px solid var(--glass-brd);border-radius:12px;background:rgba(255,255,255,.46);color:var(--textm);cursor:pointer;font-size:15px}.kg-settings-btn[aria-expanded="true"]{background:var(--surface);color:var(--violet);border-color:var(--violet)}
.kg-settings-panel{position:relative;z-index:5;display:none;margin:0 0 9px;padding:10px;border:1px solid var(--glass-brd);border-radius:20px;background:rgba(255,255,255,.48);-webkit-backdrop-filter:blur(24px) saturate(150%);backdrop-filter:blur(24px) saturate(150%);box-shadow:0 14px 34px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.70)}.kg-settings-panel.open{display:block}.kg-settings-label{font-size:9px;font-weight:800;letter-spacing:.12em;color:var(--texts);margin:1px 2px 7px;text-transform:uppercase}
#dcEngineModes.kg-modes{display:flex!important;gap:7px!important;margin:0 0 9px!important;padding:1px!important;overflow-x:auto!important;scrollbar-width:none!important}#dcEngineModes.kg-modes::-webkit-scrollbar{display:none}#dcEngineModes.kg-modes button{min-height:38px!important;padding:8px 12px!important;border-radius:13px!important;border:1px solid var(--glass-brd)!important;background:rgba(255,255,255,.52)!important;color:var(--textm)!important;font-size:10px!important;font-weight:800!important;white-space:nowrap!important}
#dcEngineModelRow.kg-model-row{margin:0!important;padding:8px 9px!important;border:1px solid var(--glass-brd)!important;border-radius:13px!important;background:rgba(255,255,255,.38)!important}#dcEngineModelRow.kg-model-row select{height:34px!important;border-radius:10px!important;background:var(--surface)!important;color:var(--text)!important}
#dcRefStrip.kg-ref-strip{position:relative!important;z-index:2;display:flex!important;gap:7px!important;flex-wrap:wrap!important;margin:0 0 8px!important;padding:2px!important}#dcRefStrip.kg-ref-strip:empty{display:none!important}#dcRefStrip.kg-ref-strip img{width:52px!important;height:52px!important;border-radius:12px!important;border:1px solid var(--glass-brd)!important;box-shadow:0 5px 14px rgba(61,31,122,.1)!important}
#dcInputBar.${ROOT} textarea#dcInput{min-height:42px!important;max-height:150px!important;background:rgba(255,255,255,.60)!important;border:1px solid rgba(61,31,122,.10)!important;border-radius:18px!important;padding:11px 14px!important;resize:none!important;color:var(--text)!important}#dcInputBar.${ROOT} textarea#dcInput:focus{border-color:var(--ice)!important;box-shadow:0 0 0 3px var(--glow-ice)!important;outline:none!important}#dcInputBar.${ROOT} .kg-attach-btn{width:42px!important;height:42px!important;border-radius:14px!important;border:1px solid var(--glass-brd)!important;background:rgba(255,255,255,.50)!important;color:var(--violet)!important;font-size:20px!important}#dcInputBar.${ROOT} .ig-send-btn{width:44px!important;height:44px!important;border-radius:15px!important;border:0!important;background:linear-gradient(135deg,var(--violet),var(--ice))!important;color:#fff!important;box-shadow:0 8px 22px var(--glow-ice)!important}
@media(max-width:700px){#dcInputBar.${ROOT}{margin:7px 6px!important;padding:9px!important;border-radius:22px!important}#dcInputBar.${ROOT}::before{border-radius:21px}.kg-settings-panel{border-radius:17px;padding:9px}#dcEngineModes.kg-modes button{min-height:40px!important;padding:8px 11px!important}#dcInputBar.${ROOT} textarea#dcInput{font-size:13px!important;padding:10px 12px!important}#dcInputBar.${ROOT} .kg-attach-btn{width:40px!important;height:40px!important}#dcInputBar.${ROOT} .ig-send-btn{width:42px!important;height:42px!important}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;
  function addStyle(){if(document.getElementById(STYLE_ID))return;const s=document.createElement("style");s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s)}
  function wire(){
    const bar=document.getElementById("dcInputBar");if(!bar)return;addStyle();bar.classList.add(ROOT);
    if(!document.getElementById("kgGlassTop")){const top=document.createElement("div");top.id="kgGlassTop";top.className="kg-glass-top";top.innerHTML='<span class="kg-glass-status" aria-hidden="true"></span><span class="kg-glass-title">Kosmic Engine · ready to create</span><button type="button" class="kg-settings-btn" id="kgSettingsBtn" aria-expanded="false" aria-controls="kgSettingsPanel" title="Engine settings">⚙</button>';bar.insertBefore(top,bar.firstChild)}
    const modes=document.getElementById("dcEngineModes"),model=document.getElementById("dcEngineModelRow");let panel=document.getElementById("kgSettingsPanel");
    if(!panel){panel=document.createElement("div");panel.id="kgSettingsPanel";panel.className="kg-settings-panel";panel.setAttribute("aria-label","Engine settings");panel.innerHTML='<div class="kg-settings-label">Engine settings</div>';bar.insertBefore(panel,bar.querySelector("#dcRefStrip")||bar.children[1]||null)}
    if(modes&&!panel.contains(modes)){modes.classList.add("kg-modes");panel.appendChild(modes)}if(model&&!panel.contains(model)){model.classList.add("kg-model-row");panel.appendChild(model)}
    const refs=document.getElementById("dcRefStrip");if(refs)refs.classList.add("kg-ref-strip");const attach=bar.querySelector('button[title="Add a reference image"]');if(attach)attach.classList.add("kg-attach-btn");
    const btn=document.getElementById("kgSettingsBtn");if(btn&&!btn.dataset.wired){btn.dataset.wired="1";btn.addEventListener("click",()=>{const open=panel.classList.toggle("open");btn.setAttribute("aria-expanded",String(open))})}
  }
  function installVisionBridge(){
    const original=window.callAiVision;if(typeof original!=="function"||original.__kosmicEngineVisionRouter)return;
    const routed=async function(refs,prompt,system){
      const d=window.S&&S.directorChat?S.directorChat:null,draft=d&&d.draft?d.draft:null,provider=draft&&draft.brainModel,model=draft&&draft.engineModel;
      if(!d||!d.productionId||!model||!(provider==="grok"||provider==="kimi"))return original.apply(this,arguments);
      const keyName=provider==="grok"?"api_xai":"api_evolink",key=typeof window.gs==="function"?String(gs(keyName,"")).trim():"";
      if(!key)throw new Error(`${provider==="grok"?"Grok":"Kimi"} API key is missing for the selected Kosmic Engine model.`);
      const images=(Array.isArray(refs)?refs:[]).map(x=>x&&x.dataUrl).filter(Boolean);if(!images.length)return original.apply(this,arguments);
      const content=[...images.map(url=>({type:"image_url",image_url:{url,detail:"high"}})),{type:"text",text:String(prompt||"")}];
      const endpoint=provider==="grok"?"https://api.x.ai/v1/chat/completions":"https://direct.evolink.ai/v1/chat/completions";
      const body={model,messages:[...(system?[{role:"system",content:String(system)}]:[]),{role:"user",content}],max_tokens:2000,reasoning_effort:provider==="grok"?"high":"max"};
      const res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error?.message||data?.message||`Selected Engine vision request failed (${res.status})`);
      const text=data?.choices?.[0]?.message?.content;if(typeof text==="string")return text;if(Array.isArray(text))return text.map(x=>x?.text||"").join("").trim();throw new Error("Selected Engine vision model returned no text response.");
    };
    routed.__kosmicEngineVisionRouter=true;window.callAiVision=routed;
  }
  function observe(){wire();installVisionBridge();const ob=new MutationObserver(()=>{wire();installVisionBridge()});ob.observe(document.body,{childList:true,subtree:true});setTimeout(wire,250);setTimeout(wire,1000);setTimeout(wire,2500);setTimeout(installVisionBridge,500)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe,{once:true});else observe();
})();

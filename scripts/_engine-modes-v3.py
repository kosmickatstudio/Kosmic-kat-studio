from pathlib import Path
import re

p=Path('kosmicengine.js')
s=p.read_text(encoding='utf-8')

# Replace only the existing input bar block.
start=s.index('      <div id="dcInputBar"')
tail=s.index('      </div>\n    </div>\n  `;',start)
end=tail+len('      </div>')
newbar='''      <div id="dcInputBar" style="position:relative;background:var(--glass);backdrop-filter:blur(18px);border-top:1.5px solid var(--glass-brd);padding:10px 12px">\n        <div id="dcEngineModes" style="display:flex;gap:6px;margin-bottom:7px;overflow-x:auto;scrollbar-width:none">\n          <button type="button" data-engine-tier="lite" onclick="KosmicEngine.setEngineTier('lite')" style="flex:1;min-width:0;border:1.5px solid var(--border);border-radius:11px;padding:7px 8px;background:var(--surface);color:var(--text);font-size:10px;font-weight:800;cursor:pointer">⚡ Engine Lite</button>\n          <button type="button" data-engine-tier="advance" onclick="KosmicEngine.setEngineTier('advance')" style="flex:1;min-width:0;border:1.5px solid var(--border);border-radius:11px;padding:7px 8px;background:var(--surface);color:var(--text);font-size:10px;font-weight:800;cursor:pointer">◆ Engine Advance</button>\n          <button type="button" data-engine-tier="ultra" onclick="KosmicEngine.setEngineTier('ultra')" style="flex:1;min-width:0;border:1.5px solid var(--border);border-radius:11px;padding:7px 8px;background:var(--surface);color:var(--text);font-size:10px;font-weight:800;cursor:pointer">✦ Engine Ultra</button>\n        </div>\n        <div id="dcEngineModelRow" style="display:flex;align-items:center;gap:7px;margin-bottom:8px">\n          <span style="font-size:9px;font-weight:800;color:var(--textm);white-space:nowrap">BRAIN</span>\n          <select id="dcEngineModel" onchange="KosmicEngine.setEngineModel(this.value)" style="flex:1;min-width:0;border:1.5px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);padding:7px 9px;font-size:10px;font-weight:700"></select>\n          <span id="dcEngineLock" style="display:none;font-size:9px;color:var(--green);font-weight:800;white-space:nowrap">LOCKED</span>\n        </div>\n        <div id="dcRefStrip" style="display:none;gap:7px;flex-wrap:wrap;margin-bottom:9px"></div>\n        <div style="display:flex;gap:8px;align-items:flex-end">\n          <input type="file" accept="image/*" multiple id="dcRefFile" style="display:none" onchange="KosmicEngine.handleRefUpload(event)">\n          <button onclick="document.getElementById('dcRefFile').click()" title="Add a reference image" style="width:36px;height:36px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface);color:var(--violet);font-size:19px;line-height:1;cursor:pointer;flex-shrink:0">+</button>\n          <textarea class="ig-input-textarea-v2" id="dcInput" placeholder="Type your reply…" rows="1" style="flex:1;min-height:38px;background:var(--surface);border:1.5px solid var(--border);border-radius:16px;padding:9px 14px" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();KosmicEngine.send();}"></textarea>\n          <button class="ig-send-btn" onclick="KosmicEngine.send()">➤</button>\n        </div>\n      </div>'''
s=s[:start]+newbar+s[end:]

marker='  let _engineTab="chat";\n'
if 'ENGINE_MODES={' not in s:
    catalog=r'''  let _engineTab="chat";

  const ENGINE_MODES={
    lite:{label:"Engine Lite",models:[
      {id:"gemini-3.8-flash",provider:"gemini",label:"Gemini 3.8 Flash — FREE"},
      {id:"gemini-3.7-flash",provider:"gemini",label:"Gemini 3.7 Flash — FREE"},
      {id:"gemini-3.1-flash-lite",provider:"gemini",label:"Gemini 3.1 Flash-Lite — FREE"},
      {id:"openai/gpt-oss-120b",provider:"groq",label:"GPT-OSS 120B — FREE"},
      {id:"openai/gpt-oss-20b",provider:"groq",label:"GPT-OSS 20B — FREE / fast"},
      {id:"qwen/qwen3.8-27b",provider:"groq",label:"Qwen 3.8 27B — FREE tier"}
    ]},
    advance:{label:"Engine Advance",models:[
      {id:"gpt-5.6-terra",provider:"openai",label:"GPT-5.6 Terra — balanced"},
      {id:"gpt-5.6-luna",provider:"openai",label:"GPT-5.6 Luna — Lite"},
      {id:"claude-sonnet-5",provider:"claude",label:"Claude Sonnet 5"},
      {id:"claude-haiku-4-5-20251001",provider:"claude",label:"Claude Haiku 4.5 — fast"},
      {id:"kimi-k3",provider:"kimi",label:"Kimi K3 — latest"},
      {id:"grok-4.20-0309-reasoning",provider:"grok",label:"Grok 4.20 Reasoning — latest"},
      {id:"grok-4.20-multi-agent-0309",provider:"grok",label:"Grok 4.20 Multi-Agent"},
      {id:"grok-4.6",provider:"grok",label:"Grok 4.6"}
    ]},
    ultra:{label:"Engine Ultra",models:[
      {id:"gpt-6-astra",provider:"openai",label:"GPT-6 Astra"},
      {id:"claude-fable-5-1",provider:"claude",label:"Claude Fable 5.1"},
      {id:"claude-fable-5",provider:"claude",label:"Claude Fable 5"},
      {id:"gpt-5.6-sol",provider:"openai",label:"GPT-5.6 Sol"}
    ]}
  };
  function engineSelection(){
    const d=S.directorChat||{};
    const locked=d.productionId&&d.draft&&d.draft.engineModel;
    const tier=(locked&&d.draft.engineTier)||d.engineTier||"lite";
    const list=ENGINE_MODES[tier]?ENGINE_MODES[tier].models:ENGINE_MODES.lite.models;
    const id=(locked&&d.draft.engineModel)||d.engineModel||list[0].id;
    const model=list.find(x=>x.id===id)||list[0];
    return {tier,provider:model.provider,model:model.id,label:model.label,locked:!!locked};
  }
  function ensureEngineSelection(){
    const d=S.directorChat;if(!d)return engineSelection();
    const tier=ENGINE_MODES[d.engineTier]?d.engineTier:"lite";
    const list=ENGINE_MODES[tier].models;
    if(!d.engineModel||!list.some(x=>x.id===d.engineModel))d.engineModel=list[0].id;
    d.engineTier=tier;return engineSelection();
  }
  function renderEngineModePicker(){
    const tierEl=document.getElementById("dcEngineModes"),sel=document.getElementById("dcEngineModel"),lockEl=document.getElementById("dcEngineLock");
    if(!tierEl||!sel)return;
    const cur=engineSelection();
    tierEl.querySelectorAll("[data-engine-tier]").forEach(b=>{const active=b.getAttribute("data-engine-tier")===cur.tier;b.style.borderColor=active?"var(--violet)":"var(--border)";b.style.background=active?"var(--lav)":"var(--surface)";b.style.color=active?"var(--violet)":"var(--text)";b.disabled=cur.locked;b.style.opacity=cur.locked&&!active?"0.5":"1";});
    sel.innerHTML=ENGINE_MODES[cur.tier].models.map(m=>`<option value="${m.id.replace(/"/g,'&quot;')}" ${m.id===cur.model?"selected":""}>${m.label}</option>`).join("");
    sel.disabled=cur.locked;sel.style.opacity=cur.locked?"0.72":"1";if(lockEl)lockEl.style.display=cur.locked?"inline":"none";
  }
  function setEngineTier(tier){const d=S.directorChat;if(!d||d.productionId||!ENGINE_MODES[tier])return;d.engineTier=tier;d.engineModel=ENGINE_MODES[tier].models[0].id;save();renderEngineModePicker();}
  function setEngineModel(modelId){const d=S.directorChat;if(!d||d.productionId)return;const m=(ENGINE_MODES[d.engineTier||"lite"]||ENGINE_MODES.lite).models.find(x=>x.id===modelId);if(!m)return;d.engineModel=m.id;save();renderEngineModePicker();}

  let _engineAiOverrideDepth=0,_engineAiOverride=null;
  const _engineBaseCallAiSimple=window.callAiSimple;
  async function engineDirectCall(cfg,userPrompt,systemPrompt){
    const keyName={openai:"api_openai",claude:"api_anthropic",gemini:"api_gemini",groq:"api_groq",grok:"api_xai",kimi:"api_evolink"}[cfg.provider],key=keyName?String(gs(keyName,"")).trim():"";
    if(!key)throw new Error(`${cfg.label} is selected for Kosmic Engine, but its API key is missing. Add the ${cfg.label} key in Settings, then retry.`);
    if(cfg.provider==="claude"){const body={model:cfg.model,max_tokens:12000,messages:[{role:"user",content:userPrompt}]};if(systemPrompt)body.system=systemPrompt;if(!cfg.model.includes("haiku"))body.output_config={effort:"high"};const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true","Content-Type":"application/json"},body:JSON.stringify(body)}),data=await res.json();if(!res.ok)throw new Error(data?.error?.message||`Anthropic error ${res.status}`);return (data.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n")||"(No response)";}
    if(cfg.provider==="gemini"){const body={contents:[{role:"user",parts:[{text:userPrompt}]}],generationConfig:{maxOutputTokens:12000}};if(systemPrompt)body.systemInstruction={parts:[{text:systemPrompt}]};const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await res.json();if(!res.ok)throw new Error(data?.error?.message||`Gemini error ${res.status}`);return (data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("")||"(No response)";}
    const endpoints={openai:"https://api.openai.com/v1/chat/completions",groq:"https://api.groq.com/openai/v1/chat/completions",grok:"https://api.x.ai/v1/chat/completions",kimi:"https://direct.evolink.ai/v1/chat/completions"},messages=[];if(systemPrompt)messages.push({role:"system",content:systemPrompt});messages.push({role:"user",content:userPrompt});const body={model:cfg.model,messages,max_tokens:12000};if(cfg.provider==="openai"||cfg.provider==="grok")body.reasoning_effort="high";if(cfg.provider==="groq")body.reasoning_effort=cfg.model.includes("qwen")?"high":"medium";if(cfg.provider==="kimi")body.reasoning_effort="high";const res=await fetch(endpoints[cfg.provider],{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await res.json();if(!res.ok)throw new Error(data?.error?.message||data?.message||`${cfg.provider} error ${res.status}`);return data?.choices?.[0]?.message?.content||"(No response)";
  }
  window.callAiSimple=async function(userPrompt,systemPrompt){if(_engineAiOverrideDepth>0&&_engineAiOverride)return engineDirectCall(_engineAiOverride,userPrompt,systemPrompt);return _engineBaseCallAiSimple(userPrompt,systemPrompt);};
  async function withEngineAiOverride(fn){const cfg=engineSelection(),previous=_engineAiOverride;_engineAiOverride=cfg;_engineAiOverrideDepth++;try{return await fn();}finally{_engineAiOverrideDepth--;if(_engineAiOverrideDepth<=0){_engineAiOverrideDepth=0;_engineAiOverride=previous&&previous!==cfg?previous:null;}}}

'''
    if marker not in s: raise SystemExit('engine marker missing')
    s=s.replace(marker,catalog,1)

# Lock the selected provider/model into the production draft.
pat=r'(S\.directorChat\.draft=\{.*?continuity:"both",)brainModel:gs\("ai_model","claude"\),'
s,n=re.subn(pat,r'\1brainModel:engineSelection().provider,brainSubModel:engineSelection().model,engineTier:engineSelection().tier,engineModel:engineSelection().model,',s,count=1,flags=re.S)
if n!=1: raise SystemExit('draft marker not found')

# Replace the preflight function body without touching other dispatch logic.
pat=r'  function engineBrainPreflight\(\)\{.*?\n  \}'
replacement='''  function engineBrainPreflight(){\n    const sel=engineSelection(),c={claude:["api_anthropic","Claude"],gemini:["api_gemini","Gemini"],openai:["api_openai","OpenAI"],groq:["api_groq","Groq"],grok:["api_xai","Grok"],kimi:["api_evolink","Kimi"]},i=c[sel.provider];\n    if(!i)return{ok:false,error:`Unsupported Engine model "${sel.model}". Re-select an available Engine model.`};\n    if(!String(gs(i[0],"")).trim())return{ok:false,error:`${sel.label} is selected for Kosmic Engine, but its API key is missing. Add the ${i[1]} API key in Settings, then tap Retry.`};\n    return{ok:true};\n  }'''
s,n=re.subn(pat,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('preflight function not found')

# Wrap the existing worker, preserving its entire body.
if 'async function _runTaskWork(task)' not in s:
    pat=r'  async function runTaskWork\(task\)\{'
    s,n=re.subn(pat,'  async function _runTaskWork(task){',s,count=1)
    if n!=1: raise SystemExit('runTaskWork function not found')
    marker='  async function _runTaskWork(task){'
    s=s.replace(marker,'  async function runTaskWork(task){\n    return withEngineAiOverride(()=>_runTaskWork(task));\n  }\n'+marker,1)

# Expose the two UI handlers through the existing returned object.
if 'setEngineTier,' not in s:
    pos=s.rfind('  return {\n')
    if pos<0: raise SystemExit('return object not found')
    s=s[:pos]+'  return {\n    setEngineTier,\n    setEngineModel,\n'+s[pos+len('  return {\n'):]

# Paint the controls after the existing Engine render sequence.
if 'renderEngineModePicker();' not in s:
    marker='  KosmicEngine.renderRefStrip();'
    if marker not in s: raise SystemExit('render tail not found')
    s=s.replace(marker,marker+'\n  ensureEngineSelection();\n  renderEngineModePicker();',1)

p.write_text(s,encoding='utf-8')
print('Kosmic Engine Lite / Advance / Ultra patch applied')

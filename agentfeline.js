// ══════════════════════════════════════════════════════════════════════
// AGENT FELINE — new module (eighteenth extraction-style file, but this one
// is new code, not moved from index.html). A multi-provider TEXT agent
// chat living below Home in the sidebar. Reuses the exact ig-chat-shell /
// ig-settings-sheet CSS and swipe-to-close plumbing Image Gen and Video
// Canvas already use (those classes are generic, not scoped to either
// module), so this looks and behaves like a sibling of those chats rather
// than a bolted-on extra.
//
// Five agents, each backed by a real provider call:
//   Claude — Anthropic Messages API, extended thinking (budget_tokens)
//   GPT    — OpenAI chat/completions, reasoning_effort:"high" (GPT-5.6 is
//            a reasoning-tier model — needs max_completion_tokens, not
//            max_tokens, on this endpoint)
//   Gemini — generateContent, thinkingConfig.thinkingLevel:"HIGH"
//   Kimi   — NOT a standalone key. Routes through the existing fal.ai key
//            via fal's openrouter/router endpoint (model
//            "moonshotai/kimi-k3" — K3 always reasons, no toggle needed)
//   Grok   — xAI chat/completions, reasoning_effort:"high" (new api_xai key)
//
// "Deep research, thinking & reasoning" is implemented honestly as extended
// reasoning before the final answer — NOT live web research. Every agent's
// system prompt says so implicitly by asking for a well-reasoned pass, and
// the Settings sheet copy says so explicitly, matching this app's existing
// house style of not overclaiming AI capability (see Directorial Studio's
// AI Creative Feedback panel for the same pattern).
//
// Image routing (only triggered when afWantsImage() thinks the user asked
// for one): Claude -> Seedream 5 Pro (fal.ai), GPT -> GPT Image 2 (OpenAI's
// own endpoint), Gemini -> Nano Banana Pro (Gemini's own generateContent,
// same key), Kimi -> FLUX.2 Max (fal.ai, same key as its text route),
// Grok -> Grok Imagine (xAI's own endpoint, same key as its text route).
// Claude is the one agent whose image key (fal.ai) differs from its text
// key (Anthropic) — handled as a per-message imageError, not a hard fail.
//
// LOAD ORDER: must load AFTER index.html's main inline script (needs S,
// gs, saveSetting, save, toast, pIcon, getBrainModel, sheetSwipeStart/
// Move/End, afChatHistory in STATE_KEY_MAP — all defined there).
// ══════════════════════════════════════════════════════════════════════

// Each agent's badge now renders the provider's real official logo via the
// shared modelBadgeHtml()/MODEL_LOGOS registry (defined in index.html,
// already used for the Image/Video model pickers) — not a hand-drawn
// monogram. logoKey below is the exact MODEL_LOGOS key for that provider's
// verified mark (Claude/OpenAI/Gemini/Kimi/Grok are all Wikimedia Commons
// or the provider's own official brand-assets page — see MODEL_LOGOS'
// comments in index.html for sourcing/licensing per mark). See the
// Settings > API Keys trademark notice for the legal-use disclaimer.
const AGENTS={
  claude:{id:"claude",name:"Claude",logoKey:"claude",
    hasTextKey:()=>!!gs("api_anthropic",""),hasImageKey:()=>!!gs("api_falai",""),
    imageLabel:"Seedream 5 Pro (via fal.ai)",imageKeyHint:"a fal.ai",
    category:"Balanced all-rounder — reasoning & writing"},
  gpt:{id:"gpt",name:"GPT",logoKey:"openai",
    hasTextKey:()=>!!gs("api_openai",""),hasImageKey:()=>!!gs("api_openai",""),
    imageLabel:"GPT Image 2",imageKeyHint:"an OpenAI",
    category:"Structured tasks, code, broad knowledge"},
  gemini:{id:"gemini",name:"Gemini",logoKey:"gemini",
    hasTextKey:()=>!!gs("api_gemini",""),hasImageKey:()=>!!gs("api_gemini",""),
    imageLabel:"Nano Banana Pro",imageKeyHint:"a Gemini",
    category:"Math, logic, multimodal reasoning"},
  kimi:{id:"kimi",name:"Kimi",logoKey:"kimi",
    hasTextKey:()=>!!gs("api_falai",""),hasImageKey:()=>!!gs("api_falai",""),
    imageLabel:"FLUX.2 Max (via fal.ai)",imageKeyHint:"a fal.ai",
    category:"Huge context — long docs, deep research"},
  grok:{id:"grok",name:"Grok",logoKey:"grok",
    hasTextKey:()=>!!gs("api_xai",""),hasImageKey:()=>!!gs("api_xai",""),
    imageLabel:"Grok Imagine",imageKeyHint:"an xAI",
    category:"Current events, blunt/direct takes"},
};
const AGENT_ORDER=["claude","gpt","gemini","kimi","grok"];

// ── AUTO ROUTING & IMAGE-INTENT HEURISTICS ──
// Both are plain keyword heuristics, not a model call — cheap, instant, and
// honest about being a heuristic rather than dressed up as something smarter.
function afWantsImage(text){
  const t=text.toLowerCase();
  const patterns=[/\bdraw\b/,/\bgenerate\s+(an?|the)?\s*image/,/\bimage\s+of\b/,/\bpicture\s+of\b/,/\bphoto\s+of\b/,
    /\billustrat/,/\bvisuali[sz]e\b/,/\bcreate\s+(an?|the)\s*(image|picture|artwork|drawing|painting|poster|logo|icon|wallpaper)\b/,
    /\bmake\s+(an?|the)\s*(image|picture|artwork|drawing|poster|logo|icon)\b/,/\bshow\s+me\s+(a|an).*(image|picture|drawing)\b/,
    /\bsketch\b/,/\bpaint(ing)?\s+of\b/,/\blogo\s+(for|of)\b/,/\bposter\s+(for|of)\b/,/\bwallpaper\b/,/\bconcept\s+art\b/];
  return patterns.some(p=>p.test(t));
}
function afAutoPick(text){
  const t=text.toLowerCase();
  const buckets=[
    {agent:"gpt",words:["code","function","bug","debug","script","regex","algorithm","python","javascript","typescript","compile","stack trace","exception","syntax error"]},
    {agent:"kimi",words:["summarize","summarise","long document","deep dive","analyze this","compare these","report on","literature review","entire document","whole file","research"]},
    {agent:"grok",words:["news","today","latest","current","right now","trending","what's happening","this week","breaking"]},
    {agent:"gemini",words:["calculate","solve","equation","proof","math","logic puzzle","physics","chemistry"]},
  ];
  for(const b of buckets){if(b.words.some(w=>t.includes(w)))return b.agent;}
  return "claude";
}
function afSystemPrompt(name){
  return `You are ${name}, one of several AI agents available inside Kosmic Kat Studio's Agent Feline. Think the request through carefully before answering: weigh more than one angle, check your own reasoning, don't settle for a surface-level first pass. Give a complete, well-reasoned final answer in your own voice. Do not narrate your internal step-by-step thinking — just the polished answer.`;
}

// ── TEXT CALLS (one real provider call each, extended reasoning enabled where the API supports it) ──
async function afCallClaude(userText){
  const apiKey=gs("api_anthropic","");
  const model=getBrainModel("claude");
  const budget=6000;
  const res=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model,max_tokens:budget+1200,system:afSystemPrompt("Claude"),thinking:{type:"enabled",budget_tokens:budget},messages:[{role:"user",content:userText}]})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message);
  const textBlock=(data.content||[]).find(b=>b.type==="text");
  return textBlock?textBlock.text:"(No response)";
}
async function afCallGpt(userText){
  const apiKey=gs("api_openai","");
  const model=getBrainModel("openai");
  const res=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model,reasoning_effort:"high",max_completion_tokens:1600,messages:[{role:"system",content:afSystemPrompt("GPT")},{role:"user",content:userText}]})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
  return data.choices[0].message.content;
}
async function afCallGemini(userText){
  const apiKey=gs("api_gemini","");
  const model=getBrainModel("gemini");
  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:"POST",
    headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
    body:JSON.stringify({system_instruction:{parts:[{text:afSystemPrompt("Gemini")}]},contents:[{parts:[{text:userText}]}],generationConfig:{thinkingConfig:{thinkingLevel:"HIGH"}}})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message);
  return (data.candidates[0].content.parts||[]).map(p=>p.text).filter(Boolean).join("\n");
}
async function afCallKimi(userText){
  // No standalone Kimi key on this site — routed through the existing
  // fal.ai key via fal's OpenRouter-powered any-model endpoint, per Kosmic's
  // own hunch that fal might carry it. Confirmed: it does.
  const apiKey=gs("api_falai","");
  const model=getBrainModel("kimi")||"moonshotai/kimi-k3";
  const res=await fetch("https://fal.run/openrouter/router",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
    body:JSON.stringify({model,prompt:userText,system_prompt:afSystemPrompt("Kimi")})
  });
  const data=await res.json();
  if(!res.ok)throw new Error((data.detail&&data.detail[0]&&data.detail[0].msg)||data.error||res.statusText);
  return data.output||data.text||data.response||(data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content)||"(No response)";
}
async function afCallGrok(userText){
  const apiKey=gs("api_xai","");
  const model=getBrainModel("grok")||"grok-4.5";
  const res=await fetch("https://api.x.ai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model,reasoning_effort:"high",messages:[{role:"system",content:afSystemPrompt("Grok")},{role:"user",content:userText}]})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
  return data.choices[0].message.content;
}
const AF_TEXT_FN={claude:afCallClaude,gpt:afCallGpt,gemini:afCallGemini,kimi:afCallKimi,grok:afCallGrok};

// ── IMAGE CALLS (only invoked when afWantsImage() fires) ──
async function afGenSeedream(prompt){
  const apiKey=gs("api_falai","");
  const res=await fetch("https://fal.run/bytedance/seedream/v5/pro/text-to-image",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
    body:JSON.stringify({prompt})
  });
  const data=await res.json();
  if(!res.ok)throw new Error((data.detail&&data.detail[0]&&data.detail[0].msg)||data.error||res.statusText);
  return data.images&&data.images[0]&&data.images[0].url;
}
async function afGenGptImage(prompt){
  const apiKey=gs("api_openai","");
  const res=await fetch("https://api.openai.com/v1/images/generations",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model:"gpt-image-2",prompt})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message);
  const item=data.data&&data.data[0];
  if(!item)return null;
  return item.url||(item.b64_json?`data:image/png;base64,${item.b64_json}`:null);
}
async function afGenNanoBananaPro(prompt){
  const apiKey=gs("api_gemini","");
  const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:["Text","Image"]}})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message);
  const parts=(data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts)||[];
  const imgPart=parts.find(p=>p.inlineData||p.inline_data);
  const inline=imgPart&&(imgPart.inlineData||imgPart.inline_data);
  if(!inline)return null;
  return `data:${inline.mimeType||inline.mime_type||"image/png"};base64,${inline.data}`;
}
async function afGenFluxMax(prompt){
  const apiKey=gs("api_falai","");
  const res=await fetch("https://fal.run/fal-ai/flux-2-max",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
    body:JSON.stringify({prompt})
  });
  const data=await res.json();
  if(!res.ok)throw new Error((data.detail&&data.detail[0]&&data.detail[0].msg)||data.error||res.statusText);
  return data.images&&data.images[0]&&data.images[0].url;
}
async function afGenGrokImage(prompt){
  const apiKey=gs("api_xai","");
  const res=await fetch("https://api.x.ai/v1/images/generations",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model:"grok-imagine-image-quality",prompt})
  });
  const data=await res.json();
  if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
  return data.data&&data.data[0]&&data.data[0].url;
}
const AF_IMAGE_FN={claude:afGenSeedream,gpt:afGenGptImage,gemini:afGenNanoBananaPro,kimi:afGenFluxMax,grok:afGenGrokImage};

async function afRunAgent(agentId,userText,wantsImg){
  const agent=AGENTS[agentId];
  const result={agentId,agentName:agent.name,content:"",imageUrl:null,error:null,imageError:null};
  try{
    result.content=await AF_TEXT_FN[agentId](userText);
  }catch(err){
    result.error=err.message||String(err);
  }
  if(wantsImg){
    if(agent.hasImageKey()){
      try{
        result.imageUrl=await AF_IMAGE_FN[agentId](userText);
      }catch(err){
        result.imageError=err.message||String(err);
      }
    }else{
      result.imageError=`Needs ${agent.imageKeyHint} API key in Settings for ${agent.imageLabel}`;
    }
  }
  return result;
}

// ── UI ──
function afAgentLabel(id){
  if(id==="auto")return "Auto — picks the best agent for you";
  return AGENTS[id]?AGENTS[id].name:id;
}
function afAgentPickerRow(id,name,desc){
  const selected=gs("af_selected_agent","auto");
  const isSel=selected===id;
  const agent=AGENTS[id];
  const hasKey=id==="auto"?true:(agent&&agent.hasTextKey());
  const badge=id==="auto"
    ?`<div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--violet),var(--ice));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">✦</div>`
    :modelBadgeHtml(agent.logoKey,28);
  return `<div onclick="selectAfAgent('${id}')" style="display:flex;align-items:center;gap:10px;border:1.5px solid ${isSel?'var(--violet)':'var(--border)'};border-radius:12px;padding:9px 12px;cursor:pointer;background:${isSel?'rgba(61,31,122,0.06)':'var(--surface)'}">
    ${badge}
    <div style="flex:1;min-width:0">
      <div style="font-size:12.5px;font-weight:700;color:var(--text)">${name}${!hasKey?' <span class="badge badge-gray" style="font-size:8px">no key</span>':''}</div>
      <div style="font-size:10.5px;color:var(--textm)">${desc}</div>
    </div>
    ${isSel?`<span style="color:var(--violet)">${pIcon('check',14)}</span>`:''}
  </div>`;
}

function renderAgentFeline(el){
  S.afChatHistory=S.afChatHistory||[];
  const selectedAgent=gs("af_selected_agent","auto");
  const multiAgent=gs("af_multi_agent",false)===true||gs("af_multi_agent",false)==="true";
  const anyKey=AGENT_ORDER.some(id=>AGENTS[id].hasTextKey());
  el.innerHTML=`
    <div class="ig-chat-shell">
      <div class="ig-chat-header">
        <button class="ig-icon-btn" onclick="openAfSettings()" title="Agents">⚙</button>
        <div style="flex:1;text-align:center">
          <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">🐱 Agent Feline</div>
          <div style="font-size:10px;color:var(--textm);margin-top:1px">${multiAgent?'Multi-Agent — every configured agent answers':afAgentLabel(selectedAgent)}</div>
        </div>
        <button class="ig-icon-btn" onclick="startNewAfChat()" title="New Chat">➕</button>
      </div>

      <div class="ig-chat-thread" id="afChatThread"></div>

      <div class="ig-chat-inputbar">
        <div class="ig-input-shell">
          <textarea class="ig-input-textarea-v2" id="afChatInput" rows="1" placeholder="${anyKey?'Ask anything…':'Add an AI API key in Settings first…'}" ${!anyKey?'disabled':''} onkeydown="handleAfChatKeydown(event)" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,240)+'px'"></textarea>
          <div class="ig-input-toolbar">
            <button class="ig-tool-btn" onclick="openAfSettings()" title="Agents">⚙</button>
            <button class="ig-send-round" id="afSendBtn" ${!anyKey?'disabled':''} onclick="sendAfPrompt()" title="Send">➤</button>
          </div>
          <div style="font-size:9px;color:var(--texts);padding:2px 4px 0;display:flex;justify-content:flex-end"><span>Enter for a new line · <b>Ctrl+Enter</b> to send</span></div>
        </div>
      </div>
    </div>

    <div class="ig-settings-backdrop" id="afSettingsBackdrop" onclick="closeAfSettings()"></div>
    <div class="ig-settings-sheet" id="afSettingsPanel">
      <div class="ig-sheet-handle" ontouchstart="sheetSwipeStart(event)" ontouchmove="sheetSwipeMove(event,'afSettingsPanel')" ontouchend="sheetSwipeEnd(event,'afSettingsPanel','closeAfSettings')"></div>
      <div class="ig-sheet-header">
        <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">🐱 Agents</div>
        <button class="ig-icon-btn" onclick="closeAfSettings()" title="Close">✕</button>
      </div>
      <div style="padding:14px 16px">
        <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Every agent thinks through your question with extended reasoning before answering — this isn't live web research, just a deeper reasoning pass than a quick reply.</div>
        <div class="f-label" style="margin-bottom:6px">Preferred Agent</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          ${afAgentPickerRow('auto','Auto','Picks the best-fit agent for your question')}
          ${AGENT_ORDER.map(id=>afAgentPickerRow(id,AGENTS[id].name,AGENTS[id].category)).join('')}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
            <input type="checkbox" id="afMultiToggle" ${multiAgent?'checked':''} onchange="toggleAfMultiAgent(this.checked)" style="width:18px;height:18px;flex-shrink:0">
            <div><div style="font-size:13px;font-weight:700;color:var(--text)">Multi-Agent</div><div style="font-size:11px;color:var(--textm)">Send one input, every agent with a key configured answers side by side</div></div>
          </label>
        </div>
        <div style="font-size:10px;color:var(--texts);margin-top:12px;line-height:1.5">Image requests (e.g. "draw…", "generate an image of…") are detected automatically and routed to each answering agent's own image model — Claude → Seedream 5 Pro, GPT → GPT Image 2, Gemini → Nano Banana Pro, Kimi → FLUX.2 Max, Grok → Grok Imagine.</div>
      </div>
    </div>
  `;
  renderAfChatThread();
}

function openAfSettings(){
  const panel=document.getElementById("afSettingsPanel");
  const backdrop=document.getElementById("afSettingsBackdrop");
  if(panel)panel.classList.add("open");
  if(backdrop)backdrop.classList.add("show");
}
function closeAfSettings(){
  const panel=document.getElementById("afSettingsPanel");
  const backdrop=document.getElementById("afSettingsBackdrop");
  if(panel)panel.classList.remove("open");
  if(backdrop)backdrop.classList.remove("show");
}
function selectAfAgent(id){
  saveSetting("af_selected_agent",id);
  renderAgentFeline(document.getElementById("moduleContent"));
  openAfSettings();
}
function toggleAfMultiAgent(checked){
  saveSetting("af_multi_agent",checked);
  renderAgentFeline(document.getElementById("moduleContent"));
  openAfSettings();
}
function startNewAfChat(){
  S.afChatHistory=[];
  save("afChatHistory");
  renderAfChatThread();
  toast("🆕 New chat started","");
}
function handleAfChatKeydown(e){
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendAfPrompt();}
}

function afEscape(s){
  const d=document.createElement("div");
  d.textContent=s||"";
  return d.innerHTML.replace(/\n/g,"<br>");
}

function afRenderAgentCard(msg){
  const agent=AGENTS[msg.agentId];
  const badge=agent?modelBadgeHtml(agent.logoKey,22):`<div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--ice));flex-shrink:0"></div>`;
  if(msg.type==="loading"){
    return `<div class="ig-bubble-assistant" style="margin:0"><span class="ig-dot"></span><span class="ig-dot"></span><span class="ig-dot"></span>&nbsp;${msg.agentName} is thinking…</div>`;
  }
  const header=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      ${badge}
      <span style="font-size:11px;font-weight:700;color:var(--violet)">${msg.agentName}${msg.auto?' <span style="font-weight:400;color:var(--textm)">· auto-picked</span>':''}</span>
    </div>`;
  let body="";
  if(msg.error){
    body+=`<div style="color:var(--red);font-size:12px;margin-bottom:4px">❌ ${afEscape(msg.error)}</div>`;
  }else{
    body+=`<div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">${afEscape(msg.content||'')}</div>`;
  }
  if(msg.imageUrl)body+=`<img src="${msg.imageUrl}" style="width:100%;max-width:320px;border-radius:10px;margin-top:8px;display:block">`;
  if(msg.imageError)body+=`<div style="font-size:10.5px;color:var(--gold);margin-top:6px">${pIcon('search',10)} ${afEscape(msg.imageError)}</div>`;
  return `<div class="ig-bubble-assistant" style="margin:0">${header}${body}</div>`;
}
function afRenderAgentGroup(group){
  if(group.length===1)return afRenderAgentCard(group[0]);
  return `<div style="align-self:flex-start;max-width:96%;width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">${group.map(afRenderAgentCard).join('')}</div>`;
}

function renderAfChatThread(){
  const thread=document.getElementById("afChatThread");
  if(!thread)return;
  if(!S.afChatHistory.length){
    thread.innerHTML=`<div class="ig-empty-chat">
      <div style="font-size:36px;margin-bottom:10px;opacity:0.5">🐱</div>
      <div style="font-size:13px;font-weight:600;color:var(--textm)">Ask Agent Feline anything</div>
      <div style="font-size:11px;color:var(--texts);margin-top:4px">Pick an agent (or leave it on Auto), or turn on Multi-Agent to hear from everyone at once</div>
    </div>`;
    return;
  }
  const html=[];
  let i=0;
  while(i<S.afChatHistory.length){
    const msg=S.afChatHistory[i];
    if(msg.role==="user"){
      html.push(`<div style="align-self:flex-end;max-width:82%;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="ig-bubble-user" style="align-self:stretch;max-width:none">${afEscape(msg.content)}</div>
      </div>`);
      i++;
      continue;
    }
    const turnId=msg.turnId;
    const group=[];
    while(i<S.afChatHistory.length&&S.afChatHistory[i].role==="assistant"&&S.afChatHistory[i].turnId===turnId){
      group.push(S.afChatHistory[i]);
      i++;
    }
    html.push(afRenderAgentGroup(group));
  }
  thread.innerHTML=html.join('');
  thread.scrollTop=thread.scrollHeight;
}

async function sendAfPrompt(){
  const inputEl=document.getElementById("afChatInput");
  const text=inputEl.value.trim();
  if(!text)return;
  const selectedAgent=gs("af_selected_agent","auto");
  const multiAgent=gs("af_multi_agent",false)===true||gs("af_multi_agent",false)==="true";
  let agentIds,isAuto=false;
  if(multiAgent){
    agentIds=AGENT_ORDER.filter(id=>AGENTS[id].hasTextKey());
    if(!agentIds.length){toast("No agents have an API key configured yet — add one in Settings, or tap ⚙ here","error");return;}
  }else{
    isAuto=selectedAgent==="auto";
    const pick=isAuto?afAutoPick(text):selectedAgent;
    if(!AGENTS[pick]||!AGENTS[pick].hasTextKey()){toast(`${AGENTS[pick]?AGENTS[pick].name:'That agent'} needs an API key in Settings first`,"error");return;}
    agentIds=[pick];
  }
  inputEl.value="";inputEl.style.height="auto";
  S.afChatHistory.push({role:"user",content:text});
  const turnId=Date.now();
  const wantsImg=afWantsImage(text);
  agentIds.forEach(id=>{
    S.afChatHistory.push({role:"assistant",type:"loading",agentId:id,agentName:AGENTS[id].name,turnId,auto:isAuto,_placeholderId:id+"_"+turnId});
  });
  save("afChatHistory");
  renderAfChatThread();

  agentIds.forEach(async(id)=>{
    const result=await afRunAgent(id,text,wantsImg).catch(err=>({agentId:id,agentName:AGENTS[id].name,content:"",error:err.message||String(err)}));
    const idx=S.afChatHistory.findIndex(m=>m._placeholderId===id+"_"+turnId);
    const finalMsg={role:"assistant",agentId:id,agentName:AGENTS[id].name,turnId,auto:isAuto,content:result.content,imageUrl:result.imageUrl,error:result.error,imageError:result.imageError};
    if(idx>=0)S.afChatHistory[idx]=finalMsg;else S.afChatHistory.push(finalMsg);
    if(S.afChatHistory.length>120)S.afChatHistory=S.afChatHistory.slice(-120);
    save("afChatHistory");
    renderAfChatThread();
  });
}

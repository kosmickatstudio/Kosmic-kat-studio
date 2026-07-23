// ══════════════════════════════════════════════════════════════════════
// HOME MODULE — fifteenth extraction from index.html (module split phase
// 15). Plain global script, not an ES module.
//
// Includes DIRECTOR_BANNERS (a gradient lookup table) - verified used
// exclusively within this module's own renderHome() before moving it, not
// shared elsewhere.
//
// One external caller, already known and documented from the Display Area
// extraction: renderHomeCarousel() (defined here) gets called 5 times from
// display.js (Home's "+ Add Content" flow refreshing the carousel after an
// upload). Resolves fine via plain global window scope, same principle as
// every prior extraction.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

const DIRECTOR_BANNERS={
  kosmic:"linear-gradient(135deg,#27272A,#52525B)",
  siamese:"linear-gradient(135deg,#7C2D12,#EA580C)",
  floppa:"linear-gradient(135deg,#1E3A5F,#60A5FA)",
  angora:"linear-gradient(135deg,#44403C,#CA8A04)",
  calico:"linear-gradient(135deg,#701A75,#22D3EE)",
  sphynx:"linear-gradient(135deg,#365314,#65A30D)",
};

// ── HOME ──
function renderHome(el){
  const hasFal=!!gs("api_falai");
  const hasReplicate=!!gs("api_replicate");
  const hasOpenAI=!!gs("api_openai");
  const defaultImageModel=gs("default_image_model","fal-ai/flux/schnell");
  const defaultVideoModel=gs("default_video_model","bytedance/seedance-2.0/fast/text-to-video");
  const allDirectors=getAllDirectors();
  const activeDirId=gs("active_director","");
  const recentImages=S.assets.filter(a=>a.type==="image").slice(-8).reverse();
  const recentVideos=S.assets.filter(a=>a.type==="video").slice(-8).reverse();

  el.innerHTML=`
    <div class="panel" style="padding:0;overflow:hidden">
      <div id="homeCarousel" style="position:relative;height:180px;background:linear-gradient(135deg,var(--lav) 0%,var(--pearl2) 100%);display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:pan-y">
        <div id="homeDisplayPlaceholder" style="text-align:center">
          <div style="font-size:28px;margin-bottom:6px;opacity:0.35">✦</div>
          <div style="font-size:11px;color:var(--texts);margin-bottom:10px">Swipe left/right to browse — drag videos, ads, brand banners or YouTube here</div>
          <button class="dp-btn" onclick="openDisplayContentModal()">+ Add Content</button>
        </div>
        <div id="homeDisplaySlot" style="display:none;width:100%;height:100%"></div>
        <div style="position:absolute;top:8px;right:8px;display:flex;gap:5px">
          <button class="disp-ctrl" onclick="openDisplayContentModal()" title="Add Content">+</button>
          <button class="disp-ctrl" onclick="clearDisplay()" title="Clear">✕</button>
        </div>
        <div id="homeDots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:5px"></div>
      </div>
    </div>

    <div class="ig-chat-inputbar" style="margin-bottom:14px;background:var(--glass);backdrop-filter:blur(18px);border:1.5px solid var(--glass-brd);border-radius:24px;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
      <textarea class="ig-chat-textarea" id="homeAgentInput" rows="1" placeholder="Tell Kosmic Engine what you want to make…" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();sendHomeAgentPrompt();}"></textarea>
      <button class="ig-send-btn" onclick="sendHomeAgentPrompt()">➤</button>
    </div>

    <div class="panel">
      <div class="panel-title">◆ Directors</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Pick an Assistant Director's approach for your next generation.</div>
      <div class="home-director-grid">
        ${allDirectors.map(d=>{
          const bg=DIRECTOR_BANNERS[d.id]||"linear-gradient(135deg,#3D1F7A,#6240B0)";
          return `<div onclick="selectDirectorQuick('${d.id}')" style="height:52px;text-align:center;cursor:pointer;border-radius:10px;border:1.5px solid ${activeDirId===d.id?'var(--violet)':'transparent'};background:${bg};position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:6px">
          <div style="position:absolute;inset:0;background:rgba(10,5,20,0.38)"></div>
          <div style="position:relative;font-size:15px;color:#fff">${d.icon||'●'}</div>
          <div style="position:relative;font-size:10.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.5)">${d.name.replace('Director ','')}</div>
          ${activeDirId===d.id?'<span style="position:relative;font-size:11px;color:var(--green)">✓</span>':''}
        </div>`;}).join('')}
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">✧ AI Director Brain</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Which AI powers your Director chat and prompt help — moved here from Settings.</div>
      <div class="f-group">
        <select class="f-select" id="aiModelSelect" onchange="saveSetting('ai_model',this.value);updateAiModelLabel();updateAicreditsModelVisibility();renderModelTrigger('aiModelSelect','brain')" style="display:none">
        <option value="claude" ${gs("ai_model","claude")==="claude"?"selected":""}>Claude (Anthropic) (Best quality, supports images)</option>
        <option value="gemini" ${gs("ai_model","claude")==="gemini"?"selected":""}>Google Gemini (Vision-capable, cheap, supports images)</option>
        <option value="openai" ${gs("ai_model","claude")==="openai"?"selected":""}>OpenAI GPT-4o (Supports images)</option>
        <option value="groq" ${gs("ai_model","claude")==="groq"?"selected":""}>Groq Llama 3.3 (Free & fast, text only)</option>
        <option value="deepseek" ${gs("ai_model","claude")==="deepseek"?"selected":""}>DeepSeek V4 Flash (Ultra cheap, text only)</option>
        <option value="aicredits" ${gs("ai_model","claude")==="aicredits"?"selected":""}>AICredits Gateway (Routes to whichever model you pick below, images if that model supports them)</option>
        </select>
        <div id="aiModelSelectTrigger" onclick="openModelPicker('aiModelSelect','brain')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
      </div>
      <div class="f-group" id="aicreditsModelWrap" style="display:none;margin-top:8px">
        <label class="f-label">AICredits Model <span style="font-weight:400;color:var(--texts)">(300+ available — curated list below, or type any exact ID)</span></label>
        <select class="f-select" id="aicreditsModelSelect" onchange="handleAicreditsModelSelect()">
          <optgroup label="Anthropic">
            <option value="anthropic/claude-opus-4-8">Claude Opus 4.8 (best quality)</option>
            <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6 (balanced)</option>
            <option value="anthropic/claude-haiku-4-5">Claude Haiku 4.5 (fast, cheap)</option>
          </optgroup>
          <optgroup label="OpenAI">
            <option value="openai/gpt-5.5">GPT-5.5 (best quality)</option>
            <option value="openai/gpt-4o">GPT-4o</option>
            <option value="openai/gpt-4o-mini">GPT-4o mini (fast, cheap)</option>
          </optgroup>
          <optgroup label="Google">
            <option value="google/gemini-3.1-pro">Gemini 3.1 Pro (best quality)</option>
            <option value="google/gemini-3-flash">Gemini 3 Flash (fast, cheap)</option>
          </optgroup>
          <optgroup label="DeepSeek">
            <option value="deepseek/deepseek-v4">DeepSeek V4</option>
            <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash (cheapest)</option>
          </optgroup>
          <optgroup label="Mistral">
            <option value="mistral/mistral-large">Mistral Large</option>
          </optgroup>
          <optgroup label="xAI">
            <option value="xai/grok-4.3">Grok 4.3</option>
          </optgroup>
          <option value="__custom__">✏️ Custom — type an exact model ID</option>
        </select>
        <input class="f-input" id="aicreditsModelInput" style="display:none;margin-top:6px" placeholder="e.g. moonshot/kimi-k2-turbo-preview" oninput="saveSetting('aicredits_model',this.value)">
        <div style="font-size:10px;color:var(--textm);margin-top:6px">This list is a curated subset, verified against AICredits' own documented ID format (provider/model) — not their full 300+ catalog, which isn't published anywhere as a static list. If your model isn't above, pick Custom and type its exact ID from your AICredits dashboard.</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">✦ Recent Work</div>
      ${!recentImages.length&&!recentVideos.length?`<div style="font-size:11px;color:var(--textm)">Your generated images and videos will show up here.</div>`:''}
      ${recentImages.length?`<div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Images</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:${recentVideos.length?'14px':'0'}">
        ${recentImages.map(a=>`<img src="${a.url}" class="home-mini-thumb" style="width:64px;height:64px;flex-shrink:0;cursor:pointer" onclick="switchMod('imagegen',document.querySelector('[data-mod=imagegen]'))" title="${(a.prompt||'').replace(/"/g,'&quot;')}">`).join('')}
      </div>`:''}
      ${recentVideos.length?`<div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Videos</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
        ${recentVideos.map(a=>`<video src="${a.url}" class="home-mini-thumb" style="width:96px;height:64px;flex-shrink:0;cursor:pointer;aspect-ratio:auto" muted onclick="switchMod('videocanvas',document.querySelector('[data-mod=videocanvas]'))" title="${(a.prompt||'').replace(/"/g,'&quot;')}"></video>`).join('')}
      </div>`:''}
    </div>

    <div class="panel">
      <div class="panel-title">Image Models <span class="badge ${hasFal||hasReplicate||hasOpenAI||gs("api_gemini")?'badge-green':'badge-red'}" style="font-size:9px">${hasFal||hasReplicate||hasOpenAI||gs("api_gemini")?'READY':'NO KEY'}</span></div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${[
          {id:"fal-ai/flux/schnell",label:"FLUX Schnell",ready:hasFal},
          {id:"fal-ai/flux/dev",label:"FLUX Dev",ready:hasFal},
          {id:"fal-ai/flux-pro/v1.1",label:"FLUX 1.1 Pro",ready:hasFal},
          {id:"fal-ai/ideogram/v3",label:"Ideogram V3",ready:hasFal},
          {id:"fal-ai/recraft/v3/text-to-image",label:"Recraft V3",ready:hasFal},
          {id:"fal-ai/stable-diffusion-v35-large",label:"Stable Diffusion 3.5",ready:hasFal},
          {id:"fal-ai/flux-2",label:"FLUX.2 Dev",ready:hasFal},
          {id:"fal-ai/flux-2-pro",label:"FLUX.2 Pro",ready:hasFal},
          {id:"fal-ai/flux-2/flash",label:"FLUX.2 Flash",ready:hasFal},
          {id:"gemini-3.1-flash-image",label:"Nano Banana 2",ready:!!gs("api_gemini")},
          {id:"gemini-3-pro-image",label:"Nano Banana Pro",ready:!!gs("api_gemini")},
          {id:"gpt-image-2",label:"GPT Image 2",ready:hasOpenAI},
          {id:"fal-ai/nano-banana-2",label:"Nano Banana 2 (via fal.ai)",ready:hasFal},
          {id:"fal-ai/nano-banana-pro",label:"Nano Banana Pro (via fal.ai)",ready:hasFal},
          {id:"openai/gpt-image-2",label:"GPT Image 2 (via fal.ai)",ready:hasFal},
        ].map(m=>`<div class="home-model-row">
          <span class="dot" style="background:${m.ready?'var(--green)':'var(--border)'}"></span>
          <span class="name">${m.label}</span>
          ${defaultImageModel===m.id?'<span class="badge badge-violet" style="font-size:9px">Default</span>':`<button class="btn btn-outline btn-xs" onclick="setDefaultModel('image','${m.id}')">Set Default</button>`}
        </div>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--textm);margin-top:8px">FLUX.2 Flash Edit (multi-reference) not shown here — pick it directly in Image's Settings.</div>
    </div>

    <div class="panel">
      <div class="panel-title">Video Models <span class="badge ${hasFal?'badge-green':'badge-red'}" style="font-size:9px">${hasFal?'READY':'NO KEY'}</span></div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${[
          {id:"bytedance/seedance-2.0/fast/text-to-video",label:"Seedance 2.0 Fast"},
          {id:"bytedance/seedance-2.0/text-to-video",label:"Seedance 2.0"},
          {id:"fal-ai/kling-video/v2.1/master/text-to-video",label:"Kling 2.1 Master"},
          {id:"fal-ai/kling-video/v2.6/pro/text-to-video",label:"Kling 2.6 Pro"},
          {id:"fal-ai/kling-video/v3/standard/text-to-video",label:"Kling 3.0 Standard"},
          {id:"fal-ai/kling-video/v3/pro/text-to-video",label:"Kling 3.0 Pro"},
          {id:"fal-ai/kling-video/o3/pro/reference-to-video",label:"Kling O3 Pro (Multi-Reference)"},
          {id:"fal-ai/veo3.1",label:"Veo 3.1"},
        ].map(m=>`<div class="home-model-row">
          <span class="dot" style="background:${hasFal?'var(--green)':'var(--border)'}"></span>
          <span class="name">${m.label}</span>
          ${defaultVideoModel===m.id?'<span class="badge badge-violet" style="font-size:9px">Default</span>':`<button class="btn btn-outline btn-xs" onclick="setDefaultModel('video','${m.id}')">Set Default</button>`}
        </div>`).join('')}
      </div>
    </div>
  `;
  renderHomeCarousel();
  attachHomeSwipeHandlers();
  loadDisplayItemsFromCloud();
  // AI Director Brain picker moved here from Settings — the select's
  // `selected` option is baked into the template string above (correct on
  // first paint), but the trigger div's own label/icon and the AICredits
  // sub-picker's visibility/value both need their own render pass here,
  // exactly like Settings used to do when its panel opened.
  renderModelTrigger("aiModelSelect","brain");
  updateAicreditsModelVisibility();
  restoreAicreditsModelUI();
}

function sendHomeAgentPrompt(){
  const inputEl=document.getElementById("homeAgentInput");
  const msg=inputEl.value.trim();
  if(!msg){toast("Type something first","error");return;}
  inputEl.value="";
  // Straight into Kosmic Engine's actual production chat — no detour through
  // the separate lightweight "AI Studio" panel this used to open. Matches
  // exactly what happens if the user manually taps the Kosmic Engine tab and
  // types the same message themselves: switchMod does the real module
  // switch/render, then we drop the message into its input and send it.
  switchMod("directorchat",document.querySelector('[data-mod="directorchat"]'));
  const dcInput=document.getElementById("dcInput");
  if(dcInput){
    dcInput.value=msg;
    DirectorChat.send();
  }
}

function selectDirectorQuick(id){
  const current=gs("active_director","");
  saveSetting("active_director",current===id?"":id);
  renderHome(document.getElementById("moduleContent"));
  toast(current===id?"Director deselected":"🎬 Assistant Director set — will inject into your next generation","success");
}

function setDefaultModel(kind,id){
  saveSetting(kind==="image"?"default_image_model":"default_video_model",id);
  renderHome(document.getElementById("moduleContent"));
  toast("✅ Default "+kind+" model updated","success");
}


// ── HOME SWIPEABLE CAROUSEL ──
function renderHomeCarousel(){
  const placeholder=document.getElementById("homeDisplayPlaceholder");
  const slot=document.getElementById("homeDisplaySlot");
  const dots=document.getElementById("homeDots");
  if(!slot)return;
  const items=S.displayItems||[];
  if(!items.length){
    placeholder.style.display="block";slot.style.display="none";dots.innerHTML="";
    return;
  }
  placeholder.style.display="none";slot.style.display="block";
  const item=items[S.displayIndex%items.length];
  if(item.type==="image")slot.innerHTML=`<img src="${item.url}" style="width:100%;height:100%;object-fit:contain">`;
  else if(item.type==="video")slot.innerHTML=`<video src="${item.url}" controls autoplay muted loop style="width:100%;height:100%;object-fit:contain"></video>`;
  else if(item.type==="youtube")slot.innerHTML=`<iframe src="https://www.youtube.com/embed/${item.youtubeId}" style="width:100%;height:100%;border:none" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  else if(item.type==="html")slot.innerHTML=item.html;
  dots.innerHTML=items.length>1?items.map((it,i)=>`<span style="width:6px;height:6px;border-radius:50%;background:${i===S.displayIndex%items.length?'var(--violet)':'rgba(61,31,122,0.2)'}"></span>`).join(''):"";
}

function attachHomeSwipeHandlers(){
  const carousel=document.getElementById("homeCarousel");
  if(!carousel)return;
  let startX=0,startY=0,swiping=false;
  carousel.addEventListener("touchstart",e=>{
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;swiping=true;
  },{passive:true});
  carousel.addEventListener("touchend",e=>{
    if(!swiping)return;
    swiping=false;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){
      cycleHomeDisplay(dx<0?1:-1);
    }
  },{passive:true});
}

function cycleHomeDisplay(dir){
  const items=S.displayItems||[];
  if(!items.length)return;
  S.displayIndex=(S.displayIndex+dir+items.length)%items.length;
  renderHomeCarousel();
}


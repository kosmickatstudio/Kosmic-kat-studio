// ══════════════════════════════════════════════════════════════════════
// KAT FILMS 4K / CAMERA CRAFTS 4K — Higgsfield's Cinema Studio 4K (under
// Video) and Cinematic Camera (under Image) are the same tool shown
// under two names AND the same tool internally toggles between an Image
// mode and a Video mode via a switcher next to the prompt box — that
// toggle is what actually determines which of the two names applies at
// any given moment, confirmed directly. This file reproduces that: one
// module, S.csMode ("image"|"video") driving both which generation
// pipeline runs and which name/branding shows, with a real chat-style
// thread (same ig-bubble-user/assistant/loading pattern Image Gen and
// Video Canvas already use) instead of a single last-result box.
// Reached from two sidebar entries that each set the starting mode —
// "Kat Films 4K" inside Video Studio (video), "Camera Crafts 4K" inside
// Image Studio (image) — but the in-composer toggle can switch either
// way afterward without leaving the module.
// Not related to Kosmic Engine in any way.
//
// LAYOUT, confirmed against a real walkthrough frame-by-frame: a left
// nav (Home / My Generations / My Elements / My Favorites / Community /
// Academy) with a persistent Projects panel (New Project / Load Project)
// sitting below that nav rather than being one of its tabs, and a main
// area built around a chat thread with one composer pinned below it —
// the scene prompt with its own tool row (Image/Video switch, model,
// aspect, duration, generate) attached directly beneath it — with the
// Director's Panel (Genre always; Camera Movement/Speed Ramp only in
// Video mode, since neither means anything for a still image) as its own
// row above the thread.
//
// SCOPE OF THIS PASS (more functional detail to follow once the fuller
// walkthrough video arrives, per the person's own message): the real
// generation surface for both modes, Director's Panel, prompt with
// @-character mentions, Projects, My Generations, My Favorites, and My
// Elements (linked to the app's real Character library rather than a
// second duplicate system — Higgsfield's "Elements" and this app's
// "Characters" are the same concept). Community and Academy are shown as
// real nav entries but with an honest placeholder rather than invented
// courses/creators — that content genuinely lives on Higgsfield's own
// platform.
//
// "Cinema Studio 3.5" as a named model is Higgsfield's own in-house model
// brand, not something reachable via fal.ai — invented endpoints aren't
// shipped here. The model row instead offers this app's REAL models —
// the same curated video list Video Canvas's simple mode uses, and the
// same real image model catalog Image Gen uses.
// "Speed Ramp" isn't a real Seedance/Kling API parameter (checked against
// genViaSeedanceReference's actual accepted body fields) — like Camera
// Movement already elsewhere in this app, it's a prompt-injection phrase,
// not a literal request field.
// Character @mentions in Image mode use genViaFluxEdit (real multi-
// reference image composition, already used elsewhere in this app for
// multi-character storyboard shots) instead of plain text-to-image, so a
// mentioned character's actual reference photo is genuinely used, not
// just their text description.
//
// LOAD ORDER: after index.html's main inline script — needs S, gs, save,
// saveSetting, toast, escapeHtml, pIcon, CAMERA_MOVES, SE_MODEL_ALLOWED,
// modelOptionsHTML, genViaSeedanceReference, genViaFal, genViaFluxEdit,
// uploadRefsToFal, createVideoAsset, createImageAsset, logCost,
// showPromptDialog, showConfirmDialog, downloadWithName,
// sanitizeFilenamePart, openCollectionPicker.
// ══════════════════════════════════════════════════════════════════════

S.csProjects=S.csProjects||gs("cs_projects",[])||[];
S.csActiveProjectId=S.csActiveProjectId||gs("cs_active_project",null);
S.csFavorites=S.csFavorites||gs("cs_favorites",[])||[];
S.csView=S.csView||"home";
S.csMode=S.csMode||"video";
S.csChatHistory=S.csChatHistory||gs("cs_chat_history",[])||[];
S.csMentionOpen=false;

const CINEMA_GENRES=[
  {label:"General",frag:""},
  {label:"Action/Fight",frag:"high-energy action cinematography, dynamic kinetic movement"},
  {label:"Romance/Emotional",frag:"intimate emotional cinematography, soft warm tones"},
  {label:"Horror/Suspense",frag:"tense suspenseful cinematography, unsettling atmosphere"},
  {label:"Comedy",frag:"bright playful cinematography, comedic timing"},
  {label:"Dialogue/Drama",frag:"grounded dramatic cinematography, natural character-focused framing"},
  {label:"Chase/Pursuit",frag:"kinetic pursuit cinematography, fast tracking movement"},
];

const SPEED_RAMPS=[
  {label:"Auto",value:""},
  {label:"None — constant speed",value:"constant real-time speed throughout, no speed ramping"},
  {label:"Slow-Mo",value:"dramatic slow-motion throughout"},
  {label:"Ramp Up (slow → fast)",value:"speed ramps from slow motion into fast real-time motion"},
  {label:"Ramp Down (fast → slow)",value:"speed ramps from fast motion down into dramatic slow-motion"},
];

// Entry point from the sidebar — each of the two buttons calls this with
// its own mode so opening "Camera Crafts 4K" actually starts in Image
// mode and "Kat Films 4K" starts in Video mode, before the in-composer
// toggle can take over.
function openCinemaStudio(mode,el){
  S.csMode=mode;
  switchMod("cinemastudio",el);
}

// Keeps whichever of the two sidebar buttons matches the CURRENT mode
// highlighted as active, even when the mode was changed via the
// in-composer toggle rather than by clicking a sidebar button.
function syncCsSidebarActive(){
  document.querySelectorAll('[data-mod="cinemastudio"]').forEach(b=>{
    b.classList.toggle("active",b.dataset.csmode===S.csMode);
  });
}

function renderCinemaStudio(el){
  const tabsEl=document.getElementById("moduleTabs");
  if(tabsEl){tabsEl.style.display="none";tabsEl.innerHTML="";}
  const title=S.csMode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K";
  el.innerHTML=`
    <div style="display:flex;gap:0;min-height:60vh">
      <div style="width:128px;flex-shrink:0;border-right:1px solid var(--glass-brd);padding:10px 6px;display:flex;flex-direction:column">
        <div id="csTitle" style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet);padding:4px 6px 8px">${title}</div>
        ${[["home","🏠 Home"],["generations","🎞 My Generations"],["elements","🎭 My Elements"],["favorites","⭐ My Favorites"],["community","👥 Community"],["academy","🎓 Academy"]].map(([id,label])=>
          `<button class="btn btn-sm" style="width:100%;text-align:left;margin-bottom:3px;background:${S.csView===id?'var(--violet)':'transparent'};color:${S.csView===id?'#fff':'var(--text)'};border:none;font-size:11px" onclick="setCsView('${id}')">${label}</button>`
        ).join('')}
        <!-- PROJECTS — a persistent panel below the nav, not a tab of its
             own, matching where it actually sits in the reference layout:
             visible no matter which of the 6 views above is active. -->
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--glass-brd)">
          <div style="font-size:9.5px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--textm);padding:0 6px 6px">Projects</div>
          <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:6px;font-size:11px" onclick="newCsProject()">+ New Project</button>
          <select class="f-select" id="csProjectLoader" style="font-size:11px;padding:6px" onchange="loadCsProject(this.value)">
            <option value="">Load Project…</option>
            ${S.csProjects.slice().reverse().map(p=>`<option value="${p.id}" ${p.id===S.csActiveProjectId?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="flex:1;padding:16px;max-width:560px">
        <div id="csViewBody"></div>
      </div>
    </div>`;
  syncCsSidebarActive();
  renderCsViewBody();
}

function setCsView(id){S.csView=id;renderCinemaStudio(document.getElementById("moduleContent"));}
function loadCsProject(id){
  S.csActiveProjectId=id||null;
  saveSetting("cs_active_project",S.csActiveProjectId);
  renderCinemaStudio(document.getElementById("moduleContent"));
}

function renderCsViewBody(){
  const wrap=document.getElementById("csViewBody");
  if(!wrap)return;
  if(S.csView==="home")return renderCsHome(wrap);
  if(S.csView==="generations")return renderCsGenerations(wrap);
  if(S.csView==="favorites")return renderCsFavorites(wrap);
  if(S.csView==="elements")return renderCsElements(wrap);
  if(S.csView==="community")return renderCsCommunity(wrap);
  if(S.csView==="academy")return renderCsAcademy(wrap);
}

// Community/Academy are Higgsfield's creator-showcase and course pages —
// real content that lives on their platform, not a generation tool this
// app can build. Shown honestly as what they are rather than skipped
// silently, since the person specifically pointed at them being part of
// the real nav — but not faked with invented courses/creators.
function renderCsCommunity(wrap){
  wrap.innerHTML=`<div style="font-size:12px;color:var(--textm);padding:20px 0;text-align:center">Community is Higgsfield's own creator-showcase feed — not something to fake here. This space is reserved for whatever the equivalent should actually be for Kosmic Kat (e.g. your own Facebook Page activity) once that's decided.</div>`;
}
function renderCsAcademy(wrap){
  wrap.innerHTML=`<div style="font-size:12px;color:var(--textm);padding:20px 0;text-align:center">Academy is Higgsfield's own course library — not something to fake here. Reserved for real tutorial content if you ever want one built.</div>`;
}

// ── HOME — Director's Panel row (mode-aware), then a real chat thread,
// with the composer pinned below it. The Image/Video toggle lives on the
// composer, matching the reference layout, and switching it live-updates
// the title, Director's Panel fields, and model list without losing the
// chat history. ──
function renderCsHome(wrap){
  const hasKey=gs("api_falai");
  const isVideo=S.csMode==="video";
  wrap.innerHTML=`
    ${!hasKey?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--textm);margin-bottom:12px">⚠️ Add a fal.ai API key in Settings to generate.</div>`:''}

    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.04em">🎬 Director's Panel</span>
    </div>
    <div id="csDirectorPanel" style="display:flex;gap:8px;margin-bottom:10px"></div>

    <div class="ig-chat-thread" id="csChatThread" style="border:1px solid var(--glass-brd);border-radius:12px;margin-bottom:10px"></div>

    <!-- COMPOSER — Image/Video switch attached directly to the prompt box,
         same place Higgsfield puts it, then the rest of the tool row
         directly beneath, one integrated unit rather than a form. -->
    <div class="panel" style="padding:10px;position:relative">
      <div style="display:flex;gap:4px;margin-bottom:8px;background:var(--pearl2);border-radius:9px;padding:3px;width:fit-content">
        <button id="csModeImage" onclick="setCsMode('image')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;background:${!isVideo?'var(--violet)':'transparent'};color:${!isVideo?'#fff':'var(--textm)'}">📷 Image</button>
        <button id="csModeVideo" onclick="setCsMode('video')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;background:${isVideo?'var(--violet)':'transparent'};color:${isVideo?'#fff':'var(--textm)'}">🎬 Video</button>
      </div>
      <textarea class="f-textarea" id="csPrompt" oninput="handleCsPromptInput(event)" onkeydown="handleCsChatKeydown(event)" style="border:none;background:transparent;padding:2px 2px 8px;min-height:60px" placeholder="Describe your scene — use @ to add a character"></textarea>
      <div id="csMentionDropdown" style="display:none;position:absolute;left:10px;right:10px;top:44px;background:var(--pearl2);border:1.5px solid var(--glass-brd);border-radius:10px;padding:4px;z-index:10;max-height:160px;overflow-y:auto"></div>
      <div id="csToolRow" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-top:1px solid var(--glass-brd);padding-top:8px"></div>
    </div>`;
  renderCsDirectorPanel();
  renderCsToolRow();
  renderCsChatThread();
}

// Genre applies to both modes (it's a cinematography/style choice either
// way); Camera Movement and Speed Ramp are motion concepts and only
// render in Video mode — showing them for a still image would be an
// option that does nothing.
function renderCsDirectorPanel(){
  const wrap=document.getElementById("csDirectorPanel");
  if(!wrap)return;
  const isVideo=S.csMode==="video";
  wrap.innerHTML=`
    <select class="f-select" id="csGenre" style="flex:1;font-size:11px">${CINEMA_GENRES.map(g=>`<option value="${g.label}">Genre: ${g.label}</option>`).join('')}</select>
    ${isVideo?`<select class="f-select" id="csCameraMove" style="flex:1;font-size:11px">${CAMERA_MOVES.map(c=>`<option value="${c.value}">Camera: ${c.label}</option>`).join('')}</select>
    <select class="f-select" id="csSpeedRamp" style="flex:1;font-size:11px">${SPEED_RAMPS.map(s=>`<option value="${s.value}">Speed: ${s.label}</option>`).join('')}</select>`:''}`;
}

function renderCsToolRow(){
  const wrap=document.getElementById("csToolRow");
  if(!wrap)return;
  const isVideo=S.csMode==="video";
  const hasKey=gs("api_falai");
  const modelSelect=isVideo
    ?`<select id="csModel" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2);max-width:130px">${modelOptionsHTML("video",SE_MODEL_ALLOWED,gs("default_video_model","bytedance/seedance-2.0/fast/text-to-video"))}</select>`
    :`<select id="csModel" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2);max-width:130px">${modelOptionsHTML("image",null,gs("default_image_model","fal-ai/flux/dev"))}</select>`;
  wrap.innerHTML=`
    ${modelSelect}
    <select id="csRatio" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2)">
      <option value="16:9">📐 16:9</option>
      <option value="9:16">📐 9:16</option>
      <option value="1:1">📐 1:1</option>
    </select>
    ${isVideo?`<select id="csDuration" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2)">${TR_SEEDANCE_DURATIONS.map(d=>`<option value="${d}" ${d===6?'selected':''}>⏱ ${d}s</option>`).join('')}</select>`:''}
    <button id="csGenBtn" onclick="sendCinemaStudioGen()" ${!hasKey?'disabled':''} style="margin-left:auto;width:36px;height:36px;border-radius:50%;background:var(--violet);color:#fff;border:none;font-size:15px;cursor:pointer;flex-shrink:0">➤</button>`;
}

// Switching the toggle is the thing that makes this module BE Camera
// Crafts 4K vs Kat Films 4K at any given moment, per direct instruction —
// updates the title, Director's Panel, and tool row live, keeps the chat
// thread and sidebar view exactly where they were.
function setCsMode(mode){
  if(S.csMode===mode)return;
  S.csMode=mode;
  const title=document.getElementById("csTitle");
  if(title)title.textContent=mode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K";
  document.getElementById("csModeImage").style.background=mode==="image"?"var(--violet)":"transparent";
  document.getElementById("csModeImage").style.color=mode==="image"?"#fff":"var(--textm)";
  document.getElementById("csModeVideo").style.background=mode==="video"?"var(--violet)":"transparent";
  document.getElementById("csModeVideo").style.color=mode==="video"?"#fff":"var(--textm)";
  renderCsDirectorPanel();
  renderCsToolRow();
  syncCsSidebarActive();
}

function handleCsChatKeydown(e){
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendCinemaStudioGen();}
}

// ── CHAT THREAD — same ig-bubble-user/assistant/loading pattern Image
// Gen and Video Canvas already use, so Kat Films/Camera Crafts looks and
// behaves like a real conversation instead of replacing its last result. ──
function renderCsChatThread(){
  const thread=document.getElementById("csChatThread");
  if(!thread)return;
  if(!S.csChatHistory.length){
    thread.innerHTML=`<div class="ig-empty-chat">
      <div style="font-size:32px;margin-bottom:8px;opacity:0.5">✨</div>
      <div style="font-size:13px;font-weight:600;color:var(--textm)">Describe a scene below to get started</div>
      <div style="font-size:11px;color:var(--texts);margin-top:4px">Your generations stay here like a conversation — scroll up to see past ones</div>
    </div>`;
    return;
  }
  thread.innerHTML=S.csChatHistory.map(msg=>{
    if(msg.role==="user")return `<div style="align-self:flex-end;max-width:82%;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <div class="ig-bubble-user" style="align-self:stretch;max-width:none">${escapeHtml(msg.content)}</div>
    </div>`;
    if(msg.type==="loading")return `<div class="ig-bubble-loading" id="${msg.id}"><span class="ig-dot"></span><span class="ig-dot"></span><span class="ig-dot"></span>&nbsp;${msg.content}</div>`;
    if(msg.type==="error")return `<div class="ig-bubble-assistant" style="color:var(--red)">❌ ${msg.content}</div>`;
    if(msg.type==="image")return `<div class="ig-bubble-assistant">
        <img src="${msg.content}" style="width:100%;max-width:320px;border-radius:12px;display:block;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="badge badge-gray">via ${msg.meta.providerLabel}</span><span class="badge badge-green">✓ Saved</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-outline btn-xs" onclick="downloadWithName('${msg.content.replace(/'/g,"\\'")}','KatFilms_${sanitizeFilenamePart(msg.meta.prompt)}.png')">⬇</button>
          ${msg.meta.assetId?`<button class="btn btn-outline btn-xs" onclick="openCollectionPicker('asset','${msg.meta.assetId}')">📁 Collection</button>`:''}
          <button class="btn btn-outline btn-xs" onclick="toggleCsFavorite('${msg.meta.assetId}');toast('Favorites updated','success')">⭐</button>
        </div>
      </div>`;
    if(msg.type==="video")return `<div class="ig-bubble-assistant" style="background:none;box-shadow:none;padding:0;border:none">
        <video src="${msg.content}" controls style="width:100%;max-width:320px;border-radius:12px;display:block"></video>
        <div class="vc-result-actions">
          <button class="vc-result-icon-btn" title="Download" onclick="downloadWithName('${msg.content.replace(/'/g,"\\'")}','KatFilms_${sanitizeFilenamePart(msg.meta.prompt)}.mp4')">${VC_RESULT_ICONS.download}</button>
          ${msg.meta.assetId?`<button class="vc-result-icon-btn" title="Add to Collection" onclick="openCollectionPicker('asset','${msg.meta.assetId}')">${VC_RESULT_ICONS.collection}</button>`:''}
          <button class="vc-result-icon-btn" title="Favorite" onclick="toggleCsFavorite('${msg.meta.assetId}');toast('Favorites updated','success')">⭐</button>
        </div>
      </div>`;
    return '';
  }).join('');
  thread.scrollTop=thread.scrollHeight;
}

function pushCsChatMessage(msg){
  S.csChatHistory.push(msg);
  if(S.csChatHistory.length>60)S.csChatHistory=S.csChatHistory.slice(-60);
  saveSetting("cs_chat_history",S.csChatHistory);
  renderCsChatThread();
}
function replaceCsLoadingBubble(loadingId,newMsg){
  const idx=S.csChatHistory.findIndex(m=>m.id===loadingId);
  if(idx>=0)S.csChatHistory[idx]=newMsg;else S.csChatHistory.push(newMsg);
  saveSetting("cs_chat_history",S.csChatHistory);
  renderCsChatThread();
}

// ── @ MENTION AUTOCOMPLETE — matches against this app's real Character
// library (S.characters), not a second invented "Elements" system. ──
function handleCsPromptInput(e){
  const ta=e.target;
  const cursor=ta.selectionStart;
  const upToCursor=ta.value.slice(0,cursor);
  const match=upToCursor.match(/@([a-zA-Z0-9_]*)$/);
  const dd=document.getElementById("csMentionDropdown");
  if(!match){dd.style.display="none";return;}
  const query=match[1].toLowerCase();
  const candidates=(S.characters||[]).filter(c=>c.name.toLowerCase().includes(query)).slice(0,6);
  if(!candidates.length){dd.style.display="none";return;}
  dd.style.display="block";
  dd.innerHTML=candidates.map(c=>`<div style="padding:6px 10px;cursor:pointer;font-size:12px;border-radius:6px" onmousedown="insertCsMention('${c.name.replace(/'/g,"\\'")}')" onmouseover="this.style.background='var(--glass-brd)'" onmouseout="this.style.background='transparent'">🎭 ${escapeHtml(c.name)}</div>`).join('');
}
function insertCsMention(name){
  const ta=document.getElementById("csPrompt");
  const cursor=ta.selectionStart;
  const before=ta.value.slice(0,cursor).replace(/@([a-zA-Z0-9_]*)$/,"");
  const after=ta.value.slice(cursor);
  ta.value=`${before}@${name} ${after}`;
  document.getElementById("csMentionDropdown").style.display="none";
  ta.focus();
}

// Resolves every @Name mention that matches a real saved Character into
// (a) a plain, model-readable mention (fal models don't understand
// "@Name" syntax — that's this app's own UI convention) plus their lock
// description for context, and (b) their reference image, hosted for the
// actual API call. Unmatched @Words are left as-is — most likely just
// part of the sentence, not a real mention.
async function resolveCsCharacterMentions(text,apiKey){
  const mentioned=[...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m=>m[1]);
  let cleanPrompt=text;
  const imageUrls=[];
  for(const name of mentioned){
    const c=(S.characters||[]).find(ch=>ch.name.toLowerCase()===name.toLowerCase());
    if(!c)continue;
    const re=new RegExp(`@${name}\\b`,"gi");
    cleanPrompt=cleanPrompt.replace(re,c.lock?`${c.name} (${c.lock})`:c.name);
    if(c.refImg){
      try{
        const hosted=await uploadRefsToFal([{dataUrl:c.refImg,name:c.name}],apiKey);
        if(hosted&&hosted[0])imageUrls.push(hosted[0]);
      }catch(err){console.warn("Couldn't upload reference for",c.name,err.message);}
    }
  }
  return {cleanPrompt,imageUrls};
}

async function sendCinemaStudioGen(){
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const promptEl=document.getElementById("csPrompt");
  const rawPrompt=promptEl?.value.trim();
  if(!rawPrompt){toast("Describe your scene first","error");return;}
  const isVideo=S.csMode==="video";
  const genre=CINEMA_GENRES.find(g=>g.label===document.getElementById("csGenre")?.value)||CINEMA_GENRES[0];
  const cameraMove=isVideo?(document.getElementById("csCameraMove")?.value||""):"";
  const speedRamp=isVideo?(document.getElementById("csSpeedRamp")?.value||""):"";
  const model=document.getElementById("csModel")?.value;
  const ratio=document.getElementById("csRatio")?.value||"16:9";
  const duration=isVideo?(document.getElementById("csDuration")?.value||"6"):null;
  const btn=document.getElementById("csGenBtn");
  btn.disabled=true;btn.textContent="⏳";

  pushCsChatMessage({role:"user",content:rawPrompt});
  promptEl.value="";
  const loadingId="csLoading_"+Date.now();
  pushCsChatMessage({id:loadingId,type:"loading",content:isVideo?"Rolling camera…":"Composing shot…"});

  try{
    const {cleanPrompt,imageUrls}=await resolveCsCharacterMentions(rawPrompt,apiKey);
    const parts=[genre.frag,cleanPrompt,cameraMove,speedRamp].filter(Boolean);
    const finalPrompt=parts.join(", ");
    const projectId=S.csActiveProjectId||"";
    const providerLabel=isVideo?"Kat Films 4K":"Camera Crafts 4K";

    if(isVideo){
      const videoUrl=await genViaSeedanceReference(finalPrompt,model,ratio,duration,imageUrls,[],[]);
      const savedAsset=createVideoAsset(videoUrl,finalPrompt,projectId,{model,providerLabel},true);
      if(projectId)addCsGenerationToProject(projectId,savedAsset.id);
      logCost(model,providerLabel);
      replaceCsLoadingBubble(loadingId,{type:"video",content:videoUrl,meta:{prompt:finalPrompt,providerLabel,assetId:savedAsset.id}});
    } else {
      // Character mentions in Image mode get a REAL multi-reference
      // composition (genViaFluxEdit, already used elsewhere in this app
      // for multi-character storyboard shots) instead of plain
      // text-to-image, so a mentioned character's actual photo is used —
      // not just their text description. Falls back to the person's
      // chosen model when no character is mentioned.
      const result=imageUrls.length
        ?await genViaFluxEdit(finalPrompt,imageUrls,ratio,"fal-ai/flux-2/flash/edit")
        :await genViaFal(finalPrompt,"",model,ratio,false);
      const savedAsset=await createImageAsset(result.url,finalPrompt,projectId,{model:imageUrls.length?"fal-ai/flux-2/flash/edit":model,providerLabel});
      if(projectId)addCsGenerationToProject(projectId,savedAsset.id);
      logCost(imageUrls.length?"fal-ai/flux-2/flash/edit":model,providerLabel);
      replaceCsLoadingBubble(loadingId,{type:"image",content:result.url,meta:{prompt:finalPrompt,providerLabel,assetId:savedAsset.id}});
    }
    toast("✨ Generated","success");
  }catch(err){
    replaceCsLoadingBubble(loadingId,{type:"error",content:err.message});
    toast("❌ "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="➤";
}

function addCsGenerationToProject(projectId,assetId){
  const p=S.csProjects.find(pr=>pr.id===projectId);
  if(p){p.generations=p.generations||[];p.generations.push(assetId);saveSetting("cs_projects",S.csProjects);}
}

// ── MY GENERATIONS — every asset (image or video) created through this
// tool in either mode, newest first, regardless of project (project-
// filtered list lives under Projects → open project). ──
function renderCsGenerations(wrap){
  const gens=(S.assets||[]).filter(a=>a.providerLabel==="Kat Films 4K"||a.providerLabel==="Camera Crafts 4K").slice().reverse();
  if(!gens.length){wrap.innerHTML=`<div style="font-size:12px;color:var(--textm);padding:20px 0;text-align:center">No generations yet — make one from Home.</div>`;return;}
  wrap.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${gens.map(a=>`<div class="panel" style="padding:8px">
    ${a.type==="video"?`<video src="${a.url}" controls style="width:100%;border-radius:8px;display:block;margin-bottom:6px"></video>`:`<img src="${a.url}" style="width:100%;border-radius:8px;display:block;margin-bottom:6px">`}
    <div style="font-size:11px;color:var(--textm)">${escapeHtml((a.prompt||"").slice(0,90))}</div>
    <button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="toggleCsFavorite('${a.id}');renderCsGenerations(document.getElementById('csViewBody'))">${S.csFavorites.includes(a.id)?'⭐ Favorited':'☆ Favorite'}</button>
  </div>`).join('')}</div>`;
}

function toggleCsFavorite(assetId){
  const idx=S.csFavorites.indexOf(assetId);
  if(idx>=0)S.csFavorites.splice(idx,1);else S.csFavorites.push(assetId);
  saveSetting("cs_favorites",S.csFavorites);
}

function renderCsFavorites(wrap){
  const favs=(S.assets||[]).filter(a=>S.csFavorites.includes(a.id));
  if(!favs.length){wrap.innerHTML=`<div style="font-size:12px;color:var(--textm);padding:20px 0;text-align:center">Nothing favorited yet — mark generations you like to keep them here.</div>`;return;}
  wrap.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${favs.map(a=>`<div class="panel" style="padding:8px">
    ${a.type==="video"?`<video src="${a.url}" controls style="width:100%;border-radius:8px;display:block;margin-bottom:6px"></video>`:`<img src="${a.url}" style="width:100%;border-radius:8px;display:block;margin-bottom:6px">`}
    <div style="font-size:11px;color:var(--textm)">${escapeHtml((a.prompt||"").slice(0,90))}</div>
    <button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="toggleCsFavorite('${a.id}');renderCsFavorites(document.getElementById('csViewBody'))">Remove from Favorites</button>
  </div>`).join('')}</div>`;
}

// ── MY ELEMENTS — real link into the app's actual Character library
// rather than a second, duplicate system for the same idea. ──
function renderCsElements(wrap){
  const chars=S.characters||[];
  wrap.innerHTML=`
    <div style="font-size:12px;color:var(--textm);margin-bottom:12px">Elements here are this app's Characters — build one there, then type @ their name in the prompt here to bring them into a scene.</div>
    <button class="btn btn-outline btn-sm" style="margin-bottom:12px" onclick="switchMod('characters',document.querySelector('[data-mod=characters]'))">🎭 Open Character Library</button>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${chars.map(c=>`<div class="card" style="padding:6px;text-align:center">
        ${c.refImg?`<img src="${c.refImg}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px">`:`<div style="width:100%;aspect-ratio:1;border-radius:6px;background:var(--pearl2);display:flex;align-items:center;justify-content:center;font-size:20px">🎭</div>`}
        <div style="font-size:10px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</div>
      </div>`).join('')||'<div style="font-size:11px;color:var(--textm);grid-column:1/-1">No characters yet.</div>'}
    </div>`;
}

async function newCsProject(){
  const name=await showPromptDialog("Name this project","");
  if(!name)return;
  const p={id:"cs_"+Date.now(),name,createdAt:new Date().toISOString(),generations:[]};
  S.csProjects.push(p);
  S.csActiveProjectId=p.id;
  saveSetting("cs_projects",S.csProjects);
  saveSetting("cs_active_project",S.csActiveProjectId);
  toast(`🎬 "${name}" created and set active`,"success");
  renderCinemaStudio(document.getElementById("moduleContent"));
}

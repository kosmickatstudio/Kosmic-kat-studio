// ══════════════════════════════════════════════════════════════════════
// CINEMA STUDIO — Higgsfield's Cinema Studio 4K (under Video) and
// Cinematic Camera (under Image) are the same tool shown under two
// names, confirmed directly. Lives in its own "Cinema Studio" sidebar
// section, entirely separate from Kosmic Engine and Video/Image Studio —
// a distinct tool, not a variant or replacement of anything else.
// NAMING NOTE: the person asked for this section to be called
// "Directorial Studio" — but that name is already taken by an existing,
// different, already-working feature (directors.js — the Director
// style/personality library, wired into a real sidebar button). Named
// this section "Cinema Studio" instead rather than silently overwrite
// or collide with that; flagged back to the person to decide (rename the
// old one, or pick a different name for this one).
//
// LAYOUT, confirmed against a real walkthrough frame-by-frame: a left
// nav (Home / My Generations / My Elements / My Favorites / Community /
// Academy) with a persistent Projects panel (New Project / Load Project)
// sitting below that nav rather than being one of its tabs, and a main
// area built around one composer — the scene prompt with its own tool
// row (model / aspect / duration / generate) attached directly beneath
// it — with the Director's Panel (Genre / Camera Movement / Speed Ramp)
// as its own row above the composer.
//
// SCOPE OF THIS PASS (more functional detail to follow once the fuller
// walkthrough video arrives, per the person's own message): the real
// generation surface — Director's Panel, prompt with @-character
// mentions, model/aspect/duration, Projects, My Generations, My
// Favorites, and My Elements (linked to the app's real Character library
// rather than a second duplicate system — Higgsfield's "Elements" and
// this app's "Characters" are the same concept: a saved subject with
// reference images, reusable by name across generations). Community and
// Academy are shown as real nav entries (per direct instruction) but
// with an honest placeholder rather than invented courses/creators —
// that content genuinely lives on Higgsfield's own platform.
//
// "Cinema Studio 3.5" as a named model is Higgsfield's own in-house model
// brand, not something reachable via fal.ai — invented endpoints aren't
// shipped here. The model row instead offers this app's REAL video
// models (same curated list Video Canvas's simple mode uses).
// "Speed Ramp" isn't a real Seedance/Kling API parameter (checked against
// genViaSeedanceReference's actual accepted body fields) — like Camera
// Movement already elsewhere in this app, it's a prompt-injection phrase,
// not a literal request field.
//
// LOAD ORDER: after index.html's main inline script — needs S, gs, save,
// saveSetting, toast, escapeHtml, pIcon, CAMERA_MOVES, SE_MODEL_ALLOWED,
// modelOptionsHTML, genViaSeedanceReference, uploadRefsToFal,
// createVideoAsset, logCost, showPromptDialog, showConfirmDialog.
// ══════════════════════════════════════════════════════════════════════

S.csProjects=S.csProjects||gs("cs_projects",[])||[];
S.csActiveProjectId=S.csActiveProjectId||gs("cs_active_project",null);
S.csFavorites=S.csFavorites||gs("cs_favorites",[])||[];
S.csView=S.csView||"home";
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

function renderCinemaStudio(el){
  const tabsEl=document.getElementById("moduleTabs");
  if(tabsEl){tabsEl.style.display="none";tabsEl.innerHTML="";}
  el.innerHTML=`
    <div style="display:flex;gap:0;min-height:60vh">
      <div style="width:128px;flex-shrink:0;border-right:1px solid var(--glass-brd);padding:10px 6px;display:flex;flex-direction:column">
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet);padding:4px 6px 8px">🎬 Cinema Studio</div>
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

// ── HOME — Director's Panel row, then a single composer: the prompt
// input with its tool row attached directly beneath it (model, aspect,
// duration, generate), matching the actual reference layout rather than
// a stack of separate labeled form fields. ──
function renderCsHome(wrap){
  const hasKey=gs("api_falai");
  wrap.innerHTML=`
    ${!hasKey?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--textm);margin-bottom:12px">⚠️ Add a fal.ai API key in Settings to generate.</div>`:''}

    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.04em">🎬 Director's Panel</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <select class="f-select" id="csGenre" style="flex:1;font-size:11px">${CINEMA_GENRES.map(g=>`<option value="${g.label}">Genre: ${g.label}</option>`).join('')}</select>
      <select class="f-select" id="csCameraMove" style="flex:1;font-size:11px">${CAMERA_MOVES.map(c=>`<option value="${c.value}">Camera: ${c.label}</option>`).join('')}</select>
      <select class="f-select" id="csSpeedRamp" style="flex:1;font-size:11px">${SPEED_RAMPS.map(s=>`<option value="${s.value}">Speed: ${s.label}</option>`).join('')}</select>
    </div>

    <!-- COMPOSER — input with its own tool row attached directly beneath,
         one integrated unit rather than a form. -->
    <div class="panel" style="padding:10px;position:relative">
      <textarea class="f-textarea" id="csPrompt" oninput="handleCsPromptInput(event)" style="border:none;background:transparent;padding:2px 2px 8px;min-height:70px" placeholder="Describe your scene — use @ to add a character"></textarea>
      <div id="csMentionDropdown" style="display:none;position:absolute;left:10px;right:10px;top:60px;background:var(--pearl2);border:1.5px solid var(--glass-brd);border-radius:10px;padding:4px;z-index:10;max-height:160px;overflow-y:auto"></div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;border-top:1px solid var(--glass-brd);padding-top:8px">
        <select id="csModel" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2);max-width:130px">${modelOptionsHTML("video",SE_MODEL_ALLOWED,gs("default_video_model","bytedance/seedance-2.0/fast/text-to-video"))}</select>
        <select id="csRatio" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2)">
          <option value="16:9">📐 16:9</option>
          <option value="9:16">📐 9:16</option>
          <option value="1:1">📐 1:1</option>
        </select>
        <select id="csDuration" style="font-size:10.5px;padding:4px 6px;border-radius:8px;border:1px solid var(--glass-brd);background:var(--pearl2)">${TR_SEEDANCE_DURATIONS.map(d=>`<option value="${d}" ${d===6?'selected':''}>⏱ ${d}s</option>`).join('')}</select>
        <button id="csGenBtn" onclick="sendCinemaStudioGen()" ${!hasKey?'disabled':''} style="margin-left:auto;width:36px;height:36px;border-radius:50%;background:var(--violet);color:#fff;border:none;font-size:15px;cursor:pointer;flex-shrink:0">➤</button>
      </div>
    </div>

    <div id="csLastResult" style="margin-top:16px"></div>`;
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
  const rawPrompt=document.getElementById("csPrompt")?.value.trim();
  if(!rawPrompt){toast("Describe your scene first","error");return;}
  const genre=CINEMA_GENRES.find(g=>g.label===document.getElementById("csGenre")?.value)||CINEMA_GENRES[0];
  const cameraMove=document.getElementById("csCameraMove")?.value||"";
  const speedRamp=document.getElementById("csSpeedRamp")?.value||"";
  const model=document.getElementById("csModel")?.value;
  const ratio=document.getElementById("csRatio")?.value||"16:9";
  const duration=document.getElementById("csDuration")?.value||"6";
  const btn=document.getElementById("csGenBtn");
  btn.disabled=true;btn.textContent="⏳";
  try{
    const {cleanPrompt,imageUrls}=await resolveCsCharacterMentions(rawPrompt,apiKey);
    const parts=[genre.frag,cleanPrompt,cameraMove,speedRamp].filter(Boolean);
    const finalPrompt=parts.join(", ");
    const videoUrl=await genViaSeedanceReference(finalPrompt,model,ratio,duration,imageUrls,[],[]);
    const projectId=S.csActiveProjectId||"";
    const savedAsset=createVideoAsset(videoUrl,finalPrompt,projectId,{model,providerLabel:"Cinema Studio"});
    if(projectId){
      const p=S.csProjects.find(pr=>pr.id===projectId);
      if(p){p.generations=p.generations||[];p.generations.push(savedAsset.id);saveSetting("cs_projects",S.csProjects);}
    }
    logCost(model,"Cinema Studio");
    document.getElementById("csLastResult").innerHTML=`<video src="${videoUrl}" controls style="width:100%;border-radius:12px;display:block"></video>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-outline btn-sm" onclick="toggleCsFavorite('${savedAsset.id}');toast('${S.csFavorites.includes(savedAsset.id)?'Removed from':'Added to'} Favorites','success')">⭐ Favorite</button>
        <button class="btn btn-outline btn-sm" onclick="downloadWithName('${videoUrl.replace(/'/g,"\\'")}','CinemaStudio.mp4')">⬇ Download</button>
      </div>`;
    toast("✨ Generated","success");
  }catch(err){
    toast("❌ "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="➤";
}

// ── MY GENERATIONS — every video asset created through Cinema Studio,
// newest first, regardless of project (project-filtered list lives under
// Projects → open project). ──
function renderCsGenerations(wrap){
  const gens=(S.assets||[]).filter(a=>a.type==="video"&&a.providerLabel==="Cinema Studio").slice().reverse();
  if(!gens.length){wrap.innerHTML=`<div style="font-size:12px;color:var(--textm);padding:20px 0;text-align:center">No generations yet — make one from Home.</div>`;return;}
  wrap.innerHTML=`<div style="display:flex;flex-direction:column;gap:12px">${gens.map(a=>`<div class="panel" style="padding:8px">
    <video src="${a.url}" controls style="width:100%;border-radius:8px;display:block;margin-bottom:6px"></video>
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
    <video src="${a.url}" controls style="width:100%;border-radius:8px;display:block;margin-bottom:6px"></video>
    <div style="font-size:11px;color:var(--textm)">${escapeHtml((a.prompt||"").slice(0,90))}</div>
    <button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="toggleCsFavorite('${a.id}');renderCsFavorites(document.getElementById('csViewBody'))">Remove from Favorites</button>
  </div>`).join('')}</div>`;
}

// ── MY ELEMENTS — real link into the app's actual Character library
// rather than a second, duplicate system for the same idea. ──
function renderCsElements(wrap){
  const chars=S.characters||[];
  wrap.innerHTML=`
    <div style="font-size:12px;color:var(--textm);margin-bottom:12px">Elements here are this app's Characters — build one there, then type @ their name in Cinema Studio's prompt to bring them into a scene.</div>
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

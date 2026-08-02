// ══════════════════════════════════════════════════════════════════════
// CINEMA STUDIO — a past session assumed Kosmic Engine already covered
// Higgsfield's "Cinema Studio 4K" (see the comment still sitting above
// the sidebar's Kosmic Engine button in index.html) and deliberately
// skipped building this as a placeholder. Frame-by-frame review of a real
// walkthrough shows that assumption was wrong: this is a distinct,
// lighter-weight tool — a single-scene "Director's Panel" (Genre / Camera
// Movement / Speed Ramp + one prompt box) with its own session structure
// (Home / My Generations / My Elements / My Favorites / Projects) — not
// the heavy multi-episode production wizard Kosmic Engine is. This file
// is that tool, built for real rather than assumed-covered.
//
// SCOPE OF THIS PASS (more functional detail to follow once the fuller
// walkthrough video arrives, per the person's own message): the actual
// generation surface — Director's Panel, prompt with @-character mentions,
// model/aspect/duration, New Project / My Generations / My Favorites, and
// My Elements (linked to the app's real Character library rather than a
// second duplicate system — Higgsfield's "Elements" and this app's
// "Characters" are the same concept: a saved subject with reference
// images, reusable by name across generations). Community and Academy
// (Higgsfield's course/creator-showcase pages) are marketing content, not
// a generation feature, and are left out — consistent with this app's
// existing practice of not replicating menu items that aren't real tools.
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
  const activeProject=S.csProjects.find(p=>p.id===S.csActiveProjectId);
  el.innerHTML=`
    <div style="display:flex;gap:0;min-height:60vh">
      <div style="width:120px;flex-shrink:0;border-right:1px solid var(--glass-brd);padding:10px 6px">
        ${[["home","🏠 Home"],["generations","🎞 Generations"],["favorites","⭐ Favorites"],["elements","🎭 Elements"],["projects","📁 Projects"]].map(([id,label])=>
          `<button class="btn btn-sm" style="width:100%;text-align:left;margin-bottom:4px;background:${S.csView===id?'var(--violet)':'transparent'};color:${S.csView===id?'#fff':'var(--text)'};border:none" onclick="setCsView('${id}')">${label}</button>`
        ).join('')}
      </div>
      <div style="flex:1;padding:16px;max-width:560px">
        <div style="margin-bottom:14px">
          <div style="font-family:'Cinzel',serif;font-size:19px;font-weight:700;color:var(--violet)">🎬 Cinema Studio</div>
          <div style="font-size:12px;color:var(--textm);margin-top:4px">${activeProject?`Project: <b>${escapeHtml(activeProject.name)}</b>`:'No active project — generations save unfiled unless you start one.'}</div>
        </div>
        <div id="csViewBody"></div>
      </div>
    </div>`;
  renderCsViewBody();
}

function setCsView(id){S.csView=id;renderCsViewBody();}

function renderCsViewBody(){
  const wrap=document.getElementById("csViewBody");
  if(!wrap)return;
  if(S.csView==="home")return renderCsHome(wrap);
  if(S.csView==="generations")return renderCsGenerations(wrap);
  if(S.csView==="favorites")return renderCsFavorites(wrap);
  if(S.csView==="elements")return renderCsElements(wrap);
  if(S.csView==="projects")return renderCsProjects(wrap);
}

// ── HOME — the Director's Panel ──
function renderCsHome(wrap){
  const hasKey=gs("api_falai");
  wrap.innerHTML=`
    ${!hasKey?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--textm);margin-bottom:14px">⚠️ Add a fal.ai API key in Settings to generate.</div>`:''}
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <div class="f-group" style="flex:1;margin-bottom:0">
        <label class="f-label">Genre</label>
        <select class="f-select" id="csGenre">${CINEMA_GENRES.map(g=>`<option value="${g.label}">${g.label}</option>`).join('')}</select>
      </div>
      <div class="f-group" style="flex:1;margin-bottom:0">
        <label class="f-label">Camera Movement</label>
        <select class="f-select" id="csCameraMove">${CAMERA_MOVES.map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}</select>
      </div>
      <div class="f-group" style="flex:1;margin-bottom:0">
        <label class="f-label">Speed Ramp</label>
        <select class="f-select" id="csSpeedRamp">${SPEED_RAMPS.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      </div>
    </div>

    <div class="f-group" style="position:relative">
      <label class="f-label">Describe your scene <span style="font-weight:400;color:var(--texts)">— type @ to add a character</span></label>
      <textarea class="f-textarea" id="csPrompt" oninput="handleCsPromptInput(event)" placeholder="e.g. @Sedi walks through a rain-soaked alley at night, neon signs reflecting in the puddles"></textarea>
      <div id="csMentionDropdown" style="display:none;position:absolute;left:0;right:0;background:var(--pearl2);border:1.5px solid var(--glass-brd);border-radius:10px;padding:4px;z-index:10;max-height:160px;overflow-y:auto"></div>
    </div>

    <div class="f-group">
      <label class="f-label">Model</label>
      <select class="f-select" id="csModel">${modelOptionsHTML("video",SE_MODEL_ALLOWED,gs("default_video_model","bytedance/seedance-2.0/fast/text-to-video"))}</select>
    </div>

    <div style="display:flex;gap:10px">
      <div class="f-group" style="flex:1">
        <label class="f-label">Aspect Ratio</label>
        <select class="f-select" id="csRatio">
          <option value="16:9">16:9</option>
          <option value="9:16">9:16</option>
          <option value="1:1">1:1</option>
        </select>
      </div>
      <div class="f-group" style="flex:1">
        <label class="f-label">Duration</label>
        <select class="f-select" id="csDuration">${TR_SEEDANCE_DURATIONS.map(d=>`<option value="${d}" ${d===6?'selected':''}>${d}s</option>`).join('')}</select>
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%;margin-top:6px" id="csGenBtn" onclick="sendCinemaStudioGen()" ${!hasKey?'disabled':''}>🎬 Generate</button>

    <div id="csLastResult" style="margin-top:18px"></div>`;
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
  btn.disabled=true;btn.textContent="⏳ Generating…";
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
  btn.disabled=false;btn.textContent="🎬 Generate";
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

// ── PROJECTS ──
function renderCsProjects(wrap){
  wrap.innerHTML=`
    <button class="btn btn-primary btn-sm" style="margin-bottom:12px" onclick="newCsProject()">+ New Project</button>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${S.csProjects.slice().reverse().map(p=>`<div class="panel" style="padding:10px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:700">${escapeHtml(p.name)}${p.id===S.csActiveProjectId?' <span style="color:var(--violet);font-size:10px">(active)</span>':''}</div>
          <div style="font-size:10px;color:var(--textm)">${(p.generations||[]).length} generation${(p.generations||[]).length===1?'':'s'}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="selectCsProject('${p.id}')">${p.id===S.csActiveProjectId?'Deselect':'Select'}</button>
      </div>`).join('')||'<div style="font-size:11px;color:var(--textm)">No projects yet.</div>'}
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
function selectCsProject(id){
  S.csActiveProjectId=S.csActiveProjectId===id?null:id;
  saveSetting("cs_active_project",S.csActiveProjectId);
  renderCinemaStudio(document.getElementById("moduleContent"));
}

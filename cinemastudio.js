// ══════════════════════════════════════════════════════════════════════
// KAT FILMS 4K / CAMERA CRAFTS 4K — Higgsfield's Cinema Studio 4K (under
// Video) and Cinematic Camera (under Image) are the same tool shown
// under two names AND the same tool internally toggles between an Image
// mode and a Video mode via a switcher next to the prompt box — that
// toggle is what actually determines which of the two names applies at
// any given moment, confirmed directly. One module, S.csMode
// ("image"|"video") driving both which generation pipeline runs and
// which name/branding shows.
// Reached from two sidebar entries that each set the starting mode —
// "Kat Films 4K" inside Video Studio (video), "Camera Crafts 4K" inside
// Image Studio (image) — the in-composer toggle can switch either way
// afterward without leaving the module. Not related to Kosmic Engine.
//
// UI, rebuilt to match Image Gen / Video Canvas's actual chat pattern
// exactly (not just visually similar) — same CSS classes, same
// mechanism, per direct instruction to stop hand-rolling a compacted
// form: .ig-chat-shell/.ig-chat-header/.ig-chat-thread for the
// conversation, .ig-chat-inputbar/.ig-input-shell/.ig-input-textarea-v2/
// .ig-input-toolbar/.ig-send-round for the composer, and every control
// that used to be a cramped inline <select> row (Genre, Camera Movement,
// Speed Ramp, Duration, Aspect Ratio, and the new Kat Films tier) now
// lives behind the ⚙ Settings bottom sheet (.ig-settings-sheet,
// toggleCsSettings, same swipeable/backdrop mechanism as
// toggleIgSettings/toggleVcSettings), using the app's existing generic
// pickers (renderSimpleTrigger/openSimplePicker for flat lists) instead
// of new one-off styling.
//
// KAT FILMS TIERS — new for this pass. A real walkthrough showed
// Higgsfield's Cinema Studio has 3 selectable model versions (2.5, 3,
// 3.5) with different feature sets, not one fixed tool. This app mirrors
// that shape with 4 tiers (KAT_FILMS_TIERS below) rather than copying
// Higgsfield's own version numbers as branding:
//   - "Kat Films — Signature 1": deliberately EMPTY per direct
//     instruction — a reserved slot, not a placeholder pretending to be
//     a feature. Selecting it shows an honest "nothing here yet" state
//     and disables Generate.
//   - "Kat Films 1" ≈ Cinema Studio 2.5, fully built — that version was
//     completely explored in the reference video, so this is a genuine
//     1:1 feature match: Genre, the full confirmed 14-option Camera
//     Movement list, Speed Ramp, Duration (with Custom).
//   - "Kat Films 1.5" ≈ Cinema Studio 3, built with what was confirmed
//     ("Enhanced camera and speed ramp control" per the reference) —
//     same field set as tier 1 for now since the specific enhancement
//     details weren't fully legible in the source video; flagged
//     honestly rather than guessed at.
//   - "Kat Films 2" ≈ Cinema Studio 3.5 — per direct instruction, this
//     research is INCOMPLETE. Built minimally and clearly marked as
//     partial rather than shipped as if it were feature-complete.
// Built in parts per direct instruction — this pass is the UI rebuild +
// full tier scaffold + a COMPLETE Kat Films 1. Tiers 1.5/2 get real,
// working generation today but are explicitly flagged as partial builds
// to finish once more source material is available.
//
// "Cinema Studio 3.5" etc. as named models are Higgsfield's own in-house
// model brand, not reachable via fal.ai — invented endpoints aren't
// shipped here. Each tier maps to a REAL fal model under the hood
// (KAT_FILMS_TIERS[].videoModel/imageModel) rather than a fake one.
// "Speed Ramp" and "Camera Movement" aren't real Seedance/Kling API
// parameters (checked against genViaSeedanceReference's actual accepted
// body fields) — they're prompt-injection phrases, not literal fields,
// same as this app's existing app-wide CAMERA_MOVES elsewhere.
// Character @mentions in Image mode use genViaFluxEdit (real multi-
// reference image composition, already used elsewhere in this app) so a
// mentioned character's actual reference photo is genuinely used.
//
// LOAD ORDER: after index.html's main inline script — needs S, gs, save,
// saveSetting, toast, escapeHtml, pIcon, SE_MODEL_ALLOWED,
// modelOptionsHTML, renderSimpleTrigger, openSimplePicker,
// selectSimpleOption, sheetSwipeStart/Move/End, genViaSeedanceReference,
// genViaFal, genViaFluxEdit, uploadRefsToFal, createVideoAsset,
// createImageAsset, logCost, showPromptDialog, downloadWithName,
// sanitizeFilenamePart, openCollectionPicker, VC_RESULT_ICONS.
// ══════════════════════════════════════════════════════════════════════

S.csProjects=S.csProjects||gs("cs_projects",[])||[];
S.csActiveProjectId=S.csActiveProjectId||gs("cs_active_project",null);
S.csFavorites=S.csFavorites||gs("cs_favorites",[])||[];
S.csView=S.csView||"home";
S.csMode=S.csMode||"video";
S.csTier=S.csTier||gs("cs_tier","katfilms1")||"katfilms1";
S.csChatHistory=S.csChatHistory||gs("cs_chat_history",[])||[];
S.csMentionOpen=false;

const KAT_FILMS_TIERS=[
  {id:"signature1",label:"Kat Films — Signature 1",sub:"Empty — reserved for a future tier",empty:true},
  {id:"katfilms1",label:"Kat Films 1",sub:"≈ Cinema Studio 2.5 — fully built",
    videoModel:"bytedance/seedance-2.0/fast/text-to-video",imageModel:"fal-ai/flux/dev"},
  {id:"katfilms1_5",label:"Kat Films 1.5",sub:"≈ Cinema Studio 3 — enhanced camera & speed ramp control",
    videoModel:"bytedance/seedance-2.0/text-to-video",imageModel:"fal-ai/flux/dev",partial:true},
  {id:"katfilms2",label:"Kat Films 2",sub:"≈ Cinema Studio 3.5 — research incomplete",
    videoModel:"bytedance/seedance-2.0/text-to-video",imageModel:"fal-ai/flux/dev",partial:true},
];
function getCsTier(){return KAT_FILMS_TIERS.find(t=>t.id===S.csTier)||KAT_FILMS_TIERS[1];}

const CINEMA_GENRES=[
  {label:"General",frag:""},
  {label:"Action/Fight",frag:"high-energy action cinematography, dynamic kinetic movement"},
  {label:"Romance/Emotional",frag:"intimate emotional cinematography, soft warm tones"},
  {label:"Horror/Suspense",frag:"tense suspenseful cinematography, unsettling atmosphere"},
  {label:"Comedy",frag:"bright playful cinematography, comedic timing"},
  {label:"Dialogue/Drama",frag:"grounded dramatic cinematography, natural character-focused framing"},
  {label:"Chase/Pursuit",frag:"kinetic pursuit cinematography, fast tracking movement"},
];

// The full 14-option list confirmed directly from the reference video's
// Camera Movement grid (Handheld through Dolly Right) — deliberately
// separate from the app-wide CAMERA_MOVES array (used by Edit Video,
// storyboards, etc.) rather than overwriting it, since that one has its
// own different, already-working option set used elsewhere.
const KAT_FILMS_CAMERA_MOVES=[
  {label:"Auto",value:""},
  {label:"Handheld",value:"handheld camera with natural shake, documentary feel"},
  {label:"Zoom In",value:"camera zooms in toward the subject"},
  {label:"Zoom Out",value:"camera zooms out from the subject"},
  {label:"Camera Follows",value:"camera tracks and follows the subject's movement"},
  {label:"Pan Left",value:"smooth camera pan to the left"},
  {label:"Pan Right",value:"smooth camera pan to the right"},
  {label:"Tilt Up",value:"camera tilts upward"},
  {label:"Tilt Down",value:"camera tilts downward"},
  {label:"Orbit Around",value:"camera orbits slowly around the subject"},
  {label:"Dolly In",value:"camera dollies in toward the subject"},
  {label:"Dolly Out",value:"camera dollies out away from the subject"},
  {label:"Dolly Left",value:"camera dollies laterally to the left"},
  {label:"Dolly Right",value:"camera dollies laterally to the right"},
  {label:"Drone Shot",value:"sweeping aerial drone shot"},
];

// Only "Slow-Mo" and "Auto" were clearly legible in the reference video;
// the rest of this list carries over from the version built earlier as a
// reasonable, clearly-labeled set rather than guessing at Higgsfield's
// exact remaining option names.
const SPEED_RAMPS=[
  {label:"Auto",value:""},
  {label:"None — constant speed",value:"constant real-time speed throughout, no speed ramping"},
  {label:"Slow-Mo",value:"dramatic slow-motion throughout"},
  {label:"Ramp Up (slow → fast)",value:"speed ramps from slow motion into fast real-time motion"},
  {label:"Ramp Down (fast → slow)",value:"speed ramps from fast motion down into dramatic slow-motion"},
];

// Duration includes "Custom" (confirmed in the reference video) — since
// Seedance only accepts specific durations, a custom entry gets snapped
// to the nearest valid one (see snapToKatFilmsDuration) rather than
// silently failing or pretending arbitrary lengths work.
const KAT_FILMS_DURATIONS=[4,5,6,8,10,12,15];
function snapToKatFilmsDuration(seconds){
  return KAT_FILMS_DURATIONS.find(d=>d>=seconds)||KAT_FILMS_DURATIONS[KAT_FILMS_DURATIONS.length-1];
}

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
  el.innerHTML=`
    <div style="display:flex;gap:0;min-height:60vh">
      <div style="width:128px;flex-shrink:0;border-right:1px solid var(--glass-brd);padding:10px 6px;display:flex;flex-direction:column">
        <div id="csTitle" style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet);padding:4px 6px 2px">${S.csMode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K"}</div>
        <div id="csTierBadge" style="font-size:9px;color:var(--textm);padding:0 6px 8px">${escapeHtml(getCsTier().label)}</div>
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
      <div style="flex:1;padding:14px;max-width:560px">
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

// ── HOME — rebuilt on the exact ig-chat-shell pattern Image Gen/Video
// Canvas use: thread + settings bottom sheet + composer, instead of a
// hand-rolled compact form. ──
function renderCsHome(wrap){
  const hasKey=gs("api_falai");
  const tier=getCsTier();
  const isVideo=S.csMode==="video";

  if(tier.empty){
    wrap.innerHTML=`<div class="ig-chat-shell" style="padding:40px 20px;text-align:center">
      <div style="font-size:32px;margin-bottom:10px;opacity:0.5">🎬</div>
      <div style="font-size:14px;font-weight:700;color:var(--textm)">${escapeHtml(tier.label)} is empty right now</div>
      <div style="font-size:12px;color:var(--texts);margin-top:6px">This slot is reserved for a future tier — nothing to generate with yet.</div>
      <button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="openCsTierPicker()">Choose a different tier</button>
    </div>`;
    return;
  }

  wrap.innerHTML=`
    <div class="ig-chat-shell">
      <div class="ig-chat-header">
        <button class="ig-icon-btn" onclick="openCsTierPicker()" title="Change Tier">${isVideo?'🎬':'📷'}</button>
        <div style="flex:1;text-align:center">
          <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">${isVideo?'Kat Films 4K':'Camera Crafts 4K'}</div>
          <div style="font-size:10px;color:var(--textm);margin-top:1px">${hasKey?'<span style="color:var(--green);font-weight:700">●</span> Ready':'<span style="color:var(--red);font-weight:700">●</span> No key configured'} · ${escapeHtml(tier.label)}${tier.partial?' <span style="color:var(--gold)">(partial build)</span>':''}</div>
        </div>
        <button class="ig-icon-btn" onclick="toast('Chat history stays right here — scroll up','')" title="Info">ℹ</button>
      </div>

      <div class="ig-chat-thread" id="csChatThread"></div>

      <div class="ig-settings-backdrop" id="csSettingsBackdrop" onclick="toggleCsSettings()"></div>
      <div class="ig-settings-sheet" id="csSettingsPanel">
        <div class="ig-sheet-handle" ontouchstart="sheetSwipeStart(event)" ontouchmove="sheetSwipeMove(event,'csSettingsPanel')" ontouchend="sheetSwipeEnd(event,'csSettingsPanel','toggleCsSettings')"></div>
        <div class="ig-sheet-header">
          <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">⚙ Settings</div>
          <button class="ig-icon-btn" onclick="toggleCsSettings()" title="Close">✕</button>
        </div>
        <div style="padding:14px 16px" id="csSettingsBody"></div>
      </div>

      <div class="ig-chat-inputbar">
        <div class="ig-input-shell">
          <div style="display:flex;gap:4px;margin-bottom:6px;background:var(--pearl2);border-radius:9px;padding:3px;width:fit-content">
            <button id="csModeImage" onclick="setCsMode('image')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;background:${!isVideo?'var(--violet)':'transparent'};color:${!isVideo?'#fff':'var(--textm)'}">📷 Image</button>
            <button id="csModeVideo" onclick="setCsMode('video')" style="border:none;border-radius:7px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;background:${isVideo?'var(--violet)':'transparent'};color:${isVideo?'#fff':'var(--textm)'}">🎬 Video</button>
          </div>
          <textarea class="ig-input-textarea-v2" id="csPrompt" rows="1" placeholder="${hasKey?'Describe your scene — use @ to add a character':'Add an API key in Settings first…'}" ${!hasKey?'disabled':''} onkeydown="handleCsChatKeydown(event)" oninput="handleCsPromptInput(event);this.style.height='auto';this.style.height=Math.min(this.scrollHeight,200)+'px'"></textarea>
          <div id="csMentionDropdown" style="display:none;position:absolute;left:10px;right:10px;background:var(--pearl2);border:1.5px solid var(--glass-brd);border-radius:10px;padding:4px;z-index:10;max-height:160px;overflow-y:auto"></div>
          <div class="ig-input-toolbar">
            <button class="ig-tool-btn" onclick="toggleCsSettings()" title="Settings">⚙</button>
            <button class="ig-send-round" id="csGenBtn" ${!hasKey?'disabled':''} onclick="sendCinemaStudioGen()" title="Generate">➤</button>
          </div>
          <div style="font-size:9px;color:var(--texts);padding:2px 4px 0;display:flex;justify-content:space-between"><span id="csCostHint" style="font-weight:700;color:var(--gold)"></span><span>Enter for a new line · <b>Ctrl+Enter</b> to generate</span></div>
        </div>
      </div>
    </div>`;
  renderCsSettingsBody();
  renderCsChatThread();
  updateCsCostHint();
}

function renderCsSettingsBody(){
  const body=document.getElementById("csSettingsBody");
  if(!body)return;
  const isVideo=S.csMode==="video";
  const tier=getCsTier();
  body.innerHTML=`
    ${tier.partial?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:11px;color:var(--textm);margin-bottom:12px">⚠️ ${escapeHtml(tier.label)} is a partial build — flagged, not hidden. Full parity coming once more source material is confirmed.</div>`:''}
    <div class="f-group">
      <label class="f-label">Kat Films Tier</label>
      <select class="f-select" id="csTierSelect" style="display:none" onchange="renderSimpleTrigger('csTierSelect')">${KAT_FILMS_TIERS.map(t=>`<option value="${t.id}" ${t.id===S.csTier?'selected':''}>${escapeHtml(t.label)} — ${escapeHtml(t.sub)}</option>`).join('')}</select>
      <div id="csTierSelectTrigger" onclick="openCsTierPicker()" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Genre</label>
      <select class="f-select" id="csGenre" style="display:none" onchange="renderSimpleTrigger('csGenre');updateCsCostHint()">${CINEMA_GENRES.map(g=>`<option value="${g.label}">${g.label}</option>`).join('')}</select>
      <div id="csGenreTrigger" onclick="openSimplePicker('csGenre','Choose Genre')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    ${isVideo?`
    <div class="f-group">
      <label class="f-label">Camera Movement</label>
      <select class="f-select" id="csCameraMove" style="display:none" onchange="renderSimpleTrigger('csCameraMove')">${KAT_FILMS_CAMERA_MOVES.map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}</select>
      <div id="csCameraMoveTrigger" onclick="openSimplePicker('csCameraMove','Camera Movement')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Speed Ramp</label>
      <select class="f-select" id="csSpeedRamp" style="display:none" onchange="renderSimpleTrigger('csSpeedRamp')">${SPEED_RAMPS.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      <div id="csSpeedRampTrigger" onclick="openSimplePicker('csSpeedRamp','Speed Ramp')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>` : ''}
    <div class="f-row">
      <div class="f-group">
        <label class="f-label">Aspect Ratio</label>
        <select class="f-select" id="csRatio" style="display:none" onchange="renderSimpleTrigger('csRatio')">
          <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option>
        </select>
        <div id="csRatioTrigger" onclick="openSimplePicker('csRatio','Aspect Ratio')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
      </div>
      ${isVideo?`<div class="f-group">
        <label class="f-label">Duration</label>
        <select class="f-select" id="csDuration" style="display:none" onchange="renderSimpleTrigger('csDuration')">${KAT_FILMS_DURATIONS.map(d=>`<option value="${d}" ${d===6?'selected':''}>${d}s</option>`).join('')}<option value="custom">Custom…</option></select>
        <div id="csDurationTrigger" onclick="openSimplePicker('csDuration','Duration')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
      </div>`:''}
    </div>
    <div id="csCustomDurationWrap" style="display:none" class="f-group">
      <label class="f-label">Custom Duration (seconds) <span style="font-weight:400;color:var(--texts)">— snapped to the nearest length the model supports</span></label>
      <input type="number" class="f-input" id="csCustomDuration" min="3" max="15" value="6">
    </div>
    <div style="font-size:10px;color:var(--textm);margin-top:4px">Powered by: <b>${escapeHtml(isVideo?tier.videoModel:tier.imageModel)}</b></div>`;
  renderSimpleTrigger("csTierSelect");
  renderSimpleTrigger("csGenre");
  if(isVideo){renderSimpleTrigger("csCameraMove");renderSimpleTrigger("csSpeedRamp");renderSimpleTrigger("csDuration");}
  renderSimpleTrigger("csRatio");
  const durSel=document.getElementById("csDuration");
  if(durSel)durSel.addEventListener("change",()=>{
    document.getElementById("csCustomDurationWrap").style.display=durSel.value==="custom"?"block":"none";
  });
}

function toggleCsSettings(){
  const panel=document.getElementById("csSettingsPanel");
  const backdrop=document.getElementById("csSettingsBackdrop");
  if(!panel)return;
  const opening=!panel.classList.contains("open");
  panel.classList.toggle("open",opening);
  if(backdrop)backdrop.classList.toggle("show",opening);
}

// ── KAT FILMS TIER PICKER — same bottom-sheet chrome as the model
// picker, custom (not openModelPicker/openSimplePicker) so each row can
// show its sub-label and an "empty"/"partial" flag inline. ──
function openCsTierPicker(){
  closeModelPicker();
  const overlay=document.createElement("div");
  overlay.id="modelPickerOverlay";
  overlay.style.cssText="position:fixed;inset:0;background:rgba(20,10,40,0.45);z-index:400;display:flex;align-items:flex-end";
  overlay.onclick=(e)=>{if(e.target===overlay)closeModelPicker();};
  overlay.innerHTML=`
    <div style="background:var(--surface);width:100%;max-height:78vh;border-radius:20px 20px 0 0;overflow-y:auto;box-shadow:var(--shv)">
      <div style="position:sticky;top:0;background:var(--surface);padding:14px 18px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;z-index:2">
        <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">Choose a Kat Films Tier</div>
        <button onclick="closeModelPicker()" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--lav);color:var(--textm);cursor:pointer">${pIcon('back',12)}</button>
      </div>
      <div style="padding:10px 14px 24px">
        ${KAT_FILMS_TIERS.map(t=>{
          const selected=t.id===S.csTier;
          return `<div onclick="selectCsTier('${t.id}')" style="display:flex;align-items:center;gap:11px;padding:12px 12px;border-radius:12px;cursor:pointer;margin-bottom:6px;border:1.5px solid ${selected?'var(--vs)':'transparent'};background:${selected?'var(--lav)':'transparent'}">
            <div style="flex:1;min-width:0">
              <div style="font-size:13.5px;font-weight:700;color:var(--text)">${escapeHtml(t.label)}${t.empty?' <span style="color:var(--textm);font-weight:400">(empty)</span>':t.partial?' <span style="color:var(--gold);font-weight:400">(partial)</span>':''}</div>
              <div style="font-size:11px;color:var(--textm);margin-top:1px">${escapeHtml(t.sub)}</div>
            </div>
            ${selected?`<div style="color:var(--violet)">${pIcon('check',16)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
function selectCsTier(tierId){
  S.csTier=tierId;
  saveSetting("cs_tier",tierId);
  closeModelPicker();
  renderCinemaStudio(document.getElementById("moduleContent"));
}

// Switching the Image/Video toggle is what makes this module BE Camera
// Crafts 4K vs Kat Films 4K at any given moment. Re-renders the whole
// Home view (simplest correct way to keep header/thread/settings/tier
// note all in sync) — the chat thread itself persists via S.csChatHistory
// regardless.
function setCsMode(mode){
  if(S.csMode===mode)return;
  S.csMode=mode;
  renderCsHome(document.getElementById("csViewBody"));
  syncCsSidebarActive();
}

function updateCsCostHint(){
  const tier=getCsTier();
  const hint=document.getElementById("csCostHint");
  if(!hint)return;
  if(S.csMode==="video"){
    const est=estimateVideoCost(tier.videoModel,6,"720p",false);
    hint.textContent=est?formatCostLine(est):"";
  }else{
    hint.textContent="";
  }
}

function handleCsChatKeydown(e){
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendCinemaStudioGen();}
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

// ── CHAT THREAD — same ig-bubble-user/assistant/loading pattern Image
// Gen and Video Canvas already use. ──
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

async function sendCinemaStudioGen(){
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const tier=getCsTier();
  if(tier.empty){toast(`${tier.label} is empty — choose a different tier`,"error");return;}
  const promptEl=document.getElementById("csPrompt");
  const rawPrompt=promptEl?.value.trim();
  if(!rawPrompt){toast("Describe your scene first","error");return;}
  const isVideo=S.csMode==="video";
  const genre=CINEMA_GENRES.find(g=>g.label===document.getElementById("csGenre")?.value)||CINEMA_GENRES[0];
  const cameraMove=isVideo?(document.getElementById("csCameraMove")?.value||""):"";
  const speedRamp=isVideo?(document.getElementById("csSpeedRamp")?.value||""):"";
  const ratio=document.getElementById("csRatio")?.value||"16:9";
  let duration=6;
  if(isVideo){
    const durVal=document.getElementById("csDuration")?.value;
    duration=durVal==="custom"?snapToKatFilmsDuration(parseInt(document.getElementById("csCustomDuration")?.value,10)||6):snapToKatFilmsDuration(parseInt(durVal,10)||6);
  }
  const model=isVideo?tier.videoModel:tier.imageModel;
  const btn=document.getElementById("csGenBtn");
  btn.disabled=true;btn.textContent="⏳";

  pushCsChatMessage({role:"user",content:rawPrompt});
  promptEl.value="";
  promptEl.style.height="auto";
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
      logCost(model,providerLabel+" ("+tier.label+")");
      replaceCsLoadingBubble(loadingId,{type:"video",content:videoUrl,meta:{prompt:finalPrompt,providerLabel,assetId:savedAsset.id}});
    } else {
      // Character mentions in Image mode get a REAL multi-reference
      // composition (genViaFluxEdit, already used elsewhere in this app
      // for multi-character storyboard shots) instead of plain
      // text-to-image, so a mentioned character's actual photo is used.
      const result=imageUrls.length
        ?await genViaFluxEdit(finalPrompt,imageUrls,ratio,"fal-ai/flux-2/flash/edit")
        :await genViaFal(finalPrompt,"",model,ratio,false);
      const savedAsset=await createImageAsset(result.url,finalPrompt,projectId,{model:imageUrls.length?"fal-ai/flux-2/flash/edit":model,providerLabel});
      if(projectId)addCsGenerationToProject(projectId,savedAsset.id);
      logCost(imageUrls.length?"fal-ai/flux-2/flash/edit":model,providerLabel+" ("+tier.label+")");
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
// tool in either mode, newest first, regardless of project. ──
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

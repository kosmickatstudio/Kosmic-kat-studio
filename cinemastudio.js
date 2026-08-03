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
//   - "Kat Films 1" ≈ Cinema Studio 2.5, fully built. That version's exact
//     tagline was confirmed via careful OCR sweep (image-viewing was down
//     this session — see note below) as "Camera selection, style presets,
//     and AI director" — all three now genuinely wired in: the 14-option
//     Camera Movement list, Style Preset (reuses this app's real
//     STYLE_PRESETS/openVisualPicker, the same system Image Gen uses —
//     not a second invented style list), and AI Director (reuses this
//     app's real getActiveDirectorPrompt()/Directorial Studio, not a new
//     director concept). Genre, Speed Ramp, Duration with Custom round
//     out the rest of the confirmed 2.5 feature set.
//   - "Kat Films 1.5" ≈ Cinema Studio 3. A dedicated Cinema Studio 3
//     walkthrough (separate from the 2.5 one) was OCR-reviewed and
//     confirmed its actual "enhanced camera and speed ramp control" means
//     a genuinely different Speed Ramp preset list — Auto, Ramp Up, Flash
//     In, Flash Out, Bullet Time, Hero Moment (SPEED_RAMPS_ENHANCED) — not
//     a vague "more control" gesture. That's now really wired in. Camera
//     Movement itself is the same confirmed 14-option list as 2.5, not
//     different. One remaining known gap, flagged rather than guessed at:
//     the same video showed a "Shot Control" field once, alongside the
//     Image/Video switch, without enough legible context to know what it
//     does — not built yet, worth a closer look at that field specifically.
//   - "Kat Films 2" ≈ Cinema Studio 3.5. A dedicated 3.5 walkthrough
//     (120s, OCR-reviewed same as the others — image viewing was still
//     down this session too) confirmed a genuinely new layer beyond 2.5/
//     3.0: a "Style Settings" panel with three named tabs — Color
//     Palette, Lighting, Camera Moveset Style — now really wired in
//     (CS35_COLOR_PALETTES/CS35_LIGHTING/CS35_CAMERA_MOVESET_STYLES).
//     Also added two genuinely new Genre values seen in this tier's
//     picker, Noir and Epic (not duplicates of the existing list).
//     HONEST GAPS, flagged rather than guessed at: only one or two preset
//     names were legible per Style Settings tab, so those lists are
//     almost certainly incomplete, and which exact tab "Dreamy" belongs
//     under is a best-effort read, not a certainty. The same video also
//     showed a separate "Camera Settings" panel repeatedly later on —
//     confirmed to exist, but its fields weren't legible enough via OCR
//     to build. Inherits the enhanced Speed Ramp list from tier 1.5 as a
//     reasonable inference (later tiers building on earlier ones is the
//     pattern actually observed across 2.5→3→3.5).
// Built in parts per direct instruction — this pass completed Kat Films
// 1.5's real Speed Ramp differentiator and Kat Films 2's Style Settings
// panel. "Shot Control", the "Camera Settings" panel, and fuller preset
// lists per Style Settings tab remain open for a future pass.
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
// Beyond named Characters, a "+" button next to the prompt (matching
// Higgsfield's own "+ | @" composer pattern) lets you attach ANY image
// ad-hoc and reference it as @Image1, @Image2, etc. — real uploads,
// really passed into the actual generation call alongside whatever
// Character mentions are also present. Attachments are ephemeral (not
// persisted, cleared after each send) same as the prompt text itself.
//
// SESSION NOTE: direct image/frame viewing was non-functional for this
// entire session (confirmed by testing on multiple fresh extractions and
// even a previously-working uploaded screenshot — an infrastructure
// issue, not a file problem). Analysis for this pass came from a
// thorough OCR sweep instead: ~36 full-1920x1080 frames across the whole
// 60s video, contrast/sharpness-enhanced and 2x upscaled before running
// tesseract in sparse-text mode. That's a lower-confidence method than
// actually looking at the UI — treat facts below as OCR-confirmed, not
// visually verified, and worth a real visual pass once viewing works
// again.
//
// LOAD ORDER: after index.html's main inline script — needs S, gs, save,
// saveSetting, toast, escapeHtml, pIcon, SE_MODEL_ALLOWED,
// modelOptionsHTML, renderSimpleTrigger, openSimplePicker,
// selectSimpleOption, openVisualPicker, renderVisualTrigger,
// STYLE_PRESETS, getAllDirectors, sheetSwipeStart/Move/End,
// genViaSeedanceReference, genViaFal, genViaFluxEdit, uploadRefsToFal,
// downscaleImageFile, createVideoAsset, createImageAsset, logCost, showPromptDialog,
// downloadWithName, sanitizeFilenamePart, openCollectionPicker,
// VC_RESULT_ICONS. Also needs getActiveDirectorPrompt from directors.js,
// which must be loaded too.
// ══════════════════════════════════════════════════════════════════════

S.csProjects=S.csProjects||gs("cs_projects",[])||[];
S.csActiveProjectId=S.csActiveProjectId||gs("cs_active_project",null);
S.csFavorites=S.csFavorites||gs("cs_favorites",[])||[];
S.csView=S.csView||"home";
S.csMode=S.csMode||"video";
S.csTier=S.csTier||gs("cs_tier","katfilms1")||"katfilms1";
S.csChatHistory=S.csChatHistory||gs("cs_chat_history",[])||[];
S.csMentionOpen=false;
// Ad-hoc reference images — tagged @Image1, @Image2 etc., the generic
// counterpart to @CharacterName mentions. Deliberately NOT persisted
// (data URLs get large fast) and cleared per-generation, same lifecycle
// as the prompt text itself — these are "attachments to this message,"
// not a saved library. csRefImageCounter is monotonic so a removed tag's
// number is never reused mid-session, avoiding collisions with text
// someone already typed.
S.csRefImages=S.csRefImages||[];
S.csRefImageCounter=S.csRefImageCounter||0;

const KAT_FILMS_TIERS=[
  // Signature 1 / 1 / 1.5 / 2 are the Cinema Studio 2.5→3→3.5 progression
  // — video-motion features (Camera Movement, Speed Ramp, AI Director,
  // Style Settings). Per direct instruction: these are Kat Films 4K
  // features specifically, not shared with Camera Crafts — videoOnly,
  // full stop, not just differently labeled there.
  {id:"signature1",label:"Kat Films — Signature 1",sub:"Empty — reserved for a future tier",empty:true,videoOnly:true},
  {id:"katfilms1",label:"Kat Films 1",sub:"≈ Cinema Studio 2.5 — Camera selection, Style Presets, AI Director (fully built)",
    videoModel:"bytedance/seedance-2.0/fast/text-to-video",imageModel:"fal-ai/flux/dev",videoOnly:true},
  {id:"katfilms1_5",label:"Kat Films 1.5",sub:"≈ Cinema Studio 3 — adds enhanced Speed Ramp presets (Flash In/Out, Bullet Time, Hero Moment)",
    videoModel:"bytedance/seedance-2.0/text-to-video",imageModel:"fal-ai/flux/dev",enhancedSpeedRamp:true,partial:true,videoOnly:true},
  {id:"katfilms2",label:"Kat Films 2",sub:"≈ Cinema Studio 3.5 — adds Style Settings (Color Palette/Lighting/Camera Moveset Style); research ongoing",
    videoModel:"bytedance/seedance-2.0/text-to-video",imageModel:"fal-ai/flux/dev",enhancedSpeedRamp:true,styleSettingsPanel:true,partial:true,videoOnly:true},
  // Soul Studio — the ONLY tier Camera Crafts 4K offers. Higgsfield's
  // separate Soul model family (Soul 2.0 / Soul Cinema, plus AI Cast /
  // Cinematic Locations / Cinematic Cameras / Soul HEX — confirmed via
  // OCR of a dedicated Soul Cinema walkthrough, the actual reason that
  // recording was sent). Genuinely image-only (no Soul video model found)
  // AND genuinely the answer to what Camera Crafts 4K itself should be,
  // not a re-skin of Kat Films' video tiers. Reserved/empty for now, same
  // honest pattern as Signature 1: Soul Cast (the character-builder
  // piece) already shipped inside Persona Studio; Cinematic Locations/
  // Cameras and Soul HEX are the remaining pieces, not built here yet —
  // until one of those lands, Camera Crafts 4K has no working generate
  // tier, and that's the honest state rather than quietly borrowing Kat
  // Films' imageModel to fake one.
  {id:"soulstudio",label:"Soul Studio",sub:"Higgsfield Soul 2.0/Soul Cinema — image-only. Soul Cast already built in Persona Studio; Cinematic Locations/Cameras + Soul HEX not yet built.",
    empty:true,imageOnly:true},
];
// Tiers visible in the picker for the CURRENT mode. Full separation, not
// just different labels: Camera Crafts (image) only ever offers Soul
// Studio; Kat Films (video) only ever offers the 4 videoOnly tiers.
function csTiersForMode(mode){
  return KAT_FILMS_TIERS.filter(t=>!(t.imageOnly&&mode!=="image")&&!(t.videoOnly&&mode!=="video"));
}
function getCsTier(){return KAT_FILMS_TIERS.find(t=>t.id===S.csTier)||KAT_FILMS_TIERS[1];}

const CINEMA_GENRES=[
  {label:"General",frag:""},
  {label:"Action/Fight",frag:"high-energy action cinematography, dynamic kinetic movement"},
  {label:"Romance/Emotional",frag:"intimate emotional cinematography, soft warm tones"},
  {label:"Horror/Suspense",frag:"tense suspenseful cinematography, unsettling atmosphere"},
  {label:"Comedy",frag:"bright playful cinematography, comedic timing"},
  {label:"Dialogue/Drama",frag:"grounded dramatic cinematography, natural character-focused framing"},
  {label:"Chase/Pursuit",frag:"kinetic pursuit cinematography, fast tracking movement"},
  {label:"Noir",frag:"film noir cinematography, high-contrast shadows, moody atmosphere"},
  {label:"Epic",frag:"epic sweeping cinematography, grand scale, dramatic grandeur"},
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

// Only "Slow-Mo" and "Auto" were clearly legible in the Cinema Studio 2.5
// video; the rest of this list is a reasonable, clearly-labeled set
// rather than a guess at Higgsfield's exact remaining option names for
// that tier.
const SPEED_RAMPS=[
  {label:"Auto",value:""},
  {label:"None — constant speed",value:"constant real-time speed throughout, no speed ramping"},
  {label:"Slow-Mo",value:"dramatic slow-motion throughout"},
  {label:"Ramp Up (slow → fast)",value:"speed ramps from slow motion into fast real-time motion"},
  {label:"Ramp Down (fast → slow)",value:"speed ramps from fast motion down into dramatic slow-motion"},
];

// Cinema Studio 3's actual Speed Ramp option list, OCR-confirmed directly
// from its Director's Panel (a genuinely different, more cinema-specific
// preset set than 2.5's — this IS the concrete substance behind 3.0's
// "enhanced camera and speed ramp control" tagline, not a guess at what
// "enhanced" might mean):
const SPEED_RAMPS_ENHANCED=[
  {label:"Auto",value:""},
  {label:"Ramp Up",value:"speed ramps from slow motion into fast real-time motion"},
  {label:"Flash In",value:"a rapid flash-cut speed surge into the shot"},
  {label:"Flash Out",value:"a rapid flash-cut speed surge out of the shot"},
  {label:"Bullet Time",value:"dramatic bullet-time effect, motion freezes as the camera orbits around the subject"},
  {label:"Hero Moment",value:"motion eases into a slow, powerful hero moment emphasizing the subject"},
];
// KNOWN GAP, flagged rather than guessed at: the same Director's Panel
// also showed a field labeled "Shot Control" once in the OCR sweep,
// alongside the Image/Video switch — not enough legible context to know
// what it actually does, so it isn't built yet. Worth a real visual pass
// once frame-viewing is back, or a closer video of that specific field.

// Duration includes "Custom" (confirmed in the reference video) — since
// Seedance only accepts specific durations, a custom entry gets snapped
// to the nearest valid one (see snapToKatFilmsDuration) rather than
// silently failing or pretending arbitrary lengths work.
const KAT_FILMS_DURATIONS=[4,5,6,8,10,12,15];
function snapToKatFilmsDuration(seconds){
  return KAT_FILMS_DURATIONS.find(d=>d>=seconds)||KAT_FILMS_DURATIONS[KAT_FILMS_DURATIONS.length-1];
}

// Cinema Studio 3.5-exclusive "Style Settings" panel — a genuinely new
// layer confirmed via OCR, distinct from Genre/Style Preset/AI Director:
// three named tabs (Color Palette / Lighting / Camera Moveset Style),
// each with its own presets. HONEST GAP: only one or two preset names
// were legible per tab in the source video, and which specific preset
// belongs under which tab is a best-effort reading, not a certainty —
// "Dreamy" in particular could plausibly sit under Lighting or be a
// separate top-level field ("Style: Dreamy" appeared once on its own).
// Placed under Lighting here since a soft dreamy quality is usually a
// lighting characteristic, flagged rather than silently assumed correct.
// Each tab almost certainly has more real presets than shown here — this
// is what was legible, not a claim that these are the complete lists.
const CS35_COLOR_PALETTES=[
  {label:"Auto",value:""},
  {label:"Hyper Neon",value:"hyper-saturated neon color grading, vivid electric hues"},
  {label:"Raw Chaos",value:"raw chaotic color grading, gritty desaturated clash of tones"},
];
const CS35_LIGHTING=[
  {label:"Auto",value:""},
  {label:"Overhead Fall",value:"dramatic overhead lighting falling downward onto the subject"},
  {label:"Dreamy",value:"soft dreamy diffused lighting, gentle glow"},
];
const CS35_CAMERA_MOVESET_STYLES=[
  {label:"Auto",value:""},
  {label:"Epic Scale",value:"epic large-scale camera work, sweeping grandeur"},
];
// KNOWN GAP, flagged rather than guessed at: the same video also showed
// a separate "Camera Settings" panel later on (distinct from Style
// Settings) repeatedly, but the on-screen text wasn't legible enough via
// OCR to know its actual fields — not built yet.

// Entry point from the sidebar — each of the two buttons calls this with
// its own mode so opening "Camera Crafts 4K" actually starts in Image
// mode and "Kat Films 4K" starts in Video mode, before the in-composer
// toggle can take over.
// Shared by openCinemaStudio (fresh sidebar entry) and setCsMode
// (in-composer toggle) so a tier restricted to the other mode (e.g.
// image-only Soul Studio) can never stay selected once we're not in its
// mode, however we got here.
function ensureCsTierValidForMode(mode){
  if(!csTiersForMode(mode).some(t=>t.id===S.csTier)){
    S.csTier=csTiersForMode(mode)[0]?.id||S.csTier;
    saveSetting("cs_tier",S.csTier);
  }
}
function openCinemaStudio(mode,el){
  S.csMode=mode;
  ensureCsTierValidForMode(mode);
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
    <div style="max-width:600px;margin:0 auto;padding:10px 8px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <button class="ig-icon-btn" onclick="openCsNavMenu()" title="Menu">☰</button>
        <div style="flex:1;min-width:0">
          <div id="csTitle" style="font-family:'Cinzel',serif;font-size:15px;font-weight:700;color:var(--violet);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${S.csMode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K"}</div>
          <div id="csTierBadge" style="font-size:10px;color:var(--textm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${csHeaderSubtitle()}</div>
        </div>
        <button class="ig-icon-btn" onclick="openCsTierPicker()" title="Change Tier">${S.csMode==="video"?'🎬':'📷'}</button>
      </div>
      <div id="csViewBody"></div>
    </div>`;
  syncCsSidebarActive();
  renderCsViewBody();
}

// Full-width on phones was the whole point of this rebuild — a permanent
// 128px inner sidebar (Home/My Generations/etc + Projects) ate a huge
// share of a real phone viewport and squeezed the actual chat into a
// cramped corner column. Same fix Image Gen already uses for its own
// nav-ish overlay (☰ Chat History → openIgChatHistory, a centered
// .modal-overlay, not a permanent column) — mirrored here exactly rather
// than inventing a new mobile pattern.
const CS_VIEW_LABELS={home:"Home",generations:"My Generations",elements:"My Elements",favorites:"My Favorites",community:"Community",academy:"Academy"};

function csHeaderSubtitle(){
  const hasKey=gs("api_falai");
  const tier=getCsTier();
  const director=gs("active_director","")?(getAllDirectors().find(d=>d.id===gs("active_director",""))||{}).name:"";
  return `${hasKey?'<span style="color:var(--green);font-weight:700">●</span>':'<span style="color:var(--red);font-weight:700">●</span>'} ${escapeHtml(tier.label)}${tier.partial?' <span style="color:var(--gold)">(partial)</span>':''} · ${CS_VIEW_LABELS[S.csView]||'Home'}${director?' · '+pIcon('film',10)+' '+escapeHtml(director):''}`;
}

function openCsNavMenu(){
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.id="csNavModal";
  overlay.innerHTML=`
    <div class="modal" style="max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet)">${S.csMode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K"}</div>
        <button class="ig-icon-btn" onclick="document.getElementById('csNavModal').remove()">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">
        ${Object.entries(CS_VIEW_LABELS).map(([id,label])=>{
          const icons={home:"🏠",generations:"🎞",elements:"🎭",favorites:"⭐",community:"👥",academy:"🎓"};
          return `<button class="btn btn-sm" style="width:100%;text-align:left;margin-bottom:4px;background:${S.csView===id?'var(--violet)':'transparent'};color:${S.csView===id?'#fff':'var(--text)'};border:${S.csView===id?'none':'1px solid var(--border)'};padding:10px 12px" onclick="setCsView('${id}');document.getElementById('csNavModal').remove()">${icons[id]} ${label}</button>`;
        }).join('')}
        <div style="margin:14px 0 8px;padding-top:10px;border-top:1px solid var(--glass-brd)">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--textm);margin-bottom:8px">Projects</div>
          <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:8px" onclick="document.getElementById('csNavModal').remove();newCsProject()">+ New Project</button>
          <select class="f-select" id="csProjectLoader" onchange="loadCsProject(this.value)">
            <option value="">Load Project…</option>
            ${S.csProjects.slice().reverse().map(p=>`<option value="${p.id}" ${p.id===S.csActiveProjectId?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function setCsView(id){
  S.csView=id;
  const badge=document.getElementById("csTierBadge");
  if(badge)badge.innerHTML=csHeaderSubtitle();
  renderCsViewBody();
}
function loadCsProject(id){
  S.csActiveProjectId=id||null;
  saveSetting("cs_active_project",S.csActiveProjectId);
  document.getElementById("csNavModal")?.remove();
  toast(id?"Project loaded":"No project selected — generations save unfiled","success");
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
          <textarea class="ig-input-textarea-v2" id="csPrompt" rows="1" placeholder="${hasKey?'Describe your scene — use @ to add a character or reference image':'Add an API key in Settings first…'}" ${!hasKey?'disabled':''} onkeydown="handleCsChatKeydown(event)" oninput="handleCsPromptInput(event);this.style.height='auto';this.style.height=Math.min(this.scrollHeight,200)+'px'"></textarea>
          <div id="csMentionDropdown" style="display:none;position:absolute;left:10px;right:10px;background:var(--pearl2);border:1.5px solid var(--glass-brd);border-radius:10px;padding:4px;z-index:10;max-height:160px;overflow-y:auto"></div>
          <input type="file" accept="image/*" id="csRefImageFile" style="display:none" onchange="handleCsRefImageUpload(event)">
          <div id="csRefImageStrip" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 2px 6px"></div>
          <div class="ig-input-toolbar">
            <button class="ig-tool-btn" onclick="document.getElementById('csRefImageFile').click()" title="Attach a reference image">+</button>
            <button class="ig-tool-btn" onclick="toggleCsSettings()" title="Settings">⚙</button>
            <button class="ig-send-round" id="csGenBtn" ${!hasKey?'disabled':''} onclick="sendCinemaStudioGen()" title="Generate">➤</button>
          </div>
          <div style="font-size:9px;color:var(--texts);padding:2px 4px 0;display:flex;justify-content:space-between"><span id="csCostHint" style="font-weight:700;color:var(--gold)"></span><span>Enter for a new line · <b>Ctrl+Enter</b> to generate</span></div>
        </div>
      </div>
    </div>`;
  renderCsSettingsBody();
  renderCsChatThread();
  renderCsRefImageStrip();
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
      <label class="f-label">${isVideo?"Kat Films":"Camera Crafts"} Tier</label>
      <select class="f-select" id="csTierSelect" style="display:none" onchange="renderSimpleTrigger('csTierSelect')">${csTiersForMode(S.csMode).map(t=>`<option value="${t.id}" ${t.id===S.csTier?'selected':''}>${escapeHtml(t.label)} — ${escapeHtml(t.sub)}</option>`).join('')}</select>
      <div id="csTierSelectTrigger" onclick="openCsTierPicker()" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Genre</label>
      <select class="f-select" id="csGenre" style="display:none" onchange="renderSimpleTrigger('csGenre');updateCsCostHint()">${CINEMA_GENRES.map(g=>`<option value="${g.label}">${g.label}</option>`).join('')}</select>
      <div id="csGenreTrigger" onclick="openSimplePicker('csGenre','Choose Genre')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Style Preset <span style="font-weight:400;color:var(--texts)">— part of Cinema Studio 2.5's real feature set (camera selection + style presets + AI director)</span></label>
      <select class="f-select" id="csStyle" style="display:none" onchange="renderVisualTrigger('csStyle','style')">${STYLE_PRESETS.map(s=>`<option value="${s.value.replace(/"/g,'&quot;')}">${s.label}</option>`).join('')}</select>
      <div id="csStyleTrigger" onclick="openVisualPicker('csStyle','Choose Style','style')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    ${isVideo?`
    <div class="f-group">
      <label class="f-label">Camera Movement</label>
      <select class="f-select" id="csCameraMove" style="display:none" onchange="renderSimpleTrigger('csCameraMove')">${KAT_FILMS_CAMERA_MOVES.map(c=>`<option value="${c.value}">${c.label}</option>`).join('')}</select>
      <div id="csCameraMoveTrigger" onclick="openSimplePicker('csCameraMove','Camera Movement')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Speed Ramp${tier.enhancedSpeedRamp?' <span style="font-weight:400;color:var(--gold)">— enhanced (Cinema Studio 3+)</span>':''}</label>
      <select class="f-select" id="csSpeedRamp" style="display:none" onchange="renderSimpleTrigger('csSpeedRamp')">${(tier.enhancedSpeedRamp?SPEED_RAMPS_ENHANCED:SPEED_RAMPS).map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      <div id="csSpeedRampTrigger" onclick="openSimplePicker('csSpeedRamp','Speed Ramp')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>` : ''}
    <div class="f-group">
      <label class="f-label">AI Director <span style="font-weight:400;color:var(--texts)">— the 3rd pillar of Cinema Studio 2.5's feature set</span></label>
      <div style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;background:var(--surface)">
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--text)">${gs("active_director","")?escapeHtml((getAllDirectors().find(d=>d.id===gs("active_director",""))||{}).name||"Unknown"):"No director active"}</span>
        <button class="btn btn-outline btn-xs" onclick="switchMod('directors',document.querySelector('[data-mod=directors]'))">Change</button>
      </div>
    </div>
    ${tier.styleSettingsPanel?`
    <div style="margin:14px 0 10px;padding-top:10px;border-top:1px solid var(--glass-brd)">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--gold);margin-bottom:2px">Style Settings <span style="color:var(--textm);font-weight:400;text-transform:none">— Cinema Studio 3.5</span></div>
      <div style="font-size:10px;color:var(--textm);margin-bottom:8px">Each list below is what was legible in the source video — likely not the complete preset set for each tab yet.</div>
    </div>
    <div class="f-group">
      <label class="f-label">Color Palette</label>
      <select class="f-select" id="csColorPalette" style="display:none" onchange="renderSimpleTrigger('csColorPalette')">${CS35_COLOR_PALETTES.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      <div id="csColorPaletteTrigger" onclick="openSimplePicker('csColorPalette','Color Palette')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Lighting</label>
      <select class="f-select" id="csLighting" style="display:none" onchange="renderSimpleTrigger('csLighting')">${CS35_LIGHTING.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      <div id="csLightingTrigger" onclick="openSimplePicker('csLighting','Lighting')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>
    <div class="f-group">
      <label class="f-label">Camera Moveset Style</label>
      <select class="f-select" id="csCameraMovesetStyle" style="display:none" onchange="renderSimpleTrigger('csCameraMovesetStyle')">${CS35_CAMERA_MOVESET_STYLES.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
      <div id="csCameraMovesetStyleTrigger" onclick="openSimplePicker('csCameraMovesetStyle','Camera Moveset Style')" style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--border);border-radius:12px;padding:8px 12px;cursor:pointer;background:var(--surface)"></div>
    </div>`:''}
    <div class="f-row" style="margin-top:${tier.styleSettingsPanel?'10px':'0'}">
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
  renderVisualTrigger("csStyle","style");
  if(isVideo){renderSimpleTrigger("csCameraMove");renderSimpleTrigger("csSpeedRamp");renderSimpleTrigger("csDuration");}
  if(tier.styleSettingsPanel){renderSimpleTrigger("csColorPalette");renderSimpleTrigger("csLighting");renderSimpleTrigger("csCameraMovesetStyle");}
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
        <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">Choose a ${S.csMode==="video"?"Kat Films":"Camera Crafts"} Tier</div>
        <button onclick="closeModelPicker()" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--lav);color:var(--textm);cursor:pointer">${pIcon('back',12)}</button>
      </div>
      <div style="padding:10px 14px 24px">
        ${csTiersForMode(S.csMode).map(t=>{
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
  ensureCsTierValidForMode(mode);
  const titleEl=document.getElementById("csTitle");
  if(titleEl)titleEl.textContent=mode==="video"?"🎬 Kat Films 4K":"📷 Camera Crafts 4K";
  const tierBtn=document.querySelector('[title="Change Tier"]');
  if(tierBtn)tierBtn.textContent=mode==="video"?"🎬":"📷";
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
    const est=estimateImageCost(tier.imageModel,1);
    hint.textContent=est?formatCostLine(est):"";
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

// ── AD-HOC REFERENCE IMAGES — the generic counterpart to @CharacterName.
// Higgsfield's own composer has a "+" next to its "@" for exactly this:
// tag any uploaded image (not just a saved library entry) as @Image1,
// @Image2, etc. ──
async function handleCsRefImageUpload(event){
  const file=event.target.files[0];
  event.target.value="";
  if(!file)return;
  if(!file.type.startsWith("image/")){toast("Images only","error");return;}
  try{
    const dataUrl=await downscaleImageFile(file);
    const tag="Image"+(++S.csRefImageCounter);
    S.csRefImages.push({tag,dataUrl,name:file.name});
    insertCsRefTag(tag);
    renderCsRefImageStrip();
  }catch(err){toast(err.message,"error");}
}
function insertCsRefTag(tag){
  const ta=document.getElementById("csPrompt");
  if(!ta)return;
  const cursor=ta.selectionStart;
  const before=ta.value.slice(0,cursor);
  const after=ta.value.slice(cursor);
  ta.value=`${before}@${tag} ${after}`;
  ta.focus();
}
function renderCsRefImageStrip(){
  const strip=document.getElementById("csRefImageStrip");
  if(!strip)return;
  strip.innerHTML=S.csRefImages.map((r,i)=>`<div style="position:relative;width:44px;height:44px">
    <img src="${r.dataUrl}" style="width:44px;height:44px;border-radius:8px;object-fit:cover">
    <div style="position:absolute;bottom:-2px;left:-2px;right:-2px;text-align:center;background:rgba(0,0,0,0.65);color:#fff;font-size:7px;border-radius:4px;padding:1px">@${r.tag}</div>
    <button onclick="removeCsRefImage(${i})" style="position:absolute;top:-5px;right:-5px;width:15px;height:15px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:8px;cursor:pointer;line-height:1">✕</button>
  </div>`).join('');
}
function removeCsRefImage(i){
  const removed=S.csRefImages[i];
  if(!removed)return;
  S.csRefImages.splice(i,1);
  const ta=document.getElementById("csPrompt");
  if(ta)ta.value=ta.value.replace(new RegExp(`@${removed.tag}\\b\\s?`,"gi"),"");
  renderCsRefImageStrip();
}


// Resolves every @Tag mention in the prompt against TWO real sources:
// (1) this app's Character library (@CharacterName — substituted with a
// plain, model-readable name + lock description, since fal models don't
// understand "@Name" syntax; that's this app's own UI convention) and
// (2) ad-hoc attached reference images (@Image1 etc. — the tag itself is
// stripped from the visible prompt since there's no name to substitute;
// the image does the work via image_urls instead). Both real image
// uploads happen here, hosted for the actual API call. Unmatched @Words
// are left as-is — most likely just part of the sentence.
async function resolveCsCharacterMentions(text,apiKey,refImages){
  const mentioned=[...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m=>m[1]);
  let cleanPrompt=text;
  const imageUrls=[];
  for(const tag of mentioned){
    const c=(S.characters||[]).find(ch=>ch.name.toLowerCase()===tag.toLowerCase());
    if(c){
      const re=new RegExp(`@${tag}\\b`,"gi");
      cleanPrompt=cleanPrompt.replace(re,c.lock?`${c.name} (${c.lock})`:c.name);
      if(c.refImg){
        try{
          const hosted=await uploadRefsToFal([{dataUrl:c.refImg,name:c.name}],apiKey);
          if(hosted&&hosted[0])imageUrls.push(hosted[0]);
        }catch(err){console.warn("Couldn't upload reference for",c.name,err.message);}
      }
      continue;
    }
    const ref=(refImages||S.csRefImages).find(r=>r.tag.toLowerCase()===tag.toLowerCase());
    if(ref){
      const re=new RegExp(`@${tag}\\b\\s?`,"gi");
      cleanPrompt=cleanPrompt.replace(re,"").trim();
      try{
        const hosted=await uploadRefsToFal([{dataUrl:ref.dataUrl,name:ref.name}],apiKey);
        if(hosted&&hosted[0])imageUrls.push(hosted[0]);
      }catch(err){console.warn("Couldn't upload reference image",ref.name,err.message);}
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
  const refImagesSnapshot=S.csRefImages.slice();
  S.csRefImages=[];
  renderCsRefImageStrip();
  const loadingId="csLoading_"+Date.now();
  pushCsChatMessage({id:loadingId,type:"loading",content:isVideo?"Rolling camera…":"Composing shot…"});

  try{
    const {cleanPrompt,imageUrls}=await resolveCsCharacterMentions(rawPrompt,apiKey,refImagesSnapshot);
    const style=document.getElementById("csStyle")?.value||"";
    const directorPrompt=getActiveDirectorPrompt();
    const colorPalette=tier.styleSettingsPanel?(document.getElementById("csColorPalette")?.value||""):"";
    const lighting=tier.styleSettingsPanel?(document.getElementById("csLighting")?.value||""):"";
    const cameraMovesetStyle=tier.styleSettingsPanel?(document.getElementById("csCameraMovesetStyle")?.value||""):"";
    const parts=[genre.frag,cleanPrompt,cameraMove,speedRamp,style,colorPalette,lighting,cameraMovesetStyle,directorPrompt].filter(Boolean);
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

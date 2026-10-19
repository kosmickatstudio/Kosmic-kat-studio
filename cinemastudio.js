// ══════════════════════════════════════════════════════════════════════
// KAT FILMS 4K / CAMERA CRAFTS 4K — the film-making workspace.
//
// One module, two faces: Higgsfield's Cinema Studio 4K (video) and
// Cinematic Camera (image) are the same tool internally toggling between an
// Image and a Video mode. Here S.csMode ("image"|"video") decides which
// pipeline runs and which name shows: "Kat Films 4K" (video) or "Camera
// Crafts 4K" (image). Two sidebar entries set the starting mode; the
// in-studio switch flips it without leaving. Not related to Kosmic Engine.
//
// ARCHITECTURE (rebuilt — this file used to read its inputs from ~25 hidden
// <select>s and build prompts inline inside one 170-line send function):
//
//   cinema-registry.js   PURE DATA — tiers + capabilities, camera bodies,
//                        lenses, focal lengths, apertures, rig looks, camera
//                        moves, speed ramps, genres, durations. The UI
//                        renders from it; new gear is a data edit.
//   1  STATE             S.csForm is the single source of truth for every
//                        control (persisted as cs_form). The DOM never holds
//                        state — it is rendered FROM S.csForm.
//   2  PROMPT COMPILER   csCompile() — one function turns form + prompt +
//                        tier + scene into the final prompt, and returns its
//                        labelled parts (shown to the user as "Compiled
//                        prompt" so nothing is hidden).
//   3  PLAN + RUNNER     csBuildPlan() turns one Generate press into 1..N
//                        jobs (single shot / multishot scenes / location
//                        batch); csRunJob() executes a job; failures are
//                        isolated per job and can be retried.
//   4  UI                Same Kosmic glass kit as Video Studio / Image Gen
//                        (chat-glass.js): header, thread, composer with a
//                        summary chip, and a "shutter" settings sheet built
//                        from cards, rails and chips (.ks-* classes).
//
// HONEST NOTES (unchanged): "Cinema Studio 3.5" etc. are Higgsfield's own
// in-house models, not reachable via fal.ai — every tier maps to a REAL fal
// model (CS_TIERS[].model); no invented endpoints. Camera body / lens /
// focal length / aperture / camera move / speed ramp are NOT API parameters
// on Seedance or FLUX — they are cinematography phrases the compiler folds
// into the prompt. Character @mentions in image mode use genViaFluxEdit
// (real multi-reference composition) so a mentioned character's photo is
// genuinely used. Custom Multishot has no native Seedance parameter: each
// scene is its own real generation, landing in order in the Video Editor.
//
// LOAD ORDER: cinema-registry.js, then this file, after index.html's main
// inline script — needs S, gs, saveSetting, toast, pIcon, STYLE_PRESETS,
// stylePreviewHTML, getAllDirectors, getActiveDirectorPrompt (directors.js),
// sheetSwipeStart/Move/End, genViaSeedanceReference, genViaFal,
// genViaFluxEdit, uploadRefsToFal, downscaleImageFile, createVideoAsset,
// createImageAsset, addToSequence, logCost, estimateVideoCost,
// estimateImageCost, formatCostLine, showPromptDialog, downloadWithName,
// sanitizeFilenamePart, openCollectionPicker, switchMod. KosmicChatGlass
// (chat-glass.js) loads after this file but is only used at render time.
// ══════════════════════════════════════════════════════════════════════

/* ───────────────────────── 1 · STATE ───────────────────────── */

S.csProjects=S.csProjects||gs("cs_projects",[])||[];
S.csActiveProjectId=S.csActiveProjectId||gs("cs_active_project",null);
S.csFavorites=S.csFavorites||gs("cs_favorites",[])||[];
S.csView=S.csView||"home";
S.csMode=S.csMode||"video";
S.csTier=S.csTier||gs("cs_tier","katfilms1")||"katfilms1";
// A generation that was mid-flight when the page closed can never finish —
// drop stale loading bubbles instead of showing them forever.
S.csChatHistory=(S.csChatHistory||gs("cs_chat_history",[])||[]).filter(m=>m&&m.type!=="loading");
S.csMentionOpen=false;
S.csBusy=false;
S.csDraft=S.csDraft||"";
// Ephemeral per-message attachments (data URLs get large fast): ad-hoc
// reference images tagged @Image1.. and the Soul HEX colour reference.
// csRefImageCounter is monotonic so a removed tag's number is never reused.
S.csRefImages=S.csRefImages||[];
S.csRefImageCounter=S.csRefImageCounter||0;
S.csSoulHexRef=S.csSoulHexRef||null;
// Custom Multishot scenes: [{id,duration,speedRamp,cameraMove}] — "" for
// speedRamp/cameraMove means "inherit the studio setting".
S.csScenes=S.csScenes||[];
S.csSceneCounter=S.csSceneCounter||0;

const CS_FORM_DEFAULTS={
  genre:"General",style:"",ratio:"16:9",
  cameraMove:"auto",speedRamp:"auto",duration:6,customDuration:false,
  look:"",body:"Auto",lens:"Auto",focal:"Auto",aperture:"Auto",
  palette:"auto",lighting:"auto",moveset:"auto",
  locations:3,shot:"smart",
};
function csLoadForm(){
  const saved=gs("cs_form",{});
  const f=Object.assign({},CS_FORM_DEFAULTS,(saved&&typeof saved==="object")?saved:{});
  f.shot="smart"; // multishot scenes are ephemeral, so the toggle is too
  return f;
}
S.csForm=S.csForm||csLoadForm();
// Failed jobs kept for Retry (runtime only — cleared on reload).
const CS_JOBS={};

/* ───────────────────── ACCESSORS ───────────────────── */

const csEsc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const csEl=id=>document.getElementById(id);
const csIsVideo=()=>S.csMode==="video";
const csBrand=()=>csIsVideo()?"Kat Films 4K":"Camera Crafts 4K";
function csTiersForMode(mode){return CS_TIERS.filter(t=>t.mode===mode);}
// Falls back to the tier last used in this mode, then the first tier that
// can actually generate (never an empty reserved slot).
function csTier(){
  const mode=S.csMode;
  return CS_TIERS.find(t=>t.id===S.csTier&&t.mode===mode)
    ||CS_TIERS.find(t=>t.id===gs("cs_tier_"+mode,"")&&t.mode===mode)
    ||csTiersForMode(mode).find(t=>!t.empty)||CS_TIERS[1];
}
function csCaps(){return new Set(csTier().caps||[]);}
const csHas=cap=>csCaps().has(cap);
const csOpt=(list,id)=>list.find(o=>o.id===id);
const csRampList=tier=>(tier.caps||[]).includes("speedRampPro")?CS_SPEED_RAMPS_PRO:CS_SPEED_RAMPS;

// Keeps the form valid for the CURRENT tier/mode. Called after any change
// that can invalidate a value (tier switch, mode switch, load).
function csNormalize(){
  const f=S.csForm,tier=csTier(),caps=new Set(tier.caps||[]);
  if(S.csTier!==tier.id){S.csTier=tier.id;saveSetting("cs_tier",tier.id);}
  if(gs("cs_tier_"+S.csMode,"")!==tier.id)saveSetting("cs_tier_"+S.csMode,tier.id);
  if(!csOpt(csRampList(tier),f.speedRamp))f.speedRamp="auto";
  if(!csOpt(CS_CAMERA_MOVES,f.cameraMove))f.cameraMove="auto";
  if(!CS_RATIOS.includes(f.ratio))f.ratio="16:9";
  if(!CINEMA_GENRES.some(g=>g.label===f.genre))f.genre="General";
  f.duration=Math.max(3,Math.min(15,Math.round(+f.duration)||6));
  f.locations=Math.max(1,Math.min(10,Math.round(+f.locations)||3));
  for(const k of ["palette","lighting","moveset"])if(!csOpt(CS_STYLE_SETTINGS[k].options,f[k]))f[k]="auto";
  if(!caps.has("multishot")||S.csMode!=="video")f.shot="smart";
  f.look=csMatchLook();
}
function csMatchLook(){
  const f=S.csForm;
  const hit=CS_RIG_LOOKS.find(l=>l.body===f.body&&l.lens===f.lens&&l.focal===f.focal&&l.aperture===f.aperture);
  return hit?hit.id:"";
}
function csSaveForm(){
  const f=Object.assign({},S.csForm);delete f.shot;
  saveSetting("cs_form",f);
}

// The single entry point for every control. Rendering never mutates state.
function csSet(k,v){
  const f=S.csForm;
  if(k==="duration"){f.duration=+v;f.customDuration=false;}
  else if(k==="durationCustom"){f.customDuration=true;f.duration=+v;}
  else if(k==="locations")f.locations=+v;
  else if(k==="look"){
    const l=CS_RIG_LOOKS.find(x=>x.id===v);
    if(l){f.body=l.body;f.lens=l.lens;f.focal=l.focal;f.aperture=l.aperture;}
    else{f.body=f.lens=f.focal=f.aperture="Auto";} // "" = clear rig
  }
  else if(k==="shot"){
    f.shot=v==="custom"?"custom":"smart";
    if(f.shot==="custom"&&!S.csScenes.length){csAddScene(true);csAddScene(true);}
  }
  else f[k]=v;
  csNormalize();csSaveForm();csRefreshAll();
}

/* ─────────────────── 2 · PROMPT COMPILER ─────────────────── */

// One place that decides what the model is told. Returns the final string
// and its labelled parts. Order is deliberate and matches the original
// module: genre → your prompt → camera move → style → style settings →
// speed ramp → location → camera rig → Soul HEX → director → variation.
// `scene` (multishot) overrides camera move / speed ramp when it sets them.
function csCompile(o){
  const f=S.csForm,tier=o.tier||csTier(),caps=new Set(tier.caps||[]),video=(o.mode||S.csMode)==="video",parts=[];
  const add=(key,label,text)=>{if(text)parts.push({key,label,text});};
  const genre=CINEMA_GENRES.find(g=>g.label===f.genre)||CINEMA_GENRES[0];
  if(caps.has("genre"))add("genre","Genre",genre.frag);
  add("prompt","Your prompt",o.prompt);
  if(video&&caps.has("cameraMove")){
    const mv=csOpt(CS_CAMERA_MOVES,(o.scene&&o.scene.cameraMove)||f.cameraMove);
    add("move","Camera move",mv&&mv.value);
  }
  if(caps.has("style"))add("style","Style",f.style);
  if(caps.has("styleSettings")){
    for(const k of ["palette","lighting","moveset"]){
      const opt=csOpt(CS_STYLE_SETTINGS[k].options,f[k]);
      add(k,CS_STYLE_SETTINGS[k].label,opt&&opt.value);
    }
  }
  if(video&&caps.has("speedRamp")){
    const r=csOpt(csRampList(tier),(o.scene&&o.scene.speedRamp)||f.speedRamp);
    add("ramp","Speed ramp",r&&r.value);
  }
  if(caps.has("locations"))add("location","Location",CS_LOCATION_FRAG);
  if(caps.has("rig")){
    const rig=[[CS_CAMERA_BODIES,f.body],[CS_LENSES,f.lens],[CS_FOCAL_LENGTHS,f.focal],[CS_APERTURES,f.aperture]]
      .map(([list,id])=>(csOpt(list,id)||{}).frag).filter(Boolean);
    add("rig","Camera rig",rig.join(", "));
  }
  if(o.soulHex)add("soulhex","Soul HEX",CS_SOULHEX_FRAG);
  add("director","Director",o.director);
  add("variation","Variation",o.variation);
  return {text:parts.map(p=>p.text).join(", "),parts};
}

/* ─────────────────── 3 · PLAN + RUNNER ─────────────────── */

// One Generate press → 1..N jobs. Pure: no network, no DOM.
function csBuildPlan(o){
  const f=S.csForm,tier=csTier(),caps=new Set(tier.caps||[]),video=csIsVideo(),jobs=[];
  const provider=csBrand();
  const base={model:tier.model,ratio:f.ratio,provider,raw:o.raw};
  const uid=()=>"csjob_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const ctx={tier,mode:S.csMode,prompt:o.prompt,director:o.director,soulHex:o.soulHex};
  if(video){
    const multi=f.shot==="custom"&&S.csScenes.length>0&&caps.has("multishot");
    if(multi){
      S.csScenes.forEach((sc,i)=>jobs.push(Object.assign({},base,{
        id:uid(),kind:"video",sequence:true,
        label:`Scene ${i+1}/${S.csScenes.length}…`,
        duration:snapToKatFilmsDuration(sc.duration),
        prompt:csCompile(Object.assign({scene:sc},ctx)).text,
        costNote:`${tier.label} — Scene ${i+1}`,
        displayProvider:`${provider} — Scene ${i+1}`,
      })));
    }else{
      jobs.push(Object.assign({},base,{
        id:uid(),kind:"video",label:"Rolling camera…",
        duration:snapToKatFilmsDuration(f.duration),
        prompt:csCompile(ctx).text,costNote:tier.label,displayProvider:provider,
      }));
    }
  }else if(caps.has("locations")){
    const n=f.locations;
    for(let i=0;i<n;i++)jobs.push(Object.assign({},base,{
      id:uid(),kind:"image",label:`Composing location ${i+1}/${n}…`,
      prompt:csCompile(Object.assign({variation:`variation ${i+1} of ${n}, different angle or time of day than the other variations`},ctx)).text,
      costNote:`${provider} (location ${i+1}/${n})`,displayProvider:provider,
    }));
  }else{
    jobs.push(Object.assign({},base,{
      id:uid(),kind:"image",label:"Composing shot…",
      prompt:csCompile(ctx).text,costNote:`${provider} (${tier.label})`,displayProvider:provider,
    }));
  }
  return jobs;
}

// Executes ONE job and returns the chat message to show. Throws on failure.
async function csRunJob(job,imageUrls){
  const projectId=S.csActiveProjectId||"";
  if(job.kind==="video"){
    const url=await genViaSeedanceReference(job.prompt,job.model,job.ratio,job.duration,imageUrls,[],[]);
    const asset=createVideoAsset(url,job.prompt,projectId,{model:job.model,providerLabel:job.provider},true);
    if(projectId)addCsGenerationToProject(projectId,asset.id);
    if(job.sequence&&typeof addToSequence==="function")addToSequence(asset.id);
    logCost(job.model,job.costNote);
    return {type:"video",content:url,meta:{prompt:job.prompt,raw:job.raw,providerLabel:job.displayProvider,assetId:asset.id}};
  }
  // Mentioned characters / Soul HEX → real multi-reference composition;
  // otherwise plain text-to-image on the tier's model.
  const useEdit=imageUrls.length>0;
  const model=useEdit?CS_IMAGE_EDIT_MODEL:job.model;
  const result=useEdit
    ?await genViaFluxEdit(job.prompt,imageUrls,job.ratio,CS_IMAGE_EDIT_MODEL)
    :await genViaFal(job.prompt,"",job.model,job.ratio,false);
  const asset=await createImageAsset(result.url,job.prompt,projectId,{model,providerLabel:job.provider});
  if(projectId)addCsGenerationToProject(projectId,asset.id);
  logCost(model,job.costNote);
  return {type:"image",content:result.url,meta:{prompt:job.prompt,raw:job.raw,providerLabel:job.displayProvider,assetId:asset.id}};
}

// Runs a job inside a loading bubble; success or failure both land in the
// thread. A failed job keeps its inputs so Retry can re-run exactly it.
async function csExecuteJob(job,imageUrls,bubbleId){
  csReplaceBubble(bubbleId,{id:bubbleId,type:"loading",content:job.label});
  try{
    const msg=await csRunJob(job,imageUrls);
    delete CS_JOBS[job.id];
    csReplaceBubble(bubbleId,msg);
    return true;
  }catch(err){
    CS_JOBS[job.id]={job,imageUrls};
    csReplaceBubble(bubbleId,{type:"error",content:err&&err.message||"Generation failed",jobId:job.id});
    return false;
  }
}
async function csRetryJob(jobId){
  const entry=CS_JOBS[jobId];
  if(!entry||S.csBusy)return;
  const idx=S.csChatHistory.findIndex(m=>m.jobId===jobId);
  if(idx<0)return;
  S.csBusy=true;csSetBusy(true);
  const bubbleId="csLoading_"+Date.now();
  S.csChatHistory[idx]={id:bubbleId,type:"loading",content:entry.job.label};
  csRenderThread();
  const ok=await csExecuteJob(entry.job,entry.imageUrls,bubbleId);
  toast(ok?"✨ Generated":"❌ Still failing — check the message above",ok?"success":"error");
  S.csBusy=false;csSetBusy(false);
}

async function sendCinemaStudioGen(){
  if(S.csBusy)return;
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const tier=csTier();
  if(tier.empty){toast(`${tier.label} is empty — choose a different tier`,"error");return;}
  const ta=csEl("csPrompt");
  const rawPrompt=ta&&ta.value.trim();
  if(!rawPrompt){toast("Describe your scene first","error");return;}
  const f=S.csForm;
  if(f.shot==="custom"&&!S.csScenes.length){toast("Add at least one scene, or switch Shot Control to Smart","error");return;}

  S.csBusy=true;csSetBusy(true);
  const chips=csPromptChips();
  csPushMessage({role:"user",content:rawPrompt,chips});
  ta.value="";ta.style.height="auto";S.csDraft="";
  const refs=S.csRefImages.slice();
  S.csRefImages=[];csRenderRefStrip();
  const prepId="csLoading_"+Date.now();
  csPushMessage({id:prepId,type:"loading",content:"Preparing references…"});
  let jobs=[],imageUrls=[];
  try{
    const resolved=await csResolveMentions(rawPrompt,apiKey,refs);
    imageUrls=resolved.imageUrls;
    let soulHex=false;
    if(csHas("soulHex")&&S.csSoulHexRef){
      try{
        const hosted=await uploadRefsToFal([{dataUrl:S.csSoulHexRef,name:"soulhex-ref"}],apiKey);
        if(hosted&&hosted[0]){imageUrls.push(hosted[0]);soulHex=true;}
      }catch(err){console.warn("Soul HEX reference upload failed",err.message);}
    }
    jobs=csBuildPlan({prompt:resolved.cleanPrompt,raw:rawPrompt,director:getActiveDirectorPrompt(),soulHex});
  }catch(err){
    csReplaceBubble(prepId,{type:"error",content:err.message});
    toast("❌ "+err.message,"error");
    S.csBusy=false;csSetBusy(false);
    return;
  }
  csRemoveBubble(prepId);
  if(jobs.length>1)toast(`🎬 Running ${jobs.length} ${csIsVideo()?"scenes":"variations"}…`,"success");
  let failed=0;
  for(const job of jobs){
    const bubbleId="csLoading_"+job.id;
    csPushMessage({id:bubbleId,type:"loading",content:job.label});
    const ok=await csExecuteJob(job,imageUrls,bubbleId);
    if(!ok)failed++;
  }
  if(jobs.length>1)toast(failed?"⚠️ Finished with some errors — retry the failed ones above":(csIsVideo()?"✨ Multishot complete — all scenes added to Video Editor in order":`✅ ${jobs.length} variations done`),failed?"error":"success");
  else toast(failed?"❌ Generation failed":"✨ Generated",failed?"error":"success");
  if(csIsVideo()&&f.shot==="custom"){S.csScenes=[];f.shot="smart";}
  S.csBusy=false;csSetBusy(false);
  csRefreshAll();
}

// Short chips shown under the user's message so a thread reads like a
// shot log: what camera/look this prompt was sent with.
function csPromptChips(){
  const f=S.csForm,caps=csCaps(),out=[];
  if(caps.has("genre")&&f.genre!=="General")out.push(f.genre);
  if(csIsVideo()){
    if(f.shot==="custom")out.push(`${S.csScenes.length} scenes`);
    else out.push(snapToKatFilmsDuration(f.duration)+"s");
    const mv=csOpt(CS_CAMERA_MOVES,f.cameraMove);
    if(caps.has("cameraMove")&&mv&&mv.value)out.push(mv.label);
  }
  if(caps.has("rig")){
    const l=CS_RIG_LOOKS.find(x=>x.id===f.look);
    if(l)out.push(l.label);
    else{for(const id of [f.body,f.lens,f.focal,f.aperture])if(id&&id!=="Auto")out.push(id);}
  }
  out.push(f.ratio);
  return out.slice(0,6);
}

function csEstimate(){
  const tier=csTier(),f=S.csForm;
  if(tier.empty||!tier.model)return null;
  if(csIsVideo()){
    if(f.shot==="custom"&&S.csScenes.length){
      let cost=0,approx=false;
      for(const sc of S.csScenes){
        const e=estimateVideoCost(tier.model,snapToKatFilmsDuration(sc.duration),"720p",false);
        if(!e)return null;cost+=e.cost;approx=approx||e.approx;
      }
      return {cost,approx,note:`${S.csScenes.length} scenes`};
    }
    return estimateVideoCost(tier.model,snapToKatFilmsDuration(f.duration),"720p",false);
  }
  return estimateImageCost(tier.model,csHas("locations")?f.locations:1);
}

/* ─────────────────── REFERENCES & @MENTIONS ─────────────────── */

// Resolves every @Tag in the prompt against two real sources: (1) the app's
// Character library (@Name → plain name + lock description, since fal
// models don't understand "@Name"; the character's reference photo is
// uploaded and passed as an image input) and (2) ad-hoc attached images
// (@Image1.. — tag stripped, the image does the work). Unmatched @Words are
// left as-is — most likely just part of the sentence.
async function csResolveMentions(text,apiKey,refImages){
  const mentioned=[...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map(m=>m[1]);
  let cleanPrompt=text;
  const imageUrls=[];
  for(const tag of mentioned){
    const c=(S.characters||[]).find(ch=>ch.name.toLowerCase()===tag.toLowerCase());
    if(c){
      cleanPrompt=cleanPrompt.replace(new RegExp(`@${tag}\\b`,"gi"),c.lock?`${c.name} (${c.lock})`:c.name);
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
      cleanPrompt=cleanPrompt.replace(new RegExp(`@${tag}\\b\\s?`,"gi"),"").trim();
      try{
        const hosted=await uploadRefsToFal([{dataUrl:ref.dataUrl,name:ref.name}],apiKey);
        if(hosted&&hosted[0])imageUrls.push(hosted[0]);
      }catch(err){console.warn("Couldn't upload reference image",ref.name,err.message);}
    }
  }
  return {cleanPrompt,imageUrls};
}

async function handleCsRefImageUpload(event){
  const file=event.target.files&&event.target.files[0];
  event.target.value="";
  if(!file)return;
  if(!file.type.startsWith("image/")){toast("Images only","error");return;}
  try{
    const dataUrl=await downscaleImageFile(file);
    const tag="Image"+(++S.csRefImageCounter);
    S.csRefImages.push({tag,dataUrl,name:file.name});
    csInsertAtCursor(`@${tag} `);
    csRenderRefStrip();
  }catch(err){toast(err.message,"error");}
}
function removeCsRefImage(i){
  const removed=S.csRefImages[i];
  if(!removed)return;
  S.csRefImages.splice(i,1);
  const ta=csEl("csPrompt");
  if(ta)ta.value=ta.value.replace(new RegExp(`@${removed.tag}\\b\\s?`,"gi"),"");
  csRenderRefStrip();
}
async function handleCsSoulHexUpload(event){
  const file=event.target.files&&event.target.files[0];
  event.target.value="";
  if(!file)return;
  try{S.csSoulHexRef=await downscaleImageFile(file,1024,0.9);csRenderSheet();}
  catch(err){toast("Couldn't read that reference image: "+err.message,"error");}
}
function csInsertAtCursor(text){
  const ta=csEl("csPrompt");
  if(!ta)return;
  const c=ta.selectionStart??ta.value.length;
  ta.value=ta.value.slice(0,c)+text+ta.value.slice(c);
  ta.focus();
  ta.selectionStart=ta.selectionEnd=c+text.length;
}
function csOnPromptInput(ta){
  S.csDraft=ta.value;
  ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";
  const dd=csEl("csMention");
  if(!dd)return;
  const m=ta.value.slice(0,ta.selectionStart).match(/@([a-zA-Z0-9_]*)$/);
  if(!m){dd.style.display="none";return;}
  const q=m[1].toLowerCase();
  const found=(S.characters||[]).filter(c=>c.name.toLowerCase().includes(q)).slice(0,6);
  if(!found.length){dd.style.display="none";return;}
  dd.style.display="block";
  dd.innerHTML=found.map(c=>`<button type="button" data-cs="mention" data-v="${csEsc(c.name)}">🎭 ${csEsc(c.name)}</button>`).join("");
}
function csPickMention(name){
  const ta=csEl("csPrompt");
  if(!ta)return;
  const c=ta.selectionStart;
  const before=ta.value.slice(0,c).replace(/@([a-zA-Z0-9_]*)$/,"");
  ta.value=`${before}@${name} ${ta.value.slice(c)}`;
  const dd=csEl("csMention");if(dd)dd.style.display="none";
  ta.focus();S.csDraft=ta.value;
}
function openCsMentionPicker(){
  const ta=csEl("csPrompt");
  if(!ta||ta.disabled)return;
  if(!(S.characters||[]).length){toast("No characters yet — build one in the Character Library first","error");return;}
  csInsertAtCursor("@");
  csOnPromptInput(ta);
}
function handleCsChatKeydown(e){
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendCinemaStudioGen();}
}

/* ─────────────────── MULTISHOT SCENES ─────────────────── */

function csAddScene(silent){
  S.csScenes.push({id:++S.csSceneCounter,duration:4,speedRamp:"",cameraMove:""});
  if(!silent)csRefreshAll();
}
function csRemoveScene(id){
  S.csScenes=S.csScenes.filter(s=>s.id!==id);
  if(!S.csScenes.length)S.csForm.shot="smart";
  csRefreshAll();
}
function csUpdateScene(id,field,val){
  const s=S.csScenes.find(x=>x.id===id);
  if(!s)return;
  if(field==="duration")s.duration=Math.max(3,Math.min(15,parseInt(val,10)||4));
  else s[field]=val;
  csRenderCost();csRenderSummary();
  if(csEl("csSheetBody")&&csEl("csSettingsPanel").classList.contains("open"))csRenderSheet();
}

/* ───────────────────────── 4 · UI ───────────────────────── */

function csInjectCss(){
  if(csEl("cs-css"))return;
  const s=document.createElement("style");s.id="cs-css";
  s.textContent=`
.cs-modebar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:0 10px 6px;flex:0 0 auto;z-index:2}
.cs-modebar .ks-seg{margin:0;flex:0 0 auto}
.cs-modebar .ks-seg button{padding:7px 12px;font-size:11.5px}
.cs-scenes{display:none;gap:8px;overflow-x:auto;margin:0 10px 6px;padding:2px 2px 6px;flex:0 0 auto;scrollbar-width:none;z-index:2}
.cs-scenes::-webkit-scrollbar{display:none}
.cs-scene{flex:0 0 156px;border-radius:14px;padding:9px;display:flex;flex-direction:column;gap:6px}
.cs-scene-h{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:var(--violet,#3d1f7a)}
.cs-scene .ks-sel{padding:6px 8px;font-size:11px;border-radius:9px}
.cs-x{width:20px;height:20px;border-radius:50%;border:0;background:#3d1f7a;color:#fff;font-size:9px;cursor:pointer;flex:0 0 auto;padding:0}
.cs-addscene{flex:0 0 52px;border:1.5px dashed var(--glass-brd,rgba(61,31,122,.3));background:transparent;color:var(--violet,#3d1f7a);border-radius:14px;font-size:22px;cursor:pointer}
.cs-refs{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cs-ref{position:relative;width:44px;height:44px}
.cs-ref img{width:44px;height:44px;border-radius:9px;object-fit:cover}
.cs-ref i{position:absolute;bottom:-3px;left:-3px;right:-3px;text-align:center;background:rgba(0,0,0,.66);color:#fff;font-size:7.5px;border-radius:4px;padding:1px;font-style:normal}
.cs-ref .cs-x{position:absolute;top:-6px;right:-6px;width:17px;height:17px;font-size:8px}
.cs-mention{display:none;position:absolute;left:14px;right:14px;bottom:168px;z-index:7;border-radius:14px;padding:4px;max-height:176px;overflow-y:auto}
.cs-mention button{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--text,#1e1230);padding:9px 11px;border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit}
.cs-mention button:active{background:rgba(98,64,176,.14)}
.cs-mini{font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:rgba(255,255,255,.2);color:inherit}
.cs-chiprow{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;justify-content:flex-end}
.cs-bub{align-self:flex-end;max-width:84%;display:flex;flex-direction:column;align-items:flex-end}
.cs-media{width:100%;max-width:360px;border-radius:14px;display:block;background:#0f0c16}
.cs-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.cs-act{border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:rgba(98,64,176,.10);color:var(--textm,#5a4880);border-radius:11px;padding:7px 11px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
.cs-meta{font-size:10.5px;color:var(--texts,#9488ae);margin-top:6px}
.cs-view{flex:1;min-height:0;overflow-y:auto;padding:12px 12px 24px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.cs-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:12px}
.cs-card{border-radius:16px;padding:10px;margin-bottom:12px}
.cs-card .cs-media{max-width:none}
.cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cs-gcard{border-radius:14px;padding:6px;display:flex;flex-direction:column;gap:6px}
.cs-gcard img,.cs-gcard video{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:#0f0c16}
.cs-gcard .cs-ph{width:100%;aspect-ratio:1;border-radius:10px;background:rgba(98,64,176,.12);display:grid;place-items:center;font-size:22px}
.cs-gcard small{font-size:10.5px;color:var(--textm,#5a4880);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-note{font-size:12px;color:var(--textm,#5a4880);line-height:1.5;padding:18px 6px;text-align:center}
.cs-empty{margin:auto;text-align:center;padding:26px 18px;max-width:420px}
.cs-badge{font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:99px;padding:2px 7px;background:rgba(230,126,34,.16);color:#b8651b}
.cs-badge.empty{background:rgba(98,64,176,.14);color:var(--textm,#5a4880)}
.cs-warn{background:rgba(230,126,34,.12);border:1px solid rgba(230,126,34,.3);border-radius:14px;padding:10px 12px;font-size:11px;color:var(--textm,#5a4880);margin-bottom:10px;line-height:1.45}
.cs-group{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--texts,#9488ae);margin:8px 2px 5px}
.cs-director{display:flex;align-items:center;gap:10px}
.cs-director span{flex:1;font-size:13px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-pp{font-size:11px;line-height:1.5;color:var(--textm,#5a4880);margin-top:8px}
.cs-pp div{margin-bottom:5px;overflow-wrap:anywhere}
.cs-pp small{display:inline-block;min-width:78px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;font-size:9px;color:var(--texts,#9488ae)}
.cs-sum{cursor:pointer;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--textm,#5a4880);list-style:none}
.cs-sum::-webkit-details-marker{display:none}
.cs-foot{font-size:10px;color:var(--texts,#9488ae);margin:2px 2px 10px;overflow-wrap:anywhere}
`;
  document.head.appendChild(s);
}

// ── SHELL ──
function renderCinemaStudio(el){
  csInjectCss();
  if(typeof KosmicChatGlass!=="undefined")KosmicChatGlass.injectCss();
  const tabsEl=csEl("moduleTabs");
  if(tabsEl){tabsEl.style.display="none";tabsEl.innerHTML="";}
  csNormalize();
  const IC=KosmicChatGlass.IC;
  const home=S.csView==="home";
  el.innerHTML=`
    <div class="kc" id="csKc">
      <div class="kc-head kc-glass">
        <button type="button" class="kc-ibtn" data-cs="nav" aria-label="Menu" title="Menu">${IC.menu}</button>
        <div class="kc-htitle"><div class="kc-title" id="csTitle"></div><div class="kc-subt" id="csSubt"></div></div>
        ${home?`<button type="button" class="kc-ibtn" data-cs="settings" aria-label="Cinema settings" title="Cinema settings">${IC.sliders}</button>
        <button type="button" class="kc-ibtn" data-cs="clearchat" aria-label="Clear chat" title="Clear chat">${IC.trash}</button>`:''}
      </div>
      ${home?`
      <div class="ig-chat-thread kc-thread" id="csChatThread"></div>
      <div class="cs-mention kc-glass" id="csMention"></div>
      <div class="cs-modebar" id="csModebar"></div>
      <div class="cs-scenes" id="csScenes"></div>
      <div id="csAttachBar" class="kc-attach kc-glass" style="display:none"></div>
      ${KosmicChatGlass.composer({inputId:"csPrompt",placeholder:"Describe your scene — use @ to add a character or reference image",keydown:"handleCsChatKeydown(event)",settings:"toggleCsSettings()",summaryId:"csSummary",sendId:"csGenBtn",send:"sendCinemaStudioGen()",
        tools:[
          {onclick:"csEl('csRefFile').click()",title:"Attach a reference image",icon:IC.plus},
          {onclick:"openCsMentionPicker()",title:"Add a character",icon:'<b style="font-size:16px;line-height:1">@</b>'},
        ],
        hint:'<div class="kc-hint"><span id="csCostHint" style="font-weight:700;color:var(--gold)"></span><span>Ctrl+Enter to generate</span></div>'})}
      <input type="file" accept="image/*" id="csRefFile" style="display:none">`
      :`<div class="cs-view" id="csViewBody"></div>`}
    </div>
    ${home?`
    <div class="ig-settings-backdrop" id="csSettingsBackdrop" data-cs="settings"></div>
    <div class="ig-settings-sheet kc-sheet" id="csSettingsPanel">
      <div class="ig-sheet-handle" ontouchstart="sheetSwipeStart(event)" ontouchmove="sheetSwipeMove(event,'csSettingsPanel')" ontouchend="sheetSwipeEnd(event,'csSettingsPanel','toggleCsSettings')"></div>
      <div class="ig-sheet-header"><div>Cinema settings</div><button type="button" class="ks-btn sm" data-cs="settings">Done</button></div>
      <div class="ks-body" id="csSheetBody"></div>
      <input type="file" accept="image/*" id="csSoulHexFile" style="display:none">
    </div>`:''}`;
  el.onclick=csClick;el.onchange=csChange;el.oninput=csInput;
  syncCsSidebarActive();
  csRenderHeader();
  if(home){
    const ta=csEl("csPrompt");
    if(ta){
      ta.value=S.csDraft||"";
      if(!gs("api_falai")){ta.disabled=true;ta.placeholder="Add a fal.ai API key in Settings first…";}
      if(ta.value){ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";}
    }
    const go=csEl("csGenBtn");if(go&&!gs("api_falai"))go.disabled=true;
    csRenderModebar();csRenderScenes();csRenderRefStrip();csRenderThread();csRenderSummary();csRenderCost();csRenderSheet();
  }else csRenderView();
}

// Entry point from the sidebar — each of the two buttons passes its mode so
// "Camera Crafts 4K" opens in Image mode and "Kat Films 4K" in Video mode.
function openCinemaStudio(mode,el){
  S.csMode=mode;
  S.csView="home";
  csNormalize();
  switchMod("cinemastudio",el);
}
// Keeps whichever sidebar button matches the CURRENT mode highlighted, even
// when the mode was changed via the in-studio toggle.
function syncCsSidebarActive(){
  document.querySelectorAll('[data-mod="cinemastudio"]').forEach(b=>{
    b.classList.toggle("active",b.dataset.csmode===S.csMode);
  });
}
function csCaptureDraft(){const ta=csEl("csPrompt");if(ta)S.csDraft=ta.value;}
function csRerender(){csCaptureDraft();renderCinemaStudio(csEl("moduleContent"));}

function setCsMode(mode){
  if(S.csMode===mode)return;
  S.csMode=mode;
  S.csForm.shot="smart";
  csNormalize();
  csRerender();
}
function setCsView(id){S.csView=id;csRerender();}

function csViewLabel(){return (CS_VIEWS.find(v=>v.id===S.csView)||CS_VIEWS[0]).label;}
function csRenderHeader(){
  const t=csEl("csTitle"),s=csEl("csSubt");
  if(t)t.textContent=(csIsVideo()?"🎬 ":"📷 ")+csBrand();
  if(!s)return;
  const tier=csTier(),hasKey=gs("api_falai");
  const dirId=gs("active_director","");
  const dir=dirId?(getAllDirectors().find(d=>d.id===dirId)||{}).name:"";
  s.innerHTML=`<span style="color:var(--${hasKey?'green':'red'});font-weight:700">●</span> ${csEsc(tier.label)}${tier.partial?' <span style="color:var(--gold)">(partial)</span>':''} · ${csEsc(csViewLabel())}${dir?' · '+pIcon('film',10)+' '+csEsc(dir):''}`;
}
function csRenderSummary(){
  const el=csEl("csSummary");
  if(!el)return;
  const f=S.csForm,tier=csTier();
  if(tier.empty){el.textContent=tier.short;return;}
  const bits=[tier.short,f.ratio];
  if(csIsVideo())bits.push(f.shot==="custom"?`${S.csScenes.length} scenes`:snapToKatFilmsDuration(f.duration)+"s");
  const look=CS_RIG_LOOKS.find(l=>l.id===f.look);
  if(csHas("rig")&&look)bits.push(look.label);
  el.textContent=bits.join(" · ");
}
function csRenderCost(){
  const el=csEl("csCostHint");
  if(!el)return;
  const est=csEstimate();
  el.textContent=est?formatCostLine(est)+(est.note?` (${est.note})`:""):"";
}
function csSetBusy(on){
  const b=csEl("csGenBtn");
  if(b){b.disabled=on||!gs("api_falai");b.setAttribute("aria-busy",on?"true":"false");b.style.opacity=on?".55":"";}
}
function csRefreshAll(){
  if(!csEl("csKc"))return;
  csRenderHeader();csRenderModebar();csRenderScenes();csRenderSummary();csRenderCost();csRenderSheet();
  const empty=!!csTier().empty;
  if(S.csThreadEmpty!==empty)csRenderThread();
}

// ── MODE BAR + SCENES + REFS ──
function csRenderModebar(){
  const bar=csEl("csModebar");
  if(!bar)return;
  const video=csIsVideo(),multi=S.csForm.shot==="custom";
  bar.innerHTML=`<div class="ks-seg">
      <button type="button" class="${!video?'on':''}" data-cs="mode" data-v="image">📷 Image</button>
      <button type="button" class="${video?'on':''}" data-cs="mode" data-v="video">🎬 Video</button>
    </div>
    ${video&&csHas("multishot")?`<div class="ks-seg" title="Shot Control">
      <button type="button" class="${!multi?'on':''}" data-cs="set" data-k="shot" data-v="smart">Smart</button>
      <button type="button" class="${multi?'on':''}" data-cs="set" data-k="shot" data-v="custom">Multishot</button>
    </div>`:''}`;
}
function csRenderScenes(){
  const row=csEl("csScenes");
  if(!row)return;
  if(!(csIsVideo()&&S.csForm.shot==="custom")){row.style.display="none";row.innerHTML="";return;}
  row.style.display="flex";
  const ramps=csRampList(csTier());
  const moves=CS_CAMERA_MOVES.filter(m=>m.id!=="auto");
  row.innerHTML=S.csScenes.map((s,i)=>`<div class="cs-scene kc-glass">
      <div class="cs-scene-h"><span>Scene ${i+1}</span><button type="button" class="cs-x" data-cs="rmscene" data-v="${s.id}" aria-label="Remove scene">✕</button></div>
      <select class="ks-sel" data-scene="${s.id}" data-field="cameraMove"><option value="">Camera: studio</option>${moves.map(m=>`<option value="${m.id}"${m.id===s.cameraMove?' selected':''}>${csEsc(m.label)}</option>`).join('')}</select>
      <select class="ks-sel" data-scene="${s.id}" data-field="speedRamp"><option value="">Ramp: studio</option>${ramps.filter(r=>r.id!=="auto").map(r=>`<option value="${r.id}"${r.id===s.speedRamp?' selected':''}>${csEsc(r.label)}</option>`).join('')}</select>
      <select class="ks-sel" data-scene="${s.id}" data-field="duration">${[3,4,5,6,8,10,12,15].map(d=>`<option value="${d}"${d===s.duration?' selected':''}>${d}s</option>`).join('')}</select>
    </div>`).join('')+`<button type="button" class="cs-addscene" data-cs="addscene" aria-label="Add scene">+</button>`;
}
function csRenderRefStrip(){
  const bar=csEl("csAttachBar");
  if(!bar)return;
  if(!S.csRefImages.length){bar.style.display="none";bar.innerHTML="";return;}
  bar.style.display="flex";
  bar.innerHTML=`<div class="cs-refs">${S.csRefImages.map((r,i)=>`<div class="cs-ref"><img src="${r.dataUrl}" alt=""><i>@${csEsc(r.tag)}</i><button type="button" class="cs-x" data-cs="rmref" data-v="${i}" aria-label="Remove">✕</button></div>`).join('')}</div>`;
}

// ── SETTINGS SHUTTER ──
function toggleCsSettings(force){
  const panel=csEl("csSettingsPanel"),backdrop=csEl("csSettingsBackdrop");
  if(!panel)return;
  const opening=typeof force==="boolean"?force:!panel.classList.contains("open");
  if(opening)csRenderSheet();
  panel.classList.toggle("open",opening);
  if(backdrop)backdrop.classList.toggle("show",opening);
}

// Builders. Every control is a button carrying data-cs — one delegated
// handler (csClick) routes them all; no inline JS strings to escape.
const csChip=(k,v,label,on,extra)=>`<button type="button" class="ks-chip ks-glow${on?' on':''}" data-cs="set" data-k="${k}" data-v="${csEsc(v)}">${extra||''}${csEsc(label)}</button>`;
const csCard=(k,v,title,sub,on,pre)=>`<button type="button" class="ks-mcard ks-glow${on?' on':''}" data-cs="set" data-k="${k}" data-v="${csEsc(v)}">${pre||''}<b>${csEsc(title)}</b>${sub?`<small>${csEsc(sub)}</small>`:''}</button>`;
const csRail=(key,html)=>`<div class="ks-rail" data-rail="${key}">${html}</div>`;
const csSection=(title,small,body)=>`<div class="ks-card"><div class="ks-lab"><span>${title}</span>${small?`<small>${small}</small>`:''}</div>${body}</div>`;

function csRenderSheet(){
  const body=csEl("csSheetBody"),panel=csEl("csSettingsPanel");
  if(!body||!panel)return;
  // keep scroll positions across the re-render (vertical on the sheet,
  // horizontal on every rail) so tapping a chip never jumps the view
  const top=panel.scrollTop;
  const rails={};body.querySelectorAll("[data-rail]").forEach(r=>{rails[r.dataset.rail]=r.scrollLeft;});
  const openPP=!!(body.querySelector("details[data-pp]")||{}).open;
  const f=S.csForm,tier=csTier(),caps=new Set(tier.caps||[]),video=csIsVideo();
  let h="";
  if(tier.partial)h+=`<div class="cs-warn">⚠️ ${csEsc(tier.label)} is a partial build — flagged, not hidden. Full parity once more source material is confirmed.</div>`;

  // Tier
  h+=csSection(`${video?"Kat Films":"Camera Crafts"} tier`,"",csRail("tier",csTiersForMode(S.csMode).map(t=>
    `<button type="button" class="ks-mcard ks-glow${t.id===tier.id?' on':''}" data-cs="tier" data-v="${t.id}" style="min-width:170px;max-width:220px"><b>${csEsc(t.label)} ${t.empty?'<span class="cs-badge empty">empty</span>':t.partial?'<span class="cs-badge">partial</span>':''}</b><small>${csEsc(t.sub)}</small></button>`).join("")));

  if(tier.empty){
    h+=`<div class="ks-card"><div class="ks-hint" style="margin:0">${csEsc(tier.sub)}</div>${tier.link?`<div class="ks-row" style="margin-top:10px"><button type="button" class="ks-btn" data-cs="tierlink">${csEsc(tier.link.label)}</button></div>`:''}</div>`;
    body.innerHTML=h;
    csRestoreScroll(panel,body,top,rails);
    return;
  }

  // Motion (video)
  if(video&&caps.has("cameraMove")){
    const groups=[...new Set(CS_CAMERA_MOVES.map(m=>m.group))];
    h+=csSection("Camera movement","",groups.map(g=>`<div class="cs-group">${g}</div><div class="ks-chips" style="margin-bottom:2px">${CS_CAMERA_MOVES.filter(m=>m.group===g).map(m=>csChip("cameraMove",m.id,m.label,f.cameraMove===m.id)).join("")}</div>`).join(""));
  }
  if(video&&caps.has("speedRamp")){
    const pro=caps.has("speedRampPro");
    h+=csSection("Speed ramp",pro?"Pro presets":"",`<div class="ks-chips">${csRampList(tier).map(r=>csChip("speedRamp",r.id,r.label,f.speedRamp===r.id)).join("")}</div>`);
  }
  if(video&&caps.has("duration")){
    if(f.shot==="custom"){
      h+=csSection("Duration","per scene",`<div class="ks-hint" style="margin:0">Set on each scene card above the composer — ${S.csScenes.reduce((n,s)=>n+snapToKatFilmsDuration(s.duration),0)}s total.</div>`);
    }else{
      const snapped=snapToKatFilmsDuration(f.duration);
      h+=csSection("Duration",`<b>${snapped}s</b>`,`<div class="ks-chips">${KAT_FILMS_DURATIONS.map(d=>csChip("duration",d,d+"s",!f.customDuration&&snapped===d)).join("")}${csChip("durationCustom",f.duration,"Custom",f.customDuration)}</div>
        ${f.customDuration?`<input type="range" class="ks-range" data-cs-range="durationCustom" min="3" max="15" step="1" value="${f.duration}" style="--ksf:${(f.duration-3)/12*100}%"><div class="ks-hint" data-range-val="durationCustom">${f.duration}s requested → ${snapped}s (the model only accepts ${KAT_FILMS_DURATIONS.join(", ")}s)</div>`:''}`);
    }
  }

  // Camera rig
  if(caps.has("rig")){
    const lookCards=csCard("look","","No rig","Let the model decide",!f.look&&f.body==="Auto"&&f.lens==="Auto"&&f.focal==="Auto"&&f.aperture==="Auto")
      +CS_RIG_LOOKS.map(l=>csCard("look",l.id,l.label,l.sub,f.look===l.id)).join("");
    h+=csSection("Camera rig",f.look?(CS_RIG_LOOKS.find(l=>l.id===f.look)||{}).label:"custom",
      `<div class="cs-group" style="margin-top:0">Looks</div>${csRail("looks",lookCards)}
       <div class="cs-group">Body</div>${csRail("body",CS_CAMERA_BODIES.map(b=>csCard("body",b.id,b.label,b.sub,f.body===b.id)).join(""))}
       <div class="cs-group">Lens</div>${csRail("lens",CS_LENSES.map(l=>csCard("lens",l.id,l.label,l.sub,f.lens===l.id)).join(""))}
       <div class="cs-group">Focal length</div><div class="ks-chips">${CS_FOCAL_LENGTHS.map(x=>csChip("focal",x.id,x.label,f.focal===x.id)).join("")}</div>
       <div class="cs-group">Aperture</div><div class="ks-chips">${CS_APERTURES.map(x=>csChip("aperture",x.id,x.label,f.aperture===x.id)).join("")}</div>
       <div class="ks-hint" style="margin:8px 0 0">Folded into the prompt as real photography language — "Auto" says nothing.</div>`);
  }

  // Look
  if(caps.has("genre"))h+=csSection("Genre","",`<div class="ks-chips">${CINEMA_GENRES.map(g=>csChip("genre",g.label,g.label,f.genre===g.label)).join("")}</div>`);
  if(caps.has("style")){
    h+=csSection("Style","",csRail("style",STYLE_PRESETS.map(s=>`<button type="button" class="ks-mcard ks-glow${f.style===s.value?' on':''}" data-cs="set" data-k="style" data-v="${csEsc(s.value)}">${typeof stylePreviewHTML==="function"?stylePreviewHTML(s.label):''}<b>${csEsc(s.label)}</b></button>`).join("")));
  }
  if(caps.has("director")){
    const dirId=gs("active_director","");
    const dir=dirId?(getAllDirectors().find(d=>d.id===dirId)||{}).name:"";
    h+=csSection("AI Director","",`<div class="cs-director"><span>${dir?csEsc(dir):"No director active"}</span><button type="button" class="ks-btn sm" data-cs="director">Change</button></div>`);
  }
  if(caps.has("styleSettings")){
    h+=csSection("Style settings","Cinema Studio 3.5-style",Object.entries(CS_STYLE_SETTINGS).map(([k,def])=>`<div class="cs-group" style="margin-top:0">${def.label}</div><div class="ks-chips" style="margin-bottom:4px">${def.options.map(o=>csChip(k,o.id,o.label,f[k]===o.id)).join("")}</div>`).join("")+`<div class="ks-hint" style="margin:4px 0 0">Each list is what was legible in the source — likely not the complete preset set.</div>`);
  }
  if(caps.has("soulHex")){
    h+=csSection("Soul HEX","color palette matching",`<div class="ks-hint" style="margin-top:0">Upload a reference image and its colors, tones and mood carry into your generation. Optional.</div>${S.csSoulHexRef
      ?`<div class="ks-row"><div class="ks-thumb"><img src="${S.csSoulHexRef}" alt=""></div><span style="flex:1;font-size:12px">Color reference attached</span><button type="button" class="ks-btn ghost" data-cs="soulhex-rm">✕ Remove</button></div>`
      :`<button type="button" class="ks-btn" style="width:100%" data-cs="soulhex-add">+ Add color reference</button>`}`);
  }
  if(caps.has("locations")){
    h+=csSection("Variations",`<b data-range-val="locations">${f.locations}</b>`,`<input type="range" class="ks-range" data-cs-range="locations" min="1" max="10" step="1" value="${f.locations}" style="--ksf:${(f.locations-1)/9*100}%"><div class="ks-hint" style="margin:0">Describe a place — get this many environment variations of it.</div>`);
  }
  if(caps.has("ratio"))h+=csSection("Aspect ratio","",`<div class="ks-chips">${CS_RATIOS.map(r=>csChip("ratio",r,r,f.ratio===r,ksMiniRatio(r))).join("")}</div>`);

  // Transparency: exactly what will be sent
  const ta=csEl("csPrompt");
  const sample=(ta&&ta.value.trim())||"your scene description";
  const firstScene=(video&&f.shot==="custom"&&S.csScenes[0])||null;
  const compiled=csCompile({tier,mode:S.csMode,prompt:sample,scene:firstScene,director:typeof getActiveDirectorPrompt==="function"?getActiveDirectorPrompt():"",soulHex:caps.has("soulHex")&&!!S.csSoulHexRef});
  h+=`<details class="ks-card" data-pp${openPP?' open':''}><summary class="cs-sum">Compiled prompt</summary><div class="cs-pp">${compiled.parts.map(p=>`<div><small>${csEsc(p.label)}</small>${csEsc(p.text)}</div>`).join("")}</div></details>`;
  const est=csEstimate();
  h+=`<div class="cs-foot">Powered by <b>${csEsc(tier.model)}</b>${est?` · ${csEsc(formatCostLine(est))}${est.note?` (${csEsc(est.note)})`:''}`:''}</div>`;

  body.innerHTML=h;
  csRestoreScroll(panel,body,top,rails);
}
function csRestoreScroll(panel,body,top,rails){
  body.querySelectorAll("[data-rail]").forEach(r=>{
    if(rails[r.dataset.rail]!=null)r.scrollLeft=rails[r.dataset.rail];
    else{const on=r.querySelector(".on");if(on)r.scrollLeft=Math.max(0,on.offsetLeft-12);}
  });
  panel.scrollTop=top;
}

// ── THREAD ──
function csRenderThread(){
  const thread=csEl("csChatThread");
  if(!thread)return;
  const tier=csTier();
  S.csThreadEmpty=!!tier.empty;
  if(tier.empty){
    thread.innerHTML=`<div class="cs-empty"><div class="kc-orb" style="margin-bottom:14px">🎬</div>
      <div class="kc-etitle">${csEsc(tier.label)}${tier.link?'':' is empty right now'}</div>
      <div class="kc-esub">${csEsc(tier.link?tier.sub:"This slot is reserved for a future tier — nothing to generate with yet.")}</div>
      ${tier.link?`<button type="button" class="ks-btn" data-cs="tierlink" style="width:100%;margin-bottom:8px">${csEsc(tier.link.label)}</button>`:''}
      <button type="button" class="ks-btn" data-cs="settings" style="width:100%">Choose a different tier</button></div>`;
    return;
  }
  if(!S.csChatHistory.length){
    const ideas=csIsVideo()
      ?["A lone astronaut crosses a red desert at dusk, long shadows, dust drifting past camera","Rain-slicked neon alley, a courier sprints toward camera and vaults a railing","Slow reveal of a candle-lit library as a figure turns a page"]
      :["Rooftop at golden hour, a detective in a trench coat looks over the city","Empty diner at 3am, neon sign flickering on wet glass","Abandoned observatory, shafts of light through a broken dome"];
    thread.innerHTML=KosmicChatGlass.empty({icon:KosmicChatGlass.IC.spark,title:csIsVideo()?"Roll camera":"Compose a shot",sub:"Your generations stay here like a shot log — scroll up to see earlier ones. Tap the sliders to set the camera rig, movement and look.",ideas,inputId:"csPrompt"});
    return;
  }
  thread.innerHTML=S.csChatHistory.map((m,i)=>csMessageHTML(m,i)).join("");
  thread.scrollTop=thread.scrollHeight;
}
function csMessageHTML(msg,i){
  if(msg.role==="user"){
    const chips=(msg.chips||[]).map(c=>`<span class="cs-mini">${csEsc(c)}</span>`).join("");
    return `<div class="cs-bub"><div class="ig-bubble-user" style="align-self:stretch;max-width:none">${csEsc(msg.content)}${chips?`<div class="cs-chiprow">${chips}</div>`:''}</div></div>`;
  }
  if(msg.type==="loading")return `<div class="ig-bubble-loading" id="${csEsc(msg.id)}"><span class="ig-dot"></span><span class="ig-dot"></span><span class="ig-dot"></span>&nbsp;${csEsc(msg.content)}</div>`;
  if(msg.type==="error"){
    const canRetry=msg.jobId&&CS_JOBS[msg.jobId];
    return `<div class="ig-bubble-assistant" style="color:var(--red)">❌ ${csEsc(msg.content)}${canRetry?`<div class="cs-actions"><button type="button" class="cs-act" data-cs="retry" data-v="${csEsc(msg.jobId)}">↻ Retry</button></div>`:''}</div>`;
  }
  const meta=msg.meta||{},url=csEsc(msg.content),isVid=msg.type==="video";
  const fname=`KatFilms_${sanitizeFilenamePart(meta.prompt||"shot")}.${isVid?"mp4":"png"}`;
  const fav=meta.assetId&&S.csFavorites.includes(meta.assetId);
  const actions=`<div class="cs-actions">
      <button type="button" class="cs-act" data-cs="dl" data-url="${url}" data-name="${csEsc(fname)}">⬇ Save</button>
      ${meta.assetId?`<button type="button" class="cs-act" data-cs="coll" data-v="${csEsc(meta.assetId)}">📁 Collection</button>
      <button type="button" class="cs-act" data-cs="fav" data-v="${csEsc(meta.assetId)}">${fav?'★':'☆'} Favorite</button>`:''}
      ${meta.raw?`<button type="button" class="cs-act" data-cs="reuse" data-v="${i}">↺ Reuse prompt</button>`:''}
    </div>`;
  return `<div class="ig-bubble-assistant">
      ${isVid?`<video class="cs-media" src="${url}" controls playsinline preload="metadata"></video>`:`<img class="cs-media" src="${url}" alt="">`}
      <div class="cs-meta">via ${csEsc(meta.providerLabel||csBrand())}</div>${actions}</div>`;
}
function csPushMessage(msg){
  S.csChatHistory.push(msg);
  if(S.csChatHistory.length>60)S.csChatHistory=S.csChatHistory.slice(-60);
  csPersistHistory();
  csRenderThread();
}
function csReplaceBubble(id,msg){
  const idx=S.csChatHistory.findIndex(m=>m.id===id);
  if(idx>=0)S.csChatHistory[idx]=msg;else S.csChatHistory.push(msg);
  csPersistHistory();
  csRenderThread();
}
function csRemoveBubble(id){
  S.csChatHistory=S.csChatHistory.filter(m=>m.id!==id);
  csPersistHistory();csRenderThread();
}
// Loading bubbles are runtime-only, so they never reach storage.
function csPersistHistory(){saveSetting("cs_chat_history",S.csChatHistory.filter(m=>m.type!=="loading"));}
function csClearChat(){
  if(!S.csChatHistory.length)return;
  S.csChatHistory=[];csPersistHistory();csRenderThread();
  toast("Chat cleared — your generations are still in My Generations","success");
}

// ── NAV SHEET (views + projects), same chrome as the chat-history sheet ──
function csOpenNav(){
  const old=csEl("kchRoot");if(old)old.remove();
  const root=document.createElement("div");root.id="kchRoot";
  const projRows=S.csProjects.slice().reverse().map(p=>`<div class="kch-row${p.id===S.csActiveProjectId?' cur':''}"><button type="button" class="kch-main" data-cs="loadproject" data-v="${csEsc(p.id)}"><b>${csEsc(p.name)}</b><small>${(p.generations||[]).length} shot${(p.generations||[]).length===1?'':'s'}${p.id===S.csActiveProjectId?' · active':''}</small></button></div>`).join("");
  root.innerHTML=`<div class="kch-back" data-cs="navclose"></div>
    <div class="kch-sheet" role="dialog" aria-label="Studio menu">
      <div class="kch-grab" data-cs="navclose"></div>
      <div class="kch-head"><b>${csEsc(csBrand())}</b><button type="button" class="kch-btn" data-cs="newproject">＋ New project</button></div>
      <div class="kch-body">
        ${CS_VIEWS.map(v=>`<div class="kch-row${S.csView===v.id?' cur':''}"><button type="button" class="kch-main" data-cs="view" data-v="${v.id}"><b>${csEsc(v.label)}</b><small>${csEsc(v.sub)}</small></button></div>`).join("")}
        <div class="cs-group" style="margin:14px 4px 6px">Projects</div>
        ${S.csActiveProjectId?`<div class="kch-row"><button type="button" class="kch-main" data-cs="loadproject" data-v=""><b>No project</b><small>Generations save unfiled</small></button></div>`:''}
        ${projRows||'<div class="kch-none">No projects yet — start one to group shots into a film.</div>'}
      </div>
    </div>`;
  root.onclick=csClick;
  document.body.appendChild(root);
  requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add("kch-open")));
}
function csCloseNav(){if(typeof KosmicChatGlass!=="undefined")KosmicChatGlass.closeHistory();}

// ── OTHER VIEWS ──
function csAssetCard(a,actions){
  return `<div class="cs-gcard kc-glass">
    ${a.type==="video"?`<video src="${csEsc(a.url)}" controls playsinline preload="metadata"></video>`:`<img src="${csEsc(a.url)}" alt="" loading="lazy">`}
    <small title="${csEsc(a.prompt||"")}">${csEsc((a.prompt||"").slice(0,60))}</small>${actions||''}</div>`;
}
const csFavBtn=a=>`<button type="button" class="cs-act" data-cs="favview" data-v="${csEsc(a.id)}">${S.csFavorites.includes(a.id)?'★ Favorited':'☆ Favorite'}</button>`;
function csRenderView(){
  const wrap=csEl("csViewBody");
  if(!wrap)return;
  const back=`<button type="button" class="ks-btn cs-back" data-cs="view" data-v="home">← Back to studio</button>`;
  if(S.csView==="project")return csRenderProject(wrap,back);
  if(S.csView==="generations"){
    const gens=(S.assets||[]).filter(a=>a.providerLabel==="Kat Films 4K"||a.providerLabel==="Camera Crafts 4K").slice().reverse();
    wrap.innerHTML=back+(gens.length?`<div class="cs-grid">${gens.map(a=>csAssetCard(a,csFavBtn(a))).join("")}</div>`:`<div class="cs-note">No generations yet — make one in the studio.</div>`);
    return;
  }
  if(S.csView==="favorites"){
    const favs=(S.assets||[]).filter(a=>S.csFavorites.includes(a.id));
    wrap.innerHTML=back+(favs.length?`<div class="cs-grid">${favs.map(a=>csAssetCard(a,csFavBtn(a))).join("")}</div>`:`<div class="cs-note">Nothing favorited yet — star generations you like to keep them here.</div>`);
    return;
  }
  if(S.csView==="elements"){
    const chars=S.characters||[];
    wrap.innerHTML=back+`<div class="cs-note" style="padding-top:0">Elements are this app's Characters — build one there, then type @ and their name in the prompt to bring them into a scene.</div>
      <button type="button" class="ks-btn" style="width:100%;margin-bottom:12px" data-cs="characters">🎭 Open Character Library</button>
      <div class="cs-grid">${chars.map(c=>`<div class="cs-gcard kc-glass">${c.refImg?`<img src="${csEsc(c.refImg)}" alt="">`:`<div class="cs-ph">🎭</div>`}<small>${csEsc(c.name)}</small></div>`).join("")||'<div class="cs-note" style="grid-column:1/-1">No characters yet.</div>'}</div>`;
  }
}
// PROJECT — the film's shot list: every generation filed to the active
// project, in order, with one tap to send all the videos to the Video
// Editor's sequence.
function csRenderProject(wrap,back){
  const p=S.csProjects.find(x=>x.id===S.csActiveProjectId);
  if(!p){
    wrap.innerHTML=back+`<div class="cs-note">No active project. A project groups your shots into a film — new generations are filed to it automatically.</div>
      <button type="button" class="ks-btn" style="width:100%" data-cs="newproject">＋ New project</button>`;
    return;
  }
  const assets=(p.generations||[]).map(id=>(S.assets||[]).find(a=>a.id===id)).filter(Boolean);
  const vids=assets.filter(a=>a.type==="video");
  wrap.innerHTML=back+`<div class="ks-lab"><span>${csEsc(p.name)}</span><small>${assets.length} shot${assets.length===1?'':'s'}</small></div>
    <div class="ks-row" style="margin-bottom:12px">
      <button type="button" class="ks-btn" data-cs="projeditor"${vids.length?'':' disabled'}>🎞 Send ${vids.length} video${vids.length===1?'':'s'} to Editor</button>
    </div>
    ${assets.length?`<div class="cs-grid">${assets.map((a,i)=>csAssetCard(a,`<button type="button" class="cs-act" data-cs="projremove" data-v="${csEsc(a.id)}">Remove from project</button>`)).join("")}</div>`:`<div class="cs-note">No shots in this project yet — generate from the studio and they land here.</div>`}`;
}
function addCsGenerationToProject(projectId,assetId){
  const p=S.csProjects.find(pr=>pr.id===projectId);
  if(p){p.generations=p.generations||[];p.generations.push(assetId);saveSetting("cs_projects",S.csProjects);}
}
function toggleCsFavorite(assetId){
  const idx=S.csFavorites.indexOf(assetId);
  if(idx>=0)S.csFavorites.splice(idx,1);else S.csFavorites.push(assetId);
  saveSetting("cs_favorites",S.csFavorites);
}
function loadCsProject(id){
  S.csActiveProjectId=id||null;
  saveSetting("cs_active_project",S.csActiveProjectId);
  csCloseNav();
  toast(id?"Project loaded":"No project selected — generations save unfiled","success");
  if(S.csView==="project")csRenderView();
}
async function newCsProject(){
  csCloseNav();
  const name=await showPromptDialog("Name this project","");
  if(!name)return;
  const p={id:"cs_"+Date.now(),name,createdAt:new Date().toISOString(),generations:[]};
  S.csProjects.push(p);
  S.csActiveProjectId=p.id;
  saveSetting("cs_projects",S.csProjects);
  saveSetting("cs_active_project",S.csActiveProjectId);
  toast(`🎬 "${name}" created and set active`,"success");
  csRerender();
}

// ── EVENTS — one delegated handler per event type ──
function csClick(e){
  const t=e.target.closest&&e.target.closest("[data-cs]");
  if(!t)return;
  const a=t.dataset.cs,v=t.dataset.v;
  switch(a){
    case"set":csSet(t.dataset.k,v);break;
    case"tier":S.csTier=v;saveSetting("cs_tier",v);csNormalize();csSaveForm();csRefreshAll();break;
    case"tierlink":{const fn=csTier().link&&csTier().link.fn;if(fn&&typeof window[fn]==="function")window[fn]();break;}
    case"mode":setCsMode(v);break;
    case"settings":toggleCsSettings();break;
    case"nav":csOpenNav();break;
    case"navclose":csCloseNav();break;
    case"view":csCloseNav();setCsView(v);break;
    case"clearchat":csClearChat();break;
    case"loadproject":loadCsProject(v);break;
    case"newproject":newCsProject();break;
    case"projremove":{const p=S.csProjects.find(x=>x.id===S.csActiveProjectId);if(p){p.generations=(p.generations||[]).filter(id=>id!==v);saveSetting("cs_projects",S.csProjects);csRenderView();}break;}
    case"projeditor":{
      const p=S.csProjects.find(x=>x.id===S.csActiveProjectId);
      const vids=((p&&p.generations)||[]).map(id=>(S.assets||[]).find(x=>x.id===id)).filter(x=>x&&x.type==="video");
      vids.forEach(x=>addToSequence(x.id));
      toast(`🎞 ${vids.length} video${vids.length===1?'':'s'} added to the Video Editor in order`,"success");
      break;
    }
    case"mention":csPickMention(v);break;
    case"rmref":removeCsRefImage(+v);break;
    case"addscene":csAddScene();break;
    case"rmscene":csRemoveScene(+v);break;
    case"retry":csRetryJob(v);break;
    case"dl":downloadWithName(t.dataset.url,t.dataset.name);break;
    case"coll":openCollectionPicker("asset",v);break;
    case"fav":toggleCsFavorite(v);t.textContent=(S.csFavorites.includes(v)?"★":"☆")+" Favorite";break;
    case"favview":toggleCsFavorite(v);if(S.csView==="favorites")csRenderView();else t.textContent=S.csFavorites.includes(v)?"★ Favorited":"☆ Favorite";break;
    case"reuse":{const m=S.csChatHistory[+v],ta=csEl("csPrompt");if(m&&m.meta&&ta){ta.value=m.meta.raw;S.csDraft=ta.value;ta.focus();ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,140)+"px";}break;}
    case"director":switchMod("directors",document.querySelector("[data-mod=directors]"));break;
    case"characters":switchMod("characters",document.querySelector("[data-mod=characters]"));break;
    case"soulhex-add":{const f=csEl("csSoulHexFile");if(f)f.click();break;}
    case"soulhex-rm":S.csSoulHexRef=null;csRenderSheet();break;
  }
}
function csChange(e){
  const t=e.target;
  if(t.id==="csRefFile")return handleCsRefImageUpload(e);
  if(t.id==="csSoulHexFile")return handleCsSoulHexUpload(e);
  if(t.dataset&&t.dataset.scene)return csUpdateScene(+t.dataset.scene,t.dataset.field,t.value);
  if(t.dataset&&t.dataset.csRange){csSaveForm();csRenderSheet();}
}
function csInput(e){
  const t=e.target;
  if(t.id==="csPrompt")return csOnPromptInput(t);
  if(t.dataset&&t.dataset.csRange){
    const k=t.dataset.csRange,val=+t.value,f=S.csForm;
    if(k==="locations")f.locations=val;else{f.duration=val;f.customDuration=true;}
    const min=+t.min,max=+t.max;
    t.style.setProperty("--ksf",((val-min)/(max-min)*100)+"%");
    const lab=document.querySelector(`[data-range-val="${k}"]`);
    if(lab)lab.textContent=k==="locations"?val:`${val}s requested → ${snapToKatFilmsDuration(val)}s (the model only accepts ${KAT_FILMS_DURATIONS.join(", ")}s)`;
    csRenderSummary();csRenderCost();
  }
}

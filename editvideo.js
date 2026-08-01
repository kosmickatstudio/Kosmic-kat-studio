// ══════════════════════════════════════════════════════════════════════
// EDIT VIDEO MODULE — new module, added after reviewing a reference AI
// video platform's tab layout (Create Video / Edit Video / Motion
// Control) against this app. Motion Control already existed here as a
// real, separate Kling Motion Control endpoint (see index.html's
// renderMotionControl + genViaKlingMotionControl) — it was not missing.
// This module WAS genuinely missing: this app's existing "Video Editor"
// (editor.js) is a clip sequencer/trimmer, not an AI natural-language
// video-to-video editor. This is that second, different thing.
//
// Every endpoint/field name below is verified against fal.ai's own model
// pages before use, not guessed — same standard as the rest of this app:
//   - fal-ai/kling-video/o1/video-to-video/edit — prompt + video_url
//     required; image_urls (up to 4) and elements optional; keep_audio
//     controls whether original audio is preserved. $0.168/second,
//     confirmed directly on fal's own O1 Edit model page.
//   - fal-ai/kling-video/o3/pro/video-to-video/edit — same shape, Kling's
//     newer O3 element-compositing tier. $0.168/second, confirmed
//     directly on fal's own O3 Pro Edit model page.
//   - fal-ai/kling-video/o3/standard/video-to-video/edit — same family,
//     real endpoint confirmed to exist on fal, but its per-second rate was
//     not directly confirmed anywhere searched — carried at the O1/O3-Pro
//     rate as a floor and marked approxRate, same honest pattern
//     estimateVideoCost already uses elsewhere in this app for unconfirmed
//     tiers (see v3 motion-control's approxRate in VIDEO_PRICING).
//   - Source video limits (o1 standard schema, directly confirmed):
//     .mp4/.mov, 3–10.05s, 720–2160px, ≤200MB, 24–60fps.
//
// LOAD ORDER: must load AFTER index.html's main inline script — needs
// gs/saveSetting/toast/measureVideo/dataUrlBytes/uploadToFalStorage/
// dataUrlToBlob/uploadRefsToFal/pollFalVideoResult/createVideoAsset/
// downloadWithName/sanitizeFilenamePart/downscaleImageFile/
// openGenerationInfoModal/VC_RESULT_ICONS/updateRangeFill, all defined
// there — same plain-global pattern as motion.js.
// ══════════════════════════════════════════════════════════════════════

S.evVideo=S.evVideo||null;          // {dataUrl,name,duration}
S.evImages=S.evImages||[];          // up to 4: [{dataUrl,name}]
S.evElement=S.evElement||{frontal:null,angles:[]}; // optional single Element (advanced)
S.evResults=S.evResults||[];        // populated from storage in the main init pass, see below

// Real limits from fal's o1/standard/video-to-video/edit schema — checked
// client-side so a bad upload fails fast, locally, instead of after a
// wasted upload + queue wait.
const EDIT_VIDEO_LIMITS={minW:720,minH:720,maxW:2160,maxH:2160,minDur:3,maxDur:10.05,maxBytes:209715200};

const EDIT_VIDEO_MODELS=[
  {value:"fal-ai/kling-video/o1/video-to-video/edit",label:"Kling O1 Edit",note:"Default — $0.168/s"},
  {value:"fal-ai/kling-video/o3/standard/video-to-video/edit",label:"Kling O3 Edit — Standard",note:"~$0.168/s est."},
  {value:"fal-ai/kling-video/o3/pro/video-to-video/edit",label:"Kling O3 Edit — Pro",note:"$0.168/s, strongest element compositing"},
];

function renderEditVideo(el){
  const hasKey=gs("api_falai");
  el.innerHTML=`
    <div style="padding:16px;max-width:540px;margin:0 auto">
      <div style="margin-bottom:16px">
        <div style="font-family:'Cinzel',serif;font-size:19px;font-weight:700;color:var(--violet)">✂️ Edit Video</div>
        <div style="font-size:12px;color:var(--textm);margin-top:4px">Change an existing clip with plain-language instructions — swap the character, restyle the scene, change weather or lighting — while the original motion and camera moves stay intact. Different from Video Editor: this re-renders the clip, it doesn't trim/arrange existing ones.</div>
      </div>
      ${!hasKey?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--textm);margin-bottom:14px">⚠️ Add a fal.ai API key in Settings to generate.</div>`:''}

      <div class="f-group">
        <label class="f-label">Source Video <span style="font-weight:400;color:var(--texts)">(what gets edited)</span></label>
        <input type="file" accept="video/*" id="evVideoFile" style="display:none" onchange="handleEvVideoUpload(event)">
        <div id="evVideoPreview" style="margin-bottom:8px"></div>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('evVideoFile').click()">📤 ${S.evVideo?'Change':'Add'} Video</button>
      </div>

      <div class="f-group">
        <label class="f-label">Reference Images <span style="font-weight:400;color:var(--texts)">(optional, up to 4 — outfits, backgrounds, subjects)</span></label>
        <div style="font-size:10px;color:var(--textm);margin:-2px 0 8px">Reference these in your prompt as <b>@Image1</b>, <b>@Image2</b>, etc., in the order added below.</div>
        <input type="file" accept="image/*" multiple id="evImageFile" style="display:none" onchange="handleEvImageUpload(event)">
        <div id="evImagePreviews" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px"></div>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('evImageFile').click()" ${S.evImages.length>=4?'disabled':''}>📤 Add Image${S.evImages.length?` (${S.evImages.length}/4)`:''}</button>
      </div>

      <div class="f-group">
        <label class="f-label">Prompt</label>
        <textarea class="f-textarea" id="evPrompt" placeholder="e.g. Replace the character with @Element1, keep the same movements and camera angles. Make it snow."></textarea>
      </div>

      <div class="f-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="evKeepAudio" checked onchange="saveSetting('ev_keep_audio',this.checked)">
          <span class="f-label" style="margin:0">${pIcon('mic',12)} Keep original audio <span style="font-weight:400;color:var(--texts)">(from the source video)</span></span>
        </label>
      </div>

      <div class="f-group">
        <label class="f-label">Model</label>
        <select class="f-select" id="evModel" onchange="updateEvCostHint()">
          ${EDIT_VIDEO_MODELS.map(m=>`<option value="${m.value}">${m.label} — ${m.note}</option>`).join('')}
        </select>
      </div>

      <details style="margin-bottom:14px">
        <summary style="cursor:pointer;font-size:11px;font-weight:700;color:var(--violet)">+ Advanced: single Element (character/object consistency)</summary>
        <div style="padding-top:10px">
          <div style="font-size:10px;color:var(--textm);margin-bottom:8px">One Element only, needs a main view plus at least one other angle. Reference it as <b>@Element1</b> in your prompt.</div>
          <div id="evElementSlots" style="display:flex;gap:7px;flex-wrap:wrap"></div>
          <input type="file" accept="image/*" id="evElFrontalFile" style="display:none" onchange="handleEvElementImage(event,'frontal')">
          <input type="file" accept="image/*" multiple id="evElAngleFile" style="display:none" onchange="handleEvElementImage(event,'angle')">
        </div>
      </details>

      <button class="btn btn-primary" style="width:100%;margin-top:8px" onclick="sendEditVideoGen()" ${!hasKey?'disabled':''}>✂️ Generate</button>
      <div id="evCostHint" style="font-size:11px;color:var(--gold);margin-top:6px;text-align:center"></div>

      <div id="evResultsWrap" style="margin-top:20px;display:flex;flex-direction:column;gap:16px"></div>
    </div>`;
  renderEvVideoPreview();
  renderEvImagePreviews();
  renderEvElementSlots();
  renderEvResults();
  document.getElementById("evKeepAudio").checked=gs("ev_keep_audio",true)!==false;
  updateEvCostHint();
}

function updateEvCostHint(){
  // Same reasoning as Motion Control's cost hint: there's no duration
  // control here either — the edit follows the source clip's own length,
  // so the estimate has to come from that video's measured length.
  const seconds=(S.evVideo&&S.evVideo.duration)||5;
  const model=document.getElementById("evModel")?.value||EDIT_VIDEO_MODELS[0].value;
  const est=estimateVideoCost(model,seconds,"720p",false);
  const hint=document.getElementById("evCostHint");
  if(hint)hint.textContent=est?formatCostLine(est):"";
}

function handleEvVideoUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  event.target.value="";
  const reader=new FileReader();
  reader.onload=async e=>{
    S.evVideo={dataUrl:e.target.result,name:file.name};
    const m=await measureVideo(e.target.result);
    if(m){
      S.evVideo.duration=m.dur;
      const problems=[];
      if(m.w<EDIT_VIDEO_LIMITS.minW||m.h<EDIT_VIDEO_LIMITS.minH)problems.push(`it's ${m.w}×${m.h} — Edit Video needs at least ${EDIT_VIDEO_LIMITS.minW}×${EDIT_VIDEO_LIMITS.minH}`);
      if(m.w>EDIT_VIDEO_LIMITS.maxW||m.h>EDIT_VIDEO_LIMITS.maxH)problems.push(`it's ${m.w}×${m.h} — the maximum is ${EDIT_VIDEO_LIMITS.maxW}×${EDIT_VIDEO_LIMITS.maxH}`);
      if(isFinite(m.dur)&&(m.dur<EDIT_VIDEO_LIMITS.minDur||m.dur>EDIT_VIDEO_LIMITS.maxDur))problems.push(`it's ${m.dur.toFixed(1)}s — Edit Video accepts ${EDIT_VIDEO_LIMITS.minDur}s to 10s`);
      const bytes=dataUrlBytes(e.target.result);
      if(bytes>EDIT_VIDEO_LIMITS.maxBytes)problems.push(`it's ${(bytes/1048576).toFixed(0)}MB — the limit is ${(EDIT_VIDEO_LIMITS.maxBytes/1048576).toFixed(0)}MB`);
      if(problems.length)toast("Source video: "+problems.join("; "),"error");
    }
    renderEvVideoPreview();
    updateEvCostHint();
  };
  reader.readAsDataURL(file);
}

function renderEvVideoPreview(){
  const wrap=document.getElementById("evVideoPreview");
  if(!wrap)return;
  wrap.innerHTML=S.evVideo?`<div style="position:relative;width:120px">
    <video src="${S.evVideo.dataUrl}" controls style="width:120px;border-radius:10px;display:block"></video>
    <button onclick="removeEvVideo()" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:10px;cursor:pointer;line-height:1;z-index:2">✕</button>
  </div>`:'';
}
function removeEvVideo(){S.evVideo=null;renderEvVideoPreview();updateEvCostHint();}

async function handleEvImageUpload(event){
  const files=Array.from(event.target.files||[]);
  event.target.value="";
  const room=4-S.evImages.length;
  if(room<=0){toast("Maximum 4 reference images","error");return;}
  for(const file of files.slice(0,room)){
    if(!file.type.startsWith("image/")){toast(`${file.name}: images only`,"error");continue;}
    try{
      const dataUrl=await downscaleImageFile(file);
      S.evImages.push({dataUrl,name:file.name});
    }catch(err){toast(err.message,"error");}
  }
  renderEvImagePreviews();
}
function renderEvImagePreviews(){
  const wrap=document.getElementById("evImagePreviews");
  if(!wrap)return;
  wrap.innerHTML=S.evImages.map((img,i)=>`<div style="position:relative;width:64px;height:64px">
    <img src="${img.dataUrl}" style="width:64px;height:64px;border-radius:8px;object-fit:cover">
    <div style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,0.6);color:#fff;font-size:8px;border-radius:4px;padding:1px 4px">@Image${i+1}</div>
    <button onclick="removeEvImage(${i})" style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:9px;cursor:pointer;line-height:1">✕</button>
  </div>`).join('');
  const addBtn=wrap.parentElement?.querySelector('button[onclick*="evImageFile"]');
  if(addBtn){addBtn.disabled=S.evImages.length>=4;addBtn.textContent=`📤 Add Image${S.evImages.length?` (${S.evImages.length}/4)`:''}`;}
}
function removeEvImage(i){S.evImages.splice(i,1);renderEvImagePreviews();}

// ── OPTIONAL ELEMENT — same frontal+angles shape as Motion Control's face
// Element (S.mcElement pattern in index.html), reused here for consistency
// rather than inventing a second UI convention for the same schema idea. ──
async function handleEvElementImage(event,kind){
  const files=Array.from(event.target.files||[]);
  event.target.value="";
  if(!files.length)return;
  try{
    if(kind==="frontal"){
      S.evElement.frontal={dataUrl:await downscaleImageFile(files[0]),name:files[0].name};
    }else{
      for(const f of files.slice(0,3-S.evElement.angles.length)){
        S.evElement.angles.push({dataUrl:await downscaleImageFile(f),name:f.name});
      }
    }
    renderEvElementSlots();
  }catch(err){toast(err.message,"error");}
}
function renderEvElementSlots(){
  const wrap=document.getElementById("evElementSlots");
  if(!wrap)return;
  const slots=[];
  if(S.evElement.frontal){
    slots.push(`<div style="position:relative;width:56px;height:56px"><img src="${S.evElement.frontal.dataUrl}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;border:2px solid var(--gold)"><button onclick="removeEvElementFrontal()" style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:9px;cursor:pointer;line-height:1">✕</button><div style="position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:8px;color:var(--textm)">Main</div></div>`);
  }else{
    slots.push(`<button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('evElFrontalFile').click()">+ Main view</button>`);
  }
  S.evElement.angles.forEach((a,i)=>{
    slots.push(`<div style="position:relative;width:56px;height:56px"><img src="${a.dataUrl}" style="width:56px;height:56px;border-radius:8px;object-fit:cover"><button onclick="removeEvElementAngle(${i})" style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:9px;cursor:pointer;line-height:1">✕</button></div>`);
  });
  if(S.evElement.frontal&&S.evElement.angles.length<3){
    slots.push(`<button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('evElAngleFile').click()">+ Angle</button>`);
  }
  wrap.innerHTML=slots.join('');
}
function removeEvElementFrontal(){S.evElement.frontal=null;renderEvElementSlots();}
function removeEvElementAngle(i){S.evElement.angles.splice(i,1);renderEvElementSlots();}

function renderEvResults(){
  const wrap=document.getElementById("evResultsWrap");
  if(!wrap)return;
  wrap.innerHTML=S.evResults.slice().reverse().map(r=>`<div>
    <video src="${r.url}" controls style="width:100%;border-radius:12px;display:block"></video>
    <div class="vc-result-actions">
      <button class="vc-result-icon-btn" title="Download" onclick="downloadWithName('${r.url.replace(/'/g,"\\'")}','KosmicKat_EditVideo_${sanitizeFilenamePart(r.prompt)}.mp4')">${VC_RESULT_ICONS.download}</button>
      ${r.assetId?`<button class="vc-result-icon-btn" title="Add to Collection" onclick="openCollectionPicker('asset','${r.assetId}')">${VC_RESULT_ICONS.collection}</button>`:''}
      <button class="vc-result-icon-btn" title="Details" onclick="openGenerationInfoModal({prompt:'${(r.prompt||'').replace(/'/g,"\\'").replace(/\n/g," ")}',providerLabel:'${r.modelLabel||'Kling Edit Video'}',resolution:'Fixed by model (up to 1080p)'})">${VC_RESULT_ICONS.info}</button>
    </div>
  </div>`).join('');
}

// ── REAL GENERATION CALL ── verified schema (see file header comment).
async function genViaKlingVideoEdit(prompt,videoUrl,imageUrls,element,model,keepAudio){
  const apiKey=gs("api_falai","");
  if(!apiKey)throw new Error("Add a fal.ai API key in Settings first");
  const body={prompt:prompt||null,video_url:videoUrl};
  if(imageUrls&&imageUrls.length)body.image_urls=imageUrls;
  if(element&&element.frontal&&element.angles&&element.angles.length){
    body.elements=[{frontal_image_url:element.frontal,reference_image_urls:element.angles.slice(0,3)}];
  }
  if(keepAudio!=null)body.keep_audio=keepAudio;
  const submitRes=await fetch(`https://queue.fal.run/${model}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},body:JSON.stringify(body)});
  const submitData=await submitRes.json();
  if(!submitRes.ok)throw new Error((submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText);
  return pollFalVideoResult(model,submitData,apiKey);
}

async function sendEditVideoGen(){
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  if(!S.evVideo){toast("Add a source video first","error");return;}
  const prompt=document.getElementById("evPrompt")?.value.trim();
  if(!prompt){toast("Describe the change you want first","error");return;}
  const keepAudio=document.getElementById("evKeepAudio")?.checked!==false;
  const model=document.getElementById("evModel")?.value||EDIT_VIDEO_MODELS[0].value;
  const modelLabel=EDIT_VIDEO_MODELS.find(m=>m.value===model)?.label||"Kling Edit Video";
  toast("Uploading source video…","");
  try{
    const hostedVideo=S.evVideo.dataUrl.startsWith("data:")?await uploadToFalStorage(dataUrlToBlob(S.evVideo.dataUrl),apiKey):S.evVideo.dataUrl;
    let hostedImages=[];
    if(S.evImages.length){
      toast("Uploading reference images…","");
      hostedImages=await uploadRefsToFal(S.evImages,apiKey);
    }
    let hostedElement=null;
    if(S.evElement.frontal&&S.evElement.angles.length){
      const flat=[S.evElement.frontal,...S.evElement.angles.slice(0,3)];
      const hosted=await uploadRefsToFal(flat,apiKey);
      if(hosted&&hosted[0])hostedElement={frontal:hosted[0],angles:hosted.slice(1).filter(Boolean)};
    }
    toast("Generating — this can take a few minutes…","");
    const videoUrl=await genViaKlingVideoEdit(prompt,hostedVideo,hostedImages,hostedElement,model,keepAudio);
    const savedAsset=createVideoAsset(videoUrl,prompt,"",{model,providerLabel:modelLabel});
    S.evResults.push({url:videoUrl,prompt,modelLabel,assetId:savedAsset.id,createdAt:new Date().toISOString()});
    saveSetting("ev_results",S.evResults);
    logCost(model,"Edit Video");
    renderEvResults();
    toast("✨ Generated","success");
  }catch(err){
    toast("❌ "+err.message,"error");
  }
}

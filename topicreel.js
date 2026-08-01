// ══════════════════════════════════════════════════════════════════════
// TOPIC REEL (Higgsfield Explainer equivalent) — this app already had a
// correctly-scoped placeholder for exactly this feature (VID_SUBMODULES
// in index.html: "Topic Reel" — "Turn a written topic or script idea into
// an explainer-style video."), it just rendered "Coming Soon" via
// openFeaturePlaceholder(). This file is the real implementation.
//
// SCOPE DECISION, made deliberately rather than copying Higgsfield 1:1:
// Higgsfield ships one final rendered MP4 with burned-in subtitles. This
// app has no video-muxing capability anywhere (no ffmpeg.wasm, no
// MediaRecorder stitching — confirmed by search before writing this), and
// editor.js already states plainly that a full browser-export engine
// isn't reliable enough to ship honestly. So this pipeline produces the
// REAL pieces — a script broken into beats, real ElevenLabs narration per
// beat, a real stylized Seedance clip per beat, and a real .srt subtitle
// file — and sends the audio+clips straight into the existing Video
// Editor sequence (editor.js's addToSequence, a real feature, not new
// scaffolding) for the person to arrange. Same honesty standard as the
// rest of the app, not a fake one-click finished video.
//
// Higgsfield's own named avatar roster (Alistair, Isabella, etc.) is
// their proprietary asset, not reproduced here — voice selection reuses
// this app's REAL ElevenLabs voice library (fetchElevenLabsVoices/
// openVoicePicker, already wired in audio.js) instead.
//
// LOAD ORDER: after index.html's main inline script (needs S, gs, save,
// saveSetting, toast, callAiSimple, fetchElevenLabsVoices, openVoicePicker,
// renderVoicePickerTrigger, genViaSeedanceReference, estimateVideoCost,
// formatCostLine, createAudioAsset, createVideoAsset, addToSequence,
// downloadWithName, showConfirmDialog, logCost, pIcon — all defined there.
// ══════════════════════════════════════════════════════════════════════

S.trBeats=S.trBeats||[];        // current in-progress reel: [{narration,visual,audioUrl,audioAssetId,audioDur,videoUrl,videoAssetId,status,error}]
S.trHistory=S.trHistory||gs("tr_history",[])||[];
S.trRunning=S.trRunning||false;

const TOPIC_REEL_STYLES=[
  {id:"paper-diorama",label:"Paper Diorama",frag:"paper diorama art style, layered paper-cutout scenery with visible paper texture and soft directional shadows, handcrafted stop-motion feel"},
  {id:"pastel-flat-2d",label:"Pastel Flat 2D",frag:"flat 2D vector illustration, soft pastel color palette, minimal clean shapes, gentle flat lighting, modern explainer-video look"},
  {id:"fairy-tale",label:"Fairy Tale",frag:"storybook fairy tale illustration style, warm painterly textures, whimsical fantasy detailing, soft glowing light"},
  {id:"colorful-3d",label:"Colorful 3D",frag:"vibrant colorful 3D render, smooth rounded toy-like forms, saturated colors, soft studio lighting, playful modern 3D animation look"},
  {id:"mannequin",label:"Mannequin",frag:"stylized wooden artist's mannequin figures acting out the scene, minimal faceless forms, warm studio lighting, clean neutral background"},
  {id:"3d-papercraft",label:"3D Papercraft",frag:"3D papercraft diorama, folded and layered cardstock shapes, visible paper fold lines, soft ambient occlusion shadows"},
  {id:"pop-art",label:"Pop Art",frag:"bold pop art style, thick black outlines, halftone dot shading, bright primary colors, comic-panel energy"},
  {id:"isometric",label:"Isometric",frag:"clean isometric 3D illustration, precise geometric angles, flat shaded surfaces, minimalist infographic look"},
  {id:"fluffy-toy",label:"Fluffy Toy",frag:"soft plush fluffy toy-like felt/yarn art style, cozy handmade texture, warm rounded shapes, gentle lighting"},
];

const TOPIC_REEL_DURATIONS=[
  {value:30,label:"30 seconds"},
  {value:60,label:"1 minute"},
  {value:180,label:"3 minutes"},
  {value:300,label:"5 minutes"},
  {value:600,label:"10 minutes"},
];

// Valid Seedance 2.0 Fast clip lengths (VIDEO_MODEL_DURATIONS in
// index.html) — each beat's clip gets snapped up to the nearest one that
// still covers its narration, so the video is never shorter than the
// voiceover playing over it.
const TR_SEEDANCE_DURATIONS=[4,5,6,8,10,12,15];
function snapToSeedanceDuration(seconds){
  return TR_SEEDANCE_DURATIONS.find(d=>d>=seconds)||TR_SEEDANCE_DURATIONS[TR_SEEDANCE_DURATIONS.length-1];
}

function renderTopicReel(el){
  document.querySelectorAll(".mod-btn").forEach(b=>b.classList.remove("active"));
  const tabsEl=document.getElementById("moduleTabs");
  if(tabsEl){tabsEl.style.display="none";tabsEl.innerHTML="";}
  const hasFal=gs("api_falai"),hasEleven=gs("api_elevenlabs");
  const hasBrain=["api_anthropic","api_gemini","api_groq","api_deepseek","api_openai","api_aicredits"].some(k=>gs(k));
  const missing=[];
  if(!hasBrain)missing.push("an AI brain key (Anthropic/Gemini/Groq/DeepSeek/OpenAI/AICredits) for scriptwriting");
  if(!hasEleven)missing.push("an ElevenLabs key for narration");
  if(!hasFal)missing.push("a fal.ai key for the visuals");

  el.innerHTML=`
    <div style="padding:16px;max-width:560px;margin:0 auto">
      <div style="margin-bottom:16px">
        <div style="font-family:'Cinzel',serif;font-size:19px;font-weight:700;color:var(--violet)">🎬 Topic Reel</div>
        <div style="font-size:12px;color:var(--textm);margin-top:4px">Turn a topic into a narrated, stylized explainer video. Writes a script, generates real narration and a clip per beat, then sends everything to Video Editor to arrange.</div>
      </div>
      ${missing.length?`<div style="background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--textm);margin-bottom:14px">⚠️ Add ${missing.join(", ")} in Settings to generate.</div>`:''}

      <div class="f-group">
        <label class="f-label">What should the video explain?</label>
        <textarea class="f-textarea" id="trTopic" placeholder="e.g. Why the sky is blue, How compound interest works, The history of sushi..."></textarea>
      </div>

      <div class="f-group">
        <label class="f-label">Visual Style</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" id="trStyleGrid">
          ${TOPIC_REEL_STYLES.map((s,i)=>`<button type="button" class="card tr-style-btn ${i===0?'active':''}" data-id="${s.id}" onclick="selectTrStyle('${s.id}')" style="padding:10px 6px;text-align:center;cursor:pointer;font-size:10.5px;font-weight:700;border:1.5px solid ${i===0?'var(--violet)':'var(--glass-brd)'}">${s.label}</button>`).join('')}
        </div>
      </div>

      <div class="f-group">
        <label class="f-label">Voice</label>
        <select id="trVoice" style="display:none"></select>
        <button type="button" class="btn btn-outline btn-sm" id="trVoiceTrigger" style="width:100%;text-align:left" onclick="openVoicePicker('trVoice','trVoiceTrigger')">🎙 Choose a voice…</button>
      </div>

      <div style="display:flex;gap:10px">
        <div class="f-group" style="flex:1">
          <label class="f-label">Aspect Ratio</label>
          <select class="f-select" id="trRatio">
            <option value="9:16">9:16 — Vertical / Shorts</option>
            <option value="16:9">16:9 — Landscape</option>
            <option value="1:1">1:1 — Square</option>
          </select>
        </div>
        <div class="f-group" style="flex:1">
          <label class="f-label">Duration</label>
          <select class="f-select" id="trDuration" onchange="updateTrCostHint()">
            ${TOPIC_REEL_DURATIONS.map(d=>`<option value="${d.value}">${d.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="f-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="trSubtitles" checked>
          <span class="f-label" style="margin:0">Generate .srt subtitle file</span>
        </label>
        <div style="font-size:10px;color:var(--textm);margin-top:2px">No burn-in yet — downloads a real, correctly-timed .srt you can load in Video Editor or any editor.</div>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-top:8px" id="trGenBtn" onclick="startTopicReel()" ${missing.length||S.trRunning?'disabled':''}>${S.trRunning?'⏳ Generating…':'🎬 Generate'}</button>
      <div id="trCostHint" style="font-size:11px;color:var(--gold);margin-top:6px;text-align:center"></div>

      <div id="trBeatsWrap" style="margin-top:20px;display:flex;flex-direction:column;gap:12px"></div>
    </div>`;
  S.trSelectedStyle=S.trSelectedStyle||TOPIC_REEL_STYLES[0].id;
  renderVoicePickerTrigger("trVoice","trVoiceTrigger");
  renderTrBeats();
  updateTrCostHint();
}

function selectTrStyle(id){
  S.trSelectedStyle=id;
  document.querySelectorAll(".tr-style-btn").forEach(b=>{
    const on=b.dataset.id===id;
    b.classList.toggle("active",on);
    b.style.borderColor=on?"var(--violet)":"var(--glass-brd)";
  });
}

function updateTrCostHint(){
  const target=parseInt(document.getElementById("trDuration")?.value,10)||60;
  const estBeats=Math.max(1,Math.round(target/6));
  const est=estimateVideoCost("bytedance/seedance-2.0/fast/text-to-video",target,"720p",false);
  const hint=document.getElementById("trCostHint");
  if(hint)hint.textContent=est?`~${estBeats} beats · ${formatCostLine(est)} in clips, plus ElevenLabs narration cost`:"";
}

function renderTrBeats(){
  const wrap=document.getElementById("trBeatsWrap");
  if(!wrap)return;
  if(!S.trBeats.length){wrap.innerHTML="";return;}
  wrap.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:12px;font-weight:700;color:var(--violet)">Beats (${S.trBeats.filter(b=>b.status==="done").length}/${S.trBeats.length})</div>
      ${S.trBeats.every(b=>b.status==="done")?`<button class="btn btn-outline btn-sm" onclick="sendReelToEditor()">🎞 Send all to Video Editor</button>`:''}
    </div>
    ${S.trBeats.map((b,i)=>`<div class="panel" style="padding:10px">
      <div style="font-size:11px;color:var(--textm);margin-bottom:6px">Beat ${i+1}${b.status==="error"?' — <span style="color:var(--red)">failed</span>':''}</div>
      <div style="font-size:12px;margin-bottom:8px">${escapeHtml(b.narration)}</div>
      ${b.status==="pending"?`<div style="font-size:11px;color:var(--textm)">⏳ ${b.stage||'Waiting…'}</div>`:''}
      ${b.status==="error"?`<div style="font-size:11px;color:var(--red);margin-bottom:6px">${escapeHtml(b.error||'Something went wrong')}</div><button class="btn btn-outline btn-sm" onclick="retryTrBeat(${i})">↻ Retry this beat</button>`:''}
      ${b.audioUrl?`<audio src="${b.audioUrl}" controls style="width:100%;margin-bottom:6px;height:32px"></audio>`:''}
      ${b.videoUrl?`<video src="${b.videoUrl}" controls style="width:100%;border-radius:8px;display:block"></video>`:''}
    </div>`).join('')}
    ${S.trBeats.every(b=>b.status==="done")&&document.getElementById("trSubtitles")?.checked?`<button class="btn btn-outline btn-sm" onclick="downloadTrSrt()">⬇ Download .srt</button>`:''}
  `;
}

// ── SCRIPT GENERATION — parses strict JSON out of whatever brain model is
// configured (callAiSimple, already wired app-wide). Scene/beat count is
// left to the model ("auto"), per the explicit scope decision — only the
// target total duration is fixed. ──
async function generateTopicReelScript(topic,targetSeconds,styleLabel){
  const systemPrompt=`You are a scriptwriter for short narrated explainer videos. Return ONLY valid JSON, no markdown fences, no commentary, in this exact shape: {"beats":[{"narration":"...","visual":"..."}]}.
Rules:
- Choose however many beats feels natural for this topic and duration — don't force a fixed count.
- Each beat's narration should take roughly 3-8 seconds to speak aloud at a natural pace (~2.3 words/second), and all beats' narration together should total approximately the target duration.
- "visual" is a vivid, concrete visual description for an AI video generator (concrete subject, action, setting) — not vague or abstract.
- Narration should be conversational and clear, for a general audience.
- Narration must be ONLY the spoken words — no scene numbers, labels, or stage directions.`;
  const userPrompt=`Topic: ${topic}\nTarget total duration: ${targetSeconds} seconds\nVisual style to keep in mind for every "visual" field: ${styleLabel}`;
  const raw=await callAiSimple(userPrompt,systemPrompt);
  const cleaned=raw.replace(/```json|```/g,"").trim();
  let parsed;
  try{parsed=JSON.parse(cleaned);}catch(e){throw new Error("The script model didn't return valid JSON — try again");}
  if(!parsed.beats||!Array.isArray(parsed.beats)||!parsed.beats.length)throw new Error("The script model returned no beats — try again");
  return parsed.beats;
}

// ── NARRATION — direct ElevenLabs call, self-contained (not reusing
// audio.js's generateAudio, which is wired to Audio module's own DOM). ──
async function synthesizeTrNarration(text,voiceId){
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey)throw new Error("Add an ElevenLabs API key in Settings first");
  const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,{
    method:"POST",
    headers:{"Content-Type":"application/json","xi-api-key":apiKey,"Accept":"audio/mpeg"},
    body:JSON.stringify({text,model_id:"eleven_multilingual_v2",voice_settings:{stability:0.5,similarity_boost:0.75}})
  });
  if(!response.ok){
    let errMsg=response.statusText;
    try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
    throw new Error(errMsg);
  }
  const blob=await response.blob();
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(blob);
  });
  logCost("elevenlabs_tts",text.slice(0,60));
  return dataUrl;
}

function measureAudioDuration(dataUrl){
  return new Promise(resolve=>{
    const a=new Audio();
    a.preload="metadata";
    a.onloadedmetadata=()=>resolve(isFinite(a.duration)?a.duration:6);
    a.onerror=()=>resolve(6);
    a.src=dataUrl;
  });
}

async function startTopicReel(){
  const topic=document.getElementById("trTopic")?.value.trim();
  if(!topic){toast("Describe what the video should explain first","error");return;}
  const voiceId=document.getElementById("trVoice")?.value;
  if(!voiceId){toast("Choose a voice first","error");return;}
  if(!gs("api_falai")){toast("Add a fal.ai API key in Settings first","error");return;}
  const target=parseInt(document.getElementById("trDuration")?.value,10)||60;
  const style=TOPIC_REEL_STYLES.find(s=>s.id===S.trSelectedStyle)||TOPIC_REEL_STYLES[0];
  const ratio=document.getElementById("trRatio")?.value||"9:16";

  const estBeats=Math.max(1,Math.round(target/6));
  if(estBeats>8){
    const ok=await showConfirmDialog(`This will generate roughly ${estBeats} narrated clips (~${Math.round(target/60)} min of footage). Each clip is a separate paid generation and this can take a while sequentially. Continue?`,{okLabel:"Generate"});
    if(!ok)return;
  }

  S.trRunning=true;S.trBeats=[];
  document.getElementById("trGenBtn").disabled=true;
  document.getElementById("trGenBtn").textContent="⏳ Generating…";
  toast("Writing script…","");
  try{
    const scriptBeats=await generateTopicReelScript(topic,target,style.label);
    S.trBeats=scriptBeats.map(b=>({narration:b.narration,visual:b.visual,status:"pending",stage:"Waiting…"}));
    renderTrBeats();
    for(let i=0;i<S.trBeats.length;i++){
      await runTrBeat(i,voiceId,style,ratio);
    }
    toast("✨ Topic Reel ready — review beats below","success");
  }catch(err){
    toast("❌ "+err.message,"error");
  }finally{
    S.trRunning=false;
    document.getElementById("trGenBtn").disabled=false;
    document.getElementById("trGenBtn").textContent="🎬 Generate";
  }
}

async function runTrBeat(i,voiceId,style,ratio){
  const beat=S.trBeats[i];
  try{
    beat.stage="Narrating…";renderTrBeats();
    const audioUrl=await synthesizeTrNarration(beat.narration,voiceId);
    const audioAsset=createAudioAsset(audioUrl,beat.narration);
    const audioDur=await measureAudioDuration(audioUrl);
    beat.audioUrl=audioUrl;beat.audioAssetId=audioAsset.id;beat.audioDur=audioDur;
    beat.stage="Generating visual…";renderTrBeats();
    const clipDur=snapToSeedanceDuration(audioDur);
    const videoUrl=await genViaSeedanceReference(`${beat.visual}, ${style.frag}`,"bytedance/seedance-2.0/fast/text-to-video",ratio,clipDur,[],[],[]);
    const videoAsset=createVideoAsset(videoUrl,beat.visual,"",{model:"bytedance/seedance-2.0/fast/text-to-video",providerLabel:"Topic Reel — "+style.label});
    beat.videoUrl=videoUrl;beat.videoAssetId=videoAsset.id;
    logCost("bytedance/seedance-2.0/fast/text-to-video","Topic Reel beat "+(i+1));
    beat.status="done";
  }catch(err){
    beat.status="error";beat.error=err.message;
  }
  renderTrBeats();
}

async function retryTrBeat(i){
  const voiceId=document.getElementById("trVoice")?.value;
  const style=TOPIC_REEL_STYLES.find(s=>s.id===S.trSelectedStyle)||TOPIC_REEL_STYLES[0];
  const ratio=document.getElementById("trRatio")?.value||"9:16";
  S.trBeats[i].status="pending";S.trBeats[i].error=null;
  renderTrBeats();
  await runTrBeat(i,voiceId,style,ratio);
}

function sendReelToEditor(){
  S.trBeats.forEach(b=>{
    if(b.audioAssetId)addToSequence(b.audioAssetId);
    if(b.videoAssetId)addToSequence(b.videoAssetId);
  });
  S.trHistory.push({topic:document.getElementById("trTopic")?.value.trim(),style:S.trSelectedStyle,createdAt:new Date().toISOString(),beatCount:S.trBeats.length});
  saveSetting("tr_history",S.trHistory);
  toast("🎞 Sent to Video Editor — open it to arrange the sequence","success");
}

function srtTimestamp(totalSeconds){
  const h=Math.floor(totalSeconds/3600),m=Math.floor((totalSeconds%3600)/60),s=Math.floor(totalSeconds%60),ms=Math.round((totalSeconds-Math.floor(totalSeconds))*1000);
  const pad=(n,len=2)=>String(n).padStart(len,"0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms,3)}`;
}

function downloadTrSrt(){
  let cursor=0,lines=[];
  S.trBeats.forEach((b,i)=>{
    const dur=b.audioDur||6;
    lines.push(`${i+1}\n${srtTimestamp(cursor)} --> ${srtTimestamp(cursor+dur)}\n${b.narration}\n`);
    cursor+=dur;
  });
  const blob=new Blob([lines.join("\n")],{type:"text/plain"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="TopicReel_subtitles.srt";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

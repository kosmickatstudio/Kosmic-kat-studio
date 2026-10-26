// ══════════════════════════════════════════════════════════════════════
// AUDIO STUDIO — ElevenLabs extras. Loads AFTER audio.js and registers more
// sub-modules into its hub (AU_MODULES / AU_GROUPS are shared top-level
// bindings of audio.js):
//   Voice Library   — browse ElevenLabs' shared library, add voices to your account
//   Speech to Text  — Scribe transcription, speakers, SRT/TXT export
//   Music Pro       — ElevenLabs Music (prompt → song, up to 10 min)
//   SFX Pro         — ElevenLabs sound effects (loop, prompt influence)
//   Subtitle Align  — forced alignment: your text + audio → word timings / SRT
// Premium lock: a voice the current plan can't use is marked 🔒 with the plan
// it needs (see elVoiceLock in audio.js).
// ══════════════════════════════════════════════════════════════════════
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const key=()=>gs("api_elevenlabs","");
const EL="https://api.elevenlabs.io";

function errMsg(d,r){
  const det=d&&d.detail;
  const m=(det&&(det.message||(Array.isArray(det)?(det[0]&&det[0].msg):(typeof det==="string"?det:JSON.stringify(det)))))||(d&&d.message)||(r&&r.statusText)||"Request failed";
  if(r&&(r.status===401))return"ElevenLabs rejected the API key — check it in Settings";
  if(r&&r.status===402)return"This needs a paid ElevenLabs plan — "+m;
  return String(m);
}
function blobToDataUrl(b){return new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b)})}
async function showAudioResult(blob,label,box,filename,costKey){
  const url=URL.createObjectURL(blob);
  const data=await blobToDataUrl(blob);
  const a=createAudioAsset(data,label);
  box.innerHTML=`<audio src="${url}" controls style="width:100%;margin-bottom:8px"></audio>
    <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><a href="${url}" download="${filename}" class="btn btn-outline btn-sm">⬇ Download</a>
    <button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${a.id}')">📁 Add to Collection</button></div>`;
  try{logCost(costKey||"elevenlabs_audio",label.slice(0,60))}catch(_){}
}
const wait=(box,txt)=>{box.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${txt}</div>`};
const fail=(box,e)=>{box.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px;background:rgba(239,68,68,.08);border-radius:10px">❌ ${esc(e.message||e)}</div>`;toast("❌ "+(e.message||e),"error")};
const fileLabel=(id,f)=>{const l=$(id);if(l)l.textContent=f?"✓ "+f.name:""};
const keyBtn=(ok,label)=>ok?label:"🔑 Add API Key First";

/* ───────────── subtitle helpers ───────────── */
function tcSrt(t){const ms=Math.max(0,Math.round(t*1000));const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;const p=(n,l)=>String(n).padStart(l||2,"0");return`${p(h)}:${p(m)}:${p(s)},${p(x,3)}`}
function wordsToSrt(words){
  // words: [{text,start,end,speaker?}] — group into readable cues
  const cues=[];let cur=null;
  const flush=()=>{if(cur&&cur.text.trim())cues.push(cur);cur=null};
  words.forEach(w=>{
    if(!w.text||!w.text.trim())return;
    if(cur&&((w.end-cur.start)>6||cur.n>=9||(w.speaker&&cur.speaker&&w.speaker!==cur.speaker)))flush();
    if(!cur)cur={start:w.start,end:w.end,text:"",n:0,speaker:w.speaker};
    cur.text+=(cur.text?" ":"")+w.text.trim();cur.end=w.end;cur.n++;
    if(/[.!?]$/.test(w.text.trim())&&cur.n>=3)flush();
  });
  flush();
  return cues.map((c,i)=>`${i+1}\n${tcSrt(c.start)} --> ${tcSrt(c.end)}\n${c.text}\n`).join("\n");
}
function download(name,text,type){const b=new Blob([text],{type:type||"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}

/* ───────────── Voice Library (shared voices) ───────────── */
const VL=window.AUP_VL={items:[],page:0,more:false,loading:false,q:"",gender:"",age:"",cat:"",featured:false,lang:""};
function vlSeg(field,opts){return`<div class="ks-seg">${opts.map(o=>`<button type="button" class="${VL[field]===o[0]?"on":""}" onclick="aupVlSet('${field}','${o[0]}')">${o[1]}</button>`).join("")}</div>`}
function build_voicelib(){
  return `<div class="ks-card"><div class="ks-lab"><span>Search the ElevenLabs voice library</span></div>
    <div style="display:flex;gap:8px"><input class="f-input" id="vlSearch" placeholder="e.g. deep narrator, british, villain" value="${esc(VL.q)}" style="flex:1" onkeydown="if(event.key==='Enter')aupVlSearch()"><button class="ks-btn sm" onclick="aupVlSearch()">Search</button></div>
    <div class="ks-lab" style="margin-top:10px"><span>Gender</span></div>${vlSeg("gender",[["","Any"],["male","Male"],["female","Female"]])}
    <div class="ks-lab" style="margin-top:6px"><span>Age</span></div>${vlSeg("age",[["","Any"],["young","Young"],["middle_aged","Middle"],["old","Older"]])}
    <div class="ks-lab" style="margin-top:6px"><span>Collection</span></div>${vlSeg("cat",[["","All"],["professional","Professional"],["high_quality","High quality"],["famous","Famous"]])}
    <div class="up-tg" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 0"><span style="font-size:12.5px;font-weight:700">Featured only</span><input type="checkbox" ${VL.featured?"checked":""} onchange="aupVlSet('featured',this.checked)"></div>
    <div class="ks-hint" id="vlPlan"></div></div>
    <div id="vlList"></div><div id="vlMore" style="text-align:center;margin:10px 0"></div>`;
}
function vlPlanHint(){
  const el=$("vlPlan");if(!el)return;const sub=S.elSub;
  el.innerHTML=sub&&sub.tier?`Your plan: <b>${elTierName(sub.tier)}</b>. 🔒 marks library voices that need a higher plan${elTierRank(sub.tier)===0?" — free accounts can't use most library voices through the API":""}.`:"Connect your ElevenLabs key to see which voices your plan can use.";
}
function vlLocked(v){const sub=S.elSub;return !!(sub&&elTierRank(sub.tier)===0&&v.free_users_allowed===false)}
function vlRender(){
  const list=$("vlList");if(!list)return;
  if(!VL.items.length&&!VL.loading){list.innerHTML=`<div class="au-empty">No voices matched. Try a broader search.</div>`}
  else list.innerHTML=VL.items.map((v,i)=>{
    const lock=vlLocked(v);
    const tags=[v.gender,v.age,v.accent,v.use_case||v.descriptive].filter(Boolean).map(t=>`<span class="up-pill" style="font-size:10px;padding:3px 8px">${esc(String(t).replace(/_/g," "))}</span>`).join("");
    return `<div class="ks-card" style="${lock?"opacity:.7":""}"><div style="display:flex;gap:10px;align-items:flex-start">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--vs),var(--violet));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:0 0 auto">${esc(voiceMonogram(v.name))}</div>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800">${esc(v.name)}${lock?` <span style="font-size:9.5px;color:var(--gold,#9a6b00);background:var(--gold-p,rgba(212,160,23,.16));padding:2px 7px;border-radius:99px">🔒 Starter+</span>`:""}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin:4px 0">${tags}</div>
      ${v.description?`<div style="font-size:11px;color:var(--textm);line-height:1.4">${esc(String(v.description).slice(0,140))}</div>`:""}</div></div>
      <div class="ks-row" style="margin-top:10px">${v.preview_url?`<button class="ks-btn" onclick="auPreviewVoice('${esc(v.preview_url)}')">▶ Preview</button>`:""}<button class="ks-btn" onclick="aupVlAdd(${i})">${lock?"🔒 Needs paid plan":"＋ Add to my voices"}</button></div></div>`;
  }).join("");
  const more=$("vlMore");if(more)more.innerHTML=VL.loading?`<span class="up-dot" style="display:inline-block"></span>`:(VL.more?`<button class="ks-btn" onclick="aupVlLoad(false)">Load more</button>`:"");
}
async function vlLoad(reset){
  if(!key()){const l=$("vlList");if(l)l.innerHTML=`<div class="au-empty">Add an ElevenLabs API key in Settings to browse the library.</div>`;return}
  if(VL.loading)return;
  if(reset){VL.items=[];VL.page=0;VL.more=false}
  VL.loading=true;vlRender();
  try{
    await fetchElevenLabsSub();vlPlanHint();
    const q=new URLSearchParams({page_size:"24",page:String(VL.page)});
    if(VL.q)q.set("search",VL.q);if(VL.gender)q.set("gender",VL.gender);if(VL.age)q.set("age",VL.age);
    if(VL.cat)q.set("category",VL.cat);if(VL.featured)q.set("featured","true");
    const r=await fetch(`${EL}/v1/shared-voices?${q}`,{headers:{"xi-api-key":key()}});
    const d=await r.json();if(!r.ok)throw new Error(errMsg(d,r));
    VL.items=VL.items.concat(d.voices||[]);VL.more=!!d.has_more;VL.page++;
  }catch(e){toast("❌ "+e.message,"error");const l=$("vlList");if(l&&!VL.items.length)l.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${esc(e.message)}</div>`}
  VL.loading=false;vlRender();
}
async function vlAdd(i){
  const v=VL.items[i];if(!v)return;
  if(vlLocked(v)){toast(`🔒 "${v.name}" needs the Starter plan or higher on ElevenLabs`,"error");return}
  try{
    const r=await fetch(`${EL}/v1/voices/add/${encodeURIComponent(v.public_owner_id)}/${encodeURIComponent(v.voice_id)}`,{method:"POST",headers:{"xi-api-key":key(),"Content-Type":"application/json"},body:JSON.stringify({new_name:v.name})});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errMsg(d,r));
    S.elevenLabsVoicesCache=null; // next picker open re-reads the account list
    toast(`✅ "${v.name}" added — it's in every voice picker now`,"success");
  }catch(e){toast("❌ "+e.message,"error")}
}
window.aupVlSet=(f,v)=>{VL[f]=v;if(f==="featured"||["gender","age","cat"].includes(f)){const body=$("auBody");if(body){body.innerHTML=build_voicelib();vlPlanHint()}vlLoad(true)}};
window.aupVlSearch=()=>{VL.q=($("vlSearch")||{}).value||"";vlLoad(true)};
window.aupVlLoad=r=>vlLoad(!!r);window.aupVlAdd=vlAdd;

/* ───────────── Speech to Text (Scribe) ───────────── */
const STT={file:null,words:[],text:""};
function build_stt(c){
  return `<div class="panel"><div class="f-group"><label class="f-label">Audio or video file</label>
    <input type="file" accept="audio/*,video/*" id="sttFile" style="display:none" onchange="aupSttFile(event)">
    <button class="btn btn-outline btn-sm" onclick="document.getElementById('sttFile').click()">📤 Choose file</button><span id="sttFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span></div>
    <div class="f-row"><div class="f-group"><label class="f-label">Language</label><select class="f-select" id="sttLang"><option value="">Auto-detect</option><option value="eng">English</option><option value="hin">Hindi</option><option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="por">Portuguese</option><option value="ita">Italian</option><option value="jpn">Japanese</option><option value="kor">Korean</option><option value="ara">Arabic</option><option value="rus">Russian</option><option value="tur">Turkish</option></select></div>
    <div class="f-group"><label class="f-label">Speakers (optional)</label><input class="f-input" id="sttSpk" type="number" min="1" max="32" placeholder="auto"></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:8px"><input type="checkbox" id="sttDiar" checked> Identify who is speaking</label>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:12px"><input type="checkbox" id="sttEvents" checked> Tag sounds like (laughter)</label>
    <button class="btn btn-primary btn-full" id="sttBtn" ${c.hasKey?"":"disabled"} onclick="aupSttRun()">${keyBtn(c.hasKey,"📝 Transcribe")}</button>
    <div id="sttResult" style="margin-top:12px"></div></div>`;
}
async function sttRun(){
  if(!STT.file){toast("Choose a file first","error");return}
  const box=$("sttResult"),btn=$("sttBtn");btn.disabled=true;wait(box,"📝 Transcribing — longer files take a minute…");
  const go=async model=>{
    const f=new FormData();f.append("model_id",model);f.append("file",STT.file);
    f.append("diarize",$("sttDiar").checked?"true":"false");f.append("tag_audio_events",$("sttEvents").checked?"true":"false");f.append("timestamps_granularity","word");
    const lang=$("sttLang").value;if(lang)f.append("language_code",lang);
    const n=$("sttSpk").value;if(n&&$("sttDiar").checked)f.append("num_speakers",n);
    const r=await fetch(`${EL}/v1/speech-to-text`,{method:"POST",headers:{"xi-api-key":key()},body:f});
    const d=await r.json().catch(()=>({}));return{r,d};
  };
  try{
    let {r,d}=await go("scribe_v2");
    if(!r.ok&&r.status===422)({r,d}=await go("scribe_v1"));
    if(!r.ok)throw new Error(errMsg(d,r));
    STT.text=d.text||"";
    STT.words=(d.words||[]).filter(w=>w.type!=="spacing").map(w=>({text:w.text,start:w.start,end:w.end,speaker:w.speaker_id,type:w.type}));
    // group by speaker for display
    const turns=[];STT.words.forEach(w=>{const last=turns[turns.length-1];if(last&&last.speaker===w.speaker)last.text+=" "+w.text;else turns.push({speaker:w.speaker,start:w.start,text:w.text})});
    const multi=new Set(STT.words.map(w=>w.speaker).filter(Boolean)).size>1;
    box.innerHTML=`<div class="ks-lab"><span>Transcript</span><small>${esc(d.language_code||"")}${d.language_probability?` · ${Math.round(d.language_probability*100)}%`:""}</small></div>
      <div style="background:rgba(98,64,176,.06);border-radius:14px;padding:12px;font-size:13px;line-height:1.55;max-height:360px;overflow:auto;white-space:pre-wrap">${multi?turns.map(t=>`<b style="color:var(--violet)">${esc((t.speaker||"speaker").replace(/_/g," "))}</b>  <span style="color:var(--texts);font-size:10.5px">${tcSrt(t.start).slice(0,8)}</span>\n${esc(t.text)}`).join("\n\n"):esc(STT.text)}</div>
      <div class="ks-row" style="margin-top:10px"><button class="ks-btn" onclick="navigator.clipboard&&navigator.clipboard.writeText(AUP_STT.text).then(()=>toast('Copied','success'))">Copy</button><button class="ks-btn" onclick="aupSttDl('txt')">⬇ .txt</button><button class="ks-btn" onclick="aupSttDl('srt')">⬇ .srt</button></div>`;
    try{logCost("elevenlabs_stt",STT.file.name.slice(0,40))}catch(_){}
  }catch(e){fail(box,e)}
  btn.disabled=false;
}
window.AUP_STT=STT;
window.aupSttFile=e=>{STT.file=e.target.files[0]||null;fileLabel("sttFileLabel",STT.file)};
window.aupSttRun=sttRun;
window.aupSttDl=t=>{if(t==="srt")download("transcript.srt",wordsToSrt(STT.words.filter(w=>w.type!=="audio_event"||true)));else download("transcript.txt",STT.text)};

/* ───────────── Music Pro ───────────── */
function build_emusic(c){
  return `<div class="panel"><div class="f-group"><label class="f-label">Describe the track</label>
    <textarea class="f-textarea" id="emPrompt" style="min-height:90px" maxlength="4100" placeholder="e.g. Epic orchestral trailer music, rising strings, taiko drums, big brass hit at 0:40"></textarea></div>
    ${auRangeHTML("emLen","Length (seconds)",10,300,5,60,"Up to 10 minutes via the API; 5 min max here to keep requests quick")}
    <div class="f-row"><div class="f-group"><label class="f-label">Model</label><select class="f-select" id="emModel"><option value="music_v2_5">Music v2.5 (newest)</option><option value="music_v2">Music v2</option><option value="music_v1">Music v1</option></select></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:12px"><input type="checkbox" id="emInst"> Instrumental only (no vocals)</label>
    <button class="btn btn-primary btn-full" id="emBtn" ${c.hasKey?"":"disabled"} onclick="aupMusicRun()">${keyBtn(c.hasKey,"🎼 Compose with ElevenLabs")}</button>
    <div id="emResult" style="margin-top:12px"></div></div>`;
}
async function musicRun(){
  const prompt=$("emPrompt").value.trim();if(!prompt){toast("Describe the music first","error");return}
  const box=$("emResult"),btn=$("emBtn");btn.disabled=true;wait(box,"🎼 Composing… this can take a minute");
  try{
    const body={prompt,music_length_ms:Math.round(parseFloat($("emLen").value)*1000),model_id:$("emModel").value,force_instrumental:$("emInst").checked};
    const r=await fetch(`${EL}/v1/music`,{method:"POST",headers:{"xi-api-key":key(),"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(errMsg(d,r))}
    await showAudioResult(await r.blob(),"Music: "+prompt.slice(0,70),box,"elevenlabs_music.mp3","elevenlabs_music");
    toast("🎼 Track ready — saved to Gallery","success");
  }catch(e){fail(box,e)}
  btn.disabled=false;
}
window.aupMusicRun=musicRun;

/* ───────────── SFX Pro ───────────── */
function build_esfx(c){
  return `<div class="panel"><div class="f-group"><label class="f-label">Describe the sound</label>
    <input class="f-input" id="esPrompt" placeholder="e.g. heavy wooden door creaking open in an empty stone hall" maxlength="450"></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:8px"><input type="checkbox" id="esAuto" checked onchange="document.getElementById('esDurWrap').style.display=this.checked?'none':'block'"> Let ElevenLabs pick the length</label>
    <div id="esDurWrap" style="display:none">${auRangeHTML("esDur","Length (seconds)",0.5,30,0.5,5,"")}</div>
    ${auRangeHTML("esInf","Prompt influence",0,1,0.05,0.3,"Higher follows your words more closely, lower is more varied")}
    <div class="f-row"><div class="f-group"><label class="f-label">Model</label><select class="f-select" id="esModel"><option value="eleven_text_to_sound_v3">Sound Effects v3 (newest)</option><option value="eleven_text_to_sound_v2">Sound Effects v2</option></select></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:12px"><input type="checkbox" id="esLoop"> Make it loop seamlessly</label>
    <button class="btn btn-primary btn-full" id="esBtn" ${c.hasKey?"":"disabled"} onclick="aupSfxRun()">${keyBtn(c.hasKey,"💥 Generate sound effect")}</button>
    <div id="esResult" style="margin-top:12px"></div></div>`;
}
async function sfxRun(){
  const text=$("esPrompt").value.trim();if(!text){toast("Describe the sound first","error");return}
  const box=$("esResult"),btn=$("esBtn");btn.disabled=true;wait(box,"💥 Generating…");
  try{
    const body={text,prompt_influence:parseFloat($("esInf").value),loop:$("esLoop").checked,model_id:$("esModel").value};
    if(!$("esAuto").checked)body.duration_seconds=parseFloat($("esDur").value);
    const r=await fetch(`${EL}/v1/sound-generation`,{method:"POST",headers:{"xi-api-key":key(),"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(errMsg(d,r))}
    await showAudioResult(await r.blob(),"SFX: "+text.slice(0,70),box,"elevenlabs_sfx.mp3","elevenlabs_sfx");
    toast("💥 Sound effect ready — saved to Gallery","success");
  }catch(e){fail(box,e)}
  btn.disabled=false;
}
window.aupSfxRun=sfxRun;

/* ───────────── Subtitle Align (forced alignment) ───────────── */
const AL={file:null,words:[]};
function build_align(c){
  return `<div class="panel"><div class="ks-hint" style="margin-top:0">You already have the script — this finds exactly when each word is spoken, so you can export subtitles.</div>
    <div class="f-group"><label class="f-label">Audio or video file</label>
    <input type="file" accept="audio/*,video/*" id="alFile" style="display:none" onchange="aupAlFile(event)">
    <button class="btn btn-outline btn-sm" onclick="document.getElementById('alFile').click()">📤 Choose file</button><span id="alFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span></div>
    <div class="f-group"><label class="f-label">Script (what is said)</label><textarea class="f-textarea" id="alText" style="min-height:110px" placeholder="Paste the exact words spoken in the file…"></textarea></div>
    <button class="btn btn-primary btn-full" id="alBtn" ${c.hasKey?"":"disabled"} onclick="aupAlRun()">${keyBtn(c.hasKey,"⏱ Align to audio")}</button>
    <div id="alResult" style="margin-top:12px"></div></div>`;
}
async function alignRun(){
  const text=$("alText").value.trim();
  if(!AL.file){toast("Choose a file first","error");return}
  if(!text){toast("Paste the script first","error");return}
  const box=$("alResult"),btn=$("alBtn");btn.disabled=true;wait(box,"⏱ Aligning…");
  try{
    const f=new FormData();f.append("file",AL.file);f.append("text",text);
    const r=await fetch(`${EL}/v1/forced-alignment`,{method:"POST",headers:{"xi-api-key":key()},body:f});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errMsg(d,r));
    AL.words=(d.words||[]).map(w=>({text:w.text,start:w.start,end:w.end}));
    const conf=d.loss!=null?Math.max(0,Math.round((1-Math.min(1,d.loss))*100)):null;
    box.innerHTML=`<div class="ks-lab"><span>${AL.words.length} words aligned</span>${conf!=null?`<small>match ${conf}%</small>`:""}</div>
      <div style="background:rgba(98,64,176,.06);border-radius:14px;padding:12px;font-size:12px;line-height:1.7;max-height:300px;overflow:auto">${AL.words.map(w=>`<span title="${tcSrt(w.start)} → ${tcSrt(w.end)}">${esc(w.text)}</span>`).join(" ")}</div>
      <div class="ks-row" style="margin-top:10px"><button class="ks-btn" onclick="aupAlDl()">⬇ Subtitles (.srt)</button></div>`;
    try{logCost("elevenlabs_align",AL.file.name.slice(0,40))}catch(_){}
  }catch(e){fail(box,e)}
  btn.disabled=false;
}
window.aupAlFile=e=>{AL.file=e.target.files[0]||null;fileLabel("alFileLabel",AL.file)};
window.aupAlRun=alignRun;window.aupAlDl=()=>download("subtitles.srt",wordsToSrt(AL.words));

/* ───────────── register into the hub ───────────── */
if(typeof AU_MODULES!=="undefined"&&typeof AU_GROUPS!=="undefined"){
  const add=(m,afterId)=>{
    AU_MODULES.push(m);AU_BY_ID[m.id]=m;
  };
  add({id:"voicelib",g:"Voice",icon:"📚",name:"Voice Library",tag:"Browse thousands of voices",key:"el",anchors:["audioVoiceLibAnchor"],build:build_voicelib,after:()=>{vlPlanHint();if(!VL.items.length)vlLoad(true);else vlRender()}});
  add({id:"emusic",g:"Create",icon:"🎹",name:"Music Pro",tag:"ElevenLabs Music · up to 5 min",key:"el",anchors:["audioMusicProAnchor"],build:build_emusic});
  add({id:"esfx",g:"Create",icon:"🔊",name:"SFX Pro",tag:"Loops & prompt control",key:"el",anchors:["audioSfxProAnchor"],build:build_esfx});
  add({id:"stt",g:"Transcribe",icon:"📝",name:"Speech to Text",tag:"Transcript + speakers + SRT",key:"el",anchors:["audioSttAnchor"],build:build_stt});
  add({id:"align",g:"Transcribe",icon:"⏱",name:"Subtitle Align",tag:"Script + audio → timings",key:"el",anchors:["audioAlignAnchor"],build:build_align});
  if(!AU_GROUPS.includes("Transcribe"))AU_GROUPS.splice(AU_GROUPS.indexOf("Library"),0,"Transcribe");
}
})();

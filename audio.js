// ══════════════════════════════════════════════════════════════════════
// AUDIO TOOLS MODULE — extracted from the main index.html script as the
// first proof-of-concept split (per the architecture review). Plain global
// script, not an ES module — no import/export, everything here still runs
// on the same window global scope as before, calling and being called by
// the rest of the app exactly as it did when it lived inline.
//
// LOAD ORDER MATTERS: this file references S, gs(), save(), toast(),
// pIcon(), logCost(), createImageAsset(), openCollectionPicker(), fbStorage,
// and other core pieces defined in the main index.html script — it MUST be
// loaded via a <script> tag placed AFTER index.html's main inline script,
// not before. Several lines below run immediately at parse time (S.x=S.x||...
// patterns) and would throw if S doesn't exist yet.
// ══════════════════════════════════════════════════════════════════════

// ── REAL ELEVENLABS VOICE LIBRARY — was hardcoded to 6 premade voices in a
// plain <select>, when the account actually has access to every premade,
// cloned, and designed voice via GET /v1/voices (confirmed against
// ElevenLabs' own docs). Fetched once per session and cached; cloned_voices
// (the local list Voice Cloning/Voice Design write to) stays as an offline
// fallback if the fetch fails or no key is set, so nothing breaks for
// anyone without a key.
S.elevenLabsVoicesCache=S.elevenLabsVoicesCache||null;
async function fetchElevenLabsVoices(force){
  if(S.elevenLabsVoicesCache&&!force)return S.elevenLabsVoicesCache;
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey)return null;
  try{
    const response=await fetch("https://api.elevenlabs.io/v1/voices",{headers:{"xi-api-key":apiKey}});
    const data=await response.json();
    if(!response.ok)throw new Error((data.detail&&(data.detail.message||JSON.stringify(data.detail)))||response.statusText);
    S.elevenLabsVoicesCache=(data.voices||[]).map(v=>({
      id:v.voice_id,name:v.name,
      category:v.category||"premade",
      sub:[v.labels?.gender,v.labels?.accent,v.labels?.age].filter(Boolean).join(", ")
    }));
    return S.elevenLabsVoicesCache;
  }catch(err){
    console.warn("Couldn't fetch ElevenLabs voice library — falling back to the local cloned-voices list:",err.message);
    return null;
  }
}
function voiceMonogram(name){
  return (name||"?").trim().slice(0,2).toUpperCase();
}
// Generic voice-picker sheet — same bottom-sheet chrome as the model/simple
// pickers, with a live search filter since a real account can have far
// more than 6 voices. selectId is the hidden <select> to update (kept for
// every existing call site that reads .value), triggerId is the display
// element.
async function openVoicePicker(selectId,triggerId){
  const overlay=document.createElement("div");
  overlay.id="voicePickerOverlay";
  overlay.style.cssText="position:fixed;inset:0;background:rgba(20,10,40,0.45);z-index:400;display:flex;align-items:flex-end";
  overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
  overlay.innerHTML=`
    <div style="background:var(--surface);width:100%;max-height:80vh;border-radius:20px 20px 0 0;overflow-y:auto;box-shadow:var(--shv)">
      <div style="position:sticky;top:0;background:var(--surface);padding:14px 18px 10px;z-index:2;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--violet);font-size:14px">Choose Voice</div>
          <button onclick="document.getElementById('voicePickerOverlay').remove()" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--lav);color:var(--textm);cursor:pointer">${pIcon('back',12)}</button>
        </div>
        <input class="f-input" id="voicePickerSearch" placeholder="Search voices…" oninput="filterVoicePickerList(this.value)" style="font-size:13px">
      </div>
      <div id="voicePickerList" style="padding:10px 14px 24px">
        <div style="text-align:center;padding:20px;color:var(--textm);font-size:12px">${pIcon('mic',14)} Loading your voice library…</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let voices=await fetchElevenLabsVoices();
  if(!voices){
    // No key / fetch failed — fall back to the small local list so this
    // still works for anyone without an ElevenLabs key configured yet.
    const clonedVoices=gs("cloned_voices",[])||[];
    voices=[
      {id:"21m00Tcm4TlvDq8ikWAM",name:"Rachel",category:"premade",sub:"Female, Calm"},
      {id:"ErXwobaYiN019PkySvjV",name:"Antoni",category:"premade",sub:"Male, Warm"},
      {id:"EXAVITQu4vr4xnSDxMaL",name:"Bella",category:"premade",sub:"Female, Soft"},
      {id:"TxGEqnHWrfWFTfGW9XjX",name:"Josh",category:"premade",sub:"Male, Deep"},
      {id:"pNInz6obpgDQGcFmaJgB",name:"Adam",category:"premade",sub:"Male, Narrator"},
      {id:"jsCqWAovK2LkecY7zXl4",name:"Freya",category:"premade",sub:"Female, Energetic"},
      ...clonedVoices.map(v=>({id:v.id,name:v.name,category:"cloned",sub:""})),
    ];
  }
  S.voicePickerCurrentList=voices;
  S.voicePickerTargets={selectId,triggerId};
  renderVoicePickerList(voices);
}
function renderVoicePickerList(voices){
  const listEl=document.getElementById("voicePickerList");
  if(!listEl)return;
  const groups={premade:[],cloned:[],generated:[]};
  voices.forEach(v=>(groups[v.category]||groups.premade).push(v));
  const groupLabels={premade:"Premade",cloned:"Your Cloned Voices",generated:"Your Designed Voices"};
  const sel=document.getElementById(S.voicePickerTargets.selectId);
  const current=sel?sel.value:"";
  listEl.innerHTML=Object.keys(groups).filter(g=>groups[g].length).map(g=>`
    <div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.4px;margin:12px 4px 6px">${groupLabels[g]}</div>
    ${groups[g].map(v=>{
      const selected=v.id===current;
      return `<div onclick="selectVoiceOption('${v.id.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:12px;cursor:pointer;margin-bottom:4px;border:1.5px solid ${selected?'var(--vs)':'transparent'};background:${selected?'var(--lav)':'transparent'}">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--vs),var(--violet));color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${voiceMonogram(v.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${v.name}</div>
          ${v.sub?`<div style="font-size:10.5px;color:var(--textm)">${v.sub}</div>`:''}
        </div>
        ${selected?`<span style="color:var(--violet)">${pIcon('check',15)}</span>`:''}
      </div>`;
    }).join('')}`).join('')||`<div style="text-align:center;padding:20px;color:var(--textm);font-size:12px">No voices found.</div>`;
}
function filterVoicePickerList(query){
  const q=query.toLowerCase();
  const filtered=(S.voicePickerCurrentList||[]).filter(v=>v.name.toLowerCase().includes(q)||(v.sub||"").toLowerCase().includes(q));
  renderVoicePickerList(filtered);
}
function selectVoiceOption(voiceId){
  const {selectId,triggerId}=S.voicePickerTargets;
  const sel=document.getElementById(selectId);
  if(sel){
    // Voice options are added dynamically since we no longer hand-write a
    // fixed <option> list — ensure one exists before setting .value so
    // every existing call site reading sel.value keeps working unchanged.
    if(![...sel.options].some(o=>o.value===voiceId)){
      const voice=(S.voicePickerCurrentList||[]).find(v=>v.id===voiceId);
      const opt=document.createElement("option");
      opt.value=voiceId;opt.textContent=voice?voice.name:voiceId;
      sel.appendChild(opt);
    }
    sel.value=voiceId;
    sel.dispatchEvent(new Event("change"));
  }
  renderVoicePickerTrigger(selectId,triggerId);
  const overlay=document.getElementById("voicePickerOverlay");
  if(overlay)overlay.remove();
}
function renderVoicePickerTrigger(selectId,triggerId){
  const sel=document.getElementById(selectId);
  const trigger=document.getElementById(triggerId);
  if(!sel||!trigger)return;
  const voice=(S.voicePickerCurrentList||[]).find(v=>v.id===sel.value);
  const name=voice?voice.name:(sel.options[sel.selectedIndex]?.textContent||"Choose a voice…");
  const sub=voice?voice.sub:"";
  trigger.innerHTML=`
    <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--vs),var(--violet));color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${voiceMonogram(name)}</div>
    <div style="flex:1;min-width:0;overflow:hidden"><div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>${sub?`<div style="font-size:10px;color:var(--textm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div>`:''}</div>
    <span style="color:var(--textm);flex-shrink:0">${pIcon('chevron',14)}</span>`;
}

function renderAudio(el){
  const hasKey=gs("api_elevenlabs");
  const clonedVoices=gs("cloned_voices",[])||[];
  el.innerHTML=`
    <div class="panel" id="audioGenerateAnchor">
      <div class="panel-title">🎵 Voiceover ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      ${!hasKey?`<div style="font-size:12px;color:var(--textm);margin-bottom:12px">Add an <b>ElevenLabs</b> API key in Settings to enable real voice generation. Free tier available at <a href="https://elevenlabs.io" target="_blank" style="color:var(--vm)">elevenlabs.io</a>.</div>`:''}
      <div class="f-group">
        <label class="f-label">Text to speak</label>
        <textarea class="f-textarea" id="audioText" placeholder="Enter the line or narration to convert to speech…" style="min-height:80px" maxlength="2000"></textarea>
      </div>
      <div class="f-row">
        <div class="f-group">
          <label class="f-label">Voice</label>
          <select class="f-select" id="audioVoice" onchange="renderVoicePickerTrigger('audioVoice','audioVoiceTrigger')" style="display:none">
            <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
            <option value="ErXwobaYiN019PkySvjV">Antoni</option>
            <option value="EXAVITQu4vr4xnSDxMaL">Bella</option>
            <option value="TxGEqnHWrfWFTfGW9XjX">Josh</option>
            <option value="pNInz6obpgDQGcFmaJgB">Adam</option>
            <option value="jsCqWAovK2LkecY7zXl4">Freya</option>
            ${clonedVoices.map(v=>`<option value="${v.id}">${v.name}</option>`).join('')}
          </select>
          <div id="audioVoiceTrigger" onclick="openVoicePicker('audioVoice','audioVoiceTrigger')" style="display:flex;align-items:center;gap:9px;border:1.5px solid var(--border);border-radius:12px;padding:7px 10px;cursor:pointer;background:var(--surface)"></div>
        </div>
        <div class="f-group">
          <label class="f-label">Model</label>
          <select class="f-select" id="audioModel" onchange="renderSimpleTrigger('audioModel')" style="display:none">
            <option value="eleven_flash_v2_5">Flash v2.5 (Fast, cheap)</option>
            <option value="eleven_multilingual_v2">Multilingual v2 (Best quality)</option>
          </select>
          <div id="audioModelTrigger" onclick="openSimplePicker('audioModel','Choose Model')" style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;background:var(--surface)"></div>
        </div>
      </div>
      ${S.characters.filter(c=>c.voice).length?`<div class="f-group"><label class="f-label">Or use a Character's Voice Profile</label><select class="f-select" id="audioCharVoice" onchange="applyCharVoice()"><option value="">— Select character —</option>${S.characters.filter(c=>c.voice).map(c=>`<option value="${c.voice}">${c.name}</option>`).join('')}</select></div>`:''}
      <button class="btn btn-primary btn-full" id="audioGenBtn" ${!hasKey?'disabled':''} onclick="generateAudio()">${hasKey?'🎵 Generate Voice':'🔑 Add API Key First'}</button>
    </div>
    <div class="panel" id="audioResultPanel" style="display:none;margin-top:14px">
      <div class="panel-title">🔊 Result</div>
      <div id="audioResultContent"></div>
    </div>

    <div class="panel" id="audioVoiceCloneAnchor" style="margin-top:14px">
      <div class="panel-title">🎙️ Voice Cloning ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Upload a clean audio sample (30s–a few minutes, one speaker, minimal background noise) and clone a real, reusable voice — it'll appear in the Voice dropdown above for any future voiceover.</div>
      <div class="f-group">
        <label class="f-label">Name this voice</label>
        <input class="f-input" id="voiceCloneName" placeholder="e.g. Narrator - Deep Warm Male">
      </div>
      <div class="f-group">
        <label class="f-label">Audio sample</label>
        <input type="file" accept="audio/*" id="voiceCloneFile" style="display:none" onchange="handleVoiceCloneFileUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('voiceCloneFile').click()">📤 Choose Audio Sample</button>
        <span id="voiceCloneFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <button class="btn btn-primary btn-full" id="voiceCloneBtn" ${!hasKey?'disabled':''} onclick="cloneVoiceFromSample()">${hasKey?'🎙️ Clone Voice':'🔑 Add API Key First'}</button>
      ${clonedVoices.length?`<div style="margin-top:12px">
        <div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">Your Cloned Voices</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${clonedVoices.map((v,i)=>`<div style="display:flex;align-items:center;gap:8px;background:rgba(61,31,122,0.04);border-radius:8px;padding:8px 10px;font-size:12px">
            <span style="flex:1;color:var(--text);font-weight:600">🎙️ ${v.name}</span>
            <button class="pc-menu-btn" onclick="deleteClonedVoice(${i})">🗑</button>
          </div>`).join('')}
        </div>
      </div>`:''}
    </div>

    <div class="panel" id="audioVoiceDesignAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('sparkle')} Voice Design ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Describe a voice in words — no audio sample needed. Good for original characters with no real-world reference to clone from.</div>
      <div class="f-group">
        <label class="f-label">Voice Description</label>
        <textarea class="f-textarea" id="vdDescription" placeholder="e.g. Gruff older male voice, gravelly, slight rasp, intimidating but controlled" style="min-height:60px"></textarea>
      </div>
      <button class="btn btn-primary btn-full" id="vdGenBtn" ${!hasKey?'disabled':''} onclick="generateVoiceDesignPreviews()">${hasKey?pIcon('sparkle',13)+' Generate 3 Previews':pIcon('sparkle',13)+' Add API Key First'}</button>
      <div id="vdPreviewResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioDialogueAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('chat')} Dialogue ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Multiple characters, one natural conversation — generated together in a single pass instead of separate lines stitched together.</div>
      <div id="dialogueLines" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>
      <button class="btn btn-outline btn-sm" onclick="addDialogueLine()">${pIcon('plus',12)} Add Line</button>
      <button class="btn btn-primary btn-full" id="dialogueGenBtn" style="margin-top:8px" ${!hasKey?'disabled':''} onclick="generateDialogue()">${hasKey?pIcon('chat',13)+' Generate Dialogue':pIcon('chat',13)+' Add API Key First'}</button>
      <div id="dialogueResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioVoiceChangerAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('swap')} Voice Changer ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Re-record an existing performance in a different voice — keeps the original timing, pacing, and emotion, only the voice itself changes.</div>
      <div class="f-group">
        <label class="f-label">Source audio (the performance to convert)</label>
        <input type="file" accept="audio/*" id="vcSourceFile" style="display:none" onchange="handleVoiceChangerFileUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('vcSourceFile').click()">${pIcon('upload',12)} Choose Audio File</button>
        <span id="vcSourceFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <div class="f-group">
        <label class="f-label">Target voice</label>
        <select class="f-select" id="vcTargetVoice" onchange="renderVoicePickerTrigger('vcTargetVoice','vcTargetVoiceTrigger')" style="display:none">
          <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
          <option value="ErXwobaYiN019PkySvjV">Antoni</option>
          <option value="EXAVITQu4vr4xnSDxMaL">Bella</option>
          <option value="TxGEqnHWrfWFTfGW9XjX">Josh</option>
          <option value="pNInz6obpgDQGcFmaJgB">Adam</option>
          <option value="jsCqWAovK2LkecY7zXl4">Freya</option>
          ${clonedVoices.map(v=>`<option value="${v.id}">${v.name}</option>`).join('')}
        </select>
        <div id="vcTargetVoiceTrigger" onclick="openVoicePicker('vcTargetVoice','vcTargetVoiceTrigger')" style="display:flex;align-items:center;gap:9px;border:1.5px solid var(--border);border-radius:12px;padding:7px 10px;cursor:pointer;background:var(--surface)"></div>
      </div>
      <button class="btn btn-primary btn-full" id="vcGenBtn" ${!hasKey?'disabled':''} onclick="runVoiceChanger()">${hasKey?pIcon('swap',13)+' Convert Voice':pIcon('swap',13)+' Add API Key First'}</button>
      <div id="vcResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioDubbingAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('film')} Dubbing ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Translate a video or audio file into another language — preserves the original speaker's voice, emotion, and timing. Takes a while to process; this stays open and polls for you.</div>
      <div class="f-group">
        <label class="f-label">Source file</label>
        <input type="file" accept="audio/*,video/*" id="dubSourceFile" style="display:none" onchange="handleDubbingFileUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('dubSourceFile').click()">${pIcon('upload',12)} Choose Audio or Video</button>
        <span id="dubSourceFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <div class="f-group">
        <label class="f-label">Target language</label>
        <select class="f-select" id="dubTargetLang" onchange="renderSimpleTrigger('dubTargetLang')" style="display:none">
          <option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="hi">Hindi</option><option value="ar">Arabic</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="zh">Chinese</option><option value="ru">Russian</option><option value="tr">Turkish</option><option value="id">Indonesian</option><option value="nl">Dutch</option><option value="pl">Polish</option>
        </select>
        <div id="dubTargetLangTrigger" onclick="openSimplePicker('dubTargetLang','Target Language')" style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:12px;padding:10px 12px;cursor:pointer;background:var(--surface)"></div>
      </div>
      <button class="btn btn-primary btn-full" id="dubGenBtn" ${!hasKey?'disabled':''} onclick="startDubbing()">${hasKey?pIcon('film',13)+' Start Dubbing':pIcon('film',13)+' Add API Key First'}</button>
      <div id="dubResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioIsolatorAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('mic')} Voice Isolator ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Strip background noise/music from a real-world recording, leaving clean isolated vocals — useful before cloning a voice from a messy source.</div>
      <div class="f-group">
        <input type="file" accept="audio/*" id="isoSourceFile" style="display:none" onchange="handleIsolatorFileUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('isoSourceFile').click()">${pIcon('upload',12)} Choose Audio File</button>
        <span id="isoSourceFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <button class="btn btn-primary btn-full" id="isoGenBtn" ${!hasKey?'disabled':''} onclick="runVoiceIsolator()">${hasKey?pIcon('mic',13)+' Isolate Voice':pIcon('mic',13)+' Add API Key First'}</button>
      <div id="isoResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioVideoToMusicAnchor" style="margin-top:14px">
      <div class="panel-title">${pIcon('sparkle')} Video → Music ${hasKey?'<span class="badge badge-green">ACTIVE — ElevenLabs</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Generate a custom soundtrack directly from a finished video clip — analyzes the actual footage, not just a text description.</div>
      <div class="f-group">
        <input type="file" accept="video/*" id="v2mSourceFile" style="display:none" onchange="handleVideoToMusicFileUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('v2mSourceFile').click()">${pIcon('upload',12)} Choose Video</button>
        <span id="v2mSourceFileLabel" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <div class="f-group">
        <label class="f-label">Style direction (optional)</label>
        <input class="f-input" id="v2mDescription" placeholder="e.g. Tense cinematic build, low strings, resolves triumphant">
      </div>
      <button class="btn btn-primary btn-full" id="v2mGenBtn" ${!hasKey?'disabled':''} onclick="runVideoToMusic()">${hasKey?pIcon('sparkle',13)+' Generate Soundtrack':pIcon('sparkle',13)+' Add API Key First'}</button>
      <div id="v2mResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" id="audioLibraryAnchor" style="margin-top:14px">
      <div class="panel-title">🎧 Recent Voiceovers</div>
      ${S.assets.filter(a=>a.type==='audio').length?`<div id="audioRecentList" style="display:flex;flex-direction:column;gap:8px">${S.assets.filter(a=>a.type==='audio').slice(-6).reverse().map(a=>`
        <div style="display:flex;align-items:center;gap:10px;background:rgba(61,31,122,0.04);border-radius:8px;padding:8px">
          <audio src="${a.url}" controls style="flex:1;height:32px"></audio>
        </div>`).join('')}</div>`:`<div style="font-size:11px;color:var(--textm)">Generated voiceovers will show up here.</div>`}
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🎼 Music Generation <span class="badge ${gs('api_falai')?'badge-green':'badge-red'}">${gs('api_falai')?'ACTIVE — fal.ai':'NO KEY'}</span></div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Real instrumental music, up to 6 minutes, via Stable Audio 3.</div>
      <div class="f-group"><textarea class="f-textarea" id="musicPrompt" placeholder="e.g. Tense cinematic orchestral build, low strings and brass, building to a dramatic climax" style="min-height:60px"></textarea></div>
      <div class="f-group"><label class="f-label">Duration: <span id="musicDurVal">30</span>s</label><input type="range" id="musicDuration" min="10" max="180" value="30" style="width:100%;--range-fill:11.76%" oninput="document.getElementById('musicDurVal').textContent=this.value"></div>
      <button class="btn btn-primary btn-full" ${!gs('api_falai')?'disabled':''} onclick="generateMusic()">🎼 Generate Music</button>
      <div id="musicResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">💥 SFX Generation <span class="badge ${gs('api_falai')?'badge-green':'badge-red'}">${gs('api_falai')?'ACTIVE — fal.ai':'NO KEY'}</span></div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Real sound effects, up to 30 seconds, generated in ~1 second.</div>
      <div class="f-row">
        <div class="f-group"><input class="f-input" id="sfxPrompt" placeholder="e.g. glass shattering, explosion, footsteps on gravel"></div>
        <div class="f-group" style="max-width:100px"><input type="number" class="f-input" id="sfxDuration" value="5" min="1" max="30"></div>
      </div>
      <button class="btn btn-primary btn-full" ${!gs('api_falai')?'disabled':''} onclick="generateSFX()">💥 Generate SFX</button>
      <div id="sfxResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">👄 Lipsync Studio <span class="badge ${gs('api_falai')?'badge-green':'badge-red'}">${gs('api_falai')?'ACTIVE — fal.ai':'NO KEY'}</span></div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Sync any audio to an existing video's face — real lip movement, not a filter.</div>
      <div class="f-group">
        <label class="f-label">Video file</label>
        <input type="file" accept="video/*" id="lipsyncVideoFile" style="display:none" onchange="handleLipsyncVideoUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('lipsyncVideoFile').click()">📤 Choose Video</button>
        <span id="lipsyncVideoName" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <div class="f-group">
        <label class="f-label">Audio source</label>
        <select class="f-select" id="lipsyncAudioSource" onchange="toggleLipsyncAudioSource()">
          <option value="gallery">Use a saved voiceover from Gallery</option>
          <option value="upload">Upload audio file</option>
        </select>
      </div>
      <div class="f-group" id="lipsyncGallerySelectWrap">
        <select class="f-select" id="lipsyncGalleryAudio">
          <option value="">— Select —</option>
          ${S.assets.filter(a=>a.type==='audio').map((a,i)=>`<option value="${a.url}">${(a.prompt||'Voiceover '+(i+1)).slice(0,50)}</option>`).join('')}
        </select>
      </div>
      <div class="f-group" id="lipsyncUploadWrap" style="display:none">
        <input type="file" accept="audio/*" id="lipsyncAudioFile" style="display:none" onchange="handleLipsyncAudioUpload(event)">
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('lipsyncAudioFile').click()">📤 Choose Audio</button>
        <span id="lipsyncAudioName" style="font-size:11px;color:var(--textm);margin-left:8px"></span>
      </div>
      <button class="btn btn-primary btn-full" ${!gs('api_falai')?'disabled':''} onclick="generateLipsync()">👄 Generate Lipsync</button>
      <div style="font-size:10px;color:var(--texts);margin-top:6px;text-align:center">⏱ Takes 1-2 minutes — don't close this tab</div>
      <div id="lipsyncResult" style="margin-top:10px"></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">✂️ Audio Trim & Volume</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Trim and adjust volume on any audio file — runs entirely in your browser, no upload needed.</div>
      <input type="file" accept="audio/*" id="editAudioFile" style="display:none" onchange="loadAudioForEditing(event)">
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('editAudioFile').click()">📤 Load Audio to Edit</button>
      <div id="audioEditorPanel" style="margin-top:10px"></div>
    </div>
  `;
  renderDialogueLines();
  renderVoicePickerTrigger("audioVoice","audioVoiceTrigger");
  renderSimpleTrigger("audioModel");
  renderVoicePickerTrigger("vcTargetVoice","vcTargetVoiceTrigger");
  renderSimpleTrigger("dubTargetLang");
  // Warm the cache in the background so opening any picker feels instant,
  // then refresh every visible trigger once real voice names/labels are in
  // — otherwise triggers show only the hardcoded fallback names until the
  // user manually opens a picker once.
  fetchElevenLabsVoices().then(voices=>{
    if(!voices)return;
    S.voicePickerCurrentList=voices;
    renderVoicePickerTrigger("audioVoice","audioVoiceTrigger");
    renderVoicePickerTrigger("vcTargetVoice","vcTargetVoiceTrigger");
    S.dialogueLinesData.forEach((line,i)=>renderVoicePickerTrigger(`dlVoiceSel_${i}`,`dlVoiceTrig_${i}`));
  });
}

// ── MUSIC GENERATION (fal-ai/stable-audio-3) ──
async function generateMusic(){
  const prompt=document.getElementById("musicPrompt").value.trim();
  if(!prompt){toast("Describe the music you want first","error");return;}
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const duration=parseInt(document.getElementById("musicDuration").value);
  const resultEl=document.getElementById("musicResult");
  resultEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">🎼 Composing…</div>`;
  try{
    const res=await fetch("https://fal.run/fal-ai/stable-audio-3/medium/text-to-audio",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
      body:JSON.stringify({prompt,duration,output_format:"mp3"})
    });
    const data=await res.json();
    if(!res.ok)throw new Error((data.detail&&(Array.isArray(data.detail)?data.detail[0]?.msg:data.detail))||data.error||res.statusText);
    const url=data.audio&&data.audio.url;
    if(!url)throw new Error("No audio returned");
    const savedAssetMusic=createAudioAsset(url,prompt);
    resultEl.innerHTML=`<audio src="${url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="downloadWithName('${url.replace(/'/g,"\\'")}','KosmicKat_music.mp3')">⬇ Download</button><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetMusic.id}')">📁 Add to Collection</button></div>`;
    logCost("stable-audio-3",prompt.slice(0,60));
    toast("🎼 Music generated — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px">❌ ${err.message}</div>`;
    toast("❌ Music generation failed: "+err.message,"error");
  }
}

// ── SFX GENERATION (cassetteai/sound-effects-generator) ──
async function generateSFX(){
  const prompt=document.getElementById("sfxPrompt").value.trim();
  if(!prompt){toast("Describe the sound effect first","error");return;}
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const duration=parseInt(document.getElementById("sfxDuration").value)||5;
  const resultEl=document.getElementById("sfxResult");
  resultEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">💥 Generating…</div>`;
  try{
    const res=await fetch("https://fal.run/cassetteai/sound-effects-generator",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
      body:JSON.stringify({prompt,duration})
    });
    const data=await res.json();
    if(!res.ok)throw new Error((data.detail&&(Array.isArray(data.detail)?data.detail[0]?.msg:data.detail))||data.error||res.statusText);
    const url=data.audio&&data.audio.url;
    if(!url)throw new Error("No audio returned");
    const savedAssetSfx=createAudioAsset(url,"SFX: "+prompt);
    resultEl.innerHTML=`<audio src="${url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="downloadWithName('${url.replace(/'/g,"\\'")}','KosmicKat_sfx.mp3')">⬇ Download</button><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetSfx.id}')">📁 Add to Collection</button></div>`;
    logCost("sfx-generator",prompt.slice(0,60));
    toast("💥 SFX generated — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px">❌ ${err.message}</div>`;
    toast("❌ SFX generation failed: "+err.message,"error");
  }
}

// ── LIPSYNC STUDIO (fal-ai/sync-lipsync/v2) ──
S.lipsyncVideoDataUrl=S.lipsyncVideoDataUrl||"";
S.lipsyncAudioDataUrl=S.lipsyncAudioDataUrl||"";

function toggleLipsyncAudioSource(){
  const src=document.getElementById("lipsyncAudioSource").value;
  document.getElementById("lipsyncGallerySelectWrap").style.display=src==="gallery"?"block":"none";
  document.getElementById("lipsyncUploadWrap").style.display=src==="upload"?"block":"none";
}

function handleLipsyncVideoUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  if(file.size>50*1024*1024){toast("Video too large — max 50MB","error");return;}
  document.getElementById("lipsyncVideoName").textContent=file.name;
  const reader=new FileReader();
  reader.onload=e=>{S.lipsyncVideoDataUrl=e.target.result;};
  reader.readAsDataURL(file);
}

function handleLipsyncAudioUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  document.getElementById("lipsyncAudioName").textContent=file.name;
  const reader=new FileReader();
  reader.onload=e=>{S.lipsyncAudioDataUrl=e.target.result;};
  reader.readAsDataURL(file);
}

async function generateLipsync(){
  if(!S.lipsyncVideoDataUrl){toast("Choose a video first","error");return;}
  const audioSource=document.getElementById("lipsyncAudioSource").value;
  const audioUrl=audioSource==="gallery"?document.getElementById("lipsyncGalleryAudio").value:S.lipsyncAudioDataUrl;
  if(!audioUrl){toast("Choose an audio source first","error");return;}
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}

  const resultEl=document.getElementById("lipsyncResult");
  resultEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">📤 Submitting…</div>`;
  try{
    const submitRes=await fetch("https://queue.fal.run/fal-ai/sync-lipsync/v2",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
      body:JSON.stringify({video_url:S.lipsyncVideoDataUrl,audio_url:audioUrl})
    });
    const submitData=await submitRes.json();
    if(!submitRes.ok)throw new Error((submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText);
    const requestId=submitData.request_id;
    if(!requestId)throw new Error("No request ID returned");
    const statusUrl=submitData.status_url||`https://queue.fal.run/fal-ai/sync-lipsync/v2/requests/${requestId}/status`;
    const resultUrl=submitData.response_url||`https://queue.fal.run/fal-ai/sync-lipsync/v2/requests/${requestId}`;

    let attempts=0,finalData=null;
    while(attempts<40){
      await new Promise(r=>setTimeout(r,5000));
      attempts++;
      const statusRes=await fetch(statusUrl,{headers:{"Authorization":"Key "+apiKey}});
      const statusData=await statusRes.json();
      resultEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">👄 ${statusData.status||'Processing'}… (${attempts*5}s)</div>`;
      if(statusData.status==="COMPLETED"){
        const finalRes=await fetch(resultUrl,{headers:{"Authorization":"Key "+apiKey}});
        finalData=await finalRes.json();
        break;
      }
      if(statusData.status==="ERROR"||statusData.status==="FAILED")throw new Error(statusData.error||"Lipsync failed");
    }
    if(!finalData)throw new Error("Timed out — check fal.ai dashboard, it may still complete");
    const videoUrl=finalData.video&&finalData.video.url;
    if(!videoUrl){
      const diag=formatFalDiag(finalData);
      throw new Error("No video returned — fal.ai said: "+diag);
    }
    const savedAssetLip=createVideoAsset(videoUrl,"Lipsync video","");
    resultEl.innerHTML=`<video src="${videoUrl}" controls style="width:100%;border-radius:8px;margin-bottom:8px"></video>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="downloadWithName('${videoUrl.replace(/'/g,"\\'")}','KosmicKat_lipsync.mp4')">⬇ Download</button><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetLip.id}')">📁 Add to Collection</button></div>`;
    logCost("sync-lipsync-v2","Lipsync video");
    toast("👄 Lipsync generated — saved to Gallery!","success");
    notifyIfEnabled("Lipsync ready 👄","Your lipsync video finished generating");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px">❌ ${err.message}</div>`;
    toast("❌ Lipsync failed: "+err.message,"error");
  }
}

// ── AUDIO TRIM & VOLUME EDITOR (pure client-side, Web Audio API) ──
S.audioEditBuffer=null;
S.audioEditCtx=null;

function loadAudioForEditing(event){
  const file=event.target.files[0];
  if(!file)return;
  const panel=document.getElementById("audioEditorPanel");
  panel.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:13px">⏳ Loading…</div>`;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      S.audioEditCtx=ctx;
      const buf=await ctx.decodeAudioData(e.target.result);
      S.audioEditBuffer=buf;
      const dur=buf.duration;
      panel.innerHTML=`
        <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Duration: ${dur.toFixed(1)}s</div>
        <div class="f-row">
          <div class="f-group"><label class="f-label">Trim Start: <span id="trimStartVal">0.0</span>s</label><input type="range" id="trimStart" min="0" max="${dur}" step="0.1" value="0" style="width:100%;--range-fill:0%" oninput="document.getElementById('trimStartVal').textContent=parseFloat(this.value).toFixed(1)"></div>
          <div class="f-group"><label class="f-label">Trim End: <span id="trimEndVal">${dur.toFixed(1)}</span>s</label><input type="range" id="trimEnd" min="0" max="${dur}" step="0.1" value="${dur}" style="width:100%;--range-fill:100%" oninput="document.getElementById('trimEndVal').textContent=parseFloat(this.value).toFixed(1)"></div>
        </div>
        <div class="f-group"><label class="f-label">Volume: <span id="volVal">100</span>%</label><input type="range" id="volGain" min="0" max="200" value="100" style="width:100%;--range-fill:50%" oninput="document.getElementById('volVal').textContent=this.value"></div>
        <div class="f-group"><label class="f-label">Fade In/Out: <span id="fadeVal">0.2</span>s</label><input type="range" id="fadeAmt" min="0" max="3" step="0.1" value="0.2" style="width:100%;--range-fill:6.67%" oninput="document.getElementById('fadeVal').textContent=this.value"></div>
        <button class="btn btn-primary btn-full" onclick="processAudioEdit()">✂️ Apply & Export</button>
        <div id="audioEditResult" style="margin-top:10px"></div>`;
    }catch(err){
      panel.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px">❌ Couldn't decode this audio file: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(file);
}

function processAudioEdit(){
  const buf=S.audioEditBuffer;
  if(!buf)return;
  const start=parseFloat(document.getElementById("trimStart").value);
  const end=parseFloat(document.getElementById("trimEnd").value);
  const gain=parseFloat(document.getElementById("volGain").value)/100;
  const fade=parseFloat(document.getElementById("fadeAmt").value);
  if(end<=start){toast("Trim end must be after trim start","error");return;}

  const sr=buf.sampleRate;
  const startSample=Math.floor(start*sr);
  const endSample=Math.min(Math.floor(end*sr),buf.length);
  const outLength=endSample-startSample;
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  const outBuf=ctx.createBuffer(buf.numberOfChannels,outLength,sr);

  for(let ch=0;ch<buf.numberOfChannels;ch++){
    const inData=buf.getChannelData(ch);
    const outData=outBuf.getChannelData(ch);
    for(let i=0;i<outLength;i++){
      let sample=inData[startSample+i]*gain;
      const t=i/sr;
      const remaining=(outLength-i)/sr;
      if(fade>0){
        if(t<fade)sample*=(t/fade);
        if(remaining<fade)sample*=(remaining/fade);
      }
      outData[i]=Math.max(-1,Math.min(1,sample));
    }
  }

  const wavBlob=audioBufferToWav(outBuf);
  const url=URL.createObjectURL(wavBlob);
  const reader=new FileReader();
  reader.onload=()=>{
    const base64Url=reader.result;
    const savedAssetEdit=createAudioAsset(base64Url,"Edited audio clip");
    document.getElementById("audioEditResult").innerHTML=`
      <audio src="${url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px">
        <a href="${url}" download="edited-audio.wav" class="btn btn-outline btn-sm">⬇ Download</a>
        <button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetEdit.id}')">📁 Add to Collection</button>
      </div>`;
    toast("✂️ Audio processed","success");
  };
  reader.readAsDataURL(wavBlob);
}

// Minimal WAV encoder — converts an AudioBuffer to a real, playable WAV Blob (16-bit PCM)
function audioBufferToWav(buffer){
  const numCh=buffer.numberOfChannels;
  const sr=buffer.sampleRate;
  const length=buffer.length*numCh*2+44;
  const arrBuf=new ArrayBuffer(length);
  const view=new DataView(arrBuf);
  const writeStr=(offset,str)=>{for(let i=0;i<str.length;i++)view.setUint8(offset+i,str.charCodeAt(i));};

  writeStr(0,"RIFF");
  view.setUint32(4,length-8,true);
  writeStr(8,"WAVE");
  writeStr(12,"fmt ");
  view.setUint32(16,16,true);
  view.setUint16(20,1,true);
  view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true);
  view.setUint32(28,sr*numCh*2,true);
  view.setUint16(32,numCh*2,true);
  view.setUint16(34,16,true);
  writeStr(36,"data");
  view.setUint32(40,buffer.length*numCh*2,true);

  let offset=44;
  for(let i=0;i<buffer.length;i++){
    for(let ch=0;ch<numCh;ch++){
      const sample=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));
      view.setInt16(offset,sample<0?sample*0x8000:sample*0x7FFF,true);
      offset+=2;
    }
  }
  return new Blob([arrBuf],{type:"audio/wav"});
}

function applyCharVoice(){
  const sel=document.getElementById("audioCharVoice");
  if(sel.value)document.getElementById("audioVoice").value=sel.value;
}

// ── VOICE CLONING — real ElevenLabs endpoint, genuinely missing before now.
// The "Voice Clone" tab existed in the UI but had zero functionality behind
// it — tapping it did nothing, and no cloning feature existed anywhere in
// the app. This is the real thing: POST an audio sample to ElevenLabs'
// actual /v1/voices/add endpoint, get back a real, reusable voice_id that
// then appears in the Voice dropdown above for any future voiceover.
S.voiceCloneFile=null;
function handleVoiceCloneFileUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.voiceCloneFile=file;
  document.getElementById("voiceCloneFileLabel").textContent=`✓ ${file.name}`;
}

async function cloneVoiceFromSample(){
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const name=document.getElementById("voiceCloneName")?.value.trim();
  if(!name){toast("Name this voice first","error");return;}
  if(!S.voiceCloneFile){toast("Choose an audio sample first","error");return;}
  const btn=document.getElementById("voiceCloneBtn");
  btn.disabled=true;btn.textContent="🎙️ Cloning…";
  try{
    const formData=new FormData();
    formData.append("name",name);
    formData.append("files",S.voiceCloneFile);
    const res=await fetch("https://api.elevenlabs.io/v1/voices/add",{
      method:"POST",
      headers:{"xi-api-key":apiKey},
      body:formData,
    });
    const data=await res.json();
    if(!res.ok)throw new Error((data.detail&&(data.detail.message||data.detail))||"Voice cloning failed");
    const voiceId=data.voice_id;
    if(!voiceId)throw new Error("No voice_id returned");
    const clonedVoices=gs("cloned_voices",[])||[];
    clonedVoices.push({id:voiceId,name,created:new Date().toISOString()});
    saveSetting("cloned_voices",clonedVoices);
    S.voiceCloneFile=null;
    toast(`🎙️ "${name}" cloned — now available in the Voice dropdown above`,"success");
    renderAudio(document.getElementById("moduleContent"));
  }catch(err){
    toast("❌ "+err.message,"error");
    if(btn){btn.disabled=false;btn.textContent="🎙️ Clone Voice";}
  }
}

async function deleteClonedVoice(i){
  const clonedVoices=gs("cloned_voices",[])||[];
  const voice=clonedVoices[i];
  if(!voice)return;
  if(!(await showConfirmDialog(`Delete "${voice.name}"? This removes it from ElevenLabs too, not just this app.`,{danger:true,okLabel:"Delete"})))return;
  const apiKey=gs("api_elevenlabs","");
  try{
    if(apiKey)await fetch(`https://api.elevenlabs.io/v1/voices/${voice.id}`,{method:"DELETE",headers:{"xi-api-key":apiKey}});
  }catch(err){
    console.warn("Couldn't delete from ElevenLabs, removing locally anyway:",err.message);
  }
  clonedVoices.splice(i,1);
  saveSetting("cloned_voices",clonedVoices);
  renderAudio(document.getElementById("moduleContent"));
  toast("Voice removed","success");
}

async function generateAudio(){
  const textEl=document.getElementById("audioText");
  const text=textEl.value.trim();
  if(!text){toast("Enter text to convert to speech","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}

  const voiceId=document.getElementById("audioVoice").value;
  const modelId=document.getElementById("audioModel").value;

  const btn=document.getElementById("audioGenBtn");
  const resultPanel=document.getElementById("audioResultPanel");
  const resultContent=document.getElementById("audioResultContent");
  btn.disabled=true;btn.textContent="⏳ Generating…";
  resultPanel.style.display="block";
  resultContent.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">🎙 Generating voice…</div>`;

  try{
    const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,{
      method:"POST",
      headers:{"Content-Type":"application/json","xi-api-key":apiKey,"Accept":"audio/mpeg"},
      body:JSON.stringify({text,model_id:modelId,voice_settings:{stability:0.5,similarity_boost:0.75}})
    });
    if(!response.ok){
      let errMsg=response.statusText;
      try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
      throw new Error(errMsg);
    }
    const blob=await response.blob();
    const audioUrl=URL.createObjectURL(blob);
    // Convert to base64 for persistent storage (survives page reload)
    const base64Url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    const savedAssetTts=createAudioAsset(base64Url,text);
    resultContent.innerHTML=`
      <audio src="${audioUrl}" controls style="width:100%;margin-bottom:10px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${audioUrl}" download="voiceover.mp3" class="btn btn-outline btn-sm">⬇ Download</a>
        <button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetTts.id}')">📁 Add to Collection</button>
      </div>`;
    logCost("elevenlabs_tts",text.slice(0,60));
    toast("🎵 Voice generated — saved to Gallery!","success");
  }catch(err){
    console.error("Audio gen error:",err);
    resultContent.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px">❌ ${err.message}</div>`;
    toast("❌ Voice generation failed: "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="🎵 Generate Voice";
}

function createAudioAsset(url,text){
  const asset={id:"asset_"+Date.now(),type:"audio",url,prompt:text,created:new Date().toISOString()};
  S.assets.push(asset);
  save("assets");
  // Background re-host, same pattern as images/videos — but for audio this
  // isn't just about permanence, it's about survival: audio is always a
  // base64 data URL at creation time, and leaving megabytes of base64
  // sitting inside S.assets fills the localStorage quota within a handful
  // of generations, breaking ALL saving app-wide. Swapping to a short
  // hosted URL shrinks the stored record from ~1MB to ~200 bytes.
  rehostToStorage(url,"gallery-audio").then(hostedUrl=>{
    if(hostedUrl!==url){
      const a=S.assets.find(x=>x.id===asset.id);
      if(a){a.url=hostedUrl;save("assets");}
    }
  });
  return asset;
}

function saveAudioBlobToGallery(url,text){
  const asset=createAudioAsset(url,text);
  toast("💾 Saved to Gallery","success");
  renderAudio(document.getElementById("moduleContent"));
  return asset;
}

// ── VOICE DESIGN — POST /v1/text-to-voice/design (confirmed via ElevenLabs'
// own docs). Two-step flow: generate previews first (nothing saved/billed
// as a real voice yet), then explicitly save the one you like via
// POST /v1/text-to-voice, which is what actually creates a permanent,
// reusable voice. Saved voices land in the exact same cloned_voices list
// the Voice Cloning panel already uses, so they show up in every voice
// dropdown across the app automatically — no separate storage needed.
async function generateVoiceDesignPreviews(){
  const description=document.getElementById("vdDescription").value.trim();
  if(!description){toast("Describe the voice first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const btn=document.getElementById("vdGenBtn");
  const resultEl=document.getElementById("vdPreviewResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('sparkle',14)} Generating 3 previews…</div>`;
  try{
    const response=await fetch("https://api.elevenlabs.io/v1/text-to-voice/design",{
      method:"POST",
      headers:{"Content-Type":"application/json","xi-api-key":apiKey},
      body:JSON.stringify({voice_description:description,auto_generate_text:true})
    });
    const data=await response.json();
    if(!response.ok)throw new Error((data.detail&&(data.detail.message||JSON.stringify(data.detail)))||response.statusText);
    const previews=data.previews||[];
    if(!previews.length)throw new Error("No previews returned");
    resultEl.innerHTML=previews.map((p,i)=>`
      <div style="border:1.5px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px">
        <audio src="data:audio/mpeg;base64,${p.audio_base_64}" controls style="width:100%;margin-bottom:8px"></audio>
        <button class="btn btn-primary btn-sm btn-full" onclick="saveDesignedVoice('${p.generated_voice_id}','${description.replace(/'/g,"\\'").slice(0,60)}')">${pIcon('check',12)} Save This Voice — Option ${i+1}</button>
      </div>`).join('');
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Voice design failed: "+err.message,"error");
  }
  btn.disabled=false;
}
async function saveDesignedVoice(generatedVoiceId,description){
  const apiKey=gs("api_elevenlabs","");
  try{
    const response=await fetch("https://api.elevenlabs.io/v1/text-to-voice",{
      method:"POST",
      headers:{"Content-Type":"application/json","xi-api-key":apiKey},
      body:JSON.stringify({voice_name:description||"Designed Voice",voice_description:description,generated_voice_id:generatedVoiceId})
    });
    const data=await response.json();
    if(!response.ok)throw new Error((data.detail&&(data.detail.message||JSON.stringify(data.detail)))||response.statusText);
    const clonedVoices=gs("cloned_voices",[])||[];
    clonedVoices.push({id:data.voice_id,name:description||"Designed Voice"});
    saveSetting("cloned_voices",clonedVoices);
    document.getElementById("vdPreviewResult").innerHTML="";
    document.getElementById("vdDescription").value="";
    toast("✨ Voice saved — available in every Voice dropdown now","success");
    renderAudio(document.getElementById("moduleContent"));
  }catch(err){
    toast("❌ Couldn't save voice: "+err.message,"error");
  }
}

// ── TEXT TO DIALOGUE — POST /v1/text-to-dialogue (confirmed via
// ElevenLabs' own docs, same family as the documented /stream variant).
// Takes an array of {text, voice_id} pairs and renders them as one
// natural conversation in a single generation, instead of separate TTS
// calls stitched together with no shared performance context.
S.dialogueLinesData=S.dialogueLinesData||[{text:"",voice:"21m00Tcm4TlvDq8ikWAM"},{text:"",voice:"ErXwobaYiN019PkySvjV"}];
function renderDialogueLines(){
  const wrap=document.getElementById("dialogueLines");
  if(!wrap)return;
  const clonedVoices=gs("cloned_voices",[])||[];
  const voiceOptionsHTML=(selected)=>`
    <option value="21m00Tcm4TlvDq8ikWAM" ${selected==="21m00Tcm4TlvDq8ikWAM"?"selected":""}>Rachel</option>
    <option value="ErXwobaYiN019PkySvjV" ${selected==="ErXwobaYiN019PkySvjV"?"selected":""}>Antoni</option>
    <option value="EXAVITQu4vr4xnSDxMaL" ${selected==="EXAVITQu4vr4xnSDxMaL"?"selected":""}>Bella</option>
    <option value="TxGEqnHWrfWFTfGW9XjX" ${selected==="TxGEqnHWrfWFTfGW9XjX"?"selected":""}>Josh</option>
    <option value="pNInz6obpgDQGcFmaJgB" ${selected==="pNInz6obpgDQGcFmaJgB"?"selected":""}>Adam</option>
    <option value="jsCqWAovK2LkecY7zXl4" ${selected==="jsCqWAovK2LkecY7zXl4"?"selected":""}>Freya</option>
    ${clonedVoices.map(v=>`<option value="${v.id}" ${selected===v.id?"selected":""}>${v.name}</option>`).join('')}`;
  wrap.innerHTML=S.dialogueLinesData.map((line,i)=>`
    <div style="display:flex;gap:6px;align-items:center">
      <select id="dlVoiceSel_${i}" style="display:none" onchange="S.dialogueLinesData[${i}].voice=this.value">${voiceOptionsHTML(line.voice)}</select>
      <div id="dlVoiceTrig_${i}" onclick="openVoicePicker('dlVoiceSel_${i}','dlVoiceTrig_${i}')" style="width:78px;flex-shrink:0;display:flex;align-items:center;gap:5px;border:1.5px solid var(--border);border-radius:10px;padding:5px 6px;cursor:pointer;background:var(--surface)"></div>
      <input class="f-input" style="flex:1" placeholder="Line ${i+1}…" value="${(line.text||'').replace(/"/g,'&quot;')}" oninput="S.dialogueLinesData[${i}].text=this.value">
      ${S.dialogueLinesData.length>2?`<button class="pc-menu-btn" onclick="removeDialogueLine(${i})">${pIcon('trash',12)}</button>`:''}
    </div>`).join('');
  S.dialogueLinesData.forEach((line,i)=>renderVoicePickerTrigger(`dlVoiceSel_${i}`,`dlVoiceTrig_${i}`));
}
function addDialogueLine(){
  if(S.dialogueLinesData.length>=12){toast("Max 12 lines per dialogue","error");return;}
  S.dialogueLinesData.push({text:"",voice:"21m00Tcm4TlvDq8ikWAM"});
  renderDialogueLines();
}
function removeDialogueLine(i){
  S.dialogueLinesData.splice(i,1);
  renderDialogueLines();
}
async function generateDialogue(){
  const inputs=S.dialogueLinesData.filter(l=>l.text&&l.text.trim()).map(l=>({text:l.text.trim(),voice_id:l.voice}));
  if(inputs.length<2){toast("Write at least 2 lines first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const btn=document.getElementById("dialogueGenBtn");
  const resultEl=document.getElementById("dialogueResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('chat',14)} Generating dialogue…</div>`;
  try{
    const response=await fetch("https://api.elevenlabs.io/v1/text-to-dialogue",{
      method:"POST",
      headers:{"Content-Type":"application/json","xi-api-key":apiKey,"Accept":"audio/mpeg"},
      body:JSON.stringify({inputs,model_id:"eleven_v3"})
    });
    if(!response.ok){
      let errMsg=response.statusText;
      try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
      throw new Error(errMsg);
    }
    const blob=await response.blob();
    const base64Url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    const savedAssetDlg=createAudioAsset(base64Url,"Dialogue: "+inputs.map(i=>i.text).join(" / ").slice(0,60));
    resultEl.innerHTML=`
      <audio src="${base64Url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetDlg.id}')">${pIcon('folder',12)} Add to Collection</button></div>`;
    logCost("elevenlabs_dialogue",inputs.map(i=>i.text).join(" ").slice(0,60));
    toast("🎭 Dialogue generated — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Dialogue generation failed: "+err.message,"error");
  }
  btn.disabled=false;
}

// ── VOICE CHANGER (Speech-to-Speech) — POST /v1/speech-to-speech/{voice_id}
// (confirmed via ElevenLabs' own docs — multipart form, audio file +
// model_id, defaults to eleven_english_sts_v2). Converts an existing
// performance into a different voice while preserving its original
// timing/emotion/pacing.
S.vcSourceFileBlob=null;
function handleVoiceChangerFileUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.vcSourceFileBlob=file;
  document.getElementById("vcSourceFileLabel").textContent=file.name;
}
async function runVoiceChanger(){
  if(!S.vcSourceFileBlob){toast("Choose a source audio file first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const targetVoice=document.getElementById("vcTargetVoice").value;
  const btn=document.getElementById("vcGenBtn");
  const resultEl=document.getElementById("vcResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('swap',14)} Converting…</div>`;
  try{
    const form=new FormData();
    form.append("audio",S.vcSourceFileBlob);
    form.append("model_id","eleven_english_sts_v2");
    const response=await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${targetVoice}`,{
      method:"POST",
      headers:{"xi-api-key":apiKey,"Accept":"audio/mpeg"},
      body:form
    });
    if(!response.ok){
      let errMsg=response.statusText;
      try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
      throw new Error(errMsg);
    }
    const blob=await response.blob();
    const base64Url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    const savedAssetVc=createAudioAsset(base64Url,"Voice Changer: "+S.vcSourceFileBlob.name);
    resultEl.innerHTML=`
      <audio src="${base64Url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetVc.id}')">${pIcon('folder',12)} Add to Collection</button></div>`;
    logCost("elevenlabs_voicechanger","Voice Changer: "+S.vcSourceFileBlob.name);
    toast("🔄 Voice converted — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Voice conversion failed: "+err.message,"error");
  }
  btn.disabled=false;
}

// ── DUBBING — POST /v1/dubbing (confirmed via ElevenLabs' own docs,
// multipart form) creates a project and returns a dubbing_id. This is a
// genuinely async operation (can take minutes for real content), unlike
// the other tools — polls GET /v1/dubbing/:dubbing_id for status ('dubbed'/
// 'dubbing'/'failed') every 5s, then fetches the finished result from
// GET /v1/dubbing/:dubbing_id/audio/:language_code once status is 'dubbed'.
S.dubSourceFileBlob=null;
function handleDubbingFileUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.dubSourceFileBlob=file;
  document.getElementById("dubSourceFileLabel").textContent=file.name;
}
async function startDubbing(){
  if(!S.dubSourceFileBlob){toast("Choose a source file first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const targetLang=document.getElementById("dubTargetLang").value;
  const isVideo=S.dubSourceFileBlob.type.startsWith("video/");
  const btn=document.getElementById("dubGenBtn");
  const resultEl=document.getElementById("dubResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('film',14)} Submitting…</div>`;
  try{
    const form=new FormData();
    form.append("file",S.dubSourceFileBlob);
    form.append("target_lang",targetLang);
    const submitResponse=await fetch("https://api.elevenlabs.io/v1/dubbing",{
      method:"POST",headers:{"xi-api-key":apiKey},body:form
    });
    const submitData=await submitResponse.json();
    if(!submitResponse.ok)throw new Error((submitData.detail&&(submitData.detail.message||JSON.stringify(submitData.detail)))||submitResponse.statusText);
    const dubbingId=submitData.dubbing_id;
    // Real content can genuinely take minutes — poll every 5s, up to 10
    // minutes (120 attempts) before giving up, showing progress the whole way.
    let attempts=0;
    const maxAttempts=120;
    const poll=async()=>{
      attempts++;
      resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('film',14)} Dubbing in progress… (checked ${attempts}×, this can take a few minutes)</div>`;
      const statusResponse=await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbingId}`,{headers:{"xi-api-key":apiKey}});
      const statusData=await statusResponse.json();
      if(statusData.status==="dubbed"){
        const audioResponse=await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbingId}/audio/${targetLang}`,{headers:{"xi-api-key":apiKey}});
        if(!audioResponse.ok)throw new Error("Dub finished but couldn't fetch the result — try again");
        const blob=await audioResponse.blob();
        const base64Url=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onload=()=>resolve(reader.result);
          reader.onerror=reject;
          reader.readAsDataURL(blob);
        });
        const savedAssetDub=isVideo?createVideoAsset(base64Url,`Dubbed (${targetLang}): ${S.dubSourceFileBlob.name}`,""):createAudioAsset(base64Url,`Dubbed (${targetLang}): ${S.dubSourceFileBlob.name}`);
        resultEl.innerHTML=`
          <${isVideo?'video':'audio'} src="${base64Url}" controls style="width:100%;margin-bottom:8px${isVideo?';border-radius:8px':''}"></${isVideo?'video':'audio'}>
          <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
          <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetDub.id}')">${pIcon('folder',12)} Add to Collection</button></div>`;
        logCost("elevenlabs_dubbing","Dubbed ("+targetLang+"): "+S.dubSourceFileBlob.name);
        toast("🌍 Dubbing complete — saved to Gallery!","success");
        btn.disabled=false;
        return;
      }
      if(statusData.status==="failed")throw new Error("Dubbing failed on ElevenLabs' side — try a shorter clip or check the source file");
      if(attempts>=maxAttempts)throw new Error("Dubbing is taking longer than expected (10+ min) — check back later, your dubbing_id is "+dubbingId);
      setTimeout(poll,5000);
    };
    await poll();
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Dubbing failed: "+err.message,"error");
    btn.disabled=false;
  }
}

// ── VOICE ISOLATOR — POST /v1/audio-isolation (confirmed via ElevenLabs'
// own docs, multipart form, single field "audio"). Single call, no polling
// needed — returns the isolated track directly.
S.isoSourceFileBlob=null;
function handleIsolatorFileUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.isoSourceFileBlob=file;
  document.getElementById("isoSourceFileLabel").textContent=file.name;
}
async function runVoiceIsolator(){
  if(!S.isoSourceFileBlob){toast("Choose an audio file first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const btn=document.getElementById("isoGenBtn");
  const resultEl=document.getElementById("isoResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('mic',14)} Isolating…</div>`;
  try{
    const form=new FormData();
    form.append("audio",S.isoSourceFileBlob);
    const response=await fetch("https://api.elevenlabs.io/v1/audio-isolation",{
      method:"POST",headers:{"xi-api-key":apiKey},body:form
    });
    if(!response.ok){
      let errMsg=response.statusText;
      try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
      throw new Error(errMsg);
    }
    const blob=await response.blob();
    const base64Url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    const savedAssetIso=createAudioAsset(base64Url,"Isolated: "+S.isoSourceFileBlob.name);
    resultEl.innerHTML=`
      <audio src="${base64Url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetIso.id}')">${pIcon('folder',12)} Add to Collection</button></div>`;
    logCost("elevenlabs_isolator","Isolated: "+S.isoSourceFileBlob.name);
    toast("🎤 Voice isolated — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Isolation failed: "+err.message,"error");
  }
  btn.disabled=false;
}

// ── VIDEO TO MUSIC — POST /v1/music/video-to-music (confirmed via
// ElevenLabs' own docs, multipart form, field "videos" — array-capable but
// used here with a single file for simplicity). Single call, analyzes the
// actual video content, not just a text prompt.
S.v2mSourceFileBlob=null;
function handleVideoToMusicFileUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.v2mSourceFileBlob=file;
  document.getElementById("v2mSourceFileLabel").textContent=file.name;
}
async function runVideoToMusic(){
  if(!S.v2mSourceFileBlob){toast("Choose a video first","error");return;}
  const apiKey=gs("api_elevenlabs","");
  if(!apiKey){toast("Add an ElevenLabs API key in Settings first","error");return;}
  const description=document.getElementById("v2mDescription").value.trim();
  const btn=document.getElementById("v2mGenBtn");
  const resultEl=document.getElementById("v2mResult");
  btn.disabled=true;
  resultEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--textm);font-size:12px">${pIcon('sparkle',14)} Analyzing video and composing…</div>`;
  try{
    const form=new FormData();
    form.append("videos",S.v2mSourceFileBlob);
    if(description)form.append("description",description);
    form.append("model_id","music_v2");
    const response=await fetch("https://api.elevenlabs.io/v1/music/video-to-music",{
      method:"POST",headers:{"xi-api-key":apiKey},body:form
    });
    if(!response.ok){
      let errMsg=response.statusText;
      try{const errData=await response.json();errMsg=(errData.detail&&(errData.detail.message||JSON.stringify(errData.detail)))||errMsg;}catch(e){}
      throw new Error(errMsg);
    }
    const blob=await response.blob();
    const base64Url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    const savedAssetV2m=createAudioAsset(base64Url,"Soundtrack for: "+S.v2mSourceFileBlob.name+(description?" — "+description:""));
    resultEl.innerHTML=`
      <audio src="${base64Url}" controls style="width:100%;margin-bottom:8px"></audio>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedAssetV2m.id}')">${pIcon('folder',12)} Add to Collection</button></div>`;
    logCost("elevenlabs_video2music","Soundtrack: "+S.v2mSourceFileBlob.name);
    toast("🎼 Soundtrack generated — saved to Gallery!","success");
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:8px">❌ ${err.message}</div>`;
    toast("❌ Soundtrack generation failed: "+err.message,"error");
  }
  btn.disabled=false;
}


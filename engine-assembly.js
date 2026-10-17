/* Kosmic Engine — Final cut.
 * Joins the approved scene clips of the current production into one film:
 *   - narration / caption line per shot (AI-written, editable)  -> captions + .srt / .vtt
 *   - voiceover per line (ElevenLabs, key from Settings)
 *   - optional music bed (fal.ai stable-audio, key from Settings)
 *   - live preview, and an in-browser export that records the whole film (WebM)
 * Export renders in real time on this device. Clip hosts must allow cross-origin reads;
 * if one doesn't, the export says so instead of failing silently.
 * Entry point: KosmicAssembly.render(containerEl), called by the Engine's "Final cut" tab. */
(function(){
  "use strict";
  if(window.KosmicAssembly)return;
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const say=(m,t)=>{try{toast(m,t||"")}catch(_){}};
  const DEFAULT_VOICE="21m00Tcm4TlvDq8ikWAM";

  const vo=new Map();          // shot key -> object URL of generated voiceover (memory only)
  const durs=new Map();        // clip url -> real duration (s)
  let busy=null;               // label of running job, or null
  let root=null;

  /* ───── data ───── */
  function production(){
    const d=typeof S!=="undefined"&&S.directorChat;
    if(!d||!d.productionId)return null;
    return (S.productions||[]).find(x=>x.id===d.productionId)||null;
  }
  function shots(p){
    const out=[];
    (p.episodes||[]).slice().sort((a,b)=>a.index-b.index).forEach(e=>{
      (e.shots||[]).slice().sort((a,b)=>a.shotIndex-b.shotIndex).forEach(s=>{
        if(!s.videoUrl)return;
        const sb=(e.storyboard||[])[s.shotIndex]||{};
        out.push({key:`${e.index}-${s.shotIndex}`,ep:e.index,idx:s.shotIndex,url:s.videoUrl,desc:sb.desc||"",dur:Number(e.duration)||5});
      });
    });
    return out;
  }
  function state(){
    const d=S.directorChat;
    d.assembly=d.assembly||{lines:{},captions:true,voice:true,music:null,musicVol:0.25,clipVol:0.7,voiceId:""};
    return d.assembly;
  }
  function persist(){try{window.save&&save()}catch(_){}}
  const dur=s=>durs.get(s.url)||s.dur;

  function loadDur(s){
    return new Promise(res=>{
      if(durs.has(s.url))return res(durs.get(s.url));
      const v=document.createElement("video");v.preload="metadata";v.muted=true;
      const done=()=>{if(Number.isFinite(v.duration)&&v.duration>0)durs.set(s.url,v.duration);res(dur(s))};
      v.onloadedmetadata=done;v.onerror=()=>res(dur(s));
      setTimeout(()=>res(dur(s)),8000);
      v.src=s.url;
    });
  }

  /* ───── captions ───── */
  function cues(list,st){
    let t=0;const out=[];
    list.forEach(s=>{
      const d=dur(s),line=(st.lines[s.key]||"").trim();
      if(line)out.push({start:t,end:t+Math.max(0.5,d-0.1),text:line});
      t+=d;
    });
    return out;
  }
  const pad=(n,l)=>String(n).padStart(l,"0");
  function ts(sec,comma){
    const ms=Math.round(sec*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
    return `${pad(h,2)}:${pad(m,2)}:${pad(s,2)}${comma?",":"."}${pad(ms%1000,3)}`;
  }
  function srt(list,st){return cues(list,st).map((c,i)=>`${i+1}\n${ts(c.start,true)} --> ${ts(c.end,true)}\n${c.text}\n`).join("\n")}
  function vtt(list,st){return "WEBVTT\n\n"+cues(list,st).map(c=>`${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n")}
  function download(name,text,type){
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:type||"text/plain"}));
    a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  }

  /* ───── AI narration ───── */
  async function writeLines(){
    const p=production(),list=p&&shots(p);if(!list||!list.length)return;
    if(busy)return;busy="Writing narration…";paint();
    try{
      const prompt=`Story: "${p.concept}"\n\nWrite ONE short narration/caption line for each of the ${list.length} shots below, in order — max 14 words each, in the story's voice, no stage directions, no shot numbers. Reply with ONLY a JSON array of exactly ${list.length} strings.\n\n`+list.map((s,i)=>`${i+1}. ${s.desc||"(no description)"}`).join("\n");
      const sys="You write tight film narration. Output valid JSON only.";
      const call=()=>callAiSimple(prompt,sys);
      const reply=(window.KosmicEngine&&KosmicEngine.withBrain)?await KosmicEngine.withBrain(call):await call();
      const m=String(reply).match(/\[[\s\S]*\]/);
      if(!m)throw new Error("The model didn't return a list of lines");
      const arr=JSON.parse(m[0]);
      const st=state();
      list.forEach((s,i)=>{if(typeof arr[i]==="string")st.lines[s.key]=arr[i].trim()});
      persist();
    }catch(e){say("Narration failed: "+e.message,"error")}
    busy=null;paint();
  }

  /* ───── voiceover + music ───── */
  async function makeVoice(){
    const p=production(),list=p&&shots(p),st=state();
    if(!list)return;
    const key=(window.gs&&gs("api_elevenlabs",""))||"";
    if(!key){say("Add an ElevenLabs API key in Settings first","error");return}
    if(busy)return;
    const voiceId=st.voiceId||(window.gs&&gs("engine_voice_id",""))||DEFAULT_VOICE;
    const todo=list.filter(s=>(st.lines[s.key]||"").trim());
    if(!todo.length){say("Write the narration lines first","error");return}
    try{
      for(let i=0;i<todo.length;i++){
        busy=`Voiceover ${i+1}/${todo.length}…`;paint();
        const s=todo[i];
        const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,{method:"POST",
          headers:{"Content-Type":"application/json","xi-api-key":key,"Accept":"audio/mpeg"},
          body:JSON.stringify({text:st.lines[s.key],model_id:"eleven_multilingual_v2",voice_settings:{stability:0.5,similarity_boost:0.75}})});
        if(!r.ok){let m=r.statusText;try{const j=await r.json();m=(j.detail&&(j.detail.message||JSON.stringify(j.detail)))||m}catch(_){}throw new Error(m)}
        const old=vo.get(s.key);if(old)URL.revokeObjectURL(old);
        vo.set(s.key,URL.createObjectURL(await r.blob()));
        try{logCost("elevenlabs_tts",(st.lines[s.key]||"").slice(0,60))}catch(_){}
      }
      say("🎙 Voiceover ready","success");
    }catch(e){say("Voiceover failed: "+e.message,"error")}
    busy=null;paint();
  }
  async function makeMusic(){
    const key=(window.gs&&gs("api_falai",""))||"";
    if(!key){say("Add a fal.ai API key in Settings first","error");return}
    if(busy)return;
    const p=production(),st=state(),list=p&&shots(p);
    const total=Math.min(190,Math.max(10,Math.round((list||[]).reduce((a,s)=>a+dur(s),0))));
    const promptEl=$("kaMusicPrompt"),prompt=(promptEl&&promptEl.value.trim())||`Cinematic underscore for: ${p?p.concept:"a short film"}. Instrumental, no vocals.`;
    busy="Composing music…";paint();
    try{
      const r=await fetch("https://fal.run/fal-ai/stable-audio-3/medium/text-to-audio",{method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Key "+key},body:JSON.stringify({prompt,duration:total,output_format:"mp3"})});
      const d=await r.json();
      if(!r.ok)throw new Error((d.detail&&(Array.isArray(d.detail)?d.detail[0]?.msg:d.detail))||d.error||r.statusText);
      const url=d.audio&&d.audio.url;if(!url)throw new Error("No audio returned");
      st.music=url;persist();
      try{logCost("stable-audio-3",prompt.slice(0,60))}catch(_){}
      say("🎼 Music ready","success");
    }catch(e){say("Music failed: "+e.message,"error")}
    busy=null;paint();
  }

  /* ───── preview ───── */
  let pv=null;
  function stopPreview(){
    if(!pv)return;pv.stop=true;
    try{pv.video.pause()}catch(_){}try{pv.vo&&pv.vo.pause()}catch(_){}try{pv.music&&pv.music.pause()}catch(_){}
    pv=null;
  }
  async function playPreview(){
    const p=production(),list=p&&shots(p),st=state();if(!list||!list.length)return;
    stopPreview();
    const video=$("kaVideo"),cap=$("kaCap");if(!video)return;
    const me=pv={stop:false,video,vo:null,music:null};
    video.muted=false;video.volume=st.clipVol;
    if(st.music){me.music=new Audio(st.music);me.music.loop=true;me.music.volume=st.musicVol;me.music.play().catch(()=>{})}
    for(let i=0;i<list.length&&!me.stop;i++){
      const s=list[i];
      cap.textContent=st.captions?(st.lines[s.key]||""):"";
      cap.style.display=cap.textContent?"block":"none";
      const lbl=$("kaNow");if(lbl)lbl.textContent=`Shot ${i+1} of ${list.length}`;
      if(st.voice&&vo.get(s.key)){me.vo=new Audio(vo.get(s.key));me.vo.play().catch(()=>{})}
      await new Promise(res=>{
        video.onended=res;video.onerror=res;video.src=s.url;
        video.play().catch(()=>res());
      });
    }
    if(!me.stop){cap.style.display="none";stopPreview()}
  }

  /* ───── export (records the joined film in real time) ───── */
  function aspect(p){
    const m=String(p.aspectRatio||"16:9").match(/^(\d+):(\d+)$/);
    const w=m?+m[1]:16,h=m?+m[2]:9,long=1280;
    return w>=h?{W:long,H:Math.round(long*h/w/2)*2}:{W:Math.round(long*w/h/2)*2,H:long};
  }
  function wrapText(ctx,text,maxW){
    const words=text.split(/\s+/),lines=[];let cur="";
    words.forEach(w=>{const t=cur?cur+" "+w:w;if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t});
    if(cur)lines.push(cur);return lines;
  }
  async function exportFilm(){
    const p=production(),list=p&&shots(p),st=state();
    if(!list||!list.length||busy)return;
    if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){say("This browser can't record video — try Chrome","error");return}
    stopPreview();
    const total=list.reduce((a,s)=>a+dur(s),0);
    const {W,H}=aspect(p);
    busy="Recording…";paint();
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");
    const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();
    const dest=ac.createMediaStreamDestination();
    const mkSrc=(el,vol)=>{const src=ac.createMediaElementSource(el);const g=ac.createGain();g.gain.value=vol;src.connect(g);g.connect(dest);return g};
    const video=document.createElement("video");video.crossOrigin="anonymous";video.playsInline=true;video.preload="auto";
    const clipGain=mkSrc(video,st.clipVol);
    let music=null;
    if(st.music){music=new Audio();music.crossOrigin="anonymous";music.loop=true;music.src=st.music;try{mkSrc(music,st.musicVol)}catch(_){music=null}}
    const out=new MediaStream([...canvas.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);
    const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(m=>MediaRecorder.isTypeSupported(m));
    const rec=new MediaRecorder(out,{mimeType:mime,videoBitsPerSecond:6000000});
    const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const stopped=new Promise(r=>rec.onstop=r);
    let cur="",failed=null,cancel=false;
    window.__kaCancel=()=>{cancel=true};
    let raf;
    const draw=()=>{
      ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);
      if(video.videoWidth){
        const k=Math.min(W/video.videoWidth,H/video.videoHeight),w=video.videoWidth*k,h=video.videoHeight*k;
        ctx.drawImage(video,(W-w)/2,(H-h)/2,w,h);
      }
      if(st.captions&&cur){
        const fs=Math.round(H*0.045);ctx.font=`700 ${fs}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="bottom";
        const lines=wrapText(ctx,cur,W*0.86);
        lines.forEach((ln,i)=>{
          const y=H-H*0.06-(lines.length-1-i)*fs*1.25;
          ctx.lineWidth=Math.max(4,fs/6);ctx.strokeStyle="rgba(0,0,0,.85)";ctx.strokeText(ln,W/2,y);
          ctx.fillStyle="#fff";ctx.fillText(ln,W/2,y);
        });
      }
      raf=requestAnimationFrame(draw);
    };
    try{
      await ac.resume();
      rec.start(500);draw();
      if(music)music.play().catch(()=>{});
      for(let i=0;i<list.length&&!cancel;i++){
        const s=list[i];
        busy=`Recording ${i+1}/${list.length} · ${Math.round(list.slice(0,i).reduce((a,x)=>a+dur(x),0))}s of ${Math.round(total)}s`;paint();
        cur=st.lines[s.key]||"";
        let voEl=null;
        if(st.voice&&vo.get(s.key)){voEl=new Audio(vo.get(s.key));try{mkSrc(voEl,1)}catch(_){voEl=null}}
        await new Promise((res,rej)=>{
          video.onended=res;
          video.onerror=()=>rej(new Error(`Clip ${i+1} couldn't be read for export — its host may block cross-origin use`));
          video.src=s.url;
          video.play().then(()=>{if(voEl)voEl.play().catch(()=>{})}).catch(rej);
        }).catch(e=>{failed=e});
        if(failed)break;
      }
    }catch(e){failed=e}
    cancelAnimationFrame(raf);
    try{video.pause();if(music)music.pause();rec.state!=="inactive"&&rec.stop()}catch(_){}
    await stopped;
    try{ac.close()}catch(_){}
    window.__kaCancel=null;busy=null;
    if(failed){say("Export stopped: "+failed.message,"error");paint();return}
    if(cancel){say("Export cancelled","");paint();return}
    const blob=new Blob(chunks,{type:mime||"video/webm"});
    const name=(String(p.concept||"film").replace(/[^\w]+/g,"_").slice(0,40)||"film")+".webm";
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
    say(`🎬 Film exported (${(blob.size/1048576).toFixed(1)} MB)`,"success");
    window.__kaLastExport={size:blob.size,type:blob.type,seconds:total};
    paint();
  }

  /* ───── UI ───── */
  function css(){
    if($("kaCss"))return;
    const s=document.createElement("style");s.id="kaCss";
    s.textContent=`.ka{padding:10px 12px 18px;display:flex;flex-direction:column;gap:12px}
.ka-card{border-radius:18px;padding:12px}
.ka-h{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--texts)}
.ka-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ka-btn{border:1px solid var(--glass-brd,var(--border));background:var(--glass,var(--surface));color:var(--violet);border-radius:12px;padding:9px 13px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
.ka-btn.pri{background:linear-gradient(135deg,rgba(98,64,176,.96),rgba(61,31,122,.96));color:#fff;border:0}
.ka-btn[disabled]{opacity:.5;cursor:not-allowed}
.ka-line{display:flex;gap:8px;align-items:flex-start;margin-top:8px}
.ka-n{flex:0 0 auto;font-size:10px;font-weight:800;color:var(--textm);width:34px;padding-top:9px}
.ka-ta{flex:1;min-width:0;resize:vertical;min-height:38px;border:1.5px solid var(--glass-brd,var(--border));border-radius:11px;background:var(--glass,var(--surface));color:var(--text);padding:8px 10px;font:inherit;font-size:12px}
.ka-stage{position:relative;border-radius:14px;overflow:hidden;background:#000}
.ka-stage video{width:100%;display:block;max-height:46vh;background:#000}
.ka-cap{position:absolute;left:6%;right:6%;bottom:8%;text-align:center;color:#fff;font-weight:700;font-size:14px;text-shadow:0 1px 4px #000,0 0 2px #000;display:none}
.ka-note{font-size:11px;color:var(--textm);line-height:1.5}
.ka-tag{font-size:10px;font-weight:800;border-radius:20px;padding:2px 8px;background:var(--lav);color:var(--violet)}
.ka input[type=range]{flex:1;min-width:90px}`;
    document.head.appendChild(s);
  }
  function paint(){
    if(!root||!root.isConnected)return;
    const p=production();
    if(!p){root.innerHTML=`<div class="ka"><div class="ka-note" style="text-align:center;padding:30px 10px">Start a production in the Chat tab. When scenes are ready they'll be joined here into one film.</div></div>`;return}
    const list=shots(p),st=state();
    if(!list.length){root.innerHTML=`<div class="ka"><div class="ka-note" style="text-align:center;padding:30px 10px">No scene clips yet. Once an episode's scene is generated, its clips appear here to cut together.</div></div>`;return}
    const total=list.reduce((a,s)=>a+dur(s),0);
    const haveVo=list.filter(s=>vo.get(s.key)).length,lined=list.filter(s=>(st.lines[s.key]||"").trim()).length;
    const dis=busy?"disabled":"";
    root.innerHTML=`<div class="ka">
      <div class="ka-card kc-glass">
        <div class="ka-row" style="justify-content:space-between"><span class="ka-h">Final cut</span><span class="ka-tag">${list.length} clips · ${Math.round(total)}s</span></div>
        <div class="ka-stage" style="margin-top:8px"><video id="kaVideo" playsinline controls></video><div id="kaCap" class="ka-cap"></div></div>
        <div class="ka-row" style="margin-top:8px">
          <button class="ka-btn pri" ${dis} onclick="KosmicAssembly.play()">▶ Play film</button>
          <button class="ka-btn" onclick="KosmicAssembly.stop()">■ Stop</button>
          <span id="kaNow" class="ka-note"></span>
        </div>
      </div>
      <div class="ka-card kc-glass">
        <div class="ka-row" style="justify-content:space-between"><span class="ka-h">Narration &amp; captions</span><span class="ka-tag">${lined}/${list.length} lines</span></div>
        <div class="ka-row" style="margin-top:8px">
          <button class="ka-btn" ${dis} onclick="KosmicAssembly.write()">✨ Write with AI</button>
          <button class="ka-btn" ${dis} onclick="KosmicAssembly.voice()">🎙 Voiceover${haveVo?` (${haveVo}/${lined||list.length})`:""}</button>
        </div>
        ${list.map((s,i)=>`<div class="ka-line"><div class="ka-n">#${i+1}<br><span style="font-weight:600">Ep${s.ep}</span></div><textarea class="ka-ta" rows="2" placeholder="${esc((s.desc||"Narration line…").slice(0,90))}" oninput="KosmicAssembly.setLine('${s.key}',this.value)">${esc(st.lines[s.key]||"")}</textarea></div>`).join("")}
        <div class="ka-row" style="margin-top:10px">
          <label class="ka-note"><input type="checkbox" ${st.captions?"checked":""} onchange="KosmicAssembly.opt('captions',this.checked)"> Captions on screen</label>
          <label class="ka-note"><input type="checkbox" ${st.voice?"checked":""} onchange="KosmicAssembly.opt('voice',this.checked)"> Use voiceover</label>
        </div>
        <div class="ka-row" style="margin-top:8px">
          <button class="ka-btn" onclick="KosmicAssembly.dl('srt')">⬇ .srt</button>
          <button class="ka-btn" onclick="KosmicAssembly.dl('vtt')">⬇ .vtt</button>
        </div>
      </div>
      <div class="ka-card kc-glass">
        <span class="ka-h">Music &amp; mix</span>
        <div class="ka-row" style="margin-top:8px">
          <input id="kaMusicPrompt" class="ka-ta" style="min-height:0" placeholder="Music style (optional) — e.g. tense synth noir">
          <button class="ka-btn" ${dis} onclick="KosmicAssembly.music()">🎼 ${st.music?"Re-compose":"Compose"}</button>
        </div>
        ${st.music?`<audio src="${esc(st.music)}" controls style="width:100%;margin-top:8px"></audio>`:""}
        <div class="ka-row" style="margin-top:8px"><span class="ka-note" style="width:86px">Clip audio</span><input type="range" min="0" max="1" step="0.05" value="${st.clipVol}" oninput="KosmicAssembly.opt('clipVol',+this.value)"></div>
        <div class="ka-row"><span class="ka-note" style="width:86px">Music</span><input type="range" min="0" max="1" step="0.05" value="${st.musicVol}" oninput="KosmicAssembly.opt('musicVol',+this.value)"></div>
      </div>
      <div class="ka-card kc-glass">
        <span class="ka-h">Export</span>
        <div class="ka-note" style="margin:6px 0 8px">Records the finished film on this device in real time (about ${Math.round(total)}s) and saves it as a WebM. Keep this screen open while it records.</div>
        <div class="ka-row">
          <button class="ka-btn pri" ${dis} onclick="KosmicAssembly.exportFilm()">🎬 Export film</button>
          ${busy&&window.__kaCancel?`<button class="ka-btn" onclick="__kaCancel()">Cancel</button>`:""}
          <button class="ka-btn" ${dis} onclick="finalizeProductionToEditor('${esc(p.id)}')">🎞 Open in Video Editor</button>
        </div>
        ${busy?`<div class="ka-note" style="margin-top:8px;font-weight:700;color:var(--violet)">${esc(busy)}</div>`:""}
      </div>
    </div>`;
    // keep the focused caption box from losing its place on repaint: only repaint on job changes
  }
  function render(el){
    css();root=el;paint();
    const p=production();
    if(p)shots(p).forEach(s=>{if(!durs.has(s.url))loadDur(s).then(()=>{if(!busy&&!pv)paint()})});
  }

  window.KosmicAssembly={
    render,play:playPreview,stop:stopPreview,write:writeLines,voice:makeVoice,music:makeMusic,exportFilm,
    setLine(key,v){state().lines[key]=v;persist()},
    opt(k,v){state()[k]=v;persist()},
    dl(kind){
      const p=production(),list=p&&shots(p);if(!list)return;const st=state();
      if(!cues(list,st).length){say("Write some narration lines first","error");return}
      kind==="vtt"?download("captions.vtt",vtt(list,st),"text/vtt"):download("captions.srt",srt(list,st),"application/x-subrip");
    },
    _srt:srt,_vtt:vtt,_shots:shots
  };
})();

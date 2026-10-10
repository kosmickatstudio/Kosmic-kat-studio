/* KOSMIC KAT — Video Studio (EvoLink)
 * Rebuilt from scratch. One self-contained file; replaces the old Video Canvas
 * stack (video-canvas-v3 + evolink-video-* + video-chat-* + video-v3-* layers).
 *
 * API contract (docs: evolink.ai/docs/en/api-manual/video-series/*):
 *   POST https://api.evolink.ai/v1/videos/generations   -> { id, status, progress, ... }
 *   GET  https://api.evolink.ai/v1/tasks/{id}            -> status pending|processing|completed|failed,
 *                                                           results[] (video URLs, valid 24h), usage.cost.usd
 * Auth: Bearer key stored in the existing "api_evolink" setting.
 *
 * Models: Seedance 2.5 (text / image / reference), Kling 3.0 (text / image),
 *         Kling 3.0 Turbo (text), Kling O3 (text / image / reference).
 */
(function KosmicVideoStudio(){
  "use strict";
  if(window.__kosmicVideoStudio)return;
  window.__kosmicVideoStudio=true;

  const API="https://api.evolink.ai";
  const LS_FORM="kk_video_form_v1",LS_JOBS="kk_video_jobs_v1";
  const IMG_SEED=["image/jpeg","image/png","image/webp"];
  const IMG_KLING=["image/jpeg","image/png"];
  const VID_FMT=["video/mp4","video/quicktime"];
  const AUD_FMT=["audio/wav","audio/x-wav","audio/mpeg","audio/mp3"];
  const AR_SEED=["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"];
  const AR_KLING=["16:9","9:16","1:1"];

  /* ───────────── catalog ───────────── */
  const SEED_Q=["480p","720p","1080p"];
  const seedBase={dur:[4,30],auto:true,q:SEED_Q,dq:"720p",audio:"seed",draft:true,relax:true,pmax:8000};
  const MODELS=[
    {id:"seedance-2.5",name:"Seedance 2.5",sub:"BytePlus · audio · 4–30s",family:"Seedance",routes:{
      text:{...seedBase,model:"seedance-2.5-text-to-video",ar:AR_SEED,dar:"adaptive",web:true,inputs:[],
        hint:"Describe subject, motion, camera and mood."},
      image:{...seedBase,model:"seedance-2.5-image-to-video",ar:["adaptive"],dar:"adaptive",inputs:[
        {key:"image_urls",kind:"image",label:"Frames",hint:"1 image = first frame · 2 images = first + last frame",min:1,max:2,fmt:IMG_SEED,maxMB:30}],
        hint:"Describe how the image should move."},
      reference:{...seedBase,model:"seedance-2.5-reference-to-video",ar:AR_SEED,dar:"adaptive",anyInput:true,inputs:[
        {key:"image_urls",kind:"image",label:"Reference images",hint:"Up to 30 · refer to them as @image1, @image2…",min:0,max:30,fmt:IMG_SEED,maxMB:30},
        {key:"video_urls",kind:"video",label:"Reference videos",hint:"Up to 10 · 2–30s each, 30s total · @video1…",min:0,max:10,fmt:VID_FMT,maxMB:200},
        {key:"audio_urls",kind:"audio",label:"Reference audio",hint:"Up to 10 · wav/mp3 · 2–30s each · @audio1…",min:0,max:10,fmt:AUD_FMT,maxMB:15}],
        hint:"Point at references with @image1, @video1, @audio1 (numbered in upload order)."}
    }},
    {id:"kling-v3",name:"Kling 3.0",sub:"Kling · 3–15s · up to 4K",family:"Kling",routes:{
      text:{model:"kling-v3-text-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",neg:true,pmax:2500,inputs:[],
        hint:"Describe subject, motion, camera and mood."},
      image:{model:"kling-v3-image-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",audio:"kling",neg:true,pmax:2500,inputs:[
        {key:"image_start",kind:"image",single:true,label:"First frame",hint:"JPG/PNG · ≤10MB · min 300px",min:1,max:1,fmt:IMG_KLING,maxMB:10},
        {key:"image_end",kind:"image",single:true,label:"Last frame (optional)",hint:"JPG/PNG · ≤10MB",min:0,max:1,fmt:IMG_KLING,maxMB:10}],
        hint:"Describe how the image should move."}
    }},
    {id:"kling-v3-turbo",name:"Kling 3.0 Turbo",sub:"Kling · fast · 3–15s",family:"Kling",routes:{
      text:{model:"kling-v3-turbo-text-to-video",dur:[3,15],q:["720p","1080p"],dq:"720p",ar:AR_KLING,dar:"16:9",pmax:2500,inputs:[],
        hint:"Describe subject, motion, camera and mood."}
    }},
    {id:"kling-o3",name:"Kling O3",sub:"Kling · refs & edits · 3–15s",family:"Kling",routes:{
      text:{model:"kling-o3-text-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",pmax:2500,inputs:[],
        hint:"Describe subject, motion, camera and mood."},
      image:{model:"kling-o3-image-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",pmax:2500,inputs:[
        {key:"image_start",kind:"image",single:true,label:"First frame",hint:"JPG/PNG · ≤10MB · min 300px",min:1,max:1,fmt:IMG_KLING,maxMB:10},
        {key:"image_end",kind:"image",single:true,label:"Last frame (optional)",hint:"JPG/PNG · ≤10MB",min:0,max:1,fmt:IMG_KLING,maxMB:10}],
        hint:"Describe how the image should move."},
      reference:{model:"kling-o3-reference-to-video",dur:[3,10],q:["720p","1080p"],dq:"720p",ar:AR_KLING,dar:"16:9",keepSound:true,anyInput:true,pmax:2500,inputs:[
        {key:"video_url",kind:"video",single:true,label:"Reference video",hint:"MP4/MOV · ≤200MB · ≥3s · 24–60fps",min:0,max:1,fmt:VID_FMT,maxMB:200},
        {key:"image_urls",kind:"image",label:"Reference images",hint:"Up to 4 when a video is used",min:0,max:4,fmt:IMG_KLING,maxMB:10}],
        hint:"Refer to media with <<<image_1>>> and <<<video_1>>>."}
    }}
  ];
  const MODE_LABEL={text:"Text",image:"Image",reference:"Reference"};

  /* ───────────── state ───────────── */
  const K={
    view:"generate",el:null,submitting:false,
    model:"seedance-2.5",mode:"text",prompt:"",negative:"",
    duration:5,durAuto:false,quality:"720p",aspect:"adaptive",
    audio:true,sound:false,draft:false,web:false,relaxed:false,keepSound:true,
    media:{},jobs:[]
  };
  const polling=new Set();

  const cur=()=>MODELS.find(m=>m.id===K.model)||MODELS[0];
  const route=()=>cur().routes[K.mode]||cur().routes[Object.keys(cur().routes)[0]];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+n)?+n:a));
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const rid=()=>Math.random().toString(36).slice(2,8);
  const say=(m,t)=>{try{typeof toast==="function"?toast(m,t||""):console.log(m)}catch(_){}};
  const getKey=()=>{try{return String(typeof gs==="function"?gs("api_evolink",""):"").trim()}catch(_){return""}};

  function normalize(){
    const m=cur();
    if(!m.routes[K.mode])K.mode=Object.keys(m.routes)[0];
    const r=route();
    K.duration=clamp(K.duration,r.dur[0],r.dur[1]);
    if(!r.auto)K.durAuto=false;
    if(!r.q.includes(K.quality))K.quality=r.dq;
    if(r.ar&&!r.ar.includes(K.aspect))K.aspect=r.dar;
    if(!r.draft)K.draft=false;
    if(!r.web)K.web=false;
    if(!r.relax)K.relaxed=false;
    if(K.relaxed&&K.web)K.web=false;
  }
  function saveForm(){
    try{
      const {model,mode,prompt,negative,duration,durAuto,quality,aspect,audio,sound,draft,web,relaxed,keepSound}=K;
      localStorage.setItem(LS_FORM,JSON.stringify({model,mode,prompt,negative,duration,durAuto,quality,aspect,audio,sound,draft,web,relaxed,keepSound}));
    }catch(_){}
  }
  function loadForm(){
    try{const f=JSON.parse(localStorage.getItem(LS_FORM)||"null");if(f&&typeof f==="object")Object.assign(K,f)}catch(_){}
    normalize();
  }
  function saveJobs(){
    try{
      K.jobs=K.jobs.slice(0,40);
      localStorage.setItem(LS_JOBS,JSON.stringify(K.jobs));
    }catch(_){}
  }
  function loadJobs(){
    try{const j=JSON.parse(localStorage.getItem(LS_JOBS)||"[]");if(Array.isArray(j))K.jobs=j.filter(x=>x&&x.id)}catch(_){}
  }

  /* ───────────── request building ───────────── */
  function mediaList(key){return(K.media[key]||[]).filter(x=>x&&x.url&&!x.uploading)}
  function buildBody(){
    normalize(); // always send values that are valid for the selected route
    const r=route(),body={model:r.model,prompt:K.prompt.trim()};
    body.duration=(r.auto&&K.durAuto)?-1:clamp(K.duration,r.dur[0],r.dur[1]);
    const draftOn=!!(r.draft&&K.draft);
    body.quality=draftOn?"480p":K.quality;
    if(draftOn)body.draft=true;
    if(r.ar)body.aspect_ratio=K.aspect;
    if(r.audio==="seed")body.generate_audio=!!K.audio;
    if(r.audio==="kling")body.sound=K.sound?"on":"off";
    if(r.relax&&K.relaxed)body.content_filter=false;
    if(r.web&&K.web&&!K.relaxed)body.model_params={web_search:true};
    if(r.neg&&K.negative.trim())body.negative_prompt=K.negative.trim();
    if(r.keepSound)body.keep_original_sound=!!K.keepSound;
    r.inputs.forEach(inp=>{
      const list=mediaList(inp.key);
      if(!list.length)return;
      body[inp.key]=inp.single?list[0].url:list.map(x=>x.url);
    });
    return body;
  }
  function validate(){
    normalize();
    const r=route();
    if(!getKey())return"Add your EvoLink API key in Settings first";
    if(!K.prompt.trim())return"Write a prompt first";
    if(K.prompt.length>r.pmax)return`Prompt is too long (max ${r.pmax} characters)`;
    let total=0;
    for(const inp of r.inputs){
      const all=K.media[inp.key]||[];
      if(all.some(x=>x.uploading))return"Wait for uploads to finish";
      const n=mediaList(inp.key).length;
      total+=n;
      if(n>inp.max)return`${inp.label}: max ${inp.max}`;
      if(n<inp.min)return`${inp.label}: add at least ${inp.min}`;
    }
    if(r.anyInput&&total===0)return"Add at least one reference (image, video or audio)";
    if(K.mode==="reference"&&K.model==="kling-o3"){
      const imgs=mediaList("image_urls").length,vid=mediaList("video_url").length;
      if(vid&&imgs>4)return"With a reference video, use at most 4 images";
    }
    if(r.relax&&K.relaxed&&K.web)return"Web search can't be combined with the relaxed content filter";
    return"";
  }

  /* ───────────── API ───────────── */
  function friendly(status,msg){
    if(status===401)return"EvoLink rejected the API key — check it in Settings";
    if(status===402)return"Not enough EvoLink credits — top up and try again";
    if(status===403)return"Your EvoLink account doesn't have access to this model";
    if(status===429)return"Rate limited by EvoLink — retrying shortly";
    return msg;
  }
  async function api(path,init){
    const key=getKey();
    if(!key){const e=new Error("Add your EvoLink API key in Settings first");e.status=401;throw e}
    let res;
    try{
      res=await fetch(API+path,{...(init||{}),headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"}});
    }catch(err){const e=new Error("Network error — check your connection");e.network=true;throw e}
    let data={};
    try{data=await res.json()}catch(_){}
    if(!res.ok){
      const raw=data?.error?.message||data?.message||data?.detail||`EvoLink error ${res.status}`;
      const e=new Error(friendly(res.status,raw));
      e.status=res.status;
      e.retryAfter=Number(res.headers?.get?.("Retry-After"))||Number(data?.error?.retry_after)||0;
      throw e;
    }
    return data;
  }
  function extractUrl(d){
    const c=[];
    const add=v=>{if(typeof v==="string"&&/^https?:\/\//i.test(v))c.push(v)};
    const walk=(v,depth)=>{
      if(v==null||depth>4)return;
      if(typeof v==="string")return add(v);
      if(Array.isArray(v))return v.forEach(x=>walk(x,depth+1));
      if(typeof v==="object")Object.values(v).forEach(x=>walk(x,depth+1));
    };
    walk(d?.results,0);walk(d?.result_data,0);walk(d?.result,0);walk(d?.output,0);
    add(d?.video_url);add(d?.url);
    return c.find(u=>/\.(mp4|mov|webm)(\?|$)/i.test(u))||c[0]||null;
  }

  /* ───────────── jobs ───────────── */
  async function submit(){
    if(K.submitting)return;
    const err=validate();
    if(err){say(err,"error");return}
    const r=route(),m=cur(),body=buildBody();
    K.submitting=true;refreshBar();
    const job={
      id:"kvj_"+Date.now().toString(36)+rid(),createdAt:Date.now(),status:"pending",progress:0,
      name:m.name,mode:K.mode,route:r.model,prompt:K.prompt.trim(),
      quality:body.quality,aspect:body.aspect_ratio||null,dur:body.duration,
      form:{model:K.model,mode:K.mode,prompt:K.prompt,negative:K.negative,duration:K.duration,durAuto:K.durAuto,quality:K.quality,aspect:K.aspect,audio:K.audio,sound:K.sound,draft:K.draft,web:K.web,relaxed:K.relaxed,keepSound:K.keepSound,
        media:Object.fromEntries(Object.entries(K.media).map(([k,v])=>[k,(v||[]).filter(x=>x.url&&!x.uploading).map(x=>({id:x.id,url:x.url,name:x.name,kind:x.kind}))]))}
    };
    K.jobs.unshift(job);saveJobs();syncJobs();
    try{
      const res=await api("/v1/videos/generations",{method:"POST",body:JSON.stringify(body)});
      const taskId=res?.id||res?.task_id||res?.data?.id;
      if(!taskId)throw new Error("EvoLink did not return a task ID");
      job.taskId=taskId;
      job.status=String(res.status||"pending").toLowerCase()==="processing"?"processing":"pending";
      saveJobs();syncCard(job);
      poll(job);
    }catch(e){
      fail(job,e);
    }finally{
      K.submitting=false;refreshBar();
    }
  }
  function fail(job,e){
    job.status="failed";
    job.error=(e&&e.message)||"Generation failed";
    saveJobs();syncCard(job);
    say("❌ "+job.error,"error");
  }
  async function poll(job){
    if(!job.taskId||polling.has(job.id))return;
    polling.add(job.id);
    const started=Date.now();
    let fails=0;
    try{
      while(job.status==="pending"||job.status==="processing"){
        await sleep(Date.now()-started>90000?6000:3000);
        if(!K.jobs.includes(job))break;
        try{
          const d=await api("/v1/tasks/"+encodeURIComponent(job.taskId));
          fails=0;
          if(Number.isFinite(d.progress))job.progress=clamp(d.progress,0,100);
          const st=String(d.status||"").toLowerCase();
          if(st==="completed"){
            const url=extractUrl(d);
            if(!url){fail(job,new Error("Finished, but EvoLink returned no video URL"));break}
            await finish(job,d,url);
            break;
          }
          if(st==="failed"){
            fail(job,new Error(d.error?.message||"Generation failed"));
            break;
          }
          job.status=st==="pending"?"pending":"processing";
          syncCard(job);
        }catch(e){
          if(e.status===429){await sleep(Math.max(5,e.retryAfter||10)*1000);continue}
          if(e.status===401||e.status===403||e.status===404){fail(job,e);break}
          if(++fails>=8){job.status="stalled";job.error=e.message;saveJobs();syncCard(job);break}
        }
        if(Date.now()-started>45*60*1000){job.status="stalled";job.error="Still running on EvoLink";saveJobs();syncCard(job);break}
      }
    }finally{
      polling.delete(job.id);
      saveJobs();
    }
  }
  async function finish(job,d,url){
    job.status="completed";job.progress=100;job.url=url;job.error=null;
    const usd=d?.usage?.cost?.usd;
    if(typeof usd==="number")job.usd=usd;
    if(Number.isFinite(d?.video_duration))job.videoDur=d.video_duration;
    try{
      if(typeof createVideoAsset==="function"){
        createVideoAsset(url,job.prompt,null,{model:job.route,providerLabel:"EvoLink · "+job.name,aspectRatio:job.aspect,resolution:job.quality,duration:job.videoDur||(job.dur>0?job.dur:null)});
        const a=(S.assets||[])[S.assets.length-1];
        if(a&&a.url===url){
          job.assetId=a.id;
          if(typeof rehostToStorage==="function"){
            rehostToStorage(url,"gallery-videos").then(h=>{
              if(h&&h!==url){
                const x=S.assets.find(z=>z.id===job.assetId);
                if(x){x.url=h;save("assets")}
                job.url=h;saveJobs();syncCard(job);
              }
            }).catch(()=>{});
          }
        }
      }
      if(typeof usd==="number"&&typeof logCost==="function")logCost("evolink:"+job.route,job.prompt.slice(0,60),1,usd);
    }catch(e){console.warn("Video saved to history only:",e)}
    saveJobs();syncCard(job);
    say(`🎬 ${job.name} video ready`,"success");
  }
  function resumeJobs(){
    K.jobs.forEach(j=>{
      if((j.status==="pending"||j.status==="processing")&&j.taskId&&Date.now()-j.createdAt<24*3600*1000)poll(j);
      else if((j.status==="pending"||j.status==="processing")&&!j.taskId){j.status="failed";j.error="Interrupted before it was submitted"}
    });
  }

  /* ───────────── media uploads ───────────── */
  async function uploadFile(file){
    if(typeof fbStorage==="undefined")throw new Error("Storage isn't available — paste a direct URL instead");
    const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";
    const ref=fbStorage.ref(`asset-library/${Date.now()}_${rid()}.${ext}`);
    await ref.put(file);
    return await ref.getDownloadURL();
  }
  function findInput(key){return route().inputs.find(i=>i.key===key)}
  function addMedia(key,item){
    const inp=findInput(key);if(!inp)return;
    if(inp.single)K.media[key]=[item];
    else{
      const list=K.media[key]||[];
      if(list.length>=inp.max){say(`${inp.label}: max ${inp.max}`,"error");return}
      K.media[key]=list.concat(item);
    }
  }
  async function handleFiles(key,files){
    const inp=findInput(key);if(!inp)return;
    for(const file of Array.from(files||[])){
      const okType=(inp.fmt||[]).includes(file.type)||(inp.kind==="image"&&!file.type&&/\.(jpe?g|png|webp)$/i.test(file.name));
      if(!okType){say(`${file.name}: unsupported format`,"error");continue}
      if(file.size>inp.maxMB*1048576){say(`${file.name}: over ${inp.maxMB}MB`,"error");continue}
      const item={id:"m_"+rid(),name:file.name,kind:inp.kind,uploading:true};
      addMedia(key,item);refreshMedia();
      try{
        item.url=await uploadFile(file);
        delete item.uploading;
      }catch(e){
        K.media[key]=(K.media[key]||[]).filter(x=>x!==item);
        say(`Upload failed: ${e.message}`,"error");
      }
      refreshMedia();
    }
  }
  async function pasteUrl(key){
    const inp=findInput(key);if(!inp)return;
    let v=null;
    try{
      v=typeof showPromptDialog==="function"
        ?await showPromptDialog("Paste a direct https:// link to the file","",{title:"Add by URL",okLabel:"Add"})
        :window.prompt("Paste a direct https:// link");
    }catch(_){}
    v=String(v||"").trim();
    if(!v)return;
    if(!safeUrl(v)){say("That isn't a valid https link","error");return}
    addMedia(key,{id:"m_"+rid(),name:v.split("/").pop().split("?")[0]||"link",kind:inp.kind,url:v});
    refreshMedia();
  }
  function libraryItems(kind){
    const out=[];
    try{
      (S.uploads||[]).forEach(u=>{if(u.kind===kind&&safeUrl(u.data))out.push({url:u.data,name:u.name||"Upload"})});
      (S.assets||[]).slice().reverse().forEach(a=>{if(a.type===kind&&safeUrl(a.url))out.push({url:a.url,name:String(a.prompt||a.type).slice(0,40)})});
    }catch(_){}
    return out.slice(0,80);
  }
  function openLibrary(key){
    const inp=findInput(key);if(!inp)return;
    const items=libraryItems(inp.kind);
    const old=document.getElementById("kvSheet");if(old)old.remove();
    const sheet=document.createElement("div");
    sheet.id="kvSheet";sheet.className="kv-sheet";
    const tile=it=>inp.kind==="image"
      ?`<img src="${esc(it.url)}" loading="lazy" alt="">`
      :inp.kind==="video"?`<video src="${esc(it.url)}" muted preload="metadata"></video>`:`<span>🎵</span>`;
    sheet.innerHTML=`<div class="kv-sheet-box"><div class="kv-sheet-head"><b>From your library</b><button data-sheet="close">✕</button></div>
      ${items.length?`<div class="kv-sheet-grid">${items.map((it,i)=>`<button class="kv-tile" data-sheet="pick" data-i="${i}" title="${esc(it.name)}">${tile(it)}</button>`).join("")}</div>`
      :`<div class="kv-empty">No ${inp.kind}s in your library yet. Upload one or paste a URL.</div>`}</div>`;
    sheet.addEventListener("click",e=>{
      const b=e.target.closest("[data-sheet]");
      if(e.target===sheet||(b&&b.dataset.sheet==="close")){sheet.remove();return}
      if(b&&b.dataset.sheet==="pick"){
        const it=items[Number(b.dataset.i)];
        if(it){addMedia(key,{id:"m_"+rid(),name:it.name,kind:inp.kind,url:it.url});refreshMedia()}
        if(inp.single||(K.media[key]||[]).length>=inp.max)sheet.remove();
      }
    });
    document.body.appendChild(sheet);
  }

  /* ───────────── view: studio ───────────── */
  function chips(field,values,selected,labelFn,disabled){
    return values.map(v=>`<button class="kv-chip${v===selected?" on":""}" data-act="set" data-f="${field}" data-v="${esc(v)}"${disabled?" disabled":""}>${esc(labelFn?labelFn(v):v)}</button>`).join("");
  }
  function thumb(it){
    const u=safeUrl(it.url);
    if(it.uploading)return`<div class="kv-thumb up"><span>Uploading…</span></div>`;
    const inner=it.kind==="image"?`<img src="${esc(u)}" alt="" loading="lazy">`
      :it.kind==="video"?`<video src="${esc(u)}" muted playsinline preload="metadata"></video>`
      :`<span class="kv-aud">🎵<small>${esc((it.name||"audio").slice(0,14))}</small></span>`;
    return`<div class="kv-thumb">${inner}</div>`;
  }
  function mediaHTML(){
    const r=route();
    if(!r.inputs.length)return"";
    return r.inputs.map(inp=>{
      const list=K.media[inp.key]||[];
      const full=list.length>=inp.max&&!inp.single;
      return`<div class="kv-card" data-slot="${inp.key}">
        <div class="kv-lab"><span>${esc(inp.label)}</span><small>${inp.single?(list.length?"1 added":""):`${list.length}/${inp.max}`}</small></div>
        <div class="kv-hint">${esc(inp.hint||"")}</div>
        ${list.length?`<div class="kv-thumbs">${list.map((it,i)=>`<div class="kv-thumbwrap">${thumb(it)}<button class="kv-x" data-act="rm" data-key="${inp.key}" data-i="${i}" aria-label="Remove">✕</button></div>`).join("")}</div>`:""}
        <div class="kv-row">
          <button class="kv-btn" data-act="pick" data-key="${inp.key}"${full?" disabled":""}>＋ Upload</button>
          <button class="kv-btn" data-act="lib" data-key="${inp.key}"${full?" disabled":""}>Library</button>
          <button class="kv-btn" data-act="url" data-key="${inp.key}"${full?" disabled":""}>Paste URL</button>
        </div>
        <input type="file" hidden data-file="${inp.key}" ${inp.single?"":"multiple"} accept="${esc((inp.fmt||[]).join(","))}">
      </div>`;
    }).join("");
  }
  function settingsHTML(){
    const r=route();
    const draftOn=!!(r.draft&&K.draft);
    const rows=[];
    rows.push(`<div class="kv-lab"><span>Duration</span><b id="kvDurVal">${r.auto&&K.durAuto?"Auto":K.duration+"s"}</b></div>
      <div class="kv-row kv-dur">
        <input type="range" class="kv-range" data-f="duration" min="${r.dur[0]}" max="${r.dur[1]}" value="${K.duration}"${r.auto&&K.durAuto?" disabled":""}>
        ${r.auto?`<button class="kv-chip${K.durAuto?" on":""}" data-act="auto">Auto</button>`:""}
      </div>
      <div class="kv-hint">${r.dur[0]}–${r.dur[1]} seconds${r.auto?" · Auto lets the model choose (billed by actual length)":""}</div>`);
    rows.push(`<div class="kv-lab"><span>Quality</span>${draftOn?"<small>Draft locks 480p</small>":""}</div>
      <div class="kv-chips">${chips("quality",r.q,draftOn?"480p":K.quality,v=>v==="4k"?"4K":v,draftOn)}</div>`);
    if(r.ar&&r.ar.length>1)rows.push(`<div class="kv-lab"><span>Aspect ratio</span></div>
      <div class="kv-chips">${chips("aspect",r.ar,K.aspect,v=>v==="adaptive"?"Auto":v)}</div>`);
    const toggles=[];
    if(r.audio==="seed")toggles.push(["audio","Generate audio",K.audio,"No extra charge"]);
    if(r.audio==="kling")toggles.push(["sound","Sound effects",K.sound,"Generates audio for the clip"]);
    if(r.keepSound)toggles.push(["keepSound","Keep original sound",K.keepSound,"Keep the reference video's audio"]);
    if(r.draft)toggles.push(["draft","Draft preview (480p)",K.draft,"Cheaper quick preview"]);
    if(r.web)toggles.push(["web","Web search",K.web&&!K.relaxed,"Let the model look things up (billed only when used)"]);
    if(r.relax)toggles.push(["relaxed","Relaxed content filter",K.relaxed,"Bills at 1.1× · can't be combined with web search"]);
    rows.push(toggles.map(t=>`<label class="kv-toggle"><input type="checkbox" data-f="${t[0]}" ${t[2]?"checked":""}><span><b>${esc(t[1])}</b><small>${esc(t[3])}</small></span></label>`).join(""));
    return rows.join("");
  }
  function studioHTML(){
    const m=cur(),r=route(),hasKey=!!getKey();
    const modes=Object.keys(m.routes);
    return`<div class="kv">
      <div class="kv-head">
        <div><div class="kv-title">Video Studio</div><div class="kv-subt">Powered by EvoLink</div></div>
        <button class="kv-pill ${hasKey?"ok":"warn"}" data-act="keyset">${hasKey?"● API key set":"Add API key"}</button>
      </div>
      ${hasKey?"":`<div class="kv-note">Add your EvoLink API key in Settings to start generating.</div>`}
      <div class="kv-models">${MODELS.map(x=>`<button class="kv-model${x.id===K.model?" on":""}" data-act="model" data-v="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div>
      <div class="kv-seg">${modes.map(x=>`<button class="${x===K.mode?"on":""}" data-act="mode" data-v="${x}">${MODE_LABEL[x]||x}</button>`).join("")}</div>
      <div class="kv-card">
        <div class="kv-lab"><span>Prompt</span><small id="kvCount">${K.prompt.length}/${r.pmax}</small></div>
        <textarea class="kv-ta" id="kvPrompt" data-f="prompt" rows="5" maxlength="${r.pmax}" placeholder="${esc(r.hint||"")}">${esc(K.prompt)}</textarea>
        ${r.neg?`<div class="kv-lab" style="margin-top:10px"><span>Negative prompt</span></div>
        <textarea class="kv-ta" data-f="negative" rows="2" placeholder="What to avoid (optional)">${esc(K.negative)}</textarea>`:""}
      </div>
      <div id="kvMedia">${mediaHTML()}</div>
      <div class="kv-card" id="kvSettings">${settingsHTML()}</div>
      <div class="kv-bar"><button class="kv-go" id="kvGo" data-act="generate"${K.submitting?" disabled":""}>${K.submitting?"Submitting…":"Generate"}</button></div>
      <div class="kv-hint kv-foot">Videos keep generating while you browse the app, and finished clips are saved to your Gallery. EvoLink result links last 24 hours.</div>
      <div id="kvJobs"></div>
    </div>`;
  }

  /* ───────────── view: gallery ───────────── */
  function galleryHTML(){
    let vids=[];
    try{vids=(S.assets||[]).filter(a=>a.type==="video"&&safeUrl(a.url)).slice(-80).reverse()}catch(_){}
    return`<div class="kv">
      <div class="kv-head"><div><div class="kv-title">Video Gallery</div><div class="kv-subt">${vids.length} video${vids.length===1?"":"s"}</div></div>
        <button class="kv-pill ok" data-act="tostudio">← Studio</button></div>
      ${vids.length?`<div class="kv-gal">${vids.map(a=>`<div class="kv-gcard">
        <video src="${esc(safeUrl(a.url))}" controls playsinline preload="metadata"></video>
        <div class="kv-gmeta">${esc(a.providerLabel||a.model||"Video")}${a.resolution?` · ${esc(a.resolution)}`:""}${a.duration?` · ${esc(a.duration)}s`:""}</div>
        <div class="kv-gprompt">${esc(String(a.prompt||"").slice(0,90))}</div>
        <div class="kv-row">
          <button class="kv-btn" data-act="gdl" data-id="${esc(a.id)}">Download</button>
          <button class="kv-btn" data-act="greuse" data-id="${esc(a.id)}">Reuse prompt</button>
          ${typeof openCollectionPicker==="function"?`<button class="kv-btn" data-act="gcol" data-id="${esc(a.id)}">📁</button>`:""}
        </div></div>`).join("")}</div>`
      :`<div class="kv-empty">No videos yet. Generate one in the Studio and it appears here.</div>`}
    </div>`;
  }

  /* ───────────── job cards ───────────── */
  const STATUS_TXT={pending:"Queued",processing:"Generating",completed:"Done",failed:"Failed",stalled:"Taking longer than usual"};
  function elapsed(job){
    const s=Math.max(0,Math.round((Date.now()-job.createdAt)/1000));
    return s>=60?`${Math.floor(s/60)}m ${s%60}s`:`${s}s`;
  }
  function cardInner(job){
    const head=`<div class="kv-jhead"><b>${esc(job.name)}</b><span class="kv-jmode">${esc(MODE_LABEL[job.mode]||job.mode)}${job.quality?` · ${esc(job.quality)}`:""}${job.dur>0?` · ${esc(job.dur)}s`:job.dur===-1?" · auto":""}</span></div>`;
    const prompt=`<div class="kv-jprompt">${esc(job.prompt.slice(0,110))}</div>`;
    if(job.status==="completed"){
      const u=safeUrl(job.url);
      return`${head}${u?`<video class="kv-vid" src="${esc(u)}" controls playsinline preload="metadata"></video>`:""}${prompt}
        <div class="kv-jmeta">${job.usd!=null?`Cost $${Number(job.usd).toFixed(3)}`:""}${job.videoDur?` · ${Number(job.videoDur).toFixed(1)}s clip`:""}</div>
        <div class="kv-row"><button class="kv-btn" data-act="jdl" data-id="${job.id}">Download</button>
        <button class="kv-btn" data-act="jcopy" data-id="${job.id}">Copy link</button>
        <button class="kv-btn" data-act="jreuse" data-id="${job.id}">Reuse</button>
        <button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    }
    if(job.status==="failed")return`${head}${prompt}<div class="kv-err">${esc(job.error||"Generation failed")}</div>
      <div class="kv-row"><button class="kv-btn" data-act="jreuse" data-id="${job.id}">Reuse settings</button><button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    if(job.status==="stalled")return`${head}${prompt}<div class="kv-err">${esc(job.error||STATUS_TXT.stalled)}. The job may still finish on EvoLink.</div>
      <div class="kv-row"><button class="kv-btn" data-act="jrecheck" data-id="${job.id}">Check again</button><button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    return`${head}${prompt}<div class="kv-prog"><i style="width:${clamp(job.progress,0,100)}%"></i></div>
      <div class="kv-jmeta"><span class="kv-jstat">${STATUS_TXT[job.status]||job.status}${job.progress?` ${Math.round(job.progress)}%`:""}</span> · <span class="kv-jtime">${elapsed(job)}</span></div>`;
  }
  function jobsRoot(){return document.getElementById("kvJobs")}
  function syncCard(job){
    const root=jobsRoot();if(!root)return;
    let card=root.querySelector(`[data-job="${job.id}"]`);
    if(!card){
      card=document.createElement("div");card.className="kv-job";card.dataset.job=job.id;
      root.insertBefore(card,root.firstChild);
    }
    if(card.dataset.state!==job.status){
      card.dataset.state=job.status;
      card.innerHTML=cardInner(job);
    }else{
      const bar=card.querySelector(".kv-prog i");if(bar)bar.style.width=clamp(job.progress,0,100)+"%";
      const st=card.querySelector(".kv-jstat");if(st)st.textContent=(STATUS_TXT[job.status]||job.status)+(job.progress?` ${Math.round(job.progress)}%`:"");
      if(job.status==="completed"){
        const v=card.querySelector("video.kv-vid"),u=safeUrl(job.url);
        if(v&&u&&v.getAttribute("src")!==u&&v.paused)v.setAttribute("src",u);
      }
    }
  }
  function syncJobs(){
    const root=jobsRoot();if(!root)return;
    const ids=new Set(K.jobs.map(j=>j.id));
    root.querySelectorAll("[data-job]").forEach(c=>{if(!ids.has(c.dataset.job))c.remove()});
    // create/update cards oldest→newest so new ones land on top, then fix order
    K.jobs.slice().reverse().forEach(syncCard);
    const order=K.jobs.map(j=>j.id);
    order.forEach((id,i)=>{const c=root.querySelector(`[data-job="${id}"]`);if(c&&root.children[i]!==c)root.insertBefore(c,root.children[i]||null)});
  }
  function refreshMedia(){
    const el=document.getElementById("kvMedia");if(el)el.innerHTML=mediaHTML();
  }
  function refreshBar(){
    const b=document.getElementById("kvGo");
    if(b){b.disabled=K.submitting;b.textContent=K.submitting?"Submitting…":"Generate"}
  }
  setInterval(()=>{
    const root=jobsRoot();if(!root||!root.isConnected)return;
    K.jobs.forEach(j=>{
      if(j.status!=="pending"&&j.status!=="processing")return;
      const t=root.querySelector(`[data-job="${j.id}"] .kv-jtime`);if(t)t.textContent=elapsed(j);
    });
  },1000);

  /* ───────────── events ───────────── */
  function download(url,name){
    const u=safeUrl(url);if(!u)return;
    const a=document.createElement("a");a.href=u;a.download=name||"video.mp4";a.target="_blank";a.rel="noopener";
    document.body.appendChild(a);a.click();a.remove();
  }
  function applyForm(f){
    if(!f)return;
    ["model","mode","prompt","negative","duration","durAuto","quality","aspect","audio","sound","draft","web","relaxed","keepSound"].forEach(k=>{if(f[k]!==undefined)K[k]=f[k]});
    K.media=f.media?JSON.parse(JSON.stringify(f.media)):{};
    normalize();saveForm();
  }
  function onClick(e){
    const t=e.target.closest("[data-act]");
    if(!t||!t.closest(".kv"))return;
    const act=t.dataset.act,v=t.dataset.v;
    switch(act){
      case"model":K.model=v;normalize();saveForm();render();break;
      case"mode":K.mode=v;normalize();saveForm();render();break;
      case"set":K[t.dataset.f]=v;saveForm();render();break;
      case"auto":K.durAuto=!K.durAuto;saveForm();render();break;
      case"pick":{const inp=document.querySelector(`input[data-file="${t.dataset.key}"]`);inp&&inp.click();break}
      case"lib":openLibrary(t.dataset.key);break;
      case"url":pasteUrl(t.dataset.key);break;
      case"rm":{const k=t.dataset.key;K.media[k]=(K.media[k]||[]).filter((_,i)=>i!==Number(t.dataset.i));refreshMedia();break}
      case"keyset":typeof openSettings==="function"?openSettings():say("Open Settings to add your EvoLink key");break;
      case"generate":submit();break;
      case"tostudio":K.view="generate";render();break;
      case"jdl":{const j=K.jobs.find(x=>x.id===t.dataset.id);j&&download(j.url,`${j.route}.mp4`);break}
      case"jcopy":{const j=K.jobs.find(x=>x.id===t.dataset.id);
        if(j&&navigator.clipboard)navigator.clipboard.writeText(j.url).then(()=>say("Link copied","success"),()=>say("Couldn't copy","error"));break}
      case"jreuse":{const j=K.jobs.find(x=>x.id===t.dataset.id);if(j){applyForm(j.form);render();const p=document.getElementById("kvPrompt");if(p&&p.scrollIntoView)p.scrollIntoView({behavior:"smooth",block:"center"})}break}
      case"jrm":{K.jobs=K.jobs.filter(x=>x.id!==t.dataset.id);saveJobs();syncJobs();break}
      case"jrecheck":{const j=K.jobs.find(x=>x.id===t.dataset.id);if(j){j.status="processing";j.error=null;saveJobs();syncCard(j);poll(j)}break}
      case"gdl":{const a=(S.assets||[]).find(x=>x.id===t.dataset.id);a&&download(a.url,`${a.model||"video"}.mp4`);break}
      case"greuse":{const a=(S.assets||[]).find(x=>x.id===t.dataset.id);
        if(a){K.prompt=String(a.prompt||"");saveForm();K.view="generate";render();markTab("Generate")}break}
      case"gcol":openCollectionPicker("asset",t.dataset.id);break;
    }
  }
  let formTimer=0;
  function onInput(e){
    const t=e.target;
    if(!t.closest||!t.closest(".kv"))return;
    const f=t.dataset&&t.dataset.f;if(!f)return;
    if(f==="prompt"||f==="negative"){
      K[f]=t.value;
      if(f==="prompt"){const c=document.getElementById("kvCount");if(c)c.textContent=`${t.value.length}/${route().pmax}`}
    }else if(f==="duration"){
      K.duration=Number(t.value);
      const d=document.getElementById("kvDurVal");if(d)d.textContent=K.duration+"s";
    }else return;
    clearTimeout(formTimer);formTimer=setTimeout(saveForm,400);
  }
  function onChange(e){
    const t=e.target;
    if(!t.closest||!t.closest(".kv"))return;
    if(t.dataset&&t.dataset.file){handleFiles(t.dataset.file,t.files).then(()=>{t.value=""});return}
    const f=t.dataset&&t.dataset.f;
    if(f&&t.type==="checkbox"){
      K[f]=t.checked;
      if(f==="relaxed"&&t.checked)K.web=false;
      if(f==="web"&&t.checked)K.relaxed=false;
      normalize();saveForm();
      const s=document.getElementById("kvSettings");if(s)s.innerHTML=settingsHTML();
    }
  }
  function bind(el){
    if(el.__kvBound)return;
    el.__kvBound=true;
    el.addEventListener("click",onClick);
    el.addEventListener("input",onInput);
    el.addEventListener("change",onChange);
  }

  /* ───────────── render + module hooks ───────────── */
  function injectCss(){
    if(document.getElementById("kv-css"))return;
    const s=document.createElement("style");s.id="kv-css";
    s.textContent=`
.kv{max-width:760px;margin:0 auto;padding:12px 12px 90px;color:var(--text,#1e1230);font-size:13px}
.kv *{box-sizing:border-box}
.kv-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.kv-title{font-size:18px;font-weight:800;color:var(--violet,#3d1f7a)}
.kv-subt{font-size:10px;color:var(--texts,#9488ae);margin-top:1px}
.kv-pill{border:1px solid var(--border,rgba(61,31,122,.14));background:var(--surface,#fff);color:var(--textm,#5a4880);border-radius:999px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer}
.kv-pill.ok{color:var(--violet,#3d1f7a)}.kv-pill.warn{background:var(--violet,#3d1f7a);color:#fff;border-color:transparent}
.kv-note{background:var(--lav,#ede7f9);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:var(--textm,#5a4880)}
.kv-models{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px;scrollbar-width:none}.kv-models::-webkit-scrollbar{display:none}
.kv-model{flex:0 0 auto;min-width:132px;text-align:left;border:1px solid var(--border,rgba(61,31,122,.12));background:var(--surface,#fff);color:var(--text,#1e1230);border-radius:14px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.kv-model b{font-size:12.5px}.kv-model small{font-size:9.5px;color:var(--texts,#9488ae)}
.kv-model.on{border-color:var(--vm,#6240b0);background:var(--lav,#ede7f9);box-shadow:0 0 0 1px var(--vm,#6240b0) inset}
.kv-seg{display:flex;background:var(--pearl2,#f3eff8);border-radius:12px;padding:3px;margin-bottom:10px}
.kv-seg button{flex:1;border:0;background:transparent;color:var(--textm,#5a4880);padding:9px 6px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer}
.kv-seg button.on{background:var(--surface,#fff);color:var(--violet,#3d1f7a);box-shadow:0 1px 6px rgba(61,31,122,.12)}
.kv-card{background:var(--surface,#fff);border:1px solid var(--border,rgba(61,31,122,.1));border-radius:16px;padding:12px;margin-bottom:10px}
.kv-lab{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800;color:var(--textm,#5a4880);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.kv-lab small{font-weight:600;text-transform:none;letter-spacing:0;color:var(--texts,#9488ae)}.kv-lab b{color:var(--violet,#3d1f7a);font-size:13px;text-transform:none;letter-spacing:0}
.kv-hint{font-size:10.5px;color:var(--texts,#9488ae);line-height:1.4;margin:2px 0 8px}
.kv-ta{width:100%;border:1px solid var(--border,rgba(61,31,122,.12));background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);border-radius:12px;padding:10px 12px;font:inherit;font-size:13px;line-height:1.45;resize:vertical;outline:0}
.kv-ta:focus{border-color:var(--vm,#6240b0)}
.kv-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kv-btn{flex:1 1 auto;border:1px solid var(--border,rgba(61,31,122,.14));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);border-radius:10px;padding:9px 10px;font-size:11.5px;font-weight:700;cursor:pointer}
.kv-btn:disabled,.kv-chip:disabled{opacity:.45;cursor:not-allowed}
.kv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.kv-chip{border:1px solid var(--border,rgba(61,31,122,.14));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);border-radius:999px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer}
.kv-chip.on{background:var(--violet,#3d1f7a);color:#fff;border-color:transparent}
.kv-dur{flex-wrap:nowrap}.kv-range{flex:1;height:30px;accent-color:var(--violet,#3d1f7a)}
.kv-toggle{display:flex;align-items:flex-start;gap:10px;padding:8px 2px;cursor:pointer}
.kv-toggle input{width:20px;height:20px;margin-top:1px;accent-color:var(--violet,#3d1f7a);flex:0 0 auto}
.kv-toggle span{display:flex;flex-direction:column;gap:1px}.kv-toggle b{font-size:12.5px}.kv-toggle small{font-size:10.5px;color:var(--texts,#9488ae)}
.kv-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.kv-thumbwrap{position:relative}
.kv-thumb{width:68px;height:68px;border-radius:10px;overflow:hidden;background:var(--lav,#ede7f9);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--textm,#5a4880);text-align:center}
.kv-thumb img,.kv-thumb video{width:100%;height:100%;object-fit:cover}
.kv-aud{display:flex;flex-direction:column;align-items:center;font-size:18px}.kv-aud small{font-size:8px}
.kv-x{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:var(--violet,#3d1f7a);color:#fff;font-size:10px;cursor:pointer}
.kv-bar{position:sticky;bottom:0;padding:10px 0 4px;background:linear-gradient(to top,var(--pearl,#faf8f5) 70%,transparent);z-index:5}
.kv-go{width:100%;min-height:50px;border:0;border-radius:15px;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--vm,#6240b0));color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(61,31,122,.28)}
.kv-go:disabled{opacity:.6;cursor:wait}
.kv-foot{text-align:center;margin:6px 4px 14px}
.kv-job{background:var(--surface,#fff);border:1px solid var(--border,rgba(61,31,122,.1));border-radius:16px;padding:12px;margin-bottom:10px}
.kv-jhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px}.kv-jhead b{font-size:13px;color:var(--violet,#3d1f7a)}
.kv-jmode{font-size:10.5px;color:var(--texts,#9488ae)}
.kv-jprompt,.kv-gprompt{font-size:11.5px;color:var(--textm,#5a4880);margin:4px 0 8px;line-height:1.4;overflow-wrap:anywhere}
.kv-jmeta,.kv-gmeta{font-size:10.5px;color:var(--texts,#9488ae);margin-bottom:8px}
.kv-prog{height:7px;border-radius:99px;background:var(--lav2,#d8ccf5);overflow:hidden;margin:8px 0 6px}
.kv-prog i{display:block;height:100%;background:linear-gradient(90deg,var(--violet,#3d1f7a),var(--vs,#9b7fd4));border-radius:99px;transition:width .6s ease}
.kv-vid{width:100%;border-radius:12px;background:#000;max-height:60vh}
.kv-err{background:rgba(200,50,70,.1);color:#b3263e;border-radius:10px;padding:9px 11px;font-size:11.5px;margin:6px 0 8px;overflow-wrap:anywhere}
.kv-empty{text-align:center;color:var(--texts,#9488ae);padding:36px 16px;font-size:12.5px}
.kv-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.kv-gcard{background:var(--surface,#fff);border:1px solid var(--border,rgba(61,31,122,.1));border-radius:14px;padding:8px}
.kv-gcard video{width:100%;border-radius:10px;background:#000;aspect-ratio:16/9;object-fit:cover}
.kv-gmeta{margin:6px 0 2px}
.kv-sheet{position:fixed;inset:0;z-index:10050;background:rgba(15,8,32,.55);display:flex;align-items:flex-end;justify-content:center}
.kv-sheet-box{width:min(560px,100%);max-height:78vh;overflow:auto;background:var(--surface,#fff);color:var(--text,#1e1230);border-radius:20px 20px 0 0;padding:14px}
.kv-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kv-sheet-head button{border:0;background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);border-radius:50%;width:32px;height:32px;cursor:pointer}
.kv-sheet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kv-tile{aspect-ratio:1;border:1px solid var(--border,rgba(61,31,122,.12));background:var(--lav,#ede7f9);border-radius:12px;padding:0;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}
.kv-tile img,.kv-tile video{width:100%;height:100%;object-fit:cover}
@media(min-width:700px){.kv-sheet{align-items:center}.kv-sheet-box{border-radius:20px}}
`;
    document.head.appendChild(s);
  }
  function render(){
    const el=(K.el&&K.el.isConnected)?K.el:document.getElementById("moduleContent");
    if(!el)return;
    K.el=el;injectCss();bind(el);
    el.innerHTML=K.view==="gallery"?galleryHTML():studioHTML();
    if(K.view==="generate")syncJobs();
  }
  function markTab(label){
    try{document.querySelectorAll("#moduleTabs .inner-tab").forEach(t=>t.classList.toggle("active",t.textContent.trim()===label))}catch(_){}
  }

  // Take over the module entry points the shell already calls.
  window.renderVideoCanvas=function(el){
    K.view="generate";
    if(el)K.el=el;
    normalize();
    render();
    resumeJobs();
  };
  window.showVcChatView=function(){K.view="generate";render();markTab("Generate")};
  window.showVcGalleryView=function(){K.view="gallery";render();markTab("Gallery")};

  window.KosmicVideo={MODELS,state:K,buildBody,validate,extractUrl,render};

  loadForm();loadJobs();
  try{
    if(typeof S!=="undefined"&&S.mod==="videocanvas"&&document.getElementById("moduleContent"))window.renderVideoCanvas(document.getElementById("moduleContent"));
  }catch(_){}
})();

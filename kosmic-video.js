/* KOSMIC KAT — Video Studio (EvoLink) — chat edition
 * One self-contained file; replaces the old Video Canvas stack.
 *
 * UI: a glassmorphic chat. Prompts are sent from the composer; a slide-up
 * "shutter" sheet holds model / mode / references / settings. Chats can be
 * loaded, started fresh, or deleted.
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
  const LS_FORM="kk_video_form_v1",LS_OLDJOBS="kk_video_jobs_v1";
  const LS_CHATS="kk_video_chats_v2",LS_ACTIVE="kk_video_active_v2",LS_MIGRATED="kk_video_migrated_v2";
  const MAX_SESSIONS=30,MAX_MESSAGES=150;
  const IMG_SEED=["image/jpeg","image/png","image/webp"];
  const IMG_KLING=["image/jpeg","image/png"];
  const VID_FMT=["video/mp4","video/quicktime"];
  const AUD_FMT=["audio/wav","audio/x-wav","audio/mpeg","audio/mp3"];
  const AR_SEED=["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"];
  const AR_KLING=["16:9","9:16","1:1"];

  /* ───────────── icons ───────────── */
  const svg=p=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC={
    menu:svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    plus:svg('<path d="M12 5v14M5 12h14"/>'),
    trash:svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    sliders:svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    send:svg('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
    spark:svg('<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>'),
    film:svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>'),
    chev:svg('<path d="M6 15l6-6 6 6"/>'),
    back:svg('<path d="M15 6l-6 6 6 6"/>')
  };

  /* ───────────── catalog ───────────── */
  const SEED_Q=["480p","720p","1080p"];
  const SEED_Q4=["480p","720p","1080p","4k"];
  const SEED_Q2=["480p","720p"];
  const AR_SEED10=["16:9","9:16","1:1","4:3","3:4","21:9"];
  const seedBase={dur:[4,30],auto:true,q:SEED_Q,dq:"720p",audio:"seed",draft:true,relax:true,pmax:8000};
  const imgIn=(max,maxMB,o)=>({key:"image_urls",kind:"image",min:0,max,fmt:IMG_SEED,maxMB,...o});
  const frames=(maxMB)=>imgIn(2,maxMB,{label:"Frames",hint:"1 image = first frame · 2 images = first + last frame",min:1});
  const refs20=(vidMB)=>[
    imgIn(9,30,{label:"Reference images",hint:"Up to 9 · refer to them as @image1, @image2…"}),
    {key:"video_urls",kind:"video",label:"Reference videos",hint:"Up to 3 · 2–15s each, 15s total · @video1…",min:0,max:3,fmt:VID_FMT,maxMB:vidMB},
    {key:"audio_urls",kind:"audio",label:"Reference audio",hint:"Up to 3 · wav/mp3 · 2–15s each · needs an image or video too",min:0,max:3,fmt:AUD_FMT,maxMB:15}];
  const editIns=(first,hint)=>[
    {key:"video_urls",kind:"video",label:first,hint,min:1,max:10,fmt:VID_FMT,maxMB:200},
    imgIn(30,30,{label:"Reference images",hint:"Optional · up to 30 · @image1…"}),
    {key:"audio_urls",kind:"audio",label:"Reference audio",hint:"Optional · up to 10 · wav/mp3 · 2–30s each",min:0,max:10,fmt:AUD_FMT,maxMB:15}];
  const std20={dur:[4,15],q:SEED_Q4,dq:"720p",audio:"seed",relax:true,pmax:8000};
  const fast20={dur:[4,15],q:SEED_Q2,dq:"720p",audio:"seed",relax:true,pmax:8000};
  const family20=(base,prefix,web)=>({
    text:{...base,model:`${prefix}-text-to-video`,ar:AR_SEED,dar:"adaptive",web,inputs:[],hint:"Describe the video you want…"},
    image:{...base,model:`${prefix}-image-to-video`,ar:AR_SEED,dar:"adaptive",inputs:[frames(30)],hint:"Describe how the image should move…"},
    reference:{...base,model:`${prefix}-reference-to-video`,ar:AR_SEED,dar:"adaptive",anyInput:true,noAudioOnly:true,inputs:refs20(base===std20?50:50),hint:"Use @image1, @video1, @audio1 to point at your references…"}
  });
  const MODELS=[
    {id:"seedance-2.5",name:"Seedance 2.5",sub:"Newest · audio · 4–30s",family:"Seedance",routes:{
      text:{...seedBase,model:"seedance-2.5-text-to-video",ar:AR_SEED,dar:"adaptive",web:true,inputs:[],
        hint:"Describe the video you want…"},
      image:{...seedBase,model:"seedance-2.5-image-to-video",ar:["adaptive"],dar:"adaptive",inputs:[frames(30)],
        hint:"Describe how the image should move…"},
      reference:{...seedBase,model:"seedance-2.5-reference-to-video",ar:AR_SEED,dar:"adaptive",anyInput:true,inputs:[
        imgIn(30,30,{label:"Reference images",hint:"Up to 30 · refer to them as @image1, @image2…"}),
        {key:"video_urls",kind:"video",label:"Reference videos",hint:"Up to 10 · 2–30s each, 30s total · @video1…",min:0,max:10,fmt:VID_FMT,maxMB:200},
        {key:"audio_urls",kind:"audio",label:"Reference audio",hint:"Up to 10 · wav/mp3 · 2–30s each · @audio1…",min:0,max:10,fmt:AUD_FMT,maxMB:15}],
        hint:"Use @image1, @video1, @audio1 to point at your references…"},
      edit:{...seedBase,model:"seedance-2.5-video-edit",fixedDur:true,ar:["adaptive"],dar:"adaptive",
        inputs:editIns("Video to edit","The first video is edited · up to 10 · 4–30s each, 30s total · @video1…"),
        hint:"Describe the edit, e.g. “change the jacket to red leather”…"},
      extend:{...seedBase,model:"seedance-2.5-video-extend",ar:["adaptive"],dar:"adaptive",
        inputs:editIns("Video to extend","The first video is extended · up to 10 · 2–30s each, 30s total · @video1…"),
        hint:"Describe how the video should continue…"},
      final:{kind:"final",model:"seedance-2.5-draft-to-video",dur:[4,30],q:["1080p"],dq:"1080p",pmax:8000,inputs:[],
        hint:"Pick a finished draft in settings, then tap send"}
    }},
    {id:"seedance-2.0",name:"Seedance 2.0",sub:"BytePlus · audio · up to 4K · 4–15s",family:"Seedance",routes:family20(std20,"seedance-2.0",true)},
    {id:"seedance-2.0-fast",name:"Seedance 2.0 Fast",sub:"BytePlus · cheaper · 4–15s",family:"Seedance",routes:family20(fast20,"seedance-2.0-fast",false)},
    {id:"seedance-2.0-mini",name:"Seedance 2.0 Mini",sub:"BytePlus · lowest cost · 4–15s",family:"Seedance",routes:family20(fast20,"seedance-2.0-mini",false)},
    {id:"seedance-1.5-pro",name:"Seedance 1.5 Pro",sub:"BytePlus · audio · 4–12s",family:"Seedance",routes:{
      text:{model:"seedance-1.5-pro",dur:[4,12],q:SEED_Q,dq:"720p",ar:AR_SEED,dar:"16:9",audio:"seed",pmax:4000,inputs:[],hint:"Describe the video you want…"},
      image:{model:"seedance-1.5-pro",dur:[4,12],q:SEED_Q,dq:"720p",ar:AR_SEED,dar:"adaptive",audio:"seed",pmax:4000,inputs:[frames(10)],hint:"Describe how the image should move…"}
    }},
    {id:"seedance-1.0-fast",name:"Seedance 1.0 Pro Fast",sub:"BytePlus · fast · 2–12s",family:"Seedance",routes:{
      text:{model:"doubao-seedance-1.0-pro-fast",dur:[2,12],q:SEED_Q,dq:"1080p",ar:AR_SEED10,dar:"16:9",pmax:4000,inputs:[],hint:"Describe the video you want…"},
      image:{model:"doubao-seedance-1.0-pro-fast",dur:[2,12],q:SEED_Q,dq:"1080p",ar:[...AR_SEED10,"keep_ratio","adaptive"],dar:"adaptive",pmax:4000,inputs:[imgIn(1,10,{label:"Image",hint:"1 image · JPG/PNG/WebP · ≤10MB",min:1})],hint:"Describe how the image should move…"}
    }},
    {id:"kling-v3",name:"Kling 3.0",sub:"Kling · 3–15s · up to 4K",family:"Kling",routes:{
      text:{model:"kling-v3-text-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",neg:true,pmax:2500,inputs:[],
        hint:"Describe the video you want…"},
      image:{model:"kling-v3-image-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",audio:"kling",neg:true,pmax:2500,inputs:[
        {key:"image_start",kind:"image",single:true,label:"First frame",hint:"JPG/PNG · ≤10MB · min 300px",min:1,max:1,fmt:IMG_KLING,maxMB:10},
        {key:"image_end",kind:"image",single:true,label:"Last frame (optional)",hint:"JPG/PNG · ≤10MB",min:0,max:1,fmt:IMG_KLING,maxMB:10}],
        hint:"Describe how the image should move…"}
    }},
    {id:"kling-v3-turbo",name:"Kling 3.0 Turbo",sub:"Kling · fast · 3–15s",family:"Kling",routes:{
      text:{model:"kling-v3-turbo-text-to-video",dur:[3,15],q:["720p","1080p"],dq:"720p",ar:AR_KLING,dar:"16:9",pmax:2500,inputs:[],
        hint:"Describe the video you want…"}
    }},
    {id:"kling-o3",name:"Kling O3",sub:"Kling · refs & edits · 3–15s",family:"Kling",routes:{
      text:{model:"kling-o3-text-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",pmax:2500,inputs:[],
        hint:"Describe the video you want…"},
      image:{model:"kling-o3-image-to-video",dur:[3,15],q:["720p","1080p","4k"],dq:"720p",ar:AR_KLING,dar:"16:9",audio:"kling",pmax:2500,inputs:[
        {key:"image_start",kind:"image",single:true,label:"First frame",hint:"JPG/PNG · ≤10MB · min 300px",min:1,max:1,fmt:IMG_KLING,maxMB:10},
        {key:"image_end",kind:"image",single:true,label:"Last frame (optional)",hint:"JPG/PNG · ≤10MB",min:0,max:1,fmt:IMG_KLING,maxMB:10}],
        hint:"Describe how the image should move…"},
      reference:{model:"kling-o3-reference-to-video",dur:[3,10],q:["720p","1080p"],dq:"720p",ar:AR_KLING,dar:"16:9",keepSound:true,anyInput:true,pmax:2500,inputs:[
        {key:"video_url",kind:"video",single:true,label:"Reference video",hint:"MP4/MOV · ≤200MB · ≥3s · 24–60fps",min:0,max:1,fmt:VID_FMT,maxMB:200},
        {key:"image_urls",kind:"image",label:"Reference images",hint:"Up to 4 when a video is used",min:0,max:4,fmt:IMG_KLING,maxMB:10}],
        hint:"Refer to media with <<<image_1>>> and <<<video_1>>>…"}
    }}
  ];
  const MODE_LABEL={text:"Text",image:"Image",reference:"Reference",edit:"Edit",extend:"Extend",final:"Draft → 1080p"};
  const IDEAS=[
    "A lone astronaut walking across a neon-lit desert at dusk, slow dolly shot",
    "Macro shot of rain drops hitting a glowing cyberpunk window, shallow depth of field",
    "A paper boat sailing through a flooded city street at golden hour, cinematic"
  ];

  /* ───────────── state ───────────── */
  const K={
    view:"chat",el:null,submitting:false,sheet:false,hist:false,stick:true,
    model:"seedance-2.5",mode:"text",prompt:"",negative:"",
    duration:5,durAuto:false,quality:"720p",aspect:"adaptive",
    audio:true,sound:false,draft:false,web:false,relaxed:false,keepSound:true,
    media:{},finalSource:"",sessions:[],activeId:null
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
  const $=id=>document.getElementById(id);

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

  /* ───────────── chats (sessions) ───────────── */
  const activeSession=()=>K.sessions.find(s=>s.id===K.activeId)||null;
  const messages=()=>(activeSession()||{messages:[]}).messages;
  function allJobs(){
    const out=[];
    K.sessions.forEach(s=>s.messages.forEach(m=>{if(m.job)out.push(m.job)}));
    return out;
  }
  function saveChats(){
    K.sessions=K.sessions.slice(0,MAX_SESSIONS);
    K.sessions.forEach(s=>{if(s.messages.length>MAX_MESSAGES)s.messages=s.messages.slice(-MAX_MESSAGES)});
    const write=()=>{
      localStorage.setItem(LS_CHATS,JSON.stringify(K.sessions));
      localStorage.setItem(LS_ACTIVE,K.activeId||"");
    };
    try{write()}catch(_){
      // storage full: drop the oldest chats and retry once
      try{K.sessions=K.sessions.slice(0,Math.max(5,Math.floor(K.sessions.length/2)));write()}catch(__){}
    }
  }
  let chatTimer=0;
  function saveChatsSoon(){clearTimeout(chatTimer);chatTimer=setTimeout(saveChats,300)}
  function loadChats(){
    try{const c=JSON.parse(localStorage.getItem(LS_CHATS)||"[]");if(Array.isArray(c))K.sessions=c.filter(s=>s&&s.id&&Array.isArray(s.messages))}catch(_){}
    const a=localStorage.getItem(LS_ACTIVE)||"";
    K.activeId=K.sessions.some(s=>s.id===a)?a:null;
    // one-time import of the flat job list from the previous (non-chat) version
    try{
      if(!localStorage.getItem(LS_MIGRATED)){
        const old=JSON.parse(localStorage.getItem(LS_OLDJOBS)||"[]");
        if(Array.isArray(old)&&old.length){
          const t=Date.now();
          const msgs=[];
          old.slice().reverse().forEach(j=>{
            if(!j||!j.id)return;
            msgs.push({id:"kvm_"+rid(),role:"user",t:j.createdAt||t,text:j.prompt||"",chips:[j.name,MODE_LABEL[j.mode]||j.mode,j.quality].filter(Boolean),media:[]});
            msgs.push({id:"kvm_"+rid(),role:"assistant",t:j.createdAt||t,job:j});
          });
          if(msgs.length)K.sessions.push({id:"kvs_"+rid(),title:"Earlier videos",createdAt:t,updatedAt:t,messages:msgs});
          saveChats();
        }
        localStorage.setItem(LS_MIGRATED,"1");
      }
    }catch(_){}
  }
  function newSessionObj(){
    const t=Date.now();
    return {id:"kvs_"+t.toString(36)+rid(),title:"",createdAt:t,updatedAt:t,messages:[]};
  }
  function ago(t){
    const s=Math.max(0,Math.round((Date.now()-t)/1000));
    if(s<60)return"just now";
    if(s<3600)return Math.floor(s/60)+"m ago";
    if(s<86400)return Math.floor(s/3600)+"h ago";
    return Math.floor(s/86400)+"d ago";
  }
  async function confirmIt(message,okLabel,title){
    if(typeof showConfirmDialog==="function"){
      try{return await showConfirmDialog(message,{title:title||"Are you sure?",okLabel:okLabel||"Delete",danger:true})}catch(_){}
    }
    return window.confirm(message);
  }
  function runningIn(sess){return sess.messages.filter(m=>m.job&&(m.job.status==="pending"||m.job.status==="processing")).length}
  function dropSession(sess){
    sess.messages.forEach(m=>{if(m.job)m.job.dismissed=true});
    K.sessions=K.sessions.filter(s=>s!==sess);
    if(K.activeId===sess.id)K.activeId=null;
  }

  function draftJobs(){
    return allJobs().filter(j=>j.status==="completed"&&j.taskId&&j.form&&j.form.draft&&/^seedance-2\.5-/.test(j.route||"")&&!/draft-to-video/.test(j.route)
      &&Date.now()-(j.doneAt||j.createdAt)<24*3600*1000).reverse();
  }
  function leftTxt(j){
    const ms=24*3600*1000-(Date.now()-(j.doneAt||j.createdAt));
    const h=Math.max(0,Math.floor(ms/3600000));return h>=1?`${h}h left`:`${Math.max(1,Math.floor(ms/60000))}m left`;
  }

  /* ───────────── request building ───────────── */
  function mediaList(key){return(K.media[key]||[]).filter(x=>x&&x.url&&!x.uploading)}
  function buildBody(){
    normalize(); // always send values that are valid for the selected route
    const r=route();
    if(r.kind==="final")return{model:r.model,source_task_id:K.finalSource,output_format:"mp4"};
    const body={model:r.model,prompt:K.prompt.trim()};
    body.duration=r.fixedDur?-1:(r.auto&&K.durAuto)?-1:clamp(K.duration,r.dur[0],r.dur[1]);
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
    if(!getKey())return"No EvoLink key found. Paste it in Settings → EvoLink";
    if(r.kind==="final"){
      if(!K.finalSource||!draftJobs().some(j=>j.taskId===K.finalSource))return"Pick a draft to upgrade first";
      return"";
    }
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
    if(r.noAudioOnly&&!mediaList("image_urls").length&&!mediaList("video_urls").length)return"Audio can't be used alone — add an image or video too";
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
    if(!key){const e=new Error("No EvoLink key found. Paste it in Settings → EvoLink");e.status=401;throw e}
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
  function formSnapshot(){
    return{model:K.model,mode:K.mode,prompt:K.prompt,negative:K.negative,duration:K.duration,durAuto:K.durAuto,quality:K.quality,aspect:K.aspect,audio:K.audio,sound:K.sound,draft:K.draft,web:K.web,relaxed:K.relaxed,keepSound:K.keepSound,finalSource:K.finalSource,
      media:Object.fromEntries(Object.entries(K.media).map(([k,v])=>[k,(v||[]).filter(x=>x.url&&!x.uploading).map(x=>({id:x.id,url:x.url,name:x.name,kind:x.kind}))]))};
  }
  async function submit(){
    if(K.submitting)return;
    const err=validate();
    if(err){say(err,"error");return}
    const r=route(),m=cur(),body=buildBody();
    const isFinal=r.kind==="final";
    const src=isFinal?draftJobs().find(j=>j.taskId===K.finalSource):null;
    K.submitting=true;refreshBar();
    const t=Date.now();
    const job={
      id:"kvj_"+t.toString(36)+rid(),createdAt:t,status:"pending",progress:0,
      name:m.name,mode:K.mode,route:r.model,
      prompt:isFinal?("1080p final · "+((src&&src.prompt)||"draft")):K.prompt.trim(),
      quality:isFinal?"1080p":body.quality,aspect:isFinal?((src&&src.aspect)||null):(body.aspect_ratio||null),
      dur:isFinal?((src&&src.dur)||-1):body.duration,form:formSnapshot()
    };
    const refs=[];
    r.inputs.forEach(inp=>mediaList(inp.key).forEach(x=>refs.push({kind:x.kind||inp.kind,url:x.url,name:x.name})));
    const um={id:"kvm_"+rid(),role:"user",t,text:job.prompt,
      chips:isFinal?[m.name,"Draft → 1080p"]:[m.name,MODE_LABEL[K.mode]||K.mode,body.quality,body.duration>0?body.duration+"s":(r.fixedDur?"matches input":"auto length")],media:refs.slice(0,6)};
    const am={id:"kvm_"+rid(),role:"assistant",t,job};
    let sess=activeSession();
    if(!sess){sess=newSessionObj();K.sessions.unshift(sess);K.activeId=sess.id}
    sess.messages.push(um,am);
    sess.updatedAt=t;
    if(!sess.title)sess.title=job.prompt.slice(0,48);
    saveChats();
    // clear the composer like a normal chat (settings stay, prompt/references reset)
    K.prompt="";K.media={};K.finalSource="";saveForm();
    if(K.view==="chat"&&$("kvThread")){
      appendMessages([um,am]);
      syncComposer();refreshHeader();
    }
    try{
      const res=await api("/v1/videos/generations",{method:"POST",body:JSON.stringify(body)});
      const taskId=res?.id||res?.task_id||res?.data?.id;
      if(!taskId)throw new Error("EvoLink did not return a task ID");
      job.taskId=taskId;
      job.status=String(res.status||"pending").toLowerCase()==="processing"?"processing":"pending";
      saveChats();syncCard(job);
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
    saveChats();syncCard(job);
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
        if(job.dismissed)break;
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
          if(++fails>=8){job.status="stalled";job.error=e.message;saveChats();syncCard(job);break}
        }
        if(Date.now()-started>45*60*1000){job.status="stalled";job.error="Still running on EvoLink";saveChats();syncCard(job);break}
      }
    }finally{
      polling.delete(job.id);
      saveChatsSoon();
    }
  }
  async function finish(job,d,url){
    job.status="completed";job.progress=100;job.url=url;job.error=null;job.doneAt=Date.now();
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
                job.url=h;saveChatsSoon();syncCard(job);
              }
            }).catch(()=>{});
          }
        }
      }
      if(typeof usd==="number"&&typeof logCost==="function")logCost("evolink:"+job.route,job.prompt.slice(0,60),1,usd);
    }catch(e){console.warn("Video saved to chat only:",e)}
    saveChats();syncCard(job);
    say(`🎬 ${job.name} video ready`,"success");
  }
  function resumeJobs(){
    allJobs().forEach(j=>{
      if(j.status!=="pending"&&j.status!=="processing")return;
      if(j.taskId&&Date.now()-j.createdAt<24*3600*1000)poll(j);
      else{j.status="failed";j.error=j.taskId?"Expired (EvoLink results last 24 hours)":"Interrupted before it was submitted";saveChatsSoon()}
    });
  }

  /* ───────────── media uploads ───────────── */
  const UP_STALL=30000,UP_START=12000;
  function upProgress(item,p){
    item.progress=p;
    const el=document.querySelector(`[data-up="${item.id}"]`);
    if(el)el.textContent="Uploading "+Math.round(p*100)+"%";
  }
  // Primary route: EvoLink's own file service (public URL EvoLink can always read).
  function evolinkUpload(file,item){
    return new Promise((resolve,reject)=>{
      const key=getKey();
      if(!key)return reject(new Error("No EvoLink key"));
      const x=new XMLHttpRequest();
      let timer;
      let started=false;
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{x.abort()}catch(_){}reject(new Error("EvoLink upload stalled"))},started?UP_STALL:UP_START)};
      x.open("POST","https://files-api.evolink.ai/api/v1/files/upload/stream");
      x.setRequestHeader("Authorization","Bearer "+key);
      x.upload.onprogress=e=>{started=true;arm();if(e.lengthComputable)upProgress(item,e.loaded/e.total)};
      x.onload=()=>{
        clearTimeout(timer);
        let d={};try{d=JSON.parse(x.responseText)}catch(_){}
        const u=d&&d.data&&(d.data.file_url||d.data.url);
        if(x.status>=200&&x.status<300&&u)resolve(u);
        else reject(new Error((d&&(d.msg||(d.error&&d.error.message)))||("EvoLink upload error "+x.status)));
      };
      x.onerror=()=>{clearTimeout(timer);reject(new Error("EvoLink upload blocked"))};
      x.onabort=()=>clearTimeout(timer);
      item.abort=()=>{try{x.abort()}catch(_){}clearTimeout(timer);reject(new Error("Cancelled"))};
      const form=new FormData();form.append("file",file,file.name||("upload."+(file.type.split("/")[1]||"bin")));
      arm();x.send(form);
    });
  }
  // Fallback: the app's Firebase storage, with real progress and a stall timeout.
  function firebaseUpload(file,item){
    return new Promise((resolve,reject)=>{
      if(typeof fbStorage==="undefined")return reject(new Error("Storage isn't available"));
      const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"")||"bin";
      let task,timer;
      let started=false;
      const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{try{task&&task.cancel()}catch(_){}reject(new Error("Storage upload stalled"))},started?UP_STALL:UP_START+8000)};
      try{
        const uid=(typeof S!=="undefined"&&S.user&&S.user.uid)||"";
        if(!uid)return reject(new Error("Sign in to use storage upload"));
        const pre=file.type&&file.type.indexOf("image")===0?"gallery-images":"gallery-videos";
        const ref=fbStorage.ref(`${pre}/${uid}/${Date.now()}_${rid()}.${ext}`);
        task=ref.put(file,{contentType:file.type||"application/octet-stream"});
        item.abort=()=>{try{task.cancel()}catch(_){}clearTimeout(timer);reject(new Error("Cancelled"))};
        arm();
        task.on("state_changed",sn=>{started=true;arm();if(sn.totalBytes)upProgress(item,sn.bytesTransferred/sn.totalBytes)},
          err=>{clearTimeout(timer);reject(err)},
          async()=>{clearTimeout(timer);try{resolve(await ref.getDownloadURL())}catch(e){reject(e)}});
      }catch(e){clearTimeout(timer);reject(e)}
    });
  }
  // Last resort: fal.ai storage (only when the user has a fal key).
  async function falUpload(file,item){
    const k=gs("api_falai","");
    if(!k||typeof uploadToFalStorage!=="function")throw new Error("No fal key");
    return await Promise.race([uploadToFalStorage(file,k),new Promise((_,r)=>setTimeout(()=>r(new Error("fal upload stalled")),UP_STALL))]);
  }
  // Shrink big phone photos so uploads finish quickly on mobile data.
  async function shrinkImage(file){
    if(!/^image\/(jpe?g|png|webp)$/i.test(file.type)||file.size<1.2*1024*1024)return file;
    try{
      const bm=await createImageBitmap(file);
      const sc=Math.min(1,2048/Math.max(bm.width,bm.height));
      const c=document.createElement("canvas");c.width=Math.round(bm.width*sc);c.height=Math.round(bm.height*sc);
      c.getContext("2d").drawImage(bm,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.88));
      if(blob&&blob.size<file.size)return new File([blob],(file.name||"image").replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"});
    }catch(_){}
    return file;
  }
  function upLabel(item,t){const el=document.querySelector(`[data-up="${item.id}"]`);if(el)el.textContent=t}
  async function uploadFile(file,item){
    file=await shrinkImage(file);
    const errs=[];
    const routes=[["EvoLink",evolinkUpload],["Storage",firebaseUpload],["fal",falUpload]];
    for(const [name,fn] of routes){
      if(item.cancelled)throw new Error("Cancelled");
      upProgress(item,0);upLabel(item,"Uploading… ("+name+")");
      try{return await fn(file,item)}
      catch(e){if(item.cancelled)throw e;if(!/^No (EvoLink|fal) key$/.test(e.message))errs.push(name+": "+(e.message||e))}
    }
    throw new Error(errs.join("; ")||"No upload route available");
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
      addMedia(key,item);refreshSheet();refreshSummary();
      try{
        item.url=await uploadFile(file,item);
        delete item.uploading;delete item.abort;
      }catch(e){
        K.media[key]=(K.media[key]||[]).filter(x=>x!==item);
        if(!item.cancelled)say(`Upload failed: ${e.message}`,"error");
      }
      refreshSheet();refreshSummary();
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
    refreshSheet();refreshSummary();
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
    const old=$("kvLib");if(old)old.remove();
    const sheet=document.createElement("div");
    sheet.id="kvLib";sheet.className="kv-lib";
    const tile=it=>inp.kind==="image"
      ?`<img src="${esc(it.url)}" loading="lazy" alt="">`
      :inp.kind==="video"?`<video src="${esc(it.url)}" muted preload="metadata"></video>`:`<span>🎵</span>`;
    sheet.innerHTML=`<div class="kv-lib-box"><div class="kv-lib-head"><b>From your library</b><button data-lib="close" aria-label="Close">✕</button></div>
      ${items.length?`<div class="kv-lib-grid">${items.map((it,i)=>`<button class="kv-tile" data-lib="pick" data-i="${i}" title="${esc(it.name)}">${tile(it)}</button>`).join("")}</div>`
      :`<div class="kv-empty">No ${inp.kind}s in your library yet. Upload one or paste a URL.</div>`}</div>`;
    sheet.addEventListener("click",e=>{
      const b=e.target.closest("[data-lib]");
      if(e.target===sheet||(b&&b.dataset.lib==="close")){sheet.remove();return}
      if(b&&b.dataset.lib==="pick"){
        const it=items[Number(b.dataset.i)];
        if(it){addMedia(key,{id:"m_"+rid(),name:it.name,kind:inp.kind,url:it.url});refreshSheet();refreshSummary()}
        if(inp.single||(K.media[key]||[]).length>=inp.max)sheet.remove();
      }
    });
    document.body.appendChild(sheet);
  }

  /* ───────────── view builders ───────────── */
  function chips(field,values,selected,labelFn,disabled){
    return values.map(v=>`<button class="kv-chip kv-glow${v===selected?" on":""}" data-act="set" data-f="${field}" data-v="${esc(v)}"${disabled?" disabled":""}>${esc(labelFn?labelFn(v):v)}</button>`).join("");
  }
  function thumb(it){
    const u=safeUrl(it.url);
    if(it.uploading)return`<div class="kv-thumb up"><span data-up="${esc(it.id)}">Uploading${it.progress?" "+Math.round(it.progress*100)+"%":"…"}</span></div>`;
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
  function finalHTML(){
    const list=draftJobs();
    if(!list.length)return`<div class="kv-lab"><span>Upgrade a draft to 1080p</span></div>
      <div class="kv-hint">No drafts yet. Turn on <b>Draft preview</b> on a Seedance 2.5 Text, Image, Reference, Edit or Extend generation, let it finish, then come back here to convert it to a 1080p final. Drafts stay convertible for 24 hours.</div>`;
    return`<div class="kv-lab"><span>Pick a draft</span><small>${list.length} available</small></div>
      <div class="kv-hint">The final reuses the draft's prompt, media, length and ratio. It is billed separately at the 1080p rate.</div>
      <div class="kv-drafts">${list.map(j=>`<button class="kv-draft kv-glow${j.taskId===K.finalSource?" on":""}" data-act="pickdraft" data-id="${esc(j.id)}">
        <b>${esc((j.prompt||"Draft").slice(0,70))}</b><small>${esc(MODE_LABEL[j.mode]||j.mode)} · ${j.dur>0?j.dur+"s":"auto"} · ${leftTxt(j)}</small></button>`).join("")}</div>`;
  }
  function settingsHTML(){
    const r=route();
    if(r.kind==="final")return finalHTML();
    const draftOn=!!(r.draft&&K.draft);
    const rows=[];
    if(r.fixedDur){
      rows.push(`<div class="kv-lab"><span>Duration</span><b>Matches input</b></div><div class="kv-hint">The edited video keeps the length of the video you upload.</div>`);
    }else{
      const lo=r.dur[0],hi=r.dur[1],pct=Math.round((clamp(K.duration,lo,hi)-lo)/(hi-lo)*100);
      rows.push(`<div class="kv-lab"><span>Duration</span><b id="kvDurVal">${r.auto&&K.durAuto?"Auto":K.duration+"s"}</b></div>
        <div class="kv-row kv-dur">
          <input type="range" class="kv-range" data-f="duration" min="${lo}" max="${hi}" step="1" value="${clamp(K.duration,lo,hi)}" style="--kvf:${pct}%"${r.auto&&K.durAuto?" disabled":""}>
          ${r.auto?`<button class="kv-chip kv-glow${K.durAuto?" on":""}" data-act="auto">Auto</button>`:""}
        </div>
        <div class="kv-rangeends"><span>${lo}s</span><span>${hi}s</span></div>
        <div class="kv-hint">${lo}–${hi} seconds${r.auto?" · Auto lets the model choose (billed by actual length)":""}</div>`);
    }
    rows.push(`<div class="kv-lab"><span>Quality</span>${draftOn?"<small>Draft locks 480p</small>":""}</div>
      <div class="kv-chips">${chips("quality",r.q,draftOn?"480p":K.quality,v=>v==="4k"?"4K":v,draftOn)}</div>`);
    if(r.ar&&r.ar.length>1)rows.push(`<div class="kv-lab"><span>Aspect ratio</span></div>
      <div class="kv-chips">${chips("aspect",r.ar,K.aspect,v=>v==="adaptive"?"Auto":v==="keep_ratio"?"Keep":v)}</div>`);
    const toggles=[];
    if(r.audio==="seed")toggles.push(["audio","Generate audio",K.audio,"No extra charge"]);
    if(r.audio==="kling")toggles.push(["sound","Sound effects",K.sound,"Generates audio for the clip"]);
    if(r.keepSound)toggles.push(["keepSound","Keep original sound",K.keepSound,"Keep the reference video's audio"]);
    if(r.draft)toggles.push(["draft","Draft preview (480p)",K.draft,"Cheaper quick preview · upgrade it later in Draft → 1080p"]);
    if(r.web)toggles.push(["web","Web search",K.web&&!K.relaxed,"Let the model look things up (billed only when used)"]);
    if(r.relax)toggles.push(["relaxed","Relaxed content filter",K.relaxed,"Bills at 1.1× · can't be combined with web search"]);
    rows.push(toggles.map(t=>`<label class="kv-toggle"><span class="kv-ttxt"><b>${esc(t[1])}</b><small>${esc(t[3])}</small></span><input type="checkbox" class="kv-sw" role="switch" data-f="${t[0]}" ${t[2]?"checked":""}></label>`).join(""));
    return rows.join("");
  }
  function sheetBodyHTML(){
    const m=cur(),r=route();
    const modes=Object.keys(m.routes);
    return`<div class="kv-lab"><span>Model</span></div>
      <div class="kv-models">${MODELS.map(x=>`<button class="kv-model kv-glow${x.id===K.model?" on":""}" data-act="model" data-v="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></button>`).join("")}</div>
      <div class="kv-seg">${modes.map(x=>`<button class="${x===K.mode?"on":""}" data-act="mode" data-v="${x}">${MODE_LABEL[x]||x}</button>`).join("")}</div>
      ${mediaHTML()}
      <div class="kv-card" id="kvSettings">${settingsHTML()}</div>
      ${r.neg?`<div class="kv-card"><div class="kv-lab"><span>Negative prompt</span></div>
        <textarea class="kv-ta" data-f="negative" rows="2" placeholder="What to avoid (optional)">${esc(K.negative)}</textarea></div>`:""}`;
  }
  function summaryText(){
    const r=route(),m=cur();
    if(r.kind==="final")return`${m.name} · Draft → 1080p${K.finalSource?" · draft selected":""}`;
    const dur=r.fixedDur?"same length":(r.auto&&K.durAuto)?"Auto":K.duration+"s";
    const q=(r.draft&&K.draft)?"480p":K.quality;
    const n=r.inputs.reduce((a,i)=>a+mediaList(i.key).length,0);
    return`${m.name} · ${MODE_LABEL[K.mode]||K.mode} · ${dur} · ${q==="4k"?"4K":q}${n?` · ${n} ref${n>1?"s":""}`:""}`;
  }
  function userHTML(m){
    const media=(m.media||[]).map(x=>thumb(x)).join("");
    return`<div class="kv-msg user" data-msg="${esc(m.id)}"><div class="kv-bubble user">
      <div class="kv-text">${esc(m.text)}</div>
      ${media?`<div class="kv-umedia">${media}</div>`:""}
      <div class="kv-chiprow">${(m.chips||[]).map(c=>`<span class="kv-mini">${esc(c)}</span>`).join("")}</div>
    </div></div>`;
  }
  function asstHTML(m){
    const j=m.job;
    return`<div class="kv-msg asst" data-msg="${esc(m.id)}"><div class="kv-avatar">${IC.spark}</div>
      <div class="kv-bubble asst"><div class="kv-job" data-job="${esc(j.id)}" data-state="${esc(j.status)}">${cardInner(j)}</div></div></div>`;
  }
  function emptyHTML(){
    return`<div class="kv-emptystate"><div class="kv-orb">${IC.film}</div>
      <div class="kv-etitle">Describe a video to get started</div>
      <div class="kv-esub">Your generations stay here like a conversation. Tap the sliders to pick a model and settings.</div>
      <div class="kv-ideas">${IDEAS.map((t,i)=>`<button class="kv-idea" data-act="idea" data-i="${i}">${esc(t)}</button>`).join("")}</div></div>`;
  }
  function threadHTML(){
    const ms=messages();
    const notice="";
    if(!ms.length)return notice+emptyHTML();
    return notice+ms.map(m=>m.role==="user"?userHTML(m):asstHTML(m)).join("");
  }
  function historyHTML(){
    const list=K.sessions.filter(s=>s.messages.length).slice().sort((a,b)=>b.updatedAt-a.updatedAt);
    if(!list.length)return`<div class="kv-empty">No saved chats yet. Your conversations appear here.</div>`;
    return list.map(s=>{
      const vids=s.messages.filter(m=>m.job&&m.job.status==="completed").length;
      const run=runningIn(s);
      return`<div class="kv-hrow${s.id===K.activeId?" on":""}">
        <button class="kv-hmain" data-act="loadchat" data-id="${esc(s.id)}">
          <b>${esc(s.title||"Untitled chat")}</b>
          <small>${vids} video${vids===1?"":"s"}${run?` · ${run} generating`:""} · ${ago(s.updatedAt)}</small>
        </button>
        <button class="kv-ibtn sm" data-act="delsess" data-id="${esc(s.id)}" aria-label="Delete chat">${IC.trash}</button>
      </div>`;
    }).join("")+(list.length>1?`<button class="kv-btn kv-danger" data-act="clearall">Delete all chats</button>`:"");
  }
  function chatHTML(){
    return`<div class="kv kv-chat" data-view="chat">
      <div class="kv-head kv-glass">
        <button class="kv-ibtn" data-act="hist" aria-label="Chats">${IC.menu}</button>
        <div class="kv-htitle"><div class="kv-title" id="kvTitle"></div><div class="kv-subt" id="kvSubt"></div></div>
        <button class="kv-ibtn" data-act="newchat" aria-label="New chat">${IC.plus}</button>
        <button class="kv-ibtn" data-act="delchat" aria-label="Delete this chat">${IC.trash}</button>
      </div>
      <div class="kv-thread" id="kvThread">${threadHTML()}</div>
      <div class="kv-composer-wrap">
        <div class="kv-composer kv-glass">
          <textarea id="kvPrompt" data-f="prompt" rows="1" placeholder="${esc(route().hint||"Describe the video you want…")}">${esc(K.prompt)}</textarea>
          <div class="kv-crow">
            <button class="kv-ibtn sm" data-act="sheet" aria-label="Settings">${IC.sliders}</button>
            <button class="kv-summary" data-act="sheet" id="kvSummary"></button>
            <button class="kv-send" id="kvGo" data-act="generate" aria-label="Generate">${IC.send}</button>
          </div>
        </div>
      </div>
      <div class="kv-backdrop" data-act="close-sheets"></div>
      <div class="kv-shutter kv-glass-strong" id="kvShutter" aria-label="Video settings">
        <div class="kv-grab" data-act="close-sheets"></div>
        <div class="kv-shead"><b>Video settings</b><button class="kv-btn sm" data-act="close-sheets">Done</button></div>
        <div class="kv-sbody" id="kvSheetBody">${sheetBodyHTML()}</div>
      </div>
      <div class="kv-shutter kv-glass-strong" id="kvHist" aria-label="Chats">
        <div class="kv-grab" data-act="close-sheets"></div>
        <div class="kv-shead"><b>Chats</b><button class="kv-btn sm" data-act="newchat">＋ New chat</button></div>
        <div class="kv-sbody" id="kvHistBody">${historyHTML()}</div>
      </div>
    </div>`;
  }
  function galleryHTML(){
    let vids=[];
    try{vids=(S.assets||[]).filter(a=>a.type==="video"&&safeUrl(a.url)).slice(-80).reverse()}catch(_){}
    return`<div class="kv kv-chat" data-view="gallery">
      <div class="kv-head kv-glass">
        <button class="kv-ibtn" data-act="tochat" aria-label="Back to chat">${IC.back}</button>
        <div class="kv-htitle"><div class="kv-title">Video Gallery</div><div class="kv-subt">${vids.length} video${vids.length===1?"":"s"}</div></div>
      </div>
      <div class="kv-thread kv-galwrap">
      ${vids.length?`<div class="kv-gal">${vids.map(a=>`<div class="kv-gcard kv-glass">
        <video src="${esc(safeUrl(a.url))}" controls playsinline preload="metadata"></video>
        <div class="kv-gmeta">${esc(a.providerLabel||a.model||"Video")}${a.resolution?` · ${esc(a.resolution)}`:""}${a.duration?` · ${esc(a.duration)}s`:""}</div>
        <div class="kv-gprompt">${esc(String(a.prompt||"").slice(0,90))}</div>
        <div class="kv-row">
          <button class="kv-btn" data-act="gdl" data-id="${esc(a.id)}">Download</button>
          <button class="kv-btn" data-act="greuse" data-id="${esc(a.id)}">Reuse prompt</button>
          ${typeof openCollectionPicker==="function"?`<button class="kv-btn" data-act="gcol" data-id="${esc(a.id)}">📁</button>`:""}
        </div></div>`).join("")}</div>`
      :`<div class="kv-empty">No videos yet. Generate one in the chat and it appears here.</div>`}
      </div>
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
      return`${head}${u?`<video class="kv-vid" src="${esc(u)}" controls playsinline preload="metadata"></video>`:""}
        <div class="kv-jmeta">${job.usd!=null?`Cost $${Number(job.usd).toFixed(3)}`:"Saved to Gallery"}${job.videoDur?` · ${Number(job.videoDur).toFixed(1)}s clip`:""}</div>
        <div class="kv-row"><button class="kv-btn" data-act="jdl" data-id="${job.id}">Download</button>
        <button class="kv-btn" data-act="jcopy" data-id="${job.id}">Copy link</button>
        <button class="kv-btn" data-act="jreuse" data-id="${job.id}">Reuse</button>
        <button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    }
    if(job.status==="failed")return`${head}${prompt}<div class="kv-err">${esc(job.error||"Generation failed")}</div>
      <div class="kv-row"><button class="kv-btn" data-act="jretry" data-id="${job.id}">Retry</button><button class="kv-btn" data-act="jreuse" data-id="${job.id}">Edit settings</button><button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    if(job.status==="stalled")return`${head}${prompt}<div class="kv-err">${esc(job.error||STATUS_TXT.stalled)}. The job may still finish on EvoLink.</div>
      <div class="kv-row"><button class="kv-btn" data-act="jrecheck" data-id="${job.id}">Check again</button><button class="kv-btn" data-act="jrm" data-id="${job.id}">Remove</button></div>`;
    return`${head}<div class="kv-prog"><i style="width:${clamp(job.progress,0,100)}%"></i></div>
      <div class="kv-jmeta"><span class="kv-jstat">${STATUS_TXT[job.status]||job.status}${job.progress?` ${Math.round(job.progress)}%`:""}</span> · <span class="kv-jtime">${elapsed(job)}</span></div>`;
  }
  const threadEl=()=>$("kvThread");
  const nearBottom=()=>{const t=threadEl();return!t||t.scrollHeight-t.scrollTop-t.clientHeight<160};
  function scrollEnd(){
    const t=threadEl();if(!t)return;
    const go=()=>{t.scrollTop=t.scrollHeight};
    go();(window.requestAnimationFrame||setTimeout)(go);
  }
  function syncCard(job){
    const t=threadEl();if(!t)return;
    const card=t.querySelector(`[data-job="${job.id}"]`);
    if(!card)return;
    const stick=nearBottom();
    if(card.dataset.state!==job.status){
      card.dataset.state=job.status;
      card.innerHTML=cardInner(job);
      if(stick)scrollEnd();
    }else{
      const bar=card.querySelector(".kv-prog i");if(bar)bar.style.width=clamp(job.progress,0,100)+"%";
      const st=card.querySelector(".kv-jstat");if(st)st.textContent=(STATUS_TXT[job.status]||job.status)+(job.progress?` ${Math.round(job.progress)}%`:"");
      if(job.status==="completed"){
        const v=card.querySelector("video.kv-vid"),u=safeUrl(job.url);
        if(v&&u&&v.getAttribute("src")!==u&&v.paused)v.setAttribute("src",u);
      }
    }
  }
  function appendMessages(list){
    const t=threadEl();if(!t)return;
    const e=t.querySelector(".kv-emptystate");if(e)e.remove();
    t.insertAdjacentHTML("beforeend",list.map(m=>m.role==="user"?userHTML(m):asstHTML(m)).join(""));
    scrollEnd();
  }
  setInterval(()=>{
    const t=threadEl();if(!t||!t.isConnected)return;
    allJobs().forEach(j=>{
      if(j.status!=="pending"&&j.status!=="processing")return;
      const el=t.querySelector(`[data-job="${j.id}"] .kv-jtime`);if(el)el.textContent=elapsed(j);
    });
  },1000);

  /* ───────────── partial refreshes ───────────── */
  function refreshHeader(){
    const s=activeSession();
    const title=$("kvTitle"),sub=$("kvSubt");
    if(title)title.textContent=(s&&s.title)||"Video Studio";
    if(sub){
      const n=s?s.messages.filter(m=>m.job&&m.job.status==="completed").length:0;
      sub.textContent=s?`${n} video${n===1?"":"s"} · EvoLink`:"New chat · EvoLink";
    }
  }
  function refreshSummary(){const b=$("kvSummary");if(b)b.textContent=summaryText()}
  function refreshSheet(){const b=$("kvSheetBody");if(b)b.innerHTML=sheetBodyHTML()}
  function refreshHist(){const b=$("kvHistBody");if(b)b.innerHTML=historyHTML()}
  function refreshBar(){
    const b=$("kvGo");
    if(b){b.disabled=K.submitting;b.classList.toggle("busy",K.submitting)}
  }
  function autosize(){
    const ta=$("kvPrompt");if(!ta)return;
    ta.style.height="auto";
    ta.style.height=Math.min(ta.scrollHeight,140)+"px";
  }
  function syncComposer(){
    const ta=$("kvPrompt");
    if(ta){ta.value=K.prompt;ta.placeholder=route().hint||"Describe the video you want…";autosize()}
    refreshSummary();refreshSheet();
  }
  function rebuildThread(){
    const t=threadEl();if(!t)return;
    t.innerHTML=threadHTML();
    refreshHeader();
    scrollEnd();
  }
  function setSheet(which){
    const root=document.querySelector(".kv-chat");if(!root)return;
    K.sheet=which==="sheet";K.hist=which==="hist";
    root.classList.toggle("sheet-open",K.sheet);
    root.classList.toggle("hist-open",K.hist);
    if(K.hist)refreshHist();
  }

  /* ───────────── actions ───────────── */
  function download(url,name){
    const u=safeUrl(url);if(!u)return;
    const a=document.createElement("a");a.href=u;a.download=name||"video.mp4";a.target="_blank";a.rel="noopener";
    document.body.appendChild(a);a.click();a.remove();
  }
  function applyForm(f){
    if(!f)return;
    ["model","mode","prompt","negative","duration","durAuto","quality","aspect","audio","sound","draft","web","relaxed","keepSound","finalSource"].forEach(k=>{if(f[k]!==undefined)K[k]=f[k]});
    K.media=f.media?JSON.parse(JSON.stringify(f.media)):{};
    normalize();saveForm();
  }
  function findJob(id){return allJobs().find(j=>j.id===id)}
  function removeJobMessages(job){
    job.dismissed=true;
    K.sessions.forEach(s=>{
      const i=s.messages.findIndex(m=>m.job===job);
      if(i<0)return;
      const prev=s.messages[i-1];
      const drop=[s.messages[i]];
      if(prev&&prev.role==="user")drop.unshift(prev);
      s.messages=s.messages.filter(m=>!drop.includes(m));
      const t=threadEl();
      if(t&&s.id===K.activeId)drop.forEach(m=>{const el=t.querySelector(`[data-msg="${m.id}"]`);if(el)el.remove()});
    });
    saveChats();
    const t=threadEl();
    if(t&&!messages().length)rebuildThread();
    refreshHeader();
  }
  async function deleteCurrent(){
    const s=activeSession();
    if(!s||!s.messages.length){say("This chat is already empty");return}
    const run=runningIn(s);
    const ok=await confirmIt(`Delete "${s.title||"this chat"}"?${run?`\n\n${run} video${run>1?"s are":" is"} still generating and won't be saved.`:"\n\nVideos already saved to your Gallery stay there."}`,"Delete chat","Delete chat");
    if(!ok)return;
    dropSession(s);saveChats();
    rebuildThread();refreshHist();setSheet(null);
    say("Chat deleted");
  }
  async function deleteSessionById(id){
    const s=K.sessions.find(x=>x.id===id);if(!s)return;
    const run=runningIn(s);
    const ok=await confirmIt(`Delete "${s.title||"this chat"}"?${run?`\n\n${run} video${run>1?"s are":" is"} still generating and won't be saved.`:"\n\nVideos already saved to your Gallery stay there."}`,"Delete chat","Delete chat");
    if(!ok)return;
    const wasActive=K.activeId===id;
    dropSession(s);saveChats();
    refreshHist();
    if(wasActive)rebuildThread();
    say("Chat deleted");
  }
  async function deleteAll(){
    const n=K.sessions.length;if(!n)return;
    const ok=await confirmIt(`Delete all ${n} chats?\n\nVideos already saved to your Gallery stay there.`,"Delete all","Delete all chats");
    if(!ok)return;
    K.sessions.slice().forEach(dropSession);
    K.sessions=[];K.activeId=null;saveChats();
    rebuildThread();refreshHist();
    say("All chats deleted");
  }
  function newChat(){
    K.activeId=null;saveChats();
    rebuildThread();setSheet(null);
    const ta=$("kvPrompt");if(ta)ta.focus();
  }
  function loadChat(id){
    if(!K.sessions.some(s=>s.id===id))return;
    K.activeId=id;saveChats();
    rebuildThread();setSheet(null);
  }
  function onClick(e){
    const t=e.target.closest("[data-act]");
    if(!t||!t.closest(".kv"))return;
    const act=t.dataset.act,v=t.dataset.v;
    switch(act){
      case"model":K.model=v;normalize();saveForm();refreshSheet();refreshSummary();{const ta=$("kvPrompt");if(ta)ta.placeholder=route().hint||""}break;
      case"mode":K.mode=v;normalize();saveForm();refreshSheet();refreshSummary();{const ta=$("kvPrompt");if(ta)ta.placeholder=route().hint||""}break;
      case"set":K[t.dataset.f]=v;saveForm();refreshSheet();refreshSummary();break;
      case"pickdraft":{const j=findJob(t.dataset.id);if(j){K.finalSource=j.taskId;refreshSheet();refreshSummary()}break}
      case"auto":K.durAuto=!K.durAuto;saveForm();refreshSheet();refreshSummary();break;
      case"pick":{const inp=document.querySelector(`input[data-file="${t.dataset.key}"]`);inp&&inp.click();break}
      case"lib":openLibrary(t.dataset.key);break;
      case"url":pasteUrl(t.dataset.key);break;
      case"rm":{const k=t.dataset.key;const it=(K.media[k]||[])[Number(t.dataset.i)];if(it&&it.uploading){it.cancelled=true;try{it.abort&&it.abort()}catch(_){}}K.media[k]=(K.media[k]||[]).filter((_,i)=>i!==Number(t.dataset.i));refreshSheet();refreshSummary();break}
      case"keyset":typeof openSettings==="function"?openSettings():say("Open Settings to add your EvoLink key");break;
      case"generate":submit();break;
      case"sheet":setSheet(K.sheet?null:"sheet");break;
      case"hist":setSheet(K.hist?null:"hist");break;
      case"close-sheets":setSheet(null);break;
      case"newchat":newChat();break;
      case"delchat":deleteCurrent();break;
      case"loadchat":loadChat(t.dataset.id);break;
      case"delsess":deleteSessionById(t.dataset.id);break;
      case"clearall":deleteAll();break;
      case"idea":{K.prompt=IDEAS[Number(t.dataset.i)]||"";saveForm();syncComposer();const ta=$("kvPrompt");if(ta)ta.focus();break}
      case"tochat":K.view="chat";render();markTab("Generate");break;
      case"jdl":{const j=findJob(t.dataset.id);j&&download(j.url,`${j.route}.mp4`);break}
      case"jcopy":{const j=findJob(t.dataset.id);
        if(j&&navigator.clipboard)navigator.clipboard.writeText(j.url).then(()=>say("Link copied","success"),()=>say("Couldn't copy","error"));break}
      case"jreuse":{const j=findJob(t.dataset.id);if(j){applyForm(j.form);syncComposer();const ta=$("kvPrompt");if(ta)ta.focus()}break}
      case"jretry":{const j=findJob(t.dataset.id);if(j){applyForm(j.form);syncComposer();submit()}break}
      case"jrm":{const j=findJob(t.dataset.id);if(j)removeJobMessages(j);break}
      case"jrecheck":{const j=findJob(t.dataset.id);if(j){j.status="processing";j.error=null;saveChats();syncCard(j);poll(j)}break}
      case"gdl":{const a=(S.assets||[]).find(x=>x.id===t.dataset.id);a&&download(a.url,`${a.model||"video"}.mp4`);break}
      case"greuse":{const a=(S.assets||[]).find(x=>x.id===t.dataset.id);
        if(a){K.prompt=String(a.prompt||"");saveForm();K.view="chat";render();markTab("Generate")}break}
      case"gcol":openCollectionPicker("asset",t.dataset.id);break;
    }
  }
  let formTimer=0;
  function onInput(e){
    const t=e.target;
    if(!t.closest||!t.closest(".kv"))return;
    const f=t.dataset&&t.dataset.f;if(!f)return;
    if(f==="prompt"){K.prompt=t.value;autosize()}
    else if(f==="negative")K.negative=t.value;
    else if(f==="duration"){
      K.duration=Number(t.value);
      const lo=Number(t.min),hi=Number(t.max);
      t.style.setProperty("--kvf",Math.round((K.duration-lo)/Math.max(1,hi-lo)*100)+"%");
      const d=$("kvDurVal");if(d)d.textContent=K.duration+"s";
      refreshSummary();
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
      const s=$("kvSettings");if(s)s.innerHTML=settingsHTML();
      refreshSummary();
    }
  }
  function onKeydown(e){
    if(e.target&&e.target.id==="kvPrompt"&&e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit()}
    if(e.key==="Escape"&&(K.sheet||K.hist))setSheet(null);
  }
  function bind(el){
    if(el.__kvBound)return;
    el.__kvBound=true;
    el.addEventListener("click",onClick);
    el.addEventListener("input",onInput);
    el.addEventListener("change",onChange);
    el.addEventListener("keydown",onKeydown);
  }

  /* ───────────── styles ───────────── */
  function injectCss(){
    if($("kv-css"))return;
    const s=document.createElement("style");s.id="kv-css";
    s.textContent=`
.kv{color:var(--text,#1e1230);font-size:13px}
.kv *{box-sizing:border-box}
.kv-chat{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;isolation:isolate;border-radius:inherit}
.kv-chat::before{content:"";position:absolute;inset:-25%;z-index:-1;pointer-events:none;filter:blur(36px);
  background:radial-gradient(38% 32% at 14% 12%,rgba(98,64,176,.34),transparent 70%),radial-gradient(34% 30% at 92% 28%,rgba(94,210,225,.28),transparent 70%),radial-gradient(46% 38% at 38% 98%,rgba(196,181,253,.36),transparent 70%)}
.kv-glass{background:var(--glass,rgba(255,255,255,.55));-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);border:1px solid var(--glass-brd,rgba(61,31,122,.14));box-shadow:0 8px 32px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.32)}
.kv-glass-strong{background:var(--glass-solid,rgba(252,250,255,.96));-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);border:1px solid var(--glass-brd,rgba(61,31,122,.14));box-shadow:0 -12px 48px rgba(61,31,122,.22)}
.kv-head{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:8px 8px 0;border-radius:20px;flex:0 0 auto;z-index:2}
.kv-htitle{flex:1;min-width:0;padding:0 2px}
.kv-title{font-size:15px;font-weight:800;color:var(--violet,#3d1f7a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kv-subt{font-size:10px;color:var(--texts,#9488ae);margin-top:1px}
.kv-ibtn{width:38px;height:38px;flex:0 0 auto;border-radius:13px;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:var(--glass,rgba(255,255,255,.55));color:var(--textm,#5a4880);display:grid;place-items:center;cursor:pointer;padding:0}
.kv-ibtn.sm{width:36px;height:36px;border-radius:12px}
.kv-ibtn:active{transform:scale(.94)}
.kv-thread{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px 12px 10px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.kv-msg{display:flex;gap:8px;align-items:flex-start;animation:kvIn .28s ease both}
.kv-msg.user{justify-content:flex-end}
@keyframes kvIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kv-avatar{width:28px;height:28px;flex:0 0 auto;border-radius:50%;background:linear-gradient(135deg,#6240b0,#5ed2e1);color:#fff;display:grid;place-items:center;margin-top:2px;box-shadow:0 4px 12px rgba(98,64,176,.35)}
.kv-avatar svg{width:15px;height:15px}
.kv-bubble{min-width:0;border-radius:20px;padding:11px 13px}
.kv-bubble.user{max-width:min(86%,520px);background:linear-gradient(135deg,rgba(98,64,176,.96),rgba(61,31,122,.96));color:#fff;border-bottom-right-radius:6px;box-shadow:0 10px 26px rgba(61,31,122,.30)}
.kv-bubble.asst{flex:1 1 auto;max-width:min(100% - 36px,560px);background:var(--glass,rgba(255,255,255,.55));-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid var(--glass-brd,rgba(61,31,122,.14));border-bottom-left-radius:6px;box-shadow:0 8px 28px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.3)}
.kv-text{font-size:13.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.kv-umedia{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.kv-umedia .kv-thumb{width:54px;height:54px;border-radius:10px;background:rgba(255,255,255,.2);color:#fff}
.kv-chiprow{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.kv-mini{font-size:9.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:rgba(255,255,255,.2);color:inherit;letter-spacing:.01em}
.kv-emptystate{margin:auto;text-align:center;padding:18px 10px;max-width:420px}
.kv-orb{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#6240b0,#5ed2e1);box-shadow:0 12px 34px rgba(98,64,176,.4)}
.kv-orb svg{width:28px;height:28px}
.kv-etitle{font-size:16px;font-weight:800;color:var(--violet,#3d1f7a)}
.kv-esub{font-size:12px;color:var(--texts,#9488ae);line-height:1.5;margin:6px 0 14px}
.kv-ideas{display:flex;flex-direction:column;gap:8px}
.kv-idea{text-align:left;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:var(--glass,rgba(255,255,255,.55));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--textm,#5a4880);border-radius:14px;padding:10px 12px;font-size:12px;line-height:1.4;cursor:pointer}
.kv-notice{border-radius:16px;padding:10px 12px;font-size:12px;color:var(--textm,#5a4880);display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.kv-composer-wrap{flex:0 0 auto;padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px));z-index:2}
.kv-composer{border-radius:26px;padding:10px 10px 8px}
#kvPrompt{display:block;width:100%;border:0;outline:0;background:transparent;resize:none;font:inherit;font-size:14px;line-height:1.45;color:var(--text,#1e1230);max-height:140px;padding:4px 8px;overflow-y:auto}
#kvPrompt::placeholder{color:var(--texts,#9488ae)}
.kv-crow{display:flex;align-items:center;gap:8px;margin-top:6px}
.kv-summary{flex:1;min-width:0;text-align:left;border:0;background:rgba(98,64,176,.12);color:var(--textm,#5a4880);border-radius:99px;padding:9px 13px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.kv-send{width:44px;height:44px;flex:0 0 auto;border-radius:50%;border:0;background:linear-gradient(135deg,#6240b0,#5ed2e1);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 22px rgba(98,64,176,.4)}
.kv-send:disabled{opacity:.55;cursor:wait}.kv-send.busy svg{animation:kvPulse 1s ease infinite}
@keyframes kvPulse{50%{transform:scale(.8);opacity:.6}}
.kv-backdrop{position:absolute;inset:0;z-index:3;background:rgba(15,8,32,.38);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .25s ease}
.kv-chat.sheet-open .kv-backdrop,.kv-chat.hist-open .kv-backdrop{opacity:1;pointer-events:auto}
.kv-shutter{position:absolute;left:0;right:0;bottom:0;z-index:4;max-height:84%;display:flex;flex-direction:column;border-radius:26px 26px 0 0;transform:translateY(104%);transition:transform .32s cubic-bezier(.2,.8,.2,1);padding-bottom:env(safe-area-inset-bottom,0px)}
.kv-chat.sheet-open #kvShutter,.kv-chat.hist-open #kvHist{transform:none}
.kv-grab{width:42px;height:5px;border-radius:99px;background:var(--lav2,#d8ccf5);margin:9px auto 4px;flex:0 0 auto;cursor:pointer}
.kv-shead{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 8px;flex:0 0 auto}
.kv-shead b{font-size:15px;color:var(--violet,#3d1f7a)}
.kv-sbody{overflow-y:auto;padding:4px 14px 18px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.kv-lab{display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800;color:var(--textm,#5a4880);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.kv-lab small{font-weight:600;text-transform:none;letter-spacing:0;color:var(--texts,#9488ae)}.kv-lab b{color:var(--violet,#3d1f7a);font-size:13px;text-transform:none;letter-spacing:0}
.kv-hint{font-size:10.5px;color:var(--texts,#9488ae);line-height:1.4;margin:2px 0 8px}
.kv-models{display:flex;gap:10px;overflow-x:auto;padding:8px 8px 14px;margin:-2px -8px 4px;scrollbar-width:none;isolation:isolate}.kv-models::-webkit-scrollbar{display:none}
.kv-model{flex:0 0 auto;min-width:132px;text-align:left;border:1px solid var(--glass-brd,rgba(61,31,122,.12));background:var(--glass,rgba(255,255,255,.55));color:var(--text,#1e1230);border-radius:15px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.kv-model b{font-size:12.5px}.kv-model small{font-size:9.5px;color:var(--texts,#9488ae)}
.kv-model.on,.kv-draft.on{background:var(--glass-solid,#fcfaff)!important}
.kv-seg{display:flex;background:rgba(98,64,176,.10);border-radius:13px;padding:3px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;gap:2px}.kv-seg::-webkit-scrollbar{display:none}
.kv-seg button{flex:1 0 auto;border:0;background:transparent;color:var(--textm,#5a4880);padding:9px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.kv-seg button.on{background:var(--surface,#fff);color:var(--violet,#3d1f7a);box-shadow:0 1px 8px rgba(61,31,122,.14)}
.kv-card{background:var(--glass,rgba(255,255,255,.55));border:1px solid var(--glass-brd,rgba(61,31,122,.1));border-radius:16px;padding:12px;margin-bottom:10px}
.kv-ta{width:100%;border:1px solid var(--glass-brd,rgba(61,31,122,.12));background:rgba(98,64,176,.06);color:var(--text,#1e1230);border-radius:12px;padding:10px 12px;font:inherit;font-size:13px;line-height:1.45;resize:vertical;outline:0}
.kv-ta:focus{border-color:var(--vm,#6240b0)}
.kv-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kv-btn{flex:1 1 auto;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:rgba(98,64,176,.10);color:var(--textm,#5a4880);border-radius:11px;padding:9px 11px;font-size:11.5px;font-weight:700;cursor:pointer}
.kv-btn.sm{flex:0 0 auto;padding:7px 13px}
.kv-btn:disabled,.kv-chip:disabled{opacity:.45;cursor:not-allowed}
.kv-danger{width:100%;margin-top:10px;background:rgba(200,50,70,.12);color:#b3263e;border-color:rgba(200,50,70,.25)}
.kv-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding:3px;isolation:isolate}
.kv-chip{border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:rgba(98,64,176,.08);color:var(--textm,#5a4880);border-radius:999px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer}
.kv-chip.on{background:linear-gradient(135deg,#6240b0,#3d1f7a);color:#fff;border-color:transparent}
.kv-dur{flex-wrap:nowrap;padding:3px 0;isolation:isolate}
.kv-range{-webkit-appearance:none!important;appearance:none!important;flex:1;min-width:0;height:34px;margin:0;padding:0;background:transparent!important;outline:0;--kvf:0%;touch-action:pan-y}
.kv-range::-webkit-slider-runnable-track{height:8px;border-radius:99px;border:0!important;background:linear-gradient(90deg,#6240b0 0,#5ed2e1 var(--kvf),rgba(98,64,176,.18) var(--kvf))!important}
.kv-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;margin-top:-9px;border-radius:50%;background:#fff!important;border:3px solid #6240b0!important;box-shadow:0 2px 10px rgba(98,64,176,.5)!important}
.kv-range::-moz-range-track{height:8px;border-radius:99px;background:rgba(98,64,176,.18)}
.kv-range::-moz-range-progress{height:8px;border-radius:99px;background:linear-gradient(90deg,#6240b0,#5ed2e1)}
.kv-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid #6240b0}
.kv-range:disabled{opacity:.4}
.kv-rangeends{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--texts,#9488ae);margin:-2px 2px 2px}
.kv-toggle{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 2px;cursor:pointer}
.kv-ttxt{display:flex;flex-direction:column;gap:2px;min-width:0}.kv-ttxt b{font-size:13px}.kv-ttxt small{font-size:10.5px;color:var(--texts,#9488ae);line-height:1.35}
.kv-sw{-webkit-appearance:none!important;appearance:none!important;flex:0 0 auto;width:52px!important;height:31px!important;margin:0;border:1px solid rgba(98,64,176,.4)!important;border-radius:99px;background:rgba(98,64,176,.28)!important;position:relative;cursor:pointer;transition:background .22s;outline:0}
.kv-sw::after{content:"";position:absolute;top:2px;left:2px;width:25px;height:25px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transition:transform .22s cubic-bezier(.2,.8,.2,1)}
.kv-sw:checked{background:linear-gradient(135deg,#6240b0,#5ed2e1)!important;box-shadow:0 0 14px rgba(94,210,225,.55)}
.kv-sw:checked::after{transform:translateX(21px)}.kv-sw:checked{border-color:transparent!important}
.kv-drafts{display:flex;flex-direction:column;gap:10px;padding:3px;isolation:isolate}
.kv-draft{position:relative;text-align:left;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:var(--glass,rgba(255,255,255,.55));color:var(--text,#1e1230);border-radius:15px;padding:11px 13px;cursor:pointer;display:flex;flex-direction:column;gap:3px;font-family:inherit}
.kv-draft b{font-size:12.5px;line-height:1.35;overflow-wrap:anywhere}.kv-draft small{font-size:10.5px;color:var(--texts,#9488ae)}
/* multi-colour glowing outline on selected options */
@property --kva{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes kvSpin{to{--kva:360deg}}
.kv-glow{position:relative}
.kv-glow.on{border-color:transparent!important}
.kv-glow.on::before,.kv-glow.on::after{content:"";position:absolute;pointer-events:none;border-radius:inherit;background:conic-gradient(from var(--kva),#ff4fb8,#ffb347,#f5f545,#4dff9e,#4fd8ff,#6a7cff,#c04fff,#ff4fb8);animation:kvSpin 3.6s linear infinite}
.kv-glow.on::before{inset:-2px;padding:2px;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);mask-composite:exclude}
.kv-glow.on::after{inset:0;z-index:-1;filter:blur(8px);opacity:.55}
@media (prefers-reduced-motion:reduce){.kv-glow.on::before,.kv-glow.on::after{animation:none}}
.kv-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.kv-thumbwrap{position:relative}
.kv-thumb{width:68px;height:68px;border-radius:11px;overflow:hidden;background:rgba(98,64,176,.14);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--textm,#5a4880);text-align:center}
.kv-thumb img,.kv-thumb video{width:100%;height:100%;object-fit:cover}
.kv-aud{display:flex;flex-direction:column;align-items:center;font-size:18px}.kv-aud small{font-size:8px}
.kv-x{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#3d1f7a;color:#fff;font-size:10px;cursor:pointer}
.kv-jhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}.kv-jhead b{font-size:13px;color:var(--violet,#3d1f7a)}
.kv-jmode{font-size:10.5px;color:var(--texts,#9488ae)}
.kv-jprompt,.kv-gprompt{font-size:11.5px;color:var(--textm,#5a4880);margin:4px 0 8px;line-height:1.4;overflow-wrap:anywhere}
.kv-jmeta,.kv-gmeta{font-size:10.5px;color:var(--texts,#9488ae);margin:6px 0 8px}
.kv-prog{height:7px;border-radius:99px;background:rgba(98,64,176,.18);overflow:hidden;margin:10px 0 6px}
.kv-prog i{display:block;height:100%;background:linear-gradient(90deg,#6240b0,#5ed2e1);border-radius:99px;transition:width .6s ease}
.kv-vid{width:100%;border-radius:14px;background:#000;max-height:56vh;display:block}
.kv-err{background:rgba(200,50,70,.12);color:#b3263e;border-radius:11px;padding:9px 11px;font-size:11.5px;margin:6px 0 8px;overflow-wrap:anywhere}
.kv-empty{text-align:center;color:var(--texts,#9488ae);padding:30px 16px;font-size:12.5px}
.kv-hrow{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:4px;border-radius:16px;border:1px solid var(--glass-brd,rgba(61,31,122,.1));background:var(--glass,rgba(255,255,255,.55))}
.kv-hrow.on{border-color:var(--vm,#6240b0);box-shadow:0 0 0 1px var(--vm,#6240b0) inset}
.kv-hmain{flex:1;min-width:0;text-align:left;border:0;background:transparent;color:var(--text,#1e1230);padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.kv-hmain b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kv-hmain small{font-size:10.5px;color:var(--texts,#9488ae)}
.kv-galwrap{padding-top:12px}
.kv-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;width:100%}
.kv-gcard{border-radius:16px;padding:8px}
.kv-gcard video{width:100%;border-radius:11px;background:#000;aspect-ratio:16/9;object-fit:cover}
.kv-gmeta{margin:6px 0 2px}
.kv-lib{position:fixed;inset:0;z-index:10050;background:rgba(15,8,32,.55);display:flex;align-items:flex-end;justify-content:center}
.kv-lib-box{width:min(560px,100%);max-height:78vh;overflow:auto;background:var(--glass-solid,#fff);color:var(--text,#1e1230);border-radius:22px 22px 0 0;padding:14px;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.kv-lib-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kv-lib-head button{border:0;background:rgba(98,64,176,.12);color:var(--textm,#5a4880);border-radius:50%;width:32px;height:32px;cursor:pointer}
.kv-lib-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kv-tile{aspect-ratio:1;border:1px solid var(--glass-brd,rgba(61,31,122,.12));background:rgba(98,64,176,.12);border-radius:12px;padding:0;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center}
.kv-tile img,.kv-tile video{width:100%;height:100%;object-fit:cover}
@media(min-width:700px){.kv-lib{align-items:center}.kv-lib-box{border-radius:22px}.kv-shutter{left:50%;right:auto;width:min(620px,100%);margin-left:calc(min(620px,100%)/-2)}}
@media(prefers-reduced-motion:reduce){.kv-msg,.kv-shutter,.kv-backdrop{animation:none;transition:none}}
`;
    document.head.appendChild(s);
  }

  /* ───────────── render + module hooks ───────────── */
  function afterRender(){
    refreshHeader();refreshSummary();refreshBar();autosize();
    const t=threadEl();
    if(t&&!t.__kvScroll){
      t.__kvScroll=true;
      // keep pinned to the bottom when a video's size becomes known (media events don't bubble: capture)
      t.addEventListener("loadedmetadata",()=>{if(K.stick)scrollEnd()},true);
      t.addEventListener("scroll",()=>{K.stick=nearBottom()},{passive:true});
    }
    scrollEnd();
  }
  function render(){
    const el=(K.el&&K.el.isConnected)?K.el:$("moduleContent");
    if(!el)return;
    K.el=el;injectCss();bind(el);
    K.sheet=false;K.hist=false;
    el.innerHTML=K.view==="gallery"?galleryHTML():chatHTML();
    if(K.view==="chat")afterRender();
  }
  function markTab(label){
    try{document.querySelectorAll("#moduleTabs .inner-tab").forEach(t=>t.classList.toggle("active",t.textContent.trim()===label))}catch(_){}
  }

  // Take over the module entry points the shell already calls.
  window.renderVideoCanvas=function(el){
    K.view="chat";
    if(el)K.el=el;
    normalize();
    render();
    resumeJobs();
  };
  window.showVcChatView=function(){K.view="chat";render();markTab("Generate")};
  window.showVcGalleryView=function(){K.view="gallery";render();markTab("Gallery")};

  // "🎬 send to video" button elsewhere in the app (image → first frame)
  window.sendToVideoCanvas=function(imageUrl){
    const url=safeUrl(imageUrl);
    if(!url){say("That image can't be used as a video frame","error");return}
    K.model="seedance-2.5";K.mode="image";K.view="chat";
    K.media={image_urls:[{id:"m_"+rid(),name:"From chat",kind:"image",url}]};
    normalize();saveForm();
    const btn=document.querySelector('.mod-btn[data-mod="videocanvas"]');
    if(typeof S!=="undefined"&&S.mod==="videocanvas")render();
    else if(typeof switchMod==="function")switchMod("videocanvas",btn);
    say("🎬 Image added as the first frame","success");
  };

  window.KosmicVideo={MODELS,state:K,buildBody,validate,extractUrl,render,allJobs,messages,activeSession};

  loadForm();loadChats();
  try{
    if(typeof S!=="undefined"&&S.mod==="videocanvas"&&$("moduleContent"))window.renderVideoCanvas($("moduleContent"));
  }catch(_){}
})();

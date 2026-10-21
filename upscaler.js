// ══════════════════════════════════════════════════════════════════════
// UPSCALER MODULE — registry-driven (see upscaler-registry.js).
// Plain global script, not an ES module. Loads AFTER index.html's main
// inline script and AFTER upscaler-registry.js.
//
// Layers:  registry (data) → state (UP.st, persisted) → request builder
//          (upBuildBody) → job runner (upRunJob) → UI (renderUpscaler,
//          delegated data-up handlers, settings shutter).
//
// Public globals kept for the rest of the app:
//   renderUpscaler(el), setUpscaleMode(mode)   — module screen + tab bar
//   upscaleImageUrl(url,engine,apiKey)         — Node Canvas upscale node
//   saveUpscaleToGallery(url,silent)
// ══════════════════════════════════════════════════════════════════════
(function(){
"use strict";
const R=window.UP_REGISTRY;
const JOBS_KEY="kk_up_jobs";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtX=n=>(Number.isInteger(n)?n:n)+"×";

/* ───────────── state ───────────── */
const UP={
  st:null,            // persisted form state
  jobs:[],            // recent jobs (persisted, capped)
  src:{image:null,video:null}, // {url,name,thumb,uploading}
  sel:[],             // batch selection (asset ids)
  sheet:false,
  picker:null,
  running:0
};
function defaultState(){return{kind:"image",tool:{...R.defaultTool},model:{},factor:{},fmt:{},fps:{},h264:false,outFmt:{},params:{}}}
function loadState(){
  let s=null;try{s=gs("up_state",null)}catch(_){}
  if(typeof s==="string"){try{s=JSON.parse(s)}catch(_){s=null}}
  const d=defaultState();
  UP.st=s&&typeof s==="object"?{...d,...s,tool:{...d.tool,...(s.tool||{})}}:d;
  ["model","factor","fmt","fps","outFmt","params"].forEach(k=>{if(!UP.st[k]||typeof UP.st[k]!=="object")UP.st[k]={}});
  if(!R.byId[UP.st.tool.image])UP.st.tool.image=R.defaultTool.image;
  if(!R.byId[UP.st.tool.video])UP.st.tool.video=R.defaultTool.video;
  if(UP.st.kind!=="image"&&UP.st.kind!=="video")UP.st.kind="image";
}
function saveState(){try{saveSetting("up_state",UP.st)}catch(_){}}
function loadJobs(){try{UP.jobs=JSON.parse(localStorage.getItem(JOBS_KEY)||"[]")||[]}catch(_){UP.jobs=[]}}
function saveJobs(){
  const clean=u=>(typeof u==="string"&&/^(data|blob):/.test(u))?"":u;
  try{localStorage.setItem(JOBS_KEY,JSON.stringify(UP.jobs.slice(0,25).map(j=>({...j,srcUrl:clean(j.srcUrl),thumb:clean(j.thumb)}))))}catch(_){}
}

const tool=()=>R.byId[UP.st.tool[UP.st.kind]];
const toolModel=t=>{if(!t.models.length)return null;const m=UP.st.model[t.id];return t.models.some(x=>x.id===m)?m:t.defModel};
const toolFactor=t=>{if(!t.factor)return null;const f=UP.st.factor[t.id];return t.factor.opts.includes(f)?f:t.factor.def};
const toolFmt=t=>UP.st.fmt[t.id]==="png"?"png":(t.id==="img-transparent"?"png":"jpeg");
const toolFps=t=>UP.st.fps[t.id]!=null?UP.st.fps[t.id]:(t.defFps||null);
const toolParams=t=>(UP.st.params[t.id]=UP.st.params[t.id]||{});

/* ───────────── request builder ───────────── */
function upBuildBody(t,url,over){
  over=over||{};
  const model=over.model!==undefined?over.model:toolModel(t);
  const body={[t.kind==="video"?"video_url":"image_url"]:url};
  if(model)body.model=model;
  if(t.factor){const f=over.factor||toolFactor(t);body.upscale_factor=f}
  if(t.fmt&&!t.legacy){body.output_format=over.fmt||toolFmt(t)}
  if(t.outFmt){body.output_format=UP.st.outFmt[t.id]||t.outFmt.def}
  const set=over.params||toolParams(t);
  R.paramsFor(t,model).forEach(p=>{
    if(set[p.k]===undefined||set[p.k]===""||set[p.k]===null)return;
    if(p.needs&&(set[p.needs]!==undefined?set[p.needs]:(R.paramsFor(t,model).find(x=>x.k===p.needs)||{}).d)===false)return;
    body[p.k]=set[p.k];
  });
  if(t.fps){const fp=over.fps!==undefined?over.fps:toolFps(t);if(fp)body.target_fps=fp}
  if(t.h264&&(over.h264!==undefined?over.h264:UP.st.h264))body.H264_output=true;
  return body;
}

/* ───────────── fal runner ───────────── */
function falErr(d,res){
  const det=d&&d.detail;
  const msg=(Array.isArray(det)?(det[0]&&(det[0].msg||JSON.stringify(det[0]))):(typeof det==="string"?det:det&&det.message))||(d&&(d.error&&d.error.message||d.error))||(res&&res.statusText)||"Request failed";
  return String(msg);
}
async function falCall(ep,body,key,ctl){
  ctl=ctl||{};
  let sUrl=ctl.statusUrl,rUrl=ctl.resultUrl,rid=ctl.requestId;
  if(!rid){
    const res=await fetch("https://queue.fal.run/"+ep,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+key},body:JSON.stringify(body)});
    const d=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(falErr(d,res));
    rid=d.request_id;if(!rid)throw new Error("No request ID returned from fal.ai");
    sUrl=d.status_url||`https://queue.fal.run/${ep}/requests/${rid}/status`;
    rUrl=d.response_url||`https://queue.fal.run/${ep}/requests/${rid}`;
    if(ctl.onSubmit)ctl.onSubmit({requestId:rid,statusUrl:sUrl,resultUrl:rUrl});
  }
  const started=Date.now(),maxMs=ctl.maxMs||20*60*1000;
  let fails=0;
  while(Date.now()-started<maxMs){
    await new Promise(r=>setTimeout(r,Date.now()-started>60000?6000:3000));
    if(ctl.cancelled&&ctl.cancelled())throw new Error("Cancelled");
    let sd;
    try{
      const sr=await fetch(sUrl,{headers:{"Authorization":"Key "+key}});
      sd=await sr.json().catch(()=>({}));
      if(!sr.ok&&sr.status!==202)throw Object.assign(new Error(falErr(sd,sr)),{http:sr.status});
      fails=0;
    }catch(e){
      if(e.http&&e.http>=400&&e.http<500&&e.http!==429)throw e;
      if(++fails>=8)throw new Error("Lost connection while waiting — the job may still finish on fal.ai");
      continue;
    }
    const st=String(sd.status||"").toUpperCase();
    if(ctl.onStatus)ctl.onStatus(st,sd);
    if(st==="COMPLETED"){
      const rr=await fetch(rUrl,{headers:{"Authorization":"Key "+key}});
      const rd=await rr.json().catch(()=>({}));
      if(!rr.ok)throw new Error(falErr(rd,rr));
      return rd;
    }
    if(st==="ERROR"||st==="FAILED")throw new Error(falErr(sd)||"Failed on fal.ai's side");
  }
  throw new Error("Timed out — it may still finish on fal.ai's dashboard");
}
const outUrl=(t,data)=>{const o=data&&data[t.kind==="video"?"video":"image"];return o&&o.url||(data&&data.images&&data.images[0]&&data.images[0].url)||null};

// Source URL guard: data: URLs and local blobs are uploaded to fal storage first.
async function upEnsureUrl(url,key,name){
  if(/^https?:\/\//i.test(url))return url;
  let blob;
  if(url.startsWith("data:"))blob=dataUrlToBlob(url);
  else blob=await (await fetch(url)).blob();
  const f=new File([blob],name||("upload."+((blob.type||"image/png").split("/")[1]||"bin")),{type:blob.type});
  return uploadToFalStorage(f,key);
}

/* ───────────── jobs ───────────── */
const jid=()=>"upj_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function snapshotLabel(t,model,factor,over){
  const bits=[];if(model)bits.push(model);if(factor)bits.push(fmtX(factor));
  if(t.fixed&&!model)bits.push(t.fixed.split(" · ")[0]);
  return bits.join(" · ");
}
async function upRunJob(job,srcUrl,over){
  const key=gs("api_falai","");
  const t=R.byId[job.toolId];
  const ctl={
    cancelled:()=>job.cancelled,
    maxMs:t.kind==="video"?90*60*1000:20*60*1000,
    onSubmit:x=>{job.req=x;saveJobs()},
    onStatus:(st,sd)=>{
      const was=job.status;
      job.status=st==="IN_QUEUE"?"queued":"running";
      if(was!==job.status){saveJobs();upRefreshJobs()}
    }
  };
  if(over&&over.resume)Object.assign(ctl,{statusUrl:job.req.statusUrl,resultUrl:job.req.resultUrl,requestId:job.req.requestId});
  UP.running++;
  try{
    let body;
    if(over&&over.resume)body={};
    else{
      const url=await upEnsureUrl(srcUrl,key,job.srcName);
      job.srcUrl=url;
      body=upBuildBody(t,url,over);
      job.body=body;
    }
    const data=await falCall(t.ep,body,key,ctl);
    const url=outUrl(t,data);
    if(!url)throw new Error("fal.ai returned no "+t.kind);
    job.out=url;job.status="done";job.doneAt=Date.now();job.err=null;
    upAutoSave(job,t);
    try{logCost(t.ep,"Upscaler · "+job.label,1,0)}catch(_){}
  }catch(e){
    if(job.cancelled){job.status="cancelled"}
    else{job.status="failed";job.err=e.message||"Failed"}
  }finally{UP.running--;saveJobs();upRefreshJobs();upRefreshRun()}
}
function upAutoSave(job,t){
  try{
    const label=`${t.name}${job.label?" · "+job.label:""}`;
    if(t.kind==="video"&&typeof createVideoAsset==="function"){
      const a=createVideoAsset(job.out,"Enhanced video — "+label,null,{model:t.ep,providerLabel:"Topaz · "+t.name});
      job.assetId=a.id;
    }else if(t.kind==="image"){
      const a=saveUpscaleToGallery(job.out,true,"Enhanced image — "+label);
      job.assetId=a.id;
    }
    if(job.assetId&&typeof rehostToStorage==="function"){
      const folder=t.kind==="video"?"gallery-videos":"gallery-images";
      rehostToStorage(job.out,folder).then(h=>{
        if(h&&h!==job.out){const x=(S.assets||[]).find(z=>z.id===job.assetId);if(x){x.url=h;save("assets")}}
      }).catch(()=>{});
    }
  }catch(e){console.warn("Upscaler: auto-save to gallery failed",e)}
}
function newJob(t,srcUrl,srcName,thumb){
  const model=toolModel(t),factor=toolFactor(t);
  const job={id:jid(),toolId:t.id,kind:t.kind,model,factor,label:snapshotLabel(t,model,factor),status:"queued",created:Date.now(),srcUrl:srcUrl,srcName:srcName||"",thumb:thumb||srcUrl};
  UP.jobs.unshift(job);saveJobs();return job;
}

/* ───────────── sources ───────────── */
const assetsOf=kind=>(S.assets||[]).filter(a=>a&&a.type===kind&&a.url).slice().reverse();
function setSrc(kind,o){UP.src[kind]=o;upRefreshAll()}
async function uploadSrc(file){
  const key=gs("api_falai","");
  if(!key){toast("Add a fal.ai API key in Settings first","error");return}
  const kind=UP.st.kind;
  if(kind==="video"&&!/^video\//.test(file.type)){toast("Choose a video file","error");return}
  if(kind==="image"&&!/^image\//.test(file.type)){toast("Choose an image file","error");return}
  const local=URL.createObjectURL(file);
  setSrc(kind,{url:null,thumb:local,name:file.name,uploading:true});
  try{
    const url=await uploadToFalStorage(file,key);
    setSrc(kind,{url,thumb:local,name:file.name});
  }catch(e){setSrc(kind,null);toast("❌ Upload failed: "+e.message,"error")}
}

/* ───────────── UI: helpers ───────────── */
const $=id=>document.getElementById(id);
function injectCSS(){
  if($("upCss"))return;
  const s=document.createElement("style");s.id="upCss";
  s.textContent=`
.up-wrap{padding:2px 2px 90px;max-width:760px;margin:0 auto}
.up-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 2px 12px}
.up-head h2{margin:0;font-size:18px;font-weight:800;color:var(--violet,#3d1f7a);display:flex;align-items:center;gap:8px}
.up-badge{font-size:9.5px;font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:99px;background:rgba(40,180,120,.16);color:#1d8f5e}
.up-badge.off{background:rgba(220,60,80,.14);color:#c0334a}
.up-cat{margin:10px 2px 0}
.up-card{display:block}
.up-sum{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 10px}
.up-pill{font-size:11px;font-weight:700;padding:5px 10px;border-radius:99px;background:rgba(98,64,176,.10);color:var(--textm,#5a4880)}
.up-src{display:flex;gap:12px;align-items:center}
.up-prev{width:86px;height:86px;border-radius:14px;background:rgba(98,64,176,.12);overflow:hidden;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:var(--violet,#3d1f7a);position:relative}
.up-prev img,.up-prev video{width:100%;height:100%;object-fit:cover}
.up-prev .up-spin{position:absolute;inset:0;background:rgba(20,10,40,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700}
.up-srcinfo{flex:1;min-width:0}
.up-srcname{font-size:13px;font-weight:700;color:var(--text,#1e1230);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.up-srcsub{font-size:10.5px;color:var(--texts,#9488ae);margin:2px 0 8px}
.up-run{width:100%;border:0;border-radius:16px;padding:15px;font-size:15px;font-weight:800;color:#fff;background:linear-gradient(135deg,#6240b0,#3d1f7a);cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(98,64,176,.35);margin:4px 0 14px}
.up-run:disabled{opacity:.5;box-shadow:none;cursor:not-allowed}
.up-job{background:var(--glass,rgba(255,255,255,.55));border:1px solid var(--glass-brd,rgba(61,31,122,.12));border-radius:18px;padding:12px;margin-bottom:12px}
.up-jh{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}
.up-jt{font-size:13px;font-weight:800;color:var(--text,#1e1230)}
.up-js{font-size:10.5px;color:var(--texts,#9488ae);margin-top:1px}
.up-st{font-size:10px;font-weight:800;padding:3px 9px;border-radius:99px;white-space:nowrap}
.up-st.queued,.up-st.running{background:rgba(98,64,176,.14);color:#6240b0}
.up-st.done{background:rgba(40,180,120,.16);color:#1d8f5e}
.up-st.failed,.up-st.cancelled{background:rgba(220,60,80,.14);color:#c0334a}
.up-wait{display:flex;align-items:center;gap:10px;padding:18px 6px;font-size:12px;color:var(--textm,#5a4880)}
.up-dot{width:14px;height:14px;border-radius:50%;border:3px solid rgba(98,64,176,.25);border-top-color:#6240b0;animation:upSpin .9s linear infinite;flex:0 0 auto}
@keyframes upSpin{to{transform:rotate(360deg)}}
.up-err{font-size:12px;color:#c0334a;background:rgba(220,60,80,.08);border-radius:12px;padding:10px 12px;margin-bottom:8px;line-height:1.4;word-break:break-word}
.up-cmp{position:relative;border-radius:14px;overflow:hidden;background:#000;--p:50%;line-height:0;touch-action:pan-y}
.up-cmp img{width:100%;display:block}
.up-cmp .up-b{position:absolute;inset:0;height:100%;object-fit:fill;clip-path:inset(0 calc(100% - var(--p)) 0 0)}
.up-cmp .up-line{position:absolute;top:0;bottom:0;left:var(--p);width:2px;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.5);pointer-events:none}
.up-cmp .up-knob{position:absolute;top:50%;left:var(--p);width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#3d1f7a;line-height:1}
.up-cmp input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:ew-resize}
.up-tag{position:absolute;top:8px;font-size:10px;font-weight:800;color:#fff;background:rgba(0,0,0,.5);padding:3px 8px;border-radius:99px;line-height:1.2;pointer-events:none}
.up-vid{width:100%;border-radius:14px;background:#000;max-height:60vh}
.up-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.up-gi{position:relative;border-radius:12px;overflow:hidden;aspect-ratio:1;background:rgba(98,64,176,.12);cursor:pointer;border:2px solid transparent;padding:0}
.up-gi img,.up-gi video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.up-gi.on{border-color:#6240b0}
.up-gi .up-ck{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;background:#6240b0;color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center}
.up-pick{position:fixed;inset:0;z-index:260;background:rgba(10,6,20,.66);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center}
.up-pick>div{width:100%;max-width:560px;max-height:82vh;overflow:auto;background:var(--glass-solid,#fcfaff);border-radius:24px 24px 0 0;padding:14px 14px 22px}
.up-note{font-size:10.5px;color:var(--texts,#9488ae);line-height:1.45;margin:6px 2px 0}
.up-tg{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0}
.up-tg>div{min-width:0}.up-tg b{font-size:12.5px;color:var(--text,#1e1230)}.up-tg small{display:block;font-size:10px;color:var(--texts,#9488ae)}
.up-sw{width:46px;height:28px;border-radius:99px;border:0;background:rgba(98,64,176,.22);position:relative;cursor:pointer;flex:0 0 auto;transition:.18s}
.up-sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.3);transition:.18s}
.up-sw.on{background:linear-gradient(135deg,#6240b0,#3d1f7a)}.up-sw.on::after{left:21px}
.up-pr{margin-bottom:12px}
.up-pr .ks-lab b.auto{color:var(--texts,#9488ae);font-weight:700}
`;
  document.head.appendChild(s);
}
const hasKey=()=>!!gs("api_falai","");

/* ───────────── UI: screen ───────────── */
function toolCardsHTML(kind){
  const cats=R.CATS[kind];
  return cats.map(c=>{
    const ts=R.TOOLS.filter(t=>t.kind===kind&&t.cat===c);if(!ts.length)return"";
    const cur=UP.st.tool[kind];
    return `<div class="ks-lab up-cat"><span>${esc(c)}</span></div><div class="ks-rail">${ts.map(t=>`
      <button type="button" class="ks-mcard ks-glow${t.id===cur?" on":""}" data-up="tool" data-v="${t.id}"><b>${esc(t.name)}</b><small>${esc(t.tag)}</small></button>`).join("")}</div>`;
  }).join("");
}
function sourceHTML(t){
  const kind=t.kind,s=UP.src[kind];
  const icon=kind==="video"?"🎞":"🖼";
  const prev=s&&s.thumb?(kind==="video"?`<video src="${esc(s.thumb)}" muted playsinline preload="metadata"></video>`:`<img src="${esc(s.thumb)}" alt="">`):icon;
  return `<div class="ks-card"><div class="ks-lab"><span>${kind==="video"?"Source video":"Source image"}</span>${kind==="video"?"<small>up to 5 min</small>":""}</div>
    <div class="up-src"><div class="up-prev">${prev}${s&&s.uploading?`<div class="up-spin">Uploading…</div>`:""}</div>
      <div class="up-srcinfo"><div class="up-srcname">${s?esc(s.name||"Selected"):"Nothing selected"}</div>
        <div class="up-srcsub">${s?(s.uploading?"Sending to fal.ai…":"Ready"):"Upload, pick from Gallery, or paste a link"}</div>
        <div class="ks-row"><button type="button" class="ks-btn" data-up="upload">⬆ Upload</button><button type="button" class="ks-btn" data-up="gallery">Gallery</button><button type="button" class="ks-btn" data-up="link">Link</button></div></div></div>
    <input type="file" id="upFile" accept="${kind==="video"?"video/*":"image/*"}" style="display:none"></div>`;
}
function batchHTML(t){
  const list=assetsOf(t.kind).slice(0,t.kind==="video"?30:90);
  return `<div class="ks-card"><div class="ks-lab"><span>Select from Gallery</span><small>${UP.sel.length} selected</small></div>
    ${list.length?`<div class="up-grid">${list.map(a=>`<button type="button" class="up-gi${UP.sel.includes(a.id)?" on":""}" data-up="sel" data-v="${esc(a.id)}">${t.kind==="video"?`<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>`:`<img src="${esc(a.url)}" loading="lazy" alt="">`}${UP.sel.includes(a.id)?`<span class="up-ck">✓</span>`:""}</button>`).join("")}</div>`
    :`<div class="ks-hint">No ${t.kind}s in your Gallery yet.</div>`}
    <div class="up-note">Items are processed one at a time with the settings below.</div></div>`;
}
function summaryHTML(t){
  const model=toolModel(t),f=toolFactor(t);const p=[];
  if(model)p.push(model);else if(t.fixed)p.push(t.fixed.split(" · ")[0]);
  if(f)p.push(fmtX(f));
  if(t.kind==="image"&&t.fmt)p.push(toolFmt(t).toUpperCase());
  if(t.fps&&toolFps(t))p.push(toolFps(t)+" fps");
  if(t.h264&&UP.st.h264)p.push("H.264");
  const n=Object.keys(toolParams(t)).filter(k=>R.paramsFor(t,model).some(x=>x.k===k)).length;
  if(n)p.push(n+" custom");
  return p.map(x=>`<span class="up-pill">${esc(x)}</span>`).join("");
}
function runLabel(t,batch){
  if(!hasKey())return"🔑 Add fal.ai key in Settings";
  const verb=({"Upscale":"Upscale","Enhance":"Enhance","Motion":"Process","Classic":"Upscale"})[t.cat]||"Run";
  if(batch)return `${verb} ${UP.sel.length||""} ${UP.sel.length===1?t.kind:t.kind+"s"}`.replace("  "," ");
  return `${verb} ${t.kind==="video"?"video":"image"} with ${t.name}`;
}
function canRun(t,batch){
  if(!hasKey())return false;
  if(batch)return UP.sel.length>0;
  const s=UP.src[t.kind];return !!(s&&s.url&&!s.uploading);
}
function jobHTML(j){
  const t=R.byId[j.toolId];if(!t)return"";
  const st=j.status;
  const stTxt=({queued:"Queued",running:"Processing",done:"Done",failed:"Failed",cancelled:"Cancelled"})[st]||st;
  let body="";
  if(st==="queued"||st==="running"){
    body=`<div class="up-wait"><span class="up-dot"></span><div>${st==="queued"?"Waiting in queue…":"Processing on fal.ai…"}<br><span style="font-size:10.5px;color:var(--texts)">${t.kind==="video"?"Videos can take several minutes. You can leave this screen — it keeps running.":"Usually under a minute."}</span></div></div>
      <div class="up-acts"><button type="button" class="ks-btn ghost" data-up="cancel" data-v="${j.id}">Cancel</button></div>`;
  }else if(st==="failed"||st==="cancelled"){
    body=`<div class="up-err">${esc(j.err||"Cancelled")}</div><div class="up-acts"><button type="button" class="ks-btn" data-up="retry" data-v="${j.id}">↻ Retry</button><button type="button" class="ks-btn ghost" data-up="rm" data-v="${j.id}">Remove</button></div>`;
  }else{
    const media=t.kind==="video"
      ?`<video class="up-vid" src="${esc(j.out)}" controls playsinline preload="metadata"></video>`
      :(j.srcUrl&&/^https?:/.test(j.srcUrl)?`<div class="up-cmp" data-cmp><img src="${esc(j.out)}" alt=""><img class="up-b" src="${esc(j.srcUrl)}" alt=""><span class="up-tag" style="left:8px">Before</span><span class="up-tag" style="right:8px">After</span><div class="up-line"></div><div class="up-knob">⇆</div><input type="range" min="0" max="100" value="50" data-upin="cmp" aria-label="Before and after"></div>`
        :`<img src="${esc(j.out)}" style="width:100%;border-radius:14px" alt="">`);
    body=`${media}<div class="up-acts"><button type="button" class="ks-btn" data-up="dl" data-v="${j.id}">⬇ Download</button><button type="button" class="ks-btn" data-up="coll" data-v="${j.id}">📁 Collection</button><button type="button" class="ks-btn" data-up="chain" data-v="${j.id}">↪ Use as source</button><button type="button" class="ks-btn ghost" data-up="rm" data-v="${j.id}">Remove</button></div>
      <div class="up-note">✓ Saved to Gallery</div>`;
  }
  return `<div class="up-job" id="upj-${j.id}"><div class="up-jh"><div><div class="up-jt">${esc(t.name)} <span style="font-weight:600;color:var(--texts)">· ${esc(j.label||t.fixed||"")}</span></div><div class="up-js">${esc(j.srcName||"")}</div></div><span class="up-st ${st}">${stTxt}</span></div>${body}</div>`;
}
function jobsHTML(){
  const list=UP.jobs.filter(j=>j.kind===UP.st.kind);
  if(!list.length)return"";
  return `<div class="ks-lab" style="margin:6px 2px 8px"><span>Results</span><button type="button" class="ks-btn ghost sm" data-up="clear">Clear</button></div>${list.map(jobHTML).join("")}`;
}

function renderUpscaler(el){
  injectCSS();
  if(!UP.st){loadState();loadJobs();resumeJobs()}
  el=el||$("moduleContent");if(!el)return;
  const t=tool(),batch=S.upscaleMode==="batch";
  el.innerHTML=`<div class="up-wrap" id="upWrap">
    <div class="up-head"><h2>⬆ Upscaler ${hasKey()?'<span class="up-badge">fal.ai · Topaz</span>':'<span class="up-badge off">NO KEY</span>'}</h2></div>
    ${!hasKey()?`<div class="ks-card"><div class="ks-hint" style="margin:0">Add a <b>fal.ai</b> API key in Settings to enable the Upscaler. It's the same key as Image and Video.</div></div>`:""}
    <div class="ks-seg" id="upKind"><button type="button" data-up="kind" data-v="image" class="${UP.st.kind==="image"?"on":""}">Image</button><button type="button" data-up="kind" data-v="video" class="${UP.st.kind==="video"?"on":""}">Video</button></div>
    <div id="upTools">${toolCardsHTML(UP.st.kind)}</div>
    <div class="ks-hint" id="upDesc" style="margin:2px 4px 10px">${esc(t.desc)}</div>
    <div id="upSrc">${batch?batchHTML(t):sourceHTML(t)}</div>
    <div class="ks-card"><div class="ks-lab"><span>Settings</span><button type="button" class="ks-btn sm" data-up="settings">Adjust</button></div><div class="up-sum" id="upSum" style="margin:0">${summaryHTML(t)}</div></div>
    <button type="button" class="up-run" id="upRun" data-up="run">${esc(runLabel(t,batch))}</button>
    <div id="upJobs">${jobsHTML()}</div>
  </div>
  <div class="ig-settings-backdrop" id="upBackdrop" data-up="settings-close"></div>
  <div class="ig-settings-sheet kc-sheet" id="upSheet">
    <div class="ig-sheet-handle" ontouchstart="sheetSwipeStart(event)" ontouchmove="sheetSwipeMove(event,'upSheet')" ontouchend="sheetSwipeEnd(event,'upSheet','toggleUpSettings')"></div>
    <div class="ig-sheet-header"><div id="upSheetTitle"></div><button type="button" class="ks-btn sm" data-up="settings-close">Done</button></div>
    <div class="ks-body" id="upSheetBody" style="max-height:68vh;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>
  </div>`;
  upRefreshRun();
  if(UP.sheet)toggleUpSettings(true);
}

function upRefreshRun(){
  const t=tool(),b=$("upRun");if(!b)return;
  const batch=S.upscaleMode==="batch";
  b.textContent=runLabel(t,batch);
  b.disabled=!canRun(t,batch);
}
function upRefreshJobs(){const el=$("upJobs");if(el)el.innerHTML=jobsHTML()}
function upRefreshSummary(){const t=tool();const s=$("upSum");if(s)s.innerHTML=summaryHTML(t)}
function upRefreshSource(){const t=tool();const el=$("upSrc");if(el)el.innerHTML=S.upscaleMode==="batch"?batchHTML(t):sourceHTML(t)}
function upRefreshAll(){upRefreshSource();upRefreshSummary();upRefreshRun();upRefreshJobs()}

/* ───────────── settings shutter ───────────── */
function paramHTML(t,model,p){
  const set=toolParams(t);const v=set[p.k];
  const lab=(extra)=>`<div class="ks-lab"><span>${esc(p.l)}</span>${extra||""}</div>`;
  const hint=p.hint?`<div class="ks-hint">${esc(p.hint)}</div>`:"";
  if(p.needs){const on=set[p.needs]!==undefined?set[p.needs]:(R.paramsFor(t,model).find(x=>x.k===p.needs)||{}).d;if(on===false)return""}
  if(p.t==="bool"){
    const on=v!==undefined?v:!!p.d;
    return `<div class="up-tg"><div><b>${esc(p.l)}</b>${p.hint?`<small>${esc(p.hint)}</small>`:""}</div><button type="button" class="up-sw${on?" on":""}" data-up="bool" data-k="${p.k}" aria-pressed="${on}"></button></div>`;
  }
  if(p.t==="seg"){
    return `<div class="up-pr">${lab(v!==undefined?`<button type="button" class="ks-btn ghost sm" data-up="preset" data-k="${p.k}">Auto</button>`:`<b class="auto">Auto</b>`)}${hint}<div class="ks-seg">${p.opts.map(o=>`<button type="button" data-up="seg" data-k="${p.k}" data-v="${esc(o[0])}" class="${v===o[0]?"on":""}">${esc(o[1])}</button>`).join("")}</div></div>`;
  }
  if(p.t==="text"){
    return `<div class="up-pr">${lab()}${hint}<textarea class="ks-ta" rows="2" maxlength="${p.max}" data-upin="text" data-k="${p.k}" placeholder="Optional">${esc(v||"")}</textarea></div>`;
  }
  // range / int
  const dv=v!==undefined?v:(p.d!==undefined?p.d:null);
  const shown=dv==null?p.min:dv;
  const pct=((shown-p.min)/(p.max-p.min))*100;
  const valTxt=v!==undefined?String(v):(p.d!==undefined?String(p.d):"Auto");
  return `<div class="up-pr">${lab(`<span style="display:flex;align-items:center;gap:8px"><b id="upv-${p.k}"${v===undefined&&p.d===undefined?' class="auto"':""}>${esc(valTxt)}</b>${v!==undefined?`<button type="button" class="ks-btn ghost sm" data-up="preset" data-k="${p.k}">Auto</button>`:""}</span>`)}${hint}
    <input type="range" class="ks-range" min="${p.min}" max="${p.max}" step="${p.t==="int"?1:p.step}" value="${shown}" data-upin="range" data-k="${p.k}" data-int="${p.t==="int"?1:0}" style="--ksf:${pct}%"></div>`;
}
function sheetHTML(){
  const t=tool(),model=toolModel(t),f=toolFactor(t);
  let h="";
  if(t.models.length){
    h+=`<div class="ks-lab"><span>Model</span><small>${t.models.length} available</small></div><div class="ks-rail">${t.models.map(m=>`<button type="button" class="ks-mcard ks-glow${m.id===model?" on":""}" data-up="model" data-v="${esc(m.id)}"><b>${esc(m.id)}</b><small>${esc(m.sub)}</small></button>`).join("")}</div>`;
  }else if(t.fixed){
    h+=`<div class="ks-card"><div class="ks-lab"><span>Model</span></div><div class="up-srcname">${esc(t.fixed)}</div></div>`;
  }
  if(t.factor){
    h+=`<div class="ks-card"><div class="ks-lab"><span>Scale</span><b>${fmtX(f)}</b></div><div class="ks-chips">${t.factor.opts.map(o=>`<button type="button" class="ks-chip${o===f?" on":""}" data-up="factor" data-v="${o}">${fmtX(o)}</button>`).join("")}</div>${t.factor.note?`<div class="up-note">${esc(t.factor.note)}</div>`:""}</div>`;
  }
  if(t.kind==="image"&&t.fmt&&t.id!=="img-transparent"){
    h+=`<div class="ks-card"><div class="ks-lab"><span>Output format</span></div><div class="ks-seg"><button type="button" data-up="fmt" data-v="jpeg" class="${toolFmt(t)==="jpeg"?"on":""}">JPEG</button><button type="button" data-up="fmt" data-v="png" class="${toolFmt(t)==="png"?"on":""}">PNG</button></div></div>`;
  }
  if(t.outFmt){
    const cur=UP.st.outFmt[t.id]||t.outFmt.def;
    h+=`<div class="ks-card"><div class="ks-lab"><span>Output</span></div><div class="ks-seg">${t.outFmt.opts.map(o=>`<button type="button" data-up="outfmt" data-v="${o[0]}" class="${cur===o[0]?"on":""}">${esc(o[1])}</button>`).join("")}</div><div class="up-note">${esc(t.outFmt.hint||"")}</div></div>`;
  }
  if(t.fps){
    const cur=toolFps(t);
    h+=`<div class="ks-card"><div class="ks-lab"><span>Frame rate</span><small>${t.defFps?"":"Source keeps its own unless changed"}</small></div><div class="ks-chips">${t.defFps?"":`<button type="button" class="ks-chip${!cur?" on":""}" data-up="fps" data-v="0">Source</button>`}${t.fps.map(o=>`<button type="button" class="ks-chip${o===cur?" on":""}" data-up="fps" data-v="${o}">${o} fps</button>`).join("")}</div><div class="up-note">Interpolation only runs when this differs from the source.</div></div>`;
  }
  const ps=R.paramsFor(t,model);
  if(ps.length){
    const set=toolParams(t);
    const touched=ps.some(p=>set[p.k]!==undefined);
    h+=`<div class="ks-card"><div class="ks-lab"><span>Fine-tune</span>${touched?`<button type="button" class="ks-btn ghost sm" data-up="resetall">Reset all</button>`:`<small>Auto = Topaz picks per model</small>`}</div>${ps.map(p=>paramHTML(t,model,p)).join("")}</div>`;
  }
  if(t.h264){
    h+=`<div class="ks-card"><div class="up-tg"><div><b>H.264 output</b><small>Wider device support · default is H.265</small></div><button type="button" class="up-sw${UP.st.h264?" on":""}" data-up="h264"></button></div></div>`;
  }
  h+=`<div class="up-note" style="margin:0 4px 6px">Billed by fal.ai per output size. Pricing isn't shown here — check fal.ai/pricing. Cost log records these runs without an amount.</div>`;
  return h;
}
function upRefreshSheet(){
  const body=$("upSheetBody");if(!body)return;
  const sc=body.scrollTop;
  const t=tool();
  const ttl=$("upSheetTitle");if(ttl)ttl.textContent=t.name+" settings";
  body.innerHTML=sheetHTML();body.scrollTop=sc;
  upRefreshSummary();
}
function toggleUpSettings(force){
  const panel=$("upSheet"),bd=$("upBackdrop");if(!panel)return;
  const open=force===true?true:force===false?false:!panel.classList.contains("open");
  UP.sheet=open;
  if(open)upRefreshSheet();
  panel.classList.toggle("open",open);
  if(bd)bd.classList.toggle("show",open);
}

/* ───────────── picker (Gallery / link) ───────────── */
function openPicker(mode){
  closePicker();
  const t=tool();
  const el=document.createElement("div");el.className="up-pick";el.id="upPick";
  el.setAttribute("data-up","pick-close");
  if(mode==="link"){
    el.innerHTML=`<div data-stop="1"><div class="ks-lab"><span>Paste a ${t.kind} link</span></div><input class="ks-ta" id="upLinkIn" placeholder="https://…" autocomplete="off"><div class="up-note">Must be a public link.</div><div class="ks-row" style="margin-top:12px"><button type="button" class="ks-btn ghost" data-up="pick-close">Cancel</button><button type="button" class="ks-btn" data-up="link-ok">Use link</button></div></div>`;
  }else{
    const list=assetsOf(t.kind).slice(0,t.kind==="video"?30:90);
    el.innerHTML=`<div data-stop="1"><div class="ks-lab"><span>Choose from Gallery</span><button type="button" class="ks-btn ghost sm" data-up="pick-close">Close</button></div>${list.length?`<div class="up-grid">${list.map(a=>`<button type="button" class="up-gi" data-up="gal-pick" data-v="${esc(a.id)}">${t.kind==="video"?`<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>`:`<img src="${esc(a.url)}" loading="lazy" alt="">`}</button>`).join("")}</div>`:`<div class="ks-hint">No ${t.kind}s in your Gallery yet.</div>`}</div>`;
  }
  document.body.appendChild(el);
  if(mode==="link")setTimeout(()=>{const i=$("upLinkIn");if(i)i.focus()},50);
}
function closePicker(){const e=$("upPick");if(e)e.remove()}

/* ───────────── actions ───────────── */
function setKind(k){UP.st.kind=k;saveState();renderUpscaler()}
function pickTool(id){UP.st.tool[UP.st.kind]=id;saveState();
  const t=tool();
  $("upTools").innerHTML=toolCardsHTML(UP.st.kind);
  const d=$("upDesc");if(d)d.textContent=t.desc;
  upRefreshSource();upRefreshSummary();upRefreshRun();upRefreshJobs();
  if(UP.sheet)upRefreshSheet();
}
function setParam(k,v){const t=tool();toolParams(t)[k]=v;saveState()}
function clearParam(k){const t=tool();delete toolParams(t)[k];saveState()}

async function runSingle(){
  const t=tool(),s=UP.src[t.kind];
  if(!canRun(t,false))return;
  const job=newJob(t,s.url,s.name,s.thumb&&/^https?:/.test(s.thumb)?s.thumb:s.url);
  job.status="queued";upRefreshJobs();upRefreshRun();
  upRunJob(job,s.url);
  setTimeout(()=>{const e=$("upj-"+job.id);if(e&&e.scrollIntoView)e.scrollIntoView({behavior:"smooth",block:"center"})},120);
}
async function runBatch(){
  const t=tool();if(!canRun(t,true))return;
  const ids=UP.sel.slice();UP.sel=[];
  upRefreshSource();upRefreshRun();
  toast(`Queued ${ids.length} ${t.kind}${ids.length>1?"s":""}`,"success");
  // Create every job card up front so the list shows the whole batch, then run them
  // one at a time (gentler on rate limits and on a phone connection).
  const items=ids.map(id=>(S.assets||[]).find(a=>a.id===id)).filter(Boolean).map(a=>({a,job:newJob(t,a.url,(a.prompt||"Gallery item").slice(0,40),a.url)}));
  upRefreshJobs();
  for(const it of items){if(it.job.cancelled)continue;await upRunJob(it.job,it.a.url)}
  toast("✨ Batch finished","success");
}
function resumeJobs(){
  const key=gs("api_falai","");
  UP.jobs.forEach(j=>{
    if((j.status==="queued"||j.status==="running")){
      if(key&&j.req&&j.req.requestId&&Date.now()-j.created<2*3600*1000){upRunJob(j,null,{resume:true})}
      else{j.status="failed";j.err="Interrupted before it was submitted — run it again."}
    }
  });
  saveJobs();
}
function findJob(id){return UP.jobs.find(j=>j.id===id)}

function onClick(e){
  const el=e.target.closest("[data-up]");if(!el)return;
  const a=el.dataset.up,v=el.dataset.v,k=el.dataset.k;
  if(el.id==="upPick"&&e.target!==el)return; // backdrop click only
  const t=window.UP_REGISTRY&&UP.st?tool():null;
  switch(a){
    case"kind":setKind(v);break;
    case"tool":pickTool(v);break;
    case"settings":toggleUpSettings(true);break;
    case"settings-close":toggleUpSettings(false);break;
    case"upload":{const f=$("upFile");if(f)f.click();break}
    case"gallery":openPicker("gallery");break;
    case"link":openPicker("link");break;
    case"pick-close":closePicker();break;
    case"link-ok":{
      const u=($("upLinkIn")||{}).value;const val=(u||"").trim();
      if(!/^https?:\/\//i.test(val)){toast("Paste a public https:// link","error");return}
      closePicker();setSrc(t.kind,{url:val,thumb:val,name:val.split("/").pop().split("?")[0]||"Linked file"});break}
    case"gal-pick":{
      const asset=(S.assets||[]).find(x=>x.id===v);if(!asset)return;
      closePicker();
      setSrc(t.kind,{url:asset.url,thumb:asset.url,name:(asset.prompt||"Gallery item").slice(0,40)});break}
    case"sel":{const i=UP.sel.indexOf(v);if(i>=0)UP.sel.splice(i,1);else UP.sel.push(v);upRefreshSource();upRefreshRun();break}
    case"run":S.upscaleMode==="batch"?runBatch():runSingle();break;
    case"model":UP.st.model[t.id]=v;saveState();upRefreshSheet();break;
    case"factor":UP.st.factor[t.id]=parseFloat(v);saveState();upRefreshSheet();break;
    case"fmt":UP.st.fmt[t.id]=v;saveState();upRefreshSheet();break;
    case"outfmt":UP.st.outFmt[t.id]=v;saveState();upRefreshSheet();break;
    case"fps":UP.st.fps[t.id]=parseInt(v,10)||0;saveState();upRefreshSheet();break;
    case"h264":UP.st.h264=!UP.st.h264;saveState();upRefreshSheet();break;
    case"bool":{const p=R.paramsFor(t,toolModel(t)).find(x=>x.k===k);const cur=toolParams(t)[k]!==undefined?toolParams(t)[k]:!!(p&&p.d);setParam(k,!cur);upRefreshSheet();break}
    case"seg":setParam(k,v);upRefreshSheet();break;
    case"preset":clearParam(k);upRefreshSheet();break;
    case"resetall":UP.st.params[t.id]={};saveState();upRefreshSheet();break;
    case"cancel":{const j=findJob(v);if(j){j.cancelled=true;j.status="cancelled";j.err="Cancelled";saveJobs();upRefreshJobs()}break}
    case"retry":{
      const j=findJob(v);if(!j)return;
      const jt=R.byId[j.toolId];const src=j.srcUrl;if(!src){toast("Source is gone — pick it again","error");return}
      j.status="queued";j.err=null;j.cancelled=false;j.req=null;upRefreshJobs();
      upRunJob(j,src,{model:j.model,factor:j.factor,params:j.body?paramsFromBody(jt,j.body):undefined});break}
    case"rm":{UP.jobs=UP.jobs.filter(j=>j.id!==v);saveJobs();upRefreshJobs();break}
    case"clear":{UP.jobs=UP.jobs.filter(j=>j.kind!==UP.st.kind||j.status==="queued"||j.status==="running");saveJobs();upRefreshJobs();break}
    case"dl":{const j=findJob(v);if(j&&j.out)downloadWithName(j.out,`KosmicKat_${R.byId[j.toolId].id}.${j.kind==="video"?"mp4":(/png/i.test(j.out)?"png":"jpg")}`);break}
    case"coll":{const j=findJob(v);if(j&&j.assetId)openCollectionPicker("asset",j.assetId);else toast("Not saved to Gallery yet","error");break}
    case"chain":{
      const j=findJob(v);if(!j||!j.out)return;
      setSrc(j.kind,{url:j.out,thumb:j.out,name:"Result · "+R.byId[j.toolId].name});
      toast("Set as source — pick the next tool","success");
      const w=$("upWrap");if(w&&w.scrollIntoView)w.scrollIntoView({behavior:"smooth"});break}
  }
}
function paramsFromBody(t,body){
  const o={};R.paramsFor(t,body.model).forEach(p=>{if(body[p.k]!==undefined)o[p.k]=body[p.k]});return o;
}
function onInput(e){
  const el=e.target.closest("[data-upin]");if(!el)return;
  const k=el.dataset.k;
  if(el.dataset.upin==="cmp"){const box=el.closest(".up-cmp");if(box)box.style.setProperty("--p",el.value+"%");return}
  if(el.dataset.upin==="range"){
    const v=el.dataset.int==="1"?parseInt(el.value,10):parseFloat(el.value);
    setParam(k,v);
    el.style.setProperty("--ksf",((el.value-el.min)/(el.max-el.min)*100)+"%");
    const lbl=$("upv-"+k);if(lbl){lbl.textContent=String(v);lbl.classList.remove("auto")}
    upRefreshSummary();return;
  }
  if(el.dataset.upin==="text"){
    const val=el.value;if(val.trim())setParam(k,val);else clearParam(k);upRefreshSummary();
  }
}
function onChange(e){
  if(e.target&&e.target.id==="upFile"){const f=e.target.files&&e.target.files[0];e.target.value="";if(f)uploadSrc(f)}
}
if(!window.__upBound){
  window.__upBound=true;
  document.addEventListener("click",onClick);
  document.addEventListener("input",onInput);
  document.addEventListener("change",onChange);
}

/* ───────────── public API ───────────── */
function setUpscaleMode(mode){
  S.upscaleMode=mode==="batch"?"batch":"single";
  const el=$("moduleContent");if(el&&$("upWrap"))renderUpscaler(el);
}
// Used by Node Canvas: engine is a registry endpoint id (or a legacy fal-ai/… id).
async function upscaleImageUrl(url,engine,apiKey){
  const t=R.byEp[engine]||R.byEp["fal-ai/esrgan"];
  const src=await upEnsureUrl(url,apiKey);
  const body=upBuildBody(t,src,{model:t.models.length?t.defModel:null,factor:t.factor?t.factor.def:undefined,fmt:"png",params:{},h264:false});
  const data=await falCall(t.ep,body,apiKey,{maxMs:20*60*1000});
  const u=outUrl(t,data);if(!u)throw new Error("No image URL in response");
  return u;
}
function saveUpscaleToGallery(url,silent,label){
  const asset={id:"asset_"+Date.now()+"_"+Math.random().toString(36).slice(2,5),type:"image",url,prompt:label||"Upscaled image",created:new Date().toISOString()};
  S.assets.push(asset);save("assets");
  if(!silent)toast("💾 Saved to Gallery","success");
  return asset;
}
Object.assign(window,{renderUpscaler,setUpscaleMode,upscaleImageUrl,saveUpscaleToGallery,toggleUpSettings,
  KosmicUpscaler:{state:UP,buildBody:upBuildBody,registry:R}});
})();

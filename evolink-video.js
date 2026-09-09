/* KOSMIC KAT — EVO LINK VIDEO ECOSYSTEM
 * Phase 11: centralized EvoLink video catalog + schema-aware playground.
 *
 * The catalog tracks EvoLink's 29 current video model cards. Variant/model
 * routes are represented inside each card so pricing SKUs are not mistaken
 * for separate model families. Existing provider IDs remain untouched.
 *
 * Network contract: EvoLink's unified async POST /v1/videos/generations
 * followed by GET /v1/tasks/{task_id}. Authentication uses the existing
 * api_evolink browser setting.
 */
(function installKosmicEvoLinkVideo(){
  "use strict";
  if(window.__kosmicEvoLinkVideoInstalled)return;
  window.__kosmicEvoLinkVideoInstalled=true;

  const CATALOG=[
    {id:"seedance-2.5-reference-to-video",name:"Seedance 2.5",provider:"BytePlus",group:"Seedance",price:"$0.084/input + output sec",routes:[
      {id:"seedance-2.5-text-to-video",mode:"text",label:"Text to Video"},
      {id:"seedance-2.5-image-to-video",mode:"image",label:"Image to Video"},
      {id:"seedance-2.5-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"seedance-2.5-video-edit",mode:"edit",label:"Video Edit"},
      {id:"seedance-2.5-video-extend",mode:"extend",label:"Video Extend"}
    ],schema:{duration:[4,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","auto"],audio:true,webSearch:true,refs:{images:30,videos:10,audios:10}}},
    {id:"seedance-2.0-reference-to-video",name:"Seedance 2.0",provider:"BytePlus",group:"Seedance",price:"$0.057/input + output sec",routes:[
      {id:"seedance-2.0-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"seedance-2.0-fast-reference-to-video",mode:"reference",label:"Fast Reference to Video"},
      {id:"seedance-2.0-text-to-video",mode:"text",label:"Text to Video"},
      {id:"seedance-2.0-image-to-video",mode:"image",label:"Image to Video"}
    ],schema:{duration:[4,15],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","auto"],audio:true,webSearch:true,refs:{images:30,videos:10,audios:10}}},
    {id:"seedance-2.0-mini-reference-to-video",name:"Seedance 2.0 Mini",provider:"BytePlus",group:"Seedance",price:"$0.012/output sec",routes:[{id:"seedance-2.0-mini-reference-to-video",mode:"reference",label:"Reference to Video"}],schema:{duration:[4,15],quality:["480p","720p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","auto"],audio:true}},
    {id:"minimax-h3-max-text-to-video",name:"MiniMax H3 Max",provider:"MiniMax",group:"MiniMax",price:"$0.050/output sec",routes:[{id:"minimax-h3-max-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[5,15],quality:["480p","768p"],aspect:["16:9","9:16"]}},
    {id:"gemini-omni-1.1-flash-text-to-video",name:"Gemini Omni 1.1 Flash",provider:"Google",group:"Gemini",price:"token based",routes:[{id:"gemini-omni-1.1-flash-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[3,10],quality:["360p","720p","1080p","4K"],aspect:["16:9","9:16","auto"],audio:true}},
    {id:"wan3.0-text-to-video",name:"Wan 3.0",provider:"Alibaba",group:"Wan",price:"$0.038/output sec",routes:[{id:"wan3.0-text-to-video",mode:"text",label:"Text to Video"},{id:"wan3.0-image-to-video",mode:"image",label:"Image to Video"},{id:"wan3.0-reference-to-video",mode:"reference",label:"Reference to Video"}],schema:{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1"]}},
    {id:"wan3.0-prime-text-to-video",name:"Wan 3.0 Prime",provider:"Alibaba",group:"Wan",price:"$0.058/output sec",routes:[{id:"wan3.0-prime-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1"]}},
    {id:"minimax-h3-text-to-video",name:"MiniMax H3",provider:"MiniMax",group:"MiniMax",price:"$0.076/output sec",routes:[{id:"minimax-h3-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[4,15],quality:["768p","2K"],aspect:["16:9","9:16"]}},
    {id:"grok-imagine-video-1.5-preview",name:"Grok Imagine Video 1.5",provider:"xAI",group:"Grok",price:"$0.064/output sec",routes:[{id:"grok-imagine-video-1.5-preview",mode:"reference",label:"Text / Image / Reference"}],schema:{duration:[1,15],quality:["480p","720p","1080p"],aspect:["16:9","9:16"],multiImage:true}},
    {id:"gemini-omni-flash-text-to-video",name:"Gemini Omni Flash",provider:"Google",group:"Gemini",price:"$0.015/1K video tokens",routes:[
      {id:"gemini-omni-flash-text-to-video",mode:"text",label:"Text to Video"},
      {id:"gemini-omni-flash-image-to-video",mode:"image",label:"Image to Video"},
      {id:"gemini-omni-flash-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"gemini-omni-flash-video-edit",mode:"edit",label:"Video Edit"}
    ],schema:{duration:[3,10],quality:["720p"],aspect:["16:9","9:16","auto"],audio:true,videoEditMax:10}},
    {id:"kling-v3-turbo-text-to-video",name:"Kling 3.0 Turbo",provider:"Kling",group:"Kling",price:"$0.106/output sec",routes:[{id:"kling-v3-turbo-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"kling-o3-text-to-video",name:"Kling O3",provider:"Kling",group:"Kling",price:"$0.080/output sec",routes:[{id:"kling-o3-text-to-video",mode:"text",label:"Text to Video"},{id:"kling-o3-image-to-video",mode:"image",label:"Image to Video"},{id:"kling-o3-reference-to-video",mode:"reference",label:"Reference to Video"},{id:"kling-o3-video-edit",mode:"edit",label:"Video Edit"}],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"kling-v3-text-to-video",name:"Kling 3.0",provider:"Kling",group:"Kling",price:"$0.080/output sec",routes:[{id:"kling-v3-text-to-video",mode:"text",label:"Text to Video"},{id:"kling-v3-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"wan2.6-text-to-video",name:"Wan 2.6",provider:"Alibaba",group:"Wan",price:"$0.075/output sec",routes:[{id:"wan2.6-text-to-video",mode:"text",label:"Text to Video"},{id:"wan2.6-image-to-video",mode:"image",label:"Image to Video"},{id:"wan2.6-reference-to-video",mode:"reference",label:"Reference to Video"}],schema:{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"veo3.1-fast-beta",name:"Veo 3.1",provider:"Google",group:"Veo",price:"$0.318/video Fast · Pro higher",routes:[{id:"veo3.1-fast-beta",mode:"text",label:"Fast Text to Video"},{id:"veo3.1-pro-beta",mode:"text",label:"Pro Text to Video"},{id:"veo3.1-fast-image-to-video",mode:"image",label:"Fast Image to Video"},{id:"veo3.1-pro-image-to-video",mode:"image",label:"Pro Image to Video"}],schema:{duration:[8,8],quality:["720p","1080p"],aspect:["16:9","9:16"],audio:true,variants:["fast","pro"]}},
    {id:"sora-2-preview",name:"Sora 2",provider:"OpenAI",group:"Sora",price:"$0.085/output sec",routes:[{id:"sora-2-preview",mode:"text",label:"Text to Video"},{id:"sora-2-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[10,15],quality:["720p"],aspect:["16:9","9:16"],audio:true}},
    {id:"sora-2-pro-preview",name:"Sora 2 Pro",provider:"OpenAI",group:"Sora",price:"$0.255/output sec",routes:[{id:"sora-2-pro-preview",mode:"text",label:"Text to Video"},{id:"sora-2-pro-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[10,15],quality:["720p"],aspect:["16:9","9:16"],audio:true}},
    {id:"grok-imagine-text-to-video-beta",name:"Grok Imagine Video 1.0",provider:"xAI",group:"Grok",price:"$0.012/output sec",routes:[{id:"grok-imagine-text-to-video-beta",mode:"text",label:"Text to Video"},{id:"grok-imagine-image-to-video-beta",mode:"image",label:"Image to Video"}],schema:{duration:[6,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"wan2.5-image-to-video",name:"Wan 2.5",provider:"Alibaba",group:"Wan",price:"$0.038/output sec",routes:[{id:"wan2.5-image-to-video",mode:"image",label:"Image to Video"},{id:"wan2.5-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[2,10],quality:["480p","720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"MiniMax-Hailuo-2.3-Fast",name:"Hailuo 2.3",provider:"MiniMax",group:"Hailuo",price:"$0.177/video",routes:[{id:"MiniMax-Hailuo-2.3-Fast",mode:"text",label:"Text to Video"},{id:"MiniMax-Hailuo-2.3-Fast-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[6,6],quality:["768p","1080p"],aspect:["16:9","9:16"]}},
    {id:"MiniMax-Hailuo-02",name:"Hailuo 02",provider:"MiniMax",group:"Hailuo",price:"$0.080/video",routes:[{id:"MiniMax-Hailuo-02",mode:"text",label:"Text to Video"},{id:"MiniMax-Hailuo-02-image-to-video",mode:"image",label:"Image to Video"},{id:"MiniMax-Hailuo-02-first-last-frame",mode:"first_last",label:"First + Last Frame"}],schema:{duration:[6,6],quality:["512p","768p","1080p"],aspect:["16:9","9:16"]}},
    {id:"kling-o1-image-to-video",name:"Kling O1",provider:"Kling",group:"Kling",price:"$0.118/output sec",routes:[{id:"kling-o1-image-to-video",mode:"image",label:"Image to Video"},{id:"kling-o1-video-edit-fast",mode:"edit",label:"Video Edit Fast"}],schema:{duration:[3,20],quality:["720p","1080p"],aspect:["16:9","9:16"]}},
    {id:"doubao-seedance-1.0-pro-fast",name:"Seedance 1.0 Pro Fast",provider:"BytePlus",group:"Seedance",price:"$0.0060/output sec",routes:[{id:"doubao-seedance-1.0-pro-fast",mode:"text",label:"Text to Video"},{id:"doubao-seedance-1.0-pro-fast-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[2,12],quality:["480p","720p"],aspect:["16:9","9:16"]}},
    {id:"seedance-1.5-pro",name:"Seedance 1.5 Pro",provider:"BytePlus",group:"Seedance",price:"$0.027/output sec",routes:[{id:"seedance-1.5-pro",mode:"text",label:"Text to Video"},{id:"seedance-1.5-pro-image-to-video",mode:"image",label:"Image to Video"}],schema:{duration:[4,12],quality:["480p","720p","1080p"],aspect:["16:9","9:16"],audio:true}},
    {id:"kling-v3-motion-control",name:"Kling 3.0 Motion Control",provider:"Kling",group:"Specialized",price:"$0.121/input sec",routes:[{id:"kling-v3-motion-control",mode:"motion",label:"Motion Control"}],schema:{quality:["720p","1080p"],required:["image_urls","video_urls"],duration:[3,30],params:{character_orientation:["image","video"],keep_sound:[true,false]}}},
    {id:"topaz-video-upscale",name:"Topaz Video Upscale",provider:"Topaz",group:"Specialized",price:"$0.055+/input sec",routes:[{id:"topaz-video-upscale",mode:"upscale",label:"Video Upscale"}],schema:{required:["video_urls"],params:{upscale_factor:["1","2","4"]}}},
    {id:"omnihuman-1.5",name:"OmniHuman 1.5",provider:"BytePlus",group:"Specialized",price:"$0.177/input audio sec",routes:[{id:"omnihuman-1.5",mode:"avatar",label:"Digital Human"}],schema:{required:["audio_url","image_urls"],duration:[1,35],params:{subject_check:[true,false],auto_mask:[true,false],pe_fast_mode:[true,false],seed:[-1]}}},
    {id:"happyhorse-1.1-text-to-video",name:"Happy Horse 1.1",provider:"Alibaba",group:"Happy Horse",price:"$0.124/output sec",routes:[{id:"happyhorse-1.1-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","2:1","1:2","auto"]}},
    {id:"happyhorse-1.0-text-to-video",name:"Happy Horse 1.0",provider:"Alibaba",group:"Happy Horse",price:"$0.124/output sec",routes:[{id:"happyhorse-1.0-text-to-video",mode:"text",label:"Text to Video"}],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","auto"]}}
  ];

  const INDEX={};
  CATALOG.forEach(m=>m.routes.forEach(r=>{INDEX[r.id]={model:m,...r};}));
  window.KOSMIC_EVOLINK_VIDEO={catalog:CATALOG,index:INDEX,endpoint:"https://api.evolink.ai/v1/videos/generations",taskEndpoint:"https://api.evolink.ai/v1/tasks/"};

  function esc(v){return String(v==null?"":v).replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch]));}
  function isEvoModel(id){return !!INDEX[id];}

  function extractUrl(data){
    const candidates=[data?.video_url,data?.download_url,data?.url,data?.output?.video_url,data?.output?.download_url,data?.output?.url,data?.result?.video_url,data?.result?.download_url,data?.result?.url,data?.output?.video?.url,data?.result?.video?.url,...(Array.isArray(data?.videos)?data.videos.map(v=>typeof v==="string"?v:v?.url):[]),...(Array.isArray(data?.output?.videos)?data.output.videos.map(v=>typeof v==="string"?v:v?.url):[])];
    return candidates.find(v=>typeof v==="string"&&/^https?:\/\//i.test(v))||null;
  }
  function taskId(data){return data?.id||data?.task_id||data?.task?.id||data?.data?.id||null;}
  function failedStatus(s){return ["failed","error","cancelled","canceled"].includes(String(s||"").toLowerCase());}
  function doneStatus(s){return ["completed","complete","succeeded","success","done"].includes(String(s||"").toLowerCase());}
  async function evoFetch(url,options={}){
    const key=String(gs("api_evolink","")||"").trim();
    if(!key)throw new Error("Add an EvoLink API key in Settings first");
    return fetch(url,{...options,headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",...(options.headers||{})}});
  }
  async function createEvoTask(model,payload){
    const res=await evoFetch(window.KOSMIC_EVOLINK_VIDEO.endpoint,{method:"POST",body:JSON.stringify({model,...payload})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data?.error?.message||data?.message||`EvoLink returned HTTP ${res.status}`);
    const id=taskId(data);if(!id)throw new Error("EvoLink did not return a task id");
    return {id,data};
  }
  async function pollEvoTask(id,opts={}){
    const timeout=Math.max(60000,Number(opts.timeout||900000));
    const interval=Math.max(1200,Number(opts.interval||2500));
    const started=Date.now();let last=null;
    while(Date.now()-started<timeout){
      const res=await evoFetch(window.KOSMIC_EVOLINK_VIDEO.taskEndpoint+encodeURIComponent(id),{method:"GET"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error?.message||data?.message||`EvoLink task query failed (HTTP ${res.status})`);
      last=data;
      const status=String(data.status||data.task_info?.status||data.state||"").toLowerCase();
      if(failedStatus(status))throw new Error(data?.error?.message||data?.error?.reason||data?.message||"EvoLink video task failed");
      const url=extractUrl(data);
      if(url)return {url,data};
      if(doneStatus(status))throw new Error("EvoLink marked the task complete but did not return a video URL");
      await new Promise(r=>setTimeout(r,interval));
    }
    throw new Error("EvoLink task timed out"+(last?.status?` (last status: ${last.status})`:""));
  }
  function makePayload(model,prompt,options={}){
    const r=INDEX[model];if(!r)throw new Error("Unsupported EvoLink video model: "+model);
    const body={};
    if(prompt)body.prompt=prompt;
    if(options.aspect_ratio)body.aspect_ratio=options.aspect_ratio;
    if(options.duration!=null&&options.duration!=="")body.duration=options.duration===-1||options.duration==="auto"?"auto":String(options.duration);
    if(options.quality)body.quality=options.quality;
    if(options.output_format)body.output_format=options.output_format;
    if(options.generate_audio!=null&&r.model.schema.audio)body.generate_audio=!!options.generate_audio;
    if(options.web_search!=null&&r.model.schema.webSearch)body.web_search=!!options.web_search;
    if(options.image_urls?.length)body.image_urls=options.image_urls;
    if(options.video_urls?.length)body.video_urls=options.video_urls;
    if(options.audio_urls?.length)body.audio_urls=options.audio_urls;
    if(options.audio_url)body.audio_url=options.audio_url;
    if(options.mask_url)body.mask_url=options.mask_url;
    if(options.model_params)body.model_params=options.model_params;
    if(options.callback_url)body.callback_url=options.callback_url;
    if(options.model_extra&&typeof options.model_extra==="object")Object.assign(body,options.model_extra);
    return body;
  }
  async function generateEvoLinkVideo(model,prompt,options={}){
    const r=INDEX[model];if(!r)throw new Error("Unsupported EvoLink video model: "+model);
    const payload=makePayload(model,prompt||"",options);
    if(r.mode==="edit"&&r.model.schema.videoEditMax&&Array.isArray(payload.video_urls)&&payload.video_urls.length>1)payload.video_urls=payload.video_urls.slice(0,1);
    if(r.mode==="motion"){
      if(!payload.image_urls?.length||!payload.video_urls?.length)throw new Error("Kling 3.0 Motion Control requires both a character image and motion video");
      payload.model_params=payload.model_params||{};
      payload.model_params.character_orientation=payload.model_params.character_orientation||"image";
      payload.quality=payload.quality||"720p";
    }
    if(r.mode==="upscale"){
      if(!payload.video_urls?.length)throw new Error("Topaz Video Upscale requires an input video");
      payload.model_params=payload.model_params||{};
      payload.model_params.upscale_factor=String(payload.model_params.upscale_factor||"2");
    }
    if(r.mode==="avatar"){
      if(!payload.image_urls?.length||!payload.audio_url)throw new Error("OmniHuman 1.5 requires one image and one audio URL");
      payload.image_urls=payload.image_urls.slice(0,1);
      payload.model_params=payload.model_params||{};
    }
    const created=await createEvoTask(model,payload);
    const result=await pollEvoTask(created.id,options);
    return {url:result.url,taskId:created.id,raw:result.data,created:created.data,model};
  }
  window.generateEvoLinkVideo=generateEvoLinkVideo;
  window.isEvoLinkVideoModel=isEvoModel;

  // Preserve all legacy generation functions. Intercept only when the selected
  // model is an EvoLink route ID, keeping older provider IDs and image routes intact.
  function wrapGlobal(name,modelIndex){
    const original=window[name];if(typeof original!=="function"||original.__kosmicEvoWrapped)return false;
    const wrapped=async function(){
      const args=[...arguments],model=args[modelIndex];
      if(isEvoModel(model)){
        const result=await generateEvoLinkVideo(model,args[0]||"",{aspect_ratio:args[3]||"16:9",duration:args[4],image_urls:args[5]||[],video_urls:args[6]||[],audio_urls:args[7]||[]});
        return {url:result.url};
      }
      return original.apply(this,args);
    };
    wrapped.__kosmicEvoWrapped=true;wrapped.__kosmicOriginal=original;window[name]=wrapped;return true;
  }
  const installWrappers=()=>wrapGlobal("genViaSeedanceReference",1)||wrapGlobal("genViaFal",2);
  installWrappers();
  let wrapperTries=0;const wrapperTimer=setInterval(()=>{if(installWrappers()||++wrapperTries>80)clearInterval(wrapperTimer);},50);

  function addUrlRow(containerId,field,label){
    const box=document.getElementById(containerId);if(!box)return;
    const row=document.createElement("div");row.className="evo-url-row";
    row.innerHTML=`<input class="f-input evo-url" data-field="${esc(field)}" placeholder="${esc(label)} URL" style="flex:1"><button type="button" class="btn btn-ghost btn-sm evo-remove-url">×</button>`;
    row.querySelector(".evo-remove-url").onclick=()=>row.remove();box.appendChild(row);
  }
  function selectedUrls(containerId,field){return [...document.querySelectorAll(`#${containerId} .evo-url[data-field="${field}"]`)].map(x=>x.value.trim()).filter(Boolean);}
  function renderSchemaControls(route){
    const s=route.model.schema||{},duration=s.duration,qualities=s.quality||[],aspects=s.aspect||[],mode=route.mode;
    return `
      <div class="evo-field-grid">
        <label class="f-group"><span class="f-label">Aspect Ratio</span>${aspects.length?`<select id="evoPgAspect" class="f-select">${aspects.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("")}</select>`:`<div class="evo-static-field">Provider controlled</div>`}</label>
        <label class="f-group"><span class="f-label">Duration</span>${duration?`<select id="evoPgDuration" class="f-select">${duration[0]===duration[1]?`<option value="${duration[0]}">${duration[0]}s</option>`:`<option value="auto">Auto</option>${Array.from({length:Math.max(0,Math.min(30,duration[1])-duration[0]+1)},(_,i)=>duration[0]+i).map(v=>`<option value="${v}">${v}s</option>`).join("")}`}</select>`:`<div class="evo-static-field">Provider controlled</div>`}</label>
        <label class="f-group"><span class="f-label">Quality</span>${qualities.length?`<select id="evoPgQuality" class="f-select">${qualities.map(q=>`<option value="${esc(q)}">${esc(q)}</option>`).join("")}</select>`:`<div class="evo-static-field">Provider default</div>`}</label>
        <label class="f-group"><span class="f-label">Output</span><select id="evoPgFormat" class="f-select"><option value="mp4">MP4</option><option value="mov">MOV</option></select></label>
      </div>
      <div class="evo-toggle-row">${s.audio?`<label><input type="checkbox" id="evoPgAudio" checked> Generate Audio</label>`:""}${s.webSearch?`<label><input type="checkbox" id="evoPgWeb"> Web Search</label>`:""}</div>
      ${mode==="motion"?`<div class="evo-advanced-grid"><label class="f-group"><span class="f-label">Character Orientation</span><select id="evoPgOrientation" class="f-select"><option value="image">Image</option><option value="video">Video</option></select></label><label><input type="checkbox" id="evoPgKeepSound" checked> Keep source sound</label></div>`:""}
      ${mode==="upscale"?`<label class="f-group"><span class="f-label">Upscale Factor</span><select id="evoPgUpscale" class="f-select"><option value="1">1× Enhance</option><option value="2" selected>2×</option><option value="4">4×</option></select></label>`:""}
      ${mode==="avatar"?`<div class="evo-advanced-grid"><label><input type="checkbox" id="evoPgAutoMask" checked> Auto Mask</label><label><input type="checkbox" id="evoPgSubjectCheck"> Subject Check</label><label class="f-group"><span class="f-label">Audio URL</span><input class="f-input" id="evoPgAudioUrl" placeholder="https://…/voice.mp3"></label></div>`:""}
      <div class="evo-ref-grid">
        ${mode!=="text"?`<div class="evo-ref-block"><div class="evo-ref-title">${mode==="avatar"?"Person Image":"Image References"}</div><div id="evoPgImages"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgImages','image_urls','Image')">+ Image URL</button></div>`:""}
        ${["reference","edit","extend","motion","upscale","first_last"].includes(mode)?`<div class="evo-ref-block"><div class="evo-ref-title">Video Input</div><div id="evoPgVideos"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgVideos','video_urls','Video')">+ Video URL</button></div>`:""}
        ${["reference"].includes(mode)&&s.refs?.audios?`<div class="evo-ref-block"><div class="evo-ref-title">Audio References</div><div id="evoPgAudios"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgAudios','audio_urls','Audio')">+ Audio URL</button></div>`:""}
      </div>`;
  }
  async function submitPlayground(){
    const model=document.getElementById("evoPgModel")?.value,route=INDEX[model],resultEl=document.getElementById("evoPgResult"),btn=document.getElementById("evoPgGenerate");
    if(!route)return;if(btn){btn.disabled=true;btn.textContent="Generating…";}
    resultEl.innerHTML='<div class="evo-status">Submitting EvoLink task…</div>';
    try{
      const opts={aspect_ratio:document.getElementById("evoPgAspect")?.value,duration:document.getElementById("evoPgDuration")?.value,quality:document.getElementById("evoPgQuality")?.value,output_format:document.getElementById("evoPgFormat")?.value,generate_audio:document.getElementById("evoPgAudio")?.checked,web_search:document.getElementById("evoPgWeb")?.checked,image_urls:selectedUrls("evoPgImages","image_urls"),video_urls:selectedUrls("evoPgVideos","video_urls"),audio_urls:selectedUrls("evoPgAudios","audio_urls"),audio_url:document.getElementById("evoPgAudioUrl")?.value.trim(),model_params:{}};
      if(document.getElementById("evoPgUpscale"))opts.model_params.upscale_factor=document.getElementById("evoPgUpscale").value;
      if(document.getElementById("evoPgOrientation"))opts.model_params.character_orientation=document.getElementById("evoPgOrientation").value;
      if(document.getElementById("evoPgAutoMask"))opts.model_params.auto_mask=document.getElementById("evoPgAutoMask").checked;
      if(document.getElementById("evoPgSubjectCheck"))opts.model_params.subject_check=document.getElementById("evoPgSubjectCheck").checked;
      if(document.getElementById("evoPgKeepSound"))opts.model_params.keep_sound=document.getElementById("evoPgKeepSound").checked;
      const result=await generateEvoLinkVideo(model,document.getElementById("evoPgPrompt")?.value.trim()||"",opts);
      resultEl.innerHTML=`<video src="${esc(result.url)}" controls playsinline style="width:100%;max-height:420px;border-radius:16px;object-fit:contain;background:#0b0714"></video><div class="evo-result-meta">${esc(route.model.name)} · ${esc(route.label)} · task ${esc(result.taskId)}</div>`;
      try{if(typeof createVideoAsset==="function")createVideoAsset(result.url,document.getElementById("evoPgPrompt")?.value.trim()||"","",{model,providerLabel:"EvoLink"});}catch(_e){}
    }catch(err){resultEl.innerHTML=`<div class="evo-error">${esc(err.message||String(err))}</div>`;}
    finally{if(btn){btn.disabled=false;btn.textContent="Generate →";}}
  }
  function openPlayground(){
    document.getElementById("evoVideoPlaygroundModal")?.remove();
    const modal=document.createElement("div");modal.id="evoVideoPlaygroundModal";
    modal.innerHTML=`<div class="evo-playground-backdrop" onclick="window.__evoClosePlayground()"></div><div class="evo-playground-sheet"><div class="evo-playground-head"><div><div class="evo-kicker">EVOLINK VIDEO</div><div class="evo-title">Unified Video Playground</div><div class="evo-subtitle">All 29 live EvoLink video model cards, with route-aware playground controls.</div></div><button class="btn btn-ghost btn-sm" onclick="window.__evoClosePlayground()">✕</button></div><form id="evoPlaygroundForm"><div class="evo-field-grid"><label class="f-group"><span class="f-label">Model / Route</span><select id="evoPgModel" class="f-select"></select></label><label class="f-group"><span class="f-label">Route schema</span><select id="evoPgRoute" class="f-select"></select></label></div><div id="evoPgControls"></div><label class="f-group"><span class="f-label">Prompt</span><textarea id="evoPgPrompt" class="f-input" rows="4" placeholder="Describe the shot, motion, camera, environment and subject behavior…"></textarea></label><div class="evo-actions"><button id="evoPgGenerate" type="button" class="btn btn-primary">Generate →</button><div class="evo-api-note">Uses your existing <b>api_evolink</b> setting. API keys stay browser-local.</div></div></form><div id="evoPgResult" class="evo-result">Choose a model to inspect its schema.</div></div>`;
    document.body.appendChild(modal);
    const modelSel=modal.querySelector("#evoPgModel"),routeSel=modal.querySelector("#evoPgRoute"),groups={};
    CATALOG.forEach(m=>(groups[m.group]||(groups[m.group]=[])).push(m));
    Object.entries(groups).forEach(([g,models])=>{const og=document.createElement("optgroup");og.label=g;models.forEach(m=>m.routes.forEach(r=>{const op=document.createElement("option");op.value=r.id;op.textContent=`${m.name} · ${r.label}`;og.appendChild(op);}));modelSel.appendChild(og);});
    function refresh(){const route=INDEX[modelSel.value];if(!route)return;routeSel.innerHTML=route.model.routes.map(r=>`<option value="${esc(r.id)}" ${r.id===modelSel.value?"selected":""}>${esc(r.label)}</option>`).join("");modal.querySelector("#evoPgControls").innerHTML=renderSchemaControls(route);}
    modelSel.onchange=refresh;routeSel.onchange=()=>{modelSel.value=routeSel.value;refresh();};refresh();
    modal.querySelector("#evoPgGenerate").onclick=submitPlayground;
  }
  window.__evoAddUrl=addUrlRow;window.__evoOpenPlayground=openPlayground;window.__evoClosePlayground=()=>document.getElementById("evoVideoPlaygroundModal")?.remove();

  function enhanceVideoUI(){
    document.querySelectorAll("select").forEach(sel=>{
      if(sel.dataset.evoEnhanced||sel.id==="evoPgModel"||sel.id==="evoPgRoute")return;
      const hasVideoOption=[...sel.options].some(o=>/seedance|kling|veo|sora|hailuo|wan|grok imagine/i.test((o.textContent||o.value||"")));
      if(!hasVideoOption)return;
      let og=sel.querySelector('optgroup[data-evo-video="1"]');
      if(!og){og=document.createElement("optgroup");og.label="EvoLink Video — 29 live model cards";og.dataset.evoVideo="1";sel.appendChild(og);}
      const existing=new Set([...og.options].map(o=>o.value));CATALOG.forEach(m=>m.routes.forEach(r=>{if(existing.has(r.id))return;const op=document.createElement("option");op.value=r.id;op.textContent=`${m.name} · ${r.label} · EvoLink`;og.appendChild(op);}));
      sel.dataset.evoEnhanced="1";
    });
    if(!document.getElementById("evoVideoPlaygroundLaunch")){
      const host=document.querySelector("#moduleContent");
      if(host){const text=(host.textContent||"").toLowerCase();if(text.includes("video model")||text.includes("video canvas")||text.includes("video studio")){const b=document.createElement("button");b.id="evoVideoPlaygroundLaunch";b.className="btn btn-outline btn-sm";b.type="button";b.textContent="◎ EvoLink Playground";b.onclick=openPlayground;(host.querySelector(".panel-title")?.parentElement||host.firstElementChild||host).appendChild(b);}}
    }
  }
  [0,250,800,1600,3000].forEach(ms=>setTimeout(enhanceVideoUI,ms));
  window.__kosmicEvoLinkEnhance=enhanceVideoUI;
})();

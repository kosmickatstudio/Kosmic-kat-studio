/* KOSMIC KAT — Seedance 2.5 functional bridge
 * Seedance 2.5 ONLY. Replaces the last-mile Fal dependency for local references,
 * validates route-specific inputs, and keeps the existing Video Canvas send path.
 * API-key storage/auth for every other module is untouched.
 */
(function installSeedance25FunctionalBridge(){
  "use strict";
  if(window.__kosmicSeedance25FunctionalBridge)return;
  window.__kosmicSeedance25FunctionalBridge=true;

  const IDS=new Set([
    "seedance-2.5-text-to-video","seedance-2.5-image-to-video",
    "seedance-2.5-reference-to-video","seedance-2.5-video-edit",
    "seedance-2.5-video-extend"
  ]);
  const $=id=>document.getElementById(id);
  const state=()=>window.__kosmicSeedance25ParityState||(window.__kosmicSeedance25ParityState={route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",audio:true,content:true,webSearch:false,refs:{images:0,videos:0,audios:0}});
  const currentModel=()=>$("vcModel")?.value||"";
  const routeInfo=()=>window.KOSMIC_EVOLINK_VIDEO?.index?.[currentModel()]||null;
  const isSeed25=()=>IDS.has(currentModel());

  const sourceOf=x=>typeof x==="string"?x:(x?.dataUrl||x?.url||"");
  const refs=()=>{
    const s=window.S||{};
    const pick=v=>(Array.isArray(v)?v:[]).map(sourceOf).filter(Boolean);
    return {images:pick(s.vcMultiImages),videos:pick(s.vcMultiVideos),audios:pick(s.vcMultiAudios)};
  };

  async function evoUpload(url,index){
    if(/^https?:\/\//i.test(url))return url;
    if(!/^data:/i.test(url))throw new Error("Seedance 2.5 reference #"+(index+1)+" is not a hosted URL or data URI.");
    const key=String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    if(!key)throw new Error("Add an EvoLink API key in Settings first.");
    const response=await fetch(url);
    if(!response.ok)throw new Error("Could not read Seedance 2.5 reference #"+(index+1)+".");
    const blob=await response.blob();
    const form=new FormData();
    const ext=(blob.type.split("/")[1]||"bin").replace(/[^a-z0-9+.-]/gi,"");
    form.append("file",blob,"seedance25-ref-"+index+"."+ext);
    const upload=await fetch("https://files-api.evolink.ai/api/v1/files/upload/stream",{method:"POST",headers:{Authorization:"Bearer "+key},body:form});
    const data=await upload.json().catch(()=>({}));
    if(!upload.ok)throw new Error(data?.error?.message||data?.message||("EvoLink file upload failed (HTTP "+upload.status+")"));
    const fileUrl=data?.file_url||data?.url||data?.data?.file_url||data?.data?.url;
    if(!/^https?:\/\//i.test(String(fileUrl||"")))throw new Error("EvoLink file upload did not return a public file_url.");
    return fileUrl;
  }

  const uploadCache=new Map();
  async function hostList(list,offset){
    const out=[];
    for(let i=0;i<list.length;i++){
      const raw=list[i];
      if(uploadCache.has(raw)){out.push(uploadCache.get(raw));continue;}
      const hosted=await evoUpload(raw,offset+i);
      uploadCache.set(raw,hosted);out.push(hosted);
    }
    return out;
  }

  async function resolveSeed25Refs(mode){
    const r=refs();
    if(mode==="text")return{images:[],videos:[],audios:[]};
    if(mode==="image")return{images:await hostList(r.images.slice(0,2),0),videos:[],audios:[]};
    if(mode==="edit"||mode==="extend")return{images:[],videos:await hostList(r.videos.slice(0,1),0),audios:[]};
    return{
      images:await hostList(r.images.slice(0,30),0),
      videos:await hostList(r.videos.slice(0,10),30),
      audios:await hostList(r.audios.slice(0,10),40)
    };
  }

  function validate(mode){
    const r=refs();
    if(mode==="image"){
      if(!r.images.length)throw new Error("Image to Video needs 1 image, or 2 images for first + last frame.");
      if(r.images.length>2)throw new Error("Image to Video accepts at most 2 images for Seedance 2.5.");
    }
    if(mode==="edit"||mode==="extend"){
      if(!r.videos.length)throw new Error((mode==="edit"?"Video Edit":"Video Extend")+" needs a source video in the Video Canvas reference tray.");
      if(r.videos.length>1)throw new Error((mode==="edit"?"Video Edit":"Video Extend")+" accepts one source video for Seedance 2.5.");
    }
    if(mode==="reference"){
      if(r.images.length>30)throw new Error("Seedance 2.5 Reference to Video accepts at most 30 images.");
      if(r.videos.length>10)throw new Error("Seedance 2.5 Reference to Video accepts at most 10 videos.");
      if(r.audios.length>10)throw new Error("Seedance 2.5 Reference to Video accepts at most 10 audio tracks.");
      if(r.images.length+r.videos.length+r.audios.length>50)throw new Error("Seedance 2.5 allows at most 50 reference assets total.");
      if(!r.images.length&&!r.videos.length&&!r.audios.length)throw new Error("Reference to Video needs at least one image, video, or audio reference.");
    }
  }

  function readValue(ids){
    for(const id of ids){
      const el=$(id);
      if(el&&el.value!==undefined&&el.value!=="")return el.value;
    }
    return "";
  }
  function readChecked(ids,fallback){
    for(const id of ids){
      const el=$(id);
      if(el)return !!el.checked;
    }
    return fallback;
  }
  function readActiveAspect(){
    const buttons=[...document.querySelectorAll("#evoSeedanceSchemaPanel [data-evo25-aspect]")];
    const active=buttons.find(b=>b.classList.contains("active"))?.getAttribute("data-evo25-aspect");
    if(active)return active;
    const select=$("evoSeedanceAspect");
    if(select?.value)return select.value;
    return "";
  }

  function readControls(){
    const s=state();
    const route=currentModel()||s.route||"seedance-2.5-text-to-video";
    let duration=Number(readValue(["evo25DurationNumber","evoSeedanceDuration","vcDuration"])||s.duration||5);
    if(!Number.isFinite(duration))duration=5;
    duration=Math.max(4,Math.min(30,Math.round(duration)));
    const qualityValue=readValue(["evo25Quality","evoSeedanceQuality","vcRes"]);
    const quality=["480p","720p","1080p"].includes(qualityValue)?qualityValue:(s.quality||"720p");
    const activeAspect=readActiveAspect()||readValue(["evoSeedanceAspect","vcRatio"]);
    const aspect=(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")?"adaptive":(activeAspect||s.aspect||"16:9");
    const audio=readChecked(["evo25Audio","evoSeedanceAudio"],s.audio!==false);
    const content=readChecked(["evo25Content","evoSeedanceContentFilter"],s.content!==false);
    const webSearch=readChecked(["evo25WebSearch","evoSeedanceWebSearch"],!!s.webSearch);
    Object.assign(s,{route,duration,quality,aspect,audio,content,webSearch});
    return s;
  }

  function syncNative(s){
    if($("vcDuration"))$("vcDuration").value=String(s.duration);
    if($("vcRes"))$("vcRes").value=s.quality;
    if($("vcRatio"))$("vcRatio").value=s.aspect;
    if($("evoSeedanceDuration"))$("evoSeedanceDuration").value=String(s.duration);
    if($("evoSeedanceQuality"))$("evoSeedanceQuality").value=s.quality;
    if($("evoSeedanceAspect"))$("evoSeedanceAspect").value=s.aspect;
    if($("evo25DurationNumber"))$("evo25DurationNumber").value=String(s.duration);
    if($("evo25DurationRange"))$("evo25DurationRange").value=String(s.duration);
    if($("evo25Quality"))$("evo25Quality").value=s.quality;
    ["evo25Audio","evoSeedanceAudio"].forEach(id=>{const el=$(id);if(el)el.checked=s.audio;});
    ["evo25Content","evoSeedanceContentFilter"].forEach(id=>{const el=$(id);if(el)el.checked=s.content;});
    ["evo25WebSearch","evoSeedanceWebSearch"].forEach(id=>{const el=$(id);if(el)el.checked=s.webSearch;});
  }

  function cleanFalWarnings(){
    const panel=$("vcSettingsPanel");
    if(!panel)return;
    const active=isSeed25();
    panel.querySelectorAll("*").forEach(el=>{
      if(el.children.length>2)return;
      const text=(el.textContent||"").trim();
      if(!text)return;
      if(active&&/add a fal\.ai api key in settings first/i.test(text)){
        el.hidden=true;el.setAttribute("aria-hidden","true");
      }else if(active&&/(fal\.ai|fal-ai).*(seedance\s*2\.5|video playground)|seedance\s*2\.5.*(fal\.ai|fal-ai)/i.test(text)){
        el.hidden=true;el.setAttribute("aria-hidden","true");
      }
    });
    if(active){
      let note=panel.querySelector(".evo25-settings-note");
      if(!note){
        note=document.createElement("div");note.className="evo25-settings-note";
        note.style.cssText="margin:8px 0;padding:9px 10px;border-radius:10px;background:rgba(118,82,200,.08);border:1px solid rgba(118,82,200,.12);font-size:10px;font-weight:800;color:var(--textm,#625970)";
        note.textContent="Seedance 2.5 uses the EvoLink API key. Fal.ai is not required for this model.";
        panel.prepend(note);
      }
    }
  }

  async function generateSeed25(){
    const route=routeInfo();
    if(!route||!isSeed25())return false;
    const input=$("vcChatInput"),prompt=input?.value.trim();
    if(!prompt){toast("Type a prompt first","error");return true;}
    const key=String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    if(!key){toast("Add an EvoLink API key in Settings first","error");return true;}
    const s=readControls(),mode=String(route.mode||"text");
    try{validate(mode);}catch(err){toast("❌ "+err.message,"error");return true;}
    const send=$("vcSendBtn");if(send)send.dataset.vcSending="1";
    const loadingId="vcLoading_seed25_"+Date.now();
    pushVcChatMessage({id:loadingId,role:"assistant",type:"loading",content:`Generating with Seedance 2.5 · ${route.label||mode}…`});
    try{
      const media=await resolveSeed25Refs(mode);
      const opts={
        aspect_ratio:s.aspect,duration:s.duration,quality:s.quality,
        generate_audio:s.audio,content_filter:s.content,
        model_params:mode==="text"?{web_search:!!s.webSearch}: {},
        image_urls:media.images,video_urls:media.videos,audio_urls:media.audios
      };
      const result=await window.generateEvoLinkVideo(currentModel(),prompt,opts);
      const asset=typeof createVideoAsset==="function"?createVideoAsset(result.url,prompt,"",{model:currentModel(),providerLabel:"EvoLink · Seedance 2.5",aspectRatio:opts.aspect_ratio}):null;
      replaceVcLoadingBubble(loadingId,{id:loadingId,role:"assistant",type:"video",content:result.url,meta:{providerLabel:"EvoLink · Seedance 2.5",prompt,assetId:asset?.id,model:currentModel(),resolution:opts.quality}});
      if(typeof logCost==="function")logCost(currentModel(),prompt.slice(0,60));
      toast("✨ Seedance 2.5 video ready!","success");
      if(input){input.value="";if(typeof renderVcChatHighlight==="function")renderVcChatHighlight();}
    }catch(err){
      replaceVcLoadingBubble(loadingId,{role:"assistant",type:"error",content:err.message||String(err)});
      toast("❌ "+(err.message||String(err)),"error");
    }finally{
      if(send){delete send.dataset.vcSending;send.disabled=!String(typeof gs==="function"?gs("api_evolink",""):"").trim();}
      cleanFalWarnings();
    }
    return true;
  }

  function wireSend(){
    const fn=window.sendVcChatPrompt;if(typeof fn!=="function")return false;
    if(fn.__kosmicSeed25FinalWrapped)return true;
    const wrapped=async function(){
      if(isSeed25())return generateSeed25();
      return fn.apply(this,arguments);
    };
    wrapped.__kosmicSeed25FinalWrapped=true;
    wrapped.__kosmicSeed25Original=fn;
    window.sendVcChatPrompt=wrapped;
    return true;
  }

  function apply(){
    if(!isSeed25()){cleanFalWarnings();return;}
    const s=readControls();syncNative(s);cleanFalWarnings();
  }

  function boot(){
    if(!$("vcModel")||!window.KOSMIC_EVOLINK_VIDEO?.index)return false;
    wireSend();apply();
    const sel=$("vcModel");
    if(!sel.dataset.seed25FunctionalChangeBound){
      sel.addEventListener("change",()=>setTimeout(apply,0));
      sel.dataset.seed25FunctionalChangeBound="1";
    }
    return true;
  }

  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>200)clearInterval(timer);},75);
  }
  setInterval(()=>{if($("vcModel")){wireSend();apply();}},1200);
})();

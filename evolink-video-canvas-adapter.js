/* KOSMIC KAT — EvoLink Video Canvas adapter
 * Reuses the EXISTING Video Canvas playground instead of creating another UI.
 * Seedance 2.5 is intentionally excluded from this generic adapter: its
 * dedicated Seedance 2.5 bridge owns its controls, EvoLink file uploads and
 * request construction. This prevents the legacy Fal reference hoster from
 * ever handling Seedance 2.5 assets.
 */
(function installEvoLinkVideoCanvasAdapter(){
  "use strict";
  if(window.__kosmicEvoVideoCanvasAdapter)return;
  window.__kosmicEvoVideoCanvasAdapter=true;

  const specialized=new Set(["topaz-video-upscale","kling-v3-motion-control","omnihuman-1.5"]);
  const seedance25=id=>/^seedance-2\.5-/i.test(String(id||""));
  const routeIds=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;if(!api?.catalog)return [];
    const out=[];
    for(const card of api.catalog)for(const route of card.routes||[])if(!specialized.has(route.id))out.push({card,route});
    return out;
  };

  function installMaps(){
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.index||typeof VIDEO_MODEL_GROUPS==="undefined")return false;
    const wanted=routeIds(),seen=new Set(wanted.map(x=>x.route.id));
    for(let i=VIDEO_MODEL_GROUPS.length-1;i>=0;i--){
      const g=VIDEO_MODEL_GROUPS[i];if(!g?.items)continue;
      g.items=g.items.filter(item=>{const v=String(item?.value||"");return !(v.startsWith("fal-ai/")||v.startsWith("bytedance/"));});
      if(!g.items.length)VIDEO_MODEL_GROUPS.splice(i,1);
    }
    const grouped={};wanted.forEach(({card,route})=>{if(!grouped[card.group])grouped[card.group]=[];grouped[card.group].push({value:route.id,name:`${card.name} · ${route.label||route.mode}`,sub:`${card.provider} · EvoLink`});});
    const evoGroups=Object.entries(grouped).map(([group,items])=>({label:`EvoLink · ${group}`,items}));
    VIDEO_MODEL_GROUPS.filter(g=>String(g.label||"").startsWith("EvoLink · ")).forEach(g=>{const i=VIDEO_MODEL_GROUPS.indexOf(g);if(i>=0)VIDEO_MODEL_GROUPS.splice(i,1);});
    VIDEO_MODEL_GROUPS.unshift(...evoGroups);
    for(const {card,route} of wanted){
      const schema=card.schema||{};
      if(typeof VIDEO_MODEL_DURATIONS!=="undefined"&&schema.duration){const lo=Number(schema.duration[0]),hi=Number(schema.duration[1]);if(Number.isFinite(lo)&&Number.isFinite(hi)&&lo<=hi){const options=[];for(let n=lo;n<=Math.min(60,hi);n++)options.push(n);VIDEO_MODEL_DURATIONS[route.id]={options,format:v=>Number(v)};}}
      if(typeof VIDEO_MODEL_RESOLUTIONS!=="undefined"&&Array.isArray(schema.quality)&&schema.quality.length)VIDEO_MODEL_RESOLUTIONS[route.id]=schema.quality.map(v=>String(v).toLowerCase());
      if(typeof VIDEO_MODEL_CAPABILITIES!=="undefined"){const refs=schema.refs||{};const cap=Object.assign({},VIDEO_MODEL_CAPABILITIES[route.id]||{},{provider:"evolink",evolink:true,route:route.id,mode:route.mode,schema,maxImages:refs.images||0,maxVideos:refs.videos||0,maxAudios:refs.audios||0,multiImage:route.mode!=="text"&&route.mode!=="edit"&&route.mode!=="extend",multiRef:route.mode==="reference"});if(route.mode==="edit"||route.mode==="extend")cap.maxVideos=refs.videos||1;VIDEO_MODEL_CAPABILITIES[route.id]=cap;}
    }
    const current=gs("default_video_model","");if(!seen.has(current))saveSetting("default_video_model","seedance-2.5-text-to-video");
    return true;
  }

  let lastModel="";
  function syncCanvasUi(){
    const sel=document.getElementById("vcModel");if(!sel)return;
    const current=sel.value,html=modelOptionsHTML("video",null,seenLive(current)?current:"seedance-2.5-text-to-video");
    if(html&&sel.innerHTML!==html)sel.innerHTML=html;
    const model=sel.value;if(model!==lastModel){lastModel=model;if(typeof updateVcModelUI==="function")updateVcModelUI();}
    const hasEvo=seenLive(model);if(!hasEvo)return;
    const input=document.getElementById("vcChatInput"),send=document.getElementById("vcSendBtn"),evoKey=String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    if(input){input.disabled=!evoKey;input.placeholder=evoKey?"Describe the video you want…":"Add an EvoLink API key in Settings first…";}
    if(send&&!send.dataset.vcSending)send.disabled=!evoKey;
  }
  function seenLive(id){return !!window.KOSMIC_EVOLINK_VIDEO?.index?.[id]&&!specialized.has(id)&&!seedance25(id);}
  function state(){return typeof S!=="undefined"?S:(window.S||{});}
  function extractHosted(list){return(list||[]).map(x=>typeof x==="string"?x:x?.dataUrl||x?.url||"").filter(Boolean);}
  async function resolveRefsForEvoLink(){
    const s=state(),images=extractHosted(s.vcMultiImages),videos=extractHosted(s.vcMultiVideos),audios=extractHosted(s.vcMultiAudios),all=[...images,...videos,...audios];
    if(!all.length)return{images:[],videos:[],audios:[]};
    if(all.every(u=>/^https?:\/\//i.test(u)))return{images,videos,audios};
    if(typeof uploadRefsToFal!=="function")throw new Error("This EvoLink route needs hosted reference URLs; the existing Video Canvas reference hoster is unavailable.");
    const falKey=String(typeof gs==="function"?gs("api_falai",""):"").trim();if(!falKey)throw new Error("Reference uploads need a hosted URL. Add the existing fal.ai storage key in Settings or use hosted reference URLs.");
    const hosted=await uploadRefsToFal(all.map(u=>({dataUrl:u,name:""})),falKey),ni=images.length,nv=videos.length;
    return{images:hosted.slice(0,ni),videos:hosted.slice(ni,ni+nv),audios:hosted.slice(ni+nv)};
  }
  async function generateFromExistingCanvas(){
    const model=document.getElementById("vcModel")?.value;if(seedance25(model))return false;
    const route=window.KOSMIC_EVOLINK_VIDEO?.index?.[model];if(!route)return false;
    const input=document.getElementById("vcChatInput"),prompt=input?.value.trim();if(!prompt){toast("Type a prompt first","error");return true;}
    const ratio=document.getElementById("vcRatio")?.value,duration=document.getElementById("vcDuration")?.value,quality=document.getElementById("vcRes")?.value,cap=VIDEO_MODEL_CAPABILITIES[model]||{},send=document.getElementById("vcSendBtn");
    if(send)send.dataset.vcSending="1";const loadingId="vcLoading_"+Date.now();pushVcChatMessage({id:loadingId,role:"assistant",type:"loading",content:`Generating with ${route.model.name} · ${route.label||route.mode}…`});
    try{if(!String(typeof gs==="function"?gs("api_evolink",""):"").trim())throw new Error("Add an EvoLink API key in Settings first");const refs=await resolveRefsForEvoLink();let opts={aspect_ratio:ratio,duration,quality,generate_audio:!!cap.schema?.audio,image_urls:refs.images,video_urls:refs.videos,audio_urls:refs.audios,model_params:{}};if(typeof window.__kosmicSeedanceBuildRequest==="function")opts=window.__kosmicSeedanceBuildRequest(opts);const result=await window.generateEvoLinkVideo(model,prompt,opts);const asset=typeof createVideoAsset==="function"?createVideoAsset(result.url,prompt,"",{model,providerLabel:"EvoLink",aspectRatio:opts.aspect_ratio}):null;replaceVcLoadingBubble(loadingId,{id:loadingId,role:"assistant",type:"video",content:result.url,meta:{providerLabel:`EvoLink · ${route.model.name}`,prompt,assetId:asset?.id,model,resolution:opts.quality||""}});if(typeof logCost==="function")logCost(model,prompt.slice(0,60));toast(`✨ ${route.model.name} video ready!`,"success");if(input){input.value="";if(typeof renderVcChatHighlight==="function")renderVcChatHighlight();}}
    catch(err){replaceVcLoadingBubble(loadingId,{role:"assistant",type:"error",content:err.message||String(err)});toast("❌ "+(err.message||String(err)),"error");}
    finally{if(send){delete send.dataset.vcSending;send.disabled=!String(typeof gs==="function"?gs("api_evolink",""):"").trim();}}
    return true;
  }
  function wrapSend(){const fn=window.sendVcChatPrompt;if(typeof fn!=="function")return false;if(fn.__kosmicEvoCanvasWrapped)return true;const wrapper=async function(){const model=document.getElementById("vcModel")?.value;if(seenLive(model))return generateFromExistingCanvas();return fn.apply(this,arguments);};wrapper.__kosmicEvoCanvasWrapped=true;wrapper.__kosmicEvoOriginal=fn;window.sendVcChatPrompt=wrapper;return true;}
  function boot(){if(!window.KOSMIC_EVOLINK_VIDEO?.index||typeof VIDEO_MODEL_GROUPS==="undefined")return false;installMaps();syncCanvasUi();return wrapSend();}
  if(!boot()){let tries=0;const timer=setInterval(()=>{if(boot()||++tries>160)clearInterval(timer);},50);}setInterval(()=>{if(document.getElementById("vcModel")){syncCanvasUi();wrapSend();}},800);
})();

/* KOSMIC KAT — EvoLink Video Canvas adapter
 * Reuses the EXISTING Video Canvas playground instead of creating another UI.
 * Replaces legacy Fal video picker entries with the live EvoLink route catalog,
 * feeds the existing duration/resolution/reference controls from EvoLink schema,
 * and routes the existing Video Canvas Send action through generateEvoLinkVideo.
 */
(function installEvoLinkVideoCanvasAdapter(){
  "use strict";
  if(window.__kosmicEvoVideoCanvasAdapter)return;
  window.__kosmicEvoVideoCanvasAdapter=true;

  const routeIds=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog)return [];
    const out=[];
    for(const card of api.catalog){
      for(const route of card.routes||[])out.push({card,route});
    }
    return out;
  };

  function installMaps(){
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.index||typeof VIDEO_MODEL_GROUPS==="undefined")return false;

    const wanted=routeIds();
    const seen=new Set();
    wanted.forEach(({route})=>seen.add(route.id));

    // Remove the old Fal/legacy ByteDance video entries from the EXISTING
    // picker data source. Other non-Fal providers already present in the app
    // remain untouched.
    for(let i=VIDEO_MODEL_GROUPS.length-1;i>=0;i--){
      const g=VIDEO_MODEL_GROUPS[i];
      if(!g?.items)continue;
      g.items=g.items.filter(item=>{
        const v=String(item?.value||"");
        return !(v.startsWith("fal-ai/")||v.startsWith("bytedance/"));
      });
      if(!g.items.length)VIDEO_MODEL_GROUPS.splice(i,1);
    }

    // Rebuild one familiar picker source for EvoLink. Routes are entries in
    // the same old Video model picker, so there is no second playground.
    const grouped={};
    wanted.forEach(({card,route})=>{
      if(!grouped[card.group])grouped[card.group]=[];
      grouped[card.group].push({
        value:route.id,
        name:`${card.name} · ${route.label||route.mode}`,
        sub:`${card.provider} · EvoLink`
      });
    });

    const evoGroups=Object.entries(grouped).map(([group,items])=>({
      label:`EvoLink · ${group}`,
      items
    }));
    VIDEO_MODEL_GROUPS.unshift(...evoGroups);

    // Existing Video Canvas controls consume these maps directly.
    for(const {card,route} of wanted){
      const schema=card.schema||{};
      if(typeof VIDEO_MODEL_DURATIONS!=="undefined"&&schema.duration){
        const lo=Number(schema.duration[0]),hi=Number(schema.duration[1]);
        let options=[];
        if(Number.isFinite(lo)&&Number.isFinite(hi)&&lo<=hi){
          const max=Math.min(60,hi);
          for(let n=lo;n<=max;n++)options.push(n);
        }
        if(options.length)VIDEO_MODEL_DURATIONS[route.id]={options,format:v=>Number(v)};
      }
      if(typeof VIDEO_MODEL_RESOLUTIONS!=="undefined"&&Array.isArray(schema.quality)&&schema.quality.length){
        VIDEO_MODEL_RESOLUTIONS[route.id]=schema.quality.map(v=>String(v).toLowerCase());
      }
      if(typeof VIDEO_MODEL_CAPABILITIES!=="undefined"){
        const prev=VIDEO_MODEL_CAPABILITIES[route.id]||{};
        const refs=schema.refs||{};
        const cap=Object.assign({},prev,{
          provider:"evolink",
          evolink:true,
          route:route.id,
          mode:route.mode,
          maxImages:refs.images||prev.maxImages||0,
          maxVideos:refs.videos||prev.maxVideos||0,
          maxAudios:refs.audios||prev.maxAudios||0,
          multiImage:!!(refs.images&&refs.images>0)||route.mode!=="text",
          schema
        });
        if(route.mode==="reference")cap.multiRef=true;
        if(route.mode==="edit"||route.mode==="extend")cap.maxVideos=refs.videos||1;
        if(route.mode==="text")cap.multiImage=false;
        VIDEO_MODEL_CAPABILITIES[route.id]=cap;
      }
    }

    const current=gs("default_video_model","");
    if(!seen.has(current))saveSetting("default_video_model","seedance-2.5-text-to-video");
    return true;
  }

  function syncCanvasUi(){
    const sel=document.getElementById("vcModel");
    if(!sel)return;
    const old=sel.value;
    const html=modelOptionsHTML("video",null,seenLive(old)?old:"seedance-2.5-text-to-video");
    if(html&&sel.innerHTML!==html)sel.innerHTML=html;
    const hasEvo=!!window.KOSMIC_EVOLINK_VIDEO?.index?.[sel.value];
    const input=document.getElementById("vcChatInput");
    const send=document.getElementById("vcSendBtn");
    const evoKey=String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    if(hasEvo){
      if(input){input.disabled=!evoKey;input.placeholder=evoKey?"Describe the video you want…":"Add an EvoLink API key in Settings first…";}
      if(send)send.disabled=!evoKey;
      const note=document.getElementById("vcModelNote");
      if(note&&!note.textContent)note.textContent="Powered by EvoLink · route-specific schema loaded in the existing Video Canvas controls.";
    }
    if(typeof updateVcModelUI==="function")updateVcModelUI();
  }

  function seenLive(id){return !!window.KOSMIC_EVOLINK_VIDEO?.index?.[id];}

  function extractHosted(list){
    return (list||[]).map(x=>typeof x==="string"?x:x?.dataUrl||x?.url||"").filter(Boolean);
  }

  async function resolveRefsForEvoLink(){
    const images=extractHosted(window.S?.vcMultiImages),videos=extractHosted(window.S?.vcMultiVideos),audios=extractHosted(window.S?.vcMultiAudios);
    const all=[...images,...videos,...audios];
    if(!all.length)return {images:[],videos:[],audios:[]};
    const directOk=u=>/^https?:\/\//i.test(u);
    if(all.every(directOk))return {images:images.filter(directOk),videos:videos.filter(directOk),audios:audios.filter(directOk)};
    if(typeof uploadRefsToFal!=="function")throw new Error("This reference route needs hosted media URLs. The existing Video Canvas uploader is present, but its reference hoster is unavailable.");
    const key=String(typeof gs==="function"?gs("api_falai",""):"").trim();
    if(!key)throw new Error("Reference files need a hosted URL. Add the existing fal.ai key in Settings so Video Canvas can host uploaded references, or use already-hosted reference URLs.");
    const hosted=await uploadRefsToFal(all.map(u=>({dataUrl:u,name:""})),key);
    const ni=images.length,nv=videos.length;
    return {images:hosted.slice(0,ni),videos:hosted.slice(ni,ni+nv),audios:hosted.slice(ni+nv)};
  }

  async function generateFromExistingCanvas(){
    const sel=document.getElementById("vcModel"),model=sel?.value;
    const api=window.KOSMIC_EVOLINK_VIDEO,route=api?.index?.[model];
    if(!route)return false;
    const input=document.getElementById("vcChatInput"),prompt=input?.value.trim();
    if(!prompt){toast("Type a prompt first","error");return true;}
    const ratio=document.getElementById("vcRatio")?.value;
    const duration=document.getElementById("vcDuration")?.value;
    const quality=document.getElementById("vcRes")?.value;
    const cap=VIDEO_MODEL_CAPABILITIES[model]||{};
    const loadingId="vcLoading_"+Date.now();
    pushVcChatMessage({id:loadingId,role:"assistant",type:"loading",content:`Generating with ${route.model.name} · ${route.label||route.mode}…`});
    const send=document.getElementById("vcSendBtn");if(send)send.disabled=true;
    try{
      const refs=await resolveRefsForEvoLink();
      const opts={aspect_ratio:ratio,duration,quality,generate_audio:!!cap.schema?.audio,image_urls:refs.images,video_urls:refs.videos,audio_urls:refs.audios,model_params:{}};
      if(route.mode==="reference"&&cap.schema?.webSearch)opts.web_search=document.getElementById("vcWebSearch")?.checked;
      const result=await window.generateEvoLinkVideo(model,prompt,opts);
      const asset=typeof createVideoAsset==="function"?createVideoAsset(result.url,prompt,"",{model,providerLabel:"EvoLink",aspectRatio:ratio}):null;
      replaceVcLoadingBubble(loadingId,{id:loadingId,role:"assistant",type:"video",content:result.url,meta:{providerLabel:`EvoLink · ${route.model.name}`,prompt,assetId:asset?.id,model,resolution:quality||""}});
      if(typeof logCost==="function")logCost(model,prompt.slice(0,60));
      toast(`✨ ${route.model.name} video ready!`,"success");
    }catch(err){
      replaceVcLoadingBubble(loadingId,{role:"assistant",type:"error",content:err.message||String(err)});
      toast("❌ "+(err.message||String(err)),"error");
    }finally{
      if(send)send.disabled=!String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    }
    input.value="";
    if(typeof renderVcChatHighlight==="function")renderVcChatHighlight();
    return true;
  }

  function wrapSend(){
    const fn=window.sendVcChatPrompt;
    if(typeof fn!=="function")return false;
    if(fn.__kosmicEvoCanvasWrapped)return true;
    const wrapper=async function(){
      const model=document.getElementById("vcModel")?.value;
      if(seenLive(model))return generateFromExistingCanvas();
      return fn.apply(this,arguments);
    };
    wrapper.__kosmicEvoCanvasWrapped=true;
    wrapper.__kosmicEvoOriginal=fn;
    window.sendVcChatPrompt=wrapper;
    return true;
  }

  function boot(){
    if(!window.KOSMIC_EVOLINK_VIDEO?.index)return false;
    if(typeof VIDEO_MODEL_GROUPS==="undefined")return false;
    installMaps();
    syncCanvasUi();
    return wrapSend();
  }

  if(!boot()){
    let tries=0;
    const timer=setInterval(()=>{
      if(boot()||++tries>160)clearInterval(timer);
    },50);
  }
  setInterval(()=>{
    if(!document.getElementById("vcModel"))return;
    syncCanvasUi();
    wrapSend();
  },500);
})();

/* KOSMIC KAT — EVO LINK FINAL REQUEST GUARD
 * Schema-aware validation for the existing Video Canvas adapter.
 * Never replaces native provider routing or specialized generators.
 */
(function installEvoLinkFinalGuard(){
  "use strict";
  if(window.__kosmicEvoLinkFinalGuard)return;
  window.__kosmicEvoLinkFinalGuard=true;

  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    const original=window.generateEvoLinkVideo;
    if(!api?.index||typeof original!=="function")return false;
    if(original.__kosmicEvoFinalGuard)return true;

    const specialized=new Set(api.specializedRoutes||["topaz-video-upscale","kling-v3-motion-control","omnihuman-1.5"]);
    const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
    const has=v=>arr(v).length>0;
    const allowed=(value,list)=>!Array.isArray(list)||!list.length||list.map(String).includes(String(value));
    const numeric=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};

    const guarded=async function(model,prompt,options={}){
      const route=api.index[model];
      if(!route)throw new Error("Unsupported EvoLink video route: "+model);
      if(specialized.has(model))throw new Error("This route uses a specialized generator and cannot be sent through the generic Video Canvas adapter.");
      if(!String(prompt||"").trim())throw new Error("Enter a video prompt first.");

      const next=Object.assign({},options||{});
      next.image_urls=arr(next.image_urls);
      next.video_urls=arr(next.video_urls);
      next.audio_urls=arr(next.audio_urls);
      const mode=String(route.mode||"").toLowerCase();
      const schema=route.model?.schema||{};
      const refs=schema.refs||{};

      if(mode==="text"){
        next.image_urls=[];next.video_urls=[];next.audio_urls=[];
      }else if(mode==="image"){
        next.video_urls=[];next.audio_urls=[];
        if(!has(next.image_urls))throw new Error("This Image-to-Video route requires at least one image reference.");
      }else if(mode==="reference"){
        if(!has(next.image_urls)&&!has(next.video_urls)&&!has(next.audio_urls))throw new Error("This Reference-to-Video route requires at least one reference asset.");
      }else if(mode==="first_last"){
        next.video_urls=[];next.audio_urls=[];
        if(next.image_urls.length<2)throw new Error("This First/Last Frame route requires two image references.");
      }else if(mode==="edit"||mode==="extend"){
        next.image_urls=[];next.audio_urls=[];
        if(!has(next.video_urls))throw new Error("This Video Edit/Extend route requires a source video.");
      }

      if(refs.images&&next.image_urls.length>Number(refs.images))throw new Error(`This route accepts at most ${refs.images} image reference${Number(refs.images)===1?"":"s"}.`);
      if(refs.videos&&next.video_urls.length>Number(refs.videos))throw new Error(`This route accepts at most ${refs.videos} video reference${Number(refs.videos)===1?"":"s"}.`);
      if(refs.audios&&next.audio_urls.length>Number(refs.audios))throw new Error(`This route accepts at most ${refs.audios} audio reference${Number(refs.audios)===1?"":"s"}.`);

      if(next.duration!==undefined&&next.duration!==null&&next.duration!==""&&next.duration!=="auto"){
        const duration=numeric(next.duration);
        if(duration===null||duration<=0)throw new Error("Duration must be a positive number.");
        if(Array.isArray(schema.duration)&&schema.duration.length>=2){
          const lo=Number(schema.duration[0]),hi=Number(schema.duration[1]);
          if(Number.isFinite(lo)&&duration<lo)throw new Error(`Duration must be at least ${lo}s for ${route.model.name}.`);
          if(Number.isFinite(hi)&&duration>hi)throw new Error(`Duration cannot exceed ${hi}s for ${route.model.name}.`);
        }
        next.duration=duration;
      }
      if(next.duration==="auto"||next.duration===-1)next.duration=-1;
      if(next.quality!==undefined&&next.quality!==""&&!allowed(next.quality,schema.quality))throw new Error(`Quality ${next.quality} is not supported by ${route.model.name}.`);
      if(next.aspect_ratio!==undefined&&next.aspect_ratio!==""&&!allowed(next.aspect_ratio,schema.aspect))throw new Error(`Aspect ratio ${next.aspect_ratio} is not supported by ${route.model.name}.`);
      if(!schema.aspect)delete next.aspect_ratio;
      if(!schema.audio)delete next.generate_audio;
      if(schema.webSearch===false)delete next.web_search;

      window.__kosmicLastEvoLinkRequest={model,route:route.id,mode,validatedAt:new Date().toISOString(),referenceCounts:{images:next.image_urls.length,videos:next.video_urls.length,audios:next.audio_urls.length}};
      return original(model,prompt,next);
    };
    guarded.__kosmicEvoFinalGuard=true;
    guarded.__kosmicEvoOriginal=original;
    window.generateEvoLinkVideo=guarded;
    return true;
  };

  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>180)clearInterval(timer);},50);
  }
})();

/* KOSMIC KAT — Seedance 2.5 parity request bridge
 * Keeps the new Fal-style controls authoritative for Seedance 2.5 only.
 */
(function installSeedance25ParityRequestBridge(){
  "use strict";
  if(window.__kosmicSeedance25ParityRequestBridge)return;
  window.__kosmicSeedance25ParityRequestBridge=true;
  const IDS=new Set([
    "seedance-2.5-text-to-video","seedance-2.5-image-to-video",
    "seedance-2.5-reference-to-video","seedance-2.5-video-edit",
    "seedance-2.5-video-extend"
  ]);
  const $=id=>document.getElementById(id);
  const getRefs=()=>{
    const s=window.S||{};
    const pick=v=>(Array.isArray(v)?v:[]).map(x=>typeof x==="string"?x:x?.dataUrl||x?.url||"").filter(Boolean);
    return{images:pick(s.vcMultiImages),videos:pick(s.vcMultiVideos),audios:pick(s.vcMultiAudios)};
  };
  window.__kosmicSeedanceBuildRequest=function(base={}){
    const model=$("vcModel")?.value||"";
    if(!IDS.has(model))return base;
    const state=window.__kosmicSeedance25ParityState||{};
    const route=state.route||model;
    const duration=Math.max(4,Math.min(30,Number($("evo25DurationNumber")?.value||base.duration||5)));
    const quality=$("evo25Quality")?.value||base.quality||"720p";
    let aspect=$("evo25AspectActive")?.value||document.querySelector("#evoSeedanceSchemaPanel .evo25-pill.active")?.getAttribute("data-evo25-aspect")||base.aspect_ratio||"16:9";
    if(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")aspect="adaptive";
    const refs=getRefs();
    let images=refs.images.slice(0,30),videos=refs.videos.slice(0,10),audios=refs.audios.slice(0,10);
    if(route==="seedance-2.5-text-to-video"){images=[];videos=[];audios=[];}
    if(route==="seedance-2.5-image-to-video"){images=images.slice(0,2);videos=[];audios=[];}
    const out=Object.assign({},base,{duration,quality,aspect_ratio:aspect,image_urls:images,video_urls:videos,audio_urls:audios,generate_audio:!!$("evo25Audio")?.checked,content_filter:$("evo25Content")?$("evo25Content").checked:true,model_params:Object.assign({},base.model_params||{})});
    return out;
  };
})();

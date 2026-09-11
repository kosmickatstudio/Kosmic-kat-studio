/* KOSMIC KAT — Seedance 2.5 parity request bridge
 * Keeps the new Seedance 2.5 controls authoritative for Seedance 2.5 only.
 * Mirrors the newer playground controls into the legacy bridge IDs so the
 * functional EvoLink adapter cannot overwrite a user's visible selections.
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
  function mirrorNewControls(){
    if(!IDS.has($("vcModel")?.value||""))return;
    const set=(from,to)=>{const a=$(from),b=$(to);if(a&&b&&a.value!==undefined)b.value=a.value;};
    const check=(from,to)=>{const a=$(from),b=$(to);if(a&&b)b.checked=!!a.checked;};
    set("evoSeedanceDuration","evo25DurationNumber");
    set("evoSeedanceDuration","evo25DurationRange");
    set("evoSeedanceDuration","vcDuration");
    set("evoSeedanceQuality","evo25Quality");
    set("evoSeedanceQuality","vcRes");
    set("evoSeedanceAspect","vcRatio");
    check("evoSeedanceAudio","evo25Audio");
    check("evoSeedanceContentFilter","evo25Content");
    check("evoSeedanceWebSearch","evo25WebSearch");
  }
  function bindNewControls(){
    const ids=["evoSeedanceDuration","evoSeedanceQuality","evoSeedanceAspect","evoSeedanceAudio","evoSeedanceContentFilter","evoSeedanceWebSearch"];
    ids.forEach(id=>{
      const el=$(id);if(!el||el.dataset.seed25ParityBound)return;
      el.addEventListener("input",mirrorNewControls);
      el.addEventListener("change",mirrorNewControls);
      el.dataset.seed25ParityBound="1";
    });
    if(!document.documentElement.dataset.seed25ParityAspectBound){
      document.addEventListener("click",e=>{
        const button=e.target?.closest?.("#evoSeedanceSchemaPanel [data-evo25-aspect]");
        if(button){setTimeout(()=>{
          const value=button.getAttribute("data-evo25-aspect")||"";
          const select=$("evoSeedanceAspect");if(select&&value)select.value=value;
          const vc=$("vcRatio");if(vc&&value)vc.value=value;
          mirrorNewControls();
        },0);}
      });
      document.documentElement.dataset.seed25ParityAspectBound="1";
    }
    mirrorNewControls();
  }
  window.__kosmicSeedanceBuildRequest=function(base={}){
    const model=$("vcModel")?.value||"";
    if(!IDS.has(model))return base;
    mirrorNewControls();
    const state=window.__kosmicSeedance25ParityState||{};
    const route=state.route||model;
    const duration=Math.max(4,Math.min(30,Number(state.duration||base.duration||5)));
    const quality=["480p","720p","1080p"].includes(state.quality)?state.quality:(base.quality||"720p");
    let aspect=state.aspect||base.aspect_ratio||"16:9";
    if(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")aspect="adaptive";
    const refs=getRefs();
    let images=refs.images.slice(0,30),videos=refs.videos.slice(0,10),audios=refs.audios.slice(0,10);
    if(route==="seedance-2.5-text-to-video"){images=[];videos=[];audios=[];}
    if(route==="seedance-2.5-image-to-video"){images=images.slice(0,2);videos=[];audios=[];}
    return Object.assign({},base,{duration,quality,aspect_ratio:aspect,image_urls:images,video_urls:videos,audio_urls:audios,generate_audio:state.audio!==undefined?!!state.audio:true,content_filter:state.content!==undefined?!!state.content:true,model_params:Object.assign({},base.model_params||{})});
  };
  bindNewControls();
  let tries=0;const timer=setInterval(()=>{bindNewControls();if(++tries>120)clearInterval(timer);},100);
})();

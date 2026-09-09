/* KOSMIC KAT — Seedance 2.5 Reference-to-Video schema adapter
 * Exact UI/validation layer for EvoLink's seedance-2.5-reference-to-video
 * contract. It is intentionally scoped to this route only.
 */
(function installSeedance25R2V(){
  "use strict";
  const ROUTE="seedance-2.5-reference-to-video";
  const MAX={images:30,videos:10,audios:10,total:50};
  const qs=id=>document.getElementById(id);
  const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));

  function isR2V(){return qs("evoPgRoute")?.value===ROUTE;}
  function urls(field){return [...document.querySelectorAll(`#evoPg${field} .evo-url[data-field="${field.toLowerCase()}_urls"]`)].map(x=>x.value.trim()).filter(Boolean);}

  function inject(){
    if(!isR2V())return;
    const controls=qs("evoPgControls");if(!controls)return;
    if(!qs("evoPgContentFilter")){
      const grid=document.createElement("div");grid.className="evo-advanced-grid evo-seedance25-r2v-extra";
      grid.innerHTML=`
        <label class="f-group"><span class="f-label">Output Format</span><select id="evoPgOutputFormat" class="f-select"><option value="mp4" selected>MP4 · H.264</option><option value="mov">MOV · H.264 + yuv444p + PCM</option></select></label>
        <label class="f-group"><span class="f-label">Content Filter</span><select id="evoPgContentFilter" class="f-select"><option value="true" selected>Enabled · standard safety</option><option value="false">Disabled · +10% billing</option></select></label>
        <label class="f-group"><span class="f-label">Callback URL</span><input id="evoPgCallback" class="f-input" type="url" placeholder="https://your-domain.com/webhooks/video-task-completed"></label>`;
      controls.appendChild(grid);
      const note=document.createElement("div");note.className="evo-r2v-schema-note";note.innerHTML="Reference-to-Video accepts 1–30 images, 1–10 videos, and 1–10 audio clips when provided, with at least one reference and 50 total maximum.";controls.appendChild(note);
    }
  }

  function validateAndOptions(){
    if(!isR2V())return null;
    const images=urls("Images"),videos=urls("Videos"),audios=urls("Audios");
    if(!images.length&&!videos.length&&!audios.length)throw new Error("Seedance 2.5 Reference-to-Video requires at least one image, video, or audio reference");
    if(images.length>MAX.images)throw new Error(`Seedance 2.5 allows at most ${MAX.images} image references`);
    if(videos.length>MAX.videos)throw new Error(`Seedance 2.5 allows at most ${MAX.videos} video references`);
    if(audios.length>MAX.audios)throw new Error(`Seedance 2.5 allows at most ${MAX.audios} audio references`);
    if(images.length+videos.length+audios.length>MAX.total)throw new Error(`Seedance 2.5 allows at most ${MAX.total} references in total`);
    const duration=Number(qs("evoPgDuration")?.value||5);
    if(!Number.isInteger(duration)||duration<4||duration>30)throw new Error("Seedance 2.5 Reference-to-Video duration must be an integer from 4 to 30 seconds");
    const quality=qs("evoPgQuality")?.value||"720p";
    if(!["480p","720p","1080p"].includes(quality))throw new Error("Invalid Seedance 2.5 quality");
    const aspect=qs("evoPgAspect")?.value||"adaptive";
    if(!["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"].includes(aspect))throw new Error("Invalid Seedance 2.5 aspect ratio");
    return {image_urls:images,video_urls:videos,audio_urls:audios,duration,quality,aspect_ratio:aspect,generate_audio:qs("evoPgAudio")?.checked??true,content_filter:qs("evoPgContentFilter")?.value!=="false",output_format:qs("evoPgOutputFormat")?.value||"mp4",callback_url:qs("evoPgCallback")?.value.trim()||undefined};
  }

  const original=window.generateEvoLinkVideo;
  function wrap(){
    if(typeof window.generateEvoLinkVideo!=="function"||window.generateEvoLinkVideo.__seedance25R2V)return;
    const base=window.generateEvoLinkVideo;
    const wrapped=async function(model,prompt,options={}){
      if(model===ROUTE){
        const exact=validateAndOptions();
        return base.call(this,model,prompt,Object.assign({},options,exact));
      }
      return base.call(this,model,prompt,options);
    };
    wrapped.__seedance25R2V=true;
    wrapped.__seedance25R2VOriginal=base;
    window.generateEvoLinkVideo=wrapped;
  }

  let last="";
  const tick=()=>{
    const modal=qs("evoVideoPlaygroundModal");
    const route=qs("evoPgRoute")?.value||"";
    if(route!==last){last=route;setTimeout(inject,0);}
    wrap();
    if(modal&&!modal.__seedance25Observer){
      const observer=new MutationObserver(()=>{if(isR2V())inject();});
      observer.observe(modal,{childList:true,subtree:true});
      modal.__seedance25Observer=observer;
    }
  };
  const timer=setInterval(tick,300);setTimeout(()=>clearInterval(timer),300000);
  tick();
})();

/* KOSMIC KAT — EVO LINK VIDEO ECOSYSTEM INTEGRITY LAYER
 * Phase 11 finalization.
 *
 * Single source of truth for the CURRENT EvoLink video catalog observed on
 * 2026-09-10. This layer intentionally does not delete or rewrite user keys,
 * saved generations, Fal.ai routing, or native settings/shutter behavior.
 *
 * Design rules:
 * 1) Primary catalog = the 25 live Video Generation cards shown by EvoLink.
 * 2) Every live route is indexed by its exact EvoLink model ID.
 * 3) Route schemas are descriptive metadata for UI/playground surfaces;
 *    generation still goes through the existing unified async adapter.
 * 4) Unknown future routes are never guessed. They remain outside the live
 *    index until verified and added here.
 * 5) Existing non-EvoLink provider IDs remain untouched.
 */
(function installEvoLinkIntegrity(){
  "use strict";
  if(window.__kosmicEvoLinkIntegrityInstalled)return;
  window.__kosmicEvoLinkIntegrityInstalled=true;

  const LIVE=[
    {name:"Seedance 2.5",provider:"BytePlus",group:"Seedance",price:"live",routes:[
      ["seedance-2.5-text-to-video","text","Text to Video"],["seedance-2.5-image-to-video","image","Image to Video"],["seedance-2.5-reference-to-video","reference","Reference to Video"],["seedance-2.5-video-edit","edit","Video Edit"],["seedance-2.5-video-extend","extend","Video Extend"]
    ],schema:{duration:[4,30],quality:["480p","720p","1080p"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,refs:{images:30,videos:10,audios:10},notes:["All routes use /v1/videos/generations","Async task polling via /v1/tasks/{task_id}"]}},
    {name:"Seedance 2.0",provider:"BytePlus",group:"Seedance",price:"live",routes:[
      ["seedance-2.0-text-to-video","text","Text to Video"],["seedance-2.0-image-to-video","image","Image to Video"],["seedance-2.0-reference-to-video","reference","Reference to Video"],["seedance-2.0-fast-text-to-video","text","Fast Text to Video"],["seedance-2.0-fast-image-to-video","image","Fast Image to Video"],["seedance-2.0-fast-reference-to-video","reference","Fast Reference to Video"]
    ],schema:{duration:[4,15],quality:["480p","720p","1080p","4K"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,webSearch:true,refs:{images:9,videos:3,audios:3}}},
    {name:"Seedance 2.0 Mini",provider:"BytePlus",group:"Seedance",price:"live",routes:[
      ["seedance-2.0-mini-text-to-video","text","Text to Video"],["seedance-2.0-mini-image-to-video","image","Image to Video"],["seedance-2.0-mini-reference-to-video","reference","Reference to Video"]
    ],schema:{duration:[4,15],quality:["480p","720p"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,refs:{images:9,videos:3,audios:3}}},
    {name:"MiniMax H3",provider:"MiniMax",group:"MiniMax",price:"live",routes:[
      ["minimax-h3-text-to-video","text","Text to Video"],["minimax-h3-image-to-video","image","Image to Video"],["minimax-h3-reference-to-video","reference","Reference to Video"]
    ],schema:{duration:[4,15],quality:["768p","2K"],refs:{images:1},notes:["I2V supports first/last frame","Reference route supports image/video/audio inputs"]}},
    {name:"Grok Imagine Video 1.5",provider:"xAI",group:"Grok",price:"live",routes:[
      ["grok-imagine-video-1.5-preview","auto","Text / Image / Reference"]
    ],schema:{duration:[1,15],quality:["480p","720p","1080p"],aspect:["auto","16:9","9:16","1:1","3:2","2:3"],audio:true,refs:{images:7},notes:["0 images=T2V; 1 image=I2V; 2–7 images=reference"]}},
    {name:"Gemini Omni Flash",provider:"Google",group:"Gemini",price:"live",routes:[
      ["gemini-omni-flash-text-to-video","text","Text to Video"],["gemini-omni-flash-image-to-video","image","Image to Video"],["gemini-omni-flash-reference-to-video","reference","Reference to Video"],["gemini-omni-flash-video-edit","edit","Video Edit"]
    ],schema:{duration:[3,10],quality:["720p"],aspect:["16:9","9:16","auto"],audio:true,refs:{images:14,videos:1},videoEditMax:10}},
    {name:"Kling 3.0 Turbo",provider:"Kling",group:"Kling",price:"live",routes:[
      ["kling-v3-turbo-text-to-video","text","Text to Video"],["kling-v3-turbo-image-to-video","image","Image to Video"]
    ],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1"]}},
    {name:"Happy Horse 1.1",provider:"Alibaba",group:"Happy Horse",price:"live",routes:[
      ["happyhorse-1.1-text-to-video","text","Text to Video"],["happyhorse-1.1-image-to-video","image","Image to Video"],["happyhorse-1.1-reference-to-video","reference","Reference to Video"]
    ],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","4:5","5:4","9:21","21:9"],refs:{images:9}}},
    {name:"Wan 2.7",provider:"Alibaba",group:"Wan",price:"live",routes:[
      ["wan2.7-text-to-video","text","Text to Video"],["wan2.7-image-to-video","image","Image to Video"],["wan2.7-reference-video","reference","Reference Video"],["wan2.7-video-edit","edit","Video Edit"]
    ],schema:{duration:[2,15],quality:["480p","720p","1080p"],aspect:["16:9","9:16"],refs:{images:5,videos:5,audios:1},voiceCloning:true}},
    {name:"Happy Horse 1.0",provider:"Alibaba",group:"Happy Horse",price:"live",routes:[
      ["happyhorse-1.0-text-to-video","text","Text to Video"],["happyhorse-1.0-image-to-video","image","Image to Video"],["happyhorse-1.0-reference-to-video","reference","Reference to Video"],["happyhorse-1.0-video-edit","edit","Video Edit"]
    ],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4"],refs:{images:9},edit:true}},
    {name:"Topaz Video Upscale",provider:"Topaz",group:"Specialized",price:"live",routes:[
      ["topaz-video-upscale","upscale","Video Upscale"]
    ],schema:{required:["video_urls"],params:{upscale_factor:["1","2","4"]},maxInputMB:50}},
    {name:"Seedance 1.5 Pro",provider:"BytePlus",group:"Seedance",price:"live",routes:[
      ["seedance-1.5-pro","text","Text to Video"],["seedance-1.5-pro-image-to-video","image","Image to Video"]
    ],schema:{duration:[4,12],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9"],audio:true}},
    {name:"Kling 3.0 Motion Control",provider:"Kling",group:"Specialized",price:"live",routes:[
      ["kling-v3-motion-control","motion","Motion Control"]
    ],schema:{duration:[3,30],quality:["720p","1080p"],required:["image_urls","video_urls"],params:{character_orientation:["image","video"],keep_sound:[true,false]}}},
    {name:"Kling O3",provider:"Kling",group:"Kling",price:"live",routes:[
      ["kling-o3-text-to-video","text","Text to Video"],["kling-o3-image-to-video","image","Image to Video"],["kling-o3-reference-to-video","reference","Reference to Video"],["kling-o3-video-edit","edit","Video Edit"]
    ],schema:{duration:[3,15],quality:["720p","1080p","4K"],aspect:["16:9","9:16","1:1"],sound:["off","on"],multiShot:true,customElements:7}},
    {name:"Kling 3.0",provider:"Kling",group:"Kling",price:"live",routes:[
      ["kling-v3-text-to-video","text","Text to Video"],["kling-v3-image-to-video","image","Image to Video"]
    ],schema:{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1"]}},
    {name:"Wan 2.6",provider:"Alibaba",group:"Wan",price:"live",routes:[
      ["wan2.6-text-to-video","text","Text to Video"],["wan2.6-image-to-video","image","Image to Video"],["wan2.6-reference-video","reference","Reference Video"]
    ],schema:{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16"],refs:{images:5,videos:1}}},
    {name:"Veo 3.1",provider:"Google",group:"Veo",price:"live",routes:[
      ["veo-3.1-fast-generate-preview","text","Fast"],["veo-3.1-generate-preview","text","Pro"],["veo3.1-fast-extend","extend","Fast Extend"]
    ],schema:{duration:[4,6,8],quality:["720p","1080p","4K"],aspect:["16:9","9:16"],audio:true,refs:{images:3}}},
    {name:"Sora 2",provider:"OpenAI",group:"Sora",price:"live",routes:[
      ["sora-2-preview","text","Text to Video"],["sora-2-image-to-video","image","Image to Video"]
    ],schema:{duration:[4,8,12],quality:["720p"],aspect:["16:9","9:16"],audio:true,refs:{images:1}}},
    {name:"Grok Imagine Video",provider:"xAI",group:"Grok",price:"live",routes:[
      ["grok-imagine-text-to-video-beta","text","Text to Video"],["grok-imagine-image-to-video-beta","image","Image to Video"]
    ],schema:{duration:[6,30],quality:["480p","720p"],aspect:["16:9","9:16","3:2","2:3","1:1"],style:["fun","normal","spicy"]}},
    {name:"Wan 2.5",provider:"Alibaba",group:"Wan",price:"live",routes:[
      ["wan2.5-text-to-video","text","Text to Video"],["wan2.5-image-to-video","image","Image to Video"]
    ],schema:{duration:[5,10],quality:["480p","720p","1080p"],aspect:["16:9","9:16"]}},
    {name:"Hailuo 2.3",provider:"MiniMax",group:"Hailuo",price:"live",routes:[
      ["MiniMax-Hailuo-2.3-Fast","image","Fast Image to Video"],["MiniMax-Hailuo-2.3","auto","Text / Image to Video"]
    ],schema:{duration:[6,10],quality:["768p","1080p"],refs:{images:1}}},
    {name:"Hailuo 02",provider:"MiniMax",group:"Hailuo",price:"live",routes:[
      ["MiniMax-Hailuo-02","auto","Text / Image / First+Last Frame"]
    ],schema:{duration:[6,10],quality:["512p","768p","1080p"],routes:["T2V","I2V","FLF"]}},
    {name:"Kling O1",provider:"Kling",group:"Kling",price:"live",routes:[
      ["kling-o1-image-to-video","image","Image to Video"],["kling-o1-video-edit-fast","edit","Video Edit Fast"]
    ],schema:{duration:[3,20],quality:["720p","1080p"],aspect:["16:9","9:16"]}},
    {name:"Seedance 1.0 Pro Fast",provider:"BytePlus",group:"Seedance",price:"live",routes:[
      ["doubao-seedance-1.0-pro-fast","text","Text to Video"],["doubao-seedance-1.0-pro-fast-image-to-video","image","Image to Video"]
    ],schema:{duration:[2,12],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9"]}},
    {name:"OmniHuman 1.5",provider:"BytePlus",group:"Specialized",price:"live",routes:[
      ["omnihuman-1.5","avatar","Digital Human"]
    ],schema:{duration:[1,35],required:["audio_url","image_urls"],params:{subject_check:[true,false],auto_mask:[true,false],pe_fast_mode:[true,false],seed:[-1,2147483647]}}}
  ];

  function makeCard(def,i){
    return {
      id:(def.routes[0]&&def.routes[0][0])||(`evolink-${i}`),
      name:def.name,provider:def.provider,group:def.group,price:def.price,
      availability:"live",source:"evolink-live-2026-09-10",
      routes:def.routes.map(([id,mode,label])=>({id,mode,label})),schema:def.schema||{}
    };
  }
  function routeIndex(catalog){
    const index={};
    catalog.forEach(card=>(card.routes||[]).forEach(route=>{
      if(!index[route.id])index[route.id]={model:card,...route};
    }));
    return index;
  }
  function installIntoGlobals(){
    const api=window.KOSMIC_EVOLINK_VIDEO||{};
    const previous=Array.isArray(api.catalog)?api.catalog.slice():[];
    api.previousCatalog=previous;
    api.liveCatalog=LIVE.map(makeCard);
    api.catalog=api.liveCatalog.slice();
    api.index=routeIndex(api.catalog);
    api.liveVideoCardCount=api.catalog.length;
    api.liveRouteCount=Object.keys(api.index).length;
    api.routeRevision="2026-09-10-live";
    api.catalogSource="https://evolink.ai/models";
    api.resolveRoute=id=>api.index?.[id]||null;
    api.getLiveModels=()=>api.catalog.slice();
    api.getRoutes=()=>Object.values(api.index||{});
    window.KOSMIC_EVOLINK_VIDEO=api;

    try{
      if(typeof VIDEO_MODEL_CAPABILITIES!=="undefined"){
        Object.values(api.index).forEach(r=>{
          VIDEO_MODEL_CAPABILITIES[r.id]=Object.assign({},VIDEO_MODEL_CAPABILITIES[r.id]||{},{
            provider:"evolink",evolink:true,mode:r.mode,route:r.id,schema:r.model.schema||{}
          });
        });
      }
      if(typeof VIDEO_MODEL_DURATIONS!=="undefined"){
        const discrete={
          "veo-3.1-fast-generate-preview":[4,6,8],"veo-3.1-generate-preview":[4,6,8],"veo3.1-fast-extend":[4,6,8],
          "sora-2-preview":[4,8,12],"sora-2-image-to-video":[4,8,12],"kling-v3-motion-control":[3,4,5,6,7,8,9,10,11,12,13,14,15],
          "MiniMax-Hailuo-2.3-Fast":[6,10],"MiniMax-Hailuo-2.3":[6,10],"MiniMax-Hailuo-02":[6,10]
        };
        api.catalog.forEach(card=>{
          const d=card.schema?.duration;
          if(Array.isArray(d)&&d.length===2){
            const [min,max]=d;
            const fallback=[];for(let n=min;n<=Math.min(max,30);n++)fallback.push(n);
            card.routes.forEach(r=>{VIDEO_MODEL_DURATIONS[r.id]={min,max,options:discrete[r.id]||fallback};});
          }
        });
      }
      if(typeof IMAGE_TO_VIDEO_MAP!=="undefined"){
        api.catalog.forEach(card=>card.routes.forEach(r=>{
          if(r.mode==="image")IMAGE_TO_VIDEO_MAP[r.id]=r.id;
        }));
      }
    }catch(err){console.warn("EvoLink capability bridge skipped:",err);}
  }

  const boot=()=>{
    if(!window.KOSMIC_EVOLINK_VIDEO)return false;
    installIntoGlobals();
    return true;
  };
  if(!boot()){
    let tries=0;
    const t=setInterval(()=>{if(boot()||++tries>120)clearInterval(t);},50);
  }
})();

/* KOSMIC KAT — EVO LINK VIDEO ECOSYSTEM INTEGRITY
 * Final integrity layer for the existing Video Studio integration.
 *
 * The base catalog and the current-route/expansion layers are authoritative.
 * This layer MUST NOT replace them with a smaller hard-coded snapshot. It only
 * normalizes known route families, rebuilds the route index, and exposes
 * capability metadata to the existing Video Canvas.
 *
 * Verified against EvoLink's live catalog/pricing/API pages on 2026-09-10.
 */
(function installEvoLinkIntegrity(){
  "use strict";
  if(window.__kosmicEvoLinkIntegrityInstalled)return;
  window.__kosmicEvoLinkIntegrityInstalled=true;

  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog?.length)return false;

    const find=(name)=>api.catalog.find(c=>c?.name===name);
    const setRoutes=(name,list)=>{
      const card=find(name);
      if(!card)return;
      card.availability="live";
      card.routes=list.map(([id,mode,label])=>({id,mode,label}));
    };
    const patchSchema=(name,patch)=>{
      const card=find(name);
      if(card)card.schema=Object.assign({},card.schema||{},patch||{});
    };
    const liveNames=new Set(api.catalog.map(c=>c?.name).filter(Boolean));
    api.catalog.forEach(c=>{if(c)c.availability="live";});

    // Exact current route families where the source catalog can otherwise
    // lag behind an API-page route addition.
    setRoutes("Seedance 2.5",[
      ["seedance-2.5-text-to-video","text","Text to Video"],
      ["seedance-2.5-image-to-video","image","Image to Video"],
      ["seedance-2.5-reference-to-video","reference","Reference to Video"],
      ["seedance-2.5-video-edit","edit","Video Edit"],
      ["seedance-2.5-video-extend","extend","Video Extend"]
    ]);
    patchSchema("Seedance 2.5",{duration:[4,30],quality:["480p","720p","1080p"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,refs:{images:30,videos:10,audios:10}});

    setRoutes("Seedance 2.0",[
      ["seedance-2.0-text-to-video","text","Text to Video"],
      ["seedance-2.0-image-to-video","image","Image to Video"],
      ["seedance-2.0-reference-to-video","reference","Reference to Video"],
      ["seedance-2.0-fast-text-to-video","text","Fast Text to Video"],
      ["seedance-2.0-fast-image-to-video","image","Fast Image to Video"],
      ["seedance-2.0-fast-reference-to-video","reference","Fast Reference to Video"]
    ]);
    patchSchema("Seedance 2.0",{duration:[4,15],quality:["480p","720p","1080p","4K"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,webSearch:true,refs:{images:9,videos:3,audios:3}});

    setRoutes("Seedance 2.0 Mini",[
      ["seedance-2.0-mini-text-to-video","text","Text to Video"],
      ["seedance-2.0-mini-image-to-video","image","Image to Video"],
      ["seedance-2.0-mini-reference-to-video","reference","Reference to Video"]
    ]);
    patchSchema("Seedance 2.0 Mini",{duration:[4,15],quality:["480p","720p"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true});

    setRoutes("MiniMax H3 Max",[
      ["minimax-h3-max-text-to-video","text","Text to Video"],
      ["minimax-h3-max-image-to-video","image","Image to Video · First / Last Frame"]
    ]);
    patchSchema("MiniMax H3 Max",{duration:[5,15],quality:["480p","768p"],aspect:["16:9","9:16"],firstLastFrame:true});

    setRoutes("Gemini Omni 1.1 Flash",[
      ["gemini-omni-1.1-flash-text-to-video","text","Text to Video"],
      ["gemini-omni-1.1-flash-image-to-video","image","Image to Video · First / Last Frame"],
      ["gemini-omni-1.1-flash-reference-to-video","reference","Reference to Video"],
      ["gemini-omni-1.1-flash-video-edit","edit","Video Edit"],
      ["gemini-omni-1.1-flash-video-extend","extend","Video Extend"]
    ]);
    patchSchema("Gemini Omni 1.1 Flash",{duration:[3,10],quality:["360p","720p","1080p","4K"],aspect:["16:9","9:16","auto"],audio:true,refs:{images:10,videos:3},videoEditMax:10,videoExtendMax:10,firstLastFrame:true});

    setRoutes("Wan 3.0",[
      ["wan3.0-text-to-video","text","Text to Video"],
      ["wan3.0-image-to-video","image","Image to Video · Optional Last Frame"],
      ["wan3.0-reference-video","reference","Reference to Video"]
    ]);
    patchSchema("Wan 3.0",{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4"],audio:true,refs:{images:10,videos:5,audios:5},docs:1,webPages:1});

    setRoutes("Wan 3.0 Prime",[
      ["wan3.0-prime-text-to-video","text","Text to Video"],
      ["wan3.0-prime-image-to-video","image","Image to Video · Optional Last Frame"],
      ["wan3.0-prime-reference-video","reference","Reference to Video"]
    ]);
    patchSchema("Wan 3.0 Prime",{duration:[2,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4"],audio:true,refs:{images:10,videos:5,audios:5},docs:1,webPages:1});

    setRoutes("MiniMax H3",[
      ["minimax-h3-text-to-video","text","Text to Video"],
      ["minimax-h3-image-to-video","image","Image to Video · First / Last Frame"],
      ["minimax-h3-reference-to-video","reference","Reference to Video"]
    ]);
    patchSchema("MiniMax H3",{duration:[4,15],quality:["768p","2K"],aspect:["16:9","9:16"],firstLastFrame:true,refs:{images:1,videos:1,audios:1}});

    setRoutes("Grok Imagine Video 1.5",[["grok-imagine-video-1.5-preview","auto","Text / Image / Reference"]]);
    patchSchema("Grok Imagine Video 1.5",{duration:[1,15],quality:["480p","720p","1080p"],aspect:["auto","16:9","9:16","1:1","3:2","2:3"],audio:true,refs:{images:7},multiImage:true});

    setRoutes("Gemini Omni Flash",[
      ["gemini-omni-flash-text-to-video","text","Text to Video"],
      ["gemini-omni-flash-image-to-video","image","Image to Video"],
      ["gemini-omni-flash-reference-to-video","reference","Reference to Video"],
      ["gemini-omni-flash-video-edit","edit","Video Edit"]
    ]);
    patchSchema("Gemini Omni Flash",{duration:[3,10],quality:["720p"],aspect:["16:9","9:16","auto"],audio:true,refs:{images:14,videos:1},videoEditMax:10});

    setRoutes("Kling 3.0 Turbo",[
      ["kling-v3-turbo-text-to-video","text","Text to Video"],
      ["kling-v3-turbo-image-to-video","image","Image to Video"]
    ]);
    patchSchema("Kling 3.0 Turbo",{duration:[3,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1"]});

    setRoutes("Happy Horse 1.1",[
      ["happyhorse-1.1-text-to-video","text","Text to Video"],
      ["happyhorse-1.1-image-to-video","image","Image to Video"],
      ["happyhorse-1.1-reference-to-video","reference","Reference to Video"]
    ]);

    setRoutes("Wan 2.7",[
      ["wan2.7-text-to-video","text","Text to Video"],
      ["wan2.7-image-to-video","image","Image to Video"],
      ["wan2.7-reference-video","reference","Reference Video"],
      ["wan2.7-video-edit","edit","Video Edit"]
    ]);

    setRoutes("Happy Horse 1.0",[
      ["happyhorse-1.0-text-to-video","text","Text to Video"],
      ["happyhorse-1.0-image-to-video","image","Image to Video"],
      ["happyhorse-1.0-reference-to-video","reference","Reference to Video"],
      ["happyhorse-1.0-video-edit","edit","Video Edit"]
    ]);

    setRoutes("Seedance 1.5 Pro",[
      ["seedance-1.5-pro","text","Text to Video"],
      ["seedance-1.5-pro-image-to-video","image","Image to Video"]
    ]);

    setRoutes("Kling 3.0 Motion Control",[["kling-v3-motion-control","motion","Motion Control"]]);
    setRoutes("Kling O3",[
      ["kling-o3-text-to-video","text","Text to Video"],
      ["kling-o3-image-to-video","image","Image to Video"],
      ["kling-o3-reference-to-video","reference","Reference to Video"],
      ["kling-o3-video-edit","edit","Video Edit"]
    ]);
    setRoutes("Kling 3.0",[
      ["kling-v3-text-to-video","text","Text to Video"],
      ["kling-v3-image-to-video","image","Image to Video"]
    ]);
    setRoutes("Wan 2.6",[
      ["wan2.6-text-to-video","text","Text to Video"],
      ["wan2.6-image-to-video","image","Image to Video"],
      ["wan2.6-reference-video","reference","Reference Video"]
    ]);

    setRoutes("Veo 3.1",[
      ["veo3.1-fast-beta","text","Fast · 8s"],
      ["veo3.1-pro-beta","text","Pro · 8s"]
    ]);
    patchSchema("Veo 3.1",{duration:[8,8],quality:["720p"],aspect:["16:9","9:16"],audio:true,variants:["fast","pro"]});

    setRoutes("Sora 2",[
      ["sora-2-preview","auto","Text / Image to Video"]
    ]);
    patchSchema("Sora 2",{duration:[10,15],quality:["720p"],aspect:["16:9","9:16"],audio:true,refs:{images:1}});

    setRoutes("Sora 2 Pro",[
      ["sora-2-pro-preview","auto","Text / Image to Video"]
    ]);
    patchSchema("Sora 2 Pro",{duration:[4,8,12],quality:["720p","1080p"],aspect:["16:9","9:16"],audio:true,refs:{images:1}});

    setRoutes("Grok Imagine Video",[
      ["grok-imagine-text-to-video-beta","text","Text to Video"],
      ["grok-imagine-image-to-video-beta","image","Image to Video"]
    ]);
    patchSchema("Grok Imagine Video",{duration:[6,30],quality:["480p","720p","1080p"],aspect:["16:9","9:16","3:2","2:3","1:1"],style:["fun","normal","spicy"]});

    setRoutes("Wan 2.5",[
      ["wan2.5-text-to-video","text","Text to Video"],
      ["wan2.5-image-to-video","image","Image to Video"]
    ]);
    setRoutes("Hailuo 2.3",[
      ["MiniMax-Hailuo-2.3-Fast","text","Fast Text to Video"],
      ["MiniMax-Hailuo-2.3-Fast-image-to-video","image","Fast Image to Video"]
    ]);
    setRoutes("Hailuo 02",[
      ["MiniMax-Hailuo-02","auto","Text / Image / First+Last Frame"]
    ]);
    patchSchema("Hailuo 02",{duration:[6,10],quality:["512p","768p","1080p"],routes:["T2V","I2V","FLF"]});
    setRoutes("Kling O1",[
      ["kling-o1-image-to-video","image","Image to Video"],
      ["kling-o1-video-edit-fast","edit","Video Edit Fast"]
    ]);
    setRoutes("Seedance 1.0 Pro Fast",[
      ["doubao-seedance-1.0-pro-fast","text","Text to Video"],
      ["doubao-seedance-1.0-pro-fast-image-to-video","image","Image to Video"]
    ]);
    setRoutes("OmniHuman 1.5",[["omnihuman-1.5","avatar","Digital Human"]]);
    setRoutes("Topaz Video Upscale",[["topaz-video-upscale","upscale","Video Upscale"]]);

    const index={};
    const duplicateRoutes=[];
    api.catalog.forEach(card=>{
      (card.routes||[]).forEach(route=>{
        if(!route?.id)return;
        if(index[route.id])duplicateRoutes.push(route.id);
        else index[route.id]={model:card,...route};
      });
    });
    api.index=index;
    api.liveCatalog=api.catalog.slice();
    api.liveVideoCardCount=api.catalog.length;
    api.liveRouteCount=Object.keys(index).length;
    api.duplicateRouteIds=[...new Set(duplicateRoutes)];
    api.routeRevision="2026-09-10-integrity-final";
    api.catalogSource="https://evolink.ai/models";
    api.resolveRoute=id=>api.index?.[id]||null;
    api.getLiveModels=()=>api.catalog.slice();
    api.getRoutes=()=>Object.values(api.index||{});
    api.isLiveModel=name=>liveNames.has(name);
    window.KOSMIC_EVOLINK_VIDEO=api;

    if(typeof VIDEO_MODEL_CAPABILITIES!=="undefined"){
      Object.values(index).forEach(route=>{
        const s=route.model.schema||{};
        const refs=s.refs||{};
        VIDEO_MODEL_CAPABILITIES[route.id]=Object.assign({},VIDEO_MODEL_CAPABILITIES[route.id]||{},{
          provider:"evolink",evolink:true,route:route.id,mode:route.mode,schema:s,
          maxImages:refs.images||0,maxVideos:refs.videos||0,maxAudios:refs.audios||0,
          multiRef:route.mode==="reference"
        });
      });
    }
    return true;
  };

  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>120)clearInterval(timer);},50);
  }
})();

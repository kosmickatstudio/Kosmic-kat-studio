/* KOSMIC KAT — EvoLink route/schema expansion
 * Keeps the existing generator intact while filling route families and
 * parameter schemas that were missing from the first ecosystem pass.
 * Source basis: current EvoLink model/playground/API pages checked 2026-09-10.
 */
(function installEvoLinkVideoExpansion(){
  "use strict";
  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog)return false;

    const upsert=(id,card)=>{
      const i=api.catalog.findIndex(x=>x.id===id);
      if(i<0)api.catalog.push(card);
      else api.catalog[i]=Object.assign({},api.catalog[i],card,{routes:card.routes||api.catalog[i].routes,schema:Object.assign({},api.catalog[i].schema,card.schema||{})});
    };
    const setRoutes=(id,routes)=>{
      const c=api.catalog.find(x=>x.id===id);
      if(c)c.routes=routes;
    };
    const setSchema=(id,schema)=>{
      const c=api.catalog.find(x=>x.id===id);
      if(c)c.schema=Object.assign({},c.schema,schema);
    };
    const reindex=()=>{
      api.index={};
      api.catalog.forEach(card=>(card.routes||[]).forEach(route=>{api.index[route.id]={model:card,...route};}));
    };

    /* Live route families */
    setRoutes("happyhorse-1.1-text-to-video",[
      {id:"happyhorse-1.1-text-to-video",mode:"text",label:"Text to Video"},
      {id:"happyhorse-1.1-image-to-video",mode:"image",label:"Image to Video"},
      {id:"happyhorse-1.1-reference-to-video",mode:"reference",label:"Reference to Video"}
    ]);
    setSchema("happyhorse-1.1-text-to-video",{
      duration:[3,15],quality:["720p","1080p"],
      aspect:["16:9","9:16","1:1","4:3","3:4","4:5","5:4","9:21","21:9"],
      refs:{images:9},audio:false
    });

    setRoutes("happyhorse-1.0-text-to-video",[
      {id:"happyhorse-1.0-text-to-video",mode:"text",label:"Text to Video"},
      {id:"happyhorse-1.0-image-to-video",mode:"image",label:"Image to Video"},
      {id:"happyhorse-1.0-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"happyhorse-1.0-video-edit",mode:"edit",label:"Video Edit"}
    ]);
    setSchema("happyhorse-1.0-text-to-video",{
      duration:[3,15],quality:["720p","1080p"],
      aspect:["16:9","9:16","1:1","4:3","3:4","4:5","5:4","9:21","21:9"],
      refs:{images:9},edit:true,audio:false,seed:[0,2147483647]
    });

    setRoutes("seedance-1.5-pro",[
      {id:"seedance-1.5-pro",mode:"text",label:"Text to Video"},
      {id:"seedance-1.5-pro-image-to-video",mode:"image",label:"Image to Video"}
    ]);
    setSchema("seedance-1.5-pro",{
      duration:[4,12],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,refs:{images:1}
    });

    setRoutes("doubao-seedance-1.0-pro-fast",[
      {id:"doubao-seedance-1.0-pro-fast",mode:"text",label:"Text to Video"},
      {id:"doubao-seedance-1.0-pro-fast-image-to-video",mode:"image",label:"Image to Video"}
    ]);
    setSchema("doubao-seedance-1.0-pro-fast",{
      duration:[2,12],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9"],refs:{images:1},audio:false
    });

    setRoutes("gemini-omni-1.1-flash-text-to-video",[
      {id:"gemini-omni-1.1-flash-text-to-video",mode:"text",label:"Text to Video"},
      {id:"gemini-omni-1.1-flash-image-to-video",mode:"image",label:"Image to Video"},
      {id:"gemini-omni-1.1-flash-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"gemini-omni-1.1-flash-video-edit",mode:"edit",label:"Video Edit"},
      {id:"gemini-omni-1.1-flash-video-extend",mode:"extend",label:"Video Extend"}
    ]);
    setSchema("gemini-omni-1.1-flash-text-to-video",{
      duration:[3,10],quality:["720p"],aspect:["16:9","9:16","auto"],audio:true,
      refs:{images:14,videos:1},videoEditMax:10,videoExtendMax:10
    });

    setRoutes("wan2.7-text-to-video",[
      {id:"wan2.7-text-to-video",mode:"text",label:"Text to Video"},
      {id:"wan2.7-image-to-video",mode:"image",label:"Image to Video"},
      {id:"wan2.7-reference-video",mode:"reference",label:"Reference Video"},
      {id:"wan2.7-video-edit",mode:"edit",label:"Video Edit"}
    ]);
    setSchema("wan2.7-text-to-video",{
      duration:[2,15],quality:["720p","1080p"],aspect:["16:9","9:16","1:1","4:3","3:4"],
      refs:{images:5,videos:5,audios:1},voiceCloning:true,edit:true
    });

    setRoutes("kling-o3-text-to-video",[
      {id:"kling-o3-text-to-video",mode:"text",label:"Text to Video"},
      {id:"kling-o3-image-to-video",mode:"image",label:"Image to Video"},
      {id:"kling-o3-reference-to-video",mode:"reference",label:"Reference to Video"},
      {id:"kling-o3-video-edit",mode:"edit",label:"Video Edit"}
    ]);
    setSchema("kling-o3-text-to-video",{
      duration:[3,15],quality:["720p","1080p","4k"],aspect:["16:9","9:16","1:1"],
      sound:["off","on"],multiShot:true,customElements:7,edit4K:true
    });

    setRoutes("sora-2-pro-preview",[
      {id:"sora-2-pro-preview",mode:"text",label:"Text to Video"},
      {id:"sora-2-pro-image-to-video",mode:"image",label:"Image to Video"}
    ]);
    setSchema("sora-2-pro-preview",{
      duration:[4,8,12],quality:["720p","1080p"],aspect:["16:9","9:16"],audio:true,refs:{images:1},
      sizeMap:{"720p":["1280x720","720x1280"],"1080p":["1792x1024","1024x1792"]}
    });

    setRoutes("sora-2-preview",[
      {id:"sora-2-preview",mode:"text",label:"Text to Video"},
      {id:"sora-2-image-to-video",mode:"image",label:"Image to Video"}
    ]);
    setSchema("sora-2-preview",{duration:[10,15],quality:["720p"],aspect:["16:9","9:16"],audio:true,refs:{images:1}});

    setRoutes("grok-imagine-text-to-video-beta",[
      {id:"grok-imagine-text-to-video-beta",mode:"text",label:"Text to Video"},
      {id:"grok-imagine-image-to-video-beta",mode:"image",label:"Image to Video"}
    ]);
    setSchema("grok-imagine-text-to-video-beta",{
      duration:[6,30],quality:["480p","720p"],aspect:["16:9","9:16","3:2","2:3","1:1"],style:["fun","normal","spicy"]
    });

    setSchema("grok-imagine-video-1.5-preview",{
      duration:[1,15],quality:["480p","720p","1080p"],aspect:["auto","16:9","9:16","1:1","3:2","2:3"],
      refs:{images:7},multiImage:true,audio:true
    });

    /* Seedance 2.5 is a live EvoLink family, not a TBC/coming-soon route. */
    upsert("seedance-2.5-reference-to-video",{
      id:"seedance-2.5-reference-to-video",name:"Seedance 2.5",provider:"BytePlus",group:"Seedance",
      availability:"live",routes:[
        {id:"seedance-2.5-text-to-video",mode:"text",label:"Text to Video"},
        {id:"seedance-2.5-image-to-video",mode:"image",label:"Image to Video"},
        {id:"seedance-2.5-reference-to-video",mode:"reference",label:"Reference to Video"},
        {id:"seedance-2.5-video-edit",mode:"edit",label:"Video Edit"},
        {id:"seedance-2.5-video-extend",mode:"extend",label:"Video Extend"}
      ],
      schema:{
        duration:[4,30],
        quality:["480p","720p","1080p"],
        aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],
        refs:{images:30,videos:10,audios:10,total:50},
        audio:true,
        contentFilter:true,
        webSearch:false
      }
    });

    reindex();
    api.routeRevision="2026-09-11";
    window.KOSMIC_EVOLINK_VIDEO=api;
    return true;
  };
  if(!boot()){
    let tries=0;const timer=setInterval(()=>{if(boot()||++tries>100)clearInterval(timer);},50);
  }
})();

/* KOSMIC KAT — EvoLink current-route corrections
 * Keeps the main catalog readable while applying route IDs that were verified
 * directly against current EvoLink model pages on 2026-09-09.
 */
(function applyCurrentEvoLinkRoutes(){
  "use strict";
  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.catalog||!api.index)return false;
    const upsertCard=(id,card)=>{
      const i=api.catalog.findIndex(x=>x.id===id);
      if(i>=0)api.catalog[i]=Object.assign({},api.catalog[i],card);
      else api.catalog.push(card);
    };
    const reindex=()=>{
      api.index={};
      api.catalog.forEach(card=>card.routes.forEach(route=>{api.index[route.id]={model:card,...route};}));
      window.KOSMIC_EVOLINK_VIDEO=api;
    };

    // Gemini Omni 1.1 Flash: five current EvoLink routes.
    upsertCard("gemini-omni-1.1-flash-text-to-video",{
      id:"gemini-omni-1.1-flash-text-to-video",name:"Gemini Omni 1.1 Flash",provider:"Google",group:"Gemini",price:"token based",
      routes:[
        {id:"gemini-omni-1.1-flash-text-to-video",mode:"text",label:"Text to Video"},
        {id:"gemini-omni-1.1-flash-image-to-video",mode:"image",label:"Image to Video"},
        {id:"gemini-omni-1.1-flash-reference-to-video",mode:"reference",label:"Reference to Video"},
        {id:"gemini-omni-1.1-flash-video-edit",mode:"edit",label:"Video Edit"},
        {id:"gemini-omni-1.1-flash-video-extend",mode:"extend",label:"Video Extend"}
      ],
      schema:{duration:[3,10],quality:["360p","720p","1080p","4K"],aspect:["16:9","9:16","auto"],audio:true,refs:{images:14,videos:1},videoEditMax:10,videoExtendMax:10}
    });

    // Wan 2.7: four current EvoLink routes.
    upsertCard("wan2.7-text-to-video",{
      id:"wan2.7-text-to-video",name:"Wan 2.7",provider:"Alibaba",group:"Wan",price:"$0.087-$0.145/output sec",
      routes:[
        {id:"wan2.7-text-to-video",mode:"text",label:"Text to Video"},
        {id:"wan2.7-image-to-video",mode:"image",label:"Image to Video"},
        {id:"wan2.7-reference-video",mode:"reference",label:"Reference Video"},
        {id:"wan2.7-video-edit",mode:"edit",label:"Video Edit"}
      ],
      schema:{duration:[2,15],quality:["480p","720p","1080p"],aspect:["16:9","9:16"],refs:{images:5,videos:5,audios:1},voiceCloning:true}
    });

    // Wan 3.0 reference route is `reference-video`, not `reference-to-video`.
    const wan3=api.catalog.find(x=>x.id==="wan3.0-text-to-video");
    if(wan3)wan3.routes=wan3.routes.map(r=>r.id==="wan3.0-reference-to-video"?Object.assign({},r,{id:"wan3.0-reference-video"}):r);
    // Wan 2.6 follows the same public route naming convention.
    const wan26=api.catalog.find(x=>x.id==="wan2.6-text-to-video");
    if(wan26)wan26.routes=wan26.routes.map(r=>r.id==="wan2.6-reference-to-video"?Object.assign({},r,{id:"wan2.6-reference-video"}):r);

    // Grok Imagine Video 1.5 currently exposes 0-7 images with the image count
    // selecting text/image/reference mode; no separate route IDs are needed.
    const grok15=api.catalog.find(x=>x.id==="grok-imagine-video-1.5-preview");
    if(grok15)grok15.schema=Object.assign({},grok15.schema,{duration:[1,15],quality:["480p","720p","1080p"],aspect:["auto","16:9","9:16","1:1","3:2","2:3"],multiImage:true,refs:{images:7},audio:true});

    // Current EvoLink changelog says Veo 3.1 is 720p only.
    const veo=api.catalog.find(x=>x.id==="veo3.1-fast-beta");
    if(veo)veo.schema=Object.assign({},veo.schema,{quality:["720p"],duration:[8,8],aspect:["16:9","9:16"],audio:true});

    reindex();
    window.KOSMIC_EVOLINK_VIDEO.currentRouteRevision="2026-09-09";
    return true;
  };
  if(!boot()){
    let tries=0;const t=setInterval(()=>{if(boot()||++tries>80)clearInterval(t);},50);
  }
})();

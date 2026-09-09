/* KOSMIC KAT — HOME PREMIUM V2
 * Presentation/data layer for the existing Home module.
 * Keeps generation, storage, routing and auth untouched.
 */
(function installHomePremiumV2(){
  "use strict";
  if(window.__kosmicHomePremiumV2)return;
  window.__kosmicHomePremiumV2=true;

  const BRAIN=window.KOSMIC_HOME_LLM_CATALOG||{};
  const VIDEO=[
    {id:"seedance-2.5-text-to-video",label:"Seedance 2.5",meta:"T2V · 4–30s · 480/720/1080"},
    {id:"seedance-2.0-text-to-video",label:"Seedance 2.0",meta:"T2V/I2V/R2V · 4–15s"},
    {id:"seedance-2.0-fast-text-to-video",label:"Seedance 2.0 Fast",meta:"Fast · T2V/I2V/R2V"},
    {id:"seedance-2.0-mini-text-to-video",label:"Seedance 2.0 Mini",meta:"T2V/I2V/R2V · 4–15s"},
    {id:"minimax-h3-text-to-video",label:"MiniMax H3",meta:"T2V/I2V/R2V"},
    {id:"grok-imagine-video-1.5-preview",label:"Grok Imagine Video 1.5",meta:"xAI · preview"},
    {id:"gemini-omni-flash",label:"Gemini Omni Flash",meta:"Google · video"},
    {id:"kling-3.0-turbo-text-to-video",label:"Kling 3.0 Turbo",meta:"T2V/I2V"},
    {id:"happy-horse-1.1-text-to-video",label:"Happy Horse 1.1",meta:"T2V/I2V/R2V/Edit"},
    {id:"wan-2.7-text-to-video",label:"Wan 2.7",meta:"T2V/I2V/R2V/Edit"},
    {id:"happy-horse-1.0-text-to-video",label:"Happy Horse 1.0",meta:"T2V/I2V/R2V/Edit"},
    {id:"topaz-video-upscale",label:"Topaz Video Upscale",meta:"Upscale"},
    {id:"seedance-1.5-pro-text-to-video",label:"Seedance 1.5 Pro",meta:"T2V/I2V"},
    {id:"kling-3.0-motion-control",label:"Kling 3.0 Motion Control",meta:"Motion Control"},
    {id:"kling-o3-text-to-video",label:"Kling O3",meta:"T2V/I2V/R2V/Edit"},
    {id:"kling-3.0-text-to-video",label:"Kling 3.0",meta:"T2V/I2V"},
    {id:"wan-2.6-text-to-video",label:"Wan 2.6",meta:"T2V/I2V/R2V"},
    {id:"veo-3.1-generate-preview",label:"Veo 3.1",meta:"Fast + standard"},
    {id:"sora-2-pro-preview",label:"Sora 2 Pro",meta:"OpenAI · preview"},
    {id:"grok-imagine-video",label:"Grok Imagine Video",meta:"xAI"},
    {id:"wan-2.5-text-to-video",label:"Wan 2.5",meta:"T2V/I2V"},
    {id:"hailuo-2.3-text-to-video",label:"Hailuo 2.3",meta:"T2V/I2V"},
    {id:"hailuo-02-text-to-video",label:"Hailuo 02",meta:"T2V/I2V · first/last"},
    {id:"kling-o1-text-to-video",label:"Kling O1",meta:"Video generation"},
    {id:"seedance-1.0-pro-fast-text-to-video",label:"Seedance 1.0 Pro Fast",meta:"Fast"},
    {id:"omnihuman-1.5",label:"OmniHuman 1.5",meta:"Audio + image · human video"}
  ];
  const IMAGE=[
    ["fal-ai/flux/schnell","FLUX Schnell"],["fal-ai/flux/dev","FLUX Dev"],["fal-ai/flux-pro/v1.1","FLUX 1.1 Pro"],
    ["fal-ai/ideogram/v3","Ideogram V3"],["fal-ai/recraft/v3/text-to-image","Recraft V3"],["fal-ai/stable-diffusion-v35-large","Stable Diffusion 3.5"],
    ["fal-ai/flux-2","FLUX.2 Dev"],["fal-ai/flux-2-pro","FLUX.2 Pro"],["fal-ai/flux-2/flash","FLUX.2 Flash"],
    ["gemini-3.1-flash-image","Nano Banana 2"],["gemini-3-pro-image","Nano Banana Pro"],["gpt-image-2","GPT Image 2"],
    ["fal-ai/nano-banana-2","Nano Banana 2 (fal)"],["fal-ai/nano-banana-pro","Nano Banana Pro (fal)"],["openai/gpt-image-2","GPT Image 2 (fal)"]
  ];

  function esc(v){return String(v).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\":"&#92;","\"":"&quot;"}[c]));}
  function readyFor(id){
    if(id.indexOf("fal-ai/")===0)return !!(typeof gs==="function"&&gs("api_falai",""));
    if(id.indexOf("gpt-")===0||id.indexOf("openai/")===0)return !!(typeof gs==="function"&&gs("api_openai",""));
    if(id.indexOf("gemini")===0)return !!(typeof gs==="function"&&gs("api_gemini",""));
    return true;
  }
  function card(id,label,meta,kind){
    const active=typeof gs==="function"&&gs(kind==="video"?"default_video_model":"default_image_model","")===id;
    return '<button type="button" class="home-model-card '+(active?'is-active':'')+'" onclick="setDefaultModel(\''+esc(kind)+'\',\''+esc(id)+'\')">'+
      '<span class="home-model-card-top"><span class="home-model-name">'+esc(label)+'</span>'+(active?'<span class="home-model-active">✓</span>':'')+'</span>'+
      '<span class="home-model-meta">'+esc(meta||"Ready")+'</span>'+(readyFor(id)?'<span class="home-model-status is-ready">Ready</span>':'<span class="home-model-status">API key needed</span>')+'</button>';
  }
  function brainCards(){
    return Object.entries(BRAIN).flatMap(([provider,models])=>models.slice(0,9).map(m=>({provider,label:m.label,id:m.id})));
  }
  function findPanels(){
    return Array.from(document.querySelectorAll(".home-glass-panel"));
  }
  function enhanceModelSelection(){
    const panel=findPanels().find(p=>/Model Selection/i.test(p.textContent||""));
    if(!panel)return false;
    if(panel.dataset.premiumV2==="1")return true;
    const title=panel.querySelector(".panel-title");
    if(title){
      title.innerHTML='<span class="home-section-icon">✦</span><span>Model Selection</span><span class="home-live-pill">CURRENT</span>';
    }
    const grids=panel.querySelectorAll("[style*='grid-template-columns']");
    const grid=grids[0];
    if(!grid)return false;
    const cols=grid.children;
    if(cols.length<3)return false;
    const imageBody=cols[0].querySelector("div:nth-child(2)");
    const videoBody=cols[1].querySelector("div:nth-child(2)");
    const brainBody=cols[2].querySelector("div:nth-child(2)");
    if(imageBody)imageBody.innerHTML=IMAGE.map(x=>card(x[0],x[1],"Image generation", "image")).join("");
    if(videoBody)videoBody.innerHTML=VIDEO.map(x=>card(x.id,x.label,x.meta,"video")).join("");
    if(brainBody)brainBody.innerHTML=brainCards().map(m=>'<button type="button" class="home-brain-card '+((typeof gs==="function"&&gs("ai_model","")===m.provider)?"is-active":"")+'" onclick="setBrainModelQuick(\''+esc(m.provider)+'\')"><span>'+esc(m.label)+'</span><small>'+esc(m.provider.toUpperCase())+'</small></button>').join("");
    panel.dataset.premiumV2="1";
    return true;
  }
  function enhance(){
    enhanceModelSelection();
    document.querySelectorAll("#homeAgentInput").forEach(x=>x.classList.add("home-premium-input"));
    document.querySelectorAll("#aiModelSelectTrigger,#brainSubModelSelectTrigger").forEach(x=>x.classList.add("home-premium-select"));
  }
  let tries=0;
  const timer=setInterval(()=>{enhance();if(++tries>100)clearInterval(timer);},100);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance,{once:true});
  else setTimeout(enhance,0);
})();

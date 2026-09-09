/* KOSMIC KAT — EvoLink adapter fallback
 * Defines the unified async video adapter only when the existing application
 * has not already provided one. This avoids duplicate providers and preserves
 * the app's established generation implementation.
 */
(function installEvoLinkAdapterFallback(){
  "use strict";
  const boot=()=>{
    const api=window.KOSMIC_EVOLINK_VIDEO;
    if(!api?.index)return false;
    if(typeof window.generateEvoLinkVideo==="function")return true;

    const endpoint=api.endpoint||"https://api.evolink.ai/v1/videos/generations";
    const taskEndpoint=api.taskEndpoint||"https://api.evolink.ai/v1/tasks/";
    const genericBlocked=new Set(api.specializedRoutes||["topaz-video-upscale","kling-v3-motion-control","omnihuman-1.5"]);
    const key=()=>String(typeof gs==="function"?gs("api_evolink",""):"").trim();
    const authHeaders=()=>{
      const k=key();if(!k)throw new Error("Add an EvoLink API key in Settings first");
      return {"Authorization":"Bearer "+k,"Content-Type":"application/json"};
    };
    const readJson=async res=>res.json().catch(()=>({}));
    const extractUrl=data=>{
      const list=[data?.video_url,data?.download_url,data?.url,data?.output?.video_url,data?.output?.url,data?.result?.video_url,data?.result?.url];
      return list.find(v=>typeof v==="string"&&/^https?:\/\//i.test(v))||null;
    };
    const getTaskId=data=>data?.id||data?.task_id||data?.task?.id||data?.data?.id||null;
    const statusOf=data=>String(data?.status||data?.state||data?.task_info?.status||"").toLowerCase();

    window.generateEvoLinkVideo=async function(model,prompt,options={}){
      const route=api.index[model];
      if(!route)throw new Error("Unsupported EvoLink video model: "+model);
      if(genericBlocked.has(model))throw new Error("This EvoLink route requires its specialized generator path");
      const body={};
      if(prompt)body.prompt=prompt;
      ["aspect_ratio","quality","output_format","generate_audio","web_search","image_urls","video_urls","audio_urls","callback_url","mask_url","model_params"].forEach(k=>{
        const v=options[k];if(v!==undefined&&v!==null&&v!==""&&(!Array.isArray(v)||v.length))body[k]=v;
      });
      if(options.duration!==undefined&&options.duration!==null&&options.duration!==""){
        body.duration=(options.duration==="auto"||options.duration===-1)?"auto":Number(options.duration);
        if(!Number.isFinite(body.duration))throw new Error("Invalid duration value");
      }
      if(route.mode==="image"&&!body.image_urls?.length)throw new Error("This Image-to-Video route requires at least one image URL");
      if(route.mode==="reference"&&!body.image_urls?.length&&!body.video_urls?.length&&!body.audio_urls?.length)throw new Error("This Reference-to-Video route requires at least one reference asset");
      if(route.mode==="edit"&&!body.video_urls?.length)throw new Error("This Video Edit route requires one source video URL");

      const createRes=await fetch(endpoint,{method:"POST",headers:authHeaders(),body:JSON.stringify({model,...body})});
      const createData=await readJson(createRes);
      if(!createRes.ok)throw new Error(createData?.error?.message||createData?.message||`EvoLink HTTP ${createRes.status}`);
      const taskId=getTaskId(createData);if(!taskId)throw new Error("EvoLink did not return a task ID");

      const deadline=Date.now()+900000;
      while(Date.now()<deadline){
        const taskRes=await fetch(taskEndpoint+encodeURIComponent(taskId),{method:"GET",headers:authHeaders()});
        const taskData=await readJson(taskRes);
        if(!taskRes.ok)throw new Error(taskData?.error?.message||taskData?.message||`EvoLink task HTTP ${taskRes.status}`);
        const url=extractUrl(taskData);if(url)return {url,taskId,raw:taskData,model};
        const status=statusOf(taskData);
        if(["failed","error","cancelled","canceled"].includes(status))throw new Error(taskData?.error?.message||taskData?.message||"EvoLink video task failed");
        if(["completed","complete","succeeded","success","done"].includes(status))throw new Error("EvoLink completed the task without returning a video URL");
        await new Promise(r=>setTimeout(r,2500));
      }
      throw new Error("EvoLink task timed out");
    };
    return true;
  };
  if(!boot()){
    let tries=0;const t=setInterval(()=>{if(boot()||++tries>120)clearInterval(t);},50);
  }
})();

/* KOSMIC KAT — EvoLink adapter fallback
 * Defines the unified async video adapter only when the existing application
 * has not already provided one. Seedance 2.5 uses EvoLink only.
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
      const candidates=[];
      const add=v=>{if(typeof v==="string"&&/^https?:\/\//i.test(v))candidates.push(v);};
      add(data?.video_url);add(data?.download_url);add(data?.url);
      add(data?.output?.video_url);add(data?.output?.url);
      add(data?.result?.video_url);add(data?.result?.url);
      add(data?.results?.video_url);add(data?.results?.url);
      const arrays=[data?.results,data?.result,data?.output?.results,data?.data?.results,data?.data?.output];
      arrays.forEach(list=>{
        if(Array.isArray(list))list.forEach(item=>{add(item);add(item?.url);add(item?.video_url);add(item?.download_url);});
      });
      return candidates[0]||null;
    };
    const getTaskId=data=>data?.id||data?.task_id||data?.task?.id||data?.data?.id||null;
    const statusOf=data=>String(data?.status||data?.state||data?.task_info?.status||"").toLowerCase();
    const errorMessage=data=>{
      const e=data?.error;
      if(typeof e==="string")return e;
      return e?.message||e?.detail||data?.message||data?.detail||data?.task_info?.error?.message||data?.task_info?.error||null;
    };

    window.generateEvoLinkVideo=async function(model,prompt,options={}){
      const route=api.index[model];
      if(!route)throw new Error("Unsupported EvoLink video model: "+model);
      if(genericBlocked.has(model))throw new Error("This EvoLink route requires its specialized generator path");
      const body={};
      if(prompt)body.prompt=prompt;
      ["aspect_ratio","quality","output_format","generate_audio","content_filter","web_search","image_urls","video_urls","audio_urls","callback_url","mask_url","model_params"].forEach(k=>{
        const v=options[k];if(v!==undefined&&v!==null&&v!==""&&(!Array.isArray(v)||v.length))body[k]=v;
      });
      if(options.duration!==undefined&&options.duration!==null&&options.duration!==""){
        body.duration=(options.duration==="auto"||options.duration===-1)?-1:Number(options.duration);
        if(!Number.isFinite(body.duration))throw new Error("Invalid duration value");
      }
      if(route.mode==="image"&&!body.image_urls?.length)throw new Error("This Image-to-Video route requires at least one image URL");
      if(route.mode==="reference"&&!body.image_urls?.length&&!body.video_urls?.length&&!body.audio_urls?.length)throw new Error("This Reference-to-Video route requires at least one reference asset");
      if((route.mode==="edit"||route.mode==="extend")&&!body.video_urls?.length)throw new Error(`This ${route.mode===`edit`?`Video Edit`:`Video Extend`} route requires one source video URL`);

      const createRes=await fetch(endpoint,{method:"POST",headers:authHeaders(),body:JSON.stringify({model,...body})});
      const createData=await readJson(createRes);
      if(!createRes.ok)throw new Error(errorMessage(createData)||`EvoLink HTTP ${createRes.status}`);
      const taskId=getTaskId(createData);if(!taskId)throw new Error("EvoLink did not return a task ID");

      const deadline=Date.now()+900000;
      while(Date.now()<deadline){
        const taskRes=await fetch(taskEndpoint+encodeURIComponent(taskId),{method:"GET",headers:authHeaders()});
        const taskData=await readJson(taskRes);
        if(!taskRes.ok)throw new Error(errorMessage(taskData)||`EvoLink task HTTP ${taskRes.status}`);
        const url=extractUrl(taskData);if(url)return {url,taskId,raw:taskData,model};
        const status=statusOf(taskData);
        if(["failed","error","cancelled","canceled"].includes(status)){
          const detail=errorMessage(taskData)||"EvoLink video task failed";
          throw new Error(`${detail} [task ${taskId}]`);
        }
        if(["completed","complete","succeeded","success","done"].includes(status)){
          throw new Error(`EvoLink task ${taskId} completed but no video URL was returned. Inspect the task response/results.`);
        }
        await new Promise(r=>setTimeout(r,2500));
      }
      throw new Error(`EvoLink task ${taskId} timed out`);
    };
    return true;
  };
  if(!boot()){
    let tries=0;const t=setInterval(()=>{if(boot()||++tries>120)clearInterval(t);},50);
  }
})();

/* Kosmic Engine selected-brain vision bridge. Routes reference-image analysis through
   the Engine's chosen Grok / Kimi brain. (Extracted from the retired engine-glass-ui.js,
   which was never loaded — so this routing was silently inactive before.) */
(function(){
  "use strict";
  let tries=0;
  function installVisionBridge(){
    const original=window.callAiVision;if(typeof original!=="function"||original.__kosmicEngineVisionRouter)return true;
    const routed=async function(refs,prompt,system){
      const d=window.S&&S.directorChat?S.directorChat:null,draft=d&&d.draft?d.draft:null,provider=draft&&draft.brainModel,model=draft&&d.engineModel;
      if(!d||!d.productionId||!model||!(provider==="grok"||provider==="kimi"))return original.apply(this,arguments);
      const keyName=provider==="grok"?"api_xai":"api_evolink",key=typeof window.gs==="function"?String(gs(keyName,"")).trim():"";
      if(!key)throw new Error(`${provider==="grok"?"Grok":"Kimi"} API key is missing for the selected Kosmic Engine model.`);
      const images=(Array.isArray(refs)?refs:[]).map(x=>x&&x.dataUrl).filter(Boolean);if(!images.length)return original.apply(this,arguments);
      const content=[...images.map(url=>({type:"image_url",image_url:{url,detail:"high"}})),{type:"text",text:String(prompt||"")}];
      const endpoint=provider==="grok"?"https://api.x.ai/v1/chat/completions":"https://direct.evolink.ai/v1/chat/completions";
      const body={model,messages:[...(system?[{role:"system",content:String(system)}]:[]),{role:"user",content}],max_tokens:2000,reasoning_effort:provider==="grok"?"high":"max"};
      const res=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data?.error?.message||data?.message||`Selected Engine vision request failed (${res.status})`);
      const text=data?.choices?.[0]?.message?.content;if(typeof text==="string")return text;if(Array.isArray(text))return text.map(x=>x?.text||"").join("").trim();throw new Error("Selected Engine vision model returned no text response.");
    };
    routed.__kosmicEngineVisionRouter=true;window.callAiVision=routed;return true;
  }
  function boot(){
    if(installVisionBridge())return;
    if(++tries<20)setTimeout(boot,1000);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

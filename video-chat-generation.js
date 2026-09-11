/* KOSMIC KAT — Video chat generation bridge
 * CHAT = intent/context -> existing V3 control -> existing EvoLink execution.
 * No provider endpoint, credential store, or second generation engine is created here.
 */
(function installKosmicVideoChatGeneration(){
  "use strict";
  if(window.__kosmicVideoChatGenerationInstalled)return;
  window.__kosmicVideoChatGenerationInstalled=true;

  const st=()=>window.__kosmicVideoChatState;
  const esc=v=>String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));
  let running=false,tappedAdapter=null,lastAdapterResult=null;

  function css(){
    if(document.getElementById("kk-video-output-css"))return;
    const s=document.createElement("style");s.id="kk-video-output-css";
    s.textContent=`
      .kkvc-output{margin-top:9px;border:1px solid var(--glass-brd,rgba(61,31,122,.12));border-radius:16px;overflow:hidden;background:rgba(255,255,255,.68);box-shadow:0 10px 30px rgba(61,31,122,.07)}
      .kkvc-output video{display:block;width:100%;max-height:430px;background:#09080e}
      .kkvc-output-body{padding:10px}.kkvc-output-meta{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}.kkvc-output-pill{padding:4px 7px;border-radius:999px;background:rgba(98,64,176,.08);font-size:8px;font-weight:800;color:var(--textm,#5a4880)}
      .kkvc-output-actions{display:flex;gap:6px;flex-wrap:wrap}.kkvc-output-actions button,.kkvc-output-actions a{border:1px solid var(--glass-brd,rgba(61,31,122,.12));background:rgba(255,255,255,.7);color:var(--textm,#5a4880);border-radius:9px;padding:7px 9px;font-size:8px;font-weight:850;text-decoration:none;cursor:pointer}.kkvc-output-actions button:hover,.kkvc-output-actions a:hover{background:rgba(98,64,176,.08);color:var(--violet,#3d1f7a)}
      .kkvc-generating{padding:11px 13px;border-radius:14px;background:rgba(98,64,176,.06);border:1px solid rgba(98,64,176,.11);font-size:10px;color:var(--textm,#5a4880)}
    `;document.head.appendChild(s);
  }

  function render(){
    const q=st(),thread=document.getElementById("kkvcThread");if(!thread)return;
    if(!q.messages.length){thread.innerHTML=`<div class="kkvc-welcome"><h2>What are we making?</h2><p>Start with the scene, action, mood, camera, or a rough idea. Add a reference when appearance matters. The conversation stays in context.</p></div>`;return;}
    thread.innerHTML=q.messages.map(m=>{
      const refs=Array.isArray(m.meta?.references)&&m.meta.references.length?`<div class="kkvc-refrow">${m.meta.references.map(r=>`<div class="kkvc-ref"><img src="${esc(r.url)}" alt=""><span>${esc(r.name||"Reference")}</span></div>`).join("")}</div>`:"";
      const o=m.meta?.output;
      const output=o?`<div class="kkvc-output"><video src="${esc(o.resultUrl)}" controls playsinline preload="metadata"></video><div class="kkvc-output-body"><div class="kkvc-output-meta"><span class="kkvc-output-pill">${esc(o.model||o.route)}</span><span class="kkvc-output-pill">${esc(o.duration)}s</span><span class="kkvc-output-pill">${esc(o.quality)}</span><span class="kkvc-output-pill">${esc(o.aspect)}</span><span class="kkvc-output-pill">${o.audio?"Audio on":"Audio off"}</span></div><div class="kkvc-output-actions"><a href="${esc(o.resultUrl)}" target="_blank" rel="noopener" download>Download</a><button type="button" data-kkvc-ref-output="${esc(o.id)}">Use as reference</button><button type="button" data-kkvc-edit-output="${esc(o.id)}">Edit</button><button type="button" data-kkvc-extend-output="${esc(o.id)}">Extend</button><button type="button" data-kkvc-regenerate="${esc(o.id)}">Regenerate</button></div></div></div>`:"";
      const pending=m.meta?.generationPending?`<div class="kkvc-generating">Generating through the selected Video route…</div>`:"";
      return `<div class="kkvc-msg ${m.role==="user"?"user":"assistant"}"><div class="kkvc-avatar">${m.role==="user"?"You":"✦"}</div><div><div class="kkvc-bubble">${esc(m.content)}</div>${refs}${pending}${output}</div></div>`;
    }).join("");
    thread.querySelectorAll("[data-kkvc-ref-output]").forEach(b=>b.addEventListener("click",()=>useOutput(b.dataset.kkvcRefOutput)));
    thread.querySelectorAll("[data-kkvc-edit-output]").forEach(b=>b.addEventListener("click",()=>prepareRoute(b.dataset.kkvcEditOutput,"seedance-2.5-video-edit","Edit this generated video while preserving its core visual identity.")));
    thread.querySelectorAll("[data-kkvc-extend-output]").forEach(b=>b.addEventListener("click",()=>prepareRoute(b.dataset.kkvcExtendOutput,"seedance-2.5-video-extend","Extend this generated video naturally from its final moment.")));
    thread.querySelectorAll("[data-kkvc-regenerate]").forEach(b=>b.addEventListener("click",()=>regenerate(b.dataset.kkvcRegenerate)));
    thread.scrollTop=thread.scrollHeight;
  }

  function currentMeta(){
    const v=window.__kosmicVideoV3State||{},route=v.route||"seedance-2.5-text-to-video",item=window.KOSMIC_EVOLINK_VIDEO?.index?.[route];
    return {route,model:item?.model?.name||item?.name||route,duration:v.duration??null,quality:v.quality??null,aspect:v.aspect??null,audio:v.audio!==false};
  }

  function installAdapterTap(){
    if(tappedAdapter||typeof window.generateEvoLinkVideo!=="function")return;
    const original=window.generateEvoLinkVideo;
    const wrapped=async function(...args){const result=await original.apply(this,args);lastAdapterResult=result||null;return result;};
    wrapped.__kosmicVideoChatWrapped=true;window.generateEvoLinkVideo=wrapped;tappedAdapter=wrapped;
  }

  function waitForV3(baseline){
    return new Promise((resolve,reject)=>{
      const started=Date.now();
      const tick=()=>{
        const v=window.__kosmicVideoV3State;
        if(!v){reject(new Error("Video Canvas V3 state is unavailable."));return;}
        if(!v.busy&&Array.isArray(v.history)&&v.history.length>baseline){const item=v.history[0];if(item?.error)reject(new Error(item.error));else if(item?.url)resolve(item);else reject(new Error("Video generation finished without a result URL."));return;}
        if(Date.now()-started>900000){reject(new Error("Video generation timed out."));return;}setTimeout(tick,350);
      };tick();
    });
  }

  function contextualPrompt(prompt){
    const q=st();
    const prior=[...(q.messages||[])].filter(m=>m.role==="user"&&m.content).slice(-2).map(m=>m.content.trim()).filter(Boolean);
    if(!prior.length)return prompt;
    const previous=prior[prior.length-1];
    if(previous===prompt)return prompt;
    return `Continue the current video conversation. Preserve the established subject, setting and visual continuity from the previous instruction: ${previous}\n\nNew instruction: ${prompt}`;
  }

  async function run(prompt){
    const q=st(),v=window.__kosmicVideoV3State;
    if(running||q.activeGeneration?.status==="generating")return null;
    if(!v)throw new Error("Video Canvas V3 is not ready yet.");
    if(v.busy)throw new Error("Another video generation is already running.");
    if(typeof gs==="function"&&!String(gs("api_evolink","")).trim())throw new Error("Add an EvoLink API key in the existing global Settings first.");
    const button=document.getElementById("kkv3Generate");if(!button)throw new Error("Video Canvas V3 generation control is not mounted yet.");

    running=true;lastAdapterResult=null;
    const meta=currentMeta(),baseline=Array.isArray(v.history)?v.history.length:0,executionPrompt=contextualPrompt(prompt);
    q.setActiveGeneration({status:"generating",prompt,executionPrompt,route:meta.route,model:meta.model,startedAt:Date.now(),taskId:null});
    const pending=q.addMessage("assistant","Working on your video…",{generationPending:true});render();
    try{
      installAdapterTap();
      v.prompt=executionPrompt;
      q.syncLegacy&&q.syncLegacy();
      button.click();
      const result=await waitForV3(baseline),taskId=lastAdapterResult?.taskId||null;
      const output={id:"vout_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),prompt,executionPrompt,route:result.route||meta.route,model:result.model||meta.model,duration:result.duration??meta.duration,quality:result.quality??meta.quality,aspect:result.aspect??meta.aspect,audio:meta.audio,references:q.references.map(r=>({id:r.id,kind:r.kind,name:r.name,url:r.url})),taskId,resultUrl:result.url,timestamp:Date.now(),status:"completed"};
      q.messages=q.messages.filter(m=>m.id!==pending.id);q.addMessage("assistant","Your video is ready.",{output});q.outputs=Array.isArray(q.outputs)?q.outputs:[];q.outputs.unshift(output);q.outputs=q.outputs.slice(0,30);q.setActiveGeneration(Object.assign({},output,{status:"completed"}));render();return output;
    }catch(err){
      q.messages=q.messages.filter(m=>m.id!==pending.id);q.addMessage("assistant",err?.message||String(err),{generationError:true});q.setActiveGeneration({status:"error",prompt,executionPrompt,route:meta.route,model:meta.model,error:err?.message||String(err),finishedAt:Date.now(),taskId:lastAdapterResult?.taskId||null});render();throw err;
    }finally{running=false;}
  }

  function submit(){
    const q=st(),input=document.getElementById("kkvcInput");if(!input||running||q.activeGeneration?.status==="generating")return;
    const text=input.value.trim();if(!text&&!q.references.length)return;
    const refs=q.references.map(r=>({id:r.id,url:r.url,name:r.name,kind:r.kind}));q.addMessage("user",text||"Use these references for the next generation.",{references:refs});
    q.composerDraft="";input.value="";input.style.height="auto";q.syncLegacy();render();run(text||"Use the attached references as the visual basis for the next video.").catch(()=>{});
  }

  function useOutput(id){const q=st(),o=(q.outputs||[]).find(x=>x.id===id);if(!o)return;q.addReference({kind:"video",url:o.resultUrl,name:"Generated video"});q.syncLegacy();const input=document.getElementById("kkvcInput");if(input)input.focus();}
  function regenerate(id){const q=st(),o=(q.outputs||[]).find(x=>x.id===id);if(!o)return;const input=document.getElementById("kkvcInput");if(input){input.value=o.prompt||"";input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();}run(o.prompt).catch(()=>{});}

  function prepareRoute(id,route,instruction){
    const q=st(),o=(q.outputs||[]).find(x=>x.id===id),v=window.__kosmicVideoV3State,index=window.KOSMIC_EVOLINK_VIDEO?.index||{};
    if(!o||!v)return;
    if(!index[route]){q.addMessage("assistant",`The ${route} route is unavailable in the current Video catalog.`,{generationError:true});render();return;}
    v.route=route;v.videos=[{url:o.resultUrl,name:"Generated video"}];q.addReference({kind:"video",url:o.resultUrl,name:"Generated video"});q.composerDraft=instruction;q.syncLegacy();
    const input=document.getElementById("kkvcInput");if(input){input.value=instruction;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();}
    if(window.__kosmicVideoDirector?.open)window.__kosmicVideoDirector.open();
  }

  function intercept(e){const target=e.target?.closest?.("#kkvcSend");if(!target)return;e.preventDefault();e.stopImmediatePropagation();submit();}
  function boot(){css();document.addEventListener("click",intercept,true);window.__kosmicVideoChatGenerate=run;}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
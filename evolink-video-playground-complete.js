/* KOSMIC KAT — EvoLink Video Playground
 * Phase 11: complete model + route + schema explorer.
 *
 * Non-destructive: this surface is an inspector/picker for the existing
 * playground. It does not replace the generator, settings sheet, or native
 * model routing. Selecting a route syncs an existing model <select> when one
 * is present; otherwise it changes inspector state only.
 */
(function installEvoLinkPlaygroundComplete(){
  "use strict";
  if(window.__kosmicEvoPlaygroundComplete)return;
  window.__kosmicEvoPlaygroundComplete=true;

  const esc=s=>String(s??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));

  function selectedRoute(){
    const api=window.KOSMIC_EVOLINK_VIDEO;
    return api?.index?.[document.getElementById("evoPgModel")?.value]||null;
  }
  function addUrlRow(containerId,field,label){
    const box=document.getElementById(containerId);if(!box)return;
    const row=document.createElement("div");row.className="evo-url-row";
    row.innerHTML=`<input class="f-input evo-url" data-field="${esc(field)}" placeholder="${esc(label)} URL" style="flex:1"><button type="button" class="btn btn-ghost btn-sm evo-remove-url">×</button>`;
    row.querySelector(".evo-remove-url").onclick=()=>row.remove();box.appendChild(row);
  }
  function selectedUrls(containerId,field){return [...document.querySelectorAll(`#${containerId} .evo-url[data-field="${field}"]`)].map(x=>x.value.trim()).filter(Boolean);}

  function renderSchemaControls(route){
    const s=route.model.schema||{},duration=s.duration,qualities=s.quality||[],aspects=s.aspect||[],mode=route.mode;
    const discrete={
      "veo-3.1-fast-generate-preview":[4,6,8],"veo-3.1-generate-preview":[4,6,8],"veo3.1-fast-extend":[4,6,8],
      "sora-2-preview":[4,8,12],"sora-2-image-to-video":[4,8,12],"kling-v3-motion-control":[3,4,5,6,7,8,9,10,11,12,13,14,15],
      "MiniMax-Hailuo-2.3-Fast":[6,10],"MiniMax-Hailuo-2.3":[6,10],"MiniMax-Hailuo-02":[6,10]
    };
    const durationOptions=duration?(discrete[route.id]||Array.from({length:Math.max(0,Math.min(30,duration[1])-duration[0]+1)},(_,i)=>duration[0]+i)):[];
    return `
      <div class="evo-field-grid">
        <label class="f-group"><span class="f-label">Aspect Ratio</span>${aspects.length?`<select id="evoPgAspect" class="f-select">${aspects.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join("")}</select>`:`<div class="evo-static-field">Provider controlled</div>`}</label>
        <label class="f-group"><span class="f-label">Duration</span>${duration?`<select id="evoPgDuration" class="f-select">${durationOptions.map(v=>`<option value="${v}">${v}s</option>`).join("")}${!durationOptions.length?`<option value="auto">Auto</option>`:""}</select>`:`<div class="evo-static-field">Provider controlled</div>`}</label>
        <label class="f-group"><span class="f-label">Quality</span>${qualities.length?`<select id="evoPgQuality" class="f-select">${qualities.map(q=>`<option value="${esc(q)}">${esc(q)}</option>`).join("")}</select>`:`<div class="evo-static-field">Provider default</div>`}</label>
        <div class="evo-static-field">MP4 output</div>
      </div>
      <div class="evo-toggle-row">${s.audio?`<label><input type="checkbox" id="evoPgAudio" checked> Generate Audio</label>`:""}${s.webSearch?`<label><input type="checkbox" id="evoPgWeb"> Web Search</label>`:""}</div>
      ${mode==="motion"?`<div class="evo-advanced-grid"><label class="f-group"><span class="f-label">Character Orientation</span><select id="evoPgOrientation" class="f-select"><option value="image">Image</option><option value="video">Video</option></select></label><label><input type="checkbox" id="evoPgKeepSound" checked> Keep source sound</label></div>`:""}
      ${mode==="upscale"?`<label class="f-group"><span class="f-label">Upscale Factor</span><select id="evoPgUpscale" class="f-select"><option value="1">1× Enhance</option><option value="2" selected>2×</option><option value="4">4×</option></select></label>`:""}
      ${mode==="avatar"?`<div class="evo-advanced-grid"><label><input type="checkbox" id="evoPgAutoMask" checked> Auto Mask</label><label><input type="checkbox" id="evoPgSubjectCheck"> Subject Check</label><label class="f-group"><span class="f-label">Audio URL</span><input class="f-input" id="evoPgAudioUrl" placeholder="https://…/voice.mp3"></label></div>`:""}
      <div class="evo-ref-grid">
        ${mode!=="text"?`<div class="evo-ref-block"><div class="evo-ref-title">${mode==="avatar"?"Person Image":"Image References"}</div><div id="evoPgImages"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgImages','image_urls','Image')">+ Image URL</button></div>`:""}
        ${["reference","edit","extend","motion","upscale","first_last"].includes(mode)?`<div class="evo-ref-block"><div class="evo-ref-title">Video Input</div><div id="evoPgVideos"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgVideos','video_urls','Video')">+ Video URL</button></div>`:""}
        ${mode==="reference"&&s.refs?.audios?`<div class="evo-ref-block"><div class="evo-ref-title">Audio References</div><div id="evoPgAudios"></div><button type="button" class="btn btn-ghost btn-sm" onclick="window.__evoAddUrl('evoPgAudios','audio_urls','Audio')">+ Audio URL</button></div>`:""}
      </div>`;
  }

  async function submitPlayground(){
    const model=document.getElementById("evoPgModel")?.value,route=selectedRoute(),resultEl=document.getElementById("evoPgResult"),btn=document.getElementById("evoPgGenerate");
    if(!model||!route)return;if(btn){btn.disabled=true;btn.textContent="Generating…";}
    resultEl.innerHTML='<div class="evo-status">Submitting EvoLink task…</div>';
    try{
      const opts={aspect_ratio:document.getElementById("evoPgAspect")?.value,duration:document.getElementById("evoPgDuration")?.value,quality:document.getElementById("evoPgQuality")?.value,generate_audio:document.getElementById("evoPgAudio")?.checked,web_search:document.getElementById("evoPgWeb")?.checked,image_urls:selectedUrls("evoPgImages","image_urls"),video_urls:selectedUrls("evoPgVideos","video_urls"),audio_urls:selectedUrls("evoPgAudios","audio_urls"),audio_url:document.getElementById("evoPgAudioUrl")?.value.trim(),model_params:{}};
      if(document.getElementById("evoPgUpscale"))opts.model_params.upscale_factor=document.getElementById("evoPgUpscale").value;
      if(document.getElementById("evoPgOrientation"))opts.model_params.character_orientation=document.getElementById("evoPgOrientation").value;
      if(document.getElementById("evoPgAutoMask"))opts.model_params.auto_mask=document.getElementById("evoPgAutoMask").checked;
      if(document.getElementById("evoPgSubjectCheck"))opts.model_params.subject_check=document.getElementById("evoPgSubjectCheck").checked;
      if(document.getElementById("evoPgKeepSound"))opts.model_params.keep_sound=document.getElementById("evoPgKeepSound").checked;
      const result=await window.generateEvoLinkVideo(model,document.getElementById("evoPgPrompt")?.value.trim()||"",opts);
      resultEl.innerHTML=`<video src="${esc(result.url)}" controls playsinline style="width:100%;max-height:420px;border-radius:16px;object-fit:contain;background:#0b0714"></video><div class="evo-result-meta">${esc(route.model.name)} · ${esc(route.label)} · task ${esc(result.taskId||"")}</div>`;
      try{if(typeof createVideoAsset==="function")createVideoAsset(result.url,document.getElementById("evoPgPrompt")?.value.trim()||"","",{model,providerLabel:"EvoLink"});}catch(_e){}
    }catch(err){resultEl.innerHTML=`<div class="evo-error">${esc(err.message||String(err))}</div>`;}
    finally{if(btn){btn.disabled=false;btn.textContent="Generate →";}}
  }

  function openPlayground(){
    document.getElementById("evoVideoPlaygroundModal")?.remove();
    const api=window.KOSMIC_EVOLINK_VIDEO;if(!api?.catalog?.length)return;
    const modal=document.createElement("div");modal.id="evoVideoPlaygroundModal";
    modal.innerHTML=`<div class="evo-playground-backdrop" onclick="window.__evoClosePlayground()"></div><div class="evo-playground-sheet"><div class="evo-playground-head"><div><div class="evo-kicker">EVOLINK VIDEO</div><div class="evo-title">Unified Video Playground</div><div class="evo-subtitle">All ${api.catalog.length} live EvoLink video model cards, with route-aware playground controls.</div></div><button class="btn btn-ghost btn-sm" onclick="window.__evoClosePlayground()">✕</button></div><form id="evoPlaygroundForm"><div class="evo-field-grid"><label class="f-group"><span class="f-label">Model</span><select id="evoPgModel" class="f-select"></select></label><label class="f-group"><span class="f-label">Route</span><select id="evoPgRoute" class="f-select"></select></label></div><div id="evoPgControls"></div><label class="f-group"><span class="f-label">Prompt</span><textarea id="evoPgPrompt" class="f-input" rows="4" placeholder="Describe the shot, motion, camera, environment and subject behavior…"></textarea></label><div class="evo-actions"><button id="evoPgGenerate" type="button" class="btn btn-primary">Generate →</button><div class="evo-api-note">Uses your existing <b>api_evolink</b> setting. API keys stay browser-local.</div></div></form><div id="evoPgResult" class="evo-result">Choose a model to inspect its schema.</div></div>`;
    document.body.appendChild(modal);

    const modelSel=modal.querySelector("#evoPgModel"),routeSel=modal.querySelector("#evoPgRoute"),groups={};
    api.catalog.forEach(m=>(groups[m.group]||(groups[m.group]=[])).push(m));
    Object.entries(groups).forEach(([g,models])=>{const og=document.createElement("optgroup");og.label=g;models.forEach(m=>{const op=document.createElement("option");op.value=m.routes[0]?.id||m.id;op.textContent=`${m.name} · ${m.provider}`;og.appendChild(op);});modelSel.appendChild(og);});

    function refresh(){
      const route=api.index[modelSel.value];if(!route)return;
      routeSel.innerHTML=route.model.routes.map(r=>`<option value="${esc(r.id)}">${esc(r.label||r.mode||r.id)}</option>`).join("");
      routeSel.value=route.id;
      modal.querySelector("#evoPgControls").innerHTML=renderSchemaControls(route);
    }
    modelSel.onchange=refresh;
    routeSel.onchange=()=>{modelSel.value=routeSel.value;refresh();};
    refresh();
    modal.querySelector("#evoPgGenerate").onclick=submitPlayground;
  }

  window.__evoAddUrl=addUrlRow;
  window.__evoOpenPlayground=openPlayground;
  window.__evoClosePlayground=()=>document.getElementById("evoVideoPlaygroundModal")?.remove();
})();

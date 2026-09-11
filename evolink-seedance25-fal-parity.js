/* KOSMIC KAT — Seedance 2.5 EvoLink / legacy Fal playground parity
 * Seedance 2.5 only. Reuses the existing Video Canvas generation shell,
 * but owns the visible Seedance 2.5 controls and reference upload surface.
 * Other models, API-key storage and auth are untouched.
 */
(function installSeedance25FalParity(){
  "use strict";
  if(window.__kosmicSeedance25FalParity)return;
  window.__kosmicSeedance25FalParity=true;

  const ROUTES={
    "seedance-2.5-text-to-video":{label:"Text to Video",short:"T2V",mode:"text"},
    "seedance-2.5-image-to-video":{label:"Image to Video",short:"I2V",mode:"image"},
    "seedance-2.5-reference-to-video":{label:"Reference to Video",short:"R2V",mode:"reference"},
    "seedance-2.5-video-edit":{label:"Video Edit",short:"EDIT",mode:"edit"},
    "seedance-2.5-video-extend":{label:"Video Extend",short:"EXTEND",mode:"extend"}
  };
  const IDS=Object.keys(ROUTES), QUALITY=["480p","720p","1080p"], ASPECTS=["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"];
  const $=id=>document.getElementById(id), isSeed25=id=>IDS.includes(String(id||""));
  const state=()=>window.__kosmicSeedance25ParityState||(window.__kosmicSeedance25ParityState={route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",audio:true,content:true,webSearch:false,refs:{images:0,videos:0,audios:0}});
  const currentModel=()=>$("vcModel")?.value||"";
  const hasEvoKey=()=>!!String(typeof gs==="function"?gs("api_evolink",""):"").trim();
  const refs=()=>{
    const s=window.S||{};
    const pick=v=>(Array.isArray(v)?v:[]).map(x=>typeof x==="string"?{dataUrl:x}:x).filter(x=>x?.dataUrl||x?.url);
    return{images:pick(s.vcMultiImages),videos:pick(s.vcMultiVideos),audios:pick(s.vcMultiAudios)};
  };
  function currentCounts(){const r=refs();return{images:r.images.length,videos:r.videos.length,audios:r.audios.length};}
  function saveRefs(){if(typeof saveSetting==="function")saveSetting("vc_multi_refs",{images:(window.S?.vcMultiImages||[]),videos:(window.S?.vcMultiVideos||[]),audios:(window.S?.vcMultiAudios||[])});}

  function ensureArrays(){
    const s=window.S||{};
    s.vcMultiImages=Array.isArray(s.vcMultiImages)?s.vcMultiImages:[];
    s.vcMultiVideos=Array.isArray(s.vcMultiVideos)?s.vcMultiVideos:[];
    s.vcMultiAudios=Array.isArray(s.vcMultiAudios)?s.vcMultiAudios:[];
    window.S=s;
  }

  function syncNativeControls(s){
    if($("vcDuration"))$("vcDuration").value=String(s.duration);
    if($("vcRes"))$("vcRes").value=s.quality;
    if($("vcRatio"))$("vcRatio").value=s.aspect;
  }

  function hideLegacyControl(id){
    const el=$(id);if(!el)return;
    el.classList.add("evo25-legacy-hidden");
    el.setAttribute("aria-hidden","true");
    el.tabIndex=-1;
    const host=el.closest("label,.f-group,.vc-control-group,.control-group,.field,[data-video-canvas-control]");
    if(host)host.classList.add("evo25-legacy-hidden");
  }
  function hideLegacySeed25UI(){
    ["vcDuration","vcRes","vcRatio","evo25DurationRange","evo25DurationNumber","evo25Quality","evo25Audio","evo25Content","evo25WebSearch"].forEach(hideLegacyControl);
  }

  function hideFalWarnings(){
    if(!isSeed25(currentModel()))return;
    document.querySelectorAll("*").forEach(el=>{
      const text=(el.textContent||"").trim();
      if(!text||el.children.length>8)return;
      if(/add\s+a\s+fal(?:\.ai|-ai)?\s+api\s+key\s+in\s+settings/i.test(text) || (/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text)&&/api\s*key|playground/i.test(text))){
        el.hidden=true;el.setAttribute("aria-hidden","true");
      }
    });
  }

  function removeLegacyFalSeed25(){
    document.querySelectorAll("select option").forEach(o=>{
      const value=o.value||"",text=o.textContent||"";
      if(/^(fal-ai\/|bytedance\/).*seedance-2\.5/i.test(value)||(/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text)))o.remove();
    });
    document.querySelectorAll("[data-model],[data-route],[data-playground-model],button,a").forEach(el=>{
      const value=el.getAttribute("data-model")||el.getAttribute("data-route")||el.getAttribute("data-playground-model")||"";
      const text=(el.textContent||"").trim();
      if(/^(fal-ai\/|bytedance\/).*seedance-2\.5/i.test(value)||(/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text))){el.hidden=true;el.setAttribute("aria-hidden","true");}
    });
  }

  function uploadCard(type,label,accept,limit){
    return `<label class="evo25-upload-card"><input class="evo25-file-input" data-evo25-upload="${type}" type="file" accept="${accept}" ${type==="image"?"multiple":""} hidden><span class="evo25-upload-icon">${type==="image"?"▧":type==="video"?"▶":"◌"}</span><strong>Upload ${label}</strong><small>${limit}</small></label>`;
  }

  function renderRefs(s){
    const r=refs(),route=s.route,mode=ROUTES[route]?.mode||"text";
    const disabled=(mode==="text");
    return `<div class="evo25-upload-grid ${disabled?"is-disabled":""}">
      ${uploadCard("image","images","image/*","1–2 for I2V · up to 30 for R2V")}
      ${uploadCard("video","video","video/*","1 for Edit/Extend · up to 10 for R2V")}
      ${uploadCard("audio","audio","audio/*","up to 10 reference tracks")}
    </div>
    <div class="evo25-ref-chips">
      ${disabled?`<span class="evo25-ref-empty">Text-to-Video does not use reference files.</span>`:""}
      ${r.images.map((x,i)=>`<span class="evo25-ref-chip image"><b>IMG</b>${escapeHtml(x.name||`Image ${i+1}`)}<button type="button" data-remove-ref="image:${i}" aria-label="Remove image">×</button></span>`).join("")}
      ${r.videos.map((x,i)=>`<span class="evo25-ref-chip video"><b>VID</b>${escapeHtml(x.name||`Video ${i+1}`)}<button type="button" data-remove-ref="video:${i}" aria-label="Remove video">×</button></span>`).join("")}
      ${r.audios.map((x,i)=>`<span class="evo25-ref-chip audio"><b>AUD</b>${escapeHtml(x.name||`Audio ${i+1}`)}<button type="button" data-remove-ref="audio:${i}" aria-label="Remove audio">×</button></span>`).join("")}
      ${!r.images.length&&!r.videos.length&&!r.audios.length&&!disabled?`<span class="evo25-ref-empty">No reference media uploaded yet.</span>`:""}
    </div>`;
  }

  function escapeHtml(v){return String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}

  function pricingEstimate(s){
    /* EvoLink Seedance 2.5 public rates, refreshed 2026-09-11:
     * output-only routes: 480p .138/s, 720p .296/s, 1080p .532/s (current offer)
     * video-input routes: 480p .084/s, 720p .180/s, 1080p .324/s, billed input+output.
     */
    const route=ROUTES[s.route]?.mode||"text";
    const videoInput=route==="edit"||route==="extend"||(route==="reference"&&refs().videos.length>0);
    const rates=videoInput?{480p:.084,720p:.180,1080p:.324}:{480p:.138,720p:.296,1080p:.532};
    const rate=rates[s.quality]||rates["720p"],output=Math.max(4,Math.min(30,Number(s.duration)||5));
    let input=0;
    if(videoInput){
      const configured=Number($("evo25InputVideoDuration")?.value||0);
      input=Number.isFinite(configured)?Math.max(0,configured):0;
    }
    const estimated=(output+Math.max(input,output)*(videoInput?1:0))*rate;
    const text=videoInput?`≈ $${estimated.toFixed(3)} · ${output}s output${input?` + ${input.toFixed(1)}s input billed`:" · input duration needed for exact total"}`:`≈ $${estimated.toFixed(3)} · ${output}s × $${rate.toFixed(3)}/s`;
    return {text,videoInput,rate,output,input};
  }

  function renderPricing(s){
    const p=pricingEstimate(s);
    return `<section class="evo25-card evo25-pricing-card"><div class="evo25-label"><span>Live cost estimate</span><small>${escapeHtml(s.quality)} · ${escapeHtml(String(s.duration))}s</small></div><div class="evo25-price-main">${escapeHtml(p.text)}</div>${p.videoInput?`<label class="evo25-field evo25-input-duration"><span>Input video duration <b>seconds</b></span><input id="evo25InputVideoDuration" type="number" min="0" max="600" step="0.1" value="${p.input||""}" placeholder="Auto / enter seconds"></label>`:""}<p class="evo25-note">Estimate uses EvoLink's current Seedance 2.5 rate for the selected route, resolution and duration. Audio has no extra generation fee; web search is a separate $0.0006/request add-on.</p></section>`;
  }

  function setRoute(route){
    if(!isSeed25(route))return;
    const s=state();s.route=route;
    const model=$("vcModel");
    if(model&&model.value!==route){model.value=route;model.dispatchEvent(new Event("change",{bubbles:true}));}
    if(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")s.aspect="adaptive";
    syncNativeControls(s);render();
    const input=$("vcChatInput");if(input)input.focus({preventScroll:true});
  }

  function addFile(type,file){
    if(!file)return;
    ensureArrays();
    const limits={image:30,video:10,audio:10},key={image:"vcMultiImages",video:"vcMultiVideos",audio:"vcMultiAudios"}[type],arr=window.S[key];
    if(arr.length>=limits[type]){toast(`Seedance 2.5 allows at most ${limits[type]} ${type} references.`,"error");return;}
    const reader=new FileReader();
    reader.onload=()=>{
      arr.push({dataUrl:reader.result,name:file.name,type:file.type,size:file.size});
      saveRefs();
      if(typeof updateVcAttachmentBar==="function")updateVcAttachmentBar();
      updateRefCounts();render();
      toast(`✓ ${file.name} added to Seedance 2.5 references`,"success");
    };
    reader.onerror=()=>toast(`Could not read ${file.name}.`,"error");
    reader.readAsDataURL(file);
  }

  function removeRef(type,index){
    ensureArrays();
    const key={image:"vcMultiImages",video:"vcMultiVideos",audio:"vcMultiAudios"}[type];
    if(!key)return;
    window.S[key].splice(index,1);saveRefs();
    if(typeof updateVcAttachmentBar==="function")updateVcAttachmentBar();
    updateRefCounts();render();
  }

  function updateRefCounts(){
    ensureArrays();
    const r=currentCounts(),st=state();st.refs=r;
    const panel=$("evoSeedanceSchemaPanel");if(!panel)return;
    panel.querySelectorAll("[data-evo25-ref-count]").forEach((el,i)=>el.textContent=[r.images,r.videos,r.audios][i]+" loaded");
  }

  function render(){
    ensureArrays();
    const panel=$("evoSeedanceSchemaPanel"),route=currentModel();
    if(!panel)return;
    if(!isSeed25(route)){panel.hidden=true;return;}
    const s=state(),info=ROUTES[route];
    s.route=route;
    s.duration=Math.max(4,Math.min(30,Number(s.duration)||5));
    s.quality=QUALITY.includes(s.quality)?s.quality:"720p";
    s.aspect=(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")?"adaptive":(ASPECTS.includes(s.aspect)?s.aspect:"16:9");
    const counts=currentCounts();s.refs=counts;
    syncNativeControls(s);hideLegacySeed25UI();
    panel.hidden=false;panel.classList.add("evo-seedance25-parity");
    panel.innerHTML=`
      <div class="evo25-shell">
        <div class="evo25-top"><div class="evo25-title"><span class="evo25-kicker">EVOLINK PLAYGROUND</span><strong>Seedance 2.5</strong><span class="evo25-sub">BytePlus · ${info.label} · EvoLink generation</span></div><span class="evo25-live ${hasEvoKey()?"ready":"needs-key"}">${hasEvoKey()?"CONNECTED":"EVOLINK KEY NEEDED"}</span></div>
        <section class="evo25-card"><div class="evo25-label"><span>Generation mode</span><small>${info.short}</small></div><div class="evo25-modes">${IDS.map(id=>`<button type="button" class="evo25-mode ${id===route?"active":""}" data-evo25-route="${id}">${ROUTES[id].label}<span>${ROUTES[id].short}</span></button>`).join("")}</div></section>
        <section class="evo25-card"><div class="evo25-label"><span>Generation settings</span><small>4–30 seconds</small></div><div class="evo25-grid"><label class="evo25-field"><span>Duration <b id="evo25DurationReadout">${s.duration}s</b></span><div class="evo25-duration"><input id="evo25DurationRange" type="range" min="4" max="30" step="1" value="${s.duration}" aria-label="Duration"><input id="evo25DurationNumber" type="number" min="4" max="30" step="1" value="${s.duration}" aria-label="Duration seconds"></div></label><label class="evo25-field"><span>Resolution</span><div class="evo25-choice-row">${QUALITY.map(x=>`<button type="button" class="evo25-choice ${x===s.quality?"active":""}" data-evo25-quality="${x}">${x}</button>`).join("")}</div></label><div class="evo25-field"><span>Aspect ratio</span><div class="evo25-pills">${ASPECTS.filter(x=>!(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")||x==="adaptive").map(x=>`<button type="button" class="evo25-pill ${x===s.aspect?"active":""}" data-evo25-aspect="${x}">${x}</button>`).join("")}</div></div></div></section>
        <section class="evo25-card"><div class="evo25-label"><span>Reference inputs</span><small>${counts.images} images · ${counts.videos} videos · ${counts.audios} audio</small></div>${renderRefs(s)}</section>
        <section class="evo25-card"><div class="evo25-label"><span>Output options</span><small>sent directly to EvoLink</small></div><div class="evo25-switches"><label class="evo25-toggle"><span>Generated audio</span><input id="evo25Audio" type="checkbox" ${s.audio?"checked":""}><i class="evo25-switch"></i></label><label class="evo25-toggle"><span>Content filter</span><input id="evo25Content" type="checkbox" ${s.content?"checked":""}><i class="evo25-switch"></i></label><label class="evo25-toggle"><span>Web search</span><input id="evo25WebSearch" type="checkbox" ${s.webSearch?"checked":""} ${route===IDS[0]?"":"disabled"}><i class="evo25-switch"></i></label></div><p class="evo25-note"><strong>Route behavior:</strong> Edit and Extend use adaptive aspect ratio. Reference media is uploaded locally here, then hosted through EvoLink when generation starts.</p></section>
        ${renderPricing(s)}
      </div>`;
    syncNativeControls(s);hideLegacySeed25UI();
  }

  function bind(){
    const panel=$("evoSeedanceSchemaPanel");if(!panel||panel.dataset.evo25ParityBound)return;
    panel.dataset.evo25ParityBound="1";
    panel.addEventListener("click",e=>{
      const route=e.target?.closest?.("[data-evo25-route]")?.getAttribute("data-evo25-route");
      if(route){e.preventDefault();setRoute(route);return;}
      const quality=e.target?.closest?.("[data-evo25-quality]")?.getAttribute("data-evo25-quality");
      if(quality){e.preventDefault();state().quality=quality;render();return;}
      const aspect=e.target?.closest?.("[data-evo25-aspect]")?.getAttribute("data-evo25-aspect");
      if(aspect){e.preventDefault();state().aspect=aspect;syncNativeControls(state());render();return;}
      const remove=e.target?.closest?.("[data-remove-ref]")?.getAttribute("data-remove-ref");
      if(remove){e.preventDefault();const [type,index]=remove.split(":");removeRef(type,Number(index));return;}
    });
    panel.addEventListener("input",e=>{
      if(e.target?.id==="evo25DurationRange"||e.target?.id==="evo25DurationNumber"){
        const value=Math.max(4,Math.min(30,Number(e.target.value)||4));state().duration=value;
        const range=$("evo25DurationRange"),num=$("evo25DurationNumber"),read=$("evo25DurationReadout");
        if(range)range.value=value;if(num)num.value=value;if(read)read.textContent=value+"s";
        syncNativeControls(state());
        const pc=$("evo25InputVideoDuration");if(pc)pc.dispatchEvent(new Event("change"));
      }
    });
    panel.addEventListener("change",e=>{
      const s=state();
      if(e.target?.matches?.("[data-evo25-upload]")){[...e.target.files||[]].forEach(f=>addFile(e.target.getAttribute("data-evo25-upload"),f));return;}
      if(e.target?.id==="evo25Audio"){s.audio=!!e.target.checked;return;}
      if(e.target?.id==="evo25Content"){s.content=!!e.target.checked;return;}
      if(e.target?.id==="evo25WebSearch"){s.webSearch=!!e.target.checked;return;}
      if(e.target?.id==="evo25InputVideoDuration"){render();return;}
    });
  }

  let last="";
  function tick(){
    removeLegacyFalSeed25();hideFalWarnings();
    const m=currentModel();
    if(isSeed25(m)){
      let panel=$("evoSeedanceSchemaPanel");
      if(!panel){panel=document.createElement("section");panel.id="evoSeedanceSchemaPanel";const host=$("vcSettingsPanel");if(host)host.appendChild(panel);}
      if(m!==last){last=m;render();setTimeout(bind,0);}else bind();
      updateRefCounts();hideLegacySeed25UI();
    }else{last=m;const panel=$("evoSeedanceSchemaPanel");if(panel)panel.hidden=true;}
  }
  let tries=0;const timer=setInterval(()=>{tick();if(++tries>240)clearInterval(timer);},100);tick();
})();

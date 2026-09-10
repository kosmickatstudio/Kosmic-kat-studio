/* KOSMIC KAT — Seedance 2.5 EvoLink / legacy Fal playground parity
 * Seedance 2.5 only. Reuses the existing Video Canvas and existing generation
 * plumbing. Removes only legacy Fal/ByteDance Seedance 2.5 presentation entries.
 * API keys, auth, storage, routing infrastructure and other models are untouched.
 */
(function installSeedance25FalParity(){
  "use strict";
  if(window.__kosmicSeedance25FalParity)return;
  window.__kosmicSeedance25FalParity=true;

  const ROUTES={
    "seedance-2.5-text-to-video":{label:"Text to Video",short:"T2V"},
    "seedance-2.5-image-to-video":{label:"Image to Video",short:"I2V"},
    "seedance-2.5-reference-to-video":{label:"Reference to Video",short:"R2V"},
    "seedance-2.5-video-edit":{label:"Video Edit",short:"EDIT"},
    "seedance-2.5-video-extend":{label:"Video Extend",short:"EXTEND"}
  };
  const IDS=Object.keys(ROUTES);
  const $=id=>document.getElementById(id);
  const isSeed25=id=>IDS.includes(String(id||""));
  const state=()=>window.__kosmicSeedance25ParityState||(window.__kosmicSeedance25ParityState={route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",audio:true,content:true,refs:{images:0,videos:0,audios:0}});

  function currentModel(){return $("vcModel")?.value||"";}

  function findCanvasAnchor(){
    const model=$("vcModel");
    if(!model)return null;
    return model.closest(".f-group,.vc-model-wrap,.model-control,.control-group,[data-video-canvas-control]")||model.parentElement||null;
  }

  function ensurePanel(){
    let panel=$("evoSeedanceSchemaPanel");
    const anchor=findCanvasAnchor();
    if(!anchor)return false;
    if(!panel){
      panel=document.createElement("section");
      panel.id="evoSeedanceSchemaPanel";
      panel.className="evo-seedance-schema-panel evo-seedance25-parity";
    }
    if(panel.parentElement!==anchor.parentElement || panel.previousElementSibling!==anchor){
      anchor.insertAdjacentElement("afterend",panel);
    }
    return true;
  }

  function removeLegacyFalSeed25(){
    const legacyModel=v=>/^(fal-ai\/|bytedance\/).*seedance-2\.5/i.test(String(v||""));
    document.querySelectorAll("select option").forEach(o=>{
      const value=o.value||"",text=o.textContent||"";
      if(legacyModel(value)||(/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text)))o.remove();
    });
    document.querySelectorAll("[data-model],[data-route],[data-playground-model],button,a").forEach(el=>{
      const value=el.getAttribute("data-model")||el.getAttribute("data-route")||el.getAttribute("data-playground-model")||"";
      const text=(el.textContent||"").trim();
      if(legacyModel(value)||(/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text))){el.hidden=true;el.setAttribute("aria-hidden","true");}
    });
    document.querySelectorAll("[id],[class]").forEach(el=>{
      const ident=(el.id||"")+" "+(typeof el.className==="string"?el.className:"");
      if(!/(fal.*playground|playground.*fal)/i.test(ident))return;
      if(/seedance\s*2\.5/i.test(el.textContent||"")){el.hidden=true;el.setAttribute("aria-hidden","true");}
    });
  }

  function syncNativeControls(s){
    if($("vcDuration"))$("vcDuration").value=String(s.duration);
    if($("vcRes"))$("vcRes").value=s.quality;
    if($("vcRatio"))$("vcRatio").value=s.aspect;
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

  function captureBeforeRender(s,panel){
    const dur=Number($("evo25DurationNumber")?.value);
    if(Number.isFinite(dur))s.duration=Math.max(4,Math.min(30,dur));
    const q=$("evo25Quality")?.value;if(q)s.quality=q;
    const a=panel?.querySelector?.(".evo25-pill.active")?.getAttribute("data-evo25-aspect");if(a)s.aspect=a;
    const audio=$("evo25Audio");if(audio)s.audio=!!audio.checked;
    const content=$("evo25Content");if(content)s.content=!!content.checked;
  }

  function updateRefCounts(){
    const s=window.S||{};const st=state();
    st.refs={images:Array.isArray(s.vcMultiImages)?s.vcMultiImages.length:0,videos:Array.isArray(s.vcMultiVideos)?s.vcMultiVideos.length:0,audios:Array.isArray(s.vcMultiAudios)?s.vcMultiAudios.length:0};
    const panel=$("evoSeedanceSchemaPanel");if(!panel)return;
    const b=panel.querySelectorAll("[data-evo25-ref-count]");
    if(b[0])b[0].textContent=st.refs.images+" loaded";
    if(b[1])b[1].textContent=st.refs.videos+" loaded";
    if(b[2])b[2].textContent=st.refs.audios+" loaded";
  }

  function render(){
    if(!ensurePanel())return;
    const panel=$("evoSeedanceSchemaPanel");
    const route=currentModel();
    if(!isSeed25(route)){panel.hidden=true;return;}
    const s=state();captureBeforeRender(s,panel);s.route=route;
    const info=ROUTES[route];
    panel.hidden=false;panel.classList.add("evo-seedance25-parity");
    const dur=Math.max(4,Math.min(30,Number(s.duration)||5));
    const quality=["480p","720p","1080p"].includes(s.quality)?s.quality:"720p";s.quality=quality;
    const aspect=(route==="seedance-2.5-video-edit"||route==="seedance-2.5-video-extend")?"adaptive":(["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"].includes(s.aspect)?s.aspect:"16:9");s.aspect=aspect;
    syncNativeControls(s);
    panel.innerHTML=`
      <div class="evo25-shell">
        <div class="evo25-top"><div class="evo25-title"><span class="evo25-kicker">EVOLINK PLAYGROUND</span><strong>Seedance 2.5</strong><span class="evo25-sub">BytePlus · ${info.label} · one workspace, route-aware controls</span></div><span class="evo25-live">LIVE</span></div>
        <section class="evo25-card"><div class="evo25-label"><span>Generation mode</span><small>${info.short}</small></div><div class="evo25-modes">${IDS.map(id=>`<button type="button" class="evo25-mode ${id===route?"active":""}" data-evo25-route="${id}">${ROUTES[id].label}<span>${ROUTES[id].short}</span></button>`).join("")}</div></section>
        <section class="evo25-card"><div class="evo25-label"><span>Generation settings</span><small>4–30 seconds</small></div><div class="evo25-grid"><label class="evo25-field"><span>Duration <b>4–30s</b></span><div class="evo25-duration"><input id="evo25DurationRange" type="range" min="4" max="30" step="1" value="${dur}"><input id="evo25DurationNumber" type="number" min="4" max="30" step="1" value="${dur}"></div></label><label class="evo25-field"><span>Resolution</span><select id="evo25Quality">${["480p","720p","1080p"].map(x=>`<option value="${x}" ${x===quality?"selected":""}>${x}</option>`).join("")}</select></label><div class="evo25-field"><span>Aspect ratio</span><div class="evo25-pills">${["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"].map(x=>`<button type="button" class="evo25-pill ${x===aspect?"active":""}" data-evo25-aspect="${x}">${x}</button>`).join("")}</div></div></div></section>
        <section class="evo25-card"><div class="evo25-label"><span>Reference inputs</span><small>up to 50 total media refs</small></div><div class="evo25-refs"><div class="evo25-ref"><strong>Images</strong><span>1–2 for I2V · up to 30 for R2V</span><b data-evo25-ref-count>${s.refs?.images||0} loaded</b></div><div class="evo25-ref"><strong>Videos</strong><span>Required for Edit / Extend</span><b data-evo25-ref-count>${s.refs?.videos||0} loaded</b></div><div class="evo25-ref"><strong>Audio</strong><span>Reference audio tracks</span><b data-evo25-ref-count>${s.refs?.audios||0} loaded</b></div></div></section>
        <section class="evo25-card"><div class="evo25-label"><span>Output options</span><small>sent directly to EvoLink</small></div><div class="evo25-switches"><label class="evo25-toggle"><span>Generated audio</span><input id="evo25Audio" type="checkbox" ${s.audio?"checked":""}><i class="evo25-switch"></i></label><label class="evo25-toggle"><span>Content filter</span><input id="evo25Content" type="checkbox" ${s.content?"checked":""}><i class="evo25-switch"></i></label><div class="evo25-toggle"><span>Web search</span><input type="checkbox" disabled><i class="evo25-switch"></i></div></div><p class="evo25-note"><strong>Route behavior:</strong> Edit and Extend force <b>adaptive</b> aspect ratio. The existing Video Canvas reference tray remains the source of uploaded media. No provider key or storage path is changed.</p></section>
      </div>`;
    syncNativeControls(s);
  }

  function bind(){
    const panel=$("evoSeedanceSchemaPanel");if(!panel||panel.dataset.evo25ParityBound)return;
    panel.dataset.evo25ParityBound="1";
    panel.addEventListener("click",e=>{
      const route=e.target?.closest?.("[data-evo25-route]")?.getAttribute("data-evo25-route");
      if(route){e.preventDefault();setRoute(route);return;}
      const aspect=e.target?.closest?.("[data-evo25-aspect]")?.getAttribute("data-evo25-aspect");
      if(aspect){e.preventDefault();const s=state();s.aspect=aspect;if((s.route===IDS[3]||s.route===IDS[4])&&aspect!=="adaptive")return render();syncNativeControls(s);render();}
    });
    panel.addEventListener("input",e=>{
      if(e.target?.id!=="evo25DurationRange"&&e.target?.id!=="evo25DurationNumber")return;
      const s=state(),value=Math.max(4,Math.min(30,Number(e.target.value)||4));s.duration=value;syncNativeControls(s);
      if($("evo25DurationRange"))$("evo25DurationRange").value=value;if($("evo25DurationNumber"))$("evo25DurationNumber").value=value;
    });
    panel.addEventListener("change",e=>{
      const s=state();
      if(e.target?.id==="evo25Quality"){s.quality=e.target.value;syncNativeControls(s);}
      if(e.target?.id==="evo25Audio")s.audio=!!e.target.checked;
      if(e.target?.id==="evo25Content")s.content=!!e.target.checked;
    });
  }

  let last="";
  function tick(){
    removeLegacyFalSeed25();
    const m=currentModel();
    if(isSeed25(m)){
      ensurePanel();
      updateRefCounts();
      if(m!==last){last=m;render();setTimeout(bind,0);}
      else if($("evoSeedanceSchemaPanel")&&!$("evoSeedanceSchemaPanel").classList.contains("evo-seedance25-parity")){render();bind();}
      else bind();
    }else{
      last=m;
      const panel=$("evoSeedanceSchemaPanel");
      if(panel)panel.hidden=true;
    }
  }
  let tries=0;const timer=setInterval(()=>{tick();if(++tries>240)clearInterval(timer);},100);
  tick();
})();
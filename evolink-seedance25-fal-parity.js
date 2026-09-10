/* KOSMIC KAT — Seedance 2.5 EvoLink / legacy Fal playground parity
 * Seedance 2.5 only. Reuses the existing Video Canvas and existing schema/request
 * bridge. Removes only legacy Fal/ByteDance Seedance 2.5 presentation entries.
 * API keys, auth, storage, generation plumbing and other models are untouched.
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

  function currentModel(){return $("vcModel")?.value||"";}
  function isSeed25Active(){return isSeed25(currentModel());}

  function removeLegacyFalSeed25(){
    const legacyModel=v=>/^(fal-ai\/|bytedance\/).*seedance-2\.5/i.test(String(v||""));
    document.querySelectorAll("select option").forEach(o=>{
      const value=o.value||"",text=o.textContent||"";
      if(legacyModel(value)||(\/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|byteplus|bytedance)/i.test(text)))o.remove();
    });

    document.querySelectorAll("[data-model],[data-route],[data-playground-model],button,a").forEach(el=>{
      const value=el.getAttribute("data-model")||el.getAttribute("data-route")||el.getAttribute("data-playground-model")||"";
      const text=(el.textContent||"").trim();
      if(legacyModel(value)||(/seedance\s*2\.5/i.test(text)&&/(fal\.ai|fal-ai|bytedance)/i.test(text))){
        el.hidden=true;
        el.setAttribute("aria-hidden","true");
      }
    });

    document.querySelectorAll("[id],[class]").forEach(el=>{
      if(!el.querySelector) return;
      const ident=(el.id||"")+" "+(typeof el.className==="string"?el.className:"");
      if(!/(fal.*playground|playground.*fal)/i.test(ident))return;
      const text=el.textContent||"";
      if(/seedance\s*2\.5/i.test(text)){el.hidden=true;el.setAttribute("aria-hidden","true");}
    });
  }

  function syncHiddenSchema(route){
    const map=window.__kosmicSeedance25ParityState||(window.__kosmicSeedance25ParityState={});
    map.route=route;
    const set=(id,value)=>{const e=$(id);if(e)e.value=value;};
    const old=$("evoSeedanceRoute");
    if(old)old.value=route;
    const d=$("evoSeedanceDuration");
    if(d){d.min="4";d.max="30";if(!d.value||Number(d.value)<4)d.value="5";}
    if(route===IDS[3]||route===IDS[4]){
      set("evoSeedanceAspect","adaptive");
      if($("vcRatio"))$("vcRatio").value="adaptive";
    }
  }

  function setRoute(route){
    if(!isSeed25(route))return;
    const model=$("vcModel");
    if(model&&model.value!==route){
      model.value=route;
      model.dispatchEvent(new Event("change",{bubbles:true}));
    }
    syncHiddenSchema(route);
    render();
    const input=$("vcChatInput");
    if(input)input.focus({preventScroll:true});
  }

  function activeAudio(){return !!$("evoSeedanceAudio")?.checked;}
  function render(){
    const panel=$("evoSeedanceSchemaPanel");
    if(!panel||!isSeed25Active()){
      if(panel)panel.hidden=true;
      return;
    }
    const route=currentModel(),info=ROUTES[route];
    panel.hidden=false;
    panel.classList.add("evo-seedance25-parity");
    syncHiddenSchema(route);

    const dur=Math.max(4,Math.min(30,Number($("evoSeedanceDuration")?.value||5)));
    const quality=$("evoSeedanceQuality")?.value||"720p";
    const aspect=$("evoSeedanceAspect")?.value||(route===IDS[3]||route===IDS[4]?"adaptive":"16:9");
    const refs=window.__kosmicSeedance25ParityState?.refs||{images:0,videos:0,audios:0};

    panel.innerHTML=`
      <div class="evo25-shell">
        <div class="evo25-top">
          <div class="evo25-title">
            <span class="evo25-kicker">EVOLINK PLAYGROUND</span>
            <strong>Seedance 2.5</strong>
            <span class="evo25-sub">BytePlus · ${info.label} · one workspace, route-aware controls</span>
          </div>
          <span class="evo25-live">LIVE</span>
        </div>

        <section class="evo25-card">
          <div class="evo25-label"><span>Generation mode</span><small>${info.short}</small></div>
          <div class="evo25-modes">
            ${IDS.map(id=>`<button type="button" class="evo25-mode ${id===route?"active":""}" data-evo25-route="${id}">${ROUTES[id].label}<span>${ROUTES[id].short}</span></button>`).join("")}
          </div>
        </section>

        <section class="evo25-card">
          <div class="evo25-label"><span>Generation settings</span><small>4–30 seconds</small></div>
          <div class="evo25-grid">
            <label class="evo25-field"><span>Duration <b>4–30s</b></span><div class="evo25-duration"><input id="evo25DurationRange" type="range" min="4" max="30" step="1" value="${dur}"><input id="evo25DurationNumber" type="number" min="4" max="30" step="1" value="${dur}"></div></label>
            <label class="evo25-field"><span>Resolution</span><select id="evo25Quality">${["480p","720p","1080p"].map(x=>`<option value="${x}" ${x===quality?"selected":""}>${x}</option>`).join("")}</select></label>
            <div class="evo25-field"><span>Aspect ratio</span><div class="evo25-pills">${["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"].map(x=>`<button type="button" class="evo25-pill ${x===aspect?"active":""}" data-evo25-aspect="${x}">${x}</button>`).join("")}</div></div>
          </div>
        </section>

        <section class="evo25-card">
          <div class="evo25-label"><span>Reference inputs</span><small>up to 50 total media refs</small></div>
          <div class="evo25-refs">
            <div class="evo25-ref"><strong>Images</strong><span>1–2 for I2V · up to 30 for R2V</span><b>${refs.images||0} loaded</b></div>
            <div class="evo25-ref"><strong>Videos</strong><span>Required for Edit / Extend</span><b>${refs.videos||0} loaded</b></div>
            <div class="evo25-ref"><strong>Audio</strong><span>Reference audio tracks</span><b>${refs.audios||0} loaded</b></div>
          </div>
        </section>

        <section class="evo25-card">
          <div class="evo25-label"><span>Output options</span><small>sent directly to EvoLink</small></div>
          <div class="evo25-switches">
            <label class="evo25-toggle"><span>Generated audio</span><input id="evo25Audio" type="checkbox" ${activeAudio()?"checked":""}><i class="evo25-switch"></i></label>
            <div class="evo25-toggle"><span>Content filter</span><input id="evo25Content" type="checkbox" checked><i class="evo25-switch"></i></div>
            <div class="evo25-toggle"><span>Web search</span><input type="checkbox" disabled><i class="evo25-switch"></i></div>
          </div>
          <p class="evo25-note"><strong>Route behavior:</strong> Edit and Extend force <b>adaptive</b> aspect ratio. The existing Video Canvas reference tray remains the source of uploaded media. No provider key or storage path is changed.</p>
        </section>
      </div>`;

    const hiddenRoute=$("evoSeedanceRoute"),hiddenDur=$("evoSeedanceDuration"),hiddenQ=$("evoSeedanceQuality"),hiddenA=$("evoSeedanceAspect"),hiddenAudio=$("evoSeedanceAudio");
    [hiddenRoute,hiddenDur,hiddenQ,hiddenA,hiddenAudio].forEach(e=>e&&e.classList.add("evo25-hidden-sync"));
    if(hiddenRoute)hiddenRoute.value=route;
    if(hiddenDur)hiddenDur.value=String(dur);
    if(hiddenQ)hiddenQ.value=quality;
    if(hiddenA)hiddenA.value=aspect;
    if($("evoSeedanceContentFilter"))$("evoSeedanceContentFilter").checked=true;
  }

  function bind(){
    const panel=$("evoSeedanceSchemaPanel");
    if(!panel||panel.dataset.evo25ParityBound)return;
    panel.dataset.evo25ParityBound="1";
    panel.addEventListener("click",e=>{
      const route=e.target?.closest?.("[data-evo25-route]")?.getAttribute("data-evo25-route");
      if(route){e.preventDefault();setRoute(route);return;}
      const aspect=e.target?.closest?.("[data-evo25-aspect]")?.getAttribute("data-evo25-aspect");
      if(aspect){
        e.preventDefault();
        const q=$("evoSeedanceAspect");if(q)q.value=aspect;
        if($("vcRatio"))$("vcRatio").value=aspect;
        render();
      }
    });
    panel.addEventListener("input",e=>{
      if(e.target?.id!=="evo25DurationRange"&&e.target?.id!=="evo25DurationNumber")return;
      const value=Math.max(4,Math.min(30,Number(e.target.value)||4));
      if($("evo25DurationRange"))$("evo25DurationRange").value=value;
      if($("evo25DurationNumber"))$("evo25DurationNumber").value=value;
      if($("evoSeedanceDuration"))$("evoSeedanceDuration").value=value;
      if($("vcDuration"))$("vcDuration").value=value;
    });
    panel.addEventListener("change",e=>{
      if(e.target?.id==="evo25Quality"){
        if($("evoSeedanceQuality"))$("evoSeedanceQuality").value=e.target.value;
        if($("vcRes"))$("vcRes").value=e.target.value;
      }
      if(e.target?.id==="evo25Audio"&&$("evoSeedanceAudio"))$("evoSeedanceAudio").checked=e.target.checked;
    });
  }

  function mirrorRefCounts(){
    const s=window.S||{};
    window.__kosmicSeedance25ParityState=window.__kosmicSeedance25ParityState||{};
    window.__kosmicSeedance25ParityState.refs={images:Array.isArray(s.vcMultiImages)?s.vcMultiImages.length:0,videos:Array.isArray(s.vcMultiVideos)?s.vcMultiVideos.length:0,audios:Array.isArray(s.vcMultiAudios)?s.vcMultiAudios.length:0};
  }

  let last="";
  function tick(){
    removeLegacyFalSeed25();
    mirrorRefCounts();
    const m=currentModel();
    if(m!==last){last=m;render();setTimeout(bind,0);} else if(isSeed25Active()){render();bind();}
  }
  let tries=0;const timer=setInterval(()=>{tick();if(++tries>240)clearInterval(timer);},100);
  tick();
})();

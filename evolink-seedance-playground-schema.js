/* KOSMIC KAT — EvoLink Seedance Playground Schema Layer
 * Presentation + request-schema adapter for the EXISTING Video Canvas.
 * Adds the Seedance-specific controls that the legacy playground did not expose:
 * mode/route, synchronized audio, web search, content filter, duration bounds,
 * resolution/aspect constraints, first/last-frame guidance, and reference limits.
 * API keys, storage, auth and existing generation functions are untouched.
 */
(function installSeedancePlaygroundSchema(){
  "use strict";
  if(window.__kosmicSeedancePlaygroundSchema)return;
  window.__kosmicSeedancePlaygroundSchema=true;

  const SEEDANCE={
    "Seedance 2.5":{
      routes:[
        ["seedance-2.5-text-to-video","Text to Video"],
        ["seedance-2.5-image-to-video","Image to Video"],
        ["seedance-2.5-reference-to-video","Reference to Video"],
        ["seedance-2.5-video-edit","Video Edit"],
        ["seedance-2.5-video-extend","Video Extend"]
      ],duration:[4,30],quality:["480p","720p","1080p"],aspect:["adaptive","16:9","9:16","1:1","4:3","3:4","21:9"],audio:true,
      refs:{images:30,videos:10,audios:10,total:50},contentFilter:true,webSearch:false,
      notes:"Up to 30 images + 10 videos + 10 audio tracks. Image-to-Video accepts 1–2 images; Edit/Extend require video input. Edit/Extend use adaptive aspect ratio."
    },
    "Seedance 2.0":{
      routes:[
        ["seedance-2.0-text-to-video","Text to Video · Standard"],
        ["seedance-2.0-image-to-video","Image to Video · Standard"],
        ["seedance-2.0-reference-to-video","Reference to Video · Standard"],
        ["seedance-2.0-fast-text-to-video","Text to Video · Fast"],
        ["seedance-2.0-fast-image-to-video","Image to Video · Fast"],
        ["seedance-2.0-fast-reference-to-video","Reference to Video · Fast"]
      ],duration:[4,15],quality:["480p","720p","1080p","4K"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","adaptive"],audio:true,
      refs:{images:9,videos:3,audios:3,total:15},contentFilter:true,webSearch:true,
      notes:"Standard and Fast routes share the same multimodal reference limits. Reference-to-Video accepts image, video and audio references."
    },
    "Seedance 2.0 Mini":{
      routes:[
        ["seedance-2.0-mini-text-to-video","Text to Video"],
        ["seedance-2.0-mini-image-to-video","Image to Video"],
        ["seedance-2.0-mini-reference-to-video","Reference to Video"]
      ],duration:[4,15],quality:["480p","720p"],aspect:["16:9","9:16","1:1","4:3","3:4","21:9","adaptive"],audio:true,
      refs:{images:9,videos:3,audios:3,total:15},contentFilter:true,webSearch:false,
      notes:"Mini is optimized for lower-cost iteration. Text-only requests do not accept image/video/audio URL fields."
    },
    "Seedance 1.5 Pro":{
      routes:[["seedance-1.5-pro","Text to Video"],["seedance-1.5-pro-image-to-video","Image to Video"]],
      duration:[4,12],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1"],audio:true,refs:{images:1,videos:0,audios:0,total:1},contentFilter:true,webSearch:false,
      notes:"Legacy Seedance route family retained for compatibility."
    },
    "Seedance 1.0 Pro Fast":{
      routes:[["doubao-seedance-1.0-pro-fast","Text to Video"],["doubao-seedance-1.0-pro-fast-image-to-video","Image to Video"]],
      duration:[2,10],quality:["480p","720p","1080p"],aspect:["16:9","9:16","1:1"],audio:false,refs:{images:1,videos:0,audios:0,total:1},contentFilter:true,webSearch:false,
      notes:"Fast draft-oriented Seedance route."
    }
  };

  const esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
  const get=(id)=>document.getElementById(id);
  const model=()=>get("vcModel")?.value||"";
  const api=()=>window.KOSMIC_EVOLINK_VIDEO;
  const route=()=>api()?.index?.[model()]||null;
  const family=()=>route()?.model?.name||Object.keys(SEEDANCE).find(n=>SEEDANCE[n].routes.some(r=>r[0]===model()))||"";
  const schema=()=>SEEDANCE[family()]||null;

  function ensurePanel(){
    const host=get("vcSettingsPanel");
    if(!host||get("evoSeedanceSchemaPanel"))return !!host;
    const wrap=document.createElement("section");
    wrap.id="evoSeedanceSchemaPanel";
    wrap.className="evo-seedance-schema-panel";
    host.appendChild(wrap);
    return true;
  }

  function render(){
    if(!ensurePanel())return false;
    const panel=get("evoSeedanceSchemaPanel"),s=schema(),r=route();
    if(!s||!r){panel.hidden=true;return true;}
    panel.hidden=false;
    const current=model();
    const routeOptions=s.routes.map(x=>`<option value="${esc(x[0])}" ${x[0]===current?"selected":""}>${esc(x[1])}</option>`).join("");
    const [lo,hi]=s.duration;
    const aspects=s.aspect.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
    const qualities=s.quality.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
    const routeMode=r.mode||"text";
    panel.innerHTML=`
      <div class="evo-schema-head"><div><span class="evo-schema-kicker">EVOLINK SCHEMA</span><strong>${esc(family())}</strong></div><span class="evo-schema-live">LIVE</span></div>
      <label class="evo-schema-field"><span>Generation mode</span><select id="evoSeedanceRoute">${routeOptions}</select></label>
      <div class="evo-schema-grid">
        <label class="evo-schema-field"><span>Duration <b>${lo}–${hi}s</b></span><input id="evoSeedanceDuration" type="number" min="${lo}" max="${hi}" step="1" value="${Math.max(lo,Math.min(hi,Number(get("vcDuration")?.value)||lo))}"></label>
        <label class="evo-schema-field"><span>Resolution</span><select id="evoSeedanceQuality">${qualities}</select></label>
        <label class="evo-schema-field"><span>Aspect ratio</span><select id="evoSeedanceAspect">${aspects}</select></label>
      </div>
      <div class="evo-schema-toggles">
        ${s.audio?`<label><input id="evoSeedanceAudio" type="checkbox" checked> <span>Synchronized audio</span></label>`:""}
        ${s.webSearch&&routeMode==="text"?`<label><input id="evoSeedanceWebSearch" type="checkbox"> <span>Web search</span></label>`:""}
        ${s.contentFilter?`<label><input id="evoSeedanceContentFilter" type="checkbox" checked> <span>Content filter</span></label>`:""}
      </div>
      <div class="evo-schema-capabilities">
        <span>${esc(routeMode.replace(/^./,x=>x.toUpperCase()))} route</span>
        ${s.refs.images?`<span>Images ≤ ${s.refs.images}</span>`:""}
        ${s.refs.videos?`<span>Videos ≤ ${s.refs.videos}</span>`:""}
        ${s.refs.audios?`<span>Audio refs ≤ ${s.refs.audios}</span>`:""}
        ${s.refs.total?`<span>Total refs ≤ ${s.refs.total}</span>`:""}
      </div>
      <p class="evo-schema-note">${esc(s.notes)}</p>`;

    const q=get("vcRes"),a=get("vcRatio"),d=get("vcDuration");
    const qs=get("evoSeedanceQuality"),as=get("evoSeedanceAspect"),ds=get("evoSeedanceDuration");
    if(q&&s.quality.includes(q.value))qs.value=q.value; else if(q&&qs)q.value=qs.value;
    if(a&&s.aspect.includes(a.value))as.value=a.value; else if(a&&as)a.value=as.value;
    if(d&&Number(d.value)>=lo&&Number(d.value)<=hi)ds.value=d.value; else if(d&&ds)d.value=String(lo);
    return true;
  }

  function bind(){
    const panel=get("evoSeedanceSchemaPanel");if(!panel||panel.dataset.bound)return;
    panel.dataset.bound="1";
    panel.addEventListener("change",e=>{
      const t=e.target;if(!t)return;
      if(t.id==="evoSeedanceRoute"){
        const sel=get("vcModel");if(sel){sel.value=t.value;sel.dispatchEvent(new Event("change",{bubbles:true}));}
        render();return;
      }
      if(t.id==="evoSeedanceDuration"&&get("vcDuration")){get("vcDuration").value=t.value;}
      if(t.id==="evoSeedanceQuality"&&get("vcRes")){get("vcRes").value=t.value;}
      if(t.id==="evoSeedanceAspect"&&get("vcRatio")){get("vcRatio").value=t.value;}
    });
  }

  window.__kosmicSeedanceBuildRequest=(base={})=>{
    const s=schema(),r=route();
    if(!s||!r)return base;
    const duration=Math.max(s.duration[0],Math.min(s.duration[1],Number(get("evoSeedanceDuration")?.value||base.duration||s.duration[0])));
    const quality=get("evoSeedanceQuality")?.value||base.quality;
    const aspect=get("evoSeedanceAspect")?.value||base.aspect_ratio;
    const out=Object.assign({},base,{duration,quality,aspect_ratio:aspect});
    if(s.audio)out.generate_audio=!!get("evoSeedanceAudio")?.checked;
    if(s.contentFilter)out.content_filter=!!get("evoSeedanceContentFilter")?.checked;
    if(s.webSearch&&r.mode==="text")out.model_params=Object.assign({},out.model_params,{web_search:!!get("evoSeedanceWebSearch")?.checked});
    if(r.mode==="edit"||r.mode==="extend")out.aspect_ratio="adaptive";
    return out;
  };

  let last="";
  function tick(){
    const m=model();
    if(m!==last){last=m;render();setTimeout(bind,0);} else if(get("vcSettingsPanel")&&!get("evoSeedanceSchemaPanel")){render();bind();}
  }
  const start=()=>{tick();return !!get("vcModel");};
  if(!start()){let tries=0;const timer=setInterval(()=>{if(start()||++tries>160)clearInterval(timer);},100);}
  setInterval(tick,700);
})();

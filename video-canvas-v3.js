/* KOSMIC KAT — VIDEO CANVAS V3
 * Creator-first video generation surface inspired by current patterns from
 * Higgsfield Cinema Studio, OpenArt, Runway, Luma, Firefly and Pika.
 * IMPORTANT: this file owns the Video generation module only.
 * API keys / API slots remain in the existing global Settings system.
 */
(function installVideoCanvasV3(){
  "use strict";
  if(window.__kosmicVideoCanvasV3)return;
  window.__kosmicVideoCanvasV3=true;

  const SEED25=[
    "seedance-2.5-text-to-video",
    "seedance-2.5-image-to-video",
    "seedance-2.5-reference-to-video",
    "seedance-2.5-video-edit",
    "seedance-2.5-video-extend"
  ];
  const PRESETS={
    camera:["Dolly In","Dolly Out","Orbit Left","Orbit Right","Crane Up","Crane Down","Push In","Tracking Shot","Handheld","FPV Drone","Static Lock-Off","Whip Pan"],
    framing:["Extreme Wide","Wide Shot","Medium Shot","Medium Close-Up","Close-Up","Extreme Close-Up","Overhead","Low Angle","POV"],
    lighting:["Soft natural light","Golden hour","Blue hour","High-contrast cinematic lighting","Neon practicals","Volumetric light","Moody low-key lighting","Clean commercial lighting"],
    style:["Photorealistic cinematic film","Documentary realism","Premium commercial","35mm film texture","Anamorphic cinema","Stylized 3D","Anime cinematic","Music-video energy"]
  };
  const state=window.__kosmicVideoV3State||(window.__kosmicVideoV3State={
    route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",
    audio:true,content_filter:true,webSearch:false,
    prompt:"",images:[],videos:[],audios:[],history:[],busy:false,
    workspace:"shot",presetTab:"camera",storyboard:[{id:1,prompt:"",duration:5}],
    selectedModelFilter:"all"
  });
  const $=id=>document.getElementById(id);
  const qAll=sel=>Array.from(document.querySelectorAll(sel));
  const esc=v=>String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));
  const apiKey=()=>String(typeof gs==="function"?gs("api_evolink",""):"").trim();
  const catalog=()=>window.KOSMIC_EVOLINK_VIDEO?.index||{};
  const currentRoute=()=>catalog()[state.route]||null;
  const currentCard=()=>currentRoute()?.model||currentRoute()?.card||currentRoute()||{};
  const currentSchema=()=>currentCard()?.schema||currentRoute()?.schema||{};
  const isSeed25=id=>SEED25.includes(id);
  const modeOf=r=>String(r?.mode||r?.id||"").includes("reference")?"reference":String(r?.mode||r?.id||"").includes("extend")?"extend":String(r?.mode||r?.id||"").includes("edit")?"edit":String(r?.mode||r?.id||"").includes("image")?"image":"text";

  function injectCss(){
    if($("kk-video-v3-css"))return;
    const s=document.createElement("style");s.id="kk-video-v3-css";
    s.textContent=`
      .kkv3{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--pearl,#faf8f5);color:var(--text,#1e1230);font-family:Inter,sans-serif;overflow:hidden}
      .kkv3 *{box-sizing:border-box}.kkv3 button,.kkv3 input,.kkv3 textarea,.kkv3 select{font:inherit}.kkv3 button{cursor:pointer}
      .kkv3-head{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--border,rgba(61,31,122,.10));background:var(--glass-solid,#fff);flex-shrink:0;position:relative;z-index:3}
      .kkv3-brand{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff;font-size:18px;box-shadow:0 8px 22px rgba(61,31,122,.16)}
      .kkv3-title{font-weight:850;font-size:16px;letter-spacing:-.02em}.kkv3-sub{font-size:10px;color:var(--texts,#9488ae);margin-top:2px}
      .kkv3-status{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:9px;font-weight:800;padding:7px 10px;border-radius:99px;background:rgba(16,185,129,.08);color:#059669}.kkv3-status i{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px rgba(16,185,129,.65)}
      .kkv3-tabs{display:flex;gap:7px;padding:8px 12px;border-bottom:1px solid var(--border,rgba(61,31,122,.08));background:var(--surface,#fff);overflow-x:auto;scrollbar-width:none}.kkv3-tabs::-webkit-scrollbar{display:none}
      .kkv3-tab{flex:0 0 auto;border:1px solid transparent;background:transparent;color:var(--textm,#5a4880);font-size:10px;font-weight:800;padding:8px 12px;border-radius:10px}.kkv3-tab.active{background:rgba(98,64,176,.10);border-color:rgba(98,64,176,.14);color:var(--violet,#3d1f7a)}
      .kkv3-body{display:grid;grid-template-columns:minmax(0,1fr) 330px;min-height:0;flex:1}
      .kkv3-main{min-width:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}.kkv3-side{min-width:0;border-left:1px solid var(--border,rgba(61,31,122,.09));overflow:auto;padding:14px;background:rgba(255,255,255,.22)}
      .kkv3-card{border:1px solid var(--border,rgba(61,31,122,.10));background:var(--surface,#fff);border-radius:18px;padding:14px;box-shadow:0 7px 24px rgba(61,31,122,.045)}
      .kkv3-card h3{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--texts,#9488ae);margin:0 0 9px}.kkv3-card h3 span{float:right;text-transform:none;letter-spacing:0;font-size:9px;font-weight:700;color:var(--texts,#9488ae)}
      .kkv3-modelbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.kkv3-select,.kkv3-input,.kkv3-textarea{width:100%;border:1px solid var(--border,rgba(61,31,122,.11));background:var(--pearl2,#f3eff8);color:var(--text,#1e1230);border-radius:11px;padding:10px 11px;outline:none}.kkv3-select:focus,.kkv3-input:focus,.kkv3-textarea:focus{border-color:rgba(98,64,176,.42);box-shadow:0 0 0 3px rgba(98,64,176,.07)}
      .kkv3-routebar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.kkv3-route{border:1px solid var(--border,rgba(61,31,122,.11));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);border-radius:10px;padding:7px 9px;font-size:9px;font-weight:800}.kkv3-route.active{background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--vm,#6240b0));border-color:transparent;color:#fff}
      .kkv3-prompt{min-height:150px;resize:vertical;line-height:1.55;font-size:13px;background:rgba(249,248,252,.95)}
      .kkv3-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}.kkv3-small{font-size:9px;color:var(--texts,#9488ae)}.kkv3-chiprow{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.kkv3-chiprow::-webkit-scrollbar{display:none}.kkv3-chip{flex:0 0 auto;border:1px solid var(--border,rgba(61,31,122,.10));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);padding:7px 9px;border-radius:10px;font-size:9px;font-weight:800}.kkv3-chip:hover{border-color:rgba(98,64,176,.30);color:var(--violet,#3d1f7a)}
      .kkv3-preset-tabs{display:flex;gap:5px;overflow:auto;scrollbar-width:none;margin-bottom:7px}.kkv3-preset-tabs::-webkit-scrollbar{display:none}.kkv3-preset-tab{flex:0 0 auto;border:0;background:transparent;color:var(--texts,#9488ae);padding:6px 8px;font-size:9px;font-weight:800;border-radius:8px}.kkv3-preset-tab.active{background:rgba(98,64,176,.08);color:var(--violet,#3d1f7a)}
      .kkv3-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.kkv3-field label{display:flex;justify-content:space-between;gap:8px;font-size:9px;font-weight:800;color:var(--textm,#5a4880);margin-bottom:6px}.kkv3-field label small{font-size:8px;color:var(--texts,#9488ae);font-weight:650}.kkv3-range{display:grid;grid-template-columns:minmax(0,1fr) 58px;gap:7px;align-items:center}.kkv3-range input[type=range]{width:100%;accent-color:var(--violet,#3d1f7a)}
      .kkv3-pills{display:flex;gap:6px;flex-wrap:wrap}.kkv3-pill{border:1px solid var(--border,rgba(61,31,122,.10));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);padding:8px 10px;border-radius:10px;font-size:9px;font-weight:800}.kkv3-pill.active{color:var(--violet,#3d1f7a);background:rgba(98,64,176,.10);border-color:rgba(98,64,176,.18)}
      .kkv3-dropgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kkv3-drop{position:relative;min-height:96px;border:1px dashed rgba(98,64,176,.22);border-radius:13px;padding:11px;text-align:center;background:linear-gradient(135deg,rgba(98,64,176,.035),rgba(74,169,217,.035));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}.kkv3-drop strong{font-size:10px}.kkv3-drop span{font-size:8px;color:var(--texts,#9488ae)}.kkv3-drop input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.kkv3-count{font-size:8px;font-weight:800;padding:3px 7px;border-radius:999px;background:rgba(16,185,129,.08);color:#059669}
      .kkv3-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:7px;margin-top:8px}.kkv3-asset{position:relative;min-height:70px;border-radius:10px;overflow:hidden;border:1px solid var(--border,rgba(61,31,122,.10));background:#f4f1f8}.kkv3-asset img,.kkv3-asset video{width:100%;height:70px;object-fit:cover;display:block}.kkv3-asset audio{width:100%;margin-top:26px}.kkv3-remove{position:absolute;top:4px;right:4px;width:20px;height:20px;border:0;border-radius:50%;background:rgba(0,0,0,.58);color:#fff;font-size:11px}
      .kkv3-shot{display:flex;gap:9px;align-items:flex-start}.kkv3-shot-num{width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:rgba(98,64,176,.10);color:var(--violet,#3d1f7a);font-size:9px;font-weight:900;flex:0 0 auto}.kkv3-shot-main{flex:1;min-width:0}.kkv3-shot-actions{display:flex;gap:6px;margin-top:7px}.kkv3-shot-actions button{border:1px solid var(--border,rgba(61,31,122,.11));background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);padding:6px 8px;border-radius:9px;font-size:8px;font-weight:800}
      .kkv3-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kkv3-stat{padding:10px;border-radius:12px;background:var(--pearl2,#f3eff8);border:1px solid var(--border,rgba(61,31,122,.07))}.kkv3-stat b{display:block;font-size:16px;color:var(--violet,#3d1f7a)}.kkv3-stat span{font-size:8px;color:var(--texts,#9488ae)}
      .kkv3-generate{width:100%;padding:13px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff;font-weight:900;letter-spacing:.02em;box-shadow:0 8px 22px rgba(61,31,122,.18)}.kkv3-generate:disabled{opacity:.48;box-shadow:none;cursor:not-allowed}.kkv3-secondary{width:100%;margin-top:7px;padding:9px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:11px;background:var(--surface,#fff);color:var(--textm,#5a4880);font-size:9px;font-weight:850}
      .kkv3-history{display:flex;flex-direction:column;gap:9px}.kkv3-job{border:1px solid var(--border,rgba(61,31,122,.10));background:var(--surface,#fff);border-radius:13px;overflow:hidden}.kkv3-job video{width:100%;display:block;background:#09080e}.kkv3-job-body{padding:9px}.kkv3-job-top{display:flex;justify-content:space-between;gap:7px;font-size:8px;color:var(--texts,#9488ae)}.kkv3-job-prompt{font-size:9px;margin-top:5px;line-height:1.4}.kkv3-error{padding:10px;border-radius:10px;background:rgba(239,68,68,.07);color:#b91c1c;font-size:9px;line-height:1.4}
      .kkv3-empty{padding:20px 10px;text-align:center;color:var(--texts,#9488ae);font-size:9px;border:1px dashed var(--border,rgba(61,31,122,.10));border-radius:12px}
      .kkv3-mobile-generate{display:none}.kkv3-keyhint{font-size:8px;color:var(--texts,#9488ae);line-height:1.4;padding-top:7px}.kkv3-keyhint strong{color:var(--textm,#5a4880)}
      @media(max-width:920px){.kkv3-body{grid-template-columns:1fr}.kkv3-side{border-left:0;border-top:1px solid var(--border,rgba(61,31,122,.08));max-height:none}.kkv3-mobile-generate{display:block;position:sticky;bottom:8px;z-index:5;margin:2px 0;padding:0 12px}.kkv3-mobile-generate .kkv3-generate{box-shadow:0 12px 30px rgba(61,31,122,.20)}}
      @media(max-width:620px){.kkv3-head{padding:11px 12px}.kkv3-title{font-size:14px}.kkv3-main,.kkv3-side{padding:10px}.kkv3-grid{grid-template-columns:1fr}.kkv3-dropgrid{grid-template-columns:1fr 1fr}.kkv3-status{display:none}.kkv3-card{border-radius:15px;padding:12px}}
      html[data-theme="dark"] .kkv3{background:var(--pearl,#0d0a16)}html[data-theme="dark"] .kkv3-card{background:var(--surface,#191324);border-color:var(--border)}html[data-theme="dark"] .kkv3-select,html[data-theme="dark"] .kkv3-input,html[data-theme="dark"] .kkv3-textarea,html[data-theme="dark"] .kkv3-pill,html[data-theme="dark"] .kkv3-chip,html[data-theme="dark"] .kkv3-route,html[data-theme="dark"] .kkv3-stat{background:var(--surface2,#211a32);color:var(--text)}
    `;
    document.head.appendChild(s);
  }

  function normalize(){
    const s=currentSchema();
    const d=s.duration||[4,30];
    state.duration=Math.max(Number(d[0]??4),Math.min(Number(d[1]??30),Number(state.duration)||Number(d[0]??4)));
    if(Array.isArray(s.quality)&&s.quality.length&&!s.quality.includes(state.quality))state.quality=s.quality[0];
    const aspects=Array.isArray(s.aspect)&&s.aspect.length?s.aspect.map(v=>v==="auto"?"adaptive":v):["16:9","9:16"];
    if(modeOf(currentRoute())!=="text"&&/image|edit|extend/.test(modeOf(currentRoute()))&&aspects.includes("adaptive"))state.aspect="adaptive";
    if(!aspects.includes(state.aspect))state.aspect=aspects[0];
    if(s.audio===false)state.audio=false;
  }

  function routes(){return Object.values(catalog()).filter(Boolean).filter(r=>r.id);}
  function routeLabel(r){return r?.label||r?.mode||String(r?.id||"").split("-").pop();}
  function modelLabel(r){return r?.model?.name||r?.name||String(r?.id||"").replace(/-/g," ");}
  function modelNames(){return [...new Set(routes().map(r=>modelLabel(r)))].sort((a,b)=>a.localeCompare(b));}
  function sameModelRoutes(){const name=modelLabel(currentRoute());return routes().filter(r=>modelLabel(r)===name);}
  function setRoute(id){state.route=id;normalize();render();}

  function presetText(kind,value){return value;}
  function applyPreset(value){const area=$("kkv3Prompt");if(!area)return;const current=area.value.trim();area.value=current?(current+"; "+value):value;state.prompt=area.value;}

  function fileToData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});}
  function videoDuration(url){return new Promise(resolve=>{const v=document.createElement("video");v.preload="metadata";v.onloadedmetadata=()=>resolve(Number.isFinite(v.duration)?v.duration:0);v.onerror=()=>resolve(0);v.src=url;});}
  function limits(){return currentSchema().refs||{images:30,videos:10,audios:10,total:50};}
  function count(kind){return state[kind].length;}
  function totalRefs(){return state.images.length+state.videos.length+state.audios.length;}
  async function addFiles(kind,list){
    const lim=limits();
    for(const file of Array.from(list||[])){
      if(count(kind)>=(lim[kind]??50)||totalRefs()>=(lim.total??999)){toast("Reference limit reached for this route.","error");continue;}
      const url=await fileToData(file);const item={url,name:file.name};
      if(kind==="videos")item.duration=await videoDuration(url);
      state[kind].push(item);
    }
    render();
  }
  function removeRef(kind,index){state[kind].splice(index,1);render();}
  async function evoUpload(url,index){
    if(/^https?:\/\//i.test(url))return url;
    const k=apiKey();if(!k)throw new Error("EvoLink is not configured in the existing API key settings.");
    const res=await fetch(url);if(!res.ok)throw new Error("Could not read reference asset #"+(index+1)+".");
    const blob=await res.blob();const form=new FormData();form.append("file",blob,"kosmic-video-ref-"+index);
    const up=await fetch("https://files-api.evolink.ai/api/v1/files/upload/stream",{method:"POST",headers:{Authorization:"Bearer "+k},body:form});
    const data=await up.json().catch(()=>({}));if(!up.ok)throw new Error(data?.error?.message||data?.message||(`EvoLink file upload failed (HTTP ${up.status})`));
    const fileUrl=data?.file_url||data?.url||data?.data?.file_url||data?.data?.url;
    if(!/^https?:\/\//i.test(String(fileUrl||"")))throw new Error("EvoLink file upload returned no public file_url.");
    return fileUrl;
  }
  async function hosted(list,offset){const out=[];for(let i=0;i<list.length;i++)out.push(await evoUpload(list[i].url,offset+i));return out;}

  function pricing(){
    const id=state.route,sec=Number(state.duration)||5;
    const p=window.KOSMIC_EVOLINK_VIDEO_PRICING?.[id]||{};
    if(isSeed25(id)){
      const q=state.quality||"720p";
      const rates=window.KOSMIC_EVOLINK_VIDEO_PRICING?.["seedance-2.5-reference-to-video"]?.rates||{output:{"480p":.138,"720p":.296,"1080p":.532},videoInput:{"480p":.084,"720p":.180,"1080p":.324}};
      const input=state.videos.reduce((n,v)=>n+(Number(v.duration)||0),0);const out=rates.output[q]||rates.output["720p"];const vin=rates.videoInput[q]||rates.videoInput["720p"];
      return{cost:sec*out+input*vin,unit:`${q} output · $${out.toFixed(3)}/s`,detail:input?`Includes ${input.toFixed(1)}s video input`:`${sec}s output`};
    }
    const q=state.quality;const out=p?.rates?.output?.[q]??p?.rates?.output?.["720p"];
    if(typeof out==="number")return{cost:sec*out,unit:`${q} · $${out.toFixed(3)}/s`,detail:`${sec}s output`};
    if(typeof p?.from==="number")return{cost:sec*p.from,unit:`$${p.from.toFixed(3)}/s`,detail:`${sec}s output`};
    return{cost:0,unit:"Provider pricing",detail:"Uses selected route"};
  }

  async function generateSingle(prompt,shotNo){
    const r=currentRoute();if(!r)throw new Error("Selected video route is unavailable.");
    const m=modeOf(r);const opts={duration:state.duration,quality:state.quality,aspect_ratio:state.aspect,generate_audio:!!state.audio,content_filter:state.content_filter!==false};
    if(state.webSearch&&isSeed25(state.route)&&m==="text")opts.model_params={web_search:true};
    let image_urls=[],video_urls=[],audio_urls=[];
    if(m==="image"){image_urls=await hosted(state.images.slice(0,1),0);}
    else if(m==="edit"||m==="extend"){video_urls=await hosted(state.videos.slice(0,1),0);}
    else if(m==="reference"){image_urls=await hosted(state.images.slice(0,30),0);video_urls=await hosted(state.videos.slice(0,10),30);audio_urls=await hosted(state.audios.slice(0,10),40);}
    Object.assign(opts,{image_urls,video_urls,audio_urls});
    const result=await window.generateEvoLinkVideo(state.route,prompt,opts);
    state.history.unshift({url:result.url,prompt,route:state.route,model:modelLabel(r),quality:state.quality,duration:state.duration,shot:shotNo||null,created:Date.now()});
    state.history=state.history.slice(0,18);
    return result.url;
  }

  async function generate(){
    if(state.busy)return;
    if(!apiKey()){toast("EvoLink is not configured in the existing API key settings.","error");return;}
    const prompt=$("kkv3Prompt")?.value.trim()||state.prompt.trim();
    if(!prompt){toast("Write a shot prompt first.","error");return;}
    normalize();state.busy=true;render();
    try{await generateSingle(prompt);state.prompt="";if($("kkv3Prompt"))$("kkv3Prompt").value="";toast("Video generated.","success");}
    catch(e){state.history.unshift({error:e?.message||String(e),prompt,route:state.route,created:Date.now()});state.history=state.history.slice(0,18);toast("❌ "+(e?.message||String(e)),"error");}
    finally{state.busy=false;render();}
  }

  async function generateStoryboard(){
    if(state.busy)return;
    if(!apiKey()){toast("EvoLink is not configured in the existing API key settings.","error");return;}
    const shots=state.storyboard.filter(s=>s.prompt.trim());if(!shots.length){toast("Add at least one storyboard shot.","error");return;}
    state.busy=true;render();
    try{for(let i=0;i<shots.length;i++){const previous=state.duration;state.duration=Math.max(Number(currentSchema().duration?.[0]??4),Math.min(Number(currentSchema().duration?.[1]??30),Number(shots[i].duration)||previous));normalize();await generateSingle(shots[i].prompt.trim(),i+1);}}
    catch(e){state.history.unshift({error:e?.message||String(e),prompt:"Storyboard generation",route:state.route,created:Date.now()});toast("❌ "+(e?.message||String(e)),"error");}
    finally{state.busy=false;render();}
  }

  function addShot(){state.storyboard.push({id:Date.now(),prompt:"",duration:state.duration});render();}
  function removeShot(id){if(state.storyboard.length===1)return;state.storyboard=state.storyboard.filter(s=>s.id!==id);render();}

  function insertPrompt(text){const area=$("kkv3Prompt");if(!area)return;applyPreset(text);area.focus();}
  function copyHistoryPrompt(i){const j=state.history[i];if(!j?.prompt)return;state.prompt=j.prompt;state.workspace="shot";render();}

  function historyHtml(){
    if(!state.history.length)return '<div class="kkv3-empty">Your generated clips will appear here.</div>';
    return state.history.map((j,i)=>j.error?`<div class="kkv3-error"><b>Generation error</b><br>${esc(j.error)}</div>`:`<article class="kkv3-job"><video src="${esc(j.url)}" controls playsinline></video><div class="kkv3-job-body"><div class="kkv3-job-top"><span>${esc(j.model||j.route||"Video")}${j.shot?` · Shot ${esc(j.shot)}`:""}</span><span>${esc(j.duration)}s · ${esc(j.quality)}</span></div><div class="kkv3-job-prompt">${esc(j.prompt)}</div><button class="kkv3-secondary" data-use-history="${i}">Use prompt</button></div></article>`).join("");
  }

  function referencesHtml(){
    const a=[];
    state.images.forEach((x,i)=>a.push(`<div class="kkv3-asset"><img src="${esc(x.url)}" alt=""><button class="kkv3-remove" data-remove-ref="images:${i}">×</button></div>`));
    state.videos.forEach((x,i)=>a.push(`<div class="kkv3-asset"><video src="${esc(x.url)}" muted></video><button class="kkv3-remove" data-remove-ref="videos:${i}">×</button></div>`));
    state.audios.forEach((x,i)=>a.push(`<div class="kkv3-asset"><audio src="${esc(x.url)}" controls></audio><button class="kkv3-remove" data-remove-ref="audios:${i}">×</button></div>`));
    return a.join("");
  }

  function routeControls(){
    const r=currentRoute(),s=currentSchema();const m=modeOf(r);const qualities=Array.isArray(s.quality)&&s.quality.length?s.quality:["720p"];const aspects=Array.isArray(s.aspect)&&s.aspect.length?s.aspect.map(v=>v==="auto"?"adaptive":v):["16:9","9:16"];const min=Number(s.duration?.[0]??4),max=Number(s.duration?.[1]??30);const lim=limits();
    return `<section class="kkv3-card"><h3>Shot controls <span>${esc(routeLabel(r))}</span></h3><div class="kkv3-grid"><div class="kkv3-field"><label>Duration <b>${state.duration}s</b></label><div class="kkv3-range"><input id="kkv3Duration" type="range" min="${min}" max="${max}" step="1" value="${state.duration}" ${min===max?"disabled":""}><input class="kkv3-input" id="kkv3DurationNum" type="number" min="${min}" max="${max}" step="1" value="${state.duration}" ${min===max?"disabled":""}></div></div><div class="kkv3-field"><label>Resolution</label><div class="kkv3-pills">${qualities.map(q=>`<button class="kkv3-pill ${state.quality===q?"active":""}" data-quality="${esc(q)}">${esc(q)}</button>`).join("")}</div></div></div><div class="kkv3-field" style="margin-top:10px"><label>Aspect ratio <small>${m!=="text"&&aspects.includes("adaptive")?"Adaptive is used on this route":"Model capability"}</small></label><div class="kkv3-pills">${aspects.map(a=>`<button class="kkv3-pill ${state.aspect===a?"active":""}" data-aspect="${esc(a)}">${esc(a)}</button>`).join("")}</div></div><div class="kkv3-grid" style="margin-top:10px"><div class="kkv3-field"><label>Audio <small>${s.audio===false?"unsupported":"route dependent"}</small></label><button class="kkv3-pill ${state.audio?"active":""}" id="kkv3Audio" ${s.audio===false?"disabled":""}>${state.audio?"On":"Off"}</button></div><div class="kkv3-field"><label>Content filter</label><button class="kkv3-pill ${state.content_filter!==false?"active":""}" id="kkv3Content">${state.content_filter!==false?"On":"Off"}</button></div></div>${s.webSearch||isSeed25(state.route)&&m==="text"?`<div class="kkv3-field" style="margin-top:10px"><label>Web search <small>Seedance 2.5</small></label><button class="kkv3-pill ${state.webSearch?"active":""}" id="kkv3WebSearch">${state.webSearch?"On":"Off"}</button></div>`:""}<div class="kkv3-keyhint"><strong>Reference limits:</strong> ${lim.images??0} images · ${lim.videos??0} videos · ${lim.audios??0} audio${lim.total?` · ${lim.total} total`:""}</div></section>`;
  }

  function refsSection(){
    const r=currentRoute(),m=modeOf(r),s=currentSchema();if(m==="text")return "";
    const imageMax=(s.refs?.images??(m==="image"?1:30));const videoMax=(s.refs?.videos??(m==="edit"||m==="extend"?1:10));const audioMax=(s.refs?.audios??10);
    return `<section class="kkv3-card"><h3>Reference media <span>${m==="reference"?"multi-reference":"required input"}</span></h3><div class="kkv3-dropgrid">${m==="image"||m==="reference"?`<label class="kkv3-drop">🖼 <strong>${m==="image"?"Start image":"Images"}</strong><span>${imageMax} max</span><input id="kkv3Images" type="file" accept="image/*" multiple></label>`:""}${m==="edit"||m==="extend"||m==="reference"?`<label class="kkv3-drop">🎞 <strong>Video</strong><span>${videoMax} max</span><input id="kkv3Videos" type="file" accept="video/*" multiple></label>`:""}${m==="reference"?`<label class="kkv3-drop">🎧 <strong>Audio</strong><span>${audioMax} max</span><input id="kkv3Audios" type="file" accept="audio/*" multiple></label>`:""}</div>${referencesHtml()?`<div class="kkv3-assets">${referencesHtml()}</div>`:""}</section>`;
  }

  function presetsSection(){
    const k=state.presetTab;return `<section class="kkv3-card"><h3>Director tools <span>prompt controls</span></h3><div class="kkv3-preset-tabs">${Object.keys(PRESETS).map(x=>`<button class="kkv3-preset-tab ${k===x?"active":""}" data-preset-tab="${x}">${x}</button>`).join("")}</div><div class="kkv3-chiprow">${PRESETS[k].map(x=>`<button class="kkv3-chip" data-preset="${esc(presetText(k,x))}">${esc(x)}</button>`).join("")}</div></section>`;
  }

  function shotWorkspace(){
    const modelNamesList=modelNames();const selectedModel=modelLabel(currentRoute());const routesForModel=sameModelRoutes();const p=pricing();
    return `<main class="kkv3-main"><section class="kkv3-card"><h3>Model & route</h3><div class="kkv3-modelbar"><select class="kkv3-select" id="kkv3Model">${modelNamesList.map(n=>`<option value="${esc(n)}" ${n===selectedModel?"selected":""}>${esc(n)}</option>`).join("")}</select><button class="kkv3-pill" id="kkv3Popular">Popular</button></div><div class="kkv3-routebar">${routesForModel.map(r=>`<button class="kkv3-route ${r.id===state.route?"active":""}" data-route="${esc(r.id)}">${esc(routeLabel(r))}</button>`).join("")}</div></section><section class="kkv3-card"><h3>Prompt</h3><textarea class="kkv3-input kkv3-prompt" id="kkv3Prompt" placeholder="Describe the shot, action, environment, camera, lighting, mood and timing...">${esc(state.prompt)}</textarea><div class="kkv3-toolbar"><span class="kkv3-small">Use director chips below to build a precise shot without hiding controls in another settings panel.</span><button class="kkv3-pill" id="kkv3ClearPrompt">Clear</button></div></section>${presetsSection()}${routeControls()}${refsSection()}<div class="kkv3-mobile-generate"><button class="kkv3-generate" id="kkv3GenerateMobile" ${state.busy||!apiKey()?"disabled":""}>${state.busy?"Generating…":"Generate video"}</button></div></main><aside class="kkv3-side"><section class="kkv3-card"><h3>Generation summary</h3><div class="kkv3-summary"><div class="kkv3-stat"><b>${state.duration}s</b><span>duration</span></div><div class="kkv3-stat"><b>${esc(state.quality)}</b><span>resolution</span></div><div class="kkv3-stat"><b>${esc(state.aspect)}</b><span>aspect</span></div><div class="kkv3-stat"><b>${p.cost?`$${p.cost.toFixed(3)}`:"—"}</b><span>${esc(p.unit)}</span></div></div><div class="kkv3-small" style="margin-top:8px">${esc(p.detail)}</div><button class="kkv3-generate" id="kkv3Generate" style="margin-top:10px" ${state.busy||!apiKey()?"disabled":""}>${state.busy?"Generating…":"Generate video"}</button>${!apiKey()?`<div class="kkv3-keyhint">Video generation uses the existing EvoLink API slot. Configure it in the app's existing API Settings.</div>`:""}</section><section class="kkv3-card"><h3>Output library <span>${state.history.length}</span></h3><div class="kkv3-history">${historyHtml()}</div></section></aside>`;
  }

  function storyboardWorkspace(){
    return `<main class="kkv3-main"><section class="kkv3-card"><h3>Storyboard <span>${state.storyboard.length} shots</span></h3><div class="kkv3-small" style="margin-bottom:10px">Plan a sequence before rendering. Each shot uses the same selected route and current model controls.</div>${state.storyboard.map((shot,i)=>`<div class="kkv3-shot" style="margin-top:${i?10:0}px"><div class="kkv3-shot-num">${i+1}</div><div class="kkv3-shot-main"><textarea class="kkv3-input" data-story-prompt="${shot.id}" rows="3" placeholder="Shot ${i+1}: action, camera, blocking, lighting...">${esc(shot.prompt)}</textarea><div class="kkv3-shot-actions"><button data-story-remove="${shot.id}">Remove</button><button data-story-copy="${shot.id}">Copy previous</button></div></div></div>`).join("")}<button class="kkv3-secondary" id="kkv3AddShot">+ Add shot</button></section>${presetsSection()}<section class="kkv3-card"><h3>Render sequence</h3>${routeControls()}<button class="kkv3-generate" id="kkv3StoryboardGenerate" ${state.busy||!apiKey()?"disabled":""}>${state.busy?"Rendering sequence…":"Generate storyboard"}</button></section></main><aside class="kkv3-side"><section class="kkv3-card"><h3>Sequence outputs</h3><div class="kkv3-history">${historyHtml()}</div></section></aside>`;
  }

  function render(){
    const host=$("kkVideoCanvasV3");if(!host)return;normalize();
    host.innerHTML=`<div class="kkv3-head"><div class="kkv3-brand">✦</div><div><div class="kkv3-title">Video Canvas</div><div class="kkv3-sub">Creator-first generation workspace · EvoLink routes</div></div><div class="kkv3-status"><i></i>Live generation</div></div><div class="kkv3-tabs"><button class="kkv3-tab ${state.workspace==="shot"?"active":""}" data-workspace="shot">Single Shot</button><button class="kkv3-tab ${state.workspace==="storyboard"?"active":""}" data-workspace="storyboard">Storyboard</button></div><div class="kkv3-body">${state.workspace==="storyboard"?storyboardWorkspace():shotWorkspace()}</div>`;
    bind();
  }

  function bind(){
    qAll("#kkVideoCanvasV3 [data-workspace]").forEach(b=>b.addEventListener("click",()=>{state.workspace=b.dataset.workspace;render();}));
    $("kkv3Model")?.addEventListener("change",e=>{const r=routes().find(x=>modelLabel(x)===e.target.value);if(r)setRoute(r.id);});
    qAll("#kkVideoCanvasV3 [data-route]").forEach(b=>b.addEventListener("click",()=>setRoute(b.dataset.route)));
    $("kkv3Prompt")?.addEventListener("input",e=>{state.prompt=e.target.value;});
    $("kkv3ClearPrompt")?.addEventListener("click",()=>{state.prompt="";render();});
    qAll("#kkVideoCanvasV3 [data-preset-tab]").forEach(b=>b.addEventListener("click",()=>{state.presetTab=b.dataset.presetTab;render();}));
    qAll("#kkVideoCanvasV3 [data-preset]").forEach(b=>b.addEventListener("click",()=>insertPrompt(b.dataset.preset)));
    const dur=$("kkv3Duration"),num=$("kkv3DurationNum");dur?.addEventListener("input",e=>{state.duration=Number(e.target.value);if(num)num.value=state.duration;renderCostOnly();});num?.addEventListener("change",e=>{state.duration=Number(e.target.value);normalize();render();});
    qAll("#kkVideoCanvasV3 [data-quality]").forEach(b=>b.addEventListener("click",()=>{state.quality=b.dataset.quality;render();}));
    qAll("#kkVideoCanvasV3 [data-aspect]").forEach(b=>b.addEventListener("click",()=>{state.aspect=b.dataset.aspect;render();}));
    $("kkv3Audio")?.addEventListener("click",()=>{state.audio=!state.audio;render();});
    $("kkv3Content")?.addEventListener("click",()=>{state.content_filter=state.content_filter===false;render();});
    $("kkv3WebSearch")?.addEventListener("click",()=>{state.webSearch=!state.webSearch;render();});
    $("kkv3Images")?.addEventListener("change",e=>addFiles("images",e.target.files));$("kkv3Videos")?.addEventListener("change",e=>addFiles("videos",e.target.files));$("kkv3Audios")?.addEventListener("change",e=>addFiles("audios",e.target.files));
    qAll("#kkVideoCanvasV3 [data-remove-ref]").forEach(b=>b.addEventListener("click",()=>{const [k,i]=b.dataset.removeRef.split(":");removeRef(k,Number(i));}));
    $("kkv3Generate")?.addEventListener("click",generate);$("kkv3GenerateMobile")?.addEventListener("click",generate);$("kkv3StoryboardGenerate")?.addEventListener("click",generateStoryboard);
    $("kkv3AddShot")?.addEventListener("click",addShot);
    qAll("#kkVideoCanvasV3 [data-story-prompt]").forEach(el=>el.addEventListener("input",e=>{const x=state.storyboard.find(s=>String(s.id)===String(e.target.dataset.storyPrompt));if(x)x.prompt=e.target.value;}));
    qAll("#kkVideoCanvasV3 [data-story-remove]").forEach(b=>b.addEventListener("click",()=>removeShot(b.dataset.storyRemove)));
    qAll("#kkVideoCanvasV3 [data-story-copy]").forEach(b=>b.addEventListener("click",()=>{const i=state.storyboard.findIndex(s=>String(s.id)===String(b.dataset.storyCopy));if(i>0)state.storyboard[i].prompt=state.storyboard[i-1].prompt;render();}));
    qAll("#kkVideoCanvasV3 [data-use-history]").forEach(b=>b.addEventListener("click",()=>copyHistoryPrompt(Number(b.dataset.useHistory))));
  }
  function renderCostOnly(){const p=pricing();const el=document.querySelector("#kkVideoCanvasV3 .kkv3-stat:nth-child(4) b");if(el)el.textContent=p.cost?`$${p.cost.toFixed(3)}`:"—";const note=document.querySelector("#kkVideoCanvasV3 .kkv3-small");}

  function mount(){
    injectCss();const mc=$("moduleContent");if(!mc)return false;
    const active=mc.querySelector("#vcSettingsPanel,#vcSettingsBackdrop,.vc-chat-shell,.video-canvas,#vcModel,.video-studio,#vcGalleryView");
    if(!active&&!mc.querySelector("#kkVideoCanvasV3"))return false;
    if(mc.querySelector("#kkVideoCanvasV3"))return true;
    mc.innerHTML='<div id="kkVideoCanvasV3" class="kk-video-v3-host"></div>';render();return true;
  }
  function boot(){return !!window.KOSMIC_EVOLINK_VIDEO?.index&&mount();}
  let tries=0;const timer=setInterval(()=>{if(boot()||++tries>240)clearInterval(timer);},100);
  const mo=new MutationObserver(()=>{if(mount())mo.disconnect();});mo.observe(document.body,{childList:true,subtree:true});
})();

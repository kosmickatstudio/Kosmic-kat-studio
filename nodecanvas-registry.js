// ══════════════════════════════════════════════════════════════════════
// NODE CANVAS REGISTRY — pure node-type definitions for nodecanvas.js.
//
// The canvas engine (graph store, executor, persistence, UI) knows nothing
// about specific nodes: everything a node type is lives in one object here.
// Adding a node = one NC_REGISTRY.register({...}) call, no engine edits.
// Other modules can register their own node types the same way.
//
// A definition:
//   type, label, short, icon, color, group, desc
//   inputs  : port specs  {id,label,accepts:[types]}  or a numbered family
//             {prefix:"in_ref_",count:16,label:i=>"Ref "+i,accepts:[...]}
//   outputs : {id,label,type}
//   instant : true → no API call (sources / pure transforms). Runs for free,
//             and downstream nodes always read its CURRENT value.
//   noRun   : true → no Run button (notes)
//   defaults()                → fresh node.data
//   valid(node,ctx)           → error string or null (instant nodes only)
//   value(node,portId,ctx)    → what an output port currently carries
//   body(node,H)              → inner HTML of the node card
//   run(node,ctx)  (async)    → does the work, writes node.data / node.meta
//   estimate(node)            → USD estimate for one run, or null
//   result(node)              → {kind:'image'|'video'|'audio',url,prompt} | null
//
// Port types: text · image · video · audio.  Connections are type-checked.
//
// ctx given to value()/valid()/run():
//   ctx.get(portId)   value arriving on that input (or null)
//   ctx.all(prefix)   every connected value on ports starting with prefix
//   ctx.ensureUrl(v)  turns a data: URL into a hosted https URL (fal storage)
//   ctx.toast(msg,type)
// ══════════════════════════════════════════════════════════════════════
(function(){
  "use strict";

  const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const REG={types:{},order:[],groups:["Inputs","Generate","Process","Notes"]};

  // Numbered port families ("in_ref_1".."in_ref_16") expand to plain ports so
  // saved graphs keep their existing port ids.
  REG.expand=function(specs){
    const out=[];
    (specs||[]).forEach(s=>{
      if(s.prefix){
        for(let i=1;i<=s.count;i++)out.push({portId:s.prefix+i,label:typeof s.label==="function"?s.label(i):`${s.label} ${i}`,accepts:s.accepts||[],type:s.type});
      }else out.push({portId:s.id,label:s.label,accepts:s.accepts||[],type:s.type});
    });
    return out;
  };
  REG.register=function(def){
    if(!def||!def.type||!def.label)throw new Error("NC_REGISTRY.register: type and label are required");
    def.color=def.color||"#8B5CF6";
    def.group=def.group||"Generate";
    def.inputs=def.inputs||[];def.outputs=def.outputs||[];
    def.inputPorts=REG.expand(def.inputs);
    def.outputPorts=REG.expand(def.outputs);
    def.defaults=def.defaults||(()=>({}));
    def.body=def.body||(()=>"");
    if(!REG.types[def.type])REG.order.push(def.type);
    REG.types[def.type]=def;
    return def;
  };
  REG.get=t=>REG.types[t]||null;
  REG.list=()=>REG.order.map(t=>REG.types[t]);

  // ── body helpers ──────────────────────────────────────────────────
  // Everything routes through NodeCanvas.setField so edits mark the node
  // (and everything downstream of it) stale and are saved with undo support.
  const H={
    esc,
    label:t=>`<label class="nc-field-label">${esc(t)}</label>`,
    select(node,field,opts,o){
      o=o||{};
      const cur=o.cur!==undefined?o.cur:node.data[field];
      const flags=(o.num?"n":"")+(o.rerender?"r":"");
      return `<select onchange="NodeCanvas.setField('${node.id}','${field}',this.value,'${flags}')">`+
        opts.map(x=>{
          const v=typeof x==="object"?x.v:x,t=typeof x==="object"?x.t:x;
          return `<option value="${esc(v)}"${String(cur)===String(v)?" selected":""}>${esc(t)}</option>`;
        }).join("")+`</select>`;
    },
    area(node,field,ph,rows){
      return `<textarea rows="${rows||3}" placeholder="${esc(ph||"")}" oninput="NodeCanvas.setField('${node.id}','${field}',this.value,'t')">${esc(node.data[field]||"")}</textarea>`;
    },
    hint(text,warn){return `<div class="nc-hint${warn?" nc-hint-warn":""}">${esc(text)}</div>`;},
    media(kind,url){
      if(!url)return "";
      const u=esc(url);
      if(kind==="image")return `<img src="${u}" loading="lazy" onerror="NodeCanvas._imgFail(this)">`;
      if(kind==="video")return `<video src="${u}" controls playsinline preload="metadata"></video>`;
      if(kind==="audio")return `<audio src="${u}" controls></audio>`;
      return "";
    },
    upload(node,kind,accept,labelText){
      const id=`ncUpload_${node.id}`;
      return `<button class="btn btn-outline btn-xs btn-full" onclick="document.getElementById('${id}').click()">${labelText}</button>`+
        `<input type="file" id="${id}" accept="${accept}" style="display:none" onchange="NodeCanvas.uploadMedia('${node.id}',event,'${kind}')">`;
    },
  };

  // ── shared tables ─────────────────────────────────────────────────
  const IMAGE_MODELS=[
    {v:"fal-ai/flux/dev",t:"FLUX Dev — up to 4 refs",max:4},
    {v:"fal-ai/flux-pro/v1.1",t:"FLUX Pro — up to 4 refs",max:4},
    {v:"fal-ai/nano-banana-2",t:"Nano Banana 2 — up to 14 refs",max:14,edit:"fal-ai/nano-banana-2/edit"},
    {v:"fal-ai/nano-banana-pro",t:"Nano Banana Pro — up to 2 refs",max:2,edit:"fal-ai/nano-banana-pro/edit"},
    {v:"openai/gpt-image-2",t:"GPT Image 2 — up to 16 refs",max:16,edit:"openai/gpt-image-2/edit"},
  ];
  const IMAGE_MODEL_BY=Object.fromEntries(IMAGE_MODELS.map(m=>[m.v,m]));

  // Video models reachable through the fal queue (EvoLink models live in
  // Video Studio). kind drives body building + reference limits.
  const VIDEO_MODELS=[
    {v:"bytedance/seedance-2.0/reference-to-video",t:"Seedance 2.0",kind:"seedance"},
    {v:"bytedance/seedance-2.0/fast/reference-to-video",t:"Seedance 2.0 Fast",kind:"seedance"},
    {v:"blackforestlabs/flux-3-max/text-to-video",t:"FLUX 3 Max",kind:"flux3"},
    {v:"fal-ai/kling-video/v2.1/master/text-to-video",t:"Kling 2.1 Master",kind:"kling1"},
    {v:"fal-ai/kling-video/v2.6/pro/text-to-video",t:"Kling 2.6 Pro",kind:"kling1"},
    {v:"fal-ai/kling-video/v3/standard/text-to-video",t:"Kling 3.0 Standard",kind:"kling"},
    {v:"fal-ai/kling-video/v3/pro/text-to-video",t:"Kling 3.0 Pro",kind:"kling"},
    {v:"fal-ai/kling-video/o3/pro/reference-to-video",t:"Kling O3 Pro",kind:"klingo3"},
    {v:"fal-ai/veo3.1",t:"Veo 3.1",kind:"veo"},
  ];
  const VIDEO_MODEL_BY=Object.fromEntries(VIDEO_MODELS.map(m=>[m.v,m]));
  // What each kind actually accepts (images / videos / audios) + a one-liner.
  const VIDEO_KIND={
    seedance:{img:9,vid:3,aud:3,total:12,short:"9 img · 3 vid · 3 aud",note:"up to 9 images · 3 videos · 3 audio (12 files max)"},
    flux3:{img:2,vid:0,aud:0,short:"start + end frame",note:"image 1 = start frame, image 2 = end frame"},
    kling1:{img:1,vid:0,aud:0,short:"1 image",note:"1 start image"},
    kling:{img:4,vid:0,aud:0,short:"4 images",note:"up to 4 reference images (characters)"},
    klingo3:{img:4,vid:2,aud:0,short:"4 img + 2 vid",note:"up to 4 images + 2 videos, at least one required"},
    veo:{img:0,vid:0,aud:0,short:"prompt only",note:"prompt only — references are ignored"},
  };
  const kindOf=m=>(VIDEO_MODEL_BY[m]||{}).kind||"seedance";
  const vidLabel=m=>(VIDEO_MODEL_BY[m]||{}).t||m;
  const videoOptions=()=>VIDEO_MODELS.map(m=>({v:m.v,t:`${m.t} — ${VIDEO_KIND[m.kind].short}`}));
  // Globals declared with const/let in other classic scripts (S, STYLE_LIBRARY,
  // VIDEO_MODEL_*…) are NOT window properties, so they are read through
  // explicit thunks. typeof guards keep a missing global from throwing.
  const GL={
    S:()=>typeof S!=="undefined"?S:{},
    STYLE_LIBRARY:()=>typeof STYLE_LIBRARY!=="undefined"?STYLE_LIBRARY:[],
    VIDEO_MODEL_CAPABILITIES:()=>typeof VIDEO_MODEL_CAPABILITIES!=="undefined"?VIDEO_MODEL_CAPABILITIES:{},
    VIDEO_MODEL_DURATIONS:()=>typeof VIDEO_MODEL_DURATIONS!=="undefined"?VIDEO_MODEL_DURATIONS:{},
    VIDEO_MODEL_RESOLUTIONS:()=>typeof VIDEO_MODEL_RESOLUTIONS!=="undefined"?VIDEO_MODEL_RESOLUTIONS:{},
    PD_ASPECT_RATIOS:()=>typeof PD_ASPECT_RATIOS!=="undefined"?PD_ASPECT_RATIOS:{},
    IMAGE_TO_VIDEO_MAP:()=>typeof IMAGE_TO_VIDEO_MAP!=="undefined"?IMAGE_TO_VIDEO_MAP:{},
  };
  const g=n=>{const f=GL[n];return f?f():undefined;};
  const FN={
    estimateImageCost:()=>typeof estimateImageCost==="function"?estimateImageCost:null,
    estimateVideoCost:()=>typeof estimateVideoCost==="function"?estimateVideoCost:null,
    genViaGemini:()=>typeof genViaGemini==="function"?genViaGemini:null,
    genViaFluxEdit:()=>typeof genViaFluxEdit==="function"?genViaFluxEdit:null,
    genViaFal:()=>typeof genViaFal==="function"?genViaFal:null,
    genViaKlingO3Reference:()=>typeof genViaKlingO3Reference==="function"?genViaKlingO3Reference:null,
    normalizeElementTags:()=>typeof normalizeElementTags==="function"?normalizeElementTags:null,
    normalizeKlingV3Body:()=>typeof normalizeKlingV3Body==="function"?normalizeKlingV3Body:null,
    extractLastFrameFromVideo:()=>typeof extractLastFrameFromVideo==="function"?extractLastFrameFromVideo:null,
    rehostToStorage:()=>typeof rehostToStorage==="function"?rehostToStorage:null,
    elVoiceLock:()=>typeof elVoiceLock==="function"?elVoiceLock:null,
    upscaleImageUrl:()=>typeof upscaleImageUrl==="function"?upscaleImageUrl:null,
  };
  const fn=n=>{const f=FN[n]&&FN[n]();if(!f)throw new Error(`${n}() isn't available — reload the app`);return f;};
  const fnOpt=n=>{try{return FN[n]&&FN[n]();}catch(e){return null;}};
  const ASPECTS_ALL=["16:9","9:16","1:1","4:3","3:4"];

  const TTS_MODELS=[
    {v:"eleven_multilingual_v2",t:"Multilingual v2"},
    {v:"eleven_flash_v2_5",t:"Flash v2.5 (fast)"},
    {v:"eleven_turbo_v2_5",t:"Turbo v2.5"},
    {v:"eleven_v3",t:"Eleven v3 (expressive)"},
  ];

  // ═════════════ INPUT NODES (instant) ═════════════
  REG.register({
    type:"promptText",label:"Prompt",short:"PROMPT",icon:"✎",color:"#8B5CF6",group:"Inputs",instant:true,
    desc:"Text prompt that feeds image, video and voice nodes.",
    outputs:[{id:"out_1",label:"Text",type:"text"}],
    defaults:()=>({text:""}),
    valid:n=>n.data.text&&n.data.text.trim()?null:"Type a prompt first",
    value:n=>n.data.text,
    body:n=>H.area(n,"text","Type a prompt…",4),
  });

  REG.register({
    type:"promptMix",label:"Prompt Mix",short:"MIX",icon:"⊕",color:"#A855F7",group:"Inputs",instant:true,
    desc:"Joins several texts (e.g. a Style + a Prompt) into one prompt.",
    inputs:[{prefix:"in_txt_",count:4,label:"Text",accepts:["text"]}],
    outputs:[{id:"out_1",label:"Text",type:"text"}],
    defaults:()=>({sep:"line"}),
    valid:(n,ctx)=>ctx.all("in_txt_").some(v=>String(v).trim())?null:"Connect at least one text",
    value:(n,p,ctx)=>{
      const sep={line:"\n",comma:", ",space:" "}[n.data.sep]||"\n";
      return ctx.all("in_txt_").map(v=>String(v).trim()).filter(Boolean).join(sep);
    },
    body:n=>H.label("Join with")+H.select(n,"sep",[{v:"line",t:"New line"},{v:"comma",t:"Comma"},{v:"space",t:"Space"}])+H.hint("Connect up to 4 texts"),
  });

  REG.register({
    type:"styleRef",label:"Style Reference",short:"STYLE",icon:"✦",color:"#6B7280",group:"Inputs",instant:true,
    desc:"A look from the style library, as text. Mix it into a prompt.",
    outputs:[{id:"out_1",label:"Style",type:"text"}],
    defaults:()=>({styleName:(g("STYLE_LIBRARY")||[])[0]?.name||""}),
    valid:n=>n.data.styleName?null:"Pick a style",
    value:n=>{
      const s=(g("STYLE_LIBRARY")||[]).find(x=>x.name===n.data.styleName);
      return s?`in the style of ${s.name}: ${s.style}`:n.data.styleName;
    },
    body:n=>H.select(n,"styleName",(g("STYLE_LIBRARY")||[]).map(s=>s.name))+H.hint("Output is text — use Prompt Mix to combine it with a prompt"),
  });

  REG.register({
    type:"referenceImage",label:"Reference Image",short:"REF",icon:"🖼",color:"#22D3EE",group:"Inputs",instant:true,
    desc:"Upload an image to use as a reference or start frame.",
    outputs:[{id:"out_1",label:"Image",type:"image"}],
    defaults:()=>({url:null,uploadedAt:null}),
    valid:n=>n.data.url?null:"Upload an image first",
    value:n=>n.data.url,
    body:n=>H.media("image",n.data.url)+H.upload(n,"image","image/*",n.data.url?"🔄 Replace":"📤 Upload Image"),
  });

  REG.register({
    type:"referenceVideo",label:"Reference Video",short:"VREF",icon:"🎞",color:"#38BDF8",group:"Inputs",instant:true,
    desc:"Upload a video for Seedance / Kling O3 reference inputs.",
    outputs:[{id:"out_1",label:"Video",type:"video"}],
    defaults:()=>({url:null,uploadedAt:null}),
    valid:n=>n.data.url?null:"Upload a video first",
    value:n=>n.data.url,
    body:n=>H.media("video",n.data.url)+H.upload(n,"video","video/*",n.data.url?"🔄 Replace":"📤 Upload Video"),
  });

  REG.register({
    type:"referenceAudio",label:"Reference Audio",short:"AREF",icon:"♪",color:"#F472B6",group:"Inputs",instant:true,
    desc:"Upload audio for Seedance reference inputs.",
    outputs:[{id:"out_1",label:"Audio",type:"audio"}],
    defaults:()=>({url:null,uploadedAt:null}),
    valid:n=>n.data.url?null:"Upload audio first",
    value:n=>n.data.url,
    body:n=>H.media("audio",n.data.url)+H.upload(n,"audio","audio/*",n.data.url?"🔄 Replace":"📤 Upload Audio"),
  });

  REG.register({
    type:"characterSheet",label:"Character Sheet",short:"CHAR",icon:"☾",color:"#F59E0B",group:"Inputs",instant:true,
    desc:"A view from an approved character sheet in Productions.",
    outputs:[{id:"out_1",label:"Character",type:"image"}],
    defaults:()=>({sourceProductionId:null,view:"threeQuarter"}),
    valid:n=>n.data.sourceProductionId?null:"Pick a production first",
    value:n=>{
      const p=(g("S").productions||[]).find(x=>x.id===n.data.sourceProductionId);
      return p&&p.characterSheet?p.characterSheet[n.data.view]||null:null;
    },
    body:n=>{
      const all=g("S").productions||[];
      const prods=all.filter(p=>p.characterSheetStatus==="approved");
      const p=all.find(x=>x.id===n.data.sourceProductionId);
      const url=p&&p.characterSheet?p.characterSheet[n.data.view]:null;
      return H.select(n,"sourceProductionId",[{v:"",t:"Select production…"}].concat(prods.map(x=>({v:x.id,t:x.title||x.id}))),{rerender:true})+
        H.select(n,"view",["front","back","side","threeQuarter","face","special"],{rerender:true})+
        (url?`<div style="margin-top:6px">${H.media("image",url)}</div>`:(n.data.sourceProductionId?H.hint("No image for this view yet",true):""));
    },
  });

  // ═════════════ GENERATE NODES ═════════════
  REG.register({
    type:"generatedImage",label:"Generated Image",short:"IMAGE",icon:"✺",color:"#10B981",group:"Generate",
    desc:"Text-to-image, or image-to-image with connected references.",
    inputs:[{id:"in_1",label:"Prompt",accepts:["text"]},{prefix:"in_ref_",count:16,label:"Ref",accepts:["image"]}],
    outputs:[{id:"out_1",label:"Image",type:"image"}],
    defaults:()=>({model:"fal-ai/flux/dev",resultUrl:null,manualPrompt:"",aspectRatio:"1:1",params:{}}),
    result:n=>n.data.resultUrl?{kind:"image",url:n.data.resultUrl,prompt:n.data.manualPrompt||"Node Canvas image",model:n.data.model}:null,
    estimate:n=>{try{const e=fn("estimateImageCost")(n.data.model,1);return e?e.cost:null;}catch(x){return null;}},
    body(n,Hh){
      const m=IMAGE_MODEL_BY[n.data.model]||IMAGE_MODELS[0];
      const refs=n.inputs.filter(p=>p.portId.startsWith("in_ref_")&&p.connectedEdgeId).length;
      return H.media("image",n.data.resultUrl)+H.area(n,"manualPrompt","Manual prompt (used if nothing connected)",3)+
        H.label("Model")+H.select(n,"model",IMAGE_MODELS.map(x=>({v:x.v,t:x.t})),{rerender:true})+
        H.hint(`${refs}/${m.max} reference images connected${refs>m.max?" — extras will be ignored on Run":""}`,refs>m.max)+
        H.label("Aspect Ratio")+H.select(n,"aspectRatio",ASPECTS_ALL);
    },
    async run(node,ctx){
      const prompt=ctx.get("in_1")||node.data.manualPrompt;
      if(!prompt)throw new Error("No prompt — connect a Prompt node or type one on this node");
      const all=ctx.all("in_ref_");
      const ar=node.data.aspectRatio||"1:1",model=node.data.model;
      const m=IMAGE_MODEL_BY[model]||IMAGE_MODELS[0];
      let result;
      if(String(model).startsWith("gemini-")){
        const refs=all.slice(0,4);
        if(all.length>4)ctx.toast(`⚠️ ${model} supports up to 4 reference images — using the first 4 of ${all.length}`,"error");
        result=await fn("genViaGemini")(prompt,ar,model,refs);
      }else if(m.edit&&all.length){
        const refs=all.slice(0,m.max);
        if(all.length>m.max)ctx.toast(`⚠️ This model supports up to ${m.max} reference images — using the first ${m.max} of ${all.length}`,"error");
        result=await fn("genViaFluxEdit")(prompt,refs,ar,m.edit);
      }else if(all.length){
        const refs=all.slice(0,4);
        if(all.length>4)ctx.toast(`⚠️ This model supports up to 4 reference images — using the first 4 of ${all.length}`,"error");
        result=await fn("genViaFluxEdit")(prompt,refs,ar);
      }else{
        result=await fn("genViaFal")(prompt,"",model,ar,false);
      }
      node.data.resultUrl=result.url;
      const est=this.estimate(node);
      node.meta.model=model;node.meta.cost=est||0;
      ctx.log(model,"Node Canvas — Generated Image",1,null);
    },
  });

  REG.register({
    type:"videoClip",label:"Video Clip",short:"VIDEO",icon:"▶",color:"#3B82F6",group:"Generate",
    desc:"Seedance, FLUX 3 Max, Kling or Veo. Outputs the video and its real last frame.",
    inputs:[
      {id:"in_1",label:"Prompt",accepts:["text"]},
      {prefix:"in_img_",count:9,label:i=>i===1?"Image Ref 1 / Start Frame":`Image Ref ${i}`,accepts:["image"]},
      {prefix:"in_vid_",count:3,label:"Video Ref",accepts:["video"]},
      {prefix:"in_aud_",count:3,label:"Audio Ref",accepts:["audio"]},
    ],
    outputs:[{id:"out_1",label:"Video",type:"video"},{id:"out_2",label:"Last Frame",type:"image"}],
    defaults:()=>({model:"bytedance/seedance-2.0/reference-to-video",resultUrl:null,lastFrameUrl:null,duration:5,resolution:"720p",aspectRatio:"16:9",manualPrompt:""}),
    value:(n,p)=>p==="out_2"?n.data.lastFrameUrl:n.data.resultUrl,
    result:n=>n.data.resultUrl?{kind:"video",url:n.data.resultUrl,prompt:n.data.manualPrompt||"Node Canvas video",model:n.data.model,duration:n.data.duration,resolution:n.data.resolution,aspectRatio:n.data.aspectRatio}:null,
    estimate:n=>{
      try{
        const cap=(g("VIDEO_MODEL_CAPABILITIES")||{})[n.data.model]||{};
        const vids=n.inputs.filter(p=>p.portId.startsWith("in_vid_")&&p.connectedEdgeId).length;
        const imgs=n.inputs.filter(p=>p.portId.startsWith("in_img_")&&p.connectedEdgeId).length;
        const e=fn("estimateVideoCost")(n.data.model,n.data.duration||5,n.data.resolution||"720p",vids>0,!!(cap.elements&&imgs>1));
        return e?e.cost:null;
      }catch(x){return null;}
    },
    // Durations / resolutions / ratios are read per model from the same tables
    // Video Studio uses, so the node can never offer a value the model rejects.
    optionsFor(model){
      const dur=((g("VIDEO_MODEL_DURATIONS")||{})[model]||{}).options||[4,5,6,8];
      const res=(g("VIDEO_MODEL_RESOLUTIONS")||{})[model]||null;
      const ar=(g("PD_ASPECT_RATIOS")||{})[model]||ASPECTS_ALL;
      return {dur,res,ar};
    },
    // Switching model re-validates duration / resolution / aspect against the
    // new model's real option lists, so a saved value can't go stale.
    onChange(node,field){
      if(field!=="model")return;
      const o=this.optionsFor(node.data.model);
      if(!o.dur.includes(node.data.duration))node.data.duration=o.dur.includes(5)?5:o.dur[0];
      if(o.res&&!o.res.includes(node.data.resolution))node.data.resolution=o.res.includes("720p")?"720p":o.res[0];
      if(!o.ar.includes(node.data.aspectRatio))node.data.aspectRatio=o.ar[0];
    },
    body(n){
      const k=kindOf(n.data.model),caps=VIDEO_KIND[k];
      const cnt=pre=>n.inputs.filter(p=>p.portId.startsWith(pre)&&p.connectedEdgeId).length;
      const ni=cnt("in_img_"),nv=cnt("in_vid_"),na=cnt("in_aud_");
      const over=ni>caps.img||nv>caps.vid||na>caps.aud||(caps.total&&ni+nv+na>caps.total);
      const o=this.optionsFor(n.data.model);
      const row=(lbl,html)=>`<div style="flex:1;min-width:0">${H.label(lbl)}${html}</div>`;
      return H.media("video",n.data.resultUrl)+H.area(n,"manualPrompt","Manual prompt (used if nothing connected)",3)+
        H.label("Video Model")+H.select(n,"model",videoOptions(),{rerender:true})+
        H.hint(`${caps.note}`)+
        H.hint(`${ni} img · ${nv} vid · ${na} audio connected${over?" — extras are ignored or rejected":""}`,over)+
        `<div class="nc-inline-row">`+
          (o.res?row("Res",H.select(n,"resolution",o.res)):"")+
          row("Duration",H.select(n,"duration",o.dur.map(d=>({v:d,t:d+"s"})),{num:true}))+
          row("Aspect",H.select(n,"aspectRatio",o.ar))+
        `</div>`;
    },
    async run(node,ctx){
      const model=node.data.model,kind=kindOf(model),caps=VIDEO_KIND[kind];
      const prompt=ctx.get("in_1")||node.data.manualPrompt;
      let imgs=ctx.all("in_img_"),vids=ctx.all("in_vid_"),auds=ctx.all("in_aud_");
      if(!prompt&&!imgs.length)throw new Error("No prompt or reference image connected");
      if(!gs("api_falai",""))throw new Error("Add a fal.ai API key in Settings first");
      const dropped=[];
      if(caps.vid===0&&vids.length){dropped.push("videos");vids=[];}
      if(caps.aud===0&&auds.length){dropped.push("audio");auds=[];}
      if(caps.img===0&&imgs.length){dropped.push("images");imgs=[];}
      if(dropped.length)ctx.toast(`⚠️ ${vidLabel(model)} ignores connected ${dropped.join(" & ")}`,"error");
      if(caps.img&&imgs.length>caps.img&&kind!=="seedance"){
        ctx.toast(`ℹ️ ${vidLabel(model)} uses only the first ${caps.img} image(s) — the rest were ignored`,"error");
        imgs=imgs.slice(0,caps.img);
      }
      if(kind==="seedance"&&imgs.length+vids.length+auds.length>caps.total)
        throw new Error(`Too many references (${imgs.length+vids.length+auds.length}) — Seedance 2.0 allows ${caps.total} files in total`);
      if(kind==="klingo3"&&!imgs.length&&!vids.length)throw new Error("Kling O3 Pro needs at least one reference image or video");
      if(kind==="klingo3"&&vids.length>2)throw new Error("Kling O3 Pro allows up to 2 reference videos");
      // Hosted URLs only — local uploads that fell back to a data: URL are
      // pushed to fal storage first.
      imgs=await Promise.all(imgs.map(ctx.ensureUrl));vids=await Promise.all(vids.map(ctx.ensureUrl));auds=await Promise.all(auds.map(ctx.ensureUrl));

      const fmt=((g("VIDEO_MODEL_DURATIONS")||{})[model]||{}).format||String;
      const dur=node.data.duration||5,ar=node.data.aspectRatio||"16:9",res=node.data.resolution||"720p";
      const fallbackPrompt=prompt||"Continue the scene naturally.";
      let videoUrl;
      if(kind==="klingo3"){
        videoUrl=await fn("genViaKlingO3Reference")(fn("normalizeElementTags")(fallbackPrompt),ar,dur,imgs,vids);
      }else{
        const body={prompt:fallbackPrompt,aspect_ratio:ar};
        let endpoint=model;
        const i2v=(g("IMAGE_TO_VIDEO_MAP")||{})[model];
        if(kind==="seedance"){
          body.duration=String(dur);body.resolution=res;
          if(imgs.length)body.image_urls=imgs;if(vids.length)body.video_urls=vids;if(auds.length)body.audio_urls=auds;
        }else if(kind==="flux3"){
          body.duration=fmt(dur);body.resolution=res;body.generate_audio=true;
          if(imgs.length&&i2v){endpoint=i2v.endpoint;body[i2v.field]=imgs[0];if(imgs[1]&&i2v.endField)body[i2v.endField]=imgs[1];}
        }else if(kind==="veo"){
          body.duration=fmt(dur);body.audio=true;body.resolution=res;
        }else{ // kling family — resolution is fixed per tier, not a request field
          body.duration=fmt(dur);
          const cap=(g("VIDEO_MODEL_CAPABILITIES")||{})[model]||{};
          if(imgs.length&&i2v){
            endpoint=i2v.endpoint;body[i2v.field]=imgs[0];
            if(cap.elements&&imgs.length>1){
              body.prompt=fn("normalizeElementTags")(fallbackPrompt);
              body.elements=imgs.map(u=>({frontal_image_url:u}));
            }
          }
          const nk=fnOpt("normalizeKlingV3Body");if(nk)nk(endpoint,body);
        }
        videoUrl=(await ctx.falVideo(endpoint,body)).videoUrl;
      }
      node.data.resultUrl=videoUrl;
      // The REAL last frame (canvas grab of the finished clip) — this is what
      // makes "last frame → next shot" chaining work. If the browser can't
      // read the frame (CORS), the output stays empty rather than lying.
      let last=null;
      try{
        last=await fn("extractLastFrameFromVideo")(videoUrl);
        try{const rh=fnOpt("rehostToStorage");if(rh){const h=await rh(last,"node-canvas-frames");if(h)last=h;}}catch(e){}
      }catch(e){console.warn("Node Canvas: last-frame extraction failed:",e.message);}
      node.data.lastFrameUrl=last;
      const est=this.estimate(node);
      node.meta.model=model;node.meta.cost=est||0;
      ctx.log(model,"Node Canvas — Video Clip",1,est);
    },
  });

  REG.register({
    type:"audioTTS",label:"Audio / TTS",short:"AUDIO",icon:"♫",color:"#EC4899",group:"Generate",
    desc:"ElevenLabs voice-over from connected or typed text.",
    inputs:[{id:"in_1",label:"Text",accepts:["text"]}],
    outputs:[{id:"out_1",label:"Audio",type:"audio"}],
    defaults:()=>({voiceId:(typeof gs==="function"?gs("elevenlabs_voice","21m00Tcm4TlvDq8ikWAM"):"21m00Tcm4TlvDq8ikWAM"),model:"eleven_multilingual_v2",resultUrl:null,manualText:""}),
    result:n=>n.data.resultUrl?{kind:"audio",url:n.data.resultUrl,prompt:n.data.manualText||"Node Canvas voice-over"}:null,
    body(n){
      const voices=(g("S")||{}).elevenLabsVoicesCache||[];
      const known=voices.some(v=>v.id===n.data.voiceId);
      const lock=v=>{try{const f=fnOpt("elVoiceLock");return f?f(v):null;}catch(e){return null;}};
      const vopts=voices.length
        ?voices.map(v=>({v:v.id,t:(lock(v)?"🔒 ":"")+v.name+(v.sub?` — ${v.sub}`:"")})).concat(known?[]:[{v:n.data.voiceId,t:"Current voice ("+n.data.voiceId.slice(0,6)+"…)"}])
        :[{v:n.data.voiceId,t:"Current voice ("+String(n.data.voiceId).slice(0,6)+"…)"}];
      return H.media("audio",n.data.resultUrl)+H.area(n,"manualText","Manual text (used if nothing connected)",3)+
        H.label("Voice")+H.select(n,"voiceId",vopts)+
        (voices.length?"":`<button class="btn btn-outline btn-xs btn-full" style="margin-top:4px" onclick="NodeCanvas.loadVoices('${n.id}')">⟳ Load my voices</button>`)+
        H.label("Model")+H.select(n,"model",TTS_MODELS);
    },
    async run(node,ctx){
      const text=ctx.get("in_1")||node.data.manualText;
      if(!text)throw new Error("No text — connect a Prompt node or type text on this node");
      const key=gs("api_elevenlabs","");
      if(!key)throw new Error("Add an ElevenLabs API key in Settings first");
      const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(node.data.voiceId)}`,{
        method:"POST",headers:{"Content-Type":"application/json","xi-api-key":key,"Accept":"audio/mpeg"},
        body:JSON.stringify({text,model_id:node.data.model||"eleven_multilingual_v2",voice_settings:{stability:0.5,similarity_boost:0.75}})});
      if(!res.ok){let msg=res.statusText;try{const d=await res.json();msg=(d.detail&&(d.detail.message||JSON.stringify(d.detail)))||msg;}catch(e){}throw new Error(msg);}
      const blob=await res.blob();
      let url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error("Couldn't read audio response"));r.readAsDataURL(blob);});
      // Re-host so the graph holds a short URL, not megabytes of base64.
      try{const rh=fnOpt("rehostToStorage");if(rh){const h=await rh(url,"node-canvas-audio");if(h)url=h;}}catch(e){}
      node.data.resultUrl=url;
      node.meta.model="elevenlabs";
      ctx.log("elevenlabs_tts",String(text).slice(0,60),1,null);
    },
  });

  // ═════════════ PROCESS NODES ═════════════
  const upTools=()=>{
    try{return window.KosmicUpscaler.registry.TOOLS.filter(t=>t.kind==="image");}catch(e){return[];}
  };
  REG.register({
    type:"upscale",label:"Upscale",short:"SCALE",icon:"⤢",color:"#A78BFA",group:"Process",
    desc:"Any Topaz image tool, Real-ESRGAN or Clarity on a connected image.",
    inputs:[{id:"in_1",label:"Source",accepts:["image"]}],
    outputs:[{id:"out_1",label:"Result",type:"image"}],
    defaults:()=>({engine:"topaz/upscale/image/precision",model:null,factor:null,resultUrl:null}),
    result:n=>n.data.resultUrl?{kind:"image",url:n.data.resultUrl,prompt:"Upscaled image",model:n.data.engine}:null,
    onChange(node,field){if(field==="engine"){node.data.model=null;node.data.factor=null;}},
    body(n){
      const tools=upTools();
      const eng=(tools.find(t=>t.ep===n.data.engine))||null;
      const opts=tools.length?tools.map(t=>({v:t.ep,t:`${t.cat} · ${t.name}`})):[
        {v:"topaz/upscale/image/precision",t:"Topaz Precision"},{v:"topaz/upscale/image/generative",t:"Topaz Generative"},
        {v:"topaz/upscale/image/creative",t:"Topaz Creative"},{v:"fal-ai/esrgan",t:"Real-ESRGAN"},{v:"fal-ai/clarity-upscaler",t:"Clarity"}];
      let html=H.media("image",n.data.resultUrl)+H.label("Tool")+H.select(n,"engine",opts,{rerender:true});
      if(eng&&eng.models&&eng.models.length)html+=H.label("Model")+H.select(n,"model",eng.models.map(m=>({v:m.id,t:m.id})),{cur:n.data.model||eng.defModel});
      if(eng&&eng.factor&&eng.factor.opts)html+=H.label("Scale")+H.select(n,"factor",eng.factor.opts.map(f=>({v:f,t:f+"×"})),{num:true,cur:n.data.factor||eng.factor.def});
      return html;
    },
    async run(node,ctx){
      const src=ctx.get("in_1");
      if(!src)throw new Error("Connect an image source first");
      const key=gs("api_falai","");
      if(!key)throw new Error("Add a fal.ai API key in Settings first");
      const tool=upTools().find(t=>t.ep===node.data.engine);
      const over={};
      if(tool&&node.data.model&&tool.models&&tool.models.some(m=>m.id===node.data.model))over.model=node.data.model;
      if(tool&&tool.factor&&node.data.factor)over.factor=node.data.factor;
      node.data.resultUrl=await fn("upscaleImageUrl")(src,node.data.engine,key,over);
      node.meta.model=node.data.engine;
      ctx.log(node.data.engine,"Node Canvas — Upscale",1,null);
    },
  });

  // ═════════════ NOTES ═════════════
  REG.register({
    type:"note",label:"Note",short:"NOTE",icon:"✎",color:"#FBBF24",group:"Notes",instant:true,noRun:true,
    desc:"A sticky note to label a part of the workflow.",
    defaults:()=>({text:""}),
    valid:()=>null,
    body:n=>H.area(n,"text","Write a note…",4),
  });

  // ═════════════ STARTER TEMPLATES ═════════════
  // nodes: [type, x, y, data?]  ·  edges: [fromIdx, outPort, toIdx, inPort]
  REG.templates=[
    {id:"blank",name:"Blank canvas",icon:"▢",desc:"Start from nothing",nodes:[],edges:[]},
    {id:"img",name:"Prompt → Image",icon:"✺",desc:"Text to a single image",
      nodes:[["promptText",40,60],["generatedImage",340,40]],edges:[[0,"out_1",1,"in_1"]]},
    {id:"style-img",name:"Styled image",icon:"✦",desc:"Style + prompt mixed into an image",
      nodes:[["promptText",40,40],["styleRef",40,230],["promptMix",340,100],["generatedImage",640,60]],
      edges:[[0,"out_1",2,"in_txt_1"],[1,"out_1",2,"in_txt_2"],[2,"out_1",3,"in_1"]]},
    {id:"img-vid",name:"Image → Video",icon:"▶",desc:"Generate an image, then animate it",
      nodes:[["promptText",40,60],["generatedImage",340,40],["promptText",340,330],["videoClip",660,60]],
      edges:[[0,"out_1",1,"in_1"],[1,"out_1",3,"in_img_1"],[2,"out_1",3,"in_1"]]},
    {id:"chain",name:"Two-shot chain",icon:"⛓",desc:"Shot 2 starts from shot 1's last frame",
      nodes:[["promptText",40,40],["videoClip",340,20],["promptText",340,420],["videoClip",680,60]],
      edges:[[0,"out_1",1,"in_1"],[1,"out_2",3,"in_img_1"],[2,"out_1",3,"in_1"]]},
    {id:"upscale",name:"Image → Upscale",icon:"⤢",desc:"Upload and enhance with Topaz",
      nodes:[["referenceImage",40,60],["upscale",340,60]],edges:[[0,"out_1",1,"in_1"]]},
    {id:"voice",name:"Script → Voice-over",icon:"♫",desc:"Write a script, get narration",
      nodes:[["promptText",40,60],["audioTTS",340,40]],edges:[[0,"out_1",1,"in_1"]]},
  ];

  REG.H=H;REG.IMAGE_MODELS=IMAGE_MODELS;REG.VIDEO_MODELS=VIDEO_MODELS;
  window.NC_REGISTRY=REG;
  window.NC_ESC=esc;
})();

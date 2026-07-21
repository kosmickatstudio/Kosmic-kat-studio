// ══════════════════════════════════════════════════════════════════════
// NODE CANVAS MODULE — ninth extraction from index.html (module split
// phase 9). Plain global script, not an ES module. Largest file extracted
// so far by line count (1020 lines), but actually one of the SAFEST due
// to how it's already structured internally.
//
// Only 2 top-level names exist in this whole file: renderNodeCanvasModule
// (the render entry point) and NodeCanvas (a const assigned from an IIFE —
// Immediately Invoked Function Expression). Everything else — ~60
// functions, all the graph-mutation logic, node type definitions, drag/
// pan/zoom/pinch handling — lives inside that IIFE's closure scope,
// completely private, not global at all. This was true even before the
// module split; it's how this file was originally written ("keep all
// graph mutation behind one API and avoid the variable-collision class of
// bug"), which happens to make it an excellent extraction candidate.
//
// Verified before extracting: the IIFE's own top-level body (state
// variables, NODE_DEFS, SOURCE_TYPES) never touches S/gs() at initial
// execution time — only inside nested function declarations, which don't
// run until called. Confirmed every reference to NodeCanvas.* (its public
// API) exists exclusively within this same file's own generated HTML
// (onclick/onchange handlers), zero external callers anywhere else in
// the app.
//
// LOAD ORDER: must load AFTER index.html's main inline script, same as
// every other extraction.
// ══════════════════════════════════════════════════════════════════════

function renderNodeCanvasModule(el){
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)">🕸 Canvas</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">Node-based workflow — chain prompts, references, and shots so last-frame → next-shot happens by wiring, not copy-paste</div>
      </div>
      <select class="f-select" id="ncProjectSelect" style="width:auto;min-width:160px" onchange="NodeCanvas.switchProject(this.value)"></select>
    </div>
    <div id="node-canvas-root" class="nc-root"></div>
  `;
  NodeCanvas.init(document.getElementById("node-canvas-root"));
}

const NodeCanvas=(function(){
  // ── 3a. State — single source of truth. Nothing outside graphState should
  // hold state that survives a render; screen-space coordinates are NEVER
  // stored, only canvas-space (see NODE_DEFS/coordinate math below). ──
  let graphState={nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}};
  let rootEl=null,viewportEl=null,layerEl=null,edgeSvgEl=null,nodesLayerEl=null,minimapEl=null;
  let currentProjectId=null;
  let pendingConnection=null; // {nodeId,portId,type,direction}
  let autoSaveTimer=null;
  let dragState=null; // {mode:'pan'|'node',pointerId,startX,startY,nodeId,nodeStartX,nodeStartY}
  let moveModeNodeId=null; // tap-to-place move mode, armed by long-pressing a node's tab
  let _documentListenersAttached=false;
  let pinchState=null; // {pointers:Map,startDist,startZoom,midX,midY}
  let longPressTimer=null;

  const NODE_DEFS={
    promptText:{label:"Prompt",color:"#8B5CF6",inputs:[],outputs:[{portId:"out_1",label:"Text",type:"text"}]},
    referenceImage:{label:"Reference Image",color:"#22D3EE",inputs:[],outputs:[{portId:"out_1",label:"Image",type:"image"}]},
    characterSheet:{label:"Character Sheet",color:"#F59E0B",inputs:[],outputs:[{portId:"out_1",label:"Character",type:"image"}]},
    styleRef:{label:"Style Reference",color:"#6B7280",inputs:[],outputs:[{portId:"out_1",label:"Style",type:"text"}]},
    generatedImage:{label:"Generated Image",color:"#10B981",inputs:[{portId:"in_1",label:"Prompt",accepts:["text"]},...Array.from({length:16},(_,i)=>({portId:`in_ref_${i+1}`,label:`Ref ${i+1}`,accepts:["image"]}))],outputs:[{portId:"out_1",label:"Image",type:"image"}]},
    videoClip:{label:"Video Clip",color:"#3B82F6",inputs:[
      {portId:"in_1",label:"Prompt",accepts:["text"]},
      ...Array.from({length:9},(_,i)=>({portId:`in_img_${i+1}`,label:i===0?"Image Ref 1 / Last Frame In":`Image Ref ${i+1}`,accepts:["image"]})),
      ...Array.from({length:3},(_,i)=>({portId:`in_vid_${i+1}`,label:`Video Ref ${i+1}`,accepts:["video"]})),
      ...Array.from({length:3},(_,i)=>({portId:`in_aud_${i+1}`,label:`Audio Ref ${i+1}`,accepts:["audio"]})),
    ],outputs:[{portId:"out_1",label:"Video",type:"video"},{portId:"out_2",label:"Last Frame",type:"image"}]},
    upscale:{label:"Upscale",color:"#A78BFA",inputs:[{portId:"in_1",label:"Source",accepts:["image"]}],outputs:[{portId:"out_1",label:"Result",type:"image"}]},
    audioTTS:{label:"Audio / TTS",color:"#EC4899",inputs:[{portId:"in_1",label:"Text",accepts:["text"]}],outputs:[{portId:"out_1",label:"Audio",type:"audio"}]},
  };
  const SOURCE_TYPES=new Set(["promptText","referenceImage","characterSheet","styleRef"]); // no API call — resolve instantly from own data

  function uid(prefix){return prefix+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);}

  // ── 3f. Persistence ──
  function serializeGraph(){return JSON.stringify(graphState);}
  function loadGraph(json){
    try{
      const parsed=JSON.parse(json);
      graphState={nodes:parsed.nodes||{},edges:parsed.edges||{},viewport:parsed.viewport||{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}};
    }catch(e){ console.error("Failed to load graph:",e); graphState={nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}}; }
    renderAll();
  }
  async function saveToFirebase(){
    if(!currentProjectId)return;
    try{ await fbDB.collection("public").doc("nodeCanvas_"+currentProjectId).set({graph:serializeGraph(),updatedAt:Date.now()}); }
    catch(err){ console.warn("Canvas cloud save failed — kept locally only:",err.message); }
  }
  function autoSaveDebounced(){
    saveGraphLocal();
    clearTimeout(autoSaveTimer);
    autoSaveTimer=setTimeout(saveToFirebase,1000); // 1s after last edit, not every keystroke/drag-move
  }
  async function loadProjectsList(){
    // Migrated off localStorage (was a separate, undiscovered gap from the
    // main app's IndexedDB migration — this whole module had its own
    // parallel storage system that bypassed it entirely). One-time
    // fallback for existing users: if IndexedDB has nothing yet, pull
    // whatever's in the old localStorage key once, then save it into
    // IndexedDB so every future save goes there instead.
    if(!S.nodeCanvasProjects){
      S.nodeCanvasProjects=await idbGet("kk_nc_projects");
      if(!S.nodeCanvasProjects){
        const legacy=localStorage.getItem("kk_nc_projects");
        S.nodeCanvasProjects=legacy?JSON.parse(legacy):[];
        if(S.nodeCanvasProjects.length)idbSet("kk_nc_projects",S.nodeCanvasProjects);
      }
    }
    if(S.nodeCanvasProjects.length===0){
      S.nodeCanvasProjects=[{id:uid("ncproj"),name:"Untitled Canvas"}];
      idbSet("kk_nc_projects",S.nodeCanvasProjects);
    }
    const sel=document.getElementById("ncProjectSelect");
    // 'selected' is baked directly into the option HTML rather than set via a
    // separate sel.value= call — this innerHTML rebuild runs on every
    // renderAll(), which would silently wipe out any prior .value= assignment
    // the instant it ran again, desyncing the dropdown from the actually
    // loaded project (this was the cause of "select new one, still shows old one").
    if(sel)sel.innerHTML=S.nodeCanvasProjects.map(p=>`<option value="${p.id}" ${p.id===currentProjectId?'selected':''}>${p.name}</option>`).join('')+`<option value="__new__">+ New Canvas</option>`;
  }
  async function switchProject(id){
    if(id==="__new__"){
      const name=await showPromptDialog?.("Name this canvas","Untitled Canvas")||"Untitled Canvas";
      const proj={id:uid("ncproj"),name};
      S.nodeCanvasProjects.push(proj);
      idbSet("kk_nc_projects",S.nodeCanvasProjects);
      id=proj.id;
      graphState={nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}};
    }
    currentProjectId=id;
    idbSet("kk_nc_last_project",id); // survives a tab reload/backgrounding, so init() resumes the right canvas
    let saved=await idbGet("kk_nc_graph_"+id);
    if(!saved){
      // Same one-time legacy fallback as loadProjectsList above.
      const legacy=localStorage.getItem("kk_nc_graph_"+id);
      if(legacy){saved=legacy;idbSet("kk_nc_graph_"+id,legacy);}
    }
    if(saved){ loadGraph(saved); }
    else{
      try{
        const doc=await fbDB.collection("public").doc("nodeCanvas_"+id).get();
        if(doc.exists&&doc.data().graph){ loadGraph(doc.data().graph); }
        else{ graphState={nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}}; renderAll(); }
      }catch(err){ graphState={nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}}; renderAll(); }
    }
  }
  function saveGraphLocal(){
    if(!currentProjectId)return;
    idbSet("kk_nc_graph_"+currentProjectId,serializeGraph());
  }

  // ── Coordinate math: nodes are positioned with plain left/top in
  // canvas-space *inside* a single transformed layer — the browser's CSS
  // transform (translate+scale on .nc-transform-layer) does all pan/zoom
  // rendering, so we never manually recompute per-node screen positions. ──
  function applyTransform(){
    layerEl.style.transform=`translate(${graphState.viewport.x}px,${graphState.viewport.y}px) scale(${graphState.viewport.zoom})`;
  }
  function screenToCanvas(screenX,screenY){
    const rect=viewportEl.getBoundingClientRect();
    return{
      x:(screenX-rect.left-graphState.viewport.x)/graphState.viewport.zoom,
      y:(screenY-rect.top-graphState.viewport.y)/graphState.viewport.zoom
    };
  }

  // ── 3d. Graph mutation — ALWAYS go through these ──
  function addNode(type,position){
    const def=NODE_DEFS[type];
    if(!def)return null;
    const id=uid("node");
    const zoom=graphState.viewport.zoom||1; // guard: a stray zoom of 0 would make the position math produce Infinity
    graphState.nodes[id]={
      id,type,
      position:position||{x:-graphState.viewport.x/zoom+40,y:-graphState.viewport.y/zoom+40},
      size:{w:220,h:160},
      data:defaultDataFor(type),
      status:"idle",
      inputs:def.inputs.map(p=>({...p,connectedEdgeId:null})),
      outputs:def.outputs.map(p=>({...p})),
      meta:{createdAt:Date.now(),model:null,cost:0,error:null},
    };
    console.log(`Node Canvas: added ${type} node ${id}, graph now has ${Object.keys(graphState.nodes).length} node(s)`);
    autoSaveDebounced();
    renderAll();
    return id;
  }
  function defaultDataFor(type){
    switch(type){
      case "promptText": return {text:""};
      case "referenceImage": return {url:null,uploadedAt:null};
      case "characterSheet": return {sourceProductionId:null,view:"threeQuarter"};
      case "styleRef": return {styleName:STYLE_LIBRARY[0]?.name||""};
      case "generatedImage": return {model:"fal-ai/flux/dev",resultUrl:null,manualPrompt:"",params:{}};
      case "videoClip": return {model:"bytedance/seedance-2.0/reference-to-video",resultUrl:null,lastFrameUrl:null,duration:5,resolution:"720p",aspectRatio:"16:9",manualPrompt:""};
      case "upscale": return {engine:"fal-ai/esrgan",resultUrl:null};
      case "audioTTS": return {voiceId:gs("elevenlabs_voice","21m00Tcm4TlvDq8ikWAM"),resultUrl:null,manualText:""};
      default: return {};
    }
  }
  function deleteNode(nodeId){
    // Cascade-delete first — orphaned edges pointing at a gone node are a
    // guaranteed crash on the next edge-render pass otherwise.
    Object.keys(graphState.edges).forEach(eid=>{
      const e=graphState.edges[eid];
      if(e.fromNode===nodeId||e.toNode===nodeId)delete graphState.edges[eid];
    });
    delete graphState.nodes[nodeId];
    autoSaveDebounced();
    renderAll();
  }
  function addEdge(fromNode,fromPort,toNode,toPort){
    const fn=graphState.nodes[fromNode],tn=graphState.nodes[toNode];
    if(!fn||!tn)return null;
    const outPort=fn.outputs.find(p=>p.portId===fromPort);
    const inPort=tn.inputs.find(p=>p.portId===toPort);
    if(!outPort||!inPort)return null;
    if(!inPort.accepts.includes(outPort.type)){ toast(`❌ This node isn't for that — ${NODE_DEFS[tn.type].label} needs a ${inPort.accepts.join(" or ")} input, not ${outPort.type}`,"error"); return null; }
    // Input ports allow at most one connection — replace, don't stack.
    if(inPort.connectedEdgeId)deleteEdge(inPort.connectedEdgeId);
    const id=uid("edge");
    graphState.edges[id]={id,fromNode,fromPort,toNode,toPort};
    inPort.connectedEdgeId=id;
    markStale(toNode);
    autoSaveDebounced();
    renderAll();
    return id;
  }
  function deleteEdge(edgeId){
    const e=graphState.edges[edgeId];
    if(!e)return;
    const tn=graphState.nodes[e.toNode];
    if(tn){ const p=tn.inputs.find(p=>p.portId===e.toPort); if(p)p.connectedEdgeId=null; }
    delete graphState.edges[edgeId];
    autoSaveDebounced();
    renderAll();
  }
  function markStale(nodeId){
    // Per spec: re-running upstream must NOT silently invalidate/re-run
    // downstream nodes — just mark them visually stale until the user
    // explicitly re-runs them.
    const node=graphState.nodes[nodeId];
    if(node&&node.status==="done")node._stale=true;
    Object.values(graphState.edges).filter(e=>e.fromNode===nodeId).forEach(e=>markStale(e.toNode));
  }

  // ── 3e. Execution engine ──
  function getNodeOutputValue(nodeId,portId){
    const n=graphState.nodes[nodeId];
    if(!n)return null;
    switch(n.type){
      case "promptText": return n.data.text;
      case "referenceImage": return n.data.url;
      case "characterSheet": {
        const prod=(S.productions||[]).find(p=>p.id===n.data.sourceProductionId);
        return prod&&prod.characterSheet?prod.characterSheet[n.data.view]:null;
      }
      case "styleRef": {
        const style=STYLE_LIBRARY.find(s=>s.name===n.data.styleName);
        return style?`in the style of ${style.name}: ${style.style}`:n.data.styleName;
      }
      case "generatedImage": return n.data.resultUrl;
      case "videoClip": return portId==="out_2"?n.data.lastFrameUrl:n.data.resultUrl;
      case "upscale": return n.data.resultUrl;
      case "audioTTS": return n.data.resultUrl;
      default: return null;
    }
  }
  function getConnectedInput(node,portId){
    const port=node.inputs.find(p=>p.portId===portId);
    if(!port||!port.connectedEdgeId)return null;
    const edge=graphState.edges[port.connectedEdgeId];
    if(!edge)return null;
    return {edge,value:getNodeOutputValue(edge.fromNode,edge.fromPort)};
  }
  async function runNode(nodeId){
    const node=graphState.nodes[nodeId];
    if(!node)return;
    node._stale=false;

    if(SOURCE_TYPES.has(node.type)){
      const valid=node.type==="promptText"?!!node.data.text
        :node.type==="referenceImage"?!!node.data.url
        :node.type==="characterSheet"?!!node.data.sourceProductionId
        :node.type==="styleRef"?!!node.data.styleName:false;
      node.status=valid?"done":"error";
      if(!valid)node.meta.error="Missing required data — fill in this node's fields first";
      renderNodeOnly(nodeId);
      return;
    }

    // Recursively resolve upstream dependencies first — this is what makes
    // a multi-node chain run end-to-end with one tap on the last node.
    for(const port of node.inputs){
      if(!port.connectedEdgeId)continue;
      const edge=graphState.edges[port.connectedEdgeId];
      const upstream=graphState.nodes[edge.fromNode];
      if(upstream&&upstream.status!=="done")await runNode(edge.fromNode);
    }

    node.status="running";
    node.meta.error=null;
    renderNodeOnly(nodeId);

    try{
      if(node.type==="generatedImage")await execGeneratedImage(node);
      else if(node.type==="videoClip")await execVideoClip(node);
      else if(node.type==="upscale")await execUpscale(node);
      else if(node.type==="audioTTS")await execAudioTTS(node);
      node.status="done";
      node.meta.createdAt=Date.now();
    }catch(err){
      node.status="error";
      node.meta.error=err.message;
      toast(`❌ ${NODE_DEFS[node.type].label} failed: ${err.message}`,"error");
    }
    markStale(nodeId); // downstream nodes are now potentially outdated — flag, don't cascade
    autoSaveDebounced();
    renderNodeOnly(nodeId);
    renderEdges();
    renderCostReadout();
  }
  async function runGraphFrom(nodeId){
    const visited=new Set();
    async function walk(id){
      if(visited.has(id))return;
      visited.add(id);
      await runNode(id);
      Object.values(graphState.edges).filter(e=>e.fromNode===id).forEach(e=>{});
      for(const e of Object.values(graphState.edges).filter(e=>e.fromNode===id))await walk(e.toNode);
    }
    await walk(nodeId);
    toast("✅ Graph run complete","success");
  }

  async function execGeneratedImage(node){
    const promptInput=getConnectedInput(node,"in_1");
    const prompt=promptInput?promptInput.value:node.data.manualPrompt;
    if(!prompt)throw new Error("No prompt — connect a Prompt node or type one directly on this node");
    const allRefs=[];
    for(let i=1;i<=16;i++){
      const r=getConnectedInput(node,`in_ref_${i}`);
      if(r&&r.value)allRefs.push(r.value);
    }
    const ar=node.data.aspectRatio||"1:1";
    const model=node.data.model;
    // Real per-model reference-image caps, verified against fal's own docs —
    // sending more than a model actually supports either errors out or
    // silently drops the extras, so truncate here and tell the user if that
    // happened rather than let it fail mysteriously.
    const REF_CAPS={
      "fal-ai/nano-banana-2":{max:14,endpoint:"fal-ai/nano-banana-2/edit"},
      "fal-ai/nano-banana-pro":{max:2,endpoint:"fal-ai/nano-banana-pro/edit"},
      "openai/gpt-image-2":{max:16,endpoint:"openai/gpt-image-2/edit"},
    };
    let result;
    if(model.startsWith("gemini-")){
      const refs=allRefs.slice(0,4); // Gemini's own multi-ref cap — matches the rest of the app
      if(allRefs.length>4)toast(`⚠️ ${model} supports up to 4 reference images — using the first 4 of ${allRefs.length} connected`,"error");
      result=await genViaGemini(prompt,ar,model,refs);
    } else if(model==="gpt-image-2"){
      result=await genViaOpenAI(prompt,ar); // direct OpenAI path (not fal) — text-only currently
    } else if(REF_CAPS[model]&&allRefs.length){
      const cap=REF_CAPS[model];
      const refs=allRefs.slice(0,cap.max);
      if(allRefs.length>cap.max)toast(`⚠️ This model supports up to ${cap.max} reference images — using the first ${cap.max} of ${allRefs.length} connected`,"error");
      result=await genViaFluxEdit(prompt,refs,ar,cap.endpoint);
    } else if(allRefs.length){
      const refs=allRefs.slice(0,4); // FLUX.2 Flash Edit's real cap
      if(allRefs.length>4)toast(`⚠️ This model supports up to 4 reference images — using the first 4 of ${allRefs.length} connected`,"error");
      result=await genViaFluxEdit(prompt,refs,ar);
    } else {
      result=await genViaFal(prompt,"",model,ar,false);
    }
    node.data.resultUrl=result.url;
    const est=estimateImageCost(node.data.model,1);
    node.meta.model=node.data.model;
    node.meta.cost=est?est.cost:0;
    logCost(node.data.model,"Node Canvas — Generated Image");
  }
  async function execVideoClip(node){
    const promptInput=getConnectedInput(node,"in_1");
    const prompt=promptInput?promptInput.value:node.data.manualPrompt;

    const imageUrls=[];
    for(let i=1;i<=9;i++){ const r=getConnectedInput(node,`in_img_${i}`); if(r&&r.value)imageUrls.push(r.value); }
    const videoUrls=[];
    for(let i=1;i<=3;i++){ const r=getConnectedInput(node,`in_vid_${i}`); if(r&&r.value)videoUrls.push(r.value); }
    const audioUrls=[];
    for(let i=1;i<=3;i++){ const r=getConnectedInput(node,`in_aud_${i}`); if(r&&r.value)audioUrls.push(r.value); }

    if(!prompt&&!imageUrls.length)throw new Error("No prompt or reference image connected");
    const apiKey=gs("api_falai","");
    if(!apiKey)throw new Error("Add a fal.ai API key in Settings first");

    const isSeedance=node.data.model.includes("seedance");
    const isKling=node.data.model.startsWith("fal-ai/kling-video");
    const klingCap=VIDEO_MODEL_CAPABILITIES[node.data.model];
    const totalFiles=imageUrls.length+videoUrls.length+audioUrls.length;

    // Kling v3 Standard/Pro and O3 Pro genuinely support reference images (and,
    // for O3, reference videos too) via the same IMAGE_TO_VIDEO_MAP/elements
    // mechanism Video Canvas already uses — this used to be flatly "no refs"
    // for every Kling tier, which was accurate when it was written but not
    // anymore. v2.1/v2.6 only ever confirmed a single image_url field, so
    // those stay limited to exactly one connected reference image.
    if(!isSeedance&&!isKling&&totalFiles>0)toast(`⚠️ ${node.data.model.split('/')[1]||node.data.model} doesn't support reference inputs — connected refs are being ignored.`,"error");
    if(isSeedance&&totalFiles>12)throw new Error(`Too many references connected (${totalFiles}) — Seedance 2.0 allows up to 12 total files across images, videos, and audio combined`);
    if(isKling&&audioUrls.length>0)toast("⚠️ Kling doesn't accept reference audio here — connected audio is being ignored.","error");

    let videoUrl,lastFrameUrl;
    if(klingCap&&klingCap.provider==="kling-o3-ref"){
      if(!imageUrls.length&&!videoUrls.length)throw new Error("Kling O3 Pro needs at least one connected reference image or video");
      if((imageUrls.length+videoUrls.length)>6)throw new Error(`Too many references connected (${imageUrls.length+videoUrls.length}) — O3 Pro allows up to 4 images + 2 videos`);
      videoUrl=await genViaKlingO3Reference(normalizeElementTags(prompt||"Continue the scene naturally."),node.data.aspectRatio||"16:9",node.data.duration||5,imageUrls,videoUrls);
      lastFrameUrl=imageUrls[0]||null;
    } else {
      const promptForBody=(isKling&&klingCap&&klingCap.elements&&imageUrls.length>1)?normalizeElementTags(prompt||"Continue the scene naturally."):(prompt||"Continue the scene naturally.");
      const body={prompt:promptForBody,aspect_ratio:node.data.aspectRatio||"16:9",duration:String(node.data.duration||5),resolution:node.data.resolution||"720p"};
      let endpoint=node.data.model;
      if(isSeedance){
        if(imageUrls.length)body.image_urls=imageUrls;
        if(videoUrls.length)body.video_urls=videoUrls;
        if(audioUrls.length)body.audio_urls=audioUrls;
      } else if(isKling){
        delete body.resolution; // Kling's resolution is fixed per tier — not a real field on any Kling endpoint
        if(imageUrls.length){
          const i2v=IMAGE_TO_VIDEO_MAP[node.data.model];
          if(klingCap&&klingCap.elements&&imageUrls.length>1){
            // CORRECTED: previously stayed on text-to-video. Text-to-video's
            // own docs specifically limit element binding to 1 element and
            // require character_orientation:'video' (never set here) — every
            // confirmed working multi-element example uses image-to-video
            // with both start_image_url and elements together instead.
            const missing=imageUrls.map((u,i)=>!u?i+1:null).filter(Boolean);
            if(missing.length)throw new Error(`Reference image ${missing.join(", ")} has no usable URL`);
            if(i2v){endpoint=i2v.endpoint;body[i2v.field]=imageUrls[0];}
            body.elements=imageUrls.map(u=>({frontal_image_url:u}));
          } else if(i2v){
            endpoint=i2v.endpoint;
            body[i2v.field]=imageUrls[0];
            if(imageUrls.length>1)toast(`ℹ️ This Kling tier only uses the first connected image — the rest were ignored. Switch to 3.0 Standard/Pro for multi-reference.`,"error");
          }
        }
      }
      const result=await ncFalVideoSubmitAndPoll(endpoint,body);
      videoUrl=result.videoUrl;lastFrameUrl=result.lastFrameUrl;
    }
    node.data.resultUrl=videoUrl;
    node.data.lastFrameUrl=lastFrameUrl||imageUrls[0]||null;
    const est=estimateVideoCost(node.data.model,node.data.duration||5,node.data.resolution||"720p",videoUrls.length>0,!!(klingCap&&klingCap.elements&&imageUrls.length>1));
    node.meta.model=node.data.model;
    node.meta.cost=est?est.cost:0;
    logCost(node.data.model,"Node Canvas — Video Clip",1,est?est.cost:null);
  }
  async function execUpscale(node){
    const input=getConnectedInput(node,"in_1");
    if(!input||!input.value)throw new Error("Connect an image source first");
    const apiKey=gs("api_falai","");
    if(!apiKey)throw new Error("Add a fal.ai API key in Settings first");
    node.data.resultUrl=await upscaleImageUrl(input.value,node.data.engine,apiKey);
    node.meta.model=node.data.engine;
    logCost(node.data.engine,"Node Canvas — Upscale");
  }
  async function execAudioTTS(node){
    const input=getConnectedInput(node,"in_1");
    const text=input?input.value:node.data.manualText;
    if(!text)throw new Error("No text — connect a Prompt node or type text directly on this node");
    const apiKey=gs("api_elevenlabs","");
    if(!apiKey)throw new Error("Add an ElevenLabs API key in Settings first");
    node.data.resultUrl=await ncElevenLabsTTS(text,node.data.voiceId,apiKey);
    node.meta.model="elevenlabs";
    logCost("elevenlabs_tts",text.slice(0,60));
  }
  // Thin, reusable low-level helpers — deliberately NOT duplicating the
  // existing UI-coupled generateAudio()/runProductionVideoGen() logic, but
  // calling the same real APIs those use.
  async function ncElevenLabsTTS(text,voiceId,apiKey){
    const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,{
      method:"POST",headers:{"Content-Type":"application/json","xi-api-key":apiKey,"Accept":"audio/mpeg"},
      body:JSON.stringify({text,model_id:"eleven_multilingual_v2",voice_settings:{stability:0.5,similarity_boost:0.75}})
    });
    if(!response.ok){let msg=response.statusText;try{const d=await response.json();msg=(d.detail&&(d.detail.message||JSON.stringify(d.detail)))||msg;}catch(e){}throw new Error(msg);}
    const blob=await response.blob();
    return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read audio response"));r.readAsDataURL(blob);});
  }
  async function ncFalVideoSubmitAndPoll(model,body){
    const apiKey=gs("api_falai","");
    const submitRes=await fetch(`https://queue.fal.run/${model}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},body:JSON.stringify(body)});
    const submitData=await submitRes.json();
    if(!submitRes.ok)throw new Error((submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText);
    const requestId=submitData.request_id;
    const statusUrl=submitData.status_url||`https://queue.fal.run/${model}/requests/${requestId}/status`;
    const resultUrl=submitData.response_url||`https://queue.fal.run/${model}/requests/${requestId}`;
    let tries=0,finalData=null;
    while(tries<60){
      await new Promise(r=>setTimeout(r,5000));tries++;
      const statusRes=await fetch(statusUrl,{headers:{"Authorization":"Key "+apiKey}});
      const statusData=await statusRes.json();
      if(statusData.status==="COMPLETED"){const fr=await fetch(resultUrl,{headers:{"Authorization":"Key "+apiKey}});finalData=await fr.json();break;}
      if(statusData.status==="ERROR"||statusData.status==="FAILED")throw new Error(statusData.error||"Generation failed");
    }
    if(!finalData)throw new Error("Timed out waiting for render");
    const videoUrl=finalData.video&&finalData.video.url;
    if(!videoUrl){
      const diag=formatFalDiag(finalData);
      throw new Error("No video returned — fal.ai said: "+diag);
    }
    return {videoUrl,lastFrameUrl:null}; // last-frame extraction reuses getChainedReferenceFrame at call sites that need it
  }

  // ── 3b. Rendering — diff-render: full nodes-layer rebuild is cheap enough
  // at expected graph sizes (tens of nodes), but single-node operations
  // (drag, run) touch only that node + its edges, per the spec's perf note. ──
  function renderAll(){
    if(!rootEl)return;
    try{
      applyTransform();
      renderNodes();
      renderEdges();
      renderMinimap();
      renderCostReadout();
      loadProjectsList();
    }catch(err){
      console.error("Node Canvas render error:",err);
      toast(`❌ Canvas render error: ${err.message} — check the browser console for details`,"error");
    }
  }
  function renderNodes(){
    // Render each node independently — one broken node (bad data, a future
    // bug in a specific node type's body) no longer blanks the entire
    // canvas; it's skipped with a visible error instead of taking every
    // other node down with it.
    const parts=[];
    Object.values(graphState.nodes).forEach(node=>{
      try{ parts.push(nodeHTML(node)); }
      catch(err){ console.error(`Node Canvas: failed to render node ${node.id} (${node.type}):`,err); toast(`❌ Couldn't render a ${node.type} node: ${err.message}`,"error"); }
    });
    nodesLayerEl.innerHTML=parts.join('');
  }
  function renderNodeOnly(nodeId){
    const existing=nodesLayerEl.querySelector(`[data-node-id="${nodeId}"]`);
    const html=nodeHTML(graphState.nodes[nodeId]);
    if(existing)existing.outerHTML=html; else nodesLayerEl.insertAdjacentHTML("beforeend",html);
  }
  function neighborColors(nodeId){
    const colors=new Set();
    Object.values(graphState.edges).forEach(e=>{
      if(e.fromNode===nodeId){const n=graphState.nodes[e.toNode];if(n)colors.add(NODE_DEFS[n.type].color);}
      if(e.toNode===nodeId){const n=graphState.nodes[e.fromNode];if(n)colors.add(NODE_DEFS[n.type].color);}
    });
    return Array.from(colors);
  }
  function nodeHTML(node){
    if(!node)return '';
    const def=NODE_DEFS[node.type];
    const statusIcon={idle:'',queued:'⏳',running:'⏳',done:'✅',error:'❌'}[node.status]||'';
    const neighbors=neighborColors(node.id).filter(c=>c!==def.color);
    const colorStyle=`--nc-color:${def.color};--nc-color2:${neighbors[0]||def.color}`;
    return `<div class="nc-node${node._stale?' nc-stale':''}${(graphState.selection.nodeIds||[]).includes(node.id)?' nc-selected':''}${node.id===moveModeNodeId?' nc-moving':''}" data-node-id="${node.id}" data-type="${node.type}" data-status="${node.status}" style="left:${node.position.x}px;top:${node.position.y}px;width:${node.size.w}px;${colorStyle}">
      <div class="nc-node-tab" onpointerdown="NodeCanvas._onNodeDragStart(event,'${node.id}')">${def.label} ${statusIcon}${node.id===moveModeNodeId?' 📍':''}</div>
      <div class="nc-node-body" onpointerdown="NodeCanvas._onNodeBodyPointerDown(event,'${node.id}')">
        ${nodeBodyHTML(node)}
        ${node.meta.error?`<div style="color:var(--red);font-size:9px;margin-top:4px">${node.meta.error}</div>`:''}
        <div class="nc-node-meta"><span>${node.meta.cost?'$'+node.meta.cost.toFixed(3):''}</span><button class="nc-run-btn" onclick="NodeCanvas.runNode('${node.id}')">▶ Run</button></div>
      </div>
      <div class="nc-port nc-port-in" data-node="${node.id}" data-dir="in" title="Inputs" onclick="NodeCanvas._onPortTap(event,'${node.id}','in')">+</div>
      <div class="nc-port nc-port-out" data-node="${node.id}" data-dir="out" title="Outputs" onclick="NodeCanvas._onPortTap(event,'${node.id}','out')">+</div>
    </div>`;
  }
  function nodeBodyHTML(node){
    switch(node.type){
      case "promptText":
        return `<textarea placeholder="Type a prompt…" onchange="NodeCanvas.updateNodeData('${node.id}','text',this.value)">${node.data.text||''}</textarea>`;
      case "referenceImage":
        return node.data.url?`<img src="${node.data.url}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'⚠️ Image failed to load',style:'font-size:10px;color:var(--red);padding:20px;text-align:center;background:rgba(239,68,68,0.08);border-radius:8px;margin-bottom:6px'}))"><button class="btn btn-outline btn-xs btn-full" onclick="document.getElementById('ncUpload_${node.id}').click()">🔄 Replace</button><input type="file" id="ncUpload_${node.id}" accept="image/*" style="display:none" onchange="NodeCanvas.uploadReferenceImage('${node.id}',event)">`
          :`<button class="btn btn-outline btn-full" style="height:56px" onclick="document.getElementById('ncUpload_${node.id}').click()">📤 Upload Image</button><input type="file" id="ncUpload_${node.id}" accept="image/*" style="display:none" onchange="NodeCanvas.uploadReferenceImage('${node.id}',event)">`;
      case "characterSheet": {
        const prods=(S.productions||[]).filter(p=>p.characterSheetStatus==="approved");
        return `<select onchange="NodeCanvas.updateNodeData('${node.id}','sourceProductionId',this.value)"><option value="">Select production…</option>${prods.map(p=>`<option value="${p.id}" ${node.data.sourceProductionId===p.id?'selected':''}>${p.title||p.id}</option>`).join('')}</select>
        <select onchange="NodeCanvas.updateNodeData('${node.id}','view',this.value)">${["front","back","side","threeQuarter","face","special"].map(v=>`<option value="${v}" ${node.data.view===v?'selected':''}>${v}</option>`).join('')}</select>
        ${(()=>{const prod=(S.productions||[]).find(p=>p.id===node.data.sourceProductionId);const url=prod&&prod.characterSheet?prod.characterSheet[node.data.view]:null;return url?`<img src="${url}" style="margin-top:6px">`:'';})()}`;
      }
      case "styleRef":
        return `<select onchange="NodeCanvas.updateNodeData('${node.id}','styleName',this.value)">${STYLE_LIBRARY.map(s=>`<option value="${s.name}" ${node.data.styleName===s.name?'selected':''}>${s.name}</option>`).join('')}</select>`;
      case "generatedImage": {
        const refCount=node.inputs.filter(p=>p.portId.startsWith("in_ref_")&&p.connectedEdgeId).length;
        const modelMax={"fal-ai/flux/dev":4,"fal-ai/flux-pro/v1.1":4,"fal-ai/nano-banana-2":14,"fal-ai/nano-banana-pro":2,"openai/gpt-image-2":16}[node.data.model]||4;
        return `${node.data.resultUrl?`<img src="${node.data.resultUrl}">`:''}<textarea placeholder="Manual prompt (used if nothing connected)" onchange="NodeCanvas.updateNodeData('${node.id}','manualPrompt',this.value)">${node.data.manualPrompt||''}</textarea><label class="nc-field-label">Model</label><select onchange="NodeCanvas.updateNodeData('${node.id}','model',this.value)"><option value="fal-ai/flux/dev" ${node.data.model==='fal-ai/flux/dev'?'selected':''}>FLUX Dev — up to 4 refs</option><option value="fal-ai/flux-pro/v1.1" ${node.data.model==='fal-ai/flux-pro/v1.1'?'selected':''}>FLUX Pro — up to 4 refs</option><option value="fal-ai/nano-banana-2" ${node.data.model==='fal-ai/nano-banana-2'?'selected':''}>Nano Banana 2 — up to 14 refs</option><option value="fal-ai/nano-banana-pro" ${node.data.model==='fal-ai/nano-banana-pro'?'selected':''}>Nano Banana Pro — up to 2 refs</option><option value="openai/gpt-image-2" ${node.data.model==='openai/gpt-image-2'?'selected':''}>GPT Image 2 — up to 16 refs</option></select>
        <div style="font-size:9px;color:${refCount>modelMax?'var(--red)':'var(--textm)'};margin-top:3px">${refCount}/${modelMax} reference images connected${refCount>modelMax?' — extras will be ignored on Run':''}</div>
        <label class="nc-field-label">Aspect Ratio</label><select onchange="NodeCanvas.updateNodeData('${node.id}','aspectRatio',this.value)">${["16:9","1:1","9:16","4:3","3:4"].map(r=>`<option value="${r}" ${(node.data.aspectRatio||"1:1")===r?'selected':''}>${r}</option>`).join('')}</select>`;
      }
      case "videoClip": {
        const imgCount=node.inputs.filter(p=>p.portId.startsWith("in_img_")&&p.connectedEdgeId).length;
        const vidCount=node.inputs.filter(p=>p.portId.startsWith("in_vid_")&&p.connectedEdgeId).length;
        const audCount=node.inputs.filter(p=>p.portId.startsWith("in_aud_")&&p.connectedEdgeId).length;
        const isSeedance=node.data.model.includes("seedance");
        const ncCap=VIDEO_MODEL_CAPABILITIES[node.data.model]||{};
        const hasRealRefs=isSeedance||ncCap.provider==="kling-o3-ref"||!!IMAGE_TO_VIDEO_MAP[node.data.model];
        const resOptions=VIDEO_MODEL_RESOLUTIONS[node.data.model];
        return `${node.data.resultUrl?`<video src="${node.data.resultUrl}" controls></video>`:''}<textarea placeholder="Manual prompt (used if nothing connected)" onchange="NodeCanvas.updateNodeData('${node.id}','manualPrompt',this.value)">${node.data.manualPrompt||''}</textarea>
        <label class="nc-field-label">Video Model</label>
        <select onchange="NodeCanvas.setVideoModel('${node.id}',this.value)">
          <option value="bytedance/seedance-2.0/reference-to-video" ${node.data.model==='bytedance/seedance-2.0/reference-to-video'?'selected':''}>Seedance 2.0 — up to 9 img/3 vid/3 aud</option>
          <option value="bytedance/seedance-2.0/fast/reference-to-video" ${node.data.model==='bytedance/seedance-2.0/fast/reference-to-video'?'selected':''}>Seedance 2.0 Fast — up to 9 img/3 vid/3 aud</option>
          <option value="fal-ai/kling-video/v2.1/master/text-to-video" ${node.data.model==='fal-ai/kling-video/v2.1/master/text-to-video'?'selected':''}>Kling 2.1 Master — 1 ref image</option>
          <option value="fal-ai/kling-video/v2.6/pro/text-to-video" ${node.data.model==='fal-ai/kling-video/v2.6/pro/text-to-video'?'selected':''}>Kling 2.6 Pro — 1 ref image</option>
          <option value="fal-ai/kling-video/v3/standard/text-to-video" ${node.data.model==='fal-ai/kling-video/v3/standard/text-to-video'?'selected':''}>Kling 3.0 Standard — up to 4 ref images</option>
          <option value="fal-ai/kling-video/v3/pro/text-to-video" ${node.data.model==='fal-ai/kling-video/v3/pro/text-to-video'?'selected':''}>Kling 3.0 Pro — up to 4 ref images</option>
          <option value="fal-ai/kling-video/o3/pro/reference-to-video" ${node.data.model==='fal-ai/kling-video/o3/pro/reference-to-video'?'selected':''}>Kling O3 Pro — up to 4 img + 2 vid</option>
          <option value="fal-ai/veo3.1" ${node.data.model==='fal-ai/veo3.1'?'selected':''}>Veo 3.1 — no refs</option>
        </select>
        <div style="font-size:9px;color:${(!hasRealRefs&&(imgCount+vidCount+audCount)>0)?'var(--red)':'var(--textm)'};margin-top:3px">
          ${isSeedance?`${imgCount}/9 images · ${vidCount}/3 videos · ${audCount}/3 audio${(imgCount+vidCount+audCount)>12?' — over the 12-file combined limit':''}`
            :ncCap.provider==="kling-o3-ref"?`${imgCount}/4 images · ${vidCount}/2 videos${audCount?' · audio connected but ignored':''}`
            :IMAGE_TO_VIDEO_MAP[node.data.model]?`${imgCount} image(s) connected${(ncCap.elements?imgCount>4:imgCount>1)?' — extra ones will be ignored':(!ncCap.elements&&imgCount>1)?' — only the first is used on this tier':''}`
            :(imgCount+vidCount+audCount)>0?`⚠️ ${imgCount+vidCount+audCount} ref(s) connected but this model ignores them`:'This model uses prompt only, no references'}
        </div>
        <div class="nc-inline-row">
          ${resOptions?`<div style="flex:1"><label class="nc-field-label">Res</label><select onchange="NodeCanvas.updateNodeData('${node.id}','resolution',this.value)">${resOptions.map(r=>`<option value="${r}" ${node.data.resolution===r?'selected':''}>${r}</option>`).join('')}</select></div>`:''}
          <div style="flex:1"><label class="nc-field-label">Duration</label><select onchange="NodeCanvas.updateNodeData('${node.id}','duration',parseInt(this.value))">${(VIDEO_MODEL_DURATIONS[node.data.model]?.options||[4,5,6,8]).map(d=>`<option value="${d}" ${node.data.duration===d?'selected':''}>${d}s</option>`).join('')}</select></div>
          <div style="flex:1"><label class="nc-field-label">Aspect</label><select onchange="NodeCanvas.updateNodeData('${node.id}','aspectRatio',this.value)">${["16:9","9:16","1:1","4:3","3:4"].map(r=>`<option value="${r}" ${(node.data.aspectRatio||"16:9")===r?'selected':''}>${r}</option>`).join('')}</select></div>
        </div>`;
      }
      case "upscale":
        return `${node.data.resultUrl?`<img src="${node.data.resultUrl}">`:''}<label class="nc-field-label">Engine</label><select onchange="NodeCanvas.updateNodeData('${node.id}','engine',this.value)"><option value="fal-ai/esrgan" ${node.data.engine==='fal-ai/esrgan'?'selected':''}>ESRGAN</option><option value="fal-ai/clarity-upscaler" ${node.data.engine==='fal-ai/clarity-upscaler'?'selected':''}>Clarity</option></select>`;
      case "audioTTS":
        return `${node.data.resultUrl?`<audio src="${node.data.resultUrl}" controls style="width:100%"></audio>`:''}<textarea placeholder="Manual text (used if nothing connected)" onchange="NodeCanvas.updateNodeData('${node.id}','manualText',this.value)">${node.data.manualText||''}</textarea>`;
      default: return '';
    }
  }
  function updateEdgePositionsOnly(){
    // Cheap path used during an active node drag: mutate existing <path> d
    // and <linearGradient> coordinates in place, no DOM node creation. The
    // full renderEdges() below recreates every gradient/path from scratch,
    // which is fine once per drag but was very likely the actual cause of
    // 'dragging does nothing' — that full rebuild firing on every single
    // pointermove event is expensive enough to visibly stall on mobile.
    Object.values(graphState.edges).forEach(edge=>{
      const d=edgePathD(edge);
      if(!d)return;
      const path=edgeSvgEl.querySelector(`path[data-edge-id="${edge.id}"]`);
      if(path)path.setAttribute("d",d);
      const grad=edgeSvgEl.querySelector(`#nc-edge-grad-${edge.id}`);
      if(grad){
        const from=portScreenPos(edge.fromNode,edge.fromPort,"out"),to=portScreenPos(edge.toNode,edge.toPort,"in");
        if(from&&to){grad.setAttribute("x1",from.x);grad.setAttribute("y1",from.y);grad.setAttribute("x2",to.x);grad.setAttribute("y2",to.y);}
      }
    });
  }
  function renderEdges(){
    const svgNS="http://www.w3.org/2000/svg";
    edgeSvgEl.innerHTML='';
    const defs=document.createElementNS(svgNS,"defs");
    edgeSvgEl.appendChild(defs);
    Object.values(graphState.edges).forEach(edge=>{
      const d=edgePathD(edge);
      if(!d)return;
      const fromNode=graphState.nodes[edge.fromNode],toNode=graphState.nodes[edge.toNode];
      const fromColor=fromNode?NODE_DEFS[fromNode.type].color:"#6FE3FF";
      const toColor=toNode?NODE_DEFS[toNode.type].color:"#6FE3FF";
      const gradId="nc-edge-grad-"+edge.id;
      const grad=document.createElementNS(svgNS,"linearGradient");
      grad.setAttribute("id",gradId);
      grad.setAttribute("gradientUnits","userSpaceOnUse");
      const from=portScreenPos(edge.fromNode,edge.fromPort,"out"),to=portScreenPos(edge.toNode,edge.toPort,"in");
      if(from&&to){grad.setAttribute("x1",from.x);grad.setAttribute("y1",from.y);grad.setAttribute("x2",to.x);grad.setAttribute("y2",to.y);}
      const stop1=document.createElementNS(svgNS,"stop");stop1.setAttribute("offset","0%");stop1.setAttribute("stop-color",fromColor);
      const stop2=document.createElementNS(svgNS,"stop");stop2.setAttribute("offset","100%");stop2.setAttribute("stop-color",toColor);
      grad.appendChild(stop1);grad.appendChild(stop2);
      defs.appendChild(grad);
      const path=document.createElementNS(svgNS,"path");
      path.setAttribute("data-edge-id",edge.id);
      path.setAttribute("d",d);
      path.setAttribute("class","nc-edge-path");
      path.setAttribute("stroke",`url(#${gradId})`);
      edgeSvgEl.appendChild(path);
    });
  }
  function portScreenPos(nodeId,portId,dir){
    const node=graphState.nodes[nodeId];
    if(!node)return null;
    const el=nodesLayerEl.querySelector(`.nc-port[data-node="${nodeId}"][data-dir="${dir}"]`);
    if(!el)return{x:node.position.x+(dir==='out'?node.size.w:0),y:node.position.y+40};
    // getBoundingClientRect + the transform layer's own rect, rather than
    // offsetLeft/Top — safe regardless of DOM nesting changes.
    const portRect=el.getBoundingClientRect();
    const layerRect=layerEl.getBoundingClientRect();
    const baseX=(portRect.left+portRect.width/2-layerRect.left)/graphState.viewport.zoom;
    const baseY=(portRect.top+portRect.height/2-layerRect.top)/graphState.viewport.zoom;
    // Ports are consolidated to one visual + per side, but a node can still
    // have multiple distinct underlying ports (e.g. Generated Image's 3
    // inputs) — fan each one's actual wire endpoint out slightly so several
    // simultaneous connections at the same visual point stay distinguishable
    // instead of perfectly overlapping.
    const portList=dir==='out'?node.outputs:node.inputs;
    const idx=portList.findIndex(p=>p.portId===portId);
    const fanOffset=portList.length>1&&idx>=0?(idx-(portList.length-1)/2)*13:0;
    return{x:baseX,y:baseY+fanOffset};
  }
  function edgePathD(edge){
    const from=portScreenPos(edge.fromNode,edge.fromPort,"out");
    const to=portScreenPos(edge.toNode,edge.toPort,"in");
    if(!from||!to)return null;
    const dx=Math.max(40,Math.abs(to.x-from.x)*0.5);
    return `M${from.x},${from.y} C${from.x+dx},${from.y} ${to.x-dx},${to.y} ${to.x},${to.y}`;
  }
  function renderMinimap(){
    const nodes=Object.values(graphState.nodes);
    if(!nodes.length){minimapEl.innerHTML='';return;}
    const xs=nodes.map(n=>n.position.x),ys=nodes.map(n=>n.position.y);
    const minX=Math.min(...xs)-40,maxX=Math.max(...xs.map((x,i)=>x+nodes[i].size.w))+40;
    const minY=Math.min(...ys)-40,maxY=Math.max(...ys.map((y,i)=>y+nodes[i].size.h))+40;
    const spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
    const mmW=120,mmH=80;
    const scale=Math.min(mmW/spanX,mmH/spanY);
    minimapEl.innerHTML=nodes.map(n=>`<div class="nc-minimap-node" style="left:${(n.position.x-minX)*scale}px;top:${(n.position.y-minY)*scale}px;width:${Math.max(3,n.size.w*scale)}px;height:${Math.max(3,n.size.h*scale)}px;background:${NODE_DEFS[n.type]?.color||'#888'}"></div>`).join('');
  }
  function renderCostReadout(){
    const el=rootEl.querySelector(".nc-cost-readout");
    if(!el)return;
    const total=Object.values(graphState.nodes).reduce((s,n)=>s+(n.meta.cost||0),0);
    el.textContent=`Graph cost: ~$${total.toFixed(3)}`;
  }

  // ── 3c. Interaction handlers (pointer-events based: unifies touch/mouse) ──
  function onNodeDragStart(e,nodeId){
    // Long-press the tab to arm Move Mode, instead of a continuous drag —
    // continuous pointer-drag tracking didn't hold up reliably on mobile
    // even after two rounds of fixes, so this trades the fluid drag gesture
    // for a more robust discrete tap-to-place interaction instead.
    e.stopPropagation();
    const startX=e.clientX,startY=e.clientY;
    clearTimeout(longPressTimer);
    longPressTimer=setTimeout(()=>{ enterMoveMode(nodeId); },380);
    const cancel=()=>{clearTimeout(longPressTimer);document.removeEventListener("pointerup",cancel);document.removeEventListener("pointermove",moveCancel);};
    const moveCancel=(me)=>{ if(Math.hypot(me.clientX-startX,me.clientY-startY)>10)cancel(); };
    document.addEventListener("pointerup",cancel,{once:true});
    document.addEventListener("pointermove",moveCancel);
  }
  function enterMoveMode(nodeId){
    moveModeNodeId=nodeId;
    graphState.selection.nodeIds=[nodeId];
    toast("📍 Move mode — tap anywhere on the canvas to place this node","");
    renderMoveModeBanner();
    renderNodeOnly(nodeId);
  }
  function freezeMove(){
    if(!moveModeNodeId)return;
    moveModeNodeId=null;
    autoSaveDebounced();
    renderMoveModeBanner();
    renderAll();
    toast("❄️ Position locked","success");
  }
  function renderMoveModeBanner(){
    let banner=rootEl.querySelector(".nc-move-banner");
    if(!moveModeNodeId){ if(banner)banner.remove(); return; }
    if(!banner){
      banner=document.createElement("div");
      banner.className="nc-move-banner";
      rootEl.appendChild(banner);
    }
    banner.innerHTML=`<span>📍 Tap the canvas to place this node</span><button onclick="NodeCanvas.freezeMove()">❄️ Freeze</button>`;
  }
  function onCanvasTapForMove(e){
    if(!moveModeNodeId)return;
    if(e.target!==viewportEl&&e.target!==layerEl)return; // only place on a tap over empty canvas, not on another node
    const node=graphState.nodes[moveModeNodeId];
    if(!node)return;
    const pos=screenToCanvas(e.clientX,e.clientY);
    node.position.x=pos.x-node.size.w/2;
    node.position.y=pos.y-20;
    autoSaveDebounced();
    renderNodeOnly(moveModeNodeId);
    renderEdges();
    renderMinimap();
  }
  function onNodeBodyPointerDown(e,nodeId){
    // Long-press → context menu. Ignore if the tap landed on an interactive
    // control (port/button/select/textarea) so those keep working normally.
    const tag=e.target.tagName;
    if(["BUTTON","SELECT","TEXTAREA","INPUT"].includes(tag)||e.target.classList.contains("nc-port"))return;
    clearTimeout(longPressTimer);
    const startX=e.clientX,startY=e.clientY;
    longPressTimer=setTimeout(()=>{ showContextMenu(nodeId,startX,startY); },480);
    const cancel=()=>{clearTimeout(longPressTimer);document.removeEventListener("pointerup",cancel);document.removeEventListener("pointermove",moveCancel);};
    const moveCancel=(me)=>{ if(Math.hypot(me.clientX-startX,me.clientY-startY)>8)cancel(); };
    document.addEventListener("pointerup",cancel,{once:true});
    document.addEventListener("pointermove",moveCancel);
  }
  function showContextMenu(nodeId,x,y){
    document.querySelectorAll(".nc-context-menu").forEach(m=>m.remove());
    const menu=document.createElement("div");
    menu.className="nc-context-menu";
    menu.style.left=Math.min(x,window.innerWidth-160)+"px";
    menu.style.top=Math.min(y,window.innerHeight-140)+"px";
    menu.innerHTML=`
      <button onclick="NodeCanvas.runNode('${nodeId}');this.closest('.nc-context-menu').remove()">▶ Run</button>
      <button onclick="NodeCanvas.duplicateNode('${nodeId}');this.closest('.nc-context-menu').remove()">⧉ Duplicate</button>
      <button class="nc-danger" onclick="NodeCanvas.deleteNode('${nodeId}');this.closest('.nc-context-menu').remove()">🗑 Delete</button>`;
    document.body.appendChild(menu);
    setTimeout(()=>document.addEventListener("pointerdown",function closeMenu(ev){ if(!menu.contains(ev.target)){menu.remove();document.removeEventListener("pointerdown",closeMenu);} }),50);
  }
  function duplicateNode(nodeId){
    const node=graphState.nodes[nodeId];
    if(!node)return;
    const id=addNode(node.type,{x:node.position.x+30,y:node.position.y+30});
    if(id)graphState.nodes[id].data={...node.data};
    autoSaveDebounced();
    renderAll();
  }
  function onCanvasPointerDown(e){
    if(e.target!==viewportEl&&e.target!==layerEl)return; // only pan on empty canvas space, never on a node
    viewportEl.classList.add("nc-panning");
    dragState={mode:"pan",pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,viewStartX:graphState.viewport.x,viewStartY:graphState.viewport.y};
  }
  function onPointerMove(e){
    if(!dragState||dragState.pointerId!==e.pointerId)return;
    const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;
    if(dragState.mode==="pan"){
      graphState.viewport.x=dragState.viewStartX+dx;
      graphState.viewport.y=dragState.viewStartY+dy;
      applyTransform();
    } else if(dragState.mode==="node"){
      if(!dragState._logged){console.log("Node Canvas: node drag move is being applied, dx/dy:",dx,dy);dragState._logged=true;}
      const node=graphState.nodes[dragState.nodeId];
      if(!node)return;
      node.position.x=dragState.nodeStartX+dx/graphState.viewport.zoom;
      node.position.y=dragState.nodeStartY+dy/graphState.viewport.zoom;
      const el=nodesLayerEl.querySelector(`[data-node-id="${node.id}"]`);
      if(el){el.style.left=node.position.x+"px";el.style.top=node.position.y+"px";}
      updateEdgePositionsOnly(); // cheap in-place update, not a full rebuild — see comment on updateEdgePositionsOnly
    }
  }
  function onPointerUp(e){
    if(dragState&&dragState.pointerId===e.pointerId){
      viewportEl.classList.remove("nc-panning");
      if(dragState.mode==="node"){autoSaveDebounced();renderEdges();renderMinimap();}
      dragState=null;
    }
  }
  function pickInputPort(node,type){
    return node.inputs.find(p=>!p.connectedEdgeId&&p.accepts.includes(type))||null;
  }
  function showOutputPortPicker(nodeId,anchorEl){
    const node=graphState.nodes[nodeId];
    document.querySelectorAll(".nc-context-menu").forEach(m=>m.remove());
    const menu=document.createElement("div");
    menu.className="nc-context-menu";
    const rect=anchorEl.getBoundingClientRect();
    menu.style.left=Math.min(rect.right+8,window.innerWidth-160)+"px";
    menu.style.top=Math.max(8,rect.top-20)+"px";
    menu.innerHTML=`<div style="padding:6px 10px;font-size:10px;color:var(--textm);font-weight:700">Connect from:</div>`+node.outputs.map(p=>`<button onclick="NodeCanvas._pickOutputPort('${nodeId}','${p.portId}');this.closest('.nc-context-menu').remove()">${p.label}</button>`).join('');
    document.body.appendChild(menu);
    setTimeout(()=>document.addEventListener("pointerdown",function close(ev){ if(!menu.contains(ev.target)){menu.remove();document.removeEventListener("pointerdown",close);} }),50);
  }
  function pickOutputPort(nodeId,portId){
    const node=graphState.nodes[nodeId];
    const portDef=node.outputs.find(p=>p.portId===portId);
    pendingConnection={nodeId,portId,type:portDef.type,direction:"out"};
    document.querySelectorAll(`.nc-port-out[data-node="${nodeId}"]`).forEach(p=>p.classList.add("nc-port-active"));
    toast(`Selected "${portDef.label}" — now tap a target node's input`,"");
  }
  function onPortTap(e,nodeId,dir){
    e.stopPropagation();
    const node=graphState.nodes[nodeId];
    if(!pendingConnection){
      if(dir==="out"){
        if(node.outputs.length>1){ showOutputPortPicker(nodeId,e.target); return; }
        pendingConnection={nodeId,portId:node.outputs[0].portId,type:node.outputs[0].type,direction:"out"};
      } else {
        pendingConnection={nodeId,portId:null,direction:"in"}; // resolved to a specific port on completion
      }
      e.target.classList.add("nc-port-active");
      return;
    }
    // Second tap: try to complete a connection (order-independent — works
    // whether the user tapped output-then-input or input-then-output). The
    // single + doesn't carry a specific portId for inputs anymore, so the
    // actual target port is auto-resolved here: first empty input that
    // accepts the source's type. A friendly error explains it when none fit.
    document.querySelectorAll(".nc-port-active").forEach(p=>p.classList.remove("nc-port-active"));
    if(pendingConnection.nodeId===nodeId&&pendingConnection.direction===dir){ pendingConnection=null; return; } // tapped the same side twice — cancel
    if(pendingConnection.direction==="out"&&dir==="in"){
      const target=pickInputPort(node,pendingConnection.type);
      if(!target){ toast(`❌ This node has no open input for that — every compatible slot is either full or doesn't accept a ${pendingConnection.type}`,"error"); pendingConnection=null; return; }
      addEdge(pendingConnection.nodeId,pendingConnection.portId,nodeId,target.portId);
    } else if(pendingConnection.direction==="in"&&dir==="out"){
      if(node.outputs.length>1){ showOutputPortPicker(nodeId,e.target); pendingConnection={...pendingConnection}; return; }
      const outPort=node.outputs[0];
      const pendingNode=graphState.nodes[pendingConnection.nodeId];
      const target=pickInputPort(pendingNode,outPort.type);
      if(!target){ toast(`❌ This node has no open input for that — every compatible slot is either full or doesn't accept a ${outPort.type}`,"error"); pendingConnection=null; return; }
      addEdge(nodeId,outPort.portId,pendingConnection.nodeId,target.portId);
    } else {
      toast("Connect an output to an input","error");
    }
    pendingConnection=null;
  }
  function onTouchStartPinch(e){
    if(e.touches.length!==2)return;
    const [t1,t2]=e.touches;
    pinchState={startDist:Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY),startZoom:graphState.viewport.zoom,midX:(t1.clientX+t2.clientX)/2,midY:(t1.clientY+t2.clientY)/2,viewStartX:graphState.viewport.x,viewStartY:graphState.viewport.y};
  }
  function onTouchMovePinch(e){
    if(!pinchState||e.touches.length!==2)return;
    e.preventDefault();
    const [t1,t2]=e.touches;
    const dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
    const newZoom=Math.min(2.5,Math.max(0.2,pinchState.startZoom*(dist/pinchState.startDist)));
    // Zoom around the pinch midpoint so the content under your fingers stays put.
    const rect=viewportEl.getBoundingClientRect();
    const canvasX=(pinchState.midX-rect.left-pinchState.viewStartX)/pinchState.startZoom;
    const canvasY=(pinchState.midY-rect.top-pinchState.viewStartY)/pinchState.startZoom;
    graphState.viewport.zoom=newZoom;
    graphState.viewport.x=pinchState.midX-rect.left-canvasX*newZoom;
    graphState.viewport.y=pinchState.midY-rect.top-canvasY*newZoom;
    applyTransform();
  }
  function onTouchEndPinch(){pinchState=null;}
  function zoomBy(factor){
    const rect=viewportEl.getBoundingClientRect();
    const cx=rect.width/2,cy=rect.height/2;
    const canvasX=(cx-graphState.viewport.x)/graphState.viewport.zoom;
    const canvasY=(cy-graphState.viewport.y)/graphState.viewport.zoom;
    graphState.viewport.zoom=Math.min(2.5,Math.max(0.2,graphState.viewport.zoom*factor));
    graphState.viewport.x=cx-canvasX*graphState.viewport.zoom;
    graphState.viewport.y=cy-canvasY*graphState.viewport.zoom;
    applyTransform();
    renderMinimap();
  }
  function fitToScreen(){
    const nodes=Object.values(graphState.nodes);
    if(!nodes.length){graphState.viewport={x:0,y:0,zoom:1};applyTransform();return;}
    const xs=nodes.map(n=>n.position.x),ys=nodes.map(n=>n.position.y);
    const minX=Math.min(...xs)-30,maxX=Math.max(...xs.map((x,i)=>x+nodes[i].size.w))+30;
    const minY=Math.min(...ys)-30,maxY=Math.max(...ys.map((y,i)=>y+nodes[i].size.h))+30;
    const rect=viewportEl.getBoundingClientRect();
    const zoom=Math.min(2,Math.max(0.2,Math.min(rect.width/Math.max(1,maxX-minX),rect.height/Math.max(1,maxY-minY))));
    graphState.viewport.zoom=zoom;
    graphState.viewport.x=-minX*zoom;
    graphState.viewport.y=-minY*zoom;
    applyTransform();
    renderMinimap();
  }

  function setVideoModel(nodeId,model){
    const node=graphState.nodes[nodeId];
    if(!node)return;
    node.data.model=model;
    const durConfig=VIDEO_MODEL_DURATIONS[model];
    if(durConfig&&!durConfig.options.includes(node.data.duration))node.data.duration=durConfig.options[0];
    const resOptions=VIDEO_MODEL_RESOLUTIONS[model];
    if(resOptions&&!resOptions.includes(node.data.resolution))node.data.resolution=resOptions[0];
    autoSaveDebounced();
    renderNodeOnly(nodeId);
  }
  function updateNodeData(nodeId,field,value){
    const node=graphState.nodes[nodeId];
    if(!node)return;
    node.data[field]=value;
    autoSaveDebounced();
  }
  async function uploadReferenceImage(nodeId,event){
    const file=event.target.files[0];
    event.target.value="";
    if(!file)return;
    const node=graphState.nodes[nodeId];
    if(!node)return;
    const btn=event.target.previousElementSibling;
    const origLabel=btn?btn.textContent:"";
    if(btn){btn.textContent="⏳ Uploading…";btn.disabled=true;}
    try{
      const path=`node-canvas/${nodeId}_${Date.now()}_${file.name}`;
      const ref=fbStorage.ref(path);
      // Race against a timeout — if Storage isn't actually enabled in the
      // Firebase console, .put() can hang indefinitely instead of cleanly
      // rejecting, which would otherwise leave this stuck forever with no
      // visible error (exactly what "still not showing" looked like).
      await Promise.race([
        ref.put(file),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("Cloud upload timed out")),8000))
      ]);
      node.data.url=await ref.getDownloadURL();
      console.log("Node Canvas: reference image uploaded to Storage:",node.data.url);
    }catch(err){
      console.warn("Node Canvas cloud upload failed/timed out, falling back to local copy:",err);
      try{
        node.data.url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read file"));r.readAsDataURL(file);});
        toast("⚠️ Cloud storage unavailable — saved on this device only","error");
      }catch(err2){
        toast(`❌ Upload failed: ${err2.message}`,"error");
        if(btn){btn.textContent=origLabel;btn.disabled=false;}
        return;
      }
    }
    node.data.uploadedAt=Date.now();
    autoSaveDebounced();
    // Self-healing: if the node's DOM element went stale during the upload
    // (e.g. the graph re-rendered for an unrelated reason while we were
    // waiting), fall back to a full re-render instead of silently no-op'ing.
    if(nodesLayerEl.querySelector(`[data-node-id="${nodeId}"]`))renderNodeOnly(nodeId);
    else renderAll();
    toast("✅ Reference image added","success");
  }

  // ── init / public API ──
  function init(container){
    rootEl=container;
    rootEl.innerHTML=`
      <div class="nc-toolbar">
        <div class="nc-toolbar-group">
          ${(()=>{const shortLabels={promptText:"PROMPT",referenceImage:"REF",characterSheet:"CHAR",styleRef:"STYLE",generatedImage:"IMAGE",videoClip:"VIDEO",upscale:"SCALE",audioTTS:"AUDIO"};return Object.keys(NODE_DEFS).map(t=>`<button class="nc-tool-btn" style="--btn-color:${NODE_DEFS[t].color}" title="Add ${NODE_DEFS[t].label}" onclick="NodeCanvas.addNode('${t}')"><span>+</span><span>${shortLabels[t]}</span></button>`).join('');})()}
        </div>
        <div class="nc-toolbar-group">
          <button class="nc-tool-btn-plain" title="Zoom in" onclick="NodeCanvas.zoomBy(1.2)">➕</button>
          <button class="nc-tool-btn-plain" title="Zoom out" onclick="NodeCanvas.zoomBy(0.83)">➖</button>
          <button class="nc-tool-btn-plain" title="Fit to screen" onclick="NodeCanvas.fitToScreen()">⛶</button>
        </div>
      </div>
      <div class="nc-viewport">
        <div class="nc-transform-layer">
          <svg class="nc-edge-svg"></svg>
          <div class="nc-nodes-layer"></div>
        </div>
      </div>
      <div class="nc-minimap"></div>
      <div class="nc-cost-readout">Graph cost: ~$0.000</div>
    `;
    viewportEl=rootEl.querySelector(".nc-viewport");
    layerEl=rootEl.querySelector(".nc-transform-layer");
    edgeSvgEl=rootEl.querySelector(".nc-edge-svg");
    nodesLayerEl=rootEl.querySelector(".nc-nodes-layer");
    minimapEl=rootEl.querySelector(".nc-minimap");

    viewportEl.addEventListener("pointerdown",onCanvasPointerDown);
    viewportEl.addEventListener("click",onCanvasTapForMove);
    if(!_documentListenersAttached){
      document.addEventListener("pointermove",onPointerMove);
      document.addEventListener("pointerup",onPointerUp);
      document.addEventListener("pointercancel",onPointerUp);
      _documentListenersAttached=true;
    }
    viewportEl.addEventListener("touchstart",onTouchStartPinch,{passive:true});
    viewportEl.addEventListener("touchmove",onTouchMovePinch,{passive:false});
    viewportEl.addEventListener("touchend",onTouchEndPinch);

    (async()=>{
      await loadProjectsList();
      const lastId=currentProjectId||(await idbGet("kk_nc_last_project"))||localStorage.getItem("kk_nc_last_project");
      const validId=(lastId&&(S.nodeCanvasProjects||[]).find(p=>p.id===lastId))?lastId:(S.nodeCanvasProjects[0]&&S.nodeCanvasProjects[0].id);
      switchProject(validId);
    })();
  }

  return{
    init,addNode,deleteNode,addEdge,deleteEdge,runNode,runGraphFrom,
    serializeGraph,loadGraph,switchProject,updateNodeData,uploadReferenceImage,setVideoModel,
    duplicateNode,zoomBy,fitToScreen,
    _onNodeDragStart:onNodeDragStart,_onNodeBodyPointerDown:onNodeBodyPointerDown,_onPortTap:onPortTap,_pickOutputPort:pickOutputPort,freezeMove,
  };
})();


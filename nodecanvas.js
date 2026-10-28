// ══════════════════════════════════════════════════════════════════════
// NODE CANVAS ENGINE — graph store · executor · persistence · UI.
//
// Node TYPES live in nodecanvas-registry.js (NC_REGISTRY); this file is
// generic and never names a specific node. Layers, top to bottom:
//   1. Graph store    — one graph object, mutated only through the API below,
//                       with snapshot undo/redo and cycle-safe, type-checked
//                       connections.
//   2. Executor       — plans the upstream nodes that need a run, executes them
//                       in parallel waves, blocks anything downstream of a
//                       failure, supports Run all / Run selected / Stop.
//   3. Persistence    — many canvases (new / open / previous / rename /
//                       duplicate / delete-with-undo), debounced autosave to
//                       IndexedDB + cloud, migration of older saved graphs.
//   4. UI             — pan/zoom canvas, node cards, wires you can tap to cut,
//                       selection bar, canvas manager sheets, node library.
//
// Loaded AFTER nodecanvas-registry.js and index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

function renderNodeCanvasModule(el){
  el.innerHTML=`
    <div class="nc2-head">
      <div class="nc2-title">🕸 Canvas<span>autosaves · chain prompts, references and shots</span></div>
      <div class="nc2-bar">
        <button class="nc2-btn" id="ncBtnPrev" onclick="NodeCanvas.goPrevious()" title="Back to the canvas you had open before"><i>◀</i><span>Previous</span></button>
        <button class="nc2-name" id="ncBtnName" onclick="NodeCanvas.openCanvases()" title="All canvases"><b id="ncName">…</b><small id="ncMeta"></small><i>▾</i></button>
        <button class="nc2-btn" onclick="NodeCanvas.openNew()" title="New canvas"><i>＋</i><span>New</span></button>
        <button class="nc2-btn nc2-danger" onclick="NodeCanvas.deleteCurrent()" title="Delete this canvas"><i>🗑</i><span>Delete</span></button>
      </div>
    </div>
    <div id="node-canvas-root" class="nc-root"></div>`;
  NodeCanvas.init(document.getElementById("node-canvas-root"));
}

const NodeCanvas=(function(){
  "use strict";
  const REG=window.NC_REGISTRY,esc=window.NC_ESC;
  const SCHEMA=2,MAX_UNDO=40,MIN_Z=0.2,MAX_Z=2.5,PARALLEL=3;
  const K_PROJ="kk_nc_projects",K_LAST="kk_nc_last_project",K_RECENT="kk_nc_recent";
  const gk=id=>"kk_nc_graph_"+id;
  const blank=()=>({nodes:{},edges:{},viewport:{x:0,y:0,zoom:1},selection:{nodeIds:[],edgeIds:[]}});

  // ── state ──
  let G=blank();
  let rootEl=null,viewportEl=null,layerEl=null,edgeSvgEl=null,nodesLayerEl=null,minimapEl=null;
  let projects=[],recent=[],projectId=null,loaded=false,openSeq=0;
  let undoStack=[],redoStack=[],typeKey="",typeTime=0;
  let pending=null,moveId=null,drag=null,pinch=null,longPress=null,panMoved=false;
  let runState={active:0,cancel:false};
  let dirty=false,saveTimer=null,cloudTimer=null,cloudPayload=null;
  let lastDeleted=null,snackTimer=null,newTpl="blank",listeners=false;

  // ── small helpers ──
  const uid=p=>p+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
  const def=t=>REG.get(t);
  const isInstant=n=>{const d=def(n.type);return !!(d&&d.instant);};
  const num=(v,d)=>Number.isFinite(+v)&&v!==null&&v!==""?+v:d;
  const isObj=v=>v&&typeof v==="object"&&!Array.isArray(v);
  const $=(s,r)=>(r||rootEl||document).querySelector(s);
  const tst=(m,t)=>{try{toast(m,t||"");}catch(e){console.warn(m);}};
  const Sx=()=>typeof S!=="undefined"?S:{};
  const colorOk=c=>/^#[0-9a-fA-F]{3,8}$/.test(c)?c:"#888";
  function clone(v){ // strings (data URLs!) are shared, only containers are copied
    if(Array.isArray(v))return v.map(clone);
    if(v&&typeof v==="object"){const o={};for(const k in v)o[k]=clone(v[k]);return o;}
    return v;
  }
  const ago=ts=>{
    if(!ts)return"";const s=(Date.now()-ts)/1000;
    if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+"m ago";
    if(s<86400)return Math.floor(s/3600)+"h ago";return Math.floor(s/86400)+"d ago";
  };
  const money=v=>"$"+(v<0.01&&v>0?v.toFixed(3):v.toFixed(2));

  // ── storage shims (IndexedDB helpers live in index.html) ──
  const idbG=k=>typeof idbGet==="function"?idbGet(k).catch(()=>undefined):Promise.resolve(undefined);
  const idbS=(k,v)=>typeof idbSet==="function"?idbSet(k,v).catch(e=>console.warn("Canvas save failed:",e)):Promise.resolve();
  const idbD=k=>{
    try{
      if(typeof idbOpen==="function"&&typeof IDB_STORE!=="undefined")
        return idbOpen().then(db=>new Promise(res=>{const tx=db.transaction(IDB_STORE,"readwrite");tx.objectStore(IDB_STORE).delete(k);tx.oncomplete=res;tx.onerror=res;}));
    }catch(e){}
    return idbS(k,null);
  };
  const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};

  // ═════════════ 1. GRAPH STORE ═════════════
  function mkNode(type,pos,data){
    const d=def(type);
    return{id:uid("node"),type,position:{x:num(pos&&pos.x,0),y:num(pos&&pos.y,0)},size:{w:d.width||220,h:160},
      data:Object.assign(d.defaults(),data||{}),status:"idle",
      inputs:d.inputPorts.map(p=>({...p,connectedEdgeId:null})),outputs:d.outputPorts.map(p=>({...p})),
      meta:{createdAt:Date.now(),model:null,cost:0,error:null}};
  }
  function reaches(g,start,target){ // is `target` downstream of `start`?
    const seen=new Set(),st=[start];
    while(st.length){
      const id=st.pop();if(id===target)return true;if(seen.has(id))continue;seen.add(id);
      for(const e of Object.values(g.edges))if(e.fromNode===id)st.push(e.toNode);
    }
    return false;
  }
  function checkEdge(g,from,fp,to,tp){
    const fn=g.nodes[from],tn=g.nodes[to];
    if(!fn||!tn)return{err:"That node no longer exists"};
    if(from===to)return{err:"A node can't connect to itself"};
    const op=fn.outputs.find(p=>p.portId===fp),ip=tn.inputs.find(p=>p.portId===tp);
    if(!op||!ip)return{err:"That connection point doesn't exist"};
    if(!ip.accepts.includes(op.type))return{err:`${def(tn.type).label} needs ${ip.accepts.join(" or ")} here, not ${op.type}`};
    if(reaches(g,to,from))return{err:"That would create a loop — a node can't feed itself"};
    return{op,ip};
  }
  function dropEdge(id){
    const e=G.edges[id];if(!e)return;
    const tn=G.nodes[e.toNode];
    if(tn){const p=tn.inputs.find(x=>x.portId===e.toPort);if(p&&p.connectedEdgeId===id)p.connectedEdgeId=null;}
    delete G.edges[id];
    G.selection.edgeIds=G.selection.edgeIds.filter(x=>x!==id);
  }
  function snap(){return{nodes:clone(G.nodes),edges:clone(G.edges)};}
  function checkpoint(){
    undoStack.push(snap());if(undoStack.length>MAX_UNDO)undoStack.shift();
    redoStack=[];refreshHistoryBtns();
  }
  function restore(s){
    G.nodes=clone(s.nodes);G.edges=clone(s.edges);
    G.selection.nodeIds=G.selection.nodeIds.filter(id=>G.nodes[id]);
    G.selection.edgeIds=G.selection.edgeIds.filter(id=>G.edges[id]);
    changed();
  }
  const busy=()=>Object.values(G.nodes).some(n=>n.status==="running");
  function undo(){
    if(busy()){tst("⏳ Wait for running nodes to finish","error");return;}
    if(!undoStack.length)return;
    redoStack.push(snap());restore(undoStack.pop());refreshHistoryBtns();
  }
  function redo(){
    if(busy()){tst("⏳ Wait for running nodes to finish","error");return;}
    if(!redoStack.length)return;
    undoStack.push(snap());restore(redoStack.pop());refreshHistoryBtns();
  }
  // Common tail of every structural change.
  function changed(touched){
    (touched||[]).forEach(id=>{const n=G.nodes[id];if(n&&n.status==="done"&&!isInstant(n))n._stale=true;markDownstreamStale(id);});
    refreshInstant();scheduleSave();renderAll();
  }
  function markDownstreamStale(id){
    const seen=new Set(),st=[id];
    while(st.length){
      const cur=st.pop();
      for(const e of Object.values(G.edges))if(e.fromNode===cur&&!seen.has(e.toNode)){
        seen.add(e.toNode);const n=G.nodes[e.toNode];
        if(n&&n.status==="done"&&!isInstant(n))n._stale=true;
        st.push(e.toNode);
      }
    }
  }
  function refreshInstant(){ // sources & pure transforms are "done" exactly when they're valid
    Object.values(G.nodes).forEach(n=>{
      const d=def(n.type);if(!d||!d.instant||n.status==="running")return;
      let err=null;try{err=d.valid?d.valid(n,makeCtx(n)):null;}catch(e){err="Invalid";}
      n.status=err?"idle":"done";n._stale=false;n.meta.error=null;
    });
  }
  function findFree(x,y){
    const ns=Object.values(G.nodes);let guard=0;
    while(guard++<60&&ns.some(n=>Math.abs(n.position.x-x)<30&&Math.abs(n.position.y-y)<30)){x+=32;y+=32;}
    return{x,y};
  }
  function viewCenter(){
    const z=G.viewport.zoom||1,r=viewportEl?viewportEl.getBoundingClientRect():{width:360,height:480};
    return{x:(r.width/2-G.viewport.x)/z,y:(r.height/2-G.viewport.y)/z};
  }
  function addNode(type,position,data){
    const d=def(type);if(!d)return null;
    checkpoint();
    const c=viewCenter();
    const n=mkNode(type,position||findFree(c.x-110,c.y-80),data);
    G.nodes[n.id]=n;G.selection={nodeIds:[n.id],edgeIds:[]};
    changed();
    return n.id;
  }
  function deleteNodes(ids){
    ids=(ids||[]).filter(id=>G.nodes[id]);if(!ids.length)return;
    if(ids.some(id=>G.nodes[id].status==="running")){tst("⏳ Wait for the running node to finish first","error");return;}
    checkpoint();
    const touched=new Set();
    ids.forEach(id=>{
      Object.values(G.edges).forEach(e=>{
        if(e.fromNode===id||e.toNode===id){if(!ids.includes(e.toNode))touched.add(e.toNode);dropEdge(e.id);}
      });
      delete G.nodes[id];
    });
    if(moveId&&!G.nodes[moveId])moveId=null;
    G.selection={nodeIds:[],edgeIds:[]};
    changed([...touched]);
  }
  const deleteNode=id=>deleteNodes([id]);
  function addEdge(from,fp,to,tp){
    const c=checkEdge(G,from,fp,to,tp);
    if(c.err){tst("❌ "+c.err,"error");return null;}
    checkpoint();
    if(c.ip.connectedEdgeId)dropEdge(c.ip.connectedEdgeId); // an input takes one wire — replace, don't stack
    const id=uid("edge");
    G.edges[id]={id,fromNode:from,fromPort:fp,toNode:to,toPort:tp};
    c.ip.connectedEdgeId=id;
    changed([to]);
    return id;
  }
  function deleteEdge(id){
    const e=G.edges[id];if(!e)return;
    checkpoint();dropEdge(id);changed([e.toNode]);
  }
  function disconnectNode(id){
    const es=Object.values(G.edges).filter(e=>e.fromNode===id||e.toNode===id);
    if(!es.length)return;
    checkpoint();const t=new Set();
    es.forEach(e=>{t.add(e.toNode);dropEdge(e.id);});
    changed([...t]);
  }
  function duplicateNode(id){
    const n=G.nodes[id];if(!n)return null;
    checkpoint();
    const c=mkNode(n.type,{x:n.position.x+32,y:n.position.y+32},clone(n.data));
    c.status=n.status==="done"?"done":"idle";c.meta.cost=0;
    G.nodes[c.id]=c;G.selection={nodeIds:[c.id],edgeIds:[]};
    changed();return c.id;
  }
  // Field edits: select/typing/model changes all land here.
  // flags: n = numeric · r = re-render node · t = typing (coalesced undo, no re-render)
  function setField(id,field,value,flags){
    const n=G.nodes[id];if(!n)return;
    flags=flags||"";
    if(flags.includes("n"))value=num(value,value);
    if(flags.includes("t")){
      const k=id+field,now=Date.now();
      if(typeKey!==k||now-typeTime>1500)checkpoint();
      typeKey=k;typeTime=now;
    }else checkpoint();
    n.data[field]=value;
    const d=def(n.type);
    if(d&&d.onChange)d.onChange(n,field);
    if(n.status==="done"&&!isInstant(n))n._stale=true;
    markDownstreamStale(id);
    refreshInstant();scheduleSave();
    if(flags.includes("t")){syncNodeClasses();renderRunBar();}
    else if(flags.includes("r")||(d&&d.onChange))renderNodeOnly(id),syncNodeClasses(),renderRunBar();
    else{syncNodeClasses();renderRunBar();}
  }
  const updateNodeData=(id,f,v)=>setField(id,f,v,"");

  // ═════════════ 2. EXECUTOR ═════════════
  function valueOf(nodeId,portId){
    const n=G.nodes[nodeId];if(!n)return null;
    const d=def(n.type);if(!d)return null;
    if(!d.value)return n.data.resultUrl||null; // generators expose their result by default
    try{return d.value(n,portId,makeCtx(n));}catch(e){return null;}
  }
  function makeCtx(node){
    const get=pid=>{
      const p=node.inputs.find(x=>x.portId===pid);if(!p||!p.connectedEdgeId)return null;
      const e=G.edges[p.connectedEdgeId];if(!e)return null;
      const v=valueOf(e.fromNode,e.fromPort);
      return v==null||v===""?null:v;
    };
    return{node,get,
      all:pre=>node.inputs.filter(p=>p.portId.startsWith(pre)).map(p=>get(p.portId)).filter(v=>v!=null),
      ensureUrl,toast:tst,falVideo,
      log:(k,note,c,a)=>{try{logCost(k,note,c,a);}catch(e){console.warn("logCost:",e.message);}}};
  }
  async function ensureUrl(v){
    if(typeof v!=="string"||!v.startsWith("data:"))return v;
    const key=gs("api_falai","");
    if(!key)throw new Error("Add a fal.ai API key in Settings first");
    const blob=dataUrlToBlob(v);
    const file=new File([blob],`nc_${Date.now()}.${(blob.type.split("/")[1]||"bin").split(/[-;+]/)[0]}`,{type:blob.type});
    return await uploadToFalStorage(file,key);
  }
  async function falVideo(endpoint,body){
    const key=gs("api_falai","");
    const H={"Content-Type":"application/json","Authorization":"Key "+key};
    const res=await fetch(`https://queue.fal.run/${endpoint}`,{method:"POST",headers:H,body:JSON.stringify(body)});
    const sub=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error((sub.detail&&(Array.isArray(sub.detail)?sub.detail[0]&&sub.detail[0].msg:sub.detail))||sub.error||res.statusText);
    const statusUrl=sub.status_url||`https://queue.fal.run/${endpoint}/requests/${sub.request_id}/status`;
    const resultUrl=sub.response_url||`https://queue.fal.run/${endpoint}/requests/${sub.request_id}`;
    let final=null;
    for(let i=0;i<120;i++){ // ~10 min — 1080p/4K clips can be slow
      await new Promise(r=>setTimeout(r,5000));
      const sr=await fetch(statusUrl,{headers:{"Authorization":"Key "+key}});
      const sd=await sr.json().catch(()=>({}));
      if(sd.status==="COMPLETED"){const fr=await fetch(resultUrl,{headers:{"Authorization":"Key "+key}});final=await fr.json();break;}
      if(sd.status==="ERROR"||sd.status==="FAILED")throw new Error(sd.error||"Generation failed");
    }
    if(!final)throw new Error("Timed out waiting for the render");
    const url=final.video&&final.video.url;
    if(!url)throw new Error("No video returned — fal.ai said: "+(typeof formatFalDiag==="function"?formatFalDiag(final):JSON.stringify(final).slice(0,200)));
    return{videoUrl:url};
  }
  const upstreamOf=id=>[...new Set(Object.values(G.edges).filter(e=>e.toNode===id).map(e=>e.fromNode))];
  const needsRun=n=>{const d=def(n.type);return !!d&&!d.noRun&&(n.status!=="done"||!!n._stale);};

  // Which nodes must run for `targets`, grouped in dependency waves.
  // Targets always run; upstream nodes run only if they're not already fresh.
  function planFor(targets){
    const need=new Set();
    const visit=(id,isTarget)=>{
      if(need.has(id))return;const n=G.nodes[id];if(!n)return;
      if(!isTarget&&!needsRun(n))return;
      need.add(id);upstreamOf(id).forEach(u=>visit(u,false));
    };
    targets.forEach(t=>visit(t,true));
    const level={};
    const lv=id=>{
      if(level[id]!==undefined)return level[id];
      level[id]=0;let L=0;
      upstreamOf(id).forEach(u=>{if(need.has(u))L=Math.max(L,lv(u)+1);});
      return level[id]=L;
    };
    need.forEach(lv);
    const waves=[];need.forEach(id=>{(waves[level[id]]=waves[level[id]]||[]).push(id);});
    return waves.filter(Boolean);
  }
  function estimatePlan(waves){
    let total=0,known=true;
    waves.flat().forEach(id=>{
      const n=G.nodes[id],d=n&&def(n.type);if(!d||d.instant)return;
      let e=null;try{e=d.estimate?d.estimate(n):null;}catch(x){}
      if(e==null)known=false;else total+=e;
    });
    return{total,known};
  }
  function setBlocked(n,upId){
    const up=G.nodes[upId],ud=up&&def(up.type);
    n.status="blocked";n.meta.error=`Waiting on “${ud?ud.label:"upstream"}” — fix it first`;
    paint(n.id);
  }
  async function execNode(id){
    const node=G.nodes[id],d=node&&def(node.type);
    if(!d)return false;
    if(node.status==="running"){tst("⏳ Already running","");return false;}
    const pid=projectId,ctx=makeCtx(node);
    node._stale=false;node.meta.error=null;
    if(d.instant){
      let err=null;try{err=d.valid?d.valid(node,ctx):null;}catch(e){err=e.message;}
      node.status=err?"error":"done";node.meta.error=err;
      paint(id);return !err;
    }
    node.status="running";paint(id);renderRunBar();
    let ok=false;
    try{
      await d.run(node,ctx);
      node.status="done";node.meta.createdAt=Date.now();node.meta.error=null;ok=true;
    }catch(err){
      node.status="error";node.meta.error=(err&&err.message)||String(err);
      tst(`❌ ${d.label} failed: ${node.meta.error}`,"error");
    }
    if(projectId!==pid){ // the user switched canvas mid-run — keep what they paid for
      await patchStored(pid,node);return ok;
    }
    if(ok)markDownstreamStale(id);
    scheduleSave();paint(id);renderEdges();syncNodeClasses();renderRunBar();
    return ok;
  }
  async function patchStored(pid,node){
    if(!projects.some(p=>p.id===pid))return;
    try{
      const raw=await idbG(gk(pid));if(!raw)return;
      const g=JSON.parse(raw);
      if(g.nodes&&g.nodes[node.id]){
        const t=g.nodes[node.id];t.data=node.data;t.status=node.status;t.meta=node.meta;t._stale=false;
        await idbS(gk(pid),JSON.stringify(g));
      }
    }catch(e){console.warn("Couldn't store a finished run for another canvas:",e);}
  }
  async function runPlan(waves){
    if(!waves.length)return{ok:0,fail:0,skipped:0};
    const failed=new Set();let ok=0,fail=0,skipped=0;
    runState.active++;runState.cancel=false;renderRunBar();
    try{
      for(const wave of waves){
        if(runState.cancel)break;
        const queue=wave.slice();
        const worker=async()=>{
          while(queue.length&&!runState.cancel){
            const id=queue.shift(),n=G.nodes[id];if(!n)continue;
            const bad=upstreamOf(id).find(u=>failed.has(u));
            if(bad){failed.add(id);setBlocked(n,bad);skipped++;continue;}
            if(await execNode(id))ok++;else{failed.add(id);fail++;}
          }
        };
        await Promise.all(Array.from({length:Math.min(PARALLEL,wave.length)},worker));
      }
    }finally{runState.active=Math.max(0,runState.active-1);renderRunBar();}
    return{ok,fail,skipped};
  }
  function report(r,multi){
    if(runState.cancel){tst("■ Stopped — finished nodes keep their results","");return;}
    if(r.fail||r.skipped)tst(`⚠️ ${r.ok} done · ${r.fail} failed${r.skipped?` · ${r.skipped} waiting on a failure`:""}`,"error");
    else if(multi&&r.ok)tst(`✅ ${r.ok} node${r.ok!==1?"s":""} finished`,"success");
  }
  async function runNode(id){
    if(!G.nodes[id])return;
    const waves=planFor([id]);
    report(await runPlan(waves),waves.flat().length>1);
  }
  async function runAll(){
    const targets=Object.values(G.nodes).filter(needsRun).map(n=>n.id);
    if(!targets.length){tst("✓ Everything is already up to date","");return;}
    report(await runPlan(planFor(targets)),true);
  }
  async function runSelected(){
    const ids=G.selection.nodeIds.filter(id=>G.nodes[id]&&!def(G.nodes[id].type).noRun);
    if(!ids.length){tst("Select a node first","");return;}
    report(await runPlan(planFor(ids)),true);
  }
  async function runGraphFrom(id){ // this node + everything downstream
    if(!G.nodes[id])return;
    const seen=new Set([id]),st=[id];
    while(st.length){const c=st.pop();Object.values(G.edges).forEach(e=>{if(e.fromNode===c&&!seen.has(e.toNode)){seen.add(e.toNode);st.push(e.toNode);}});}
    seen.forEach(x=>{const n=G.nodes[x];if(n&&x!==id&&n.status==="done"&&!isInstant(n))n._stale=true;});
    report(await runPlan(planFor([...seen])),true);
  }
  function stopRun(){if(runState.active){runState.cancel=true;tst("■ Stopping after the current nodes…","");renderRunBar();}}

  // ═════════════ 3. PERSISTENCE ═════════════
  function sanitize(raw){
    const g=blank(),dropped=[];
    const v=raw&&raw.viewport;
    if(v&&Number.isFinite(+v.x)&&Number.isFinite(+v.y)&&+v.zoom>0)g.viewport={x:+v.x,y:+v.y,zoom:Math.min(MAX_Z,Math.max(MIN_Z,+v.zoom))};
    Object.values((raw&&raw.nodes)||{}).forEach(rn=>{
      const d=rn&&def(rn.type);
      if(!d){if(rn)dropped.push(rn.type);return;}
      const n=mkNode(rn.type,rn.position,null);
      if(typeof rn.id==="string"&&/^[\w-]+$/.test(rn.id)&&!g.nodes[rn.id])n.id=rn.id;
      n.data=Object.assign(d.defaults(),isObj(rn.data)?rn.data:{});
      n.status=rn.status==="done"||rn.status==="error"?rn.status:"idle"; // running/queued/blocked can't survive a reload
      n.meta=Object.assign(n.meta,isObj(rn.meta)?rn.meta:{});
      n.meta.error=n.status==="error"?(n.meta.error||"Failed"):null;
      n._stale=!!rn._stale;
      g.nodes[n.id]=n;
    });
    Object.values((raw&&raw.edges)||{}).forEach(re=>{
      if(!re)return;
      const c=checkEdge(g,re.fromNode,re.fromPort,re.toNode,re.toPort);
      if(c.err||c.ip.connectedEdgeId)return; // bad / duplicate / looping edges are dropped
      const id=typeof re.id==="string"&&/^[\w-]+$/.test(re.id)&&!g.edges[re.id]?re.id:uid("edge");
      g.edges[id]={id,fromNode:re.fromNode,fromPort:re.fromPort,toNode:re.toNode,toPort:re.toPort};
      c.ip.connectedEdgeId=id;
    });
    return{graph:g,dropped};
  }
  function serialize(forCloud){
    const nodes={};
    Object.values(G.nodes).forEach(n=>{nodes[n.id]=n;});
    // Firestore docs are capped at 1MB: never ship base64 blobs to the cloud copy.
    const rep=forCloud?(k,v)=>typeof v==="string"&&v.startsWith("data:")&&v.length>1500?null:v:undefined;
    return JSON.stringify({v:SCHEMA,nodes,edges:G.edges,viewport:G.viewport},rep);
  }
  function thumbOf(){
    const ns=Object.values(G.nodes).slice(0,40);if(!ns.length)return[];
    const x0=Math.min(...ns.map(n=>n.position.x)),y0=Math.min(...ns.map(n=>n.position.y));
    const x1=Math.max(...ns.map(n=>n.position.x+n.size.w)),y1=Math.max(...ns.map(n=>n.position.y+n.size.h));
    const sc=Math.min(92/Math.max(1,x1-x0),48/Math.max(1,y1-y0));
    return ns.map(n=>[+((n.position.x-x0)*sc+4).toFixed(1),+((n.position.y-y0)*sc+4).toFixed(1),+Math.max(3,n.size.w*sc).toFixed(1),+Math.max(3,n.size.h*sc).toFixed(1),(def(n.type)||{}).color||"#888"]);
  }
  const curProj=()=>projects.find(p=>p.id===projectId);
  function persistList(){
    const s=Sx();s.nodeCanvasProjects=projects;
    return idbS(K_PROJ,projects);
  }
  function scheduleSave(){
    dirty=true;clearTimeout(saveTimer);
    saveTimer=setTimeout(flushSave,350);
  }
  async function flushSave(){
    clearTimeout(saveTimer);
    if(!dirty||!projectId)return;
    dirty=false;
    const id=projectId,p=curProj();
    await idbS(gk(id),serialize(false));
    if(p){p.updated=Date.now();p.nodes=Object.keys(G.nodes).length;p.thumb=thumbOf();await persistList();}
    cloudPayload={id,json:serialize(true)};
    clearTimeout(cloudTimer);cloudTimer=setTimeout(saveCloud,1800);
    renderHeader();
  }
  async function saveCloud(){
    const c=cloudPayload;if(!c)return;cloudPayload=null;
    try{if(typeof fbDB!=="undefined")await fbDB.collection("public").doc("nodeCanvas_"+c.id).set({graph:c.json,updatedAt:Date.now()});}
    catch(err){console.warn("Canvas cloud save failed — kept on this device:",err.message);}
  }
  async function loadList(){
    let list=await idbG(K_PROJ);
    if(!Array.isArray(list)){ // one-time legacy fallback (older builds used localStorage)
      try{list=JSON.parse(lsGet(K_PROJ)||"[]");}catch(e){list=[];}
    }
    projects=list.filter(p=>p&&p.id).map(p=>({id:p.id,name:p.name||"Untitled Canvas",created:p.created||0,updated:p.updated||0,nodes:p.nodes,thumb:p.thumb}));
    if(!projects.length)projects=[{id:uid("ncproj"),name:"Untitled Canvas",created:Date.now(),updated:Date.now(),nodes:0,thumb:[]}];
    const r=await idbG(K_RECENT);recent=Array.isArray(r)?r.filter(id=>projects.some(p=>p.id===id)):[];
    persistList();
  }
  async function readStored(id){
    let raw=await idbG(gk(id));
    if(!raw)raw=lsGet(gk(id));
    if(!raw&&typeof fbDB!=="undefined"){
      try{const doc=await fbDB.collection("public").doc("nodeCanvas_"+id).get();if(doc.exists&&doc.data().graph)raw=doc.data().graph;}catch(e){}
    }
    return raw||null;
  }
  async function openProject(id){
    const seq=++openSeq;
    await flushSave();
    if(seq!==openSeq||!projects.some(p=>p.id===id))return;
    projectId=id;
    idbS(K_LAST,id);
    recent=[id,...recent.filter(x=>x!==id)].slice(0,12);idbS(K_RECENT,recent);
    const raw=await readStored(id);
    if(seq!==openSeq)return;
    let g=blank(),fresh=true;
    if(raw){
      try{
        const r=sanitize(JSON.parse(raw));g=r.graph;fresh=false;
        if(r.dropped.length)tst(`ℹ️ ${r.dropped.length} unknown node(s) were removed from this canvas`,"");
      }catch(e){
        console.error("Canvas unreadable:",e);idbS(gk(id)+"_corrupt",raw);
        tst("⚠️ This canvas couldn't be read — opened blank (a backup copy was kept)","error");
      }
    }
    G=g;undoStack=[];redoStack=[];pending=null;moveId=null;
    refreshInstant();
    if(rootEl){renderAll();if(!fresh&&Object.keys(G.nodes).length&&G.viewport.x===0&&G.viewport.y===0&&G.viewport.zoom===1)fitToScreen();}
    renderHeader();refreshHistoryBtns();closeSheet();
  }
  function graphFromTemplate(tpl){
    const g=blank(),ids=[];
    (tpl.nodes||[]).forEach(([type,x,y,data])=>{if(!def(type))return;const n=mkNode(type,{x,y},data);g.nodes[n.id]=n;ids.push(n.id);});
    (tpl.edges||[]).forEach(([a,ap,b,bp])=>{
      const c=checkEdge(g,ids[a],ap,ids[b],bp);if(c.err||c.ip.connectedEdgeId)return;
      const id=uid("edge");g.edges[id]={id,fromNode:ids[a],fromPort:ap,toNode:ids[b],toPort:bp};c.ip.connectedEdgeId=id;
    });
    return g;
  }
  async function createProject(name,tplId){
    await flushSave();
    const tpl=REG.templates.find(t=>t.id===tplId)||REG.templates[0];
    const p={id:uid("ncproj"),name:(name||"").trim()||"Untitled Canvas",created:Date.now(),updated:Date.now(),nodes:tpl.nodes.length,thumb:[]};
    projects.unshift(p);
    const saved=G;G=graphFromTemplate(tpl);p.thumb=thumbOf();
    await idbS(gk(p.id),serialize(false));
    G=saved;await persistList();
    await openProject(p.id);
    if(Object.keys(G.nodes).length)fitToScreen();
    tst(`✅ “${p.name}” created`,"success");
  }
  async function renameProject(id){
    const p=projects.find(x=>x.id===id);if(!p)return;
    const v=await showPromptDialog("",p.name,{title:"Rename canvas",okLabel:"Save"});
    if(v==null||!v.trim())return;
    p.name=v.trim();await persistList();renderHeader();if(sheetOpen()==="list")openCanvases();
  }
  async function duplicateProject(id){
    await flushSave();
    const p=projects.find(x=>x.id===id);if(!p)return;
    const raw=await readStored(id);
    const np={...p,id:uid("ncproj"),name:p.name+" copy",created:Date.now(),updated:Date.now()};
    projects.unshift(np);
    if(raw)await idbS(gk(np.id),raw);
    await persistList();tst(`⧉ Duplicated as “${np.name}”`,"success");
    if(sheetOpen()==="list")openCanvases();
  }
  async function deleteProject(id){
    const p=projects.find(x=>x.id===id);if(!p)return;
    const ok=await showConfirmDialog(`“${esc(p.name)}” and everything on it will be removed. You can undo for a few seconds afterwards.`,{title:"Delete this canvas?",okLabel:"Delete",danger:true});
    if(!ok)return;
    if(id===projectId){dirty=true;await flushSave();}
    const raw=await readStored(id);
    const idx=projects.findIndex(x=>x.id===id);
    projects.splice(idx,1);
    recent=recent.filter(x=>x!==id);idbS(K_RECENT,recent);
    await idbD(gk(id));
    try{if(typeof fbDB!=="undefined")await fbDB.collection("public").doc("nodeCanvas_"+id).delete();}catch(e){}
    lastDeleted={p,raw,idx,wasCurrent:id===projectId};
    if(!projects.length)projects=[{id:uid("ncproj"),name:"Untitled Canvas",created:Date.now(),updated:Date.now(),nodes:0,thumb:[]}];
    await persistList();
    if(id===projectId){
      const next=recent.find(x=>projects.some(q=>q.id===x))||projects[0].id;
      projectId=null;G=blank();
      await openProject(next);
    }else renderHeader();
    snack(`Deleted “${p.name}”`,"Undo",undoDelete);
    if(sheetOpen()==="list")openCanvases();
  }
  async function undoDelete(){
    const d=lastDeleted;if(!d)return;lastDeleted=null;
    if(!projects.some(x=>x.id===d.p.id))projects.splice(Math.min(d.idx,projects.length),0,d.p);
    if(d.raw)await idbS(gk(d.p.id),d.raw);
    await persistList();
    if(d.wasCurrent)await openProject(d.p.id);else renderHeader();
    hideSnack();tst(`↩ “${d.p.name}” restored`,"success");
    if(sheetOpen()==="list")openCanvases();
  }
  const deleteCurrent=()=>deleteProject(projectId);
  function goPrevious(){
    const id=recent.find(x=>x!==projectId&&projects.some(p=>p.id===x));
    if(!id){tst("No previous canvas yet — open another one first","");return;}
    openProject(id);
  }

  // ═════════════ 4. RENDERING ═════════════
  function renderAll(){
    if(!rootEl||!nodesLayerEl)return;
    try{
      applyTransform();renderNodes();renderEdges();renderMinimap();renderRunBar();renderSelBar();renderBanner();
    }catch(err){
      console.error("Node Canvas render error:",err);
      tst(`❌ Canvas render error: ${err.message}`,"error");
    }
  }
  function renderNodes(){
    const parts=[];
    Object.values(G.nodes).forEach(n=>{
      try{parts.push(nodeHTML(n));}
      catch(err){console.error(`Node Canvas: node ${n.id} (${n.type}) failed to render:`,err);parts.push(brokenNodeHTML(n,err));}
    });
    nodesLayerEl.innerHTML=parts.join("");
    measureNodes();
  }
  function measureNodes(){
    nodesLayerEl.querySelectorAll(".nc-node").forEach(el=>{
      const n=G.nodes[el.getAttribute("data-node-id")];
      if(n&&el.offsetHeight)n.size.h=el.offsetHeight;
    });
  }
  function paint(id){ // re-render one node (status change, result arrived…)
    if(!nodesLayerEl||!nodesLayerEl.isConnected||!G.nodes[id])return;
    renderNodeOnly(id);
  }
  function renderNodeOnly(id){
    if(!nodesLayerEl||!G.nodes[id])return;
    let html;try{html=nodeHTML(G.nodes[id]);}catch(err){html=brokenNodeHTML(G.nodes[id],err);}
    const ex=nodesLayerEl.querySelector(`[data-node-id="${id}"]`);
    if(ex)ex.outerHTML=html;else nodesLayerEl.insertAdjacentHTML("beforeend",html);
    const el=nodesLayerEl.querySelector(`[data-node-id="${id}"]`);
    if(el&&el.offsetHeight)G.nodes[id].size.h=el.offsetHeight;
    renderEdges();
  }
  function syncNodeClasses(){
    if(!nodesLayerEl)return;
    const sel=new Set(G.selection.nodeIds);
    nodesLayerEl.querySelectorAll(".nc-node").forEach(el=>{
      const n=G.nodes[el.getAttribute("data-node-id")];if(!n)return;
      el.classList.toggle("nc-stale",!!n._stale);
      el.classList.toggle("nc-selected",sel.has(n.id));
      el.classList.toggle("nc-moving",n.id===moveId);
      el.setAttribute("data-status",n.status);
    });
  }
  function neighborColors(id){
    const s=new Set();
    Object.values(G.edges).forEach(e=>{
      const o=e.fromNode===id?e.toNode:e.toNode===id?e.fromNode:null;
      const n=o&&G.nodes[o];if(n&&def(n.type))s.add(colorOk(def(n.type).color));
    });
    return[...s];
  }
  function connectionsHTML(node){
    const chips=node.inputs.filter(p=>p.connectedEdgeId&&G.edges[p.connectedEdgeId]).map(p=>{
      const e=G.edges[p.connectedEdgeId],src=G.nodes[e.fromNode],sd=src&&def(src.type);
      if(!sd)return"";
      const op=src.outputs.length>1?` · ${esc((src.outputs.find(o=>o.portId===e.fromPort)||{}).label||"")}`:"";
      return`<span class="nc-conn" title="Tap ✕ to disconnect"><b>${esc(p.label)}</b> ← ${esc(sd.label)}${op}<i onclick="NodeCanvas.deleteEdge('${e.id}')">✕</i></span>`;
    }).join("");
    return chips?`<div class="nc-conns">${chips}</div>`:"";
  }
  function nodeHTML(node){
    if(!node)return"";
    const d=def(node.type);
    if(!d)return brokenNodeHTML(node,new Error("Unknown node type"));
    const icon={queued:"⏳",running:"⏳",done:d.noRun||d.instant?"":"✅",error:"❌",blocked:"⛔"}[node.status]||"";
    const nb=neighborColors(node.id).filter(c=>c!==colorOk(d.color));
    const style=`left:${node.position.x}px;top:${node.position.y}px;width:${node.size.w}px;--nc-color:${colorOk(d.color)};--nc-color2:${nb[0]||colorOk(d.color)}`;
    let body;try{body=d.body(node,REG.H);}catch(err){console.error("node body:",err);body=`<div class="nc-err">⚠ Couldn't draw this node: ${esc(err.message)}</div>`;}
    const res=d.result?d.result(node):null;
    const sel=G.selection.nodeIds.includes(node.id);
    const cost=node.meta.cost?money(node.meta.cost):"";
    const running=node.status==="running";
    return`<div class="nc-node${node._stale?" nc-stale":""}${sel?" nc-selected":""}${node.id===moveId?" nc-moving":""}" data-node-id="${node.id}" data-type="${node.type}" data-status="${node.status}" style="${style}">
      <div class="nc-node-tab" onpointerdown="NodeCanvas._onNodeDragStart(event,'${node.id}')">${esc(d.icon||"")} ${esc(d.label)} ${icon}${node.id===moveId?" 📍":""}</div>
      <div class="nc-node-body" onpointerdown="NodeCanvas._onNodeBodyPointerDown(event,'${node.id}')">
        ${body}
        ${connectionsHTML(node)}
        ${node.meta.error?`<div class="nc-err">${esc(node.meta.error)}</div>`:""}
        ${res?`<div class="nc-res"><button onclick="NodeCanvas.downloadResult('${node.id}')" title="Download">⬇</button><button onclick="NodeCanvas.saveResult('${node.id}')" title="Save to Gallery">💾 Save</button><button onclick="NodeCanvas.openResult('${node.id}')" title="Open full size">⛶</button></div>`:""}
        ${d.noRun?"":`<div class="nc-node-meta"><span>${cost}${node._stale?" · outdated":""}</span><button class="nc-run-btn" ${running?"disabled":""} onclick="NodeCanvas.runNode('${node.id}')">${running?"⏳ Running…":"▶ Run"}</button></div>`}
      </div>
      ${d.inputPorts.length?`<div class="nc-port nc-port-in" data-node="${node.id}" data-dir="in" title="Inputs" onclick="NodeCanvas._onPortTap(event,'${node.id}','in')">+</div>`:""}
      ${d.outputPorts.length?`<div class="nc-port nc-port-out" data-node="${node.id}" data-dir="out" title="Outputs" onclick="NodeCanvas._onPortTap(event,'${node.id}','out')">+</div>`:""}
    </div>`;
  }
  function brokenNodeHTML(node,err){
    return`<div class="nc-node" data-node-id="${esc(node.id)}" data-status="error" style="left:${num(node.position&&node.position.x,0)}px;top:${num(node.position&&node.position.y,0)}px;width:220px;--nc-color:#EF4444;--nc-color2:#EF4444">
      <div class="nc-node-tab">⚠ ${esc(node.type)}</div>
      <div class="nc-node-body"><div class="nc-err">This node couldn't be drawn: ${esc(err&&err.message)}</div>
      <div class="nc-node-meta"><span></span><button class="nc-run-btn" onclick="NodeCanvas.deleteNode('${esc(node.id)}')">🗑 Delete</button></div></div></div>`;
  }
  // ── wires ──
  function portPos(nodeId,portId,dir){
    const node=G.nodes[nodeId];if(!node)return null;
    const el=nodesLayerEl.querySelector(`.nc-port[data-node="${nodeId}"][data-dir="${dir}"]`);
    let bx,by;
    if(!el||!el.getBoundingClientRect().width){bx=node.position.x+(dir==="out"?node.size.w:0);by=node.position.y+40;}
    else{
      const pr=el.getBoundingClientRect(),lr=layerEl.getBoundingClientRect(),z=G.viewport.zoom||1;
      bx=(pr.left+pr.width/2-lr.left)/z;by=(pr.top+pr.height/2-lr.top)/z;
    }
    // Fan out only the ports that actually carry a wire, so a 16-slot node
    // doesn't spread its wires over 200px.
    const used=dir==="out"
      ?[...new Set(Object.values(G.edges).filter(e=>e.fromNode===nodeId).map(e=>e.fromPort))]
      :node.inputs.filter(p=>p.connectedEdgeId).map(p=>p.portId);
    const list=(dir==="out"?node.outputs:node.inputs).map(p=>p.portId).filter(id=>used.includes(id));
    const i=list.indexOf(portId);
    return{x:bx,y:by+(list.length>1&&i>=0?(i-(list.length-1)/2)*13:0)};
  }
  function edgeD(e){
    const a=portPos(e.fromNode,e.fromPort,"out"),b=portPos(e.toNode,e.toPort,"in");
    if(!a||!b)return null;
    const dx=Math.max(40,Math.abs(b.x-a.x)*0.5);
    return`M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`;
  }
  function renderEdges(){
    if(!edgeSvgEl)return;
    const NS="http://www.w3.org/2000/svg";
    edgeSvgEl.innerHTML="";
    const defs=document.createElementNS(NS,"defs");edgeSvgEl.appendChild(defs);
    Object.values(G.edges).forEach(e=>{
      const d=edgeD(e);if(!d)return;
      const fn=G.nodes[e.fromNode],tn=G.nodes[e.toNode];
      const gid="nc-edge-grad-"+e.id,grad=document.createElementNS(NS,"linearGradient");
      grad.setAttribute("id",gid);grad.setAttribute("gradientUnits","userSpaceOnUse");
      const a=portPos(e.fromNode,e.fromPort,"out"),b=portPos(e.toNode,e.toPort,"in");
      if(a&&b){grad.setAttribute("x1",a.x);grad.setAttribute("y1",a.y);grad.setAttribute("x2",b.x);grad.setAttribute("y2",b.y);}
      [["0%",fn],["100%",tn]].forEach(([o,n])=>{const s=document.createElementNS(NS,"stop");s.setAttribute("offset",o);s.setAttribute("stop-color",colorOk((n&&def(n.type)||{}).color||"#6FE3FF"));grad.appendChild(s);});
      defs.appendChild(grad);
      const sel=G.selection.edgeIds.includes(e.id);
      const vis=document.createElementNS(NS,"path");
      vis.setAttribute("data-edge-id",e.id);vis.setAttribute("data-kind","vis");vis.setAttribute("d",d);
      vis.setAttribute("class","nc-edge-path"+(sel?" nc-edge-sel":""));vis.setAttribute("stroke",`url(#${gid})`);
      const hit=document.createElementNS(NS,"path");
      hit.setAttribute("data-edge-id",e.id);hit.setAttribute("data-kind","hit");hit.setAttribute("d",d);hit.setAttribute("class","nc-edge-hit");
      edgeSvgEl.appendChild(vis);edgeSvgEl.appendChild(hit);
    });
  }
  function updateEdgesInPlace(){
    Object.values(G.edges).forEach(e=>{
      const d=edgeD(e);if(!d)return;
      edgeSvgEl.querySelectorAll(`path[data-edge-id="${e.id}"]`).forEach(p=>p.setAttribute("d",d));
    });
  }
  function renderMinimap(){
    if(!minimapEl)return;
    const ns=Object.values(G.nodes);
    if(!ns.length){minimapEl.innerHTML="";return;}
    const x0=Math.min(...ns.map(n=>n.position.x))-40,y0=Math.min(...ns.map(n=>n.position.y))-40;
    const x1=Math.max(...ns.map(n=>n.position.x+n.size.w))+40,y1=Math.max(...ns.map(n=>n.position.y+n.size.h))+40;
    const sc=Math.min(120/Math.max(1,x1-x0),80/Math.max(1,y1-y0));
    let html=ns.map(n=>`<div class="nc-minimap-node" style="left:${(n.position.x-x0)*sc}px;top:${(n.position.y-y0)*sc}px;width:${Math.max(3,n.size.w*sc)}px;height:${Math.max(3,n.size.h*sc)}px;background:${colorOk((def(n.type)||{}).color)}"></div>`).join("");
    const r=viewportEl?viewportEl.getBoundingClientRect():null,z=G.viewport.zoom||1;
    if(r&&r.width){
      html+=`<div class="nc-minimap-viewport" style="left:${(-G.viewport.x/z-x0)*sc}px;top:${(-G.viewport.y/z-y0)*sc}px;width:${r.width/z*sc}px;height:${r.height/z*sc}px"></div>`;
    }
    minimapEl.innerHTML=html;
    minimapEl._map={x0,y0,sc};
  }
  function minimapTap(e){
    const m=minimapEl&&minimapEl._map;if(!m)return;
    const r=minimapEl.getBoundingClientRect(),z=G.viewport.zoom||1,vr=viewportEl.getBoundingClientRect();
    const cx=(e.clientX-r.left)/m.sc+m.x0,cy=(e.clientY-r.top)/m.sc+m.y0;
    G.viewport.x=vr.width/2-cx*z;G.viewport.y=vr.height/2-cy*z;
    applyTransform();renderMinimap();scheduleSave();
  }
  function renderRunBar(){
    const el=rootEl&&$(".nc2-runbar");if(!el)return;
    const targets=Object.values(G.nodes).filter(needsRun).filter(n=>!isInstant(n)).map(n=>n.id);
    const est=estimatePlan(planFor(targets));
    const spent=Object.values(G.nodes).reduce((s,n)=>s+(n.meta.cost||0),0);
    const run=runState.active
      ?`<button class="nc2-stop" onclick="NodeCanvas.stopRun()">■ Stop</button>`
      :targets.length
        ?`<button class="nc2-run" onclick="NodeCanvas.runAll()">▶ Run all <small>${targets.length}${est.total?` · ${est.known?"≈":"≥"}${money(est.total)}`:""}</small></button>`
        :`<span class="nc2-ok">✓ Up to date</span>`;
    el.innerHTML=run+`<span class="nc2-cost" title="Cost of the last run of each node">${spent?"Spent ~"+money(spent):"No spend yet"}</span>`;
  }
  function renderSelBar(){
    if(!rootEl)return;
    let bar=$(".nc2-selbar");
    const ids=G.selection.nodeIds.filter(id=>G.nodes[id]),eds=G.selection.edgeIds.filter(id=>G.edges[id]);
    if((pending||moveId)||(!ids.length&&!eds.length)){if(bar)bar.remove();return;}
    if(!bar){bar=document.createElement("div");bar.className="nc2-float nc2-selbar";rootEl.appendChild(bar);}
    if(eds.length){
      const e=G.edges[eds[0]],f=G.nodes[e.fromNode],t=G.nodes[e.toNode];
      bar.innerHTML=`<span>${esc(f?def(f.type).label:"?")} → ${esc(t?def(t.type).label:"?")}</span><button class="nc2-dng" onclick="NodeCanvas.deleteEdge('${e.id}')">✂ Disconnect</button><button onclick="NodeCanvas.clearSelection()">✕</button>`;
    }else{
      const n=G.nodes[ids[0]],d=def(n.type);
      const linked=Object.values(G.edges).some(e=>e.fromNode===n.id||e.toNode===n.id);
      bar.innerHTML=`<span>${esc(d.icon||"")} ${esc(d.label)}${ids.length>1?` +${ids.length-1}`:""}</span>`+
        (d.noRun?"":`<button onclick="NodeCanvas.runSelected()">▶ Run</button>`)+
        `<button onclick="NodeCanvas.duplicateNode('${n.id}')">⧉</button>`+
        (linked?`<button onclick="NodeCanvas.disconnectNode('${n.id}')">✂ Unlink</button>`:"")+
        `<button class="nc2-dng" onclick="NodeCanvas.deleteNodes(NodeCanvas.selectedIds())">🗑</button><button onclick="NodeCanvas.clearSelection()">✕</button>`;
    }
  }
  function renderBanner(){
    if(!rootEl)return;
    let b=$(".nc2-banner");
    let html="";
    if(moveId)html=`<span>📍 Tap the canvas to place this node</span><button onclick="NodeCanvas.freezeMove()">❄️ Done</button>`;
    else if(pending)html=`<span>${pending.dir==="out"?`Connecting <b>${esc(pending.label||pending.type)}</b> — tap a highlighted node's +`:"Tap the node whose output you want to use"}</span><button onclick="NodeCanvas.cancelPending()">Cancel</button>`;
    if(!html){if(b)b.remove();return;}
    if(!b){b=document.createElement("div");b.className="nc2-float nc2-banner";rootEl.appendChild(b);}
    b.innerHTML=html;
    renderSelBar();
  }
  function refreshHistoryBtns(){
    if(!rootEl)return;
    const u=$("#ncUndo"),r=$("#ncRedo");
    if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length;
  }
  function renderHeader(){
    const nm=document.getElementById("ncName"),mt=document.getElementById("ncMeta"),pv=document.getElementById("ncBtnPrev");
    const p=curProj();
    if(nm)nm.textContent=p?p.name:"…";
    if(mt)mt.textContent=p?`${Object.keys(G.nodes).length} node${Object.keys(G.nodes).length!==1?"s":""}`:"";
    if(pv)pv.disabled=!recent.some(x=>x!==projectId&&projects.some(q=>q.id===x));
  }

  // ═════════════ INTERACTION ═════════════
  function applyTransform(){if(layerEl)layerEl.style.transform=`translate(${G.viewport.x}px,${G.viewport.y}px) scale(${G.viewport.zoom})`;}
  function screenToCanvas(x,y){
    const r=viewportEl.getBoundingClientRect(),z=G.viewport.zoom||1;
    return{x:(x-r.left-G.viewport.x)/z,y:(y-r.top-G.viewport.y)/z};
  }
  function clearSelection(){G.selection={nodeIds:[],edgeIds:[]};syncNodeClasses();renderEdges();renderSelBar();}
  function selectNode(id){G.selection={nodeIds:[id],edgeIds:[]};syncNodeClasses();renderEdges();renderSelBar();}
  function selectEdge(id){G.selection={nodeIds:[],edgeIds:[id]};syncNodeClasses();renderEdges();renderSelBar();}
  const selectedIds=()=>G.selection.nodeIds.slice();

  function onCanvasPointerDown(e){
    if(e.target!==viewportEl&&e.target!==layerEl)return;
    viewportEl.classList.add("nc-panning");panMoved=false;
    drag={pointerId:e.pointerId,sx:e.clientX,sy:e.clientY,vx:G.viewport.x,vy:G.viewport.y};
  }
  function onPointerMove(e){
    if(!drag||drag.pointerId!==e.pointerId||pinch)return;
    const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
    if(Math.hypot(dx,dy)>5)panMoved=true;
    G.viewport.x=drag.vx+dx;G.viewport.y=drag.vy+dy;applyTransform();
  }
  function onPointerUp(e){
    if(drag&&drag.pointerId===e.pointerId){
      viewportEl&&viewportEl.classList.remove("nc-panning");
      if(panMoved){scheduleSave();renderMinimap();}
      drag=null;
    }
  }
  function onCanvasClick(e){
    if(e.target!==viewportEl&&e.target!==layerEl)return;
    if(panMoved){panMoved=false;return;}
    if(moveId){
      const n=G.nodes[moveId];if(!n)return;
      const p=screenToCanvas(e.clientX,e.clientY);
      n.position.x=p.x-n.size.w/2;n.position.y=p.y-20;
      scheduleSave();renderNodeOnly(moveId);renderMinimap();return;
    }
    if(pending){cancelPending();return;}
    if(G.selection.nodeIds.length||G.selection.edgeIds.length)clearSelection();
  }
  // Long-press a node's title → move mode (tap the canvas to place it).
  // A short tap on the title selects the node.
  function onNodeDragStart(e,id){
    e.stopPropagation();
    const sx=e.clientX,sy=e.clientY;let moved=false,fired=false;
    clearTimeout(longPress);
    const cleanup=()=>{clearTimeout(longPress);document.removeEventListener("pointerup",up);document.removeEventListener("pointermove",mv);document.removeEventListener("pointercancel",cancel);};
    const up=()=>{cleanup();if(!fired&&!moved)selectNode(id);};
    const cancel=()=>cleanup();
    const mv=ev=>{if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10){moved=true;clearTimeout(longPress);}};
    longPress=setTimeout(()=>{fired=true;cleanup();enterMoveMode(id);},380);
    document.addEventListener("pointerup",up);document.addEventListener("pointermove",mv);document.addEventListener("pointercancel",cancel);
  }
  function enterMoveMode(id){
    if(!G.nodes[id])return;
    checkpoint();moveId=id;G.selection={nodeIds:[id],edgeIds:[]};
    tst("📍 Move mode — tap anywhere on the canvas to place this node","");
    syncNodeClasses();renderBanner();
  }
  function freezeMove(){
    if(!moveId)return;
    moveId=null;scheduleSave();syncNodeClasses();renderBanner();renderEdges();renderMinimap();
    tst("❄️ Position locked","success");
  }
  function onNodeBodyPointerDown(e,id){
    const t=e.target,tag=t.tagName;
    if(["BUTTON","SELECT","TEXTAREA","INPUT","VIDEO","AUDIO","OPTION"].includes(tag)||(t.classList&&(t.classList.contains("nc-port")||t.closest&&t.closest(".nc-conn,.nc-res"))))return;
    clearTimeout(longPress);
    const sx=e.clientX,sy=e.clientY;let moved=false,fired=false;
    const cleanup=()=>{clearTimeout(longPress);document.removeEventListener("pointerup",up);document.removeEventListener("pointermove",mv);document.removeEventListener("pointercancel",cleanup);};
    const up=()=>{cleanup();if(!fired&&!moved)selectNode(id);};
    const mv=ev=>{if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){moved=true;clearTimeout(longPress);}};
    longPress=setTimeout(()=>{fired=true;cleanup();showContextMenu(id,sx,sy);},480);
    document.addEventListener("pointerup",up);document.addEventListener("pointermove",mv);document.addEventListener("pointercancel",cleanup);
  }
  function closeMenus(){document.querySelectorAll(".nc-context-menu").forEach(m=>m.remove());}
  function popMenu(html,x,y){
    closeMenus();
    const m=document.createElement("div");m.className="nc-context-menu";
    m.style.left=Math.max(8,Math.min(x,window.innerWidth-170))+"px";m.style.top=Math.max(8,Math.min(y,window.innerHeight-210))+"px";
    m.innerHTML=html;document.body.appendChild(m);
    setTimeout(()=>document.addEventListener("pointerdown",function close(ev){if(!m.contains(ev.target)){m.remove();document.removeEventListener("pointerdown",close);}}),50);
    return m;
  }
  function showContextMenu(id,x,y){
    const n=G.nodes[id];if(!n)return;
    const d=def(n.type),res=d.result&&d.result(n);
    const linked=Object.values(G.edges).some(e=>e.fromNode===id||e.toNode===id);
    popMenu((d.noRun?"":`<button data-a="run">▶ Run</button>`)+`<button data-a="dup">⧉ Duplicate</button>`+
      (linked?`<button data-a="unlink">✂ Disconnect all</button>`:"")+(res?`<button data-a="save">💾 Save to Gallery</button>`:"")+
      `<button class="nc-danger" data-a="del">🗑 Delete</button>`,x,y).addEventListener("click",ev=>{
      const a=ev.target.getAttribute&&ev.target.getAttribute("data-a");if(!a)return;closeMenus();
      ({run:()=>runNode(id),dup:()=>duplicateNode(id),unlink:()=>disconnectNode(id),save:()=>saveResult(id),del:()=>deleteNodes([id])})[a]();
    });
  }

  // ── connecting (tap + on an output, then + on a target) ──
  function openInputFor(node,type){ // free compatible slot, else the only compatible slot (replace)
    const comp=node.inputs.filter(p=>p.accepts.includes(type));
    return comp.find(p=>!p.connectedEdgeId)||(comp.length===1?comp[0]:null);
  }
  function canAccept(targetId,srcId,type){
    const t=G.nodes[targetId];if(!t||targetId===srcId||reaches(G,targetId,srcId))return false;
    return !!openInputFor(t,type);
  }
  function markTargets(){
    if(!nodesLayerEl)return;
    nodesLayerEl.querySelectorAll(".nc-node").forEach(el=>{
      el.classList.remove("nc-can","nc-cant");
      if(!pending)return;
      const id=el.getAttribute("data-node-id");if(id===pending.nodeId){return;}
      let ok=false;
      if(pending.dir==="out")ok=canAccept(id,pending.nodeId,pending.type);
      else{const n=G.nodes[id],tgt=G.nodes[pending.nodeId];ok=!!n&&!!tgt&&n.outputs.some(o=>canAccept(pending.nodeId,id,o.type));}
      el.classList.add(ok?"nc-can":"nc-cant");
    });
  }
  function cancelPending(){
    pending=null;document.querySelectorAll(".nc-port-active").forEach(p=>p.classList.remove("nc-port-active"));
    markTargets();renderBanner();
  }
  function connectPair(outNode,outPort,inNode){
    const on=G.nodes[outNode],op=on&&on.outputs.find(p=>p.portId===outPort),tn=G.nodes[inNode];
    if(!op||!tn)return;
    const ip=openInputFor(tn,op.type);
    cancelPending();
    if(!ip){
      const any=tn.inputs.some(p=>p.accepts.includes(op.type));
      tst(any?`❌ Every ${op.type} slot on ${def(tn.type).label} is full — tap a ✕ chip on it to free one`:`❌ ${def(tn.type).label} has no ${op.type} input`,"error");
      return;
    }
    addEdge(outNode,outPort,inNode,ip.portId);
  }
  function pickOutputPort(nodeId,portId){
    closeMenus();
    const n=G.nodes[nodeId],p=n&&n.outputs.find(x=>x.portId===portId);if(!p)return;
    if(pending&&pending.dir==="in"){connectPair(nodeId,portId,pending.nodeId);return;}
    pending={dir:"out",nodeId,portId,type:p.type,label:p.label};
    document.querySelectorAll(`.nc-port-out[data-node="${nodeId}"]`).forEach(x=>x.classList.add("nc-port-active"));
    markTargets();renderBanner();
  }
  function outputPicker(nodeId,anchor){
    const n=G.nodes[nodeId],r=anchor.getBoundingClientRect();
    popMenu(`<div style="padding:6px 10px;font-size:10px;color:var(--textm);font-weight:700">Use output:</div>`+
      n.outputs.map(p=>`<button data-p="${p.portId}">${esc(p.label)} <small style="opacity:.6">${esc(p.type)}</small></button>`).join(""),r.right+8,r.top-20)
      .addEventListener("click",ev=>{const p=ev.target.getAttribute&&ev.target.getAttribute("data-p");if(p)pickOutputPort(nodeId,p);});
  }
  function onPortTap(e,nodeId,dir){
    e.stopPropagation();
    const node=G.nodes[nodeId];if(!node)return;
    if(!pending){
      if(dir==="out"){
        if(node.outputs.length>1){outputPicker(nodeId,e.target);return;}
        pickOutputPort(nodeId,node.outputs[0].portId);
      }else{
        pending={dir:"in",nodeId};e.target.classList.add("nc-port-active");markTargets();renderBanner();
      }
      return;
    }
    if(pending.nodeId===nodeId&&pending.dir===dir){cancelPending();return;}
    if(pending.dir==="out"&&dir==="in")connectPair(pending.nodeId,pending.portId,nodeId);
    else if(pending.dir==="in"&&dir==="out"){
      if(node.outputs.length>1){outputPicker(nodeId,e.target);return;}
      connectPair(nodeId,node.outputs[0].portId,pending.nodeId);
    }else{tst("Connect an output to an input","error");cancelPending();}
  }

  // ── zoom / pan ──
  function zoomAt(cx,cy,factor){
    const z0=G.viewport.zoom,z=Math.min(MAX_Z,Math.max(MIN_Z,z0*factor));
    const px=(cx-G.viewport.x)/z0,py=(cy-G.viewport.y)/z0;
    G.viewport.zoom=z;G.viewport.x=cx-px*z;G.viewport.y=cy-py*z;
    applyTransform();renderMinimap();
  }
  function zoomBy(f){const r=viewportEl.getBoundingClientRect();zoomAt(r.width/2,r.height/2,f);scheduleSave();}
  function fitToScreen(){
    const ns=Object.values(G.nodes);
    if(!ns.length){G.viewport={x:0,y:0,zoom:1};applyTransform();renderMinimap();return;}
    measureNodes();
    const x0=Math.min(...ns.map(n=>n.position.x))-40,y0=Math.min(...ns.map(n=>n.position.y))-50;
    const x1=Math.max(...ns.map(n=>n.position.x+n.size.w))+40,y1=Math.max(...ns.map(n=>n.position.y+n.size.h))+40;
    const r=viewportEl.getBoundingClientRect();
    const w=r.width||360,h=r.height||480;
    const z=Math.min(1.2,Math.max(MIN_Z,Math.min(w/Math.max(1,x1-x0),h/Math.max(1,y1-y0))));
    G.viewport={zoom:z,x:-x0*z+(w-(x1-x0)*z)/2,y:-y0*z+(h-(y1-y0)*z)/2};
    applyTransform();renderEdges();renderMinimap();scheduleSave();
  }
  function tidy(){
    const ns=Object.values(G.nodes);if(!ns.length)return;
    checkpoint();measureNodes();
    const level={};
    const lv=id=>{if(level[id]!==undefined)return level[id];level[id]=0;let L=0;upstreamOf(id).forEach(u=>{L=Math.max(L,lv(u)+1);});return level[id]=L;};
    ns.forEach(n=>lv(n.id));
    const cols={};ns.forEach(n=>{(cols[level[n.id]]=cols[level[n.id]]||[]).push(n);});
    let x=40;
    Object.keys(cols).map(Number).sort((a,b)=>a-b).forEach(k=>{
      const col=cols[k].sort((a,b)=>a.position.y-b.position.y);
      let y=40,w=0;
      col.forEach(n=>{n.position.x=x;n.position.y=y;y+=(n.size.h||160)+50;w=Math.max(w,n.size.w);});
      x+=w+110;
    });
    renderAll();fitToScreen();tst("✨ Tidied","success");
  }
  function onTouchStart(e){
    if(e.touches.length!==2)return;
    const[a,b]=e.touches;
    pinch={d:Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY),z:G.viewport.zoom,mx:(a.clientX+b.clientX)/2,my:(a.clientY+b.clientY)/2,vx:G.viewport.x,vy:G.viewport.y};
    drag=null;
  }
  function onTouchMove(e){
    if(!pinch||e.touches.length!==2)return;
    e.preventDefault();
    const[a,b]=e.touches,d=Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    const z=Math.min(MAX_Z,Math.max(MIN_Z,pinch.z*(d/pinch.d)));
    const r=viewportEl.getBoundingClientRect();
    const cx=(pinch.mx-r.left-pinch.vx)/pinch.z,cy=(pinch.my-r.top-pinch.vy)/pinch.z;
    G.viewport.zoom=z;G.viewport.x=pinch.mx-r.left-cx*z;G.viewport.y=pinch.my-r.top-cy*z;
    applyTransform();
  }
  function onTouchEnd(){if(pinch){pinch=null;scheduleSave();renderMinimap();}}
  function onWheel(e){
    e.preventDefault();
    const r=viewportEl.getBoundingClientRect();
    zoomAt(e.clientX-r.left,e.clientY-r.top,e.deltaY<0?1.1:0.9);scheduleSave();
  }
  function onKey(e){
    if(!rootEl||!rootEl.isConnected)return;
    if(Sx().mod&&Sx().mod!=="nodecanvas")return;
    const t=e.target,tag=t&&t.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(t&&t.isContentEditable))return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&(e.key==="z"||e.key==="Z")){e.preventDefault();e.shiftKey?redo():undo();}
    else if(mod&&(e.key==="y"||e.key==="Y")){e.preventDefault();redo();}
    else if(mod&&e.key==="Enter"){e.preventDefault();runSelected();}
    else if(mod&&(e.key==="d"||e.key==="D")){e.preventDefault();G.selection.nodeIds.slice().forEach(duplicateNode);}
    else if(e.key==="Delete"||e.key==="Backspace"){
      if(G.selection.edgeIds.length){e.preventDefault();G.selection.edgeIds.slice().forEach(deleteEdge);}
      else if(G.selection.nodeIds.length){e.preventDefault();deleteNodes(G.selection.nodeIds.slice());}
    }else if(e.key==="Escape"){if(pending)cancelPending();else if(moveId)freezeMove();else clearSelection();closeSheet();}
  }

  // ── results ──
  function resultOf(id){const n=G.nodes[id],d=n&&def(n.type);return d&&d.result?d.result(n):null;}
  async function saveResult(id){
    const r=resultOf(id);if(!r)return;
    try{
      if(r.kind==="image")await createImageAsset(r.url,r.prompt||"Node Canvas image","",{model:r.model});
      else if(r.kind==="video")createVideoAsset(r.url,r.prompt||"Node Canvas video",null,{model:r.model,aspectRatio:r.aspectRatio,resolution:r.resolution,duration:r.duration});
      else createAudioAsset(r.url,r.prompt||"Node Canvas voice-over");
      tst("💾 Saved to Gallery","success");
    }catch(e){tst("❌ Couldn't save: "+e.message,"error");}
  }
  function downloadResult(id){
    const r=resultOf(id);if(!r)return;
    const ext={image:"png",video:"mp4",audio:"mp3"}[r.kind];
    try{downloadWithName(r.url,`kosmic-canvas-${r.kind}-${Date.now()}.${ext}`);}catch(e){window.open(r.url,"_blank","noopener");}
  }
  function openResult(id){const r=resultOf(id);if(r)window.open(r.url,"_blank","noopener");}

  async function uploadMedia(nodeId,event,kind){
    const file=event.target.files&&event.target.files[0];event.target.value="";
    const node=G.nodes[nodeId];if(!file||!node)return;
    if(!file.type.startsWith(kind+"/")){tst(`❌ That isn't a ${kind} file`,"error");return;}
    const btn=event.target.previousElementSibling,orig=btn?btn.textContent:"";
    if(btn){btn.textContent="⏳ Uploading…";btn.disabled=true;}
    let url=null;
    try{
      if(typeof fbStorage!=="undefined"&&fbStorage){
        const ref=fbStorage.ref(`node-canvas/${nodeId}_${Date.now()}_${file.name}`);
        const limit=Math.min(90000,8000+file.size/1048576*1500);
        await Promise.race([ref.put(file),new Promise((_,no)=>setTimeout(()=>no(new Error("Cloud upload timed out")),limit))]);
        url=await ref.getDownloadURL();
      }
    }catch(err){console.warn("Node Canvas cloud upload failed:",err.message);}
    if(!url){
      const key=gs("api_falai","");
      if(key){try{url=await uploadToFalStorage(file,key);}catch(err){console.warn("fal upload failed:",err.message);}}
    }
    if(!url){
      if(file.size>12*1048576){tst("❌ Upload failed and the file is too big to keep on this device","error");if(btn){btn.textContent=orig;btn.disabled=false;}return;}
      try{
        url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error("Couldn't read file"));r.readAsDataURL(file);});
        tst("⚠️ Cloud storage unavailable — saved on this device only","error");
      }catch(err){tst(`❌ Upload failed: ${err.message}`,"error");if(btn){btn.textContent=orig;btn.disabled=false;}return;}
    }
    const live=G.nodes[nodeId];
    if(!live){return;}
    checkpoint();
    live.data.url=url;live.data.name=file.name;live.data.uploadedAt=Date.now();
    markDownstreamStale(nodeId);refreshInstant();scheduleSave();
    if(nodesLayerEl.querySelector(`[data-node-id="${nodeId}"]`))renderNodeOnly(nodeId);else renderAll();
    renderRunBar();
    tst(`✅ ${kind[0].toUpperCase()+kind.slice(1)} added`,"success");
  }
  const uploadReferenceImage=(id,ev)=>uploadMedia(id,ev,"image");
  async function loadVoices(id){
    if(typeof fetchElevenLabsVoices!=="function"){tst("Voice list isn't available","error");return;}
    tst("Loading your voices…","");
    const v=await fetchElevenLabsVoices(true);
    if(!v){tst("Add your ElevenLabs key in Settings first","error");return;}
    renderNodeOnly(id);
  }
  function imgFail(img){
    const d=document.createElement("div");d.className="nc-err";d.style.textAlign="center";d.textContent="⚠️ Image failed to load";
    img.replaceWith(d);
  }

  // ═════════════ SHEETS (canvases · new · library) ═════════════
  let sheetMode=null;
  const sheetOpen=()=>sheetMode;
  function ensureSheet(){
    let sh=document.getElementById("ncSheet");
    if(sh)return sh;
    const bd=document.createElement("div");bd.className="ig-settings-backdrop";bd.id="ncBackdrop";bd.onclick=()=>closeSheet();
    sh=document.createElement("div");sh.className="ig-settings-sheet kc-sheet";sh.id="ncSheet";
    sh.innerHTML=`<div class="ig-sheet-handle"></div><div class="ig-sheet-header"><div id="ncSheetTitle"></div><button type="button" class="ks-btn sm" onclick="NodeCanvas.closeSheet()">Done</button></div><div class="ks-body" id="ncSheetBody" style="max-height:68vh;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>`;
    document.body.appendChild(bd);document.body.appendChild(sh);
    return sh;
  }
  function showSheet(mode,title,html){
    const sh=ensureSheet();
    sheetMode=mode;
    document.getElementById("ncSheetTitle").innerHTML=title;
    document.getElementById("ncSheetBody").innerHTML=html;
    sh.classList.add("open");document.getElementById("ncBackdrop").classList.add("show");
  }
  function closeSheet(){
    sheetMode=null;
    const sh=document.getElementById("ncSheet"),bd=document.getElementById("ncBackdrop");
    if(sh)sh.classList.remove("open");if(bd)bd.classList.remove("show");
  }
  function thumbSVG(t){
    const rects=(t||[]).map(r=>`<rect x="${num(r[0],0)}" y="${num(r[1],0)}" width="${num(r[2],3)}" height="${num(r[3],3)}" rx="2" fill="${colorOk(r[4])}" opacity=".85"/>`).join("");
    return`<svg viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet">${rects||`<text x="50" y="32" text-anchor="middle" font-size="9" fill="currentColor" opacity=".45">empty</text>`}</svg>`;
  }
  let listFilter="";
  function openCanvases(filter){
    if(typeof filter==="string")listFilter=filter;else listFilter="";
    renderCanvasList();
  }
  function renderCanvasList(){
    const q=listFilter.toLowerCase();
    const list=projects.slice().sort((a,b)=>(b.id===projectId)-(a.id===projectId)||(b.updated||0)-(a.updated||0)).filter(p=>!q||p.name.toLowerCase().includes(q));
    const cards=list.map(p=>{
      const cur=p.id===projectId;
      const n=cur?Object.keys(G.nodes).length:(p.nodes||0);
      return`<div class="nc2-card${cur?" on":""}">
        <div class="nc2-thumb" onclick="NodeCanvas.openProject('${p.id}')">${thumbSVG(cur?thumbOf():p.thumb)}</div>
        <div class="nc2-cinfo" onclick="NodeCanvas.openProject('${p.id}')"><b>${esc(p.name)}${cur?' <em>open</em>':""}</b><small>${n} node${n!==1?"s":""}${p.updated?" · "+ago(p.updated):""}</small></div>
        <div class="nc2-cact"><button title="Rename" onclick="NodeCanvas.renameProject('${p.id}')">✎</button><button title="Duplicate" onclick="NodeCanvas.duplicateProject('${p.id}')">⧉</button><button class="nc2-dng" title="Delete" onclick="NodeCanvas.deleteProject('${p.id}')">🗑</button></div>
      </div>`;}).join("");
    showSheet("list",`Canvases <small style="opacity:.6">${projects.length}</small>`,
      `<button class="nc2-newbig" onclick="NodeCanvas.openNew()">＋ New canvas</button>`+
      (projects.length>5?`<input class="f-input" id="ncFilter" placeholder="Search canvases…" value="${esc(listFilter)}" oninput="NodeCanvas.openCanvases(this.value);var i=document.getElementById('ncFilter');i&&(i.focus(),i.setSelectionRange(i.value.length,i.value.length))" style="margin:8px 0">`:"")+
      `<div class="nc2-cards">${cards||`<div class="nc-hint">No canvas matches “${esc(listFilter)}”</div>`}</div>`);
  }
  function openNew(){
    newTpl="blank";
    const tpls=REG.templates.map(t=>`<button type="button" class="nc2-tpl${t.id===newTpl?" on":""}" data-t="${t.id}" onclick="NodeCanvas._pickTpl('${t.id}')"><i>${esc(t.icon)}</i><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join("");
    showSheet("new","New canvas",
      `<label class="nc-field-label" style="margin-top:4px">Name</label><input class="f-input" id="ncNewName" placeholder="Untitled Canvas" maxlength="60" style="margin-bottom:10px">
       <label class="nc-field-label">Start from</label><div class="nc2-tpls">${tpls}</div>
       <button class="nc2-newbig" style="margin-top:12px" onclick="NodeCanvas._createNew()">Create canvas</button>`);
  }
  function pickTpl(id){
    newTpl=id;
    document.querySelectorAll(".nc2-tpl").forEach(b=>b.classList.toggle("on",b.getAttribute("data-t")===id));
  }
  function createNew(){
    const el=document.getElementById("ncNewName");
    closeSheet();createProject(el?el.value:"",newTpl);
  }
  function openLibrary(filter){
    const q=(typeof filter==="string"?filter:"").toLowerCase();
    let html=`<input class="f-input" id="ncLibQ" placeholder="Search nodes…" value="${esc(q)}" oninput="NodeCanvas.openLibrary(this.value);var i=document.getElementById('ncLibQ');i&&(i.focus(),i.setSelectionRange(i.value.length,i.value.length))" style="margin-bottom:8px">`;
    REG.groups.forEach(gp=>{
      const items=REG.list().filter(d=>d.group===gp&&(!q||(d.label+" "+(d.desc||"")).toLowerCase().includes(q)));
      if(!items.length)return;
      html+=`<div class="nc2-grp">${esc(gp)}</div>`+items.map(d=>`<button type="button" class="nc2-lib" onclick="NodeCanvas.addNode('${d.type}');NodeCanvas.closeSheet()"><span class="nc2-dot" style="background:${colorOk(d.color)}">${esc(d.icon||"")}</span><span><b>${esc(d.label)}</b><small>${esc(d.desc||"")}</small></span></button>`).join("");
    });
    showSheet("lib","Add a node",html);
  }
  function snack(msg,label,fn){
    hideSnack();
    const s=document.createElement("div");s.className="nc2-snack";s.id="ncSnack";
    s.innerHTML=`<span>${esc(msg)}</span><button>${esc(label)}</button>`;
    s.querySelector("button").onclick=()=>{fn();};
    document.body.appendChild(s);
    snackTimer=setTimeout(hideSnack,10000);
  }
  function hideSnack(){clearTimeout(snackTimer);const s=document.getElementById("ncSnack");if(s)s.remove();}

  // ═════════════ CSS ═════════════
  function ensureCss(){
    if(document.getElementById("nc2-css"))return;
    const st=document.createElement("style");st.id="nc2-css";
    st.textContent=`
.nc2-head{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
.nc2-title{font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)}
.nc2-title span{display:block;font-family:inherit;font-size:11px;font-weight:500;color:var(--textm);margin-top:2px}
.nc2-bar{display:flex;gap:6px;align-items:stretch}
.nc2-btn,.nc2-name{border:1px solid var(--glass-brd);background:var(--glass-solid);color:var(--violet);border-radius:12px;cursor:pointer;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 11px;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);transition:transform .12s}
.nc2-btn:active,.nc2-name:active{transform:scale(.95)}
.nc2-btn:disabled{opacity:.4;pointer-events:none}
.nc2-btn i,.nc2-name i{font-style:normal}
.nc2-danger{color:var(--red,#d33)}
.nc2-name{flex:1;min-width:0;justify-content:space-between;text-align:left}
.nc2-name b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nc2-name small{font-weight:500;color:var(--textm);font-size:10px;white-space:nowrap}
@media(max-width:420px){.nc2-btn span{display:none}}
.nc2-rail{position:absolute;right:10px;top:64px;z-index:20;display:flex;flex-direction:column;gap:2px;background:var(--glass-solid);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--glass-brd);border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.1)}
.nc2-rail .nc-tool-btn-plain:disabled{opacity:.3}
.nc-tool-btn-lib{border:none;border-radius:10px;cursor:pointer;background:var(--violet,#6240b0);color:#fff;font-weight:800;font-size:11px;padding:0 12px;min-height:34px;flex:0 0 auto}
.nc2-runbar{position:absolute;left:10px;bottom:10px;z-index:20;display:flex;align-items:center;gap:8px;background:var(--glass-solid);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--glass-brd);border-radius:12px;padding:5px 6px 5px 6px;box-shadow:0 4px 16px rgba(0,0,0,.1);max-width:calc(100% - 150px)}
.nc2-run,.nc2-stop{border:none;border-radius:9px;color:#fff;font-weight:800;font-size:12px;padding:8px 12px;cursor:pointer;white-space:nowrap}
.nc2-run{background:linear-gradient(135deg,#6240b0,#3d1f7a)}.nc2-run small{font-weight:600;opacity:.85}
.nc2-stop{background:#d33}.nc2-ok{font-size:11px;font-weight:700;color:#0a9d6b;padding:0 6px}
.nc2-cost{font-size:10px;color:var(--textm);white-space:nowrap;padding-right:4px}
.nc2-float{position:absolute;left:50%;transform:translateX(-50%);bottom:98px;z-index:30;display:flex;align-items:center;gap:6px;background:var(--glass-solid);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--glass-brd);border-radius:16px;padding:6px 8px;box-shadow:0 6px 22px rgba(0,0,0,.18);font-size:11.5px;color:var(--violet);max-width:94%;flex-wrap:wrap;justify-content:center}
.nc2-float span{font-weight:700;padding:0 4px}
.nc2-float button{border:none;background:rgba(98,64,176,.12);color:var(--violet);border-radius:10px;padding:7px 10px;font-size:11.5px;font-weight:700;cursor:pointer}
.nc2-float button.nc2-dng,.nc2-cact .nc2-dng{color:#d33;background:rgba(220,50,50,.1)}
.nc2-banner{background:linear-gradient(135deg,#6240b0,#3d1f7a);color:#fff;border:none}.nc2-banner span{color:#fff}.nc2-banner button{background:rgba(255,255,255,.22);color:#fff}
.nc-hint{font-size:9.5px;color:var(--textm);margin-top:3px;line-height:1.35}.nc-hint-warn{color:var(--red,#d33)}
.nc-err{color:var(--red,#d33);font-size:9.5px;margin-top:5px;line-height:1.35;word-break:break-word;background:rgba(239,68,68,.07);border-radius:7px;padding:4px 6px}
.nc-conns{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.nc-conn{font-size:9px;background:rgba(98,64,176,.10);color:var(--violet);border-radius:999px;padding:2px 3px 2px 7px;display:inline-flex;align-items:center;gap:3px;max-width:100%}
.nc-conn b{font-weight:700}.nc-conn i{font-style:normal;cursor:pointer;width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(220,50,50,.14);color:#d33;font-size:8px}
.nc-res{display:flex;gap:4px;margin-top:6px}
.nc-res button{flex:1;border:none;background:rgba(98,64,176,.10);color:var(--violet);border-radius:8px;padding:6px;font-size:10.5px;font-weight:700;cursor:pointer}
.nc-res button:nth-child(2){flex:2}
.nc-node[data-status="blocked"]{border-color:#9ca3af;opacity:.8}
.nc-node.nc-can{box-shadow:0 0 0 3px #10b981,0 0 18px rgba(16,185,129,.45)}
.nc-node.nc-cant{opacity:.35}
.nc-run-btn:disabled{opacity:.6}
.nc-edge-hit{fill:none;stroke:transparent;stroke-width:18;pointer-events:stroke;cursor:pointer}
.nc-edge-path.nc-edge-sel{stroke-width:4.5;opacity:1;filter:drop-shadow(0 0 5px var(--gold,#e0b341))}
.nc-minimap{cursor:pointer;pointer-events:auto}
.nc2-cards{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.nc2-card{display:flex;align-items:center;gap:10px;border:1px solid var(--glass-brd);background:var(--glass,rgba(255,255,255,.55));border-radius:14px;padding:8px}
.nc2-card.on{border-color:var(--violet,#6240b0);box-shadow:0 0 0 1px var(--violet,#6240b0) inset}
.nc2-thumb{width:84px;height:48px;flex:0 0 auto;border-radius:9px;background:rgba(98,64,176,.08);color:var(--textm);overflow:hidden;cursor:pointer}
.nc2-thumb svg{width:100%;height:100%;display:block}
.nc2-cinfo{flex:1;min-width:0;cursor:pointer;display:flex;flex-direction:column;gap:2px}
.nc2-cinfo b{font-size:13px;color:var(--violet);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nc2-cinfo b em{font-style:normal;font-size:9px;background:var(--violet,#6240b0);color:#fff;border-radius:999px;padding:1px 6px;margin-left:5px;vertical-align:middle}
.nc2-cinfo small{font-size:10.5px;color:var(--textm)}
.nc2-cact{display:flex;gap:4px}
.nc2-cact button{border:none;background:rgba(98,64,176,.10);color:var(--violet);width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:14px}
.nc2-newbig{width:100%;border:none;border-radius:13px;background:linear-gradient(135deg,#6240b0,#3d1f7a);color:#fff;font-weight:800;font-size:13px;padding:13px;cursor:pointer}
.nc2-tpls{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.nc2-tpl{border:1px solid var(--glass-brd);background:var(--glass,rgba(255,255,255,.55));border-radius:13px;padding:10px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:2px;color:var(--violet)}
.nc2-tpl i{font-style:normal;font-size:18px}.nc2-tpl b{font-size:12px}.nc2-tpl small{font-size:10px;color:var(--textm);line-height:1.3}
.nc2-tpl.on{border-color:var(--violet,#6240b0);background:rgba(98,64,176,.12);box-shadow:0 0 0 1px var(--violet,#6240b0) inset}
.nc2-grp{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--textm);margin:10px 2px 4px}
.nc2-lib{width:100%;display:flex;align-items:center;gap:10px;border:1px solid var(--glass-brd);background:var(--glass,rgba(255,255,255,.55));border-radius:13px;padding:8px 10px;margin-bottom:6px;cursor:pointer;text-align:left}
.nc2-lib b{display:block;font-size:12.5px;color:var(--violet)}.nc2-lib small{display:block;font-size:10.5px;color:var(--textm);line-height:1.3}
.nc2-dot{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;flex:0 0 auto}
.nc2-snack{position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:300;display:flex;align-items:center;gap:12px;background:#2a2142;color:#fff;border-radius:14px;padding:10px 12px 10px 16px;font-size:12.5px;box-shadow:0 8px 28px rgba(0,0,0,.35);max-width:92vw}
.nc2-snack button{border:none;background:rgba(255,255,255,.18);color:#fff;font-weight:800;border-radius:10px;padding:7px 12px;cursor:pointer}
`;
    document.head.appendChild(st);
  }

  // ═════════════ INIT ═════════════
  function init(container){
    ensureCss();
    closeSheet();
    rootEl=container;
    const quick=REG.list().map(d=>`<button class="nc-tool-btn" style="--btn-color:${colorOk(d.color)}" title="Add ${esc(d.label)}" onclick="NodeCanvas.addNode('${d.type}')"><span>+</span><span>${esc(d.short||d.label)}</span></button>`).join("");
    rootEl.innerHTML=`
      <div class="nc-toolbar">
        <div class="nc-toolbar-group">${quick}</div>
        <button class="nc-tool-btn-lib" onclick="NodeCanvas.openLibrary()" title="Browse all nodes">☰ Nodes</button>
      </div>
      <div class="nc2-rail">
        <button class="nc-tool-btn-plain" id="ncUndo" title="Undo" onclick="NodeCanvas.undo()" disabled>↶</button>
        <button class="nc-tool-btn-plain" id="ncRedo" title="Redo" onclick="NodeCanvas.redo()" disabled>↷</button>
        <button class="nc-tool-btn-plain" title="Zoom in" onclick="NodeCanvas.zoomBy(1.2)">➕</button>
        <button class="nc-tool-btn-plain" title="Zoom out" onclick="NodeCanvas.zoomBy(0.83)">➖</button>
        <button class="nc-tool-btn-plain" title="Fit to screen" onclick="NodeCanvas.fitToScreen()">⛶</button>
        <button class="nc-tool-btn-plain" title="Tidy layout" onclick="NodeCanvas.tidy()">✨</button>
      </div>
      <div class="nc-viewport"><div class="nc-transform-layer"><svg class="nc-edge-svg"></svg><div class="nc-nodes-layer"></div></div></div>
      <div class="nc-minimap"></div>
      <div class="nc2-runbar"></div>`;
    viewportEl=$(".nc-viewport");layerEl=$(".nc-transform-layer");edgeSvgEl=$(".nc-edge-svg");
    nodesLayerEl=$(".nc-nodes-layer");minimapEl=$(".nc-minimap");
    viewportEl.addEventListener("pointerdown",onCanvasPointerDown);
    viewportEl.addEventListener("click",onCanvasClick);
    viewportEl.addEventListener("wheel",onWheel,{passive:false});
    viewportEl.addEventListener("touchstart",onTouchStart,{passive:true});
    viewportEl.addEventListener("touchmove",onTouchMove,{passive:false});
    viewportEl.addEventListener("touchend",onTouchEnd);
    edgeSvgEl.addEventListener("click",e=>{const id=e.target.getAttribute&&e.target.getAttribute("data-edge-id");if(id){e.stopPropagation();selectEdge(id);}});
    minimapEl.addEventListener("click",minimapTap);
    if(!listeners){
      listeners=true;
      document.addEventListener("pointermove",onPointerMove);
      document.addEventListener("pointerup",onPointerUp);
      document.addEventListener("pointercancel",onPointerUp);
      document.addEventListener("keydown",onKey);
      document.addEventListener("visibilitychange",()=>{if(document.hidden)flushSave();});
      window.addEventListener("pagehide",()=>{flushSave();});
    }
    if(loaded){ // coming back to the module: keep the live graph (runs may be in flight)
      renderAll();renderHeader();refreshHistoryBtns();return;
    }
    (async()=>{
      await loadList();
      const last=await idbG(K_LAST)||lsGet(K_LAST);
      const id=projects.some(p=>p.id===last)?last:projects[0].id;
      loaded=true;
      await openProject(id);
    })();
  }

  return{
    init,addNode,deleteNode,deleteNodes,addEdge,deleteEdge,disconnectNode,duplicateNode,
    runNode,runAll,runSelected,runGraphFrom,stopRun,undo,redo,
    setField,updateNodeData,uploadMedia,uploadReferenceImage,loadVoices,
    openProject,createProject,renameProject,duplicateProject,deleteProject,deleteCurrent,goPrevious,
    openCanvases,openNew,openLibrary,closeSheet,
    zoomBy,fitToScreen,tidy,freezeMove,cancelPending,clearSelection,selectedIds,
    saveResult,downloadResult,openResult,
    serializeGraph:()=>serialize(false),
    loadGraph:json=>{G=sanitize(JSON.parse(json)).graph;refreshInstant();renderAll();},
    switchProject:id=>openProject(id),
    _onNodeDragStart:onNodeDragStart,_onNodeBodyPointerDown:onNodeBodyPointerDown,_onPortTap:onPortTap,
    _pickOutputPort:pickOutputPort,_pickTpl:pickTpl,_createNew:createNew,_imgFail:imgFail,
    _state:()=>({G,projects,recent,projectId,undoStack,redoStack}),_sanitize:sanitize,_planFor:planFor,_flush:flushSave,
  };
})();

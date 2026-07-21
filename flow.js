// ══════════════════════════════════════════════════════════════════════
// FLOW MODULE — eighth extraction from index.html (module split phase 8).
// Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. Largest
// extraction so far (554 lines, 26 functions) — verified systematically,
// not just spot-checked, given the size: every single one of the 26
// functions' call sites were checked against the whole file, and NONE
// have any reference outside this module's own original line range. Flow
// is actually more cleanly isolated than display.js (which has real
// bidirectional coupling with Home) despite being ~3x the size — the high
// internal reference counts (getFlowProject/saveFlowProject at 13 each)
// just reflect heavy reuse of Flow's own helpers by its own other
// functions, not external dependency.
// ══════════════════════════════════════════════════════════════════════

// ── Flow project list ──
function renderFlow(el){
  loadAssetRegistryFromCloud();
  if(S.activeFlowProject){
    const p=getFlowProject(S.activeFlowProject);
    if(p){ renderFlowWorkspace(el,p); return; }
    S.activeFlowProject=null;
  }
  loadFlowProjectsFromCloud();
  const projects=S.flowProjects||[];
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)">🌊 Flow</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">Continuity-managed shot timelines — character &amp; style consistency handled automatically</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="renderAssetRegistryModal()">📚 Asset Registry (${(S.assetRegistry||[]).length})</button>
        <button class="btn btn-primary btn-sm" onclick="createFlowProject()">+ New Flow Project</button>
      </div>
    </div>
    ${projects.length===0?`
      <div class="empty-state">
        <div class="empty-icon">🌊</div>
        <div class="empty-title">No Flow Projects Yet</div>
        <div class="empty-desc">Build a shot timeline and let Flow keep your character and style consistent across every clip — no re-uploading references shot after shot.</div>
        <button class="btn btn-primary" onclick="createFlowProject()">+ Create First Flow Project</button>
      </div>
    `:`<div class="grid2">${projects.map(p=>`
      <div class="project-card" onclick="openFlowProject('${p.id}')">
        <div class="project-card-thumb" style="background:radial-gradient(circle at 30% 20%,#1E3A8Add,#1E3A8A 60%),radial-gradient(circle at 80% 75%,rgba(255,255,255,0.14),transparent 40%)">
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.14);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center"><span style="font-size:24px">🌊</span></div>
        </div>
        <div class="project-card-body">
          <div class="project-card-title">${p.name||'Untitled Flow'}</div>
          <div class="project-card-meta">${(p.shots||[]).length} shot${(p.shots||[]).length!==1?'s':''} · $${(p.runningCostUSD||0).toFixed(2)} est.</div>
          <div class="project-card-tags">
            <span class="badge ${p.shots&&p.shots.every(s=>s.status==='done')&&p.shots.length?'badge-green':'badge-gray'}">${p.shots&&p.shots.length?(p.shots.every(s=>s.status==='done')?'✅ COMPLETE':'DRAFT'):'EMPTY'}</span>
            ${p.budgetCapUSD?`<span class="badge badge-gold">CAP $${p.budgetCapUSD}</span>`:''}
          </div>
        </div>
      </div>`).join('')}</div>`}
  `;
}

function createFlowProject(){
  const p={
    id:"flow_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    name:"Untitled Flow "+(new Date()).toLocaleDateString(),
    createdAt:new Date().toISOString(),
    styleLockAssetId:null,
    budgetCapUSD:null,
    runningCostUSD:0,
    videoModel:"bytedance/seedance-2.0/reference-to-video",
    resolution:"720p",
    aspectRatio:"16:9",
    retryOnFailure:false,
    shots:[],
  };
  S.flowProjects.push(p);
  save("flowProjects");
  syncFlowProjectsToCloud();
  openFlowProject(p.id);
}

function getFlowProject(id){ return (S.flowProjects||[]).find(p=>p.id===id); }

function openFlowProject(id){
  S.activeFlowProject=id;
  renderModule("flow");
}

function saveFlowProject(p){
  save("flowProjects");
  syncFlowProjectsToCloud();
}

// ── Continuity Engine ──
// Deterministic bookkeeping: resolves which reference assets a shot should
// carry, checks nothing is missing before submission, and (for chained
// shots) reuses the last-frame extraction already built for Production
// Pipeline rather than re-implementing it.
function resolveShotReferences(project,shot){
  const refs=[];
  (shot.characterRefIds||[]).forEach(id=>{
    const asset=(S.assetRegistry||[]).find(a=>a.id===id);
    if(asset)refs.push({url:asset.url,label:asset.label,kind:"character"});
  });
  const styleId=shot.styleRefId||project.styleLockAssetId;
  if(styleId){
    const asset=(S.assetRegistry||[]).find(a=>a.id===styleId);
    if(asset)refs.push({url:asset.url,label:asset.label,kind:"style"});
  }
  return refs;
}

function validateFlowProject(project){
  const errors=[];
  (project.shots||[]).forEach((shot,i)=>{
    (shot.characterRefIds||[]).forEach(id=>{
      if(!(S.assetRegistry||[]).find(a=>a.id===id))errors.push(`Shot ${i+1}: character reference is missing from the registry (may have been deleted)`);
    });
    const styleId=shot.styleRefId||project.styleLockAssetId;
    if(styleId&&!(S.assetRegistry||[]).find(a=>a.id===styleId))errors.push(`Shot ${i+1}: style reference is missing from the registry`);
    if(shot.inputType==="text"&&!shot.prompt&&!shot.chainFromPreviousShot)errors.push(`Shot ${i+1}: no prompt, image, or video provided`);
    if(shot.chainFromPreviousShot&&i===0)errors.push(`Shot ${i+1}: can't chain from previous — it's the first shot`);
  });
  return errors;
}

// ── Cost estimation — reuses the verified estimateVideoCost formula, same
// one Video Canvas and Production Pipeline use, extended here to sum across
// a whole shot queue for the running project-total cost bar. ──
function computeFlowShotCost(project,shot){
  const est=estimateVideoCost(project.videoModel,shot.durationSeconds||5,project.resolution,false);
  return est?est.cost:0;
}
function computeFlowProjectCost(project){
  return (project.shots||[]).reduce((sum,s)=>sum+computeFlowShotCost(project,s),0);
}

// ── Shot management ──
function addFlowShot(projectId){
  const p=getFlowProject(projectId);
  if(!p)return;
  const projected=computeFlowProjectCost(p)+computeFlowShotCost(p,{durationSeconds:5});
  if(p.budgetCapUSD&&projected>p.budgetCapUSD){
    toast(`⚠️ Adding this shot would put the project at ~$${projected.toFixed(2)}, over your $${p.budgetCapUSD} cap. Raise the cap or trim a shot first.`,"error");
    return;
  }
  const durConfig=VIDEO_MODEL_DURATIONS[p.videoModel];
  p.shots.push({
    id:"shot_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),
    order:p.shots.length,
    durationSeconds:durConfig?durConfig.options[0]:4,
    inputType:"text",
    prompt:"",
    mediaUrl:null,
    characterRefIds:[],
    styleRefId:null,
    chainFromPreviousShot:p.shots.length>0,
    status:"draft",
    resultVideoUrl:null,
    costUSD:0,
  });
  saveFlowProject(p);
  renderModule("flow");
}
function removeFlowShot(projectId,shotId){
  const p=getFlowProject(projectId);
  if(!p)return;
  p.shots=p.shots.filter(s=>s.id!==shotId);
  p.shots.forEach((s,i)=>s.order=i);
  saveFlowProject(p);
  renderModule("flow");
}
function duplicateFlowShot(projectId,shotId){
  const p=getFlowProject(projectId);
  if(!p)return;
  const shot=p.shots.find(s=>s.id===shotId);
  if(!shot)return;
  const copy={...shot,id:"shot_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),status:"draft",resultVideoUrl:null,costUSD:0};
  const idx=p.shots.findIndex(s=>s.id===shotId);
  p.shots.splice(idx+1,0,copy);
  p.shots.forEach((s,i)=>s.order=i);
  saveFlowProject(p);
  renderModule("flow");
}
function moveFlowShot(projectId,shotId,dir){
  // Reordering is up/down buttons rather than true drag-and-drop — a
  // simplification given effort constraints; functionally equivalent for
  // reordering a linear timeline, just less fluid than a drag gesture.
  const p=getFlowProject(projectId);
  if(!p)return;
  const idx=p.shots.findIndex(s=>s.id===shotId);
  const swapIdx=idx+dir;
  if(swapIdx<0||swapIdx>=p.shots.length)return;
  [p.shots[idx],p.shots[swapIdx]]=[p.shots[swapIdx],p.shots[idx]];
  p.shots.forEach((s,i)=>s.order=i);
  saveFlowProject(p);
  renderModule("flow");
}
function updateFlowShotField(projectId,shotId,field,value){
  const p=getFlowProject(projectId);
  if(!p)return;
  const shot=p.shots.find(s=>s.id===shotId);
  if(!shot)return;
  shot[field]=value;
  saveFlowProject(p);
}
function toggleFlowShotCharRef(projectId,shotId,assetId){
  const p=getFlowProject(projectId);
  const shot=p.shots.find(s=>s.id===shotId);
  if(!shot)return;
  shot.characterRefIds=shot.characterRefIds||[];
  const i=shot.characterRefIds.indexOf(assetId);
  if(i>=0)shot.characterRefIds.splice(i,1);
  else shot.characterRefIds.push(assetId);
  saveFlowProject(p);
  renderModule("flow");
}
async function handleFlowShotMediaUpload(projectId,shotId,event){
  const file=event.target.files[0];
  event.target.value="";
  if(!file)return;
  const p=getFlowProject(projectId);
  const shot=p.shots.find(s=>s.id===shotId);
  if(!shot)return;
  const btn=event.target.previousElementSibling;
  const origLabel=btn?btn.textContent:"";
  if(btn){btn.textContent="Uploading…";btn.disabled=true;}
  try{
    const path=`flow-shots/${projectId}/${shotId}_${Date.now()}_${file.name}`;
    const ref=fbStorage.ref(path);
    await ref.put(file);
    shot.mediaUrl=await ref.getDownloadURL();
  }catch(err){
    console.warn("Flow shot cloud upload failed, falling back to local copy:",err);
    try{
      shot.mediaUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read the file"));r.readAsDataURL(file);});
      toast("⚠️ Cloud storage unavailable — media saved locally on this device only","error");
    }catch(err2){
      toast(`❌ Upload failed: ${err2.message}`,"error");
      if(btn){btn.textContent=origLabel;btn.disabled=false;}
      return;
    }
  }
  saveFlowProject(p);
  renderModule("flow");
}

// ── Workspace UI ──
function renderFlowWorkspace(el,p){
  const runningCost=computeFlowProjectCost(p);
  const overBudget=p.budgetCapUSD&&runningCost>p.budgetCapUSD;
  const durConfig=VIDEO_MODEL_DURATIONS[p.videoModel]||{options:[4,5,6,8,10,12,15]};
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <button class="btn btn-ghost btn-sm" onclick="S.activeFlowProject=null;renderModule('flow')">← Flow Projects</button>
    </div>
    <div class="flow-budget-bar">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
        <input class="f-input" style="font-weight:700;border:none;background:transparent;padding:4px 0;font-size:15px" value="${(p.name||'').replace(/"/g,'&quot;')}" onchange="updateFlowProjectField('${p.id}','name',this.value)">
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div>
          <span style="font-size:10px;color:var(--textm)">Est. total</span><br>
          <span class="flow-cost-total${overBudget?' over-budget':''}">$${runningCost.toFixed(2)}${p.budgetCapUSD?` / $${p.budgetCapUSD}`:''}</span>
        </div>
        <div class="f-group" style="margin:0"><label class="f-label" style="font-size:9px">Budget Cap ($)</label><input class="f-input" style="width:90px;padding:5px 8px" type="number" min="0" step="1" placeholder="none" value="${p.budgetCapUSD||''}" onchange="updateFlowProjectField('${p.id}','budgetCapUSD',this.value?parseFloat(this.value):null)"></div>
        <button class="btn btn-gold btn-sm" onclick="submitFlowProject('${p.id}')">▶ Render Queue</button>
      </div>
    </div>

    <div class="f-row" style="margin-bottom:12px">
      <div class="f-group"><label class="f-label">Video Model</label>
        <select class="f-select" onchange="updateFlowProjectModel('${p.id}',this.value)">
          <option value="bytedance/seedance-2.0/reference-to-video" ${p.videoModel==='bytedance/seedance-2.0/reference-to-video'?'selected':''}>Seedance 2.0 — Multi-Reference</option>
          <option value="bytedance/seedance-2.0/fast/reference-to-video" ${p.videoModel==='bytedance/seedance-2.0/fast/reference-to-video'?'selected':''}>Seedance 2.0 Fast — Multi-Reference</option>
        </select>
      </div>
      <div class="f-group"><label class="f-label">Resolution</label>
        <select class="f-select" id="flowResSelect" onchange="updateFlowProjectField('${p.id}','resolution',this.value)"></select>
      </div>
      <div class="f-group"><label class="f-label">Style Lock <span style="font-weight:400;color:var(--texts)">(applies to every shot)</span></label>
        <select class="f-select" onchange="updateFlowProjectField('${p.id}','styleLockAssetId',this.value||null)">
          <option value="">None</option>
          ${(S.assetRegistry||[]).filter(a=>a.type==='stylePlate').map(a=>`<option value="${a.id}" ${p.styleLockAssetId===a.id?'selected':''}>${a.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="f-group" style="margin-bottom:6px">
      <label class="f-label" style="display:flex;align-items:center;gap:6px"><input type="checkbox" ${p.retryOnFailure?'checked':''} onchange="updateFlowProjectField('${p.id}','retryOnFailure',this.checked)"> Retry once on failure (simple retry, no reserved-buffer accounting)</label>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px">
      <div style="font-size:12px;font-weight:700;color:var(--violet)">Shot Timeline (${p.shots.length})</div>
      <button class="btn btn-outline btn-xs" onclick="renderAssetRegistryModal('${p.id}')">📚 Asset Registry</button>
    </div>
    <div class="flow-timeline">
      ${p.shots.map((s,i)=>renderFlowShotBlock(p,s,i)).join('')}
      <div class="flow-add-shot-btn" onclick="addFlowShot('${p.id}')" title="Add shot">+</div>
    </div>
    <div id="flowValidationNote" style="font-size:11px;color:#b45309;margin-top:8px"></div>
  `;
  populateResolutionSelect("flowResSelect","flowResSelect",p.videoModel,p.resolution);
}

function renderFlowShotBlock(project,shot,index){
  const refs=resolveShotReferences(project,shot);
  const cost=computeFlowShotCost(project,shot);
  const durConfig=VIDEO_MODEL_DURATIONS[project.videoModel]||{options:[4,5,6,8,10,12,15]};
  const statusBadge={draft:'',queued:'<span class="badge badge-gray">QUEUED</span>',rendering:'<span class="badge badge-orange">⏳ RENDERING</span>',done:'<span class="badge badge-green">✅ DONE</span>',failed:'<span class="badge badge-red">❌ FAILED</span>'}[shot.status]||'';
  return `
    <div class="flow-shot-block${shot.status==='failed'?' flow-shot-error':''}">
      <div class="flow-shot-num">#${index+1}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;margin-top:4px">
        <select class="f-select" style="font-size:10px;padding:3px 6px" onchange="updateFlowShotField('${project.id}','${shot.id}','inputType',this.value);renderModule('flow')">
          <option value="text" ${shot.inputType==='text'?'selected':''}>📝 Text</option>
          <option value="image" ${shot.inputType==='image'?'selected':''}>🖼 Image</option>
          <option value="video" ${shot.inputType==='video'?'selected':''}>🎬 Video</option>
        </select>
        ${statusBadge}
      </div>
      ${shot.inputType==='text'?`<textarea class="f-textarea" style="min-height:52px;font-size:11px;padding:6px" placeholder="Describe this shot…" onchange="updateFlowShotField('${project.id}','${shot.id}','prompt',this.value)">${shot.prompt||''}</textarea>`
        :`<div style="text-align:center">
            ${shot.mediaUrl?`<img src="${shot.mediaUrl}" style="width:100%;height:70px;object-fit:cover;border-radius:8px;margin-bottom:4px">`:`<div style="height:70px;border:1.5px dashed var(--glass-brd);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--textm);font-size:10px;margin-bottom:4px">No file yet</div>`}
            <button class="btn btn-outline btn-xs btn-full" onclick="document.getElementById('flowUpload_${shot.id}').click()">Upload ${shot.inputType}</button>
            <input type="file" id="flowUpload_${shot.id}" accept="${shot.inputType==='image'?'image/*':'video/*'}" style="display:none" onchange="handleFlowShotMediaUpload('${project.id}','${shot.id}',event)">
            <textarea class="f-textarea" style="min-height:32px;font-size:10px;padding:5px;margin-top:4px" placeholder="Motion/action prompt (optional)" onchange="updateFlowShotField('${project.id}','${shot.id}','prompt',this.value)">${shot.prompt||''}</textarea>
          </div>`}
      <div style="margin-top:6px">
        <label class="f-label" style="font-size:9px">Duration</label>
        <select class="f-select" style="font-size:10px;padding:3px 6px" onchange="updateFlowShotField('${project.id}','${shot.id}','durationSeconds',parseInt(this.value));renderModule('flow')">
          ${durConfig.options.map(d=>`<option value="${d}" ${shot.durationSeconds===d?'selected':''}>${d}s</option>`).join('')}
        </select>
      </div>
      <div style="margin-top:6px">
        <label class="f-label" style="font-size:9px;display:flex;align-items:center;gap:4px"><input type="checkbox" ${shot.chainFromPreviousShot?'checked':''} ${index===0?'disabled':''} onchange="updateFlowShotField('${project.id}','${shot.id}','chainFromPreviousShot',this.checked)"> Continue from previous shot</label>
      </div>
      <div style="margin-top:6px">
        <button class="btn btn-outline btn-xs btn-full" onclick="openFlowCharPicker('${project.id}','${shot.id}')">👤 Characters (${(shot.characterRefIds||[]).length})</button>
      </div>
      <div class="flow-consistency-row">
        ${refs.map(r=>`<span class="flow-consistency-badge" style="background:${r.kind==='character'?'var(--glow-gold)':'var(--glow-ice)'};color:${r.kind==='character'?'var(--gold)':'var(--ice)'}">${r.kind==='character'?'👤':'🎨'} ${r.label}</span>`).join('')}
        ${shot.chainFromPreviousShot?`<span class="flow-consistency-badge" style="background:var(--glow-ice);color:var(--ice)">🔗 chained</span>`:''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid var(--glass-brd)">
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--textm)">~$${cost.toFixed(2)}</span>
        <div style="display:flex;gap:2px">
          <button class="btn btn-ghost btn-xs" onclick="moveFlowShot('${project.id}','${shot.id}',-1)" title="Move left" ${index===0?'disabled':''}>◀</button>
          <button class="btn btn-ghost btn-xs" onclick="moveFlowShot('${project.id}','${shot.id}',1)" title="Move right" ${index===project.shots.length-1?'disabled':''}>▶</button>
          <button class="btn btn-ghost btn-xs" onclick="duplicateFlowShot('${project.id}','${shot.id}')" title="Duplicate">⧉</button>
          <button class="btn btn-ghost btn-xs" onclick="removeFlowShot('${project.id}','${shot.id}')" title="Remove">🗑</button>
        </div>
      </div>
      ${shot.resultVideoUrl?`<video src="${shot.resultVideoUrl}" controls style="width:100%;border-radius:8px;margin-top:6px"></video>`:''}
    </div>`;
}

function updateFlowProjectField(projectId,field,value){
  const p=getFlowProject(projectId);
  if(!p)return;
  p[field]=value;
  saveFlowProject(p);
  if(field==="name"||field==="budgetCapUSD")return; // no full re-render needed for these, avoids losing input focus
  renderModule("flow");
}
function updateFlowProjectModel(projectId,model){
  const p=getFlowProject(projectId);
  if(!p)return;
  p.videoModel=model;
  const durConfig=VIDEO_MODEL_DURATIONS[model];
  if(durConfig)p.shots.forEach(s=>{ if(!durConfig.options.includes(s.durationSeconds))s.durationSeconds=durConfig.options[0]; });
  saveFlowProject(p);
  renderModule("flow");
}

function openFlowCharPicker(projectId,shotId){
  const p=getFlowProject(projectId);
  const shot=p.shots.find(s=>s.id===shotId);
  const chars=(S.assetRegistry||[]).filter(a=>a.type==="characterKeyframe");
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.innerHTML=`<div class="modal" style="width:320px">
    <div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--violet);margin-bottom:12px">Character References</div>
    ${chars.length===0?`<div style="font-size:12px;color:var(--textm);margin-bottom:12px">No character keyframes in the registry yet — add some from the Asset Registry first.</div>`:
    `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${chars.map(c=>`<div class="flow-asset-chip${(shot.characterRefIds||[]).includes(c.id)?' selected':''}" onclick="toggleFlowShotCharRef('${projectId}','${shotId}','${c.id}');this.closest('.modal-overlay').remove()"><img src="${c.url}">${c.label}</div>`).join('')}</div>`}
    <button class="btn btn-outline btn-full" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>`;
  document.body.appendChild(overlay);
}

// ── Asset Registry management ──
function renderAssetRegistryModal(){
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.id="assetRegistryModal";
  overlay.innerHTML=`<div class="modal" style="width:360px;max-height:80vh;overflow-y:auto">
    <div style="font-family:var(--font-display);font-size:16px;font-weight:700;color:var(--violet);margin-bottom:4px">📚 Asset Registry</div>
    <div style="font-size:11px;color:var(--textm);margin-bottom:14px">Character keyframes and style plates, shared across every Flow project — no re-uploading the same reference shot after shot.</div>
    <div class="f-group"><input class="f-input" id="arLabel" placeholder="Label, e.g. 'Someoka - determined pose'"></div>
    <div class="f-group"><select class="f-select" id="arType"><option value="characterKeyframe">Character Keyframe</option><option value="stylePlate">Style Plate</option></select></div>
    <div class="f-group">
      <button class="btn btn-outline btn-full" onclick="document.getElementById('arFile').click()">📤 Choose Image</button>
      <input type="file" id="arFile" accept="image/*" style="display:none" onchange="handleAssetRegistryUpload(event)">
    </div>
    <div id="arUploadPreview" style="display:flex;align-items:center;gap:8px;margin-bottom:10px"></div>
    <button class="btn btn-primary btn-full" id="arAddBtn" onclick="saveAssetRegistryItem()" disabled style="margin-bottom:14px;opacity:0.5">+ Add Asset</button>
    <div style="display:flex;flex-direction:column;gap:8px" id="arList">
      ${(S.assetRegistry||[]).length===0?`<div style="font-size:11px;color:var(--textm);text-align:center;padding:16px 0">No assets yet — add your first one above.</div>`:
      (S.assetRegistry||[]).map(a=>`<div style="display:flex;align-items:center;gap:8px;background:var(--glass);border:1px solid var(--glass-brd);border-radius:10px;padding:6px">
        <img src="${a.url}" style="width:36px;height:36px;border-radius:8px;object-fit:cover">
        <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.label}</div><div style="font-size:9px;color:var(--textm)">${a.type==='characterKeyframe'?'👤 Character':'🎨 Style Plate'}</div></div>
        <button class="btn btn-ghost btn-xs" onclick="deleteAssetRegistryItem('${a.id}')">🗑</button>
      </div>`).join('')}
    </div>
    <button class="btn btn-outline btn-full" style="margin-top:14px" onclick="this.closest('.modal-overlay').remove()">Close</button>
  </div>`;
  document.body.appendChild(overlay);
}
let _arPendingFile=null;
function handleAssetRegistryUpload(event){
  const file=event.target.files[0];
  event.target.value="";
  if(!file)return;
  _arPendingFile=file;
  const preview=document.getElementById("arUploadPreview");
  const objUrl=URL.createObjectURL(file);
  preview.innerHTML=`<img src="${objUrl}" style="width:40px;height:40px;border-radius:8px;object-fit:cover"><span style="font-size:11px;color:var(--text)">${file.name}</span>`;
  const addBtn=document.getElementById("arAddBtn");
  addBtn.disabled=false;
  addBtn.style.opacity="1";
}
async function saveAssetRegistryItem(){
  const label=document.getElementById("arLabel").value.trim();
  const type=document.getElementById("arType").value;
  if(!label){toast("Give this asset a label first","error");return;}
  if(!_arPendingFile){toast("Choose an image first","error");return;}
  const addBtn=document.getElementById("arAddBtn");
  addBtn.disabled=true;
  addBtn.textContent="Uploading…";
  let url;
  try{
    const path=`asset-registry/${Date.now()}_${_arPendingFile.name}`;
    const ref=fbStorage.ref(path);
    await ref.put(_arPendingFile);
    url=await ref.getDownloadURL();
  }catch(err){
    console.warn("Asset Registry cloud upload failed, falling back to local copy:",err);
    try{
      url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read the file"));r.readAsDataURL(_arPendingFile);});
      toast("⚠️ Cloud storage unavailable — saved on this device only","error");
    }catch(err2){
      toast(`❌ Upload failed: ${err2.message}`,"error");
      addBtn.disabled=false;
      addBtn.textContent="+ Add Asset";
      return;
    }
  }
  S.assetRegistry.push({id:"asset_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),label,type,url,tags:[],createdAt:new Date().toISOString()});
  save("assetRegistry");
  syncAssetRegistryToCloud();
  _arPendingFile=null;
  document.getElementById("assetRegistryModal")?.remove();
  renderAssetRegistryModal();
  toast("✅ Asset added","success");
  if(S.activeFlowProject)renderModule("flow");
}
function deleteAssetRegistryItem(id){
  S.assetRegistry=S.assetRegistry.filter(a=>a.id!==id);
  save("assetRegistry");
  syncAssetRegistryToCloud();
  document.getElementById("assetRegistryModal")?.remove();
  renderAssetRegistryModal();
}

// ── Render Queue + Budget Guardrail: submission ──
// Reuses runProductionVideoGen's fal.ai calling pattern and the existing
// last-frame chaining logic (getChainedReferenceFrame/extractLastFrameFromVideo)
// built for Production Pipeline, rather than duplicating that logic.
async function submitFlowProject(projectId){
  const p=getFlowProject(projectId);
  if(!p)return;
  const errors=validateFlowProject(p);
  const note=document.getElementById("flowValidationNote");
  if(errors.length){
    if(note)note.innerHTML=errors.map(e=>`⚠️ ${e}`).join("<br>");
    toast(`${errors.length} issue${errors.length!==1?'s':''} found — fix before rendering`,"error");
    return;
  }
  if(note)note.textContent="";
  if(!gs("api_falai","")){toast("Add a fal.ai API key in Settings first","error");return;}

  for(let i=0;i<p.shots.length;i++){
    const shot=p.shots[i];
    if(shot.status==="done")continue;
    shot.status="rendering";
    saveFlowProject(p);
    renderModule("flow");

    const refs=resolveShotReferences(p,shot);
    let imageUrls=refs.map(r=>r.url);
    let promptTags=refs.map((r,idx)=>`@Image${idx+1} is ${r.kind==='character'?'the character':'the style reference'} (${r.label})`).join(". ");

    if(shot.chainFromPreviousShot&&i>0){
      const prevShot=p.shots[i-1];
      if(prevShot.resultVideoUrl){
        try{
          const lastFrame=await getChainedReferenceFrame(shot.mediaUrl||null,prevShot.resultVideoUrl);
          if(lastFrame){ imageUrls.push(lastFrame); promptTags+=(promptTags?". ":"")+`@Image${imageUrls.length} is the continuation frame from the previous shot — keep the transition seamless.`; }
        }catch(err){ console.warn("Chaining frame extraction failed, continuing without it:",err.message); }
      }
    }
    if(shot.inputType==="image"&&shot.mediaUrl&&!imageUrls.includes(shot.mediaUrl))imageUrls.push(shot.mediaUrl);

    const fullPrompt=(promptTags?promptTags+". ":"")+(shot.prompt||"Continue the scene naturally.");
    let attempt=0,success=false,lastErr=null;
    const maxAttempts=p.retryOnFailure?2:1;
    while(attempt<maxAttempts&&!success){
      attempt++;
      try{
        const apiKey=gs("api_falai","");
        const body={prompt:fullPrompt,aspect_ratio:p.aspectRatio,duration:String(shot.durationSeconds),resolution:p.resolution};
        if(imageUrls.length)body.image_urls=imageUrls;
        const submitRes=await fetch(`https://queue.fal.run/${p.videoModel}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},body:JSON.stringify(body)});
        const submitData=await submitRes.json();
        if(!submitRes.ok)throw new Error((submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText);
        const requestId=submitData.request_id;
        const statusUrl=submitData.status_url||`https://queue.fal.run/${p.videoModel}/requests/${requestId}/status`;
        const resultUrl=submitData.response_url||`https://queue.fal.run/${p.videoModel}/requests/${requestId}`;
        let tries=0,finalData=null;
        while(tries<60){
          await new Promise(r=>setTimeout(r,5000));tries++;
          const statusRes=await fetch(statusUrl,{headers:{"Authorization":"Key "+apiKey}});
          const statusData=await statusRes.json();
          if(statusData.status==="COMPLETED"){const finalRes=await fetch(resultUrl,{headers:{"Authorization":"Key "+apiKey}});finalData=await finalRes.json();break;}
          if(statusData.status==="ERROR"||statusData.status==="FAILED")throw new Error(statusData.error||"Generation failed");
        }
        if(!finalData)throw new Error("Timed out");
        const videoUrl=finalData.video&&finalData.video.url;
        if(!videoUrl){
          const diag=formatFalDiag(finalData);
          throw new Error("No video returned — fal.ai said: "+diag);
        }
        shot.resultVideoUrl=videoUrl;
        shot.costUSD=computeFlowShotCost(p,shot);
        shot.status="done";
        success=true;
      }catch(err){
        lastErr=err;
        if(attempt<maxAttempts)toast(`Shot ${i+1} failed, retrying once… (${err.message})`,"error");
      }
    }
    if(!success){
      shot.status="failed";
      toast(`❌ Shot ${i+1} failed: ${lastErr?lastErr.message:'unknown error'}`,"error");
      saveFlowProject(p);
      renderModule("flow");
      return; // stop the queue on first unrecoverable failure rather than burning budget on later shots
    }
    p.runningCostUSD=computeFlowProjectCost(p);
    saveFlowProject(p);
    renderModule("flow");
  }
  toast("✅ Flow render queue complete","success");
}

// ══════════════════════════════════════════════════════════════════════
// NODE CANVAS MODULE — pannable/zoomable node graph for chaining prompt →
// image → video (+ upscale/TTS/character/style) nodes. Built as an IIFE
// per the spec to keep all graph mutation behind one API and avoid the
// variable-collision class of bug the app-wide audit was written to catch.
// ══════════════════════════════════════════════════════════════════════

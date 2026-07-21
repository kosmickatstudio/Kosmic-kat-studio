// ══════════════════════════════════════════════════════════════════════
// CHARACTERS MODULE — thirteenth extraction from index.html (module split
// phase 13). Plain global script, not an ES module. 609 lines, 27
// functions - checked systematically before extracting given the size,
// same rigor as Flow/Node Canvas.
//
// Real external references, all verified as safe INWARD calls (other
// code calling into this module), not the reverse:
// - openCharDetail/openCharModal: called from Projects (staying in
//   index.html, not yet extracted) when a project's character list is
//   clicked.
// - buildZipDataUri: a generic ZIP-building utility that happens to live
//   in this module's "Training Data Builder" section, reused by the
//   Cross-Module Picker/Assets area for downloads (2 external callers,
//   not the dozens pIcon() has — didn't need the same special
//   stays-in-index.html treatment).
// - handleCharImageUpload/autoGenerateLock/closeCharModal/saveCharacter:
//   called from a static HTML character modal (outside any script tag,
//   same pattern as the Project creation modal) via onclick attributes.
// All resolve correctly via plain global window scope.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

// ── CHARACTERS ──
function renderCharacters(el){
  const unassigned=S.characters.filter(c=>!c.projectId||!S.projects.find(p=>p.id===c.projectId));
  const grouped={};
  S.characters.forEach(c=>{
    const proj=c.projectId&&S.projects.find(p=>p.id===c.projectId);
    if(proj)(grouped[proj.id]=grouped[proj.id]||{proj,chars:[]}).chars.push(c);
  });
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">Character Bible</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${S.characters.length} character${S.characters.length!==1?'s':''} · Soul ID & consistency system</div>
      </div>
      <button class="btn btn-primary" onclick="openCharModal()">${pIcon('plus',13)} New Character</button>
    </div>
    ${S.characters.length===0?`<div class="empty-state"><div class="empty-icon">${pIcon('mask',32)}</div><div class="empty-title">No Characters Yet</div><div class="empty-desc">Create characters with identity locks to keep their look consistent across every generated shot.</div><button class="btn btn-primary" onclick="openCharModal()">${pIcon('plus',13)} Create Character</button></div>`
    :`
    ${unassigned.length?`<div class="grid2" style="margin-bottom:${Object.keys(grouped).length?'18px':'0'}">${unassigned.map(c=>charCardHTML(c)).join('')}</div>`:''}
    ${Object.values(grouped).map(g=>`
      <div style="display:flex;align-items:center;gap:7px;margin:0 0 8px">
        <span style="width:9px;height:9px;border-radius:3px;background:${g.proj.color||'#7c3aed'};flex-shrink:0"></span>
        <span style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--violet)">${g.proj.name}</span>
        <span class="badge badge-gray">${g.chars.length}</span>
      </div>
      <div class="grid2" style="margin-bottom:18px">${g.chars.map(c=>charCardHTML(c)).join('')}</div>
    `).join('')}
    `}
  `;
}

function charCardHTML(c){
  const proj=S.projects.find(p=>p.id===c.projectId);
  const refCount=(c.refImages||[]).length;
  const loraReady=c.loraStatus&&c.loraStatus.state==="ready";
  const borderColor=proj?(proj.color||'#7c3aed'):'var(--glass-brd)';
  return `
    <div class="card" id="cc-${c.id}" style="border-color:${borderColor};${proj?'border-width:1.5px':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="margin-bottom:8px">${c.refImg?`<img src="${c.refImg}" style="width:44px;height:44px;border-radius:10px;object-fit:cover" onerror="this.style.display='none'">`:`<div style="width:44px;height:44px;border-radius:10px;background:var(--lav);display:flex;align-items:center;justify-content:center;color:var(--violet)">${pIcon('mask',20)}</div>`}</div>
        <div style="display:flex;gap:4px">
          <button class="pc-menu-btn" onclick="event.stopPropagation();openCharModal('${c.id}')" title="Edit">${pIcon('pencil',13)}</button>
          <button class="pc-menu-btn" onclick="event.stopPropagation();deleteChar('${c.id}')" title="Delete">${pIcon('trash',13)}</button>
        </div>
      </div>
      <div onclick="openCharDetail('${c.id}')" style="cursor:pointer">
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet);margin-bottom:3px">${c.name}</div>
        <div style="font-size:11px;color:var(--gold);font-weight:700;margin-bottom:4px">${c.role||'Character'}</div>
        <div style="font-size:11px;color:var(--textm);margin-bottom:8px">${proj?proj.name:'No project linked'}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${c.lock?`<span class="badge badge-green">${pIcon('lock',10)} Identity Lock</span>`:'<span class="badge badge-gray">No Lock</span>'}
          ${c.voice?`<span class="badge badge-violet">${pIcon('mic',10)} Voice</span>`:''}
          ${refCount?`<span class="badge badge-gray">${pIcon('camera',10)} ${refCount}</span>`:''}
          ${loraReady?`<span class="badge badge-green">${pIcon('dna',10)} LoRA Trained</span>`:''}
        </div>
      </div>
    </div>`;
}

// ── CHARACTER DETAIL VIEW ──
function openCharDetail(id){
  const c=S.characters.find(x=>x.id===id);
  if(!c)return;
  const proj=S.projects.find(p=>p.id===c.projectId);
  const el=document.getElementById("moduleContent");
  const refImages=c.refImages||[];
  const details=[c.height,c.faction,c.features,c.threat?c.threat+' threat':''].filter(Boolean);
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <button class="btn btn-ghost btn-sm" onclick="renderModule('characters')">${pIcon('back')} Characters</button>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">${c.name}</div>
        <div style="font-size:11px;color:var(--gold);font-weight:700">${c.role||'Character'}${proj?' · '+proj.name:''}</div>
      </div>
      <button class="btn btn-gold btn-sm" onclick="openCharModal('${c.id}')">${pIcon('pencil',13)} Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteChar('${c.id}')">${pIcon('trash',13)}</button>
    </div>
    <div class="grid2">
      <div class="panel">
        <div class="panel-title">${pIcon('clipboard')} Description</div>
        <div style="font-size:13px;color:var(--textm);line-height:1.6">${c.desc||'No description yet.'}</div>
        ${details.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${details.map(d=>`<span class="badge badge-gray">${d}</span>`).join('')}</div>`:''}
      </div>
      <div class="panel">
        <div class="panel-title">${pIcon('lock')} Identity Lock</div>
        <div style="font-size:12px;color:var(--textm);line-height:1.6;background:rgba(61,31,122,0.05);border-radius:8px;padding:10px;font-family:monospace;min-height:50px">${c.lock||'No identity lock set — add one to keep this character visually consistent across image/video generations.'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
          ${c.voice?`<span class="badge badge-violet">${pIcon('mic',11)} Voice: ${c.voice}</span>`:'<span class="badge badge-gray">No voice profile</span>'}
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">${pIcon('camera')} Reference Sheet (${refImages.length})</div>
      ${refImages.length?`<div style="display:flex;gap:10px;flex-wrap:wrap">${refImages.map(img=>`
        <div style="width:90px">
          <img src="${img.dataUrl}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:2px solid ${img.trainTag==='approved'?'var(--green)':img.trainTag==='rejected'?'var(--red)':'var(--border)'}">
          <div style="font-size:9px;text-align:center;font-weight:600;color:var(--textm);margin-top:2px">${img.tag}</div>
        </div>`).join('')}</div>`:`<div class="empty-desc">No reference images yet — add Front/Side/Back/¾/Expression/Costume views, or a full sheet, via Edit.</div>`}
    </div>
    ${renderTrainingDataPanel(c)}
    ${renderLoraPanel(c)}
    <div class="panel">
      <div class="panel-title">${pIcon('rocket')} Use This Character</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="copyCharLock('${c.id}')">${pIcon('clipboard',13)} Copy Lock to Clipboard</button>
        <button class="btn btn-outline btn-sm" onclick="goToVideoCanvasFor('${c.projectId||''}')">${pIcon('film',13)} Go to Video Canvas</button>
        <button class="btn btn-outline btn-sm" onclick="switchMod('imagegen',document.querySelector('[data-mod=imagegen]'))">${pIcon('image',13)} Go to Image Gen</button>
      </div>
    </div>
  `;
}

function copyCharLock(id){
  const c=S.characters.find(x=>x.id===id);
  if(!c||!c.lock){toast("No identity lock set for this character yet","error");return;}
  navigator.clipboard.writeText(c.lock).then(()=>{
    toast(`🔒 ${c.name}'s identity lock copied — paste into your shot prompt`,"success");
  }).catch(()=>{
    toast("Couldn't copy automatically — select and copy the lock text manually","error");
  });
}

// ── RELATIONSHIP WEB (visual) ──
function renderRelationshipWebPanel(c){
  const rels=(c.relationships||[]).map(r=>({...r,target:S.characters.find(x=>x.id===r.targetId)})).filter(r=>r.target);
  if(!rels.length){
    return `<div class="panel"><div class="panel-title">🕸 Relationship Web</div><div class="empty-desc">No relationships mapped yet — add some via Edit to visualize this character's connections.</div></div>`;
  }
  const cx=150,cy=150,radius=95;
  const nodes=rels.map((r,i)=>{
    const angle=(i/rels.length)*Math.PI*2-Math.PI/2;
    return {...r,x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)};
  });
  const lines=nodes.map(n=>`<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="var(--border)" stroke-width="2"/>`).join('');
  const labels=nodes.map(n=>`
    <g style="cursor:pointer" onclick="openCharDetail('${n.target.id}')">
      <circle cx="${n.x}" cy="${n.y}" r="26" fill="var(--lav)" stroke="var(--violet)" stroke-width="1.5"/>
      <text x="${n.x}" y="${n.y-2}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--violet)">${(n.target.name||'?').slice(0,8)}</text>
      <text x="${n.x}" y="${n.y+30}" text-anchor="middle" font-size="9" fill="var(--textm)">${n.type}</text>
    </g>`).join('');
  return `<div class="panel">
    <div class="panel-title">🕸 Relationship Web</div>
    <svg viewBox="0 0 300 300" style="width:100%;max-width:340px;display:block;margin:0 auto">
      ${lines}
      <circle cx="${cx}" cy="${cy}" r="32" fill="var(--violet)"/>
      <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${(c.name||'?').slice(0,9)}</text>
      ${labels}
    </svg>
  </div>`;
}

// ── TRAINING DATA BUILDER ──
function renderTrainingDataPanel(c){
  const refImages=c.refImages||[];
  if(!refImages.length){
    return `<div class="panel"><div class="panel-title">🏷 Training Data Builder</div><div class="empty-desc">Add reference images via Edit, then tag them here as approved/rejected for LoRA training.</div></div>`;
  }
  const approved=refImages.filter(i=>i.trainTag==="approved").length;
  const rejected=refImages.filter(i=>i.trainTag==="rejected").length;
  return `<div class="panel">
    <div class="panel-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>🏷 Training Data Builder</span>
      <span style="font-size:11px;font-weight:600;color:var(--textm)">${approved} approved · ${rejected} rejected · ${refImages.length-approved-rejected} untagged</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${refImages.map(img=>`
        <div style="width:90px;text-align:center">
          <img src="${img.dataUrl}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:2px solid ${img.trainTag==='approved'?'var(--green)':img.trainTag==='rejected'?'var(--red)':'var(--border)'}">
          <div style="font-size:9px;color:var(--textm);margin:2px 0">${img.tag}</div>
          <div style="display:flex;gap:2px;justify-content:center">
            <button class="pc-menu-btn" style="font-size:11px" onclick="toggleTrainTag('${c.id}','${img.id}','approved')" title="Approve">✅</button>
            <button class="pc-menu-btn" style="font-size:11px" onclick="toggleTrainTag('${c.id}','${img.id}','rejected')" title="Reject">❌</button>
          </div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-outline btn-sm" onclick="exportTrainingData('${c.id}')">📤 Export Training Dataset</button>
    </div>
  </div>`;
}

function toggleTrainTag(charId,imgId,tag){
  const c=S.characters.find(x=>x.id===charId);
  if(!c)return;
  const img=(c.refImages||[]).find(i=>i.id===imgId);
  if(!img)return;
  img.trainTag=(img.trainTag===tag)?null:tag; // click again to un-tag
  save("characters");
  openCharDetail(charId);
}

function exportTrainingData(charId){
  const c=S.characters.find(x=>x.id===charId);
  if(!c)return;
  const data={
    character:c.name,
    exportedAt:new Date().toISOString(),
    images:(c.refImages||[]).map(i=>({tag:i.tag,trainTag:i.trainTag||"untagged",dataUrl:i.dataUrl}))
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`${c.name.replace(/[^a-z0-9]/gi,'_')}_training_dataset.json`;
  document.body.appendChild(a);a.click();a.remove();
  URL.revokeObjectURL(url);
  toast("📤 Training dataset exported","success");
}

// ── LoRA FINE-TUNE LAUNCHER (fal.ai flux-lora-fast-training) ──
function renderLoraPanel(c){
  const approved=(c.refImages||[]).filter(i=>i.trainTag==="approved");
  const status=c.loraStatus;
  let statusHtml="";
  if(status&&status.state==="training"){
    statusHtml=`<div style="font-size:12px;color:var(--blue);margin-top:8px" id="loraStatusText-${c.id}">⏳ Training in progress…</div>`;
  } else if(status&&status.state==="ready"){
    statusHtml=`<div style="margin-top:8px">
      <span class="badge badge-green">🧬 Trained — trigger word: "${status.triggerWord}"</span>
      <div style="font-size:11px;color:var(--textm);margin-top:6px;word-break:break-all">Model: <a href="${status.modelUrl}" target="_blank">${status.modelUrl}</a></div>
    </div>`;
  } else if(status&&status.state==="error"){
    statusHtml=`<div style="font-size:12px;color:var(--red);margin-top:8px">❌ Last attempt failed: ${status.error}</div>`;
  }
  return `<div class="panel">
    <div class="panel-title">🧬 Soul ID / LoRA Fine-Tune <span class="badge badge-gray" style="font-weight:600">via fal.ai</span></div>
    <div style="font-size:12px;color:var(--textm);line-height:1.5">Trains a custom FLUX LoRA on this character's approved reference images so it can be generated consistently in Image Gen. Needs at least 4 approved images (10–20+ recommended). Costs ~$2 per run on fal.ai and takes a few minutes.</div>
    <div style="margin-top:10px">
      <button class="btn btn-primary btn-sm" ${approved.length<4?'disabled':''} onclick="launchLoraTraining('${c.id}')">🚀 Launch Training (${approved.length} approved)</button>
    </div>
    ${statusHtml}
  </div>`;
}

// Minimal client-side ZIP writer (stored/uncompressed entries — fully valid ZIP,
// no external library needed). Used to package approved reference images for
// fal.ai's training endpoint, which accepts a base64 data URI per fal's documented
// file-input convention (any file-type field can take a URL or a base64 data URI).
function _crc32(bytes){
  if(!_crc32.table){
    const t=[];
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[n]=c;
    }
    _crc32.table=t;
  }
  let crc=0^(-1);
  for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^_crc32.table[(crc^bytes[i])&0xFF];
  return (crc^(-1))>>>0;
}

function _dataUrlToBytes(dataUrl){
  const base64=dataUrl.split(",")[1];
  const bin=atob(base64);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}

function buildZipDataUri(images){
  const w32=(arr,v)=>{arr.push(v&0xFF,(v>>>8)&0xFF,(v>>>16)&0xFF,(v>>>24)&0xFF);};
  const w16=(arr,v)=>{arr.push(v&0xFF,(v>>>8)&0xFF);};
  const chunks=[];
  const central=[];
  let offset=0,centralSize=0;
  images.forEach(img=>{
    const bytes=_dataUrlToBytes(img.dataUrl);
    const crc=_crc32(bytes);
    const nameBytes=new TextEncoder().encode(img.name);
    const lh=[];
    w32(lh,0x04034b50);w16(lh,20);w16(lh,0);w16(lh,0);w16(lh,0);w16(lh,0);
    w32(lh,crc);w32(lh,bytes.length);w32(lh,bytes.length);
    w16(lh,nameBytes.length);w16(lh,0);
    const lhBytes=new Uint8Array(lh);
    chunks.push(lhBytes,nameBytes,bytes);
    const localOffset=offset;
    offset+=lhBytes.length+nameBytes.length+bytes.length;

    const ch=[];
    w32(ch,0x02014b50);w16(ch,20);w16(ch,20);w16(ch,0);w16(ch,0);w16(ch,0);w16(ch,0);
    w32(ch,crc);w32(ch,bytes.length);w32(ch,bytes.length);
    w16(ch,nameBytes.length);w16(ch,0);w16(ch,0);w16(ch,0);w16(ch,0);w32(ch,0);w32(ch,localOffset);
    const chBytes=new Uint8Array(ch);
    central.push(chBytes,nameBytes);
    centralSize+=chBytes.length+nameBytes.length;
  });
  const centralStart=offset;
  central.forEach(c=>{chunks.push(c);offset+=c.length;});
  const end=[];
  w32(end,0x06054b50);w16(end,0);w16(end,0);w16(end,images.length);w16(end,images.length);
  w32(end,centralSize);w32(end,centralStart);w16(end,0);
  chunks.push(new Uint8Array(end));

  let total=0;chunks.forEach(c=>total+=c.length);
  const zipBytes=new Uint8Array(total);
  let pos=0;chunks.forEach(c=>{zipBytes.set(c,pos);pos+=c.length;});

  let binary="";
  const CHUNK=0x8000;
  for(let i=0;i<zipBytes.length;i+=CHUNK)binary+=String.fromCharCode.apply(null,zipBytes.subarray(i,i+CHUNK));
  return "data:application/zip;base64,"+btoa(binary);
}

async function launchLoraTraining(charId){
  const c=S.characters.find(x=>x.id===charId);
  if(!c)return;
  const approved=(c.refImages||[]).filter(i=>i.trainTag==="approved");
  if(approved.length<4){toast("Need at least 4 approved reference images (10–20+ recommended)","error");return;}
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  if(!(await showConfirmDialog(`Launch LoRA training for ${c.name} using ${approved.length} approved images?\n\nThis costs ~$2 on fal.ai and takes a few minutes.`,{okLabel:"Launch Training"})))return;

  c.loraStatus={state:"training",startedAt:new Date().toISOString()};
  save("characters");
  openCharDetail(charId);

  try{
    const zipDataUri=buildZipDataUri(approved.map((img,i)=>({name:`${i+1}.jpg`,dataUrl:img.dataUrl})));
    const triggerWord=(c.name||"char").toLowerCase().replace(/[^a-z0-9]/g,'')||("char"+c.id.slice(-4));

    const submitRes=await fetch(`https://queue.fal.run/fal-ai/flux-lora-fast-training`,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
      body:JSON.stringify({images_data_url:zipDataUri,trigger_word:triggerWord,is_style:false})
    });
    const submitData=await submitRes.json();
    if(!submitRes.ok){
      const msg=(submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText;
      throw new Error(msg);
    }
    const requestId=submitData.request_id;
    if(!requestId)throw new Error("No request ID returned from fal.ai");
    const statusUrl=submitData.status_url||`https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${requestId}/status`;
    const resultUrl=submitData.response_url||`https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/${requestId}`;
    c.loraStatus={state:"training",requestId,triggerWord,startedAt:c.loraStatus.startedAt};
    save("characters");

    let attempts=0;
    const maxAttempts=90; // ~7.5 min at 5s intervals
    let finalData=null;
    while(attempts<maxAttempts){
      await new Promise(r=>setTimeout(r,5000));
      attempts++;
      const statusRes=await fetch(statusUrl,{headers:{"Authorization":"Key "+apiKey}});
      const statusData=await statusRes.json();
      const liveEl=document.getElementById("loraStatusText-"+c.id);
      if(liveEl)liveEl.textContent=`⏳ ${statusData.status||'Processing'}… (${attempts*5}s elapsed)`;
      if(statusData.status==="COMPLETED"){
        const finalRes=await fetch(resultUrl,{headers:{"Authorization":"Key "+apiKey}});
        finalData=await finalRes.json();
        break;
      }
      if(statusData.status==="ERROR"||statusData.status==="FAILED"){
        throw new Error(statusData.error||"Training failed on fal.ai's side");
      }
    }
    if(!finalData)throw new Error("Timed out waiting for training — it may still complete on fal.ai's dashboard, check back later");
    const loraUrl=finalData.diffusers_lora_file&&finalData.diffusers_lora_file.url;
    if(!loraUrl)throw new Error("No LoRA file URL in fal.ai's response");
    c.loraStatus={state:"ready",modelUrl:loraUrl,triggerWord,requestId,completedAt:new Date().toISOString()};
    save("characters");
    logCost("fal-ai/flux-lora-fast-training",`LoRA training: ${c.name}`);
    toast(`🧬 ${c.name}'s LoRA model is ready!`,"success");
    notifyIfEnabled("LoRA training complete 🧬",`${c.name}'s custom model is ready`);
  }catch(err){
    console.error("LoRA training error:",err);
    c.loraStatus={state:"error",error:err.message};
    save("characters");
    toast("❌ LoRA training failed: "+err.message,"error");
  }
  if(S.characters.find(x=>x.id===charId))openCharDetail(charId);
}

// ── CHARACTER MODAL ──
const REF_VIEW_TAGS=["Front","Side","Back","3/4","Expression","Costume"];

function openCharModal(editId=null){
  S.editingCharId=editId;
  S.editingCharRefImages=[];
  S.editingCharRelationships=[];
  const modal=document.getElementById("charModal");
  document.getElementById("charModalTitle").textContent=editId?"Edit Character":"New Character";
  const projSel=document.getElementById("cmProject");
  projSel.innerHTML=`<option value="">No project</option>`+S.projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if(editId){
    const c=S.characters.find(x=>x.id===editId);
    if(c){
      document.getElementById("cmName").value=c.name||"";
      document.getElementById("cmRole").value=c.role||"Protagonist";
      document.getElementById("cmProject").value=c.projectId||"";
      document.getElementById("cmDesc").value=c.desc||"";
      document.getElementById("cmLock").value=c.lock||"";
      document.getElementById("cmVoice").value=c.voice||"";
      document.getElementById("cmHeight").value=c.height||"";
      document.getElementById("cmFaction").value=c.faction||"";
      document.getElementById("cmFeatures").value=c.features||"";
      document.getElementById("cmThreat").value=c.threat||"";
      // Migrate legacy single refImg into the gallery model
      S.editingCharRefImages=(c.refImages&&c.refImages.length)?c.refImages.slice():(c.refImg?[{id:"legacy_"+c.id,tag:"Front",dataUrl:c.refImg,trainTag:null}]:[]);
      S.editingCharRelationships=(c.relationships||[]).slice();
    }
  } else {
    document.getElementById("cmName").value="";
    document.getElementById("cmRole").value="Protagonist";
    document.getElementById("cmDesc").value="";
    document.getElementById("cmLock").value="";
    document.getElementById("cmVoice").value="";
    document.getElementById("cmHeight").value="";
    document.getElementById("cmFaction").value="";
    document.getElementById("cmFeatures").value="";
    document.getElementById("cmThreat").value="";
  }
  renderCharRefGallery();
  renderCharRefAddButtons();
  renderVoiceGalleryPicker();
  modal.classList.add("show");
}

function renderVoiceGalleryPicker(){
  const wrap=document.getElementById("cmVoiceGalleryWrap");
  if(!wrap)return;
  const clonedVoices=gs("cloned_voices",[])||[];
  if(clonedVoices.length){
    wrap.innerHTML=`<select class="f-select" id="cmVoiceGallery" onchange="if(this.value)document.getElementById('cmVoice').value=this.value;this.value=''">
      <option value="">Choose from your cloned voices…</option>
      ${clonedVoices.map(v=>`<option value="${v.id}">${v.name}</option>`).join('')}
    </select>`;
  } else {
    wrap.innerHTML=`<div style="font-size:11px;color:var(--texts)">No cloned voices yet — <a href="#" onclick="closeCharModal();switchMod('audio',document.querySelector('[data-mod=audio]'));return false" style="color:var(--vm)">clone one in Audio Tools</a>, then it'll show up here to pick from.</div>`;
  }
}

function renderCharRefAddButtons(){
  const wrap=document.getElementById("cmRefAddButtons");
  wrap.innerHTML=REF_VIEW_TAGS.map(tag=>
    `<button type="button" class="btn btn-outline btn-xs" onclick="S.pendingRefTag='${tag}';document.getElementById('cmRefImgFile').click()">+ ${tag}</button>`
  ).join('');
}

function renderCharRefGallery(){
  const wrap=document.getElementById("cmRefGallery");
  if(!S.editingCharRefImages.length){
    wrap.innerHTML=`<div style="font-size:11px;color:var(--textm)">No reference images yet — add views using the buttons below. More angles = better Identity Lock consistency and better LoRA training later.</div>`;
    return;
  }
  wrap.innerHTML=S.editingCharRefImages.map(img=>`
    <div style="position:relative;width:76px">
      <img src="${img.dataUrl}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border)">
      <button type="button" onclick="removeCharRefImage('${img.id}')" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:10px;cursor:pointer;line-height:1">✕</button>
      <div style="font-size:9px;text-align:center;color:var(--textm);margin-top:2px;font-weight:600">${img.tag}</div>
    </div>`).join('');
}

function handleCharImageUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  const tag=S.pendingRefTag||"Front";
  if(!file.type.startsWith("image/")){toast("Please select an image file","error");return;}
  if(file.size>8*1024*1024){toast("Image too large — please choose a smaller file (max 8MB)","error");return;}
  const reader=new FileReader();
  reader.onload=function(e){
    const img=new Image();
    img.onload=function(){
      const maxDim=500;
      let w=img.width,h=img.height;
      if(w>h&&w>maxDim){h=Math.round(h*(maxDim/w));w=maxDim;}
      else if(h>maxDim){w=Math.round(w*(maxDim/h));h=maxDim;}
      const canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      const dataUrl=canvas.toDataURL("image/jpeg",0.82);
      S.editingCharRefImages.push({id:"ref_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),tag,dataUrl,trainTag:null});
      renderCharRefGallery();
      toast(`${tag} added — don't forget to Save`,"success");
    };
    img.onerror=function(){toast("Couldn't read that image — try a different file","error");};
    img.src=e.target.result;
  };
  reader.onerror=function(){toast("Failed to read file","error");};
  reader.readAsDataURL(file);
  event.target.value="";
}

function removeCharRefImage(imgId){
  S.editingCharRefImages=S.editingCharRefImages.filter(i=>i.id!==imgId);
  renderCharRefGallery();
}

// ── AUTO-GENERATE IDENTITY LOCK ──
function autoGenerateLock(){
  const name=document.getElementById("cmName").value.trim();
  if(!name){toast("Enter a character name first","error");return;}
  const role=document.getElementById("cmRole").value;
  const desc=document.getElementById("cmDesc").value.trim();
  const height=document.getElementById("cmHeight").value.trim();
  const faction=document.getElementById("cmFaction").value.trim();
  const features=document.getElementById("cmFeatures").value.trim();
  const threat=document.getElementById("cmThreat").value;
  const parts=[name];
  if(desc)parts.push(desc);
  if(height)parts.push(height);
  if(features)parts.push(features);
  if(faction)parts.push(`affiliated with ${faction}`);
  if(threat)parts.push(`${threat.toLowerCase()} threat level`);
  parts.push(`${role.toLowerCase()} character`);
  parts.push("maintain exact facial features, proportions, colors and markings across every shot — no design drift");
  document.getElementById("cmLock").value=parts.join(", ");
  toast("🪄 Identity Lock generated — edit freely before saving","success");
}

// ── RELATIONSHIPS ──
function renderRelTargetOptions(){
  const sel=document.getElementById("cmRelTarget");
  const others=S.characters.filter(c=>c.id!==S.editingCharId);
  sel.innerHTML=others.length?others.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''):`<option value="">No other characters yet</option>`;
}

function renderRelList(){
  const wrap=document.getElementById("cmRelList");
  if(!S.editingCharRelationships.length){
    wrap.innerHTML=`<div style="font-size:11px;color:var(--textm)">No relationships added yet.</div>`;
    return;
  }
  wrap.innerHTML=S.editingCharRelationships.map(r=>{
    const target=S.characters.find(c=>c.id===r.targetId);
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;background:var(--lav);border-radius:8px;padding:6px 10px">
      <span style="flex:1">→ <strong>${target?target.name:'Unknown'}</strong> — ${r.type||'related'}</span>
      <button type="button" onclick="removeRelationshipRow('${r.id}')" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:13px">✕</button>
    </div>`;
  }).join('');
}

function addRelationshipRow(){
  const targetId=document.getElementById("cmRelTarget").value;
  const type=document.getElementById("cmRelType").value.trim();
  if(!targetId){toast("Add another character first to link a relationship","error");return;}
  if(!type){toast("Describe the relationship (e.g. rival, mentor, sibling)","error");return;}
  S.editingCharRelationships.push({id:"rel_"+Date.now(),targetId,type});
  document.getElementById("cmRelType").value="";
  renderRelList();
}

function removeRelationshipRow(id){
  S.editingCharRelationships=S.editingCharRelationships.filter(r=>r.id!==id);
  renderRelList();
}

function closeCharModal(){document.getElementById("charModal").classList.remove("show");}

function saveCharacter(){
  const name=document.getElementById("cmName").value.trim();
  if(!name){toast("Character name is required","error");return;}
  const data={
    name,
    role:document.getElementById("cmRole").value,
    projectId:document.getElementById("cmProject").value||null,
    desc:document.getElementById("cmDesc").value,
    lock:document.getElementById("cmLock").value,
    voice:document.getElementById("cmVoice").value,
    height:document.getElementById("cmHeight").value,
    faction:document.getElementById("cmFaction").value,
    features:document.getElementById("cmFeatures").value,
    threat:document.getElementById("cmThreat").value,
    refImages:S.editingCharRefImages.slice(),
    refImg:S.editingCharRefImages[0]?S.editingCharRefImages[0].dataUrl:"",
    relationships:S.editingCharRelationships.slice()
  };
  if(S.editingCharId){
    const c=S.characters.find(x=>x.id===S.editingCharId);
    if(c){Object.assign(c,data);save("characters");toast("✅ Character updated","success");}
  } else {
    const c={id:"char_"+Date.now(),...data,created:new Date().toISOString()};
    S.characters.push(c);
    if(data.projectId){
      const p=S.projects.find(x=>x.id===data.projectId);
      if(p){p.chars=(p.chars||0)+1;save("projects");}
      advanceProjectStatusIfBehind(data.projectId,"Pre-production");
    }
    save("characters");toast(`🎭 ${name} created`,"success");
  }
  closeCharModal();
  if(S.activeProject){renderProjectWorkspace(S.projects.find(x=>x.id===S.activeProject));}
  else{renderModule("characters");}
}

async function deleteChar(id){
  if(!(await showConfirmDialog("Delete this character? This cannot be undone.",{danger:true,okLabel:"Delete"})))return;
  const c=S.characters.find(x=>x.id===id);
  if(c&&c.projectId){
    const p=S.projects.find(x=>x.id===c.projectId);
    if(p){p.chars=Math.max(0,(p.chars||1)-1);save("projects");}
  }
  S.characters=S.characters.filter(c=>c.id!==id);
  // Clean up any relationships in OTHER characters pointing at the deleted one
  S.characters.forEach(other=>{
    if(other.relationships&&other.relationships.length){
      const before=other.relationships.length;
      other.relationships=other.relationships.filter(r=>r.targetId!==id);
      if(other.relationships.length!==before)save("characters");
    }
  });
  save("characters");
  renderModule("characters");
  toast("Character deleted","");
}


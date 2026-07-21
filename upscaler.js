// ══════════════════════════════════════════════════════════════════════
// UPSCALER MODULE — sixth extraction from index.html (module split phase
// 6). Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. Two real
// external callers this time (more than most extractions so far):
// - The main script's top-level tab-switch handler calls setUpscaleMode()
//   when the user taps the Single/Batch sub-tabs on the Upscaler screen.
// - Node Canvas (its own upscale node type) calls upscaleImageUrl() to
//   run an upscale from within a node graph.
// Both resolve fine via window global scope as long as this file has
// loaded, same as every prior extraction with real callers (editor.js's
// normalizeSequence, called from Production Pipeline's finalize step).
// ══════════════════════════════════════════════════════════════════════

// ── UPSCALER ──
function renderUpscaler(el){
  const hasKey=gs("api_falai");
  const galleryImages=S.assets.filter(a=>a.type==='image');
  el.innerHTML=`
    <div class="panel">
      <div class="panel-title">⬆️ AI Upscaler ${hasKey?'<span class="badge badge-green">ACTIVE — fal.ai</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      ${!hasKey?`<div style="font-size:12px;color:var(--textm);margin-bottom:12px">Add a <b>fal.ai</b> API key in Settings to enable upscaling. Same key as Image/Video Gen.</div>`:''}
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button class="btn ${(S.upscaleMode||'single')==='single'?'btn-primary':'btn-outline'} btn-sm" onclick="setUpscaleMode('single')">Single</button>
        <button class="btn ${S.upscaleMode==='batch'?'btn-primary':'btn-outline'} btn-sm" onclick="setUpscaleMode('batch')">Batch</button>
      </div>

      ${(S.upscaleMode||'single')==='single'?`
      <div class="f-group">
        <label class="f-label">Choose from Gallery</label>
        <select class="f-select" id="upSourceSelect" onchange="onUpSourceChange()">
          <option value="">— Or paste a URL below —</option>
          ${galleryImages.map(a=>`<option value="${a.url}">🖼 ${(a.prompt||'Untitled').slice(0,40)}</option>`).join('')}
        </select>
      </div>
      <div class="f-group">
        <label class="f-label">Image URL</label>
        <input class="f-input" id="upImageUrl" placeholder="https://… (must be a public URL, not a local file)">
      </div>
      <div class="f-group">
        <label class="f-label">Engine</label>
        <select class="f-select" id="upEngine">
          <option value="fal-ai/esrgan">Real-ESRGAN (fast, 4x, general purpose)</option>
          <option value="fal-ai/clarity-upscaler">Clarity Upscaler (highest fidelity, slower)</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" id="upGenBtn" ${!hasKey?'disabled':''} onclick="runUpscale()">${hasKey?'⬆️ Upscale Image':'🔑 Add API Key First'}</button>
      <div style="font-size:10px;color:var(--texts);margin-top:8px">Note: only works on images with a public URL — base64-stored images from Character Bible/Asset uploads can't be upscaled directly. Gallery images from Image Gen work fine since they're already hosted.</div>
      `:`
      <div style="font-size:12px;color:var(--textm);margin-bottom:10px">Select multiple Gallery images to upscale in one batch (processed one at a time, results shown as they finish).</div>
      ${galleryImages.length===0?`<div class="empty-desc">No Gallery images yet — generate some in Image Gen first.</div>`:`
      <div class="grid3" style="margin-bottom:12px">${galleryImages.map(a=>`
        <div class="card" style="padding:6px;cursor:pointer;${(S.batchUpscaleSelection||[]).includes(a.id)?'border:2px solid var(--violet)':''}" onclick="toggleBatchUpscaleSelect('${a.id}')">
          <img src="${a.url}" style="width:100%;border-radius:6px;aspect-ratio:1;object-fit:cover">
          <div style="font-size:9px;color:var(--textm);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(a.prompt||'Untitled')}</div>
        </div>`).join('')}</div>
      <div class="f-group">
        <label class="f-label">Engine</label>
        <select class="f-select" id="upEngineBatch">
          <option value="fal-ai/esrgan">Real-ESRGAN (fast, 4x, general purpose)</option>
          <option value="fal-ai/clarity-upscaler">Clarity Upscaler (highest fidelity, slower)</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" ${!hasKey||!(S.batchUpscaleSelection||[]).length?'disabled':''} onclick="runBatchUpscale()">⬆️ Upscale ${(S.batchUpscaleSelection||[]).length} Selected</button>
      `}
      `}
    </div>
    <div class="panel" id="upResultPanel" style="display:none;margin-top:14px">
      <div class="panel-title">✨ Result</div>
      <div id="upResultContent"></div>
    </div>
  `;
}

function setUpscaleMode(mode){
  S.upscaleMode=mode;
  renderUpscaler(document.getElementById("moduleContent"));
}

function toggleBatchUpscaleSelect(id){
  S.batchUpscaleSelection=S.batchUpscaleSelection||[];
  const idx=S.batchUpscaleSelection.indexOf(id);
  if(idx>=0)S.batchUpscaleSelection.splice(idx,1);
  else S.batchUpscaleSelection.push(id);
  renderUpscaler(document.getElementById("moduleContent"));
}

async function runBatchUpscale(){
  const ids=S.batchUpscaleSelection||[];
  if(!ids.length)return;
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}
  const engine=document.getElementById("upEngineBatch").value;
  const resultPanel=document.getElementById("upResultPanel");
  const resultContent=document.getElementById("upResultContent");
  resultPanel.style.display="block";
  resultContent.innerHTML="";

  for(let i=0;i<ids.length;i++){
    const asset=S.assets.find(a=>a.id===ids[i]);
    if(!asset)continue;
    const rowId=`batchUp-${i}`;
    resultContent.innerHTML+=`<div id="${rowId}" style="padding:10px;background:rgba(61,31,122,0.04);border-radius:8px;margin-bottom:8px;font-size:12px;color:var(--textm)">⏳ (${i+1}/${ids.length}) Upscaling "${(asset.prompt||'Untitled').slice(0,40)}"…</div>`;
    try{
      const outUrl=await upscaleImageUrl(asset.url,engine,apiKey);
      const savedUpAsset=saveUpscaleToGallery(outUrl,true);
      document.getElementById(rowId).innerHTML=`
        <div style="display:flex;gap:8px;align-items:center">
          <img src="${outUrl}" style="width:60px;height:60px;border-radius:6px;object-fit:cover">
          <div style="flex:1;font-size:11px;color:var(--text)">✅ ${(asset.prompt||'Untitled').slice(0,40)} — saved</div>
          <button class="btn btn-outline btn-xs" onclick="openCollectionPicker('asset','${savedUpAsset.id}')">📁</button>
        </div>`;
      logCost(engine,"Batch upscale");
    }catch(err){
      document.getElementById(rowId).innerHTML=`<span style="color:var(--red)">❌ Failed: ${(asset.prompt||'Untitled').slice(0,30)} — ${err.message}</span>`;
    }
  }
  toast("✨ Batch upscale complete","success");
  S.batchUpscaleSelection=[];
}

// Shared upscale logic used by both single and batch modes
async function upscaleImageUrl(url,engine,apiKey){
  const submitRes=await fetch(`https://queue.fal.run/${engine}`,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
    body:JSON.stringify({image_url:url})
  });
  const submitData=await submitRes.json();
  if(!submitRes.ok){
    const msg=(submitData.detail&&(Array.isArray(submitData.detail)?submitData.detail[0]?.msg:submitData.detail))||submitData.error||submitRes.statusText;
    throw new Error(msg);
  }
  const requestId=submitData.request_id;
  if(!requestId)throw new Error("No request ID returned");
  const statusUrl=submitData.status_url||`https://queue.fal.run/${engine}/requests/${requestId}/status`;
  const resultUrl=submitData.response_url||`https://queue.fal.run/${engine}/requests/${requestId}`;

  let attempts=0,finalData=null;
  while(attempts<36){
    await new Promise(r=>setTimeout(r,5000));
    attempts++;
    const statusRes=await fetch(statusUrl,{headers:{"Authorization":"Key "+apiKey}});
    const statusData=await statusRes.json();
    if(statusData.status==="COMPLETED"){
      const finalRes=await fetch(resultUrl,{headers:{"Authorization":"Key "+apiKey}});
      finalData=await finalRes.json();
      break;
    }
    if(statusData.status==="ERROR"||statusData.status==="FAILED")throw new Error(statusData.error||"Upscale failed");
  }
  if(!finalData)throw new Error("Timed out");
  const outUrl=finalData.image&&finalData.image.url;
  if(!outUrl)throw new Error("No image URL in response");
  return outUrl;
}

function onUpSourceChange(){
  const sel=document.getElementById("upSourceSelect");
  if(sel.value)document.getElementById("upImageUrl").value=sel.value;
}

async function runUpscale(){
  const url=document.getElementById("upImageUrl").value.trim();
  if(!url){toast("Choose an image from Gallery or paste a URL","error");return;}
  if(url.startsWith("data:")){toast("Base64 images can't be upscaled directly — only public URLs (like Gallery images) work","error");return;}
  const apiKey=gs("api_falai","");
  if(!apiKey){toast("Add a fal.ai API key in Settings first","error");return;}

  const engine=document.getElementById("upEngine").value;
  const btn=document.getElementById("upGenBtn");
  const resultPanel=document.getElementById("upResultPanel");
  const resultContent=document.getElementById("upResultContent");
  btn.disabled=true;btn.textContent="⏳ Upscaling…";
  resultPanel.style.display="block";
  resultContent.innerHTML=`<div style="text-align:center;padding:30px;color:var(--textm);font-size:13px">✨ Submitting to ${engine.split('/')[1]}…</div>`;

  try{
    const outUrl=await upscaleImageUrl(url,engine,apiKey);
    const savedUpscaleAsset=saveUpscaleToGallery(outUrl,true);
    resultContent.innerHTML=`
      <div style="font-size:11px;color:var(--textm);margin-bottom:8px">Before / After</div>
      <div class="grid2" style="margin-bottom:10px">
        <div><img src="${url}" style="width:100%;border-radius:8px"><div style="font-size:10px;color:var(--texts);text-align:center;margin-top:4px">Original</div></div>
        <div><img src="${outUrl}" style="width:100%;border-radius:8px"><div style="font-size:10px;color:var(--texts);text-align:center;margin-top:4px">Upscaled</div></div>
      </div>
      <div style="font-size:11px;color:var(--green);margin-bottom:6px">✓ Saved to Gallery automatically</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="downloadWithName('${outUrl.replace(/'/g,"\\'")}','KosmicKat_upscaled.png')">⬇ Download</button>
        <button class="btn btn-outline btn-sm" onclick="openCollectionPicker('asset','${savedUpscaleAsset.id}')">📁 Add to Collection</button>
      </div>`;
    logCost(engine,"Upscale");
    toast("✨ Upscaled — saved to Gallery!","success");
  }catch(err){
    console.error("Upscale error:",err);
    resultContent.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px;background:rgba(239,68,68,0.08);border-radius:8px">❌ ${err.message}</div>`;
    toast("❌ Upscale failed: "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="⬆️ Upscale Image";
}

function saveUpscaleToGallery(url,silent){
  const asset={id:"asset_"+Date.now(),type:"image",url,prompt:"Upscaled image",created:new Date().toISOString()};
  S.assets.push(asset);
  save("assets");
  if(!silent)toast("💾 Saved to Gallery","success");
  return asset;
}


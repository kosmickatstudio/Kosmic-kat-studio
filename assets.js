// ══════════════════════════════════════════════════════════════════════
// ASSETS (Asset Library) MODULE — eleventh extraction from index.html
// (module split phase 11). Plain global script, not an ES module.
//
// The Cross-Module Picker (called from Asset Library, Gallery, and
// generation flows across the whole app) sits physically adjacent to this
// section in the original file but was deliberately LEFT in index.html,
// not bundled in here — same reasoning as pIcon()/PI_PATHS: it's genuinely
// shared infrastructure, not Assets-specific, even though it happened to
// be written right next to this code.
//
// One real external caller: renderAssets() gets called from that Cross-
// Module Picker (staying in index.html) to refresh the view after certain
// actions — resolves fine via plain global window scope, same pattern
// proven safe by every prior extraction with real callers.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

// ── ASSETS ──
function renderAssets(el){
  if((S.assetLibraryView||"all")==="collections"){
    renderCollectionsView(el);
    return;
  }
  const uploads=S.uploads||[];
  const filter=S.assetFilter||"all";
  const tagFilter=S.assetTagFilter||"";
  const allTags=[...new Set(uploads.flatMap(u=>u.tags||[]))].sort();
  let filtered=filter==="all"?uploads:uploads.filter(u=>u.kind===filter);
  if(tagFilter)filtered=filtered.filter(u=>(u.tags||[]).includes(tagFilter));
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">Asset Library</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${uploads.length} uploaded file${uploads.length!==1?'s':''} — reference images, brand assets, audio beds</div>
      </div>
      <div style="display:flex;gap:6px">
        <input type="file" id="assetUploadInput" accept="image/*,audio/*" multiple style="display:none" onchange="handleAssetUpload(event)">
        <button class="btn btn-outline btn-sm" ${filtered.length===0?'disabled':''} onclick="downloadAssetsZip()">📦 Download ZIP</button>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('assetUploadInput').click()">+ Upload File</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      <button class="btn ${filter==='all'?'btn-primary':'btn-outline'} btn-xs" onclick="setAssetFilter('all')">All</button>
      <button class="btn ${filter==='image'?'btn-primary':'btn-outline'} btn-xs" onclick="setAssetFilter('image')">🖼 Images</button>
      <button class="btn ${filter==='audio'?'btn-primary':'btn-outline'} btn-xs" onclick="setAssetFilter('audio')">🎵 Audio</button>
    </div>
    ${allTags.length?`<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn ${!tagFilter?'btn-primary':'btn-outline'} btn-xs" onclick="setAssetTagFilter('')">🏷 All Tags</button>
      ${allTags.map(t=>`<button class="btn ${tagFilter===t?'btn-primary':'btn-outline'} btn-xs" onclick="setAssetTagFilter('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('')}
    </div>`:''}
    ${filtered.length===0?`<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No Uploads Yet</div><div class="empty-desc">Upload reference images, brand logos, or audio beds to use across your projects. (For AI-generated content, check the Gallery instead.)</div><button class="btn btn-primary" onclick="document.getElementById('assetUploadInput').click()">+ Upload File</button></div>`
    :`<div class="grid3">${filtered.map(u=>assetCardHTML(u)).join('')}</div>`}
  `;
}

function setAssetFilter(f){
  S.assetFilter=f;
  renderAssets(document.getElementById("moduleContent"));
}

function setAssetTagFilter(t){
  S.assetTagFilter=t;
  renderAssets(document.getElementById("moduleContent"));
}

// ══════════════════════════════════════════════════════
// COLLECTIONS — real, not decorative. Organizes both uploaded
// reference files AND generated content (images/video/audio)
// from any module, since everything generated funnels into
// Gallery (S.assets) regardless of which module made it.
// ══════════════════════════════════════════════════════

function getCollectionItem(type,id){
  if(type==="upload")return (S.uploads||[]).find(x=>x.id===id);
  return (S.assets||[]).find(x=>x.id===id);
}

function renderCollectionsView(el){
  const collections=S.collections||[];
  const activeId=S.activeCollectionId;
  const active=activeId?collections.find(c=>c.id===activeId):null;

  if(active){
    el.innerHTML=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <button class="btn btn-ghost btn-sm" onclick="S.activeCollectionId=null;renderModule('assets')">← Collections</button>
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);flex:1">📁 ${active.name}</div>
        <button class="btn btn-outline btn-xs" onclick="renameCollectionPrompt('${active.id}')">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="deleteCollectionConfirm('${active.id}')">🗑</button>
      </div>
      ${active.items.length===0?`<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">Empty Collection</div><div class="empty-desc">Add items from Asset Library or Gallery using the 📁 button on any item.</div></div>`
      :`<div class="grid3">${active.items.map(item=>{
        const obj=getCollectionItem(item.type,item.id);
        if(!obj)return'';
        const url=item.type==="upload"?obj.data:obj.url;
        const label=item.type==="upload"?obj.name:(obj.prompt||"Untitled");
        const media=(item.type==="upload"?obj.kind:obj.type)==="image"?`<img src="${url}" style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover">`
          :(item.type==="upload"?obj.kind:obj.type)==="video"?`<video src="${url}" style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover" muted></video>`
          :`<div style="background:rgba(61,31,122,0.06);border-radius:8px;padding:20px;text-align:center;font-size:24px">🎵</div>`;
        return `<div class="card" style="padding:8px">
          ${media}
          <div style="font-size:10px;color:var(--textm);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</div>
          <button class="btn btn-outline btn-xs btn-full" style="margin-top:6px" onclick="removeItemFromCollection('${active.id}','${item.type}','${item.id}')">✕ Remove</button>
        </div>`;
      }).join('')}</div>`}
    `;
    return;
  }

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">📁 Collections</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${collections.length} collection${collections.length!==1?'s':''} — organizes uploads and generated content from every module</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="createCollectionPrompt()">+ New</button>
    </div>
    ${collections.length===0?`<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-title">No Collections Yet</div><div class="empty-desc">Create one, then add items to it from Asset Library, Gallery, or right after generating something in Image Gen, Video Canvas, Home, and more.</div><button class="btn btn-primary" onclick="createCollectionPrompt()">+ Create First Collection</button></div>`
    :`<div class="grid2">${collections.map(c=>{
      const firstItem=c.items[0];
      const firstObj=firstItem?getCollectionItem(firstItem.type,firstItem.id):null;
      const thumbUrl=firstObj?(firstItem.type==="upload"?firstObj.data:firstObj.url):null;
      return `<div class="card" style="cursor:pointer" onclick="S.activeCollectionId='${c.id}';renderModule('assets')">
        ${thumbUrl&&(firstItem.type==="upload"?firstObj.kind:firstObj.type)!=="audio"?`<img src="${thumbUrl}" style="width:100%;border-radius:8px;aspect-ratio:16/9;object-fit:cover;margin-bottom:8px">`:`<div style="width:100%;aspect-ratio:16/9;background:var(--lav);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:8px">📁</div>`}
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet)">${c.name}</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${c.items.length} item${c.items.length!==1?'s':''}</div>
      </div>`;
    }).join('')}</div>`}
  `;
}

async function createCollectionPrompt(){
  const name=await showPromptDialog("","",{title:"Name This Collection",okLabel:"Create"});
  if(!name||!name.trim())return;
  const collection={id:"col_"+Date.now(),name:name.trim(),created:new Date().toISOString(),items:[]};
  S.collections.push(collection);
  save("collections");
  toast(`📁 "${name}" created`,"success");
  renderModule("assets");
}

async function renameCollectionPrompt(id){
  const c=S.collections.find(x=>x.id===id);
  if(!c)return;
  const name=await showPromptDialog("",c.name,{title:"Rename Collection",okLabel:"Rename"});
  if(!name||!name.trim())return;
  c.name=name.trim();
  save("collections");
  renderModule("assets");
}

async function deleteCollectionConfirm(id){
  if(!(await showConfirmDialog("Delete this collection? Items inside it (uploads/gallery assets) are NOT deleted, only the collection itself.",{danger:true,okLabel:"Delete Collection"})))return;
  S.collections=S.collections.filter(c=>c.id!==id);
  S.activeCollectionId=null;
  save("collections");
  renderModule("assets");
  toast("Collection deleted","");
}

function removeItemFromCollection(collectionId,type,itemId){
  const c=S.collections.find(x=>x.id===collectionId);
  if(!c)return;
  c.items=c.items.filter(i=>!(i.type===type&&i.id===itemId));
  save("collections");
  renderModule("assets");
}


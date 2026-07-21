// ══════════════════════════════════════════════════════════════════════
// GALLERY MODULE — twelfth extraction from index.html (module split phase
// 12). Plain global script, not an ES module.
//
// Same situation as assets.js: the Cross-Module Picker sits physically
// adjacent (between Assets and Gallery in the original file) but is
// genuinely shared infrastructure used by multiple modules, so it stays in
// index.html rather than getting bundled into either Assets or Gallery.
//
// One real external caller: renderGallery() gets called from deleteAsset()
// (staying in index.html, part of the shared asset-management code after
// Gallery's own section) to refresh the view after a deletion.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

// ── GALLERY ──
function renderGallery(el){
  const filter=S.galleryFilter||"all";
  const reviewFilter=S.galleryReviewFilter||"all";
  let allAssets=[...S.assets].reverse();
  let filtered=filter==="all"?allAssets:allAssets.filter(a=>a.type===filter);
  if(reviewFilter!=="all")filtered=filtered.filter(a=>(a.review?.status||"unreviewed")===reviewFilter);
  const counts={all:S.assets.length,image:S.assets.filter(a=>a.type==='image').length,video:S.assets.filter(a=>a.type==='video').length,audio:S.assets.filter(a=>a.type==='audio').length};
  const compareSelection=S.gallerySelectedForCompare||[];

  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">Gallery</div>
        <div style="font-size:11px;color:var(--textm);margin-top:2px">${S.assets.length} generation${S.assets.length!==1?'s':''} saved</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" ${filtered.length===0?'disabled':''} onclick="downloadGalleryZip()">📦 ZIP</button>
        ${compareSelection.length>=2?`<button class="btn btn-primary btn-sm" onclick="compareGalleryAssets()">🆚 Compare (${compareSelection.length})</button>`:''}
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <button class="btn ${filter==='all'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryFilter('all')">All (${counts.all})</button>
      <button class="btn ${filter==='image'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryFilter('image')">🖼 Images (${counts.image})</button>
      <button class="btn ${filter==='video'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryFilter('video')">🎬 Videos (${counts.video})</button>
      <button class="btn ${filter==='audio'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryFilter('audio')">🎵 Audio (${counts.audio})</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <button class="btn ${reviewFilter==='all'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryReviewFilter('all')">All Statuses</button>
      <button class="btn ${reviewFilter==='approved'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryReviewFilter('approved')">✅ Approved</button>
      <button class="btn ${reviewFilter==='rejected'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryReviewFilter('rejected')">❌ Rejected</button>
      <button class="btn ${reviewFilter==='unreviewed'?'btn-primary':'btn-outline'} btn-xs" onclick="setGalleryReviewFilter('unreviewed')">⬜ Unreviewed</button>
    </div>
    ${filtered.length===0?`<div class="empty-state"><div class="empty-icon">🎞</div><div class="empty-title">${filter==='all'?'No Generations Yet':'Nothing matches this filter'}</div><div class="empty-desc">Generated images, videos, and voiceovers you save will appear here.</div></div>`
    :`<div class="grid-gallery">${filtered.map(a=>galleryCardHTML(a)).join('')}</div>`}
  `;
}

function setGalleryFilter(f){
  S.galleryFilter=f;
  renderGallery(document.getElementById("moduleContent"));
}

function setGalleryReviewFilter(f){
  S.galleryReviewFilter=f;
  renderGallery(document.getElementById("moduleContent"));
}

function galleryCardHTML(a){
  const proj=a.projectId?S.projects.find(p=>p.id===a.projectId):null;
  const icon=a.type==='image'?'🖼':a.type==='video'?'🎬':'🎵';
  let media="";
  if(a.type==='image')media=`<img src="${a.url}" style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover;display:block">`;
  // `max-height` and `aspect-ratio` used to be set together here, which
  // fight each other on a <video> element once the column gets wider than
  // ~280px (a 16:9 box at 100% width naturally wants to be taller than
  // 160px, so the two constraints disagreed on the real box height and
  // the video rendered stretched/oversized instead of a clean 16:9 crop).
  // aspect-ratio alone is enough — it already caps the height relative to
  // whatever width the (now responsive) grid column gives it.
  else if(a.type==='video')media=`<video src="${a.url}" controls preload="metadata" style="width:100%;border-radius:8px;aspect-ratio:16/9;object-fit:cover;background:#000;display:block"></video>`;
  else media=`<div style="background:rgba(61,31,122,0.06);border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:center;font-size:28px">🎵</div><audio src="${a.url}" controls style="width:100%;margin-top:6px;height:32px"></audio>`;
  const review=a.review||{status:null,rating:0};
  const isSelected=(S.gallerySelectedForCompare||[]).includes(a.id);
  return `
    <div class="card" style="padding:8px;${isSelected?'border:2px solid var(--violet)':''}">
      ${media}
      <div style="font-size:10px;color:var(--textm);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(a.prompt||'').replace(/"/g,'&quot;')}">${icon} ${a.prompt||'Untitled'}</div>
      ${proj?`<div style="font-size:9px;color:var(--gold);margin-top:2px">📂 ${proj.name}</div>`:''}
      <div style="display:flex;gap:2px;margin-top:5px">
        ${[1,2,3,4,5].map(n=>`<span style="cursor:pointer;font-size:12px;color:${review.rating>=n?'var(--gold)':'var(--border)'}" onclick="setAssetRating('${a.id}',${n})">★</span>`).join('')}
      </div>
      <div style="display:flex;gap:3px;margin-top:5px">
        <button class="btn ${review.status==='approved'?'btn-primary':'btn-outline'} btn-xs" style="flex:1;padding:3px" onclick="setAssetReviewStatus('${a.id}','approved')" title="Approve">✅</button>
        <button class="btn ${review.status==='rejected'?'btn-danger':'btn-outline'} btn-xs" style="flex:1;padding:3px" onclick="setAssetReviewStatus('${a.id}','rejected')" title="Reject">❌</button>
        <button class="btn btn-outline btn-xs" style="flex:1;padding:3px" onclick="regenerateAsset('${a.id}')" title="Regenerate">🔄</button>
      </div>
      <div style="display:flex;gap:3px;margin-top:3px">
        <button class="btn ${isSelected?'btn-primary':'btn-outline'} btn-xs" style="flex:1" onclick="toggleCompareSelect('${a.id}')">${isSelected?'✓ Selected':'Select'}</button>
        <button class="vc-result-icon-btn" style="width:28px;height:28px;border-radius:8px" title="Add to Collection" onclick="openCollectionPicker('asset','${a.id}')">${VC_RESULT_ICONS.collection}</button>
        <button class="vc-result-icon-btn" style="width:28px;height:28px;border-radius:8px" title="Download" onclick="downloadWithName('${a.url.replace(/'/g,"\\'")}','KosmicKat_${sanitizeFilenamePart(a.prompt)}.${a.type==='video'?'mp4':a.type==='audio'?'mp3':'png'}')">${VC_RESULT_ICONS.download}</button>
        <button class="vc-result-icon-btn" style="width:28px;height:28px;border-radius:8px" title="Details" onclick="openGenerationInfoModal({prompt:'${(a.prompt||'').replace(/'/g,"\\'").replace(/\n/g,' ')}',providerLabel:a.type,resolution:''})">${VC_RESULT_ICONS.info}</button>
        <button class="btn btn-danger btn-xs" onclick="deleteAsset('${a.id}')">🗑</button>
      </div>
    </div>`;
}

function setAssetRating(id,rating){
  const a=S.assets.find(x=>x.id===id);
  if(!a)return;
  a.review=a.review||{};
  a.review.rating=(a.review.rating===rating)?0:rating; // click same star again to clear
  save("assets");
  renderGallery(document.getElementById("moduleContent"));
}

function setAssetReviewStatus(id,status){
  const a=S.assets.find(x=>x.id===id);
  if(!a)return;
  a.review=a.review||{};
  a.review.status=(a.review.status===status)?null:status;
  save("assets");
  renderGallery(document.getElementById("moduleContent"));
  toast(a.review.status?`Marked ${a.review.status}`:"Review status cleared","");
}

function toggleCompareSelect(id){
  S.gallerySelectedForCompare=S.gallerySelectedForCompare||[];
  const a=S.assets.find(x=>x.id===id);
  if(!a)return;
  const idx=S.gallerySelectedForCompare.indexOf(id);
  if(idx>=0){
    S.gallerySelectedForCompare.splice(idx,1);
  } else {
    // Keep comparisons meaningful — only compare same media type
    const existingTypes=S.gallerySelectedForCompare.map(sid=>S.assets.find(x=>x.id===sid)?.type);
    if(existingTypes.length&&!existingTypes.includes(a.type)){
      toast("Can only compare items of the same type (image/video/audio)","error");
      return;
    }
    S.gallerySelectedForCompare.push(id);
  }
  renderGallery(document.getElementById("moduleContent"));
}

function compareGalleryAssets(){
  const ids=S.gallerySelectedForCompare||[];
  if(ids.length<2)return;
  const items=ids.map(id=>S.assets.find(a=>a.id===id)).filter(Boolean);
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.id="galleryCompareModal";
  overlay.innerHTML=`
    <div class="modal" style="max-width:900px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet)">🆚 Compare</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('galleryCompareModal').remove();S.gallerySelectedForCompare=[];renderGallery(document.getElementById('moduleContent'))">✕ Close</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;max-height:70vh;overflow-y:auto">
        ${items.map(a=>{
          let media="";
          if(a.type==='image')media=`<img src="${a.url}" style="width:100%;border-radius:8px">`;
          else if(a.type==='video')media=`<video src="${a.url}" controls style="width:100%;border-radius:8px"></video>`;
          else media=`<audio src="${a.url}" controls style="width:100%"></audio>`;
          return `<div class="panel" style="padding:10px">${media}<div style="font-size:11px;color:var(--textm);margin-top:8px">${a.prompt||'Untitled'}</div></div>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}


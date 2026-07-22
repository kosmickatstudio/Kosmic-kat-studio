// ══════════════════════════════════════════════════════════════════════
// DISPLAY AREA MODULE — seventh extraction from index.html (module split
// phase 7). Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. This one
// has genuinely BIDIRECTIONAL coupling with Home (which stays in
// index.html) — more interconnected than any prior extraction:
// - Home's "+ Add Content" buttons call openDisplayContentModal() (defined
//   here), and Home's own init calls loadDisplayItemsFromCloud() (here).
// - This module's insertPixverseBanner() calls back INTO renderHomeCarousel()
//   (defined in index.html's Home section, NOT extracted).
// Both directions resolve fine via plain global window scope, same
// principle as every prior extraction — just noting this one has real
// two-way calls, not just one-way.
// ══════════════════════════════════════════════════════════════════════

// ── DISPLAY AREA ──
function clearDisplay(){
  if(!isFounderUser()){toast("Only founders can change what visitors see on Home","error");return;}
  S.displayItems=[];
  S.displayIndex=0;
  saveSetting("display_items",[]);
  renderHomeCarousel();
  syncDisplayItemsToCloud();
}

// ── DISPLAY AREA — real content system, lives only on Home now ──
S.displayIndex=S.displayIndex||0;

function openDisplayContentModal(){
  const hasAffiliateLink=!!gs("pixverse_link","");
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.id="displayContentModal";
  overlay.innerHTML=`
    <div class="modal">
      <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);margin-bottom:14px">+ Add Display Content</div>
      <div class="f-group">
        <label class="f-label">Type</label>
        <select class="f-select" id="dcType" onchange="updateDisplayContentFields()">
          <option value="upload">📤 Upload from Device</option>
          <option value="image">Image URL</option>
          <option value="video">Video URL (MP4)</option>
          <option value="youtube">YouTube URL</option>
          <option value="html">Custom HTML Embed</option>
        </select>
      </div>
      <div class="f-group" id="dcUploadWrap">
        <input type="file" accept="image/*,video/*" id="dcUploadFile" style="display:none" onchange="handleDisplayUpload(event)">
        <div onclick="document.getElementById('dcUploadFile').click()" style="border:2px dashed var(--border);border-radius:14px;padding:20px 10px;text-align:center;cursor:pointer;background:rgba(61,31,122,0.02)">
          <div style="font-size:24px">📤</div>
          <div style="font-size:12px;font-weight:600;color:var(--violet);margin-top:6px" id="dcUploadLabel">Browse your device's photos & videos</div>
        </div>
      </div>
      <div class="f-group" id="dcUrlWrap" style="display:none">
        <label class="f-label">URL</label>
        <input class="f-input" id="dcUrl" placeholder="https://…">
      </div>
      <div class="f-group" id="dcHtmlWrap" style="display:none">
        <label class="f-label">HTML</label>
        <textarea class="f-textarea" id="dcHtml" style="min-height:80px" placeholder="<div>Your ad embed HTML…</div>"></textarea>
      </div>
      ${hasAffiliateLink?`<button class="btn btn-outline btn-sm btn-full" style="margin-bottom:10px" onclick="insertPixverseBanner()">⚡ Quick-Insert PixVerse Affiliate Banner</button>`:''}
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('displayContentModal').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="addDisplayContent()">+ Add</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function updateDisplayContentFields(){
  const type=document.getElementById("dcType").value;
  document.getElementById("dcUploadWrap").style.display=type==="upload"?"block":"none";
  document.getElementById("dcUrlWrap").style.display=(type==="html"||type==="upload")?"none":"block";
  document.getElementById("dcHtmlWrap").style.display=type==="html"?"block":"none";
}

S.dcUploadedDataUrl=null;
S.dcUploadedType=null;
S.dcUploadedFile=null;
function handleDisplayUpload(event){
  const file=event.target.files[0];
  if(!file)return;
  S.dcUploadedFile=file;
  const sizeMB=(file.size/(1024*1024)).toFixed(1);
  if(file.size>20*1024*1024){
    toast(`⚠️ ${sizeMB}MB — large file, this may take a while to upload on a slow connection`,"");
  }
  const reader=new FileReader();
  reader.onload=e=>{
    S.dcUploadedDataUrl=e.target.result;
    S.dcUploadedType=file.type.startsWith("video/")?"video":"image";
    document.getElementById("dcUploadLabel").textContent=`✓ ${file.name} (${sizeMB}MB)`;
  };
  reader.readAsDataURL(file);
}

async function addDisplayContent(){
  if(!isFounderUser()){toast("Only founders can change what visitors see on Home","error");return;}
  const type=document.getElementById("dcType").value;
  const addBtn=document.querySelector("#displayContentModal .btn-primary");
  let item={id:"disp_"+Date.now(),type};
  if(type==="upload"){
    if(!S.dcUploadedFile){toast("Choose a file from your device first","error");return;}
    // Storage Rules require request.auth != null — if the sign-in state
    // isn't actually established (still "guest," or the Firebase Auth
    // session hasn't resolved), this upload WILL get denied. Every other
    // upload in this app (rehostToStorage) has silently skipped the real
    // Storage write in that exact situation and fallen back to the
    // original provider URL instead — which still displays/plays fine, so
    // it never surfaced as a visible failure. This path has no such
    // fallback, so it's likely the only place actually exposing this.
    if(!S.user||S.user.email==="guest"||!S.user.uid){
      toast(`❌ Not signed in with a real account (currently: ${S.user?S.user.email:'none'}) — sign in with Google in Settings first, Storage Rules require it`,"error");
      return;
    }
    try{
      if(addBtn){addBtn.disabled=true;addBtn.textContent="Uploading… 0%";}
      const path=`home-display/${Date.now()}_${S.dcUploadedFile.name}`;
      const ref=fbStorage.ref(path);
      // Real progress, not a static "Uploading…" label — on a slow connection
      // a large video file with zero visible progress just looks frozen/
      // broken, which is very likely what was actually happening rather than
      // a genuine upload failure.
      const uploadTask=ref.put(S.dcUploadedFile);
      let lastProgressAt=Date.now();
      await Promise.race([
        new Promise((resolve,reject)=>{
          uploadTask.on("state_changed",
            snap=>{
              lastProgressAt=Date.now();
              const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
              if(addBtn)addBtn.textContent=`Uploading… ${pct}%`;
            },
            err=>reject(err),
            ()=>resolve()
          );
        }),
        // Watchdog: if genuinely stuck (no progress event at all, or none for
        // 30s straight — a real network/permissions issue, not just a slow
        // connection actually still moving), cancel and fail clearly instead
        // of leaving this frozen at 0% forever with zero feedback.
        new Promise((_,reject)=>{
          const check=setInterval(()=>{
            if(Date.now()-lastProgressAt>30000){
              clearInterval(check);
              uploadTask.cancel();
              reject(new Error("Upload stalled for 30+ seconds with no progress — likely a network or storage permissions issue, not just slowness. Try again or check your connection."));
            }
          },2000);
        }),
      ]);
      item.type=S.dcUploadedType;
      item.url=await ref.getDownloadURL();
      item.storagePath=path;
    }catch(err){
      toast("Upload failed: "+err.message,"error");
      if(addBtn){addBtn.disabled=false;addBtn.textContent="+ Add";}
      return;
    }
    S.dcUploadedDataUrl=null;S.dcUploadedType=null;S.dcUploadedFile=null;
  } else if(type==="html"){
    const html=document.getElementById("dcHtml").value.trim();
    if(!html){toast("Paste some HTML first","error");return;}
    item.html=html;
  } else {
    const url=document.getElementById("dcUrl").value.trim();
    if(!url){toast("Enter a URL first","error");return;}
    if(type==="youtube"){
      const idMatch=url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([a-zA-Z0-9_-]{11})/);
      if(!idMatch){toast("Couldn't parse a YouTube video ID from that URL","error");return;}
      item.youtubeId=idMatch[1];
    } else {
      item.url=url;
    }
  }
  S.displayItems.push(item);
  saveSetting("display_items",S.displayItems);
  S.displayIndex=S.displayItems.length-1;
  await syncDisplayItemsToCloud();
  document.getElementById("displayContentModal").remove();
  renderHomeCarousel();
  toast("✅ Added — visible to every visitor on Home now","success");
}

// Home display content is shared publicly (Firestore doc + Storage files) so
// every visitor sees the same banner/video, not just the device that uploaded
// it. Requires Firestore + Storage enabled in the Firebase console with rules
// allowing public read and founder-only write on 'public/homeDisplay' and the
// 'home-display/' storage path.
async function syncDisplayItemsToCloud(){
  try{
    await fbDB.collection("public").doc("homeDisplay").set({items:S.displayItems,updatedAt:Date.now()});
  }catch(err){
    console.warn("Cloud sync failed — content saved locally only:",err.message);
    toast("⚠️ Saved on this device, but cloud sync failed so other visitors won't see it yet — Firestore may need to be enabled in Firebase Console.","error");
  }
}
async function loadDisplayItemsFromCloud(){
  try{
    const doc=await fbDB.collection("public").doc("homeDisplay").get();
    if(doc.exists){
      const data=doc.data();
      if(Array.isArray(data.items)){
        S.displayItems=data.items;
        if(S.displayIndex>=S.displayItems.length)S.displayIndex=0;
        saveSetting("display_items",S.displayItems);
        renderHomeCarousel();
      }
    }
  }catch(err){
    console.warn("Couldn't load shared Home display from cloud — showing local cache:",err.message);
  }
}

function insertPixverseBanner(){
  const link=gs("pixverse_link","");
  if(!link){toast("Add your PixVerse affiliate link in Settings first","error");return;}
  const item={id:"disp_"+Date.now(),type:"html",html:`<a href="${link}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;text-decoration:none;font-family:'Cinzel',serif;font-weight:700;font-size:16px;border-radius:12px">⚡ Try PixVerse — AI Video Generation</a>`};
  S.displayItems.push(item);
  saveSetting("display_items",S.displayItems);
  S.displayIndex=S.displayItems.length-1;
  document.getElementById("displayContentModal")?.remove();
  renderHomeCarousel();
  toast("✅ PixVerse banner added","success");
}


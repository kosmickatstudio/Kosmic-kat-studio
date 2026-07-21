// ══════════════════════════════════════════════════════════════════════
// VIDEO EDITOR MODULE — third extraction from index.html (module split
// phase 3). Plain global script, not an ES module.
//
// LOAD ORDER: must load AFTER index.html's main inline script. One real
// external caller exists (unlike audio.js/adstudio.js, which had none):
// finalizeProductionToEditor() in the main script calls normalizeSequence()
// (defined here) when pushing approved Production Pipeline clips into the
// editor sequence. Still safe with plain global scripts — normalizeSequence
// resolves fine via window scope as long as this file has loaded by the
// time a user can actually click "Finalize to Video Editor", which is
// guaranteed since that requires the whole page (all script tags) to have
// already loaded first.
// ══════════════════════════════════════════════════════════════════════

// ── EDITOR ──
function renderEditor(el){
  const videos=S.assets.filter(a=>a.type==='video');
  const sequence=normalizeSequence(S.editorSequence||[]);
  el.innerHTML=`
    <div class="panel">
      <div class="panel-title">✂️ Video Sequencer</div>
      <div style="font-size:12px;color:var(--textm);margin-bottom:14px">Arrange your generated clips into a sequence with per-clip trim points and fade transitions, then preview them back-to-back. For frame-accurate cutting and real MP4 export, use a dedicated editor (CapCut, Premiere, DaVinci) with your downloaded clips — a full browser-based export engine isn't reliable enough to ship honestly, especially on mobile.</div>
      ${videos.length===0?`<div class="empty-state"><div class="empty-icon">🎬</div><div class="empty-title">No Videos Yet</div><div class="empty-desc">Generate videos in Video Canvas first, then arrange them here.</div></div>`:`
      <div style="font-size:11px;font-weight:700;color:var(--violet);margin-bottom:8px">AVAILABLE CLIPS</div>
      <div class="grid3" style="margin-bottom:16px">${videos.map(v=>`
        <div class="card" style="padding:6px;cursor:pointer" onclick="addToSequence('${v.id}')">
          <video src="${v.url}" style="width:100%;border-radius:6px;aspect-ratio:16/9" muted></video>
          <div style="font-size:9px;color:var(--textm);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.prompt||'Untitled'}</div>
          <button class="btn btn-outline btn-xs" style="width:100%;margin-top:4px">+ Add to Sequence</button>
        </div>`).join('')}</div>`}
      ${sequence.length?`
      <div style="font-size:11px;font-weight:700;color:var(--violet);margin-bottom:8px">SEQUENCE (${sequence.length} clip${sequence.length!==1?'s':''})</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">${sequence.map((item,i)=>{
        const v=S.assets.find(a=>a.id===item.id);
        if(!v)return'';
        return `<div style="background:rgba(61,31,122,0.04);border-radius:10px;padding:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;color:var(--gold);width:20px">${i+1}</span>
            <video src="${v.url}" style="width:60px;height:34px;border-radius:4px;object-fit:cover" muted></video>
            <span style="flex:1;font-size:11px;color:var(--textm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.prompt||'Untitled'}</span>
            <button class="pc-menu-btn" onclick="moveSeqItem(${i},-1)" ${i===0?'disabled style="opacity:0.3"':''}>↑</button>
            <button class="pc-menu-btn" onclick="moveSeqItem(${i},1)" ${i===sequence.length-1?'disabled style="opacity:0.3"':''}>↓</button>
            <button class="pc-menu-btn" onclick="removeSeqItem(${i})">✕</button>
          </div>
          <div class="f-row" style="margin-bottom:0">
            <div class="f-group" style="margin-bottom:0"><label class="f-label" style="font-size:10px">Trim Start: ${(item.trimStart||0).toFixed(1)}s</label><input type="range" min="0" max="30" step="0.5" value="${item.trimStart||0}" style="width:100%;--range-fill:${((item.trimStart||0)/30*100).toFixed(1)}%" oninput="updateSeqTrim(${i},'trimStart',this.value)"></div>
            <div class="f-group" style="margin-bottom:0"><label class="f-label" style="font-size:10px">Trim End: ${item.trimEnd===null?'Full':item.trimEnd.toFixed(1)+'s'}</label><input type="range" min="0" max="30" step="0.5" value="${item.trimEnd===null?30:item.trimEnd}" style="width:100%;--range-fill:${((item.trimEnd===null?30:item.trimEnd)/30*100).toFixed(1)}%" oninput="updateSeqTrim(${i},'trimEnd',this.value)"></div>
          </div>
          ${i<sequence.length-1?`<div class="f-group" style="margin:8px 0 0"><label class="f-label" style="font-size:10px">Transition to next clip</label><select class="f-select" onchange="updateSeqTransition(${i},this.value)"><option value="cut" ${item.transition==='cut'?'selected':''}>Cut</option><option value="fade" ${item.transition==='fade'?'selected':''}>Fade to Black</option></select></div>`:''}
        </div>`;
      }).join('')}</div>
      <button class="btn btn-primary btn-full" onclick="playSequence()">▶ Preview Sequence</button>
      <div id="seqPlayer" style="margin-top:12px"></div>
      `:''}
    </div>
  `;
}

// Old sequences stored plain string IDs — normalize to objects with trim/transition metadata
function normalizeSequence(seq){
  const normalized=seq.map(item=>typeof item==="string"?{id:item,trimStart:0,trimEnd:null,transition:"cut"}:item);
  if(JSON.stringify(normalized)!==JSON.stringify(seq)){S.editorSequence=normalized;save("editorSequence");}
  return normalized;
}

function addToSequence(assetId){
  if(!S.editorSequence)S.editorSequence=[];
  S.editorSequence=normalizeSequence(S.editorSequence);
  S.editorSequence.push({id:assetId,trimStart:0,trimEnd:null,transition:"cut"});
  save("editorSequence");
  toast("Added to sequence","success");
  renderEditor(document.getElementById("moduleContent"));
}

function updateSeqTrim(i,field,value){
  const seq=normalizeSequence(S.editorSequence);
  seq[i][field]=parseFloat(value);
  save("editorSequence");
  renderEditor(document.getElementById("moduleContent"));
}

function updateSeqTransition(i,value){
  const seq=normalizeSequence(S.editorSequence);
  seq[i].transition=value;
  save("editorSequence");
}

function moveSeqItem(i,dir){
  const seq=S.editorSequence;
  const j=i+dir;
  if(j<0||j>=seq.length)return;
  [seq[i],seq[j]]=[seq[j],seq[i]];
  save("editorSequence");
  renderEditor(document.getElementById("moduleContent"));
}

function removeSeqItem(i){
  S.editorSequence.splice(i,1);
  save("editorSequence");
  renderEditor(document.getElementById("moduleContent"));
}

function playSequence(){
  const seq=normalizeSequence(S.editorSequence||[]);
  if(!seq.length)return;
  let idx=0;
  const player=document.getElementById("seqPlayer");
  player.innerHTML=`<video id="seqVideoEl" controls autoplay style="width:100%;border-radius:10px;transition:opacity 0.4s"></video><div id="seqStatus" style="font-size:11px;color:var(--textm);margin-top:6px;text-align:center"></div>`;
  const vidEl=document.getElementById("seqVideoEl");
  const statusEl=document.getElementById("seqStatus");

  function playClip(i){
    const item=seq[i];
    const asset=S.assets.find(a=>a.id===item.id);
    if(!asset){advance();return;}
    vidEl.style.opacity="1";
    vidEl.src=asset.url;
    statusEl.textContent=`Playing clip ${i+1} of ${seq.length}${item.trimStart||item.trimEnd!==null?' (trimmed)':''}`;
    vidEl.onloadedmetadata=()=>{
      if(item.trimStart)vidEl.currentTime=item.trimStart;
      vidEl.play();
    };
    vidEl.ontimeupdate=()=>{
      const effectiveEnd=item.trimEnd!==null?item.trimEnd:vidEl.duration;
      if(vidEl.currentTime>=effectiveEnd-0.05){
        vidEl.ontimeupdate=null;
        advance(item.transition);
      }
    };
  }

  function advance(transition){
    idx++;
    if(idx>=seq.length){
      statusEl.textContent="Sequence complete";
      return;
    }
    if(transition==="fade"){
      vidEl.style.opacity="0";
      setTimeout(()=>playClip(idx),420);
    } else {
      playClip(idx);
    }
  }

  playClip(0);
}


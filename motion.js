// ══════════════════════════════════════════════════════════════════════
// MOTION CONTROL MODULE (Kling Motion Brush) — tenth extraction from
// index.html (module split phase 10). Plain global script, not an ES
// module. The most interconnected extraction so far — real, deliberate
// judgment call on the boundary, not a blind cut.
//
// The original file's own section marker comment covered a wider range
// than what actually belongs here: it also enclosed 4 lines of Video
// Canvas's OWN general reference-state (S.vcMultiVideos, S.vcMultiAudios,
// S.vcEndFrame, S.vcElementGroupMode) that are topically unrelated to
// Motion Brush and were deliberately LEFT in index.html rather than
// dragged along just because they sat nearby. Only S.mcImage/S.mcVideo
// (genuinely Motion-Control-specific, per the original comment explaining
// why they're separate from Video Canvas's array-based system) were moved.
//
// Real bidirectional coupling with Video Canvas (which stays in
// index.html), more than any prior extraction:
// - openMotionBrushEditor() and clearMotionBrush() (both defined here) are
//   called FROM Video Canvas in 5 total places.
// - clearMotionBrush() (defined here) calls back INTO
//   updateVcAttachmentBar() (defined in index.html's Video Canvas section).
// All three directions verified resolving correctly via plain global
// window scope, same principle as every prior extraction.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

// ── MOTION CONTROL MODULE — its own standalone state, separate from Video
// Canvas's shared reference-image system, since this module needs exactly
// 1 image + 1 video with fixed roles (appearance + motion), not a general
// multi-reference array.
S.mcImage=S.mcImage||null;
S.mcVideo=S.mcVideo||null;
// ══════════════════════════════════════════════════════
// KLING MOTION BRUSH — real canvas painting tool producing the exact
// static_mask_url / dynamic_masks[].mask_url + trajectories payload
// Kling's API expects (verified against fal.ai's actual schema).
// ══════════════════════════════════════════════════════
let mb={mode:"dynamic",drawing:false,brushSize:30,trajectory:[],baseImg:null,scaleX:1,scaleY:1};

function openMotionBrushEditor(){
  if(!S.vcMultiImages.length){toast("Upload a reference image first","error");return;}
  const overlay=document.createElement("div");
  overlay.className="modal-overlay show";
  overlay.id="motionBrushModal";
  overlay.style.padding="0";
  overlay.innerHTML=`
    <div style="width:100%;height:100%;background:#0a0a12;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#15111f;flex-shrink:0">
        <div style="color:#fff;font-weight:700;font-family:'Cinzel',serif;font-size:14px">🖌 Motion Brush</div>
        <button onclick="document.getElementById('motionBrushModal').remove()" style="width:30px;height:30px;border-radius:50%;border:none;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer">✕</button>
      </div>
      <div style="flex:1;position:relative;overflow:auto;display:flex;align-items:center;justify-content:center;padding:10px">
        <canvas id="mbCanvas" style="max-width:100%;max-height:100%;touch-action:none;border-radius:8px"></canvas>
      </div>
      <div style="padding:12px 16px;background:#15111f;flex-shrink:0;display:flex;flex-direction:column;gap:10px">
        <div id="mbHint" style="color:#c9b8ea;font-size:11px;line-height:1.5">Paint the area that should move, then switch to Motion Path and tap 2+ points to define the direction.</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" id="mbModeDynamic" style="flex:1;background:#ef4444;color:#fff;border:none" onclick="setMbMode('dynamic')">🔴 Dynamic Area</button>
          <button class="btn btn-sm" id="mbModeStatic" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:none" onclick="setMbMode('static')">🔵 Static Area</button>
          <button class="btn btn-sm" id="mbModeTrajectory" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:none" onclick="setMbMode('trajectory')">📍 Motion Path</button>
        </div>
        <div id="mbBrushWrap" style="display:flex;align-items:center;gap:8px">
          <span style="color:#c9b8ea;font-size:11px">Brush</span>
          <input type="range" id="mbBrushSize" min="10" max="100" value="30" style="flex:1;--range-fill:22.22%" oninput="mb.brushSize=parseInt(this.value)">
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" style="flex:1;color:#fff;border-color:rgba(255,255,255,0.3)" onclick="clearMbLayer()">Clear Current Layer</button>
          <button class="btn btn-outline btn-sm" style="flex:1;color:#fff;border-color:rgba(255,255,255,0.3)" onclick="undoMbTrajectoryPoint()">Undo Point</button>
        </div>
        <button class="btn btn-primary btn-full" onclick="saveMotionBrush()">✓ Done</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const img=new Image();
  img.onload=()=>{
    mb.baseImg=img;
    mb.trajectory=[];
    mb.mode="dynamic";
    const canvas=document.getElementById("mbCanvas");
    canvas.width=img.naturalWidth;
    canvas.height=img.naturalHeight;
    mb.dynamicCanvas=document.createElement("canvas");
    mb.dynamicCanvas.width=img.naturalWidth;mb.dynamicCanvas.height=img.naturalHeight;
    mb.dynamicCtx=mb.dynamicCanvas.getContext("2d");
    mb.dynamicCtx.fillStyle="#000";mb.dynamicCtx.fillRect(0,0,img.naturalWidth,img.naturalHeight);
    mb.staticCanvas=document.createElement("canvas");
    mb.staticCanvas.width=img.naturalWidth;mb.staticCanvas.height=img.naturalHeight;
    mb.staticCtx=mb.staticCanvas.getContext("2d");
    mb.staticCtx.fillStyle="#000";mb.staticCtx.fillRect(0,0,img.naturalWidth,img.naturalHeight);
    attachMbCanvasEvents(canvas);
    redrawMbCanvas();
  };
  img.src=S.vcMultiImages[0].dataUrl;
}

function setMbMode(mode){
  mb.mode=mode;
  ["Dynamic","Static","Trajectory"].forEach(m=>{
    const btn=document.getElementById(`mbMode${m}`);
    const active=m.toLowerCase()===mode;
    btn.style.background=active?(mode==="dynamic"?"#ef4444":mode==="static"?"#3b82f6":"#C9972A"):"rgba(255,255,255,0.1)";
  });
  document.getElementById("mbBrushWrap").style.display=mode==="trajectory"?"none":"flex";
  document.getElementById("mbHint").textContent=mode==="trajectory"
    ?"Tap 2 or more points on the image, in order, to trace the motion path."
    :`Paint the ${mode} area — ${mode==='dynamic'?'this region will move':'this region stays fixed even if nearby areas move'}.`;
}

function getMbCoords(e,canvas){
  const rect=canvas.getBoundingClientRect();
  const clientX=e.touches?e.touches[0].clientX:e.clientX;
  const clientY=e.touches?e.touches[0].clientY:e.clientY;
  const scaleX=canvas.width/rect.width;
  const scaleY=canvas.height/rect.height;
  return {x:Math.round((clientX-rect.left)*scaleX),y:Math.round((clientY-rect.top)*scaleY)};
}

function attachMbCanvasEvents(canvas){
  const start=e=>{
    e.preventDefault();
    const pt=getMbCoords(e,canvas);
    if(mb.mode==="trajectory"){
      mb.trajectory.push(pt);
      redrawMbCanvas();
      return;
    }
    mb.drawing=true;
    paintMbPoint(pt);
  };
  const move=e=>{
    if(!mb.drawing||mb.mode==="trajectory")return;
    e.preventDefault();
    paintMbPoint(getMbCoords(e,canvas));
  };
  const end=()=>{mb.drawing=false;};
  canvas.addEventListener("mousedown",start);
  canvas.addEventListener("mousemove",move);
  canvas.addEventListener("mouseup",end);
  canvas.addEventListener("mouseleave",end);
  canvas.addEventListener("touchstart",start,{passive:false});
  canvas.addEventListener("touchmove",move,{passive:false});
  canvas.addEventListener("touchend",end);
}

function paintMbPoint(pt){
  const ctx=mb.mode==="dynamic"?mb.dynamicCtx:mb.staticCtx;
  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.arc(pt.x,pt.y,mb.brushSize,0,Math.PI*2);
  ctx.fill();
  redrawMbCanvas();
}

function redrawMbCanvas(){
  const canvas=document.getElementById("mbCanvas");
  if(!canvas||!mb.baseImg)return;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(mb.baseImg,0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.globalAlpha=0.45;
  ctx.globalCompositeOperation="source-over";
  drawMaskOverlay(ctx,mb.dynamicCanvas,"#ef4444");
  drawMaskOverlay(ctx,mb.staticCanvas,"#3b82f6");
  ctx.restore();
  if(mb.trajectory.length){
    ctx.strokeStyle="#C9972A";ctx.lineWidth=Math.max(3,canvas.width*0.004);
    ctx.beginPath();
    mb.trajectory.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.stroke();
    mb.trajectory.forEach((p,i)=>{
      ctx.fillStyle="#C9972A";
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(10,canvas.width*0.012),0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#1a1025";ctx.font=`${Math.max(12,canvas.width*0.014)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(i+1,p.x,p.y);
    });
  }
}

function drawMaskOverlay(ctx,maskCanvas,color){
  const tmp=document.createElement("canvas");
  tmp.width=maskCanvas.width;tmp.height=maskCanvas.height;
  const tctx=tmp.getContext("2d");
  tctx.drawImage(maskCanvas,0,0);
  tctx.globalCompositeOperation="source-in";
  tctx.fillStyle=color;
  tctx.fillRect(0,0,tmp.width,tmp.height);
  ctx.drawImage(tmp,0,0);
}

function clearMbLayer(){
  if(mb.mode==="trajectory"){mb.trajectory=[];}
  else{const ctx=mb.mode==="dynamic"?mb.dynamicCtx:mb.staticCtx;ctx.fillStyle="#000";ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);}
  redrawMbCanvas();
}

function undoMbTrajectoryPoint(){
  mb.trajectory.pop();
  redrawMbCanvas();
}

function isMbCanvasBlank(canvas){
  const ctx=canvas.getContext("2d");
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=0;i<data.length;i+=4){if(data[i]>10)return false;}
  return true;
}

function saveMotionBrush(){
  if(mb.trajectory.length<2){toast("Add at least 2 motion path points first","error");return;}
  if(isMbCanvasBlank(mb.dynamicCanvas)){toast("Paint the dynamic (moving) area first","error");return;}
  S.vcMotionBrush={
    dynamicMaskUrl:mb.dynamicCanvas.toDataURL("image/png"),
    staticMaskUrl:isMbCanvasBlank(mb.staticCanvas)?null:mb.staticCanvas.toDataURL("image/png"),
    trajectories:mb.trajectory.slice(),
  };
  document.getElementById("motionBrushModal").remove();
  const statusEl=document.getElementById("vcMotionBrushStatus");
  if(statusEl)statusEl.textContent=`✓ Set — ${S.vcMotionBrush.trajectories.length} path points${S.vcMotionBrush.staticMaskUrl?', static area included':''}`;
  const clearBtn=document.getElementById("vcMotionBrushClearBtn");
  if(clearBtn)clearBtn.style.display="inline-flex";
  updateVcAttachmentBar();
  toast("🖌 Motion Brush set","success");
}

function clearMotionBrush(){
  S.vcMotionBrush=null;
  const statusEl=document.getElementById("vcMotionBrushStatus");
  if(statusEl)statusEl.textContent="Not set — uses the first reference image above as the base.";
  const clearBtn=document.getElementById("vcMotionBrushClearBtn");
  if(clearBtn)clearBtn.style.display="none";
  updateVcAttachmentBar();
}

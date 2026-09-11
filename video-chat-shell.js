/* KOSMIC KAT — Video Chat Shell
 * Phase 2: chat becomes the default Video surface while the existing generation
 * engine remains behind a compatibility mount. No provider request is created here.
 */
(function installKosmicVideoChatShell(){
  "use strict";
  if(window.__kosmicVideoChatShellInstalled)return;
  window.__kosmicVideoChatShellInstalled=true;

  const S=window.S||(window.S={});
  const st=()=>window.__kosmicVideoChatState;
  const esc=v=>String(v??"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[m]));
  const icons={send:"➤",plus:"＋",settings:"⚙",video:"▶",close:"×",image:"▧"};
  let originalRender=null;
  let installed=false;

  function injectCss(){
    if(document.getElementById("kk-video-chat-css"))return;
    const s=document.createElement("style");s.id="kk-video-chat-css";
    s.textContent=`
      .kk-video-chat{height:100%;min-height:0;display:flex;flex-direction:column;position:relative;overflow:hidden;background:radial-gradient(900px 420px at 15% 0%,rgba(98,64,176,.09),transparent 60%),radial-gradient(900px 420px at 100% 100%,rgba(74,169,217,.08),transparent 62%),var(--pearl,#faf8f5);color:var(--text,#1e1230);font-family:Inter,sans-serif}
      .kk-video-chat *{box-sizing:border-box}.kk-video-chat button,.kk-video-chat input,.kk-video-chat textarea{font:inherit}
      .kkvc-head{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid var(--glass-brd,rgba(61,31,122,.12));background:rgba(255,255,255,.48);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);flex-shrink:0}
      .kkvc-mark{width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff;font-size:17px;box-shadow:0 8px 26px rgba(61,31,122,.18)}
      .kkvc-title{font-size:15px;font-weight:850;letter-spacing:-.02em}.kkvc-sub{font-size:10px;color:var(--texts,#9488ae);margin-top:2px}.kkvc-model{margin-left:auto;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:800;padding:7px 10px;border-radius:999px;background:rgba(98,64,176,.08);color:var(--violet,#3d1f7a)}
      .kkvc-thread{flex:1;min-height:0;overflow:auto;padding:18px max(14px,4vw) 140px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
      .kkvc-welcome{margin:auto;max-width:620px;text-align:center;padding:28px 18px 12px}.kkvc-welcome h2{font-size:27px;letter-spacing:-.035em;margin-bottom:8px}.kkvc-welcome p{font-size:12px;line-height:1.65;color:var(--textm,#5a4880)}
      .kkvc-msg{max-width:min(760px,86%);display:flex;gap:9px;align-items:flex-start}.kkvc-msg.user{margin-left:auto;flex-direction:row-reverse}.kkvc-avatar{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(98,64,176,.10);color:var(--violet,#3d1f7a);font-size:13px;flex:0 0 auto}.kkvc-msg.user .kkvc-avatar{background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff}.kkvc-bubble{padding:11px 13px;border-radius:16px;background:rgba(255,255,255,.62);border:1px solid var(--glass-brd,rgba(61,31,122,.11));box-shadow:0 8px 26px rgba(61,31,122,.055);font-size:12px;line-height:1.55;white-space:pre-wrap}.kkvc-msg.user .kkvc-bubble{background:linear-gradient(135deg,rgba(98,64,176,.12),rgba(74,169,217,.10))}
      .kkvc-refrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.kkvc-ref{display:flex;align-items:center;gap:5px;padding:5px 7px;border-radius:9px;background:rgba(98,64,176,.07);border:1px solid var(--border,rgba(61,31,122,.1));font-size:8px;font-weight:800;color:var(--textm,#5a4880)}.kkvc-ref img{width:28px;height:28px;border-radius:6px;object-fit:cover}
      .kkvc-composer-wrap{position:absolute;left:0;right:0;bottom:0;padding:12px max(12px,3vw) 16px;background:linear-gradient(180deg,transparent,rgba(250,248,245,.88) 25%,rgba(250,248,245,.98));backdrop-filter:blur(10px)}
      .kkvc-composer{max-width:900px;margin:0 auto;padding:9px;border:1px solid var(--glass-brd,rgba(61,31,122,.15));border-radius:22px;background:rgba(255,255,255,.72);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 14px 40px rgba(61,31,122,.13)}
      .kkvc-preview{display:none;gap:7px;flex-wrap:wrap;padding:2px 4px 7px}.kkvc-preview.has{display:flex}.kkvc-preview-item{position:relative;width:58px;height:46px;border-radius:9px;overflow:hidden;border:1px solid var(--border,rgba(61,31,122,.1));background:var(--pearl2,#f3eff8)}.kkvc-preview-item img{width:100%;height:100%;object-fit:cover}.kkvc-preview-remove{position:absolute;top:2px;right:2px;width:17px;height:17px;border:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:10px;cursor:pointer}
      .kkvc-textrow{display:flex;align-items:flex-end;gap:8px}.kkvc-input{min-height:42px;max-height:150px;resize:none;flex:1;border:0;outline:0;background:transparent;color:var(--text,#1e1230);padding:10px 5px;font-size:13px;line-height:1.45}.kkvc-input::placeholder{color:var(--texts,#9488ae)}
      .kkvc-tool{width:37px;height:37px;flex:0 0 auto;border:1px solid var(--glass-brd,rgba(61,31,122,.12));border-radius:12px;background:rgba(255,255,255,.55);color:var(--textm,#5a4880);display:grid;place-items:center;cursor:pointer;transition:.18s}.kkvc-tool:hover{transform:translateY(-1px);background:rgba(98,64,176,.08);color:var(--violet,#3d1f7a)}
      .kkvc-send{width:39px;height:39px;border:0;border-radius:13px;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 7px 18px rgba(61,31,122,.2)}.kkvc-send:disabled{opacity:.45;cursor:not-allowed}
      .kkvc-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 4px 1px;font-size:8px;color:var(--texts,#9488ae)}.kkvc-meta strong{color:var(--textm,#5a4880)}.kkvc-file{display:none}
      .kkvc-director-note{display:none;position:absolute;top:64px;right:14px;z-index:8;padding:9px 11px;border-radius:12px;background:var(--glass-solid,#fff);border:1px solid var(--glass-brd,rgba(61,31,122,.14));box-shadow:0 10px 30px rgba(61,31,122,.14);font-size:9px;color:var(--textm,#5a4880)}
      .kk-video-legacy-mount{position:fixed;left:-100000px;top:-100000px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}
      @media(max-width:700px){.kkvc-head{padding:11px 12px}.kkvc-model{max-width:120px}.kkvc-title{font-size:14px}.kkvc-thread{padding:14px 10px 132px}.kkvc-msg{max-width:93%}.kkvc-welcome h2{font-size:23px}.kkvc-composer-wrap{padding:8px 8px 10px}.kkvc-composer{border-radius:18px}.kkvc-meta{font-size:7.5px}.kkvc-tool{width:35px;height:35px}.kkvc-send{width:37px;height:37px}}
    `;
    document.head.appendChild(s);
  }

  function host(){return document.getElementById("moduleContent")||document.querySelector(".module-content");}
  function routeLabel(){
    const v3=window.__kosmicVideoV3State;
    const v2=window.__kosmicVideoV2State;
    const route=(v3||v2)?.route||"seedance-2.5-text-to-video";
    const idx=window.KOSMIC_EVOLINK_VIDEO?.index||{};
    const item=idx[route];
    return item?.model?.name||item?.name||item?.label||route;
  }
  function createLegacyMount(){
    let m=document.getElementById("kk-video-legacy-mount");
    if(!m){m=document.createElement("div");m.id="kk-video-legacy-mount";m.className="kk-video-legacy-mount";document.body.appendChild(m);}
    return m;
  }
  function preserveLegacy(){
    const h=host();if(!h)return null;
    const m=createLegacyMount();
    while(h.firstChild)m.appendChild(h.firstChild);
    return m;
  }
  function restoreLegacyIntoHost(){
    const h=host(),m=document.getElementById("kk-video-legacy-mount");if(!h||!m)return;
    while(h.firstChild)h.removeChild(h.firstChild);
    while(m.firstChild)h.appendChild(m.firstChild);
  }
  function renderShell(){
    const h=host();if(!h)return;
    const q=st();
    h.innerHTML=`
      <div class="kk-video-chat" id="kkVideoChat" aria-label="Video conversation workspace">
        <div class="kkvc-head">
          <div class="kkvc-mark">${icons.video}</div>
          <div><div class="kkvc-title">Video</div><div class="kkvc-sub">Describe the shot. Refine it conversationally.</div></div>
          <div class="kkvc-model" id="kkvcModel">${esc(routeLabel())}</div>
          <button class="kkvc-tool" type="button" id="kkvcSettings" title="Director controls" aria-label="Open Director controls">${icons.settings}</button>
        </div>
        <div class="kkvc-thread" id="kkvcThread" aria-live="polite"></div>
        <div class="kkvc-director-note" id="kkvcDirectorNote">Director controls will be mounted here in Phase 4. Existing Video Canvas remains the execution surface underneath.</div>
        <div class="kkvc-composer-wrap">
          <div class="kkvc-composer">
            <div class="kkvc-preview" id="kkvcPreview"></div>
            <div class="kkvc-textrow">
              <button class="kkvc-tool" type="button" id="kkvcAttach" title="Add reference" aria-label="Add reference">${icons.plus}</button>
              <textarea id="kkvcInput" class="kkvc-input" rows="1" placeholder="Describe the video you want to create…"></textarea>
              <button class="kkvc-send" type="button" id="kkvcSend" title="Generate" aria-label="Generate">${icons.send}</button>
            </div>
            <div class="kkvc-meta"><span><strong id="kkvcRefCount">0</strong> references attached</span><span>Settings stay global • Director controls live separately</span></div>
            <input id="kkvcFile" class="kkvc-file" type="file" accept="image/*" multiple>
          </div>
        </div>
      </div>`;
    bind();renderMessages();q.syncLegacy&&q.syncLegacy();
  }

  function renderMessages(){
    const q=st(),thread=document.getElementById("kkvcThread");if(!thread)return;
    if(!q.messages.length){thread.innerHTML=`<div class="kkvc-welcome"><h2>What are we making?</h2><p>Start with the scene, action, mood, camera, or a rough idea. Add a reference when appearance matters. The conversation stays in context.</p></div>`;return;}
    thread.innerHTML=q.messages.map(m=>`<div class="kkvc-msg ${m.role==="user"?"user":"assistant"}"><div class="kkvc-avatar">${m.role==="user"?"You":"✦"}</div><div><div class="kkvc-bubble">${esc(m.content)}</div>${Array.isArray(m.meta?.references)&&m.meta.references.length?`<div class="kkvc-refrow">${m.meta.references.map(r=>`<div class="kkvc-ref"><img src="${esc(r.url)}" alt=""><span>${esc(r.name||"Reference")}</span></div>`).join("")}</div>`:""}</div></div>`).join("");
    thread.scrollTop=thread.scrollHeight;
  }

  function renderRefs(){
    const q=st(),wrap=document.getElementById("kkvcPreview"),count=document.getElementById("kkvcRefCount");if(!wrap)return;
    wrap.classList.toggle("has",q.references.length>0);count&&(count.textContent=q.references.length);
    wrap.innerHTML=q.references.map(r=>`<div class="kkvc-preview-item"><img src="${esc(r.url)}" alt="${esc(r.name||"Reference")}"><button type="button" class="kkvc-preview-remove" data-ref-id="${esc(r.id)}" aria-label="Remove reference">×</button></div>`).join("");
    wrap.querySelectorAll("[data-ref-id]").forEach(b=>b.addEventListener("click",()=>{q.removeReference(b.dataset.refId);renderRefs();q.syncLegacy&&q.syncLegacy();}));
  }

  function bind(){
    const q=st(),input=document.getElementById("kkvcInput"),send=document.getElementById("kkvcSend"),attach=document.getElementById("kkvcAttach"),file=document.getElementById("kkvcFile"),settings=document.getElementById("kkvcSettings");
    input.addEventListener("input",()=>{q.composerDraft=input.value;q.touch();q.syncLegacy&&q.syncLegacy();input.style.height="auto";input.style.height=Math.min(input.scrollHeight,150)+"px";send.disabled=!input.value.trim()&&q.references.length===0;});
    input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send.click();}});
    attach.addEventListener("click",()=>file.click());
    file.addEventListener("change",async()=>{for(const f of [...file.files||[]]){if(!f.type.startsWith("image/"))continue;const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});q.addReference({kind:"image",url,name:f.name});}file.value="";renderRefs();q.syncLegacy&&q.syncLegacy();input.focus();});
    send.disabled=!input.value.trim();
    send.addEventListener("click",()=>submit());
    settings.addEventListener("click",()=>{q.directorOpen=!q.directorOpen;q.touch();const n=document.getElementById("kkvcDirectorNote");if(n)n.style.display=q.directorOpen?"block":"none";if(typeof window.dispatchEvent==="function")window.dispatchEvent(new CustomEvent("kosmic:video-director-toggle",{detail:{open:q.directorOpen,state:q}}));});
    renderRefs();
  }

  function submit(){
    const q=st(),input=document.getElementById("kkvcInput"),text=input?.value.trim()||"";if(!text&&!q.references.length)return;
    const refs=q.references.map(r=>({id:r.id,url:r.url,name:r.name,kind:r.kind}));
    q.addMessage("user",text||"Use these references for the next generation.",{references:refs});
    q.composerDraft="";input.value="";input.style.height="auto";
    q.syncLegacy&&q.syncLegacy();
    renderMessages();renderRefs();
    const legacyInput=document.getElementById("vcChatInput"),legacySend=document.getElementById("vcSendBtn");
    if(legacyInput){legacyInput.value=text;legacyInput.dispatchEvent(new Event("input",{bubbles:true}));}
    if(legacySend){legacySend.click();q.setActiveGeneration({status:"submitting",prompt:text,startedAt:Date.now(),route:(window.__kosmicVideoV3State||window.__kosmicVideoV2State||{}).route||"seedance-2.5-text-to-video"});}
    else q.addMessage("assistant","The conversation shell is ready, but the existing Video generation control is not mounted yet. No request was sent.");
  }

  function installWrapper(){
    if(installed)return true;
    if(typeof window.renderVideoCanvasV2!=="function")return false;
    originalRender=window.renderVideoCanvasV2;
    window.renderVideoCanvasV2=function(){
      restoreLegacyIntoHost();
      try{originalRender.apply(this,arguments);}catch(err){console.error("Kosmic Video legacy render failed",err);}
      preserveLegacy();
      renderShell();
    };
    installed=true;
    return true;
  }

  function boot(){
    injectCss();
    if(!installWrapper()){setTimeout(boot,100);return;}
    /* Do not call the renderer automatically here. The main router remains
     * authoritative for when the Video module is entered. */
  }

  window.__kosmicVideoChatBoot=boot;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
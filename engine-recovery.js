/*
 * KOSMIC ENGINE PRODUCTION RECOVERY
 *
 * Isolated reliability layer. It never retries a generation automatically.
 * A browser can disappear after a provider accepted a paid request but before
 * the response reached us, so blindly turning `running` back into `pending`
 * would be a duplicate-charge machine disguised as a recovery feature.
 *
 * Safe strategy:
 *  1. Reconcile a running task from persisted production output when there is
 *     positive evidence that its work already landed.
 *  2. Otherwise mark it `interrupted` and wait for an explicit user resume.
 *  3. Resuming changes ONLY that task back to pending and dispatches it.
 *  4. Completed tasks are never regenerated.
 *
 * This file deliberately leaves auth, sessions, API-key storage, provider
 * routing, and generation functions untouched.
 */
(function(){
  "use strict";
  if(window.__kosmicEngineRecoveryLoaded)return;
  window.__kosmicEngineRecoveryLoaded=true;

  const RECOVERY_STATUSES=new Set(["running","interrupted"]);
  let _scanTimer=null;
  let _wrapped=false;

  function engine(){return window.KosmicEngine||null;}
  function state(){return window.S||null;}
  function save(){try{if(typeof window.save==="function")window.save("directorChat");}catch(e){console.warn("Kosmic recovery save failed:",e);}}
  function prodFor(d){
    const s=state();
    return s&&Array.isArray(s.productions)?s.productions.find(p=>p.id===d.productionId):null;
  }
  function epFor(p,index){return p&&Array.isArray(p.episodes)?p.episodes.find(e=>e.index===index):null;}
  function hasUrl(v){return typeof v==="string"&&v.trim().length>0;}

  // Positive persisted-output signals only. If a provider completed but the
  // browser died before our app wrote the result, there is intentionally no
  // way to prove completion, so the task stays interrupted instead of risking
  // an automatic second paid request.
  function persistedCompletion(task,p){
    if(!task||!p)return false;
    if(task.type==="plan")return !!p.id&&!!p.episodes&&p.episodes.length>0;
    if(task.type==="model_select")return !!p.imageModel&&!!p.videoModel&&!p.modelSelectionError;
    if(task.type==="char_plan")return Array.isArray(p.characters)&&Array.isArray(task._generatedChildIds)&&task._generatedChildIds.length>0;
    if(task.type==="charsheet_single"){
      const chars=(p.characters||[]).filter(c=>c.tier==="MC"||c.tier==="LEAD");
      const c=chars[task.charIndex];
      return !!c&&(p.characterSheets||[]).some(s=>s&&s.name===c.name&&hasUrl(s.sheetUrl));
    }
    if(task.type==="charsheet_side")return (p.characterSheets||[]).some(s=>s&&s.tier==="SIDE"&&hasUrl(s.sheetUrl));
    if(task.type==="charsheet_review")return p.characterSheetStatus==="approved";
    if(task.type==="loc_plan")return Array.isArray(task._generatedChildIds)&&task._generatedChildIds.length>0;
    if(task.type==="loc_img"){
      const loc=(p.locationBible||[])[task.locIndex];
      return !!loc&&hasUrl(loc.url);
    }
    if(task.type==="loc_review")return Array.isArray(p.locationBible)&&p.locationBible.length>0&&p.locationBible.every(l=>hasUrl(l.url))&&p.locationDesc;
    if(task.type==="script"){
      const e=epFor(p,task.epIndex);
      return !!e&&e.scriptStatus!=="pending"&&typeof e.script==="string"&&e.script.trim().length>0;
    }
    if(task.type==="storyboard"){
      const e=epFor(p,task.epIndex);
      return !!e&&e.storyboardStatus!=="pending"&&Array.isArray(e.storyboard)&&e.storyboard.some(s=>hasUrl(s&&s.url));
    }
    if(task.type==="scene"){
      const e=epFor(p,task.epIndex);
      return !!e&&e.sceneStatus!=="pending"&&Array.isArray(e.shots)&&e.shots.some(s=>hasUrl(s&&s.videoUrl));
    }
    return false;
  }

  function taskDescription(t){return t&&t.label?t.label:"This production task";}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

  function reconcile(){
    const s=state();
    const e=engine();
    const d=s&&s.directorChat;
    if(!s||!e||!d||!d.productionId||!Array.isArray(d.tasks)||!d.tasks.length)return{changed:false,interrupted:[]};
    const p=prodFor(d);
    if(!p)return{changed:false,interrupted:[]};
    let changed=false;
    const interrupted=[];
    d.tasks.forEach(t=>{
      if(!t||!RECOVERY_STATUSES.has(t.status))return;
      if(t.status==="running"){
        if(persistedCompletion(t,p)){
          t.status="done";
          t.error=null;
          t.recoveredAt=Date.now();
          t.recoveryReason="completed output was already persisted";
          changed=true;
        }else{
          t.status="interrupted";
          t.interruptedAt=Date.now();
          t.recoveryReason="The previous browser session ended while this task was running. Completion could not be proven from saved output, so it was NOT retried automatically.";
          interrupted.push(t);
          changed=true;
        }
      }else if(t.status==="interrupted")interrupted.push(t);
    });
    // A recovered browser session must never inherit a stale approval gate for
    // a task that is now interrupted. The user needs an explicit resume action.
    if(changed){
      if(d.awaitingApprovalTaskId){
        const a=d.tasks.find(t=>t.id===d.awaitingApprovalTaskId);
        if(!a||a.status!=="awaiting_approval")d.awaitingApprovalTaskId=null;
      }
      if(d.awaitingPermissionIds&&Array.isArray(d.awaitingPermissionIds)){
        d.awaitingPermissionIds=d.awaitingPermissionIds.filter(id=>{const t=d.tasks.find(x=>x.id===id);return t&&t.status==="pending";});
        if(!d.awaitingPermissionIds.length)d.awaitingPermissionIds=null;
      }
      save();
    }
    return{changed,interrupted};
  }

  function bannerHTML(tasks){
    if(!tasks.length)return "";
    const rows=tasks.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--glass-brd)">
      <div style="width:9px;height:9px;border-radius:50%;background:var(--gold);flex-shrink:0"></div>
      <div style="flex:1;min-width:0;font-size:10.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(taskDescription(t))}</div>
      <button class="btn btn-primary btn-xs" onclick="KosmicEngine.resumeRecoveredTask('${esc(t.id)}')">Resume</button>
    </div>`).join("");
    return `<div id="kgRecoveryBanner" style="margin:8px 10px;padding:11px 12px;border:1px solid rgba(212,175,55,.35);border-radius:13px;background:rgba(212,175,55,.08)">
      <div style="font-size:11.5px;font-weight:800;color:var(--text)">⚠️ Production interrupted safely</div>
      <div style="font-size:10px;line-height:1.45;color:var(--textm);margin-top:3px">The previous browser session ended during generation. Kosmic Engine did not automatically retry because the provider may already have completed a paid request.</div>
      ${rows}
    </div>`;
  }

  function renderRecoveryBanner(){
    const s=state();
    if(!s||!s.directorChat||!Array.isArray(s.directorChat.tasks))return;
    const tasks=s.directorChat.tasks.filter(t=>t&&t.status==="interrupted");
    const thread=document.getElementById("dcThread");
    if(!thread)return;
    const old=document.getElementById("kgRecoveryBanner");
    if(old)old.remove();
    if(!tasks.length)return;
    thread.insertAdjacentHTML("afterbegin",bannerHTML(tasks));
  }

  function resumeTask(id){
    const s=state();
    const e=engine();
    const d=s&&s.directorChat;
    if(!d||!Array.isArray(d.tasks)||!e)return;
    const t=d.tasks.find(x=>x&&x.id===id);
    if(!t||t.status!=="interrupted")return;
    const p=prodFor(d);
    if(!p){toast("That production no longer exists","error");return;}
    // Reconcile one final time before spending anything. If another tab/session
    // has already persisted the result, mark it done and never retry it.
    if(persistedCompletion(t,p)){
      t.status="done";t.error=null;t.recoveredAt=Date.now();t.recoveryReason="completion found before manual resume";
      save();
      renderRecoveryBanner();
      if(typeof e.renderTaskPanel==="function")e.renderTaskPanel();
      return;
    }
    // Explicit user action is the only point at which an uncertain paid task
    // may become pending again. This is the key anti-double-charge boundary.
    t.status="pending";
    t.error=null;
    delete t.interruptedAt;
    t.recoveryResumedAt=Date.now();
    t.recoveryReason="manually resumed after interrupted browser session";
    save();
    renderRecoveryBanner();
    if(typeof e.renderTaskPanel==="function")e.renderTaskPanel();
    if(typeof e.dispatch==="function")e.dispatch();
    else toast("Recovery prepared, but the Engine dispatcher is unavailable in this build","error");
  }

  function scheduleScan(){
    clearTimeout(_scanTimer);
    _scanTimer=setTimeout(function(){
      const r=reconcile();
      if(r.changed||r.interrupted.length)renderRecoveryBanner();
      else renderRecoveryBanner();
    },250);
  }

  function wrapRender(){
    if(_wrapped||typeof window.renderKosmicEngineModule!=="function")return;
    const original=window.renderKosmicEngineModule;
    window.renderKosmicEngineModule=function(){
      const out=original.apply(this,arguments);
      scheduleScan();
      return out;
    };
    _wrapped=true;
    scheduleScan();
  }

  // The module is loaded after the main script. A short retry is used only to
  // wait for the Engine globals, never as a generation retry.
  let tries=0;
  const boot=setInterval(()=>{
    tries++;
    wrapRender();
    if(_wrapped||tries>40)clearInterval(boot);
  },100);

  // Public only for the recovery button. `dispatch` is exported by the Engine
  // as a thin bridge to its existing private dispatcher; no generation logic
  // is duplicated here.
  window.__kosmicEngineRecovery={reconcile,render:renderRecoveryBanner,resumeTask};
})();

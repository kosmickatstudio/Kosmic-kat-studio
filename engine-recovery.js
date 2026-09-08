/*
 * KOSMIC ENGINE PRODUCTION RECOVERY
 *
 * Isolated reliability layer. It never retries a generation automatically.
 * A browser can disappear after a provider accepted a paid request but before
 * the response reached us, so blindly turning `running` back into `pending`
 * would be a duplicate-charge machine disguised as a recovery feature.
 *
 * Safe strategy:
 *  1. On the first fully-loaded Engine session, reconcile tasks that were
 *     already running before this page existed.
 *  2. Reconcile a running task from persisted production output when there is
 *     positive evidence that its work already landed.
 *  3. Otherwise mark it `interrupted` and wait for an explicit user resume.
 *  4. Resuming changes ONLY that task back to pending and dispatches it.
 *  5. Tasks created after this page loads are never mistaken for stale work.
 *
 * This file deliberately leaves auth, sessions, API-key storage, provider
 * routing, and generation functions untouched.
 */
(function(){
  "use strict";
  if(window.__kosmicEngineRecoveryLoaded)return;
  window.__kosmicEngineRecoveryLoaded=true;
  const RECOVERY_STATUSES=new Set(["running","interrupted"]);
  let _scanTimer=null,_wrapped=false,_sessionCaptured=false,_bootTries=0,_captureTries=0;
  function engine(){return typeof KosmicEngine!=="undefined"?KosmicEngine:null;}
  function state(){return typeof S!=="undefined"?S:null;}
  function save(){try{if(typeof window.save==="function")window.save("directorChat");}catch(e){console.warn("Kosmic recovery save failed:",e);}}
  function prodFor(d){const s=state();return s&&Array.isArray(s.productions)?s.productions.find(p=>p.id===d.productionId):null;}
  function epFor(p,index){return p&&Array.isArray(p.episodes)?p.episodes.find(e=>e.index===index):null;}
  function hasUrl(v){return typeof v==="string"&&v.trim().length>0;}
  function persistedCompletion(task,p,d){
    if(!task||!p)return false;
    if(task.type==="plan")return !!p.id&&!!p.episodes&&p.episodes.length>0;
    if(task.type==="model_select")return !!p.imageModel&&!!p.videoModel&&!p.modelSelectionError;
    if(task.type==="char_plan"){
      const children=(d&&d.tasks||[]).filter(x=>x!==task&&x.deps&&x.deps.includes("char_plan")&&(x.type==="charsheet_single"||x.type==="charsheet_side"));
      return children.length>0&&children.every(x=>x.status==="done")&&(p.characterSheets||[]).length>=children.length;
    }
    if(task.type==="charsheet_single"){
      const chars=(p.characters||[]).filter(c=>c.tier==="MC"||c.tier==="LEAD"),c=chars[task.charIndex];
      return !!c&&(p.characterSheets||[]).some(s=>s&&s.name===c.name&&hasUrl(s.sheetUrl));
    }
    if(task.type==="charsheet_side")return (p.characterSheets||[]).some(s=>s&&s.tier==="SIDE"&&hasUrl(s.sheetUrl));
    if(task.type==="charsheet_review")return p.characterSheetStatus==="approved";
    if(task.type==="loc_plan"){
      const children=(d&&d.tasks||[]).filter(x=>x!==task&&x.deps&&x.deps.includes("loc_plan")&&x.type==="loc_img");
      return children.length>0&&children.every(x=>x.status==="done")&&(p.locationBible||[]).every(l=>hasUrl(l&&l.url));
    }
    if(task.type==="loc_img"){const loc=(p.locationBible||[])[task.locIndex];return !!loc&&hasUrl(loc.url);}
    if(task.type==="loc_review")return Array.isArray(p.locationBible)&&p.locationBible.length>0&&p.locationBible.every(l=>hasUrl(l.url))&&!!p.locationDesc;
    if(task.type==="script"){const e=epFor(p,task.epIndex);return !!e&&e.scriptStatus!=="pending"&&typeof e.script==="string"&&e.script.trim().length>0;}
    if(task.type==="storyboard"){const e=epFor(p,task.epIndex);return !!e&&e.storyboardStatus!=="pending"&&e.storyboardStatus!=="partial"&&Array.isArray(e.storyboard)&&e.storyboard.length>0&&e.storyboard.every(s=>hasUrl(s&&s.url));}
    if(task.type==="scene"){const e=epFor(p,task.epIndex);return !!e&&e.sceneStatus!=="pending"&&e.sceneStatus!=="partial"&&Array.isArray(e.shots)&&e.shots.length>0&&e.shots.every(s=>hasUrl(s&&s.videoUrl));}
    return false;
  }
  function taskDescription(t){return t&&t.label?t.label:"This production task";}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
  function reconcile(){
    const s=state(),e=engine(),d=s&&s.directorChat;
    if(!s||!e||!d||!d.productionId||!Array.isArray(d.tasks)||!d.tasks.length)return{changed:false,interrupted:[]};
    const p=prodFor(d);if(!p)return{changed:false,interrupted:[]};
    let changed=false;const interrupted=[];
    d.tasks.forEach(t=>{
      if(!t||!RECOVERY_STATUSES.has(t.status))return;
      if(t.status==="running"){
        if(persistedCompletion(t,p,d)){t.status="done";t.error=null;t.recoveredAt=Date.now();t.recoveryReason="completed output was already persisted";changed=true;}
        else{t.status="interrupted";t.interruptedAt=Date.now();t.recoveryReason="The previous browser session ended while this task was running. Completion could not be proven from saved output, so it was NOT retried automatically.";interrupted.push(t);changed=true;}
      }else interrupted.push(t);
    });
    if(changed){
      if(d.awaitingApprovalTaskId){const a=d.tasks.find(t=>t.id===d.awaitingApprovalTaskId);if(!a||a.status!=="awaiting_approval")d.awaitingApprovalTaskId=null;}
      if(Array.isArray(d.awaitingPermissionIds)){d.awaitingPermissionIds=d.awaitingPermissionIds.filter(id=>{const t=d.tasks.find(x=>x.id===id);return t&&t.status==="pending";});if(!d.awaitingPermissionIds.length)d.awaitingPermissionIds=null;}
      save();
    }
    return{changed,interrupted};
  }
  function bannerHTML(tasks){
    if(!tasks.length)return "";
    const rows=tasks.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--glass-brd)"><div style="width:9px;height:9px;border-radius:50%;background:var(--gold);flex-shrink:0"></div><div style="flex:1;min-width:0;font-size:10.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(taskDescription(t))}</div><button class="btn btn-primary btn-xs" onclick="KosmicEngine.resumeRecoveredTask('${esc(t.id)}')">Resume</button></div>`).join("");
    return `<div id="kgRecoveryBanner" style="margin:8px 10px;padding:11px 12px;border:1px solid rgba(212,175,55,.35);border-radius:13px;background:rgba(212,175,55,.08)"><div style="font-size:11.5px;font-weight:800;color:var(--text)">⚠️ Production interrupted safely</div><div style="font-size:10px;line-height:1.45;color:var(--textm);margin-top:3px">The previous browser session ended during generation. Kosmic Engine did not automatically retry because the provider may already have completed a paid request.</div>${rows}</div>`;
  }
  function renderRecoveryBanner(){
    const s=state();if(!s||!s.directorChat||!Array.isArray(s.directorChat.tasks))return;
    const tasks=s.directorChat.tasks.filter(t=>t&&t.status==="interrupted"),thread=document.getElementById("dcThread");if(!thread)return;
    const old=document.getElementById("kgRecoveryBanner");if(old)old.remove();if(!tasks.length)return;
    thread.insertAdjacentHTML("afterbegin",bannerHTML(tasks));
  }
  function resumeTask(id){
    const s=state(),e=engine(),d=s&&s.directorChat;if(!d||!Array.isArray(d.tasks)||!e)return;
    const t=d.tasks.find(x=>x&&x.id===id);if(!t||t.status!=="interrupted")return;
    const p=prodFor(d);if(!p){toast("That production no longer exists","error");return;}
    if(persistedCompletion(t,p,d)){t.status="done";t.error=null;t.recoveredAt=Date.now();t.recoveryReason="completion found before manual resume";save();renderRecoveryBanner();if(typeof e.renderTaskPanel==="function")e.renderTaskPanel();return;}
    t.status="pending";t.error=null;t.permitted=false;delete t.interruptedAt;t.recoveryResumedAt=Date.now();t.recoveryReason="manually resumed after interrupted browser session";
    save();renderRecoveryBanner();if(typeof e.renderTaskPanel==="function")e.renderTaskPanel();
    if(typeof e.dispatch==="function")e.dispatch();else toast("Recovery prepared, but the Engine dispatcher is unavailable in this build","error");
  }

  // ── GENERATION ATTEMPT / LEASE GUARD ────────────────────────────────
  // The Engine's task runner is intentionally private. We therefore keep the
  // reliability boundary here, in the already-isolated recovery layer, rather
  // than changing auth, routing, or generation code. Each running task gets a
  // monotonically increasing lease. A retry invalidates the previous lease.
  // Provider calls are wrapped at the public generation boundaries and must
  // re-check ownership before their result is allowed back into the pipeline.
  // This is the same request-identity pattern used to prevent stale async
  // responses from committing after a newer attempt has started.
  let _leaseSeq=0;
  const _leases=new Map();
  const STALE_ATTEMPT="KOSMIC_ENGINE_STALE_ATTEMPT";
  function leaseForTask(t){
    if(!t)return null;
    if(!t.runToken){
      t.runToken=`run_${Date.now()}_${++_leaseSeq}`;
      t.runStartedAt=Date.now();
    }
    const existing=_leases.get(t.id);
    if(!existing||existing.taskRef!==t||existing.token!==t.runToken){
      _leases.set(t.id,{token:t.runToken,taskRef:t});
    }
    return _leases.get(t.id);
  }
  function runningTasks(){
    const d=state()&&state().directorChat;
    return d&&Array.isArray(d.tasks)?d.tasks.filter(t=>t&&t.status==="running"):[];
  }
  function captureRunningLeases(){runningTasks().forEach(leaseForTask);}
  function currentLease(taskId,taskRef,token){
    const d=state()&&state().directorChat;
    const current=d&&Array.isArray(d.tasks)?d.tasks.find(t=>t&&t.id===taskId):null;
    const lease=_leases.get(taskId);
    return !!lease&&lease.taskRef===taskRef&&lease.token===token&&current===taskRef&&current.status==="running";
  }
  function staleError(){const e=new Error(STALE_ATTEMPT);e.code=STALE_ATTEMPT;return e;}
  function assertLease(taskId,taskRef,token){if(!currentLease(taskId,taskRef,token))throw staleError();}
  function candidateTask(kind,args){
    const d=state()&&state().directorChat;
    const tasks=runningTasks();
    if(!d||!tasks.length)return null;
    if(kind==="script"||kind==="storyboard"||kind==="scene"){
      const prodId=args[0],epIndex=args[1];
      return tasks.find(t=>t.type===kind&&t.epIndex===epIndex&&d.productionId===prodId)||null;
    }
    if(kind==="image"){
      if(tasks.length===1)return tasks[0];
      const prompt=String(args[0]||"").toLowerCase();
      const exact=tasks.find(t=>{
        const label=String(t.label||"").toLowerCase();
        if(t.type==="loc_img")return label.replace(/^location\s*[—-]\s*/,"")&&prompt.includes(label.replace(/^location\s*[—-]\s*/,""));
        if(t.type==="charsheet_side")return prompt.includes("side characters");
        if(t.type==="charsheet_single")return label.replace(/^character sheet\s*[—-]\s*/,"")&&prompt.includes(label.replace(/^character sheet\s*[—-]\s*/,""));
        return false;
      });
      return exact||null;
    }
    return null;
  }
  function wrapAsyncGlobal(name,kind){
    const original=window[name];
    if(typeof original!=="function"||original.__kosmicLeaseWrapped)return;
    const wrapped=async function(){
      const args=[...arguments];
      const task=candidateTask(kind,args);
      const lease=task&&leaseForTask(task);
      const out=await original.apply(this,args);
      if(task&&lease)assertLease(task.id,lease.taskRef,lease.token);
      return out;
    };
    wrapped.__kosmicLeaseWrapped=true;
    wrapped.__kosmicLeaseOriginal=original;
    window[name]=wrapped;
  }
  function invalidateTaskLease(task){
    if(!task)return;
    const old=_leases.get(task.id);
    if(old&&old.taskRef===task)_leases.delete(task.id);
    task.runToken=`invalid_${Date.now()}_${++_leaseSeq}`;
    task.runStartedAt=null;
    task.attemptInvalidatedAt=Date.now();
  }
  function cloneTaskForRetry(task){
    if(!task||!Array.isArray(state()?.directorChat?.tasks))return task;
    const d=state().directorChat;
    const idx=d.tasks.indexOf(task);
    if(idx<0)return task;
    const fresh={...task,status:"pending",error:null,permitted:false,runToken:null,runStartedAt:null,attemptSupersededAt:Date.now()};
    d.tasks[idx]=fresh;
    invalidateTaskLease(task);
    return fresh;
  }
  function wrapRetry(){
    const e=engine();
    if(!e||typeof e.retry!=="function"||e.retry.__kosmicLeaseWrapped)return;
    const original=e.retry;
    e.retry=function(msgIndex){
      const s=state(),d=s&&s.directorChat,m=d&&d.messages&&d.messages[msgIndex];
      const ids=(m&&m.retryTaskIds)||[];
      ids.forEach(id=>{const t=(d.tasks||[]).find(x=>x&&x.id===id);if(t&&t.status==="error")invalidateTaskLease(t);});
      const out=original.apply(this,arguments);
      captureRunningLeases();
      return out;
    };
    e.retry.__kosmicLeaseWrapped=true;
  }
  function wrapDispatch(){
    const e=engine();
    if(!e||typeof e.dispatch!=="function"||e.dispatch.__kosmicLeaseWrapped)return;
    const original=e.dispatch;
    e.dispatch=function(){
      const out=original.apply(this,arguments);
      captureRunningLeases();
      return out;
    };
    e.dispatch.__kosmicLeaseWrapped=true;
  }
  function installLeaseGuard(){
    wrapDispatch();
    wrapRetry();
    wrapAsyncGlobal("generateEpisodeScript","script");
    wrapAsyncGlobal("generateEpisodeStoryboard","storyboard");
    wrapAsyncGlobal("generateEpisodeScene","scene");
    wrapAsyncGlobal("genViaFal","image");
    wrapAsyncGlobal("genViaGemini","image");
    wrapAsyncGlobal("genViaOpenAI","image");
    captureRunningLeases();
  }

  function scheduleScan(){clearTimeout(_scanTimer);_scanTimer=setTimeout(()=>{if(!_sessionCaptured)captureSession();},250);}
  function captureSession(){
    const s=state(),d=s&&s.directorChat;
    if(!d||!d.projectId||!Array.isArray(d.messages)||!d.messages.length){_captureTries++;_scanTimer=setTimeout(captureSession,250);return;}
    _sessionCaptured=true;
    if(Array.isArray(d.tasks)&&d.tasks.length){reconcile();renderRecoveryBanner();}
    installLeaseGuard();
  }
  function wrapRender(){
    if(_wrapped||typeof window.renderKosmicEngineModule!=="function")return;
    const original=window.renderKosmicEngineModule;
    window.renderKosmicEngineModule=function(){const out=original.apply(this,arguments);scheduleScan();installLeaseGuard();return out;};
    _wrapped=true;scheduleScan();
  }
  const boot=setInterval(()=>{wrapRender();installLeaseGuard();if(_wrapped||++_bootTries>40)clearInterval(boot);},100);
  window.__kosmicEngineRecovery={reconcile,render:renderRecoveryBanner,resumeTask,installLeaseGuard,assertLease};
  const attachApi=setInterval(()=>{
    if(typeof KosmicEngine!=="undefined"&&typeof KosmicEngine.resumeRecoveredTask!=="function")KosmicEngine.resumeRecoveredTask=resumeTask;
    installLeaseGuard();
    if(typeof KosmicEngine!=="undefined"&&typeof KosmicEngine.dispatch!=="function")return;
    if(typeof KosmicEngine!=="undefined")clearInterval(attachApi);
  },100);
})();

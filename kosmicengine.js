// ══════════════════════════════════════════════════════════════════════
// KOSMIC ENGINE MODULE — sixteenth extraction from index.html (module
// split phase 16). Officially renamed from "Director Chat" — the module
// id, render function, and global object are now kosmicengine/
// renderKosmicEngineModule/KosmicEngine throughout. (The underlying state
// property S.directorChat was deliberately left as-is during this rename —
// it's a storage/sync key already used in existing users' saved data and
// Firebase documents; renaming it would orphan anyone's in-progress
// session. It's an internal implementation detail, invisible to the user,
// so leaving it alone carries no real cost.)
//
// Plain global script, not an ES module. Same clean profile as
// nodecanvas.js: only 2 top-level names exist in this whole ~660-line
// file — renderKosmicEngineModule (entry point) and KosmicEngine (a const
// assigned from an IIFE). Everything else is closure-private.
//
// Verified before extracting: the IIFE's own top-level body (function
// declarations, one bare `let _cloudSyncTimer=null`) never touches S/gs()
// at immediate execution time. Confirmed zero references to KosmicEngine.*
// anywhere outside this module — checked both the rest of index.html and
// every already-extracted file.
//
// Real, substantial OUTWARD dependency (the reverse direction from most
// prior extractions): Kosmic Engine deliberately does NOT reimplement any
// generation logic — it calls the exact same Production Pipeline
// functions the manual wizard screens use (runPromptwriter,
// generateCharacterSheet, generateEpisodeScript/Storyboard/Scene,
// approveEpisodeStage/rejectEpisodeStage), all of which still live in
// index.html (Production Pipeline hasn't been extracted yet). Confirmed
// all 6 are still correctly defined there.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

function renderKosmicEngineModule(el){
  if(!S.kosmicEngineProjectId){
    renderKosmicEngineGate(el);
    return;
  }
  const scopedProject=S.projects.find(p=>p.id===S.kosmicEngineProjectId);
  if(!scopedProject){
    // The scoped project was deleted/archived out from under an active
    // session — fall back to the gate rather than silently continuing
    // against a project that no longer exists.
    S.kosmicEngineProjectId=null;
    renderKosmicEngineGate(el);
    return;
  }
  el.innerHTML=`
    <div style="margin-bottom:10px">
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)">🎬 Kosmic Engine</div>
      <div style="font-size:11px;color:var(--textm);margin-top:2px">One conversation drives the whole pipeline — script, character sheet, storyboard, and scenes — with the same generation your Production Pipeline already uses.</div>
    </div>
    <div class="ig-chat-shell" style="min-height:60vh">
      <div class="ig-chat-header">
        <div>
          <b onclick="KosmicEngine.renameDirector()" style="cursor:pointer;text-decoration:underline dotted" title="Tap to rename">${S.directorChat.directorName}</b>
          <span style="font-size:10px;color:var(--textm)">· ${scopedProject.name}${S.directorChat.productionId?' · production in progress':''}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-xs" onclick="KosmicEngine.toggleEngineMenu(event)" title="More actions">⋯</button>
        </div>
      </div>
      <div id="dcTabs" style="display:flex;border-bottom:1px solid var(--border)"></div>
      <div id="dcTaskPanel"></div>
      <div class="ig-chat-thread" id="dcThread"></div>
      <div id="dcNotebook" style="display:none;overflow-y:auto;max-height:60vh"></div>
      <div id="dcInputBar" style="position:relative;background:var(--glass);backdrop-filter:blur(18px);border-top:1.5px solid var(--glass-brd);padding:12px 14px;display:flex;gap:10px;align-items:flex-end">
        <textarea class="ig-input-textarea-v2" id="dcInput" placeholder="Type your reply…" rows="1" style="flex:1;min-height:38px;background:var(--surface);border:1.5px solid var(--border);border-radius:16px;padding:9px 14px" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();KosmicEngine.send();}"></textarea>
        <button class="ig-send-btn" onclick="KosmicEngine.send()">➤</button>
      </div>
    </div>
  `;
  // Session loading is entirely enterProject's job now — the old check here
  // ("are there any messages?") had no notion of which project a session
  // belonged to, so a session from another project rendered as if it were
  // this one's.
  KosmicEngine.enterProject(S.kosmicEngineProjectId);
  KosmicEngine.renderTaskPanel();
  // Paints the tab bar and applies whichever tab was last active. Must run
  // after innerHTML above, since it targets nodes that only exist now.
  KosmicEngine.setEngineTab(KosmicEngine.currentTab());
}

// ── KOSMIC ENGINE ENTRY GATE ── Reuses the exact Project card format and
// creation modal the Projects module already has — no new UI invented for
// this, per the explicit ask to reuse what already exists. Deliberately
// NOT the interaction redesign discussed separately (structured screen vs.
// chat) — that's still pending a real discussion before touching it; this
// gate only decides *which Project* the conversation is scoped to.
function renderKosmicEngineGate(el){
  const activeProjects=S.projects.filter(p=>!p.archived);
  el.innerHTML=`
    <div style="margin-bottom:14px">
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)">🎬 Kosmic Engine</div>
      <div style="font-size:11px;color:var(--textm);margin-top:2px">Pick a Project to work in, or start a new one — Kosmic Engine builds the whole pipeline (script, character sheet, storyboard, scenes) inside that Project.</div>
    </div>
    <div class="grid2">
      <div onclick="openKosmicEngineProjectCreate()" style="cursor:pointer;border:1.5px dashed var(--vs);border-radius:14px;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--pearl2)">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--lav);color:var(--violet);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">+</div>
        <div style="font-size:12.5px;font-weight:700;color:var(--violet)">Create Project</div>
      </div>
      ${activeProjects.map(p=>projectCardHTML(p,`selectKosmicEngineProject('${p.id}')`)).join('')}
    </div>
    ${!activeProjects.length?`<div style="font-size:11px;color:var(--textm);margin-top:12px;text-align:center">No projects yet — tap + to create your first one.</div>`:''}
  `;
}
function openKosmicEngineProjectCreate(){
  S.kosmicEngineLaunchPending=true;
  openProjectModal();
}
function selectKosmicEngineProject(id){
  S.kosmicEngineProjectId=id;
  renderModule("kosmicengine");
}
function switchKosmicEngineProject(){
  // Preserve the current session before dropping the selection. The gate
  // returns early without calling enterProject(), so if the user leaves the
  // module from here instead of picking another project, nothing else would
  // have written the in-progress session to its per-project home.
  KosmicEngine.stashCurrentSession();
  S.kosmicEngineProjectId=null;
  renderModule("kosmicengine");
}

const KosmicEngine=(function(){
  function save(){
    window.save?window.save("directorChat"):localStorage.setItem("kk_director_chat",JSON.stringify(S.directorChat));
    clearTimeout(_cloudSyncTimer);
    _cloudSyncTimer=setTimeout(syncToCloud,1200); // debounced — not every single message/task update
    // Repaint the live task panel here rather than at each individual status
    // transition: save() is already called at every single one of them
    // (dispatchTasks' running/done/error writes, the dynamic task insertions
    // in char_plan/loc_plan, approve/reject), so hooking it once here is the
    // only way to guarantee no transition is ever missed as this file grows.
    //
    // Wrapped defensively on purpose: save() is load-bearing for persistence
    // AND is called mid-pipeline. An uncaught render error here would both
    // lose state and abort an in-flight production — a display concern must
    // never be able to do that.
    try{ renderTaskPanel(); }
    catch(err){ console.warn("Task panel render failed (non-blocking):",err); }
    // Notebook only repaints while it is the visible tab — it renders every
    // generated image in the production, so refreshing it on every save while
    // hidden would be pure waste during a long run. Guarded for the same
    // reason as above: save() is load-bearing and runs mid-pipeline.
    try{ if(_engineTab==="notebook")renderNotebook(); }
    catch(err){ console.warn("Notebook render failed (non-blocking):",err); }
  }
  let _cloudSyncTimer=null;
  // Declared up here rather than beside renderNotebook: save() reads it, and
  // a `let` further down would sit in the temporal dead zone if anything is
  // ever added to this IIFE's top-level body that calls save() during load.
  let _engineTab="chat";
  function deviceId(){
    let devId=localStorage.getItem("kk_device_id");
    if(!devId){devId="dev_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);localStorage.setItem("kk_device_id",devId);}
    return devId;
  }
  // Scoped per user AND per project. Per-user alone meant every project in
  // an account shared one chat document, so switching projects kept the
  // previous project's entire conversation, task graph and in-flight
  // production — the switch only changed the header label.
  function chatDocIdFor(projectId){
    const base=(S.user&&S.user.uid)?S.user.uid:deviceId();
    return "kosmicEngineChat_"+base+"_"+(projectId||"noproject");
  }
  // Takes the session EXPLICITLY rather than reading S.directorChat at call
  // time. Switching projects replaces S.directorChat immediately, so a
  // debounced or in-flight sync that read the live value would either write
  // the wrong session or write nothing at all for the outgoing one.
  async function syncSessionToCloud(session){
    if(!session||!session.projectId)return;
    try{
      await fbDB.collection("public").doc(chatDocIdFor(session.projectId)).set({chat:session,updatedAt:Date.now()});
    }
    catch(err){ console.warn("Kosmic Engine cloud sync failed — kept locally only:",err.message); }
  }
  async function syncToCloud(){ return syncSessionToCloud(S.directorChat); }

  // Pre-per-project document id. Writes moved to the per-project id, so this
  // one has not been written since — it still holds whatever session was
  // active before that change, which is the only recovery route for work
  // that was lost when switching projects discarded the live session.
  function legacyChatDocId(){
    const base=(S.user&&S.user.uid)?S.user.uid:deviceId();
    return "kosmicEngineChat_"+base;
  }
  async function loadLegacySession(){
    if(gs("ke_legacy_migrated",false)===true)return null;
    try{
      const doc=await fbDB.collection("public").doc(legacyChatDocId()).get();
      if(doc.exists&&doc.data().chat&&doc.data().chat.messages&&doc.data().chat.messages.length)return doc.data().chat;
      return null;
    }catch(err){ console.warn("Legacy Kosmic Engine session lookup failed:",err.message); return null; }
  }

  // Snapshots the outgoing session into the per-project map and flushes it to
  // its OWN cloud doc immediately. Without this, switching away discarded the
  // live session: the single local storage key got overwritten by the
  // incoming session, and any pending debounced cloud write was either
  // cancelled or redirected — losing the outgoing work from both places.
  function stashCurrentSession(){
    const s=S.directorChat;
    if(!s||!s.projectId)return;
    if(!s.messages||!s.messages.length)return; // nothing worth preserving
    let snapshot;
    try{ snapshot=JSON.parse(JSON.stringify(s)); }
    catch(err){ console.warn("Couldn't snapshot session:",err); return; }
    S.kosmicEngineSessions=S.kosmicEngineSessions||{};
    S.kosmicEngineSessions[s.projectId]=snapshot;
    window.save&&window.save("kosmicEngineSessions");
    clearTimeout(_cloudSyncTimer); // the pending write is superseded by this immediate one
    syncSessionToCloud(snapshot);
  }
  async function loadFromCloud(){
    try{
      const doc=await fbDB.collection("public").doc(chatDocIdFor(S.kosmicEngineProjectId)).get();
      if(doc.exists&&doc.data().chat&&doc.data().chat.messages&&doc.data().chat.messages.length){
        clearTimeout(_cloudSyncTimer); // don't let a pending local sync overwrite what we just loaded
        S.directorChat=doc.data().chat;
        window.save?window.save("directorChat"):localStorage.setItem("kk_director_chat",JSON.stringify(S.directorChat));
        renderThread();
        return true;
      }
      return false;
    }catch(err){ console.warn("Couldn't load Kosmic Engine chat from cloud — showing local state:",err.message); return false; }
  }
  function push(role,content,extra={}){
    S.directorChat.messages.push({role,content,...extra,ts:Date.now()});
    save();
    renderThread();
  }

  // ── Task graph ──────────────────────────────────────────────────────
  // Replaces the old single .stage string + _retryFn. Each unit of work is
  // a task with explicit dependencies; the dispatcher only ever runs a task
  // once every dependency is 'done'. Tasks marked parallel:true that become
  // ready at the same time run together via Promise.allSettled — this is
  // used for the Character Sheet's 6 views, which are genuinely independent
  // (verified: each writes p.characterSheet[viewKey], no shared key, no
  // read-after-write dependency between them). Episode script/storyboard/
  // scene tasks stay sequential per-episode by design (storyboard's visual
  // chaining and scene generation genuinely depend on the prior stage's
  // output), but script tasks across episodes depend only on the *previous
  // episode's script being approved* — matching generateEpisodeScript's
  // real continuity logic — not on that episode's full storyboard+scene,
  // which is real headroom for future pipelining even though this pass
  // still runs the approval UI one card at a time for clarity.
  // ── Normalized failure messages ─────────────────────────────────────
  // Raw provider errors are inconsistent junk to read (fal.ai's JSON detail
  // arrays, OpenAI's error codes, Gemini's own format, etc). This maps common
  // failure SHAPES (not provider-specific strings) to one consistent,
  // human-readable message + suggested action, regardless of which provider
  // actually threw it.
  function classifyError(message){
    const m=(message||"").toLowerCase();
    if(/insufficient|quota|credit|balance|payment required|402/.test(m))return{category:"credits",label:"Out of credits"};
    if(/rate limit|429|too many requests/.test(m))return{category:"rate_limit",label:"Rate limited"};
    if(/unauthoriz|invalid.*key|401|forbidden|403/.test(m))return{category:"auth",label:"API key problem"};
    if(/content polic|flagged|safety|moderation/.test(m))return{category:"content_policy",label:"Content flagged"};
    if(/timeout|timed out/.test(m))return{category:"timeout",label:"Timed out"};
    if(/network|fetch failed|failed to fetch/.test(m))return{category:"network",label:"Network error"};
    return{category:"unknown",label:"Generation failed"};
  }
  async function checkFalBalance(){
    // fal.ai's real documented billing endpoint (api.fal.ai/v1/account/billing)
    // — requires an admin-scoped key, which the regular key saved in Settings
    // may or may not have. Fails silently and just omits the balance rather
    // than guessing or showing a scary error about a feature that's optional.
    const key=gs("api_falai","");
    if(!key)return null;
    try{
      const res=await fetch("https://api.fal.ai/v1/account/billing?expand=credits",{headers:{"Authorization":"Key "+key}});
      if(!res.ok)return null;
      const data=await res.json();
      return data.credits?`${data.credits.current_balance} ${data.credits.currency}`:null;
    }catch(err){ return null; }
  }
  async function normalizeError(rawMessage,provider){
    const cls=classifyError(rawMessage);
    let suffix="";
    if(cls.category==="credits"&&provider==="fal"){
      const bal=await checkFalBalance();
      suffix=bal?` — fal.ai balance: ${bal}`:" — check your fal.ai balance at fal.ai/dashboard/billing";
    } else if(cls.category==="credits"){
      suffix=" — check your provider's billing dashboard";
    } else if(cls.category==="rate_limit"){
      suffix=" — wait a bit and retry";
    } else if(cls.category==="auth"){
      suffix=" — check the API key in Settings";
    }
    return `${cls.label}${suffix}\n\n${rawMessage}`;
  }
  function guessProvider(task){
    if(task.type==="charsheet_single"||task.type==="charsheet_side"||task.type==="loc_img")return "fal";
    if(task.type==="script"||task.type==="plan"||task.type==="loc_plan"||task.type==="char_plan"||task.type==="model_select")return "brain";
    if(task.type==="storyboard"||task.type==="scene")return "fal";
    return "unknown";
  }

  async function urlToDataUrl(url){
    const res=await fetch(url);
    if(!res.ok)throw new Error("Couldn't fetch image for QA check");
    const blob=await res.blob();
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error("Couldn't read image for QA check"));
      reader.readAsDataURL(blob);
    });
  }
  // Returns a STRUCTURED result because "no note" is genuinely ambiguous:
  // the old boolean-ish null was returned for a passed check, a missing
  // image, an unparseable model reply AND a thrown error alike. That is fine
  // for an advisory note, but auto-approval must never treat "the check
  // didn't run" as "the check passed" — with no vision-capable brain
  // configured, every check fails silently, and approving on null would
  // rubber-stamp an entire production while appearing to have verified it.
  async function runQACheckDetailed(imageUrl,description){
    if(!imageUrl)return{ran:false,passed:false,note:null,reason:"no image to check"};
    try{
      const dataUrl=await urlToDataUrl(imageUrl);
      const result=await callAiVision(
        [{dataUrl}],
        `Does this image look like a valid, professionally-generated image — not broken, garbled, blank, duplicated limbs, or malformed? Does it reasonably match this description: "${description}"? Reply in EXACTLY this format:\nSTATUS: pass or flag\nNOTE: <one short sentence, only if flagged>`,
        "You are doing a quick quality check on AI-generated production art for a human who will make the final call either way. Be lenient — only flag genuinely broken results, not minor stylistic differences or artistic license."
      );
      const statusMatch=result.match(/STATUS:\s*(pass|flag)/i);
      if(!statusMatch)return{ran:false,passed:false,note:null,reason:"couldn't read the quality check's answer"};
      const flagged=statusMatch[1].toLowerCase()==="flag";
      const noteMatch=result.match(/NOTE:\s*(.+)/i);
      return{ran:true,passed:!flagged,note:flagged?(noteMatch?noteMatch[1].trim():"Possible quality issue — worth a closer look"):null,reason:null};
    }catch(err){
      console.warn("QA check skipped (not blocking):",err.message);
      return{ran:false,passed:false,note:null,reason:err.message}; // never blocks the flow on its own failure
    }
  }
  async function runQACheck(imageUrl,description){
    const r=await runQACheckDetailed(imageUrl,description);
    return r.note;
  }

  function findTask(id){ return (S.directorChat.tasks||[]).find(t=>t.id===id); }
  function depsSatisfied(t){ return (t.deps||[]).every(id=>{const d=findTask(id);return d&&d.status==="done";}); }

  function buildTaskGraph(episodeCount){
    const tasks=[
      {id:"plan",type:"plan",label:"Planning production",deps:[],parallel:false,requiresApproval:false,status:"pending",error:null},
      {id:"model_select",type:"model_select",label:"Choosing image & video models",deps:["plan"],parallel:false,requiresApproval:false,status:"pending",error:null},
    ];
    // Character Sheets: char_plan reads the tiered MC/LEAD/SIDE breakdown the
    // Promptwriter already produced (p.characters, set in createProduction),
    // then dynamically inserts one composite-sheet task per MC/LEAD character
    // plus one shared task for all SIDE characters — same dynamic-insertion
    // pattern as loc_plan below, and the same fix Production Pipeline's
    // manual wizard got: one full description per character instead of every
    // character's description crammed into every generated image.
    tasks.push({id:"char_plan",type:"char_plan",label:"Identifying characters",deps:["model_select"],parallel:false,requiresApproval:false,status:"pending",error:null});
    tasks.push({id:"cs_review",type:"charsheet_review",label:"Character Sheets ready for review",deps:["char_plan"],parallel:false,requiresApproval:true,status:"pending",error:null});
    // Location Bible: loc_plan lists key locations (count unknown until the
    // brain answers), then dynamically inserts one parallel image task per
    // location plus a loc_review approval gate — see runTaskWork("loc_plan").
    tasks.push({id:"loc_plan",type:"loc_plan",label:"Identifying key locations",deps:["cs_review"],parallel:false,requiresApproval:false,status:"pending",error:null});
    tasks.push({id:"loc_review",type:"loc_review",label:"Location Bible ready for review",deps:["loc_plan"],parallel:false,requiresApproval:true,status:"pending",error:null});
    let prevScriptId="loc_review";
    for(let ep=1;ep<=episodeCount;ep++){
      const scriptId=`script_${ep}`,storyboardId=`storyboard_${ep}`,sceneId=`scene_${ep}`;
      tasks.push({id:scriptId,type:"script",epIndex:ep,label:`Episode ${ep} — script`,deps:[prevScriptId],parallel:false,requiresApproval:true,status:"pending",error:null});
      tasks.push({id:storyboardId,type:"storyboard",epIndex:ep,label:`Episode ${ep} — storyboard`,deps:[scriptId],parallel:false,requiresApproval:true,status:"pending",error:null});
      tasks.push({id:sceneId,type:"scene",epIndex:ep,label:`Episode ${ep} — scene`,deps:[storyboardId],parallel:false,requiresApproval:true,status:"pending",error:null});
      prevScriptId=scriptId; // next episode's script only waits on THIS episode's script, not its storyboard/scene
    }
    return tasks;
  }

  async function runTaskWork(task){
    const prodId=S.directorChat.productionId;
    if(task.type==="plan"){
      S.pendingProductionDraft=S.directorChat.draft;
      const {prodId:newId,parsed}=await runPromptwriter(true);
      S.directorChat.productionId=newId;
      S.directorChat.episodeCount=parsed.episodes.length;
      save();
      return{summary:`✅ Plan ready — ${parsed.episodes.length} episode${parsed.episodes.length!==1?'s':''}, Director ${parsed.persona} assigned.\n\nCharacter: ${parsed.characterDesc.slice(0,200)}${parsed.characterDesc.length>200?'…':''}`};
    }
    if(task.type==="model_select"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      // Upgraded from FLUX Dev / Nano Banana 2 to the two models that
      // actually test best for prompt understanding + character
      // consistency (both matter a lot more than raw speed for a
      // character-driven production): Nano Banana Pro holds identity
      // across up to 5 people/scenes with no fine-tuning; Seedream 5.0 Pro
      // does genuine multi-step reasoning on complex/branded prompts and
      // is meaningfully cheaper. Neither needs LoRA training to stay
      // consistent, unlike FLUX.
      const VALID_IMAGE=["fal-ai/nano-banana-pro","fal-ai/bytedance/seedream/v5/pro/text-to-image"];
      const VALID_VIDEO=["bytedance/seedance-2.0/fast/reference-to-video","bytedance/seedance-2.0/reference-to-video"];
      try{
        const reply=await callAiSimple(
          `Story: "${p.concept}"\nCharacter: ${p.characterDesc.slice(0,300)}\n\nPick the best-fit models for this production from these REAL options — base this on the story's actual needs, not a default guess:\n\nIMAGE MODELS:\n- fal-ai/nano-banana-pro: best for multi-character scenes and consistency (holds identity across up to 5 people/scenes with no fine-tuning), native 4K — good default for character-driven stories\n- fal-ai/bytedance/seedream/v5/pro/text-to-image: better for complex/branded/text-heavy prompts (deep multi-step prompt reasoning, native multilingual text rendering), meaningfully cheaper — better when the brief has lots of specific detail to track\n\nVIDEO MODELS:\n- bytedance/seedance-2.0/fast/reference-to-video: cheaper, quicker turnaround — good default\n- bytedance/seedance-2.0/reference-to-video: standard tier, higher quality output, more expensive — better for hero/high-stakes shots\n\nReply in EXACTLY this format, nothing else:\nIMAGE: <model id>\nVIDEO: <model id>\nREASON: <one short sentence>`,
          "You are a technical producer choosing generation models based on real production needs and cost tradeoffs. Only ever pick from the exact model ids given — never invent a different one.",
          p.brainModel
        );
        const imgMatch=reply.match(/IMAGE:\s*(\S+)/);
        const vidMatch=reply.match(/VIDEO:\s*(\S+)/);
        const reasonMatch=reply.match(/REASON:\s*(.+)/);
        if(imgMatch&&VALID_IMAGE.includes(imgMatch[1]))p.imageModel=imgMatch[1];
        if(vidMatch&&VALID_VIDEO.includes(vidMatch[1]))p.videoModel=vidMatch[1];
        save2Productions();
        return{summary:`🧠 Models chosen — Image: ${p.imageModel.includes('nano-banana')?'Nano Banana Pro':'Seedream 5.0 Pro'}, Video: ${p.videoModel.includes('/fast/')?'Seedance 2.0 Fast':'Seedance 2.0 Standard'}.${reasonMatch?' '+reasonMatch[1].trim():''}`};
      }catch(err){
        // Model selection is an enhancement, not a hard requirement — the
        // defaults already set in the draft (Nano Banana Pro / Seedance
        // Fast) are perfectly valid, so a failure here shouldn't block
        // the production.
        console.warn("Model auto-selection skipped, using defaults:",err.message);
        return{summary:`🧠 Using default models (couldn't reach the brain for a custom pick): Nano Banana Pro, Seedance 2.0 Fast.`};
      }
    }
    if(task.type==="char_plan"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      // p.characters is already set by createProduction (from the
      // Promptwriter's tiered MC/LEAD/SIDE output) — no second AI call
      // needed, same reasoning as loc_plan reusing p.locations below.
      const characters=(p.characters&&p.characters.length)?p.characters:[{tier:"MC",name:"Character",desc:p.characterDesc||""}];
      const leads=characters.filter(c=>c.tier==="MC"||c.tier==="LEAD");
      const sides=characters.filter(c=>c.tier==="SIDE");
      p.characterSheets=[];
      save2Productions();
      const tasks=S.directorChat.tasks;
      const reviewIdx=tasks.findIndex(t=>t.id==="cs_review");
      const sheetIds=[];
      leads.forEach((c,i)=>{
        const id=`cs_char_${i}`;
        tasks.splice(reviewIdx,0,{id,type:"charsheet_single",charIndex:i,label:`Character Sheet — ${c.name}`,deps:["char_plan"],parallel:true,requiresApproval:false,status:"pending",error:null});
        sheetIds.push(id);
      });
      if(sides.length){
        tasks.splice(reviewIdx,0,{id:"cs_side",type:"charsheet_side",label:"Character Sheet — Side characters",deps:["char_plan"],parallel:true,requiresApproval:false,status:"pending",error:null});
        sheetIds.push("cs_side");
      }
      findTask("cs_review").deps=sheetIds.length?sheetIds:["char_plan"];
      save();
      return{summary:`🎭 ${characters.length} character${characters.length!==1?'s':''} identified: ${characters.map(c=>`${c.name} (${c.tier})`).join(", ")} — generating ${leads.length} dedicated sheet${leads.length!==1?'s':''}${sides.length?' + 1 shared side-character sheet':''} in parallel…`};
    }
    if(task.type==="charsheet_single"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      const characters=(p.characters&&p.characters.length)?p.characters:[{tier:"MC",name:"Character",desc:p.characterDesc||""}];
      const c=characters.filter(x=>x.tier==="MC"||x.tier==="LEAD")[task.charIndex];
      // One composite image containing front/back/3-4/face views, using ONLY
      // this character's own description — not the whole cast's combined
      // text, which is what caused multiple people to appear in one sheet.
      // Rejection feedback is appended rather than replacing anything: the
      // user is correcting a specific fault, not restating the whole brief.
      const csFix=p.charSheetFeedback?`. IMPORTANT — the previous attempt was rejected for this reason, address it directly: ${p.charSheetFeedback}`:"";
      const prompt=`${c.desc}, full character reference turnaround sheet, single composite image arranged in a grid showing: front full-body view, back full-body view, 3/4 angle full-body view, and a close-up face portrait — consistent character design across all views, clean plain background, professional character design sheet, only this one character, no other people${csFix}`;
      let result;
      if(p.imageModel&&p.imageModel.startsWith("gemini-"))result=await genViaGemini(prompt,"1:1",p.imageModel);
      else if(p.imageModel==="gpt-image-2")result=await genViaOpenAI(prompt,"1:1");
      else result=await genViaFal(prompt,"",p.imageModel||"fal-ai/nano-banana-pro","1:1",false);
      p.characterSheets=p.characterSheets||[];
      p.characterSheets.push({tier:c.tier,name:c.name,desc:c.desc,sheetUrl:result.url});
      save2Productions();
      trackProductionCost(p,p.imageModel,`Character Sheet — ${c.name}`);
      createImageAsset(result.url,`Character Sheet — ${c.name} (${p.concept.slice(0,40)})`,p.projectId);
      return{};
    }
    if(task.type==="charsheet_side"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      const characters=(p.characters&&p.characters.length)?p.characters:[];
      const sides=characters.filter(c=>c.tier==="SIDE");
      const lineup=sides.map(c=>`${c.name} (${c.desc})`).join("; ");
      const sideFix=p.charSheetFeedback?` IMPORTANT — the previous attempt was rejected for this reason, address it directly: ${p.charSheetFeedback}`:"";
      const prompt=`Character lineup reference sheet, ${sides.length} distinct background/side characters standing side by side for comparison, each clearly separated: ${lineup}. Clean plain background, consistent lighting, simple standing poses, professional character design reference — each character visually distinct from the others.${sideFix}`;
      let result;
      if(p.imageModel&&p.imageModel.startsWith("gemini-"))result=await genViaGemini(prompt,"16:9",p.imageModel);
      else if(p.imageModel==="gpt-image-2")result=await genViaOpenAI(prompt,"16:9");
      else result=await genViaFal(prompt,"",p.imageModel||"fal-ai/nano-banana-pro","16:9",false);
      p.characterSheets=p.characterSheets||[];
      p.characterSheets.push({tier:"SIDE",name:sides.map(c=>c.name).join(", "),desc:lineup,sheetUrl:result.url});
      save2Productions();
      trackProductionCost(p,p.imageModel,"Character Sheet — Side characters lineup");
      createImageAsset(result.url,`Character Sheet — Side characters (${p.concept.slice(0,40)})`,p.projectId);
      return{};
    }
    if(task.type==="charsheet_review"){
      const p=S.productions.find(x=>x.id===prodId);
      p.characterSheetStatus="ready";
      save2Productions();
      const sheets=p.characterSheets||[];
      const mc=sheets.find(s=>s.tier==="MC");
      const qa=mc?await runQACheckDetailed(mc.sheetUrl,mc.desc):{ran:false,passed:false,note:null,reason:"no sheet to check"};
      task.qa=qa; const qaNote=qa.note;
      return{summary:`🎭 Character Sheet${sheets.length!==1?'s':''} ready — ${sheets.map(s=>s.tier==='SIDE'?'Side characters':s.name).join(', ')}:`,approval:{images:sheets.map(s=>s.sheetUrl),qaNote}};
    }
    if(task.type==="loc_plan"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      let locs;
      if(p.locations&&p.locations.length){
        // Reuse the Promptwriter's own LOCATIONS: section — it already saw the
        // full story and named these places once. Re-deriving them with a
        // second independent AI call risks different names/descriptions for
        // the same location, wasting a call for no benefit.
        locs=p.locations.slice(0,3).map(l=>({name:l.name,desc:l.desc||l.name}));
      } else {
        const epContent=p.episodes.map(e=>e.masterPrompt).join("\n").slice(0,4000);
        const reply=await callAiSimple(
          `From this story content, list the 1-3 most important recurring LOCATIONS. Format EXACTLY, one per line, nothing else:\nLOCATION: <short name> | <one-line vivid visual description for an establishing shot>\n\nStory:\n${epContent}`,
          "You are a production designer. Follow the format exactly.",
          p.brainModel
        );
        locs=[...reply.matchAll(/LOCATION:\s*([^|]+)\|(.+)/g)].map(m=>({name:m[1].trim(),desc:m[2].trim()})).slice(0,3);
      }
      if(!locs.length)throw new Error("Couldn't identify locations from the story — retry");
      // World memory recall: if a newly-identified location word-overlaps one we
      // already have an approved reference for, reuse its canon desc + image
      // instead of re-imagining it from scratch (same pattern as character recall).
      const rememberedNames=[];
      for(const l of locs){
        const remembered=await SemanticMemory.recallLocation(`${l.name}. ${l.desc}`);
        if(remembered){ l.desc=remembered.desc; l.url=remembered.url||null; rememberedNames.push(remembered.name); }
      }
      p.locationBible=locs.map(l=>({name:l.name,desc:l.desc,url:l.url||null}));
      save2Productions();
      // Dynamically insert one parallel image task per location, and rewire
      // loc_review to wait for all of them (it currently only deps on loc_plan).
      const tasks=S.directorChat.tasks;
      const reviewIdx=tasks.findIndex(t=>t.id==="loc_review");
      // Only spin up an image task for locations we don't already have a
      // remembered reference image for — no point re-generating a known place.
      const imgIds=[];
      locs.forEach((l,i)=>{
        if(l.url)return; // recalled from world memory, already has a reference
        const id=`loc_img_${i}`;
        tasks.splice(reviewIdx,0,{id,type:"loc_img",locIndex:i,label:`Location — ${l.name}`,deps:["loc_plan"],parallel:true,requiresApproval:false,status:"pending",error:null});
        imgIds.push(id);
      });
      findTask("loc_review").deps=imgIds.length?imgIds:["loc_plan"];
      save();
      const memNote=rememberedNames.length?` 🧠 Already know ${rememberedNames.join(", ")} — reusing the approved look.`:"";
      return{summary:`📍 ${locs.length} key location${locs.length!==1?'s':''} identified: ${locs.map(l=>l.name).join(", ")} — generating establishing references in parallel…${memNote}`};
    }
    if(task.type==="loc_img"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      const loc=p.locationBible[task.locIndex];
      const locFix=p.locationFeedback?`. IMPORTANT — the previous attempt was rejected for this reason, address it directly: ${p.locationFeedback}`:"";
      const prompt=`${loc.desc}, wide establishing shot, cinematic environment reference, no people, detailed background art${locFix}`;
      let result;
      if(p.imageModel&&p.imageModel.startsWith("gemini-"))result=await genViaGemini(prompt,"16:9",p.imageModel);
      else if(p.imageModel==="gpt-image-2")result=await genViaOpenAI(prompt,"16:9");
      else result=await genViaFal(prompt,"",p.imageModel||"fal-ai/flux/dev","16:9",false);
      loc.url=result.url;
      save2Productions();
      // trackProductionCost, not logCost: the bare logCost records the spend
      // in the global cost log but never adds to p.costSpent, which is what
      // the Production Pipeline's "$X spent so far on this production" line
      // reads. This was the only generation in the whole production path
      // using the bare version, so that per-production figure silently
      // under-reported by every location image ever generated.
      trackProductionCost(p,p.imageModel,`Location Bible — ${loc.name}`);
      return{};
    }
    if(task.type==="loc_review"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      // locationDesc feeds every storyboard shot prompt from here on (see
      // generateEpisodeStoryboard) so environments stay consistent too.
      p.locationDesc=p.locationBible.map(l=>`${l.name}: ${l.desc}`).join("; ");
      save2Productions();
      const firstLoc=p.locationBible[0];
      const qa=firstLoc?await runQACheckDetailed(firstLoc.url,firstLoc.desc):{ran:false,passed:false,note:null,reason:"no location image to check"};
      task.qa=qa; const qaNote=qa.note;
      return{summary:"📍 Location Bible ready — these environments will anchor every storyboard shot:",approval:{images:p.locationBible.map(l=>l.url).filter(Boolean),qaNote}};
    }
    if(task.type==="script"){
      await generateEpisodeScript(prodId,task.epIndex);
      const p=S.productions.find(x=>x.id===prodId);
      const e=getEpisode(p,task.epIndex);
      if(e.scriptStatus!=="ready")throw new Error(`Episode ${task.epIndex} script generation didn't complete`);
      return{summary:`✍️ Episode ${task.epIndex} script ready:`,approval:{text:e.script}};
    }
    if(task.type==="storyboard"){
      await generateEpisodeStoryboard(prodId,task.epIndex);
      const p=S.productions.find(x=>x.id===prodId);
      const e=getEpisode(p,task.epIndex);
      if(e.storyboardStatus==="pending")throw new Error("Storyboard generation failed — every shot errored out");
      const qa=e.storyboard[0]?await runQACheckDetailed(e.storyboard[0].url,e.masterPrompt):{ran:false,passed:false,note:null,reason:"no storyboard frame to check"};
      task.qa=qa; const qaNote=qa.note;
      return{summary:`🖼 Episode ${task.epIndex} storyboard ready${e.storyboardStatus==='partial'?' (partial — some shots failed)':''}:`,approval:{images:e.storyboard.map(s=>s.url),qaNote}};
    }
    if(task.type==="scene"){
      await generateEpisodeScene(prodId,task.epIndex);
      const p=S.productions.find(x=>x.id===prodId);
      const e=getEpisode(p,task.epIndex);
      if(e.sceneStatus==="pending")throw new Error("Scene generation failed — every shot errored out");
      const firstShot=e.shots&&e.shots[0];
      return{summary:`🎥 Episode ${task.epIndex} scene ready${e.sceneStatus==='partial'?' (partial — some shots failed)':''}:`,approval:{video:firstShot&&firstShot.videoUrl}};
    }
    throw new Error("Unknown task type: "+task.type);
  }
  // productions is saved via the app's global save(k) — but this module's own
  // local save() shadows it (see top of this IIFE), so route through window
  // explicitly to avoid silently calling the wrong one.
  function save2Productions(){ window.save("productions"); }

  // ── GENERATION PERMISSION GATE ──────────────────────────────────────
  // Kosmic Engine runs the whole pipeline autonomously against the user's
  // own paid API keys. Left alone, a single "go" can queue every character
  // sheet, every location plate, every storyboard and every scene video
  // without another confirmation. This lets the user require a checkpoint
  // before the steps that actually cost money.
  //
  // Only these types call a paid image/video endpoint. Everything else
  // (plan, model_select, char_plan, loc_plan, script) hits the text brain,
  // and the *_review types generate nothing at all — gating those would be
  // pure friction for no saving.
  const GENERATING_TASK_TYPES={charsheet_single:"image",charsheet_side:"image",loc_img:"image",storyboard:"image",scene:"video"};
  function permissionMode(){
    const m=gs("ke_permission_mode","always_allow");
    return ["always_allow","ask_videos","always_ask"].includes(m)?m:"always_allow";
  }
  function needsPermission(t){
    if(!t||t.permitted)return false; // already granted — never re-ask, including on retry
    const kind=GENERATING_TASK_TYPES[t.type];
    if(!kind)return false;
    const mode=permissionMode();
    if(mode==="always_ask")return true;
    if(mode==="ask_videos")return kind==="video";
    return false;
  }
  function describeBatch(batch){
    const vids=batch.filter(t=>GENERATING_TASK_TYPES[t.type]==="video");
    const imgs=batch.filter(t=>GENERATING_TASK_TYPES[t.type]==="image");
    const parts=[];
    // Deliberately describes WHAT will run rather than quoting a dollar
    // figure. Storyboard and scene tasks each fan out into an unknown number
    // of shots decided downstream, so any number shown here would be a
    // guess — and a wrong cost estimate is worse than none on a screen whose
    // entire purpose is spending confidence.
    if(vids.length)parts.push(`${vids.length} video generation${vids.length!==1?'s':''}`);
    if(imgs.length)parts.push(`${imgs.length} image generation${imgs.length!==1?'s':''}`);
    return parts.join(" + ")||"generation";
  }
  function requestPermission(batch){
    S.directorChat.awaitingPermissionIds=batch.map(t=>t.id);
    save();
    // The running total belongs here specifically: this is the one moment the
    // user is being asked to authorise more spend, so it's the one moment the
    // figure changes a decision.
    const prod=(S.productions||[]).find(x=>x.id===S.directorChat.productionId);
    const sofar=prod&&prod.costSpent?` This production has cost about $${prod.costSpent.toFixed(2)} so far.`:"";
    push("agent",`⏸ Ready to run ${describeBatch(batch)} — this spends real credits on your API keys.${sofar}\n\n${batch.map(t=>`• ${t.label}`).join("\n")}`,{permission:true});
  }
  function allowGeneration(){
    const ids=S.directorChat.awaitingPermissionIds||[];
    if(!ids.length)return;
    ids.forEach(id=>{const t=findTask(id);if(t)t.permitted=true;});
    S.directorChat.awaitingPermissionIds=null;
    S.directorChat.permissionPaused=false;
    save();
    dispatchTasks();
  }
  function declineGeneration(){
    if(!S.directorChat.awaitingPermissionIds)return;
    // Deliberately does NOT skip the task or mark it done. Every generating
    // task has dependents that read its output, so "skip" would leave the
    // pipeline structurally broken in a way that only surfaces later, deep
    // in an unrelated step. Pausing keeps the graph intact and fully
    // resumable.
    S.directorChat.awaitingPermissionIds=null;
    S.directorChat.permissionPaused=true;
    save();
    push("agent","Paused — nothing else will run until you resume. Nothing was lost; the production picks up exactly where it stopped.",{resumable:true});
  }
  function resumeProduction(){
    if(!S.directorChat.permissionPaused)return;
    S.directorChat.permissionPaused=false;
    save();
    dispatchTasks();
  }
  function setPermissionMode(mode){
    if(!["always_allow","ask_videos","always_ask"].includes(mode))return;
    saveSetting("ke_permission_mode",mode);
    closePermissionSettings();
    const label={always_allow:"run freely",ask_videos:"ask before videos",always_ask:"ask before every generation"}[mode];
    toast(`Kosmic Engine will ${label}`,"success");
    renderThread();
  }
  function closePermissionSettings(){
    const el=document.getElementById("dcPermModal");
    if(el)el.remove();
  }
  function openPermissionSettings(){
    closePermissionSettings();
    const cur=permissionMode();
    const opts=[
      {v:"always_allow",t:"Always allow",d:"Kosmic Engine generates freely without asking."},
      {v:"ask_videos",t:"Ask before videos",d:"Asks before generating video — by far the most expensive step. Images and text run freely."},
      {v:"always_ask",t:"Always ask",d:"Asks before every image and video generation."},
    ];
    const overlay=document.createElement("div");
    overlay.className="modal-overlay show";
    overlay.id="dcPermModal";
    overlay.onclick=(e)=>{if(e.target===overlay)closePermissionSettings();};
    overlay.innerHTML=`<div class="modal" style="width:420px">
      <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);margin-bottom:4px">Generation permissions</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:16px">Kosmic Engine runs the whole pipeline on your own API keys. Choose when it should stop and check with you first.</div>
      ${opts.map(o=>`<div onclick="KosmicEngine.setPermissionMode('${o.v}')" style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:12px;cursor:pointer;margin-bottom:6px;border:1.5px solid ${cur===o.v?'var(--vs)':'var(--border)'};background:${cur===o.v?'var(--lav)':'transparent'}">
        <div style="width:16px;height:16px;border-radius:50%;border:1.5px solid ${cur===o.v?'var(--violet)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${cur===o.v?'<div style="width:8px;height:8px;border-radius:50%;background:var(--violet)"></div>':''}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:${cur===o.v?'var(--violet)':'var(--text)'}">${o.t}</div>
          <div style="font-size:11px;color:var(--textm);line-height:1.4;margin-top:2px">${o.d}</div>
        </div>
      </div>`).join('')}
      <div style="text-align:right;margin-top:14px"><button class="btn btn-ghost" onclick="KosmicEngine.closePermissionSettings()">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
  }

  // ── AUTO-REVIEW ─────────────────────────────────────────────────────
  // The permission gate controls SPEND; this controls ATTENTION. A five
  // episode production currently needs roughly seventeen manual approvals,
  // which makes an otherwise autonomous pipeline something you have to babysit.
  function autoReviewMode(){
    const m=gs("ke_auto_review","off");
    return ["off","qa_pass","all"].includes(m)?m:"off";
  }
  // Returns a human-readable REASON when auto-approval applies, or null to
  // leave the gate for the user. Reason-not-boolean so the chat can say why
  // it approved — an approval the user didn't make should never be silent.
  function autoApproveReason(t){
    const mode=autoReviewMode();
    if(mode==="off")return null;
    if(mode==="all")return "auto-review is set to approve everything";
    // qa_pass: the ONLY safe signal is a check that genuinely ran and passed.
    // A missing verdict means the check never happened (no vision brain, an
    // unreadable reply, a network error) — that is not evidence of quality,
    // so it waits. Script and scene tasks have no image to check at all and
    // therefore always wait in this mode, which is correct: those are
    // creative calls, not quality calls.
    const qa=t.qa;
    if(qa&&qa.ran&&qa.passed)return "quality check passed";
    return null;
  }
  function closeAutoReviewSettings(){
    const el=document.getElementById("dcAutoModal");
    if(el)el.remove();
  }
  function setAutoReviewMode(mode){
    if(!["off","qa_pass","all"].includes(mode))return;
    saveSetting("ke_auto_review",mode);
    closeAutoReviewSettings();
    toast({off:"Every checkpoint will wait for you",qa_pass:"Passing quality checks will auto-approve",all:"All checkpoints will auto-approve"}[mode],"success");
    renderThread();
  }
  function openAutoReviewSettings(){
    closeAutoReviewSettings();
    const cur=autoReviewMode();
    const opts=[
      {v:"off",t:"Review everything myself",d:"Every checkpoint waits for your Approve or Reject. This is the default."},
      {v:"qa_pass",t:"Auto-approve when the quality check passes",d:"Character sheets, locations and storyboards approve themselves only if the vision quality check actually ran and passed. Scripts and scenes still wait for you — those are creative calls, and they have no image to check."},
      {v:"all",t:"Auto-approve everything",d:"Nothing waits. The whole production runs start to finish unattended. Spending is still governed separately by Generation permissions."},
    ];
    const overlay=document.createElement("div");
    overlay.className="modal-overlay show";
    overlay.id="dcAutoModal";
    overlay.onclick=(e)=>{if(e.target===overlay)closeAutoReviewSettings();};
    overlay.innerHTML=`<div class="modal" style="width:440px">
      <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);margin-bottom:4px">Auto-review</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:16px">How much of the approving should Kosmic Engine do on your behalf?</div>
      ${opts.map(o=>`<div onclick="KosmicEngine.setAutoReviewMode('${o.v}')" style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:12px;cursor:pointer;margin-bottom:6px;border:1.5px solid ${cur===o.v?'var(--vs)':'var(--border)'};background:${cur===o.v?'var(--lav)':'transparent'}">
        <div style="width:16px;height:16px;border-radius:50%;border:1.5px solid ${cur===o.v?'var(--violet)':'var(--border)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${cur===o.v?'<div style="width:8px;height:8px;border-radius:50%;background:var(--violet)"></div>':''}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:${cur===o.v?'var(--violet)':'var(--text)'}">${o.t}</div>
          <div style="font-size:11px;color:var(--textm);line-height:1.4;margin-top:2px">${o.d}</div>
        </div>
      </div>`).join('')}
      <div style="text-align:right;margin-top:14px"><button class="btn btn-ghost" onclick="KosmicEngine.closeAutoReviewSettings()">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
  }

  async function dispatchTasks(){
    const tasks=S.directorChat.tasks;
    // Extends the existing "don't dispatch while waiting on the user" guard
    // rather than adding a parallel mechanism — awaiting approval, awaiting
    // permission and paused are all the same class of stop condition, and
    // splitting them across different checks is how re-entrancy bugs get in.
    if(!tasks||S.directorChat.awaitingApprovalTaskId||S.directorChat.awaitingPermissionIds||S.directorChat.permissionPaused)return;
    const ready=tasks.filter(t=>t.status==="pending"&&depsSatisfied(t));
    if(!ready.length)return;
    const parallelReady=ready.filter(t=>t.parallel);
    const sequentialReady=ready.filter(t=>!t.parallel);
    if(parallelReady.length){
      // Asked once for the whole batch, not once per task: character sheets
      // and location plates fan out to one task per character/location, so
      // per-task prompts would mean 5+ identical dialogs back to back for a
      // single logical step.
      const gated=parallelReady.filter(needsPermission);
      if(gated.length){requestPermission(gated);return;}
      parallelReady.forEach(t=>t.status="running");
      save();
      await Promise.allSettled(parallelReady.map(async t=>{
        try{
          const out=await runTaskWork(t);
          t.status="done";
          t.error=null;
          if(out&&out.summary)push("agent",out.summary,out.approval?{approval:out.approval,taskId:t.id}:{taskId:t.id});
        }catch(err){
          t.status="error";
          t.error=err.message;
        }
      }));
      save();
      const failed=parallelReady.filter(t=>t.status==="error");
      if(failed.length){
        const lines=await Promise.all(failed.map(async t=>`${t.label}: ${await normalizeError(t.error,guessProvider(t))}`));
        push("agent","",{error:`${failed.length} of ${parallelReady.length} parallel task(s) failed —\n\n${lines.join('\n\n')}`,retryable:true,retryTaskIds:failed.map(t=>t.id)});
      }
      await dispatchTasks();
      return;
    }
    if(sequentialReady.length){
      const t=sequentialReady[0];
      if(needsPermission(t)){requestPermission([t]);return;}
      t.status="running";
      save();
      if(!t.requiresApproval&&t.type!=="plan")push("agent",`⏳ ${t.label}…`,{taskId:t.id});
      else if(t.type==="plan")push("agent","📋 Planning your production…");
      try{
        const out=await runTaskWork(t);
        if(t.requiresApproval){
          t.status="awaiting_approval";
          S.directorChat.awaitingApprovalTaskId=t.id;
          save();
          if(out&&out.summary)push("agent",out.summary,{approval:out.approval,taskId:t.id});
          // Routed through the exact approve() the user's button calls, so
          // auto-approval and manual approval cannot drift apart in what they
          // actually do (memory writes, stage advancement, re-dispatch).
          const reason=autoApproveReason(t);
          if(reason){
            push("agent",`✓ Auto-approved — ${reason}.`,{taskId:t.id});
            await approve();
          }
          return; // wait for the user
        }
        t.status="done";
        t.error=null;
        save();
        if(out&&out.summary)push("agent",out.summary,{taskId:t.id});
      }catch(err){
        t.status="error";
        t.error=err.message;
        save();
        const normalized=await normalizeError(err.message,guessProvider(t));
        push("agent","",{error:normalized,retryable:true,retryTaskIds:[t.id],taskId:t.id});
        return;
      }
      await dispatchTasks();
    }
  }

  // ── LIVE TASK PANEL ─────────────────────────────────────────────────
  // Surfaces the task graph that already drives dispatchTasks(). Purely a
  // read-only view — it never mutates task state, so it cannot affect the
  // pipeline's actual behaviour.
  //
  // Self-contained escaper rather than reusing index.html's escapeHtml():
  // several task labels interpolate AI-authored text (character names from
  // the Promptwriter, location names from loc_plan), so these strings are
  // genuinely untrusted. Keeping the escaper local means this module can't
  // break if that global is ever renamed or moved during a future split.
  //
  // Escapes quotes as well as angle brackets, which index.html's escapeHtml
  // does NOT — the intake Q&A echoes free-text answers back into a value=""
  // attribute, where an unescaped quote breaks out of the attribute. Quote
  // escaping is harmless in text-node positions (renders as a literal quote),
  // so one escaper stays correct in both contexts.
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

  let _taskPanelCollapsed=false;
  function toggleTaskPanel(){_taskPanelCollapsed=!_taskPanelCollapsed;renderTaskPanel();}

  // Groups a flat task into a human-meaningful section. Episode tasks carry
  // epIndex; everything else is identified by type. Order matters — this
  // drives display order, and it deliberately matches real dependency order
  // so the list never appears to jump backwards as work progresses.
  function taskGroupOf(t){
    if(t.epIndex)return{key:"ep_"+t.epIndex,label:`Episode ${t.epIndex}`,order:100+t.epIndex};
    if(t.type==="plan"||t.type==="model_select")return{key:"setup",label:"Setup",order:1};
    if(t.type==="char_plan"||t.type==="charsheet_single"||t.type==="charsheet_side"||t.type==="charsheet_review")return{key:"chars",label:"Characters",order:2};
    if(t.type==="loc_plan"||t.type==="loc_img"||t.type==="loc_review")return{key:"locs",label:"Locations",order:3};
    return{key:"other",label:"Other",order:99};
  }
  function taskStatusVisual(status){
    if(status==="done")return{icon:`<span style="color:var(--green);display:flex">${pIcon('check',13)}</span>`,color:"var(--textm)",weight:"400"};
    if(status==="running")return{icon:`<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>`,color:"var(--violet)",weight:"700"};
    if(status==="awaiting_approval")return{icon:`<span style="width:13px;height:13px;border-radius:50%;background:var(--gold);display:inline-block;animation:pulse 1.4s ease-in-out infinite;flex-shrink:0"></span>`,color:"var(--gold)",weight:"700"};
    if(status==="error")return{icon:`<span style="color:var(--red);font-weight:800;font-size:13px;line-height:1">✕</span>`,color:"var(--red)",weight:"700"};
    return{icon:`<span style="width:13px;height:13px;border-radius:50%;border:1.5px solid var(--border);display:inline-block;flex-shrink:0"></span>`,color:"var(--textm)",weight:"400"};
  }
  function renderTaskPanel(){
    const panel=document.getElementById("dcTaskPanel");
    if(!panel)return; // gate screen, or module not currently mounted
    const tasks=S.directorChat.tasks;
    if(!tasks||!tasks.length){panel.innerHTML="";panel.style.display="none";return;}
    panel.style.display="block";
    const total=tasks.length;
    const doneCount=tasks.filter(t=>t.status==="done").length;
    const pct=total?Math.round((doneCount/total)*100):0;
    const hasError=tasks.some(t=>t.status==="error");
    // Live spend for THIS production. Kosmic Engine is the screen that
    // actually spends the money — it ran the whole pipeline autonomously —
    // yet the only place this figure existed was the Production Pipeline's
    // detail view, which you have to navigate away to see. Showing it beside
    // the progress bar is what makes the permission gate an informed choice
    // rather than a blind one.
    const prod=(S.productions||[]).find(x=>x.id===S.directorChat.productionId);
    const spent=prod?(prod.costSpent||0):0;

    // Group, preserving each group's first-appearance task order within it.
    const groups=[];
    tasks.forEach(t=>{
      const g=taskGroupOf(t);
      let bucket=groups.find(x=>x.key===g.key);
      if(!bucket){bucket={...g,items:[]};groups.push(bucket);}
      bucket.items.push(t);
    });
    groups.sort((a,b)=>a.order-b.order);

    const listHTML=groups.map(g=>{
      const gDone=g.items.filter(t=>t.status==="done").length;
      return `<div style="margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:9.5px;font-weight:800;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">
          <span>${esc(g.label)}</span><span>${gDone}/${g.items.length}</span>
        </div>
        ${g.items.map(t=>{
          const v=taskStatusVisual(t.status);
          const isActive=t.status==="running"||t.status==="awaiting_approval";
          return `<div data-active="${isActive?1:0}" style="display:flex;align-items:flex-start;gap:7px;padding:3px 4px;border-radius:6px;${isActive?'background:rgba(98,64,176,0.07)':''}">
            <div style="flex-shrink:0;width:13px;height:13px;display:flex;align-items:center;justify-content:center;margin-top:1px">${v.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;color:${v.color};font-weight:${v.weight};line-height:1.35">${esc(t.label)}</div>
              ${t.status==="error"&&t.error?`<div style="font-size:9.5px;color:var(--red);opacity:0.85;line-height:1.3;margin-top:1px">${esc(String(t.error).slice(0,120))}</div>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    panel.innerHTML=`
      <div style="border-bottom:1px solid var(--border);background:var(--pearl2)">
        <div onclick="KosmicEngine.toggleTaskPanel()" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer">
          <div style="font-size:10px;font-weight:800;color:var(--violet);text-transform:uppercase;letter-spacing:0.06em">Production Progress</div>
          <div style="flex:1;height:4px;border-radius:2px;background:var(--lav);overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${hasError?'var(--red)':'linear-gradient(90deg,var(--violet),var(--ice))'};transition:width 0.3s"></div>
          </div>
          <div style="font-size:10px;font-weight:700;color:var(--textm);flex-shrink:0">${doneCount}/${total}</div>
          ${prod?`<div style="font-size:10px;font-weight:800;color:var(--gold);flex-shrink:0" title="Estimated spend on this production so far">$${spent.toFixed(2)}</div>`:''}
          <div style="color:var(--textm);transform:rotate(${_taskPanelCollapsed?0:180}deg);display:flex">${pIcon('chevron',13)}</div>
        </div>
        ${_taskPanelCollapsed?'':`<div id="dcTaskList" style="max-height:190px;overflow-y:auto;padding:2px 12px 10px">${listHTML}</div>`}
      </div>`;

    // Keep the in-progress task visible without yanking the whole page —
    // scrollIntoView() would scroll the nearest scrollable ancestor chain and
    // can jump the module view on mobile, so this positions the inner list
    // directly instead.
    if(!_taskPanelCollapsed){
      const list=document.getElementById("dcTaskList");
      const active=list&&list.querySelector('[data-active="1"]');
      if(list&&active)list.scrollTop=Math.max(0,active.offsetTop-list.clientHeight/2);
    }
  }

  // Per-message rendering, split out of renderThread so the thread can group
  // messages into collapsible per-task blocks without duplicating any of the
  // extra-card logic (approval / error / permission / questions / resume).
  function renderMessage(m,i){
      if(m.role==="user")return `<div class="ig-bubble-user">${m.content}</div>`;
      let extra="";
      if(m.approval)extra=`<div class="dc-approval-card">
        ${m.approval.images?`<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">${m.approval.images.filter(Boolean).map(u=>`<img src="${esc(u)}" onclick="KosmicEngine.viewGeneration('${esc(u)}','image')" style="width:150px;height:150px;object-fit:cover;flex-shrink:0;border-radius:10px;border:1px solid var(--glass-brd);cursor:pointer">`).join('')}</div>`:''}
        ${m.approval.video?`<video src="${esc(m.approval.video)}" controls playsinline style="width:100%;border-radius:10px;border:1px solid var(--glass-brd)"></video>`:''}
        ${m.approval.text?`<div style="font-size:11px;color:var(--text);white-space:pre-wrap">${m.approval.text}</div>`:''}
        ${m.approval.qaNote?`<div style="font-size:10px;color:var(--gold);background:rgba(212,175,55,0.1);border-radius:6px;padding:5px 8px;margin-top:6px">🔍 QA note: ${m.approval.qaNote}</div>`:''}
        <div class="dc-approval-actions">
          <button class="btn btn-primary btn-xs" onclick="KosmicEngine.approve()">✅ Approve</button>
          <button class="btn btn-danger btn-xs" onclick="KosmicEngine.reject()">❌ Reject</button>
        </div>
      </div>`;
      if(m.error){
        // Only show Retry if the specific task(s) THIS card is about are still
        // actually in error status right now — an old card whose task was
        // already retried and resolved (or superseded) shouldn't offer a
        // button that would silently act on a different, unrelated task.
        const stillPending=m.retryable&&m.retryTaskIds&&m.retryTaskIds.some(id=>{const t=findTask(id);return t&&t.status==="error";});
        extra=`<div class="dc-error-card">❌ ${m.error}${stillPending?`<div style="margin-top:6px"><button class="btn btn-outline btn-xs" onclick="KosmicEngine.retry(${i})">🔄 Retry</button></div>`:''}</div>`;
      }
      // Same staleness reasoning as the Retry button above: once the
      // production has actually started, this card's button would act on a
      // stage that no longer exists, so it stops being offered rather than
      // sitting there looking actionable.
      // Same staleness reasoning as the Retry button above: these only stay
      // actionable while the state they act on is still live, so an old card
      // can't fire an action against a production that already moved on.
      if(m.permission&&S.directorChat.awaitingPermissionIds&&S.directorChat.awaitingPermissionIds.length){
        extra+=`<div class="dc-approval-card">
          <div class="dc-approval-actions">
            <button class="btn btn-primary btn-xs" onclick="KosmicEngine.allowGeneration()">▶ Generate</button>
            <button class="btn btn-outline btn-xs" onclick="KosmicEngine.declineGeneration()">⏸ Not now</button>
          </div>
        </div>`;
      }
      if(m.resumable&&S.directorChat.permissionPaused){
        extra+=`<div style="margin-top:8px"><button class="btn btn-primary btn-xs" onclick="KosmicEngine.resumeProduction()">▶ Resume production</button></div>`;
      }
      if(m.questions&&S.directorChat.intakeStage==="confirm_plan"){
        const total=intakeQuestions().length;
        const done=answeredCount();
        extra+=`<div style="margin-top:8px">
          <button class="btn btn-primary btn-xs" onclick="KosmicEngine.openIntakeQuestions()">◆ Set up production${done?` · ${done}/${total} answered`:''}</button>
        </div>`;
      }
      return `<div class="ig-bubble-assistant">${m.content}${extra}</div>`;
  }

  // Manual open/closed overrides, keyed by task id. Ephemeral on purpose:
  // which sections you had folded is a viewing preference, not production
  // state, and persisting it would sync noise to Firebase on every toggle.
  const _blockOverride={};
  function isBlockOpen(taskId,t){
    if(taskId in _blockOverride)return _blockOverride[taskId];
    // Default: finished work folds away, anything still live stays open.
    // Errors stay open too — a collapsed failure is a failure you miss.
    return !t||t.status!=="done";
  }
  function toggleBlock(taskId){
    const t=findTask(taskId);
    _blockOverride[taskId]=!isBlockOpen(taskId,t);
    renderThread();
  }
  function renderBlock(b){
    const inner=b.items.map(([m,i])=>renderMessage(m,i)).join('');
    if(!b.taskId)return inner;
    const t=findTask(b.taskId);
    // A task can genuinely vanish from under its messages — New Chat clears
    // the graph while the transcript is still on screen, and a restored
    // session can carry messages whose tasks were never rebuilt. Falling back
    // to flat rendering keeps that content visible instead of hiding it
    // behind a header that has nothing to describe it.
    if(!t)return inner;
    const open=isBlockOpen(b.taskId,t);
    const v=taskStatusVisual(t.status);
    return `<div style="border:1px solid var(--glass-brd);border-radius:12px;margin-bottom:8px;overflow:hidden;background:var(--glass)">
      <div onclick="KosmicEngine.toggleBlock('${esc(b.taskId)}')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer">
        <div style="width:13px;height:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${v.icon}</div>
        <div style="flex:1;min-width:0;font-size:11.5px;font-weight:${open?'700':'600'};color:${open?'var(--text)':'var(--textm)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.label)}</div>
        <div style="color:var(--textm);flex-shrink:0;transform:rotate(${open?180:0}deg);display:flex">${pIcon('chevron',12)}</div>
      </div>
      ${open?`<div style="padding:0 11px 10px">${inner}</div>`:''}
    </div>`;
  }
  function renderThread(){
    const thread=document.getElementById("dcThread");
    if(!thread)return;
    // Consecutive agent messages sharing a taskId become one collapsible
    // block. Runs of messages are grouped rather than all messages with the
    // same id, so a task that reports again later (a retry) reads as a
    // separate block in the transcript instead of being folded backwards
    // into the original attempt.
    const blocks=[];
    S.directorChat.messages.forEach((m,i)=>{
      const gid=(m.role!=="user"&&m.taskId)?m.taskId:null;
      const last=blocks[blocks.length-1];
      if(gid&&last&&last.taskId===gid){last.items.push([m,i]);return;}
      blocks.push({taskId:gid,items:[[m,i]]});
    });
    thread.innerHTML=blocks.map(renderBlock).join('');
    thread.scrollTop=thread.scrollHeight;
    // enterProject() is async and repaints via renderThread() on every one of
    // its several exit paths. Without this, opening the module while the
    // Notebook tab was active would leave it showing the pre-load empty state
    // until the next unrelated event. Cheap no-op while the Chat tab is up.
    if(_engineTab==="notebook"){
      try{ renderNotebook(); }catch(err){ console.warn("Notebook render failed (non-blocking):",err); }
    }
  }

  // ── STRUCTURED INTAKE Q&A ───────────────────────────────────────────
  // Replaces the undiscoverable "type '3 episodes' or '20 seconds'" regex
  // flow as the PRIMARY way to set up a production. The regex path is
  // deliberately kept working alongside this (some flows/muscle memory rely
  // on it) — this is additive, not a replacement.
  //
  // Scope note: these are the STRUCTURAL questions the pipeline genuinely
  // needs, each mapping to a real existing draft field. Agent-One-style
  // *creative* questions ("which moment should lead?") are a separate,
  // later thing — they'd feed the concept text rather than draft fields,
  // and would need an AI call with its own failure handling. Building the
  // deterministic set first means the modal infrastructure exists with zero
  // new AI-failure surface.
  const INTAKE_LIMITS={episodeCount:{min:1,max:10},duration:{min:4,max:60}};
  function clampInt(v,min,max,fallback){
    const n=parseInt(v,10);
    if(!isFinite(n))return fallback;
    return Math.min(max,Math.max(min,n));
  }
  function intakeQuestions(){
    const d=S.directorChat.draft||{};
    const a=S.directorChat.qaAnswers||{};
    return [
      {id:"episodeCount",label:"How many episodes?",kind:"int",
       hint:`${INTAKE_LIMITS.episodeCount.min}–${INTAKE_LIMITS.episodeCount.max}`,
       options:[{v:"1",l:"1 episode"},{v:"2",l:"2 episodes"},{v:"3",l:"3 episodes"},{v:"5",l:"5 episodes"}],
       value:a.episodeCount!==undefined?a.episodeCount:String(d.episodeCount||1)},
      {id:"duration",label:"How long, in total?",kind:"int",
       hint:`${INTAKE_LIMITS.duration.min}–${INTAKE_LIMITS.duration.max} seconds`,
       options:[{v:"8",l:"8 seconds"},{v:"15",l:"15 seconds"},{v:"30",l:"30 seconds"},{v:"60",l:"60 seconds"}],
       value:a.duration!==undefined?a.duration:String(d.totalDurationRounded||8)},
      {id:"aspectRatio",label:"Aspect ratio?",kind:"enum",
       // Only ratios supported by EVERY video model this pipeline can pick
       // (verified against PD_ASPECT_RATIOS across the Seedance and Kling
       // families) — offering one the chosen model rejects would fail at
       // generation time, long after the user made the choice.
       options:[{v:"16:9",l:"16:9 cinematic"},{v:"9:16",l:"9:16 vertical"},{v:"1:1",l:"1:1 square"}],
       value:a.aspectRatio!==undefined?a.aspectRatio:(d.aspectRatio||"16:9")},
      {id:"continuity",label:"Continuity between shots?",kind:"enum",
       options:[{v:"both",l:"Narrative + visual"},{v:"narrative",l:"Narrative only"},{v:"visual",l:"Visual only"},{v:"none",l:"None"}],
       value:a.continuity!==undefined?a.continuity:(d.continuity||"both")},
    ];
  }
  function answeredCount(){
    const a=S.directorChat.qaAnswers||{};
    return intakeQuestions().filter(q=>a[q.id]!==undefined&&String(a[q.id]).trim()!=="").length;
  }
  function setIntakeAnswer(id,value){
    S.directorChat.qaAnswers=S.directorChat.qaAnswers||{};
    S.directorChat.qaAnswers[id]=value;
    save();
    renderIntakeModal();
  }
  // Free-text updates deliberately do NOT re-render the modal: rebuilding
  // innerHTML on every keystroke destroys the input and loses focus/caret
  // mid-typing. Only the counter is patched in place.
  function setIntakeAnswerText(id,value){
    S.directorChat.qaAnswers=S.directorChat.qaAnswers||{};
    S.directorChat.qaAnswers[id]=value;
    save();
    const counter=document.getElementById("dcQaCounter");
    if(counter)counter.textContent=`${answeredCount()} of ${intakeQuestions().length} answered`;
    // Out-of-range values are clamped on submit. Doing that silently meant a
    // typed 12 quietly became 10 with no feedback until the summary appeared
    // afterwards, which reads as the app ignoring the input.
    const warn=document.getElementById("dcQaWarn_"+id);
    if(warn){
      const lim=id==="episodeCount"?INTAKE_LIMITS.episodeCount:id==="duration"?INTAKE_LIMITS.duration:null;
      const raw=String(value).trim();
      const n=parseInt(raw,10);
      if(lim&&raw!==""&&isFinite(n)&&(n<lim.min||n>lim.max)){
        warn.textContent=`Max is ${lim.max}${lim.min>1?` and min is ${lim.min}`:''} — ${n} will be used as ${Math.min(lim.max,Math.max(lim.min,n))}.`;
        warn.style.display="block";
      } else if(lim&&raw!==""&&!isFinite(n)){
        warn.textContent="That isn't a number — the default will be used.";
        warn.style.display="block";
      } else {
        warn.style.display="none";
      }
    }
  }
  function openIntakeQuestions(){
    if(S.directorChat.intakeStage!=="confirm_plan"||!S.directorChat.draft){
      toast("Setup questions are only available before a production starts","");
      return;
    }
    renderIntakeModal();
  }
  function closeIntakeQuestions(){
    const el=document.getElementById("dcQaModal");
    if(el)el.remove();
  }
  function renderIntakeModal(){
    closeIntakeQuestions();
    const qs=intakeQuestions();
    const a=S.directorChat.qaAnswers||{};
    const overlay=document.createElement("div");
    overlay.className="modal-overlay show";
    overlay.id="dcQaModal";
    overlay.onclick=(e)=>{if(e.target===overlay)closeIntakeQuestions();};
    overlay.innerHTML=`<div class="modal" style="width:440px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet)">${esc(S.directorChat.directorName)} is waiting</div>
        <span class="badge badge-violet" id="dcQaCounter">${answeredCount()} of ${qs.length} answered</span>
      </div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:16px">Set these before I start — or Skip to use the defaults shown.</div>
      ${qs.map((q,i)=>{
        const cur=a[q.id]!==undefined?String(a[q.id]):String(q.value);
        const isPreset=q.options.some(o=>o.v===cur);
        return `<div style="margin-bottom:16px">
          <div style="display:flex;align-items:baseline;gap:7px;margin-bottom:7px">
            <span style="width:18px;height:18px;border-radius:50%;background:var(--lav);color:var(--violet);font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
            <span style="font-size:13px;font-weight:700;color:var(--text)">${esc(q.label)}</span>
            ${q.hint?`<span style="font-size:10px;color:var(--texts)">${esc(q.hint)}</span>`:''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${q.kind==="int"?'6px':'0'}">
            ${q.options.map(o=>`<button type="button" class="btn ${cur===o.v?'btn-primary':'btn-outline'} btn-xs" onclick="KosmicEngine.setIntakeAnswer('${esc(q.id)}','${esc(o.v)}')">${esc(o.l)}</button>`).join('')}
          </div>
          ${q.kind==="int"?`<input class="f-input" style="font-size:12px;padding:7px 10px" inputmode="numeric" placeholder="Or type your own number…" value="${isPreset?'':esc(cur)}" oninput="KosmicEngine.setIntakeAnswerText('${esc(q.id)}',this.value)"><div id="dcQaWarn_${esc(q.id)}" style="font-size:10.5px;color:var(--gold);margin-top:4px;display:none"></div>`:''}
        </div>`;
      }).join('')}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn btn-ghost" onclick="KosmicEngine.skipIntakeQuestions()">Skip</button>
        <button class="btn btn-primary" onclick="KosmicEngine.submitIntakeAnswers()">Submit answers</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
  }
  function skipIntakeQuestions(){
    closeIntakeQuestions();
    push("agent",`No problem — I'll use the defaults. Say "go" whenever you're ready.`);
  }
  async function submitIntakeAnswers(){
    // Stale-modal guard. The modal can outlive the stage it belongs to: the
    // user can leave it open, type "go" in the chat to start production the
    // old way, then come back and hit Submit. Without this, that would
    // rewrite the draft and rebuild the task graph underneath a production
    // that is already running.
    if(S.directorChat.intakeStage!=="confirm_plan"||!S.directorChat.draft){
      closeIntakeQuestions();
      toast("That production already started — those answers weren't applied","");
      return;
    }
    const a=S.directorChat.qaAnswers||{};
    const d=S.directorChat.draft;
    const eps=clampInt(a.episodeCount,INTAKE_LIMITS.episodeCount.min,INTAKE_LIMITS.episodeCount.max,d.episodeCount||1);
    const dur=clampInt(a.duration,INTAKE_LIMITS.duration.min,INTAKE_LIMITS.duration.max,d.totalDurationRounded||8);
    const validRatios=["16:9","9:16","1:1"];
    const ratio=validRatios.includes(a.aspectRatio)?a.aspectRatio:(d.aspectRatio||"16:9");
    const validCont=["both","narrative","visual","none"];
    const cont=validCont.includes(a.continuity)?a.continuity:(d.continuity||"both");

    d.episodeCount=eps;
    d.totalDurationRequested=dur;
    d.totalDurationRounded=dur;
    d.aspectRatio=ratio;
    d.continuity=cont;

    // Advance the stage BEFORE any await. Submit is async (dispatchTasks is
    // awaited below), so leaving the stage unchanged across that boundary
    // would let a fast double-tap pass the guard twice and build the task
    // graph — and start the production — two times over.
    S.directorChat.intakeStage="running";
    S.directorChat.qaAnswers={};
    closeIntakeQuestions();

    const contLabel={both:"narrative + visual",narrative:"narrative only",visual:"visual only",none:"none"}[cont];
    push("agent",`Locked in:\n• Episodes → ${eps}\n• Total length → ${dur}s\n• Aspect ratio → ${ratio}\n• Continuity → ${contLabel}\n\nStarting now.`);

    S.directorChat.tasks=buildTaskGraph(eps);
    save();
    await dispatchTasks();
  }


  // Single owner of "which session should be on screen for this project".
  // Previously the module-entry logic only asked "are there any messages?",
  // which is why a session belonging to a different project rendered happily
  // after a switch.
  // ── MANUAL SESSION RECOVERY ─────────────────────────────────────────
  // The automatic legacy adoption in enterProject fires on the FIRST project
  // opened after the update and then flags itself done — which is wrong if
  // that wasn't the project the work belonged to. This lists every session
  // that actually exists and lets the user put it where it belongs, instead
  // of the app guessing. Deliberately ignores ke_legacy_migrated: the whole
  // point is to recover after the automatic pass went somewhere unhelpful.
  // ── ENGINE ACTION MENU ──────────────────────────────────────────────
  // Four labelled buttons in the header needed ~426px on a ~330px phone
  // content width, and .ig-chat-header is a non-wrapping flex row — so they
  // silently overflowed and the Restore button was simply not reachable.
  // Collapsing to a menu also means future actions cost no header width at
  // all, rather than pushing the next one off-screen again.
  // ── NOTEBOOK ────────────────────────────────────────────────────────
  // A structured document view of what the production has actually produced,
  // as opposed to the chat log's chronological narration. The chat answers
  // "what happened"; the Notebook answers "what do I have". Reads straight
  // off the production record rather than off chat messages, so it stays
  // correct even after a session restore, a New Chat, or a resumed
  // production where the narration no longer exists.
  function setEngineTab(tab){
    _engineTab=tab==="notebook"?"notebook":"chat";
    const chat=document.getElementById("dcThread");
    const nb=document.getElementById("dcNotebook");
    const bar=document.getElementById("dcInputBar");
    const tabs=document.getElementById("dcTabs");
    if(chat)chat.style.display=_engineTab==="chat"?"":"none";
    if(nb)nb.style.display=_engineTab==="notebook"?"":"none";
    // The input bar is meaningless on the Notebook — there is nothing to
    // reply to there — and on a phone it costs real vertical space.
    if(bar)bar.style.display=_engineTab==="chat"?"":"none";
    if(tabs)tabs.innerHTML=engineTabsHTML();
    if(_engineTab==="notebook")renderNotebook();
    else renderThread();
  }
  function engineTabsHTML(){
    const mk=(id,label)=>`<button onclick="KosmicEngine.setEngineTab('${id}')" style="flex:1;padding:8px 4px;border:none;background:none;cursor:pointer;font-size:11.5px;font-weight:${_engineTab===id?'800':'600'};color:${_engineTab===id?'var(--violet)':'var(--textm)'};border-bottom:2px solid ${_engineTab===id?'var(--violet)':'transparent'}">${label}</button>`;
    return mk("chat","Chat")+mk("notebook","Notebook");
  }
  function nbSection(n,title,sub,body){
    return `<div style="margin-bottom:22px">
      <div style="display:flex;align-items:baseline;gap:7px;margin-bottom:2px">
        <span style="font-size:11px;font-weight:800;color:var(--vs)">#${n}</span>
        <span style="font-family:'Cinzel',serif;font-size:14px;font-weight:700;color:var(--text)">${esc(title)}</span>
      </div>
      ${sub?`<div style="font-size:10.5px;color:var(--textm);margin-bottom:8px">${esc(sub)}</div>`:'<div style="height:6px"></div>'}
      ${body}
    </div>`;
  }
  function nbImage(url,caption,meta){
    return `<div style="margin-bottom:10px">
      <img src="${esc(url)}" loading="lazy" onclick="KosmicEngine.viewGeneration('${esc(url)}','image')" style="width:100%;border-radius:12px;border:1px solid var(--glass-brd);cursor:pointer;display:block">
      ${caption?`<div style="font-size:11.5px;font-weight:600;color:var(--text);margin-top:5px">${esc(caption)}</div>`:''}
      ${meta?`<div style="font-size:10px;color:var(--textm);margin-top:1px">${esc(meta)}</div>`:''}
    </div>`;
  }
  // ── ATTEMPT HISTORY ─────────────────────────────────────────────────
  // Rejecting destroyed the previous attempt outright: character sheets were
  // cleared with p.characterSheets=[] and location images were overwritten in
  // place with loc.url=result.url. Because regeneration is non-deterministic,
  // a "fix" can easily come back worse than what it replaced — and there was
  // no way back to it. Archiving costs almost nothing: these are hosted URL
  // strings, not image data.
  const ATTEMPT_HISTORY_CAP=5;
  function archiveAttempt(p,kind,items,feedback){
    if(!p||!items||!items.length)return;
    const key=kind==="chars"?"charSheetHistory":"locationHistory";
    p[key]=p[key]||[];
    // Derived from the highest version seen, NOT from array length. Using
    // length+1 breaks the moment the cap trims the front: the list stays at 5
    // so every subsequent attempt is numbered 6, and restoreAttempt matches on
    // that number — it would silently restore the wrong version.
    const nextV=p[key].reduce((m,h)=>Math.max(m,h&&h.v||0),0)+1;
    p[key].push({
      v:nextV,
      at:new Date().toISOString(),
      feedback:feedback||"",
      // Deep-copied so a later in-place mutation (loc.url=... on regenerate)
      // cannot reach back and rewrite the archived copy — which is exactly
      // how locations lost their previous version in the first place.
      items:JSON.parse(JSON.stringify(items)),
    });
    // Capped, and trimmed from the front: this whole object is serialised to
    // localStorage and pushed to Firebase on every production save, so an
    // uncapped list would grow the sync payload on every rejection forever.
    if(p[key].length>ATTEMPT_HISTORY_CAP)p[key]=p[key].slice(-ATTEMPT_HISTORY_CAP);
  }
  function restoreAttempt(kind,version){
    const p=(S.productions||[]).find(x=>x.id===S.directorChat.productionId);
    if(!p){toast("That production no longer exists","error");return;}
    // Refused mid-run on purpose: restoring while generation tasks are still
    // writing into the same arrays would have them overwrite the restored
    // version moments later, which looks like the restore silently failing.
    const busy=(S.directorChat.tasks||[]).some(t=>t.status==="running");
    if(busy){toast("Wait for the current step to finish first","error");return;}
    const key=kind==="chars"?"charSheetHistory":"locationHistory";
    const entry=(p[key]||[]).find(x=>x.v===version);
    if(!entry){toast("That version is no longer available","error");return;}
    if(kind==="chars"){
      // Archive what's on screen first, so restoring is itself undoable
      // rather than being a second destructive overwrite.
      archiveAttempt(p,"chars",p.characterSheets,"replaced by restoring v"+version);
      p.characterSheets=JSON.parse(JSON.stringify(entry.items));
    } else {
      archiveAttempt(p,"locs",p.locationBible,"replaced by restoring v"+version);
      const restored=JSON.parse(JSON.stringify(entry.items));
      // Matched by name rather than index: the location list can legitimately
      // be rebuilt between attempts, and positional restore would put the
      // wrong image on the wrong location.
      (p.locationBible||[]).forEach(l=>{
        const was=restored.find(r=>r.name===l.name);
        if(was&&was.url)l.url=was.url;
      });
    }
    save2Productions();
    renderNotebook();
    toast(`Restored version ${version}`,"success");
  }

  // Prior attempts render as a collapsed <details> beneath the live version,
  // so history is discoverable without pushing the current work down the page.
  function nbHistory(p,kind){
    const key=kind==="chars"?"charSheetHistory":"locationHistory";
    const hist=(p[key]||[]).filter(h=>h&&h.items&&h.items.length);
    if(!hist.length)return "";
    return `<details style="margin-top:2px">
      <summary style="font-size:11px;font-weight:700;color:var(--violet);cursor:pointer">Previous attempts (${hist.length})</summary>
      ${hist.slice().reverse().map(h=>{
        const urls=h.items.map(it=>kind==="chars"?it.sheetUrl:it.url).filter(Boolean);
        return `<div style="border:1px solid var(--glass-brd);border-radius:10px;padding:9px 10px;margin-top:6px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge badge-gray">v${h.v}</span>
            <span style="flex:1;font-size:10.5px;color:var(--textm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.feedback?esc(h.feedback):"no reason given"}</span>
            <button class="btn btn-outline btn-xs" onclick="KosmicEngine.restoreAttempt('${kind}',${h.v})">Restore</button>
          </div>
          <div style="display:flex;gap:5px;overflow-x:auto">${urls.map(u=>`<img src="${esc(u)}" loading="lazy" onclick="KosmicEngine.viewGeneration('${esc(u)}','image')" style="width:74px;height:74px;object-fit:cover;border-radius:7px;border:1px solid var(--glass-brd);flex-shrink:0;cursor:pointer">`).join('')}</div>
        </div>`;
      }).join('')}
    </details>`;
  }

  function renderNotebook(){
    const el=document.getElementById("dcNotebook");
    if(!el)return;
    const p=(S.productions||[]).find(x=>x.id===S.directorChat.productionId);
    if(!p){
      el.innerHTML=`<div style="padding:34px 20px;text-align:center">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Nothing produced yet</div>
        <div style="font-size:11.5px;color:var(--textm);line-height:1.5">Start a production in the Chat tab. Everything Kosmic Engine generates — character sheets, locations, storyboards and scenes — collects here as a document you can scroll.</div>
      </div>`;
      return;
    }
    let n=0;
    const parts=[];
    const sheets=(p.characterSheets||[]).filter(s=>s&&s.sheetUrl);
    if(sheets.length){
      n++;
      parts.push(nbSection(n,"Character Sheets",`${sheets.length} sheet${sheets.length!==1?'s':''}`,
        sheets.map(s=>nbImage(s.sheetUrl,s.name||"Character",s.tier?`${s.tier}${s.desc?" · "+String(s.desc).slice(0,90):""}`:"")).join('')+nbHistory(p,"chars")));
    }
    const locs=(p.locationBible||[]).filter(l=>l&&l.url);
    if(locs.length){
      n++;
      parts.push(nbSection(n,"Location Bible",`${locs.length} location${locs.length!==1?'s':''}`,
        locs.map(l=>nbImage(l.url,l.name||"Location",l.desc?String(l.desc).slice(0,110):"")).join('')+nbHistory(p,"locs")));
    }
    (p.episodes||[]).forEach(e=>{
      const frames=(e.storyboard||[]).filter(s=>s&&s.url);
      const shots=(e.shots||[]).filter(s=>s&&s.videoUrl);
      const hasScript=e.script&&e.scriptStatus!=="pending";
      if(!frames.length&&!shots.length&&!hasScript)return; // nothing produced for this episode yet
      n++;
      const bits=[];
      if(hasScript){
        bits.push(`<details style="margin-bottom:10px">
          <summary style="font-size:11.5px;font-weight:700;color:var(--violet);cursor:pointer">Script</summary>
          <div style="font-size:11.5px;color:var(--text);line-height:1.55;white-space:pre-wrap;background:var(--glass);border:1px solid var(--glass-brd);border-radius:10px;padding:10px 12px;margin-top:6px">${esc(e.script)}</div>
        </details>`);
      }
      if(frames.length){
        bits.push(`<div style="font-size:10px;font-weight:800;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em;margin:8px 0 6px">Storyboard${e.storyboardStatus==="partial"?" (partial)":""}</div>`);
        bits.push(frames.map((s,i)=>nbImage(s.url,`Shot ${i+1}`,"")).join(''));
      }
      if(shots.length){
        bits.push(`<div style="font-size:10px;font-weight:800;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em;margin:8px 0 6px">Scene${e.sceneStatus==="partial"?" (partial)":""}</div>`);
        bits.push(shots.map(s=>`<video src="${esc(s.videoUrl)}" controls playsinline preload="metadata" style="width:100%;border-radius:12px;border:1px solid var(--glass-brd);margin-bottom:10px;display:block"></video>`).join(''));
      }
      parts.push(nbSection(n,`Episode ${e.index}`,"",bits.join('')));
    });
    if(!parts.length){
      el.innerHTML=`<div style="padding:34px 20px;text-align:center">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Production started</div>
        <div style="font-size:11.5px;color:var(--textm);line-height:1.5">Nothing has finished generating yet. Completed character sheets, locations, storyboards and scenes will appear here.</div>
      </div>`;
      return;
    }
    el.innerHTML=`<div style="padding:16px 16px 24px">${parts.join('')}</div>`;
  }

  // Approval decisions were being made against 70px thumbnails — too small to
  // actually judge a character sheet or storyboard frame on a phone, which is
  // the entire point of an approval gate. Cards now show usable previews and
  // open full size on tap.
  function viewGeneration(url,kind){
    if(!url)return;
    // If this output was also saved as a Gallery asset, hand off to the real
    // detail sheet so the approve/reject review controls come with it rather
    // than duplicating them here.
    const asset=(S.assets||[]).find(a=>a.url===url);
    if(asset&&typeof openGenerationInfoModal==="function"){
      openGenerationInfoModal({
        assetId:asset.id,mediaUrl:asset.url,mediaType:asset.type,
        prompt:asset.prompt||"",model:asset.model||"",providerLabel:asset.providerLabel||asset.type,
        resolution:asset.resolution||"",aspectRatio:asset.aspectRatio||"",duration:asset.duration||"",
      });
      return;
    }
    // Otherwise a plain lightbox — Kosmic Engine writes character sheets and
    // storyboards onto the production record, and not every one of those has
    // a corresponding Gallery asset to look up.
    const prev=document.getElementById("dcLightbox");
    if(prev)prev.remove();
    const overlay=document.createElement("div");
    overlay.id="dcLightbox";
    overlay.style.cssText="position:fixed;inset:0;z-index:320;background:rgba(10,5,20,0.9);display:flex;align-items:center;justify-content:center;padding:16px";
    overlay.onclick=()=>overlay.remove();
    overlay.innerHTML=kind==="video"
      ?`<video src="${esc(url)}" controls playsinline autoplay style="max-width:100%;max-height:90vh;border-radius:12px"></video>`
      :`<img src="${esc(url)}" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:12px">`;
    document.body.appendChild(overlay);
  }

  function closeEngineMenu(){
    const el=document.getElementById("dcEngineMenu");
    if(el)el.remove();
  }
  function toggleEngineMenu(ev){
    if(ev&&ev.stopPropagation)ev.stopPropagation();
    if(document.getElementById("dcEngineMenu")){closeEngineMenu();return;}
    const items=[
      {label:"Restore a session",sub:"Load previously saved progress into this project",fn:"openSessionRecovery()"},
      {label:"Generation permissions",sub:"When to check with you before spending credits",fn:"openPermissionSettings()"},
      {label:"Auto-review",sub:"How much approving Kosmic Engine does for you",fn:"openAutoReviewSettings()"},
      {label:"Switch project",sub:"Work in a different project",fn:"__switch"},
      {label:"Rename director",sub:"Change what this agent is called",fn:"renameDirector()"},
      {label:"New chat",sub:"Start this project's session over",fn:"reset()"},
    ];
    const overlay=document.createElement("div");
    overlay.id="dcEngineMenu";
    // Full-screen dismiss layer rather than an anchored popover: an anchored
    // element would be clipped by the same overflow that caused this bug.
    overlay.style.cssText="position:fixed;inset:0;z-index:300;background:rgba(20,10,40,0.35);display:flex;align-items:flex-end;justify-content:center";
    overlay.onclick=(e)=>{if(e.target===overlay)closeEngineMenu();};
    overlay.innerHTML=`<div style="background:var(--glass-solid);backdrop-filter:blur(20px);border:1px solid var(--glass-brd);border-bottom:none;border-radius:22px 22px 0 0;width:100%;max-width:520px;padding:10px 12px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -12px 40px rgba(61,31,122,0.25)">
      <div style="width:38px;height:4px;border-radius:2px;background:var(--border);margin:4px auto 12px"></div>
      ${items.map(i=>`<div onclick="KosmicEngine.runMenuAction('${i.fn}')" style="padding:11px 12px;border-radius:12px;cursor:pointer">
        <div style="font-size:13.5px;font-weight:700;color:var(--text)">${esc(i.label)}</div>
        <div style="font-size:11px;color:var(--textm);margin-top:1px">${esc(i.sub)}</div>
      </div>`).join('')}
    </div>`;
    document.body.appendChild(overlay);
  }
  function runMenuAction(fn){
    closeEngineMenu();
    // switchKosmicEngineProject lives outside this IIFE (it owns the gate),
    // so it is dispatched by name rather than through the KosmicEngine map.
    if(fn==="__switch"){switchKosmicEngineProject();return;}
    const map={"openSessionRecovery()":openSessionRecovery,"openPermissionSettings()":openPermissionSettings,"openAutoReviewSettings()":openAutoReviewSettings,"renameDirector()":renameDirector,"reset()":reset};
    const f=map[fn];
    if(typeof f==="function")f();
  }

  async function openSessionRecovery(){
    const el=document.getElementById("dcRecoverModal");
    if(el)el.remove();
    const rows=[];
    const stashed=S.kosmicEngineSessions||{};
    Object.keys(stashed).forEach(pid=>{
      const s=stashed[pid];
      if(!s||!s.messages||!s.messages.length)return;
      const proj=S.projects.find(p=>p.id===pid);
      rows.push({key:"stash:"+pid,title:proj?proj.name:"(deleted project)",sub:`${s.messages.length} messages`,session:s});
    });
    let legacy=null;
    try{
      const doc=await fbDB.collection("public").doc(legacyChatDocId()).get();
      if(doc.exists&&doc.data().chat&&doc.data().chat.messages&&doc.data().chat.messages.length)legacy=doc.data().chat;
    }catch(err){ console.warn("Legacy lookup failed:",err.message); }
    if(legacy)rows.push({key:"legacy",title:"Earlier session (before project scoping)",sub:`${legacy.messages.length} messages`,session:legacy});

    const target=S.projects.find(p=>p.id===S.kosmicEngineProjectId);
    const overlay=document.createElement("div");
    overlay.className="modal-overlay show";
    overlay.id="dcRecoverModal";
    overlay.onclick=(e)=>{if(e.target===overlay)overlay.remove();};
    overlay.innerHTML=`<div class="modal" style="width:440px">
      <div style="font-family:'Cinzel',serif;font-size:16px;font-weight:700;color:var(--violet);margin-bottom:4px">Restore a session</div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:14px">${target?`Loads into <b>${esc(target.name)}</b>, replacing what's currently open there.`:"Open a project first."}</div>
      ${rows.length?rows.map(r=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12.5px;font-weight:700;color:var(--text)">${esc(r.title)}</div>
          <div style="font-size:10.5px;color:var(--textm)">${esc(r.sub)}</div>
        </div>
        <button class="btn btn-primary btn-xs" onclick="KosmicEngine.restoreSession('${esc(r.key)}')" ${target?'':'disabled'}>Restore</button>
      </div>`).join(''):`<div style="font-size:12px;color:var(--textm);text-align:center;padding:18px 0">No other saved sessions found.</div>`}
      <div style="text-align:right;margin-top:14px"><button class="btn btn-ghost" onclick="document.getElementById('dcRecoverModal').remove()">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    _recoveryRows=rows;
  }
  let _recoveryRows=[];
  function restoreSession(key){
    const target=S.kosmicEngineProjectId;
    if(!target)return;
    const row=_recoveryRows.find(r=>r.key===key);
    if(!row)return;
    // Preserve whatever is currently open before overwriting it, so a
    // restore can itself be undone by restoring the other way.
    stashCurrentSession();
    const restored=JSON.parse(JSON.stringify(row.session));
    restored.projectId=target;
    S.directorChat=restored;
    save();
    stashCurrentSession();
    const el=document.getElementById("dcRecoverModal");
    if(el)el.remove();
    renderThread();renderTaskPanel();
    toast("Session restored","success");
  }

  async function enterProject(projectId){
    const s=S.directorChat||{};
    const hasContent=!!(s.messages&&s.messages.length);
    // Already the right session — paint it.
    if(s.projectId===projectId&&hasContent){renderThread();renderTaskPanel();return;}
    // Legacy in-memory session from before per-project scoping. Adopt rather
    // than discard — silently eating an in-progress conversation on update
    // would be worse than attributing it to the project opened next.
    if(!s.projectId&&hasContent){
      S.directorChat.projectId=projectId;
      save();
      stashCurrentSession();
      renderThread();renderTaskPanel();
      return;
    }
    // CRITICAL: preserve the outgoing session BEFORE anything can replace it.
    // This is what was missing — switching mid-production discarded live work
    // because reset() overwrote S.directorChat (and the single local storage
    // key) before the outgoing session had been written anywhere.
    stashCurrentSession();

    // Recovery is attempted widest-net-last, so a real session is never
    // passed over in favour of a blank one.
    // 1. Locally stashed session — fastest, and works offline or when
    //    Firebase is unreachable.
    const local=(S.kosmicEngineSessions||{})[projectId];
    if(local&&local.messages&&local.messages.length){
      S.directorChat=local;
      S.directorChat.projectId=projectId; // defensive: trust the map key
      save();
      renderThread();renderTaskPanel();
      return;
    }
    // 2. This project's own cloud document.
    const found=await loadFromCloud();
    if(found&&S.directorChat.projectId===projectId){renderThread();renderTaskPanel();return;}
    // 3. Recovery: the pre-per-project document. Adopted ONCE (flagged), so
    //    it cannot be duplicated into every project opened afterwards.
    const legacy=await loadLegacySession();
    if(legacy){
      legacy.projectId=projectId;
      S.directorChat=legacy;
      saveSetting("ke_legacy_migrated",true);
      save();
      stashCurrentSession();
      renderThread();renderTaskPanel();
      toast("Recovered your earlier Kosmic Engine progress","success");
      return;
    }
    // 4. Nothing anywhere — genuinely a fresh start for this project.
    reset(projectId);
    renderTaskPanel();
  }

  function reset(projectId){
    // Falls back to the live selection so the existing no-arg callers (the
    // "New Chat" button) keep working unchanged.
    const pid=projectId||S.kosmicEngineProjectId||null;
    S.directorChat={active:true,productionId:null,projectId:pid,directorName:S.directorChat.directorName||"Director",messages:[],tasks:null,awaitingApprovalTaskId:null,draft:null,intakeStage:"awaiting_brief",qaAnswers:{},awaitingPermissionIds:null,permissionPaused:false};
    save();
    renderThread();
    push("agent",`Hey, I'm your ${S.directorChat.directorName}. Tell me the story you want to make — genre, setting, what happens. I'll plan it, write it, and build the character sheet, storyboard, and scenes from there. The Character Sheet's 6 views now generate in parallel — you approve or reject at each checkpoint.`);
  }
  function send(){
    const input=document.getElementById("dcInput");
    const text=input.value.trim();
    if(!text)return;
    input.value="";
    push("user",text);
    handleUserMessage(text);
  }
  async function handleUserMessage(text){
    const stage=S.directorChat.intakeStage;
    if(stage==="awaiting_brief"){
      // The project chosen in the Kosmic Engine gate is authoritative here.
      // This previously read S.activeProject (owned by the Projects module)
      // and otherwise fell back to "first non-archived project", so the gate
      // selection never reached production creation at all — work generated
      // from Kosmic Engine could land in a completely different project than
      // the one on screen.
      const projectId=S.kosmicEngineProjectId||S.activeProject||(S.projects.find(p=>!p.archived)||{}).id;
      if(!projectId){ push("agent","You'll need at least one Project first — head to Projects, create one, then come back and tell me the story again."); return; }
      const remembered=await SemanticMemory.recallCharacter(text);
      S.directorChat.draft={
        projectId,concept:text.slice(0,200),imageModel:"fal-ai/nano-banana-pro",videoModel:"bytedance/seedance-2.0/fast/reference-to-video",
        quality:"720p",aspectRatio:"16:9",clipLen:8,totalDurationRequested:8,totalDurationRounded:8,totalShots:1,shotsPerEp:1,
        continuity:"both",brainModel:gs("ai_model","claude"),refImages:[],reviewedCharacterDesc:remembered?remembered.desc:"",hasFullScript:false,fullScriptText:text,episodeCount:1,
      };
      save();
      push("agent",`Got it.${remembered?` 🧠 This sounds like a character I already know ("${remembered.concept}"${remembered.semantic?', recalled by meaning — '+Math.round(remembered.score*100)+'% match':''}) — I'll keep their approved look consistent unless you tell me otherwise.`:""} Before I start, set the four things below — or just say "go" to run with the defaults (1 episode, ~8s, 720p, 16:9, narrative + visual continuity).`,{questions:true});
      S.directorChat.intakeStage="confirm_plan";
      S.directorChat.qaAnswers={};
      save();
      return;
    }
    if(stage==="confirm_plan"){
      const lower=text.toLowerCase();
      const epMatch=lower.match(/(\d+)\s*episodes?/);
      const durMatch=lower.match(/(\d+)\s*(?:sec|second)/);
      // Clamped, where the original wasn't at all. "500 episodes" parsed
      // straight through to buildTaskGraph(500) — 1506 tasks, every one of
      // them re-serialized to localStorage AND pushed to Firebase on every
      // single save() call, plus 500 episodes' worth of real paid generation
      // queued behind it. Same reasoning for duration.
      if(epMatch)S.directorChat.draft.episodeCount=clampInt(epMatch[1],INTAKE_LIMITS.episodeCount.min,INTAKE_LIMITS.episodeCount.max,1);
      if(durMatch){
        const dur=clampInt(durMatch[1],INTAKE_LIMITS.duration.min,INTAKE_LIMITS.duration.max,8);
        S.directorChat.draft.totalDurationRequested=dur;
        S.directorChat.draft.totalDurationRounded=dur;
      }
      // Continuity as text overrides, same conversational pattern as episode
      // count/duration above — defaults to both narrative+visual (set at
      // draft creation) unless told otherwise.
      let continuityMatch=false;
      if(/no visual|visual off|without visual/.test(lower)){S.directorChat.draft.continuity=S.directorChat.draft.continuity==="both"?"narrative":"none";continuityMatch=true;}
      else if(/no narrative|narrative off|without narrative/.test(lower)){S.directorChat.draft.continuity=S.directorChat.draft.continuity==="both"?"visual":"none";continuityMatch=true;}
      else if(/narrative only/.test(lower)){S.directorChat.draft.continuity="narrative";continuityMatch=true;}
      else if(/visual only|visual chaining only/.test(lower)){S.directorChat.draft.continuity="visual";continuityMatch=true;}
      else if(/both continuity|narrative and visual/.test(lower)){S.directorChat.draft.continuity="both";continuityMatch=true;}
      if(!/^(go|start|yes|proceed|begin)/i.test(lower)&&!epMatch&&!durMatch&&!continuityMatch){
        push("agent",`Noted. Say "go" whenever you're ready to start.`);
        return;
      }
      S.directorChat.intakeStage="running";
      // Clamped again here on purpose, not just at parse time: a draft
      // restored from a cloud session saved BEFORE the parse-time clamp
      // existed can still carry an unbounded episodeCount, and this is the
      // single choke point every start path funnels through.
      S.directorChat.tasks=buildTaskGraph(clampInt(S.directorChat.draft.episodeCount,INTAKE_LIMITS.episodeCount.min,INTAKE_LIMITS.episodeCount.max,1));
      save();
      await dispatchTasks();
      return;
    }
    push("agent","I'm mid-production right now — use Approve/Reject on the card above, or wait for the next step.");
  }

  async function approve(){
    const taskId=S.directorChat.awaitingApprovalTaskId;
    if(!taskId)return;
    const task=findTask(taskId);
    const prodId=S.directorChat.productionId;
    if(task.type==="charsheet_review"){
      approveCharacterSheet(prodId);
      // Feedback has done its job once the result is accepted. Clearing it
      // here is the same precaution the storyboard path already documents:
      // a lingering note would silently reapply to an unrelated future
      // regeneration of a completely different character.
      const pClear=S.productions.find(x=>x.id===prodId);
      if(pClear&&pClear.charSheetFeedback){pClear.charSheetFeedback=null;save2Productions();}
      // World memory: remember each approved MC/LEAD character individually —
      // now real embedding-backed memory per character, not one combined blob
      // for the whole cast (which would've made recall meaningless once a
      // story had more than one named character).
      const p=S.productions.find(x=>x.id===prodId);
      if(p&&p.characterSheets&&p.characterSheets.length){
        for(const s of p.characterSheets){
          if(s.tier==="SIDE")continue; // side-character lineup isn't a durable single-character memory
          await SemanticMemory.saveCharacterMemory(prodId,s.name,s.desc,s.sheetUrl);
        }
      } else if(p&&p.characterDesc){
        // Legacy fallback for productions created before this format existed.
        await SemanticMemory.saveCharacterMemory(prodId,p.concept||"",p.characterDesc,p.characterSheet&&(p.characterSheet.front||p.characterSheet.threeQuarter));
      }
    }
    else if(task.type==="loc_review"){
      // World memory: remember each approved location for future productions —
      // now real embedding-backed memory, same as characters.
      const p=S.productions.find(x=>x.id===prodId);
      if(p&&p.locationBible&&p.locationBible.length){
        for(const l of p.locationBible){
          if(!l.url)continue; // no reference image, nothing durable to remember
          await SemanticMemory.saveLocationMemory(prodId,l.name,l.desc,l.url);
        }
      }
    }
    else if(task.type==="script")approveEpisodeStage(prodId,task.epIndex,"script");
    else if(task.type==="storyboard")approveEpisodeStage(prodId,task.epIndex,"storyboard");
    else if(task.type==="scene")approveEpisodeStage(prodId,task.epIndex,"scene");
    task.status="done";
    S.directorChat.awaitingApprovalTaskId=null;
    save();
    push("agent",`✅ ${task.label} approved.`);
    if(task.type==="scene"&&S.directorChat.episodeCount&&task.epIndex===S.directorChat.episodeCount){
      push("agent",`🎉 All ${S.directorChat.episodeCount} episode${S.directorChat.episodeCount!==1?'s':''} complete! Head to Production Pipeline to finalize this to the Video Editor.`);
      return;
    }
    await dispatchTasks();
  }
  async function reject(){
    const taskId=S.directorChat.awaitingApprovalTaskId;
    if(!taskId)return;
    const task=findTask(taskId);
    const prodId=S.directorChat.productionId;
    S.directorChat.awaitingApprovalTaskId=null;
    if(task.type==="charsheet_review"){
      // Ask WHY before redoing anything. The episode stages already collect
      // this (rejectEpisodeStage prompts, and the pipeline injects it into the
      // script/storyboard prompts) — character sheets did not, so rejecting one
      // was a blind re-roll of the same prompt. Sheets are the foundation every
      // downstream shot references, which makes that the worst place to be
      // rolling dice.
      const fb=(await showPromptDialog("What's wrong with these character sheets? (optional — it's fed straight into the regeneration)","",{title:"Rejection Feedback",okLabel:"Reject & Regenerate",multiline:true}))||"";
      const p=S.productions.find(x=>x.id===prodId);
      // Assigned unconditionally, so submitting empty feedback CLEARS a stale
      // note rather than silently reapplying an old one to a new attempt.
      if(p)p.charSheetFeedback=fb;
      // Preserve what's being thrown away BEFORE clearing it. Regeneration is
      // non-deterministic, so the replacement can come back worse.
      if(p)archiveAttempt(p,"chars",p.characterSheets,fb);
      // Regenerate every character sheet in parallel again — clear first, since
      // charsheet_single/charsheet_side each push() onto p.characterSheets;
      // without clearing, a regenerate would leave duplicate old entries
      // sitting alongside the new ones instead of replacing them.
      if(p)p.characterSheets=[];
      save2Productions();
      const csIds=task.deps;
      csIds.forEach(id=>{const t=findTask(id);if(t){t.status="pending";t.error=null;}});
      task.status="pending";
      save();
      push("agent",fb?`🔄 Regenerating the Character Sheets, addressing: "${esc(fb)}"`:"🔄 Regenerating the Character Sheets, in parallel…");
      await dispatchTasks();
      return;
    }
    if(task.type==="loc_review"){
      const pLocClear=S.productions.find(x=>x.id===prodId);
      if(pLocClear&&pLocClear.locationFeedback){pLocClear.locationFeedback=null;save2Productions();}
      // Same reasoning as character sheets: locations anchor every storyboard
      // shot, so re-rolling them blind is expensive in both credits and time.
      const fb=(await showPromptDialog("What's wrong with these locations? (optional — it's fed straight into the regeneration)","",{title:"Rejection Feedback",okLabel:"Reject & Regenerate",multiline:true}))||"";
      const pLoc=S.productions.find(x=>x.id===prodId);
      // Assigned unconditionally so empty feedback clears a stale note rather
      // than silently reapplying it to a fresh attempt.
      if(pLoc)pLoc.locationFeedback=fb;
      // Location images are overwritten in place on regenerate (loc.url=...),
      // so the previous URLs have to be captured here or they are simply gone.
      if(pLoc)archiveAttempt(pLoc,"locs",pLoc.locationBible,fb);
      if(pLoc)save2Productions();
      // Regenerate the location establishing images (tasks already exist from
      // the dynamic insertion — just reset them); the location list itself is kept.
      task.deps.forEach(id=>{const t=findTask(id);if(t){t.status="pending";t.error=null;}});
      task.status="pending";
      save();
      push("agent",fb?`🔄 Regenerating the Location Bible references, addressing: "${esc(fb)}"`:"🔄 Regenerating the Location Bible references, in parallel…");
      await dispatchTasks();
      return;
    }
    const stageKey=task.type; // "script"|"storyboard"|"scene"
    await rejectEpisodeStage(prodId,task.epIndex,stageKey);
    task.status="pending";
    task.error=null;
    save();
    push("agent",`↩️ Rejected — redoing Episode ${task.epIndex}'s ${stageKey}…`);
    await dispatchTasks();
  }
  function retry(msgIndex){
    const msg=S.directorChat.messages[msgIndex];
    const ids=(msg&&msg.retryTaskIds)||[];
    ids.forEach(id=>{const t=findTask(id);if(t){t.status="pending";t.error=null;}});
    save();
    renderThread(); // re-render so this card's now-resolved Retry button disappears immediately
    dispatchTasks();
  }
  async function renameDirector(){
    const name=await showPromptDialog("Name your Director","Director")||"Director";
    S.directorChat.directorName=name;
    save();
    renderModule("kosmicengine");
  }
  // ── AUTO-PILOT BRIDGE ── Hands an existing Production Pipeline (manual
  // wizard) production over to run autonomously from here. Deliberately
  // scoped to productions where NO episode has started any work yet — this
  // module's char_plan/loc_plan tasks assume a clean starting point, and
  // Location Bible in particular is a Kosmic Engine-only feature the manual
  // wizard never creates, so bridging mid-episode would leave already-
  // generated storyboards with no location reference to have drawn from,
  // a real mismatch rather than a clean continuation.
  //
  // Builds the exact same task graph buildTaskGraph() would for a brand
  // new production, then marks whatever's ALREADY genuinely done (an
  // approved Character Sheet, specifically) as done up front instead of
  // pending, so dispatchTasks() correctly skips re-doing real completed
  // work and starts from wherever the manual wizard actually left off.
  function resumeExistingProduction(prodId){
    const p=S.productions.find(x=>x.id===prodId);
    if(!p){toast("Couldn't find that production","error");return;}
    if(p.episodes.some(e=>e.scriptStatus!=="pending")){
      toast("This production already has episode work started — Auto-Pilot only bridges productions where no episode has begun yet","error");
      return;
    }
    // Stamped from the PRODUCTION's own project, not the current selection —
    // this can be invoked from Production Pipeline while Kosmic Engine is
    // scoped elsewhere (or nowhere), and an unstamped session would fall
    // into enterProject's legacy-adoption branch and get misattributed to
    // whichever project happened to be open next.
    if(p.projectId)S.kosmicEngineProjectId=p.projectId;
    S.directorChat={active:true,productionId:prodId,projectId:p.projectId||S.kosmicEngineProjectId||null,directorName:S.directorChat.directorName||"Director",messages:[],tasks:null,awaitingApprovalTaskId:null,draft:{episodeCount:p.episodes.length},intakeStage:"running",qaAnswers:{},awaitingPermissionIds:null,permissionPaused:false};
    const tasks=buildTaskGraph(p.episodes.length);
    // plan/model_select created the production and picked models in the
    // normal flow — both already happened via the manual wizard, so mark
    // them done rather than let runTaskWork("plan") create a SECOND,
    // duplicate production.
    findTaskIn(tasks,"plan").status="done";
    findTaskIn(tasks,"model_select").status="done";
    // Character Sheets: only skip if the manual wizard already got a real
    // approval — otherwise let Kosmic Engine build/get approval for them
    // normally, same as it would for a production it created itself.
    if(p.characterSheetStatus==="approved"){
      findTaskIn(tasks,"char_plan").status="done";
      findTaskIn(tasks,"cs_review").status="done";
    }
    // Location Bible always runs fresh — genuine bonus feature the manual
    // wizard never had a chance to create, safe here specifically because
    // no episode/storyboard work exists yet to have needed it already.
    S.directorChat.tasks=tasks;
    save();
    push("agent",`Picking up "${p.concept.slice(0,60)}" from here — ${p.characterSheetStatus==="approved"?"Character Sheet is already approved, so ":""}I'll build the Location Bible next, then run through all ${p.episodes.length} episode${p.episodes.length!==1?'s':''} the same way I would for a production I planned myself. Approve or reject at each checkpoint as usual.`);
    dispatchTasks();
  }
  function findTaskIn(tasks,id){return tasks.find(t=>t.id===id);}

  return{send,approve,reject,retry,reset,renderThread,renameDirector,loadFromCloud,resumeExistingProduction,renderTaskPanel,toggleTaskPanel,openIntakeQuestions,closeIntakeQuestions,setIntakeAnswer,setIntakeAnswerText,submitIntakeAnswers,skipIntakeQuestions,openPermissionSettings,closePermissionSettings,setPermissionMode,allowGeneration,declineGeneration,resumeProduction,enterProject,stashCurrentSession,openSessionRecovery,restoreSession,toggleEngineMenu,closeEngineMenu,runMenuAction,viewGeneration,setEngineTab,renderNotebook,restoreAttempt,toggleBlock,currentTab:()=>_engineTab,openAutoReviewSettings,closeAutoReviewSettings,setAutoReviewMode};
})();


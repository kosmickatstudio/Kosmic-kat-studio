// ══════════════════════════════════════════════════════════════════════
// KOSMIC ENGINE MODULE (Director Chat) — sixteenth extraction from
// index.html (module split phase 16). Plain global script, not an ES
// module. Same clean profile as nodecanvas.js: only 2 top-level names
// exist in this whole ~660-line file — renderDirectorChatModule (entry
// point) and DirectorChat (a const assigned from an IIFE). Everything
// else is closure-private.
//
// Verified before extracting: the IIFE's own top-level body (function
// declarations, one bare `let _cloudSyncTimer=null`) never touches S/gs()
// at immediate execution time. Confirmed zero references to DirectorChat.*
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

function renderDirectorChatModule(el){
  el.innerHTML=`
    <div style="margin-bottom:10px">
      <div style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--violet)">🎬 Kosmic Engine</div>
      <div style="font-size:11px;color:var(--textm);margin-top:2px">One conversation drives the whole pipeline — script, character sheet, storyboard, and scenes — with the same generation your Production Pipeline already uses.</div>
    </div>
    <div class="ig-chat-shell" style="min-height:60vh">
      <div class="ig-chat-header">
        <div><b onclick="DirectorChat.renameDirector()" style="cursor:pointer;text-decoration:underline dotted" title="Tap to rename">${S.directorChat.directorName}</b> <span style="font-size:10px;color:var(--textm)">· ${S.directorChat.productionId?'production in progress':'no active production'}</span></div>
        <button class="btn btn-ghost btn-xs" onclick="DirectorChat.reset()">↻ New Chat</button>
      </div>
      <div class="ig-chat-thread" id="dcThread"></div>
      <div class="ig-chat-inputbar">
        <textarea class="ig-chat-textarea" id="dcInput" placeholder="Type your reply…" rows="1" onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();DirectorChat.send();}"></textarea>
        <button class="ig-send-btn" onclick="DirectorChat.send()">➤</button>
      </div>
    </div>
  `;
  if(!S.directorChat.messages.length||S.directorChat.tasks===undefined){
    (async()=>{
      const foundCloudSession=await DirectorChat.loadFromCloud();
      if(!foundCloudSession)DirectorChat.reset();
    })();
  } else {
    DirectorChat.renderThread();
  }
}

const DirectorChat=(function(){
  function save(){
    window.save?window.save("directorChat"):localStorage.setItem("kk_director_chat",JSON.stringify(S.directorChat));
    clearTimeout(_cloudSyncTimer);
    _cloudSyncTimer=setTimeout(syncToCloud,1200); // debounced — not every single message/task update
  }
  let _cloudSyncTimer=null;
  function chatDocId(){
    // Scope the cloud doc per user — a single global doc would mean every
    // visitor to the site shares (and overwrites) one chat session.
    if(S.user&&S.user.uid)return "kosmicEngineChat_"+S.user.uid;
    let devId=localStorage.getItem("kk_device_id");
    if(!devId){devId="dev_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);localStorage.setItem("kk_device_id",devId);}
    return "kosmicEngineChat_"+devId;
  }
  async function syncToCloud(){
    try{ await fbDB.collection("public").doc(chatDocId()).set({chat:S.directorChat,updatedAt:Date.now()}); }
    catch(err){ console.warn("Kosmic Engine cloud sync failed — kept locally only:",err.message); }
  }
  async function loadFromCloud(){
    try{
      const doc=await fbDB.collection("public").doc(chatDocId()).get();
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
  async function runQACheck(imageUrl,description){
    try{
      if(!imageUrl)return null;
      const dataUrl=await urlToDataUrl(imageUrl);
      const result=await callAiVision(
        [{dataUrl}],
        `Does this image look like a valid, professionally-generated image — not broken, garbled, blank, duplicated limbs, or malformed? Does it reasonably match this description: "${description}"? Reply in EXACTLY this format:\nSTATUS: pass or flag\nNOTE: <one short sentence, only if flagged>`,
        "You are doing a quick quality check on AI-generated production art for a human who will make the final call either way. Be lenient — only flag genuinely broken results, not minor stylistic differences or artistic license."
      );
      const statusMatch=result.match(/STATUS:\s*(pass|flag)/i);
      const noteMatch=result.match(/NOTE:\s*(.+)/i);
      if(statusMatch&&statusMatch[1].toLowerCase()==="flag")return noteMatch?noteMatch[1].trim():"Possible quality issue — worth a closer look";
      return null;
    }catch(err){
      console.warn("QA check skipped (not blocking):",err.message);
      return null; // QA is an enhancement, not a requirement — never blocks the flow on its own failure
    }
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
      const prompt=`${c.desc}, full character reference turnaround sheet, single composite image arranged in a grid showing: front full-body view, back full-body view, 3/4 angle full-body view, and a close-up face portrait — consistent character design across all views, clean plain background, professional character design sheet, only this one character, no other people`;
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
      const prompt=`Character lineup reference sheet, ${sides.length} distinct background/side characters standing side by side for comparison, each clearly separated: ${lineup}. Clean plain background, consistent lighting, simple standing poses, professional character design reference — each character visually distinct from the others.`;
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
      const qaNote=mc?await runQACheck(mc.sheetUrl,mc.desc):null;
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
      const prompt=`${loc.desc}, wide establishing shot, cinematic environment reference, no people, detailed background art`;
      let result;
      if(p.imageModel&&p.imageModel.startsWith("gemini-"))result=await genViaGemini(prompt,"16:9",p.imageModel);
      else if(p.imageModel==="gpt-image-2")result=await genViaOpenAI(prompt,"16:9");
      else result=await genViaFal(prompt,"",p.imageModel||"fal-ai/flux/dev","16:9",false);
      loc.url=result.url;
      save2Productions();
      logCost(p.imageModel,`Location Bible — ${loc.name}`);
      return{};
    }
    if(task.type==="loc_review"){
      const p=S.productions.find(x=>x.id===S.directorChat.productionId);
      // locationDesc feeds every storyboard shot prompt from here on (see
      // generateEpisodeStoryboard) so environments stay consistent too.
      p.locationDesc=p.locationBible.map(l=>`${l.name}: ${l.desc}`).join("; ");
      save2Productions();
      const firstLoc=p.locationBible[0];
      const qaNote=firstLoc?await runQACheck(firstLoc.url,firstLoc.desc):null;
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
      const qaNote=e.storyboard[0]?await runQACheck(e.storyboard[0].url,e.masterPrompt):null;
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

  async function dispatchTasks(){
    const tasks=S.directorChat.tasks;
    if(!tasks||S.directorChat.awaitingApprovalTaskId)return; // don't dispatch further while a card is waiting on the user
    const ready=tasks.filter(t=>t.status==="pending"&&depsSatisfied(t));
    if(!ready.length)return;
    const parallelReady=ready.filter(t=>t.parallel);
    const sequentialReady=ready.filter(t=>!t.parallel);
    if(parallelReady.length){
      parallelReady.forEach(t=>t.status="running");
      save();
      await Promise.allSettled(parallelReady.map(async t=>{
        try{
          const out=await runTaskWork(t);
          t.status="done";
          t.error=null;
          if(out&&out.summary)push("agent",out.summary,out.approval?{approval:out.approval}:{});
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
      t.status="running";
      save();
      if(!t.requiresApproval&&t.type!=="plan")push("agent",`⏳ ${t.label}…`);
      else if(t.type==="plan")push("agent","📋 Planning your production…");
      try{
        const out=await runTaskWork(t);
        if(t.requiresApproval){
          t.status="awaiting_approval";
          S.directorChat.awaitingApprovalTaskId=t.id;
          save();
          if(out&&out.summary)push("agent",out.summary,{approval:out.approval});
          return; // wait for the user
        }
        t.status="done";
        t.error=null;
        save();
        if(out&&out.summary)push("agent",out.summary);
      }catch(err){
        t.status="error";
        t.error=err.message;
        save();
        const normalized=await normalizeError(err.message,guessProvider(t));
        push("agent","",{error:normalized,retryable:true,retryTaskIds:[t.id]});
        return;
      }
      await dispatchTasks();
    }
  }

  function renderThread(){
    const thread=document.getElementById("dcThread");
    if(!thread)return;
    thread.innerHTML=S.directorChat.messages.map((m,i)=>{
      if(m.role==="user")return `<div class="ig-bubble-user">${m.content}</div>`;
      let extra="";
      if(m.approval)extra=`<div class="dc-approval-card">
        ${m.approval.images?`<div style="display:flex;gap:4px;overflow-x:auto">${m.approval.images.map(u=>`<img src="${u}" style="width:70px;height:70px;object-fit:cover;flex-shrink:0">`).join('')}</div>`:''}
        ${m.approval.video?`<video src="${m.approval.video}" controls style="width:100%"></video>`:''}
        ${m.approval.text?`<div style="font-size:11px;color:var(--text);white-space:pre-wrap">${m.approval.text}</div>`:''}
        ${m.approval.qaNote?`<div style="font-size:10px;color:var(--gold);background:rgba(212,175,55,0.1);border-radius:6px;padding:5px 8px;margin-top:6px">🔍 QA note: ${m.approval.qaNote}</div>`:''}
        <div class="dc-approval-actions">
          <button class="btn btn-primary btn-xs" onclick="DirectorChat.approve()">✅ Approve</button>
          <button class="btn btn-danger btn-xs" onclick="DirectorChat.reject()">❌ Reject</button>
        </div>
      </div>`;
      if(m.error){
        // Only show Retry if the specific task(s) THIS card is about are still
        // actually in error status right now — an old card whose task was
        // already retried and resolved (or superseded) shouldn't offer a
        // button that would silently act on a different, unrelated task.
        const stillPending=m.retryable&&m.retryTaskIds&&m.retryTaskIds.some(id=>{const t=findTask(id);return t&&t.status==="error";});
        extra=`<div class="dc-error-card">❌ ${m.error}${stillPending?`<div style="margin-top:6px"><button class="btn btn-outline btn-xs" onclick="DirectorChat.retry(${i})">🔄 Retry</button></div>`:''}</div>`;
      }
      return `<div class="ig-bubble-assistant">${m.content}${extra}</div>`;
    }).join('');
    thread.scrollTop=thread.scrollHeight;
  }

  function reset(){
    S.directorChat={active:true,productionId:null,directorName:S.directorChat.directorName||"Director",messages:[],tasks:null,awaitingApprovalTaskId:null,draft:null,intakeStage:"awaiting_brief"};
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
      const projectId=S.activeProject||(S.projects.find(p=>!p.archived)||{}).id;
      if(!projectId){ push("agent","You'll need at least one Project first — head to Projects, create one, then come back and tell me the story again."); return; }
      const remembered=await SemanticMemory.recallCharacter(text);
      S.directorChat.draft={
        projectId,concept:text.slice(0,200),imageModel:"fal-ai/nano-banana-pro",videoModel:"bytedance/seedance-2.0/fast/reference-to-video",
        quality:"720p",aspectRatio:"16:9",clipLen:8,totalDurationRequested:8,totalDurationRounded:8,totalShots:1,shotsPerEp:1,
        continuity:"both",brainModel:gs("ai_model","claude"),refImages:[],reviewedCharacterDesc:remembered?remembered.desc:"",hasFullScript:false,fullScriptText:text,episodeCount:1,
      };
      save();
      push("agent",`Got it.${remembered?` 🧠 This sounds like a character I already know ("${remembered.concept}"${remembered.semantic?', recalled by meaning — '+Math.round(remembered.score*100)+'% match':''}) — I'll keep their approved look consistent unless you tell me otherwise.`:""} Going with sensible defaults so we can move — 1 episode, ~8s, Seedance 2.0 Fast (multi-ref), 720p, 16:9, both narrative + visual continuity. Say "3 episodes", "20 seconds", or "narrative only"/"visual only" before I start if you want different — otherwise just say "go" and I'll start planning.`);
      S.directorChat.intakeStage="confirm_plan";
      save();
      return;
    }
    if(stage==="confirm_plan"){
      const lower=text.toLowerCase();
      const epMatch=lower.match(/(\d+)\s*episodes?/);
      const durMatch=lower.match(/(\d+)\s*(?:sec|second)/);
      if(epMatch)S.directorChat.draft.episodeCount=parseInt(epMatch[1],10);
      if(durMatch){S.directorChat.draft.totalDurationRequested=parseInt(durMatch[1],10);S.directorChat.draft.totalDurationRounded=parseInt(durMatch[1],10);}
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
      S.directorChat.tasks=buildTaskGraph(S.directorChat.draft.episodeCount||1);
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
      // Regenerate every character sheet in parallel again — clear first, since
      // charsheet_single/charsheet_side each push() onto p.characterSheets;
      // without clearing, a regenerate would leave duplicate old entries
      // sitting alongside the new ones instead of replacing them.
      const p=S.productions.find(x=>x.id===prodId);
      if(p)p.characterSheets=[];
      const csIds=task.deps;
      csIds.forEach(id=>{const t=findTask(id);if(t){t.status="pending";t.error=null;}});
      task.status="pending";
      save();
      push("agent","🔄 Regenerating the Character Sheets, in parallel…");
      await dispatchTasks();
      return;
    }
    if(task.type==="loc_review"){
      // Regenerate the location establishing images (tasks already exist from
      // the dynamic insertion — just reset them); the location list itself is kept.
      task.deps.forEach(id=>{const t=findTask(id);if(t){t.status="pending";t.error=null;}});
      task.status="pending";
      save();
      push("agent","🔄 Regenerating the Location Bible references, in parallel…");
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
    renderModule("directorchat");
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
    S.directorChat={active:true,productionId:prodId,directorName:S.directorChat.directorName||"Director",messages:[],tasks:null,awaitingApprovalTaskId:null,draft:{episodeCount:p.episodes.length},intakeStage:"running"};
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

  return{send,approve,reject,retry,reset,renderThread,renameDirector,loadFromCloud,resumeExistingProduction};
})();


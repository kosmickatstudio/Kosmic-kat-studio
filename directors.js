// ══════════════════════════════════════════════════════════════════════
// DIRECTORS MODULE (Director Hierarchy / human team-role panel) —
// fourteenth extraction from index.html (module split phase 14). Plain
// global script, not an ES module. Another judgment-based, non-contiguous
// extraction, same category as motion.js and the pIcon() situation.
//
// "Directors" turned out to be genuinely two separate things sharing a
// section-comment name in the original file: STYLE_LIBRARY (the actual
// data this module renders — directors/animators/composers as style
// references) lived far away (~2800 lines earlier) from the real
// renderDirectors()/renderHierarchyPanel() functions, with a completely
// different, unrelated DIRECTORS constant (used by Production Pipeline's
// Promptwriter for persona selection — NOT this module), plus
// populateResolutionSelect() and video model metadata sitting in between,
// none of which belong here. Verified STYLE_LIBRARY is used exclusively
// by this module's own functions before moving it; left everything else
// exactly where it was.
//
// One widely-used external dependency: getActiveDirectorPrompt() (defined
// here) is called from Image Gen and Video Canvas's own generation code
// in 6 places, to weave the currently-selected director's style into a
// prompt. Resolves fine via plain global window scope, same principle as
// every prior extraction — just more call sites than usual.
//
// LOAD ORDER: must load AFTER index.html's main inline script.
// ══════════════════════════════════════════════════════════════════════

const STYLE_LIBRARY=[
  {cat:"Director",name:"Christopher Nolan",style:"IMAX-scale practical cinematography, non-linear editing, tense orchestral tension, cool desaturated palette"},
  {cat:"Director",name:"Quentin Tarantino",style:"long dialogue-driven takes, low-angle shots, sudden bursts of violence, retro pop soundtrack energy"},
  {cat:"Director",name:"Wes Anderson",style:"perfectly symmetrical framing, pastel color palette, flat deadpan staging, whimsical production design"},
  {cat:"Director",name:"Denis Villeneuve",style:"vast minimalist scale, muted earthy tones, slow deliberate pacing, oppressive atmospheric silence"},
  {cat:"Director",name:"David Fincher",style:"desaturated greenish tones, meticulous precise framing, cold clinical lighting, tense procedural pacing"},
  {cat:"Director",name:"Wong Kar-wai",style:"saturated neon color grade, slow motion, intimate handheld camera, melancholic romantic mood"},
  {cat:"Director",name:"Akira Kurosawa",style:"dynamic weather elements, telephoto compression, disciplined blocking, epic scale with human intimacy"},
  {cat:"Director",name:"Guillermo del Toro",style:"rich amber and teal palette, ornate gothic production design, fairy-tale creature design, romantic darkness"},
  {cat:"Director",name:"Greta Gerwig",style:"warm naturalistic lighting, intimate handheld framing, vibrant coming-of-age energy"},
  {cat:"Director",name:"Ridley Scott",style:"atmospheric haze and backlight, dense layered production design, grand industrial scale"},
  {cat:"Director",name:"Edgar Wright",style:"whip-fast kinetic editing, snap-zoom comedic timing, saturated pop color grade, rhythmic sound-synced cuts"},
  {cat:"Director",name:"Sofia Coppola",style:"dreamy soft light, pastel muted tones, languid contemplative pacing, isolated intimate framing"},
  {cat:"Animator/Studio",name:"Studio Ghibli",style:"hand-painted watercolor backgrounds, soft organic character design, gentle whimsical pacing, nature-driven wonder"},
  {cat:"Animator/Studio",name:"Pixar",style:"warm stylized 3D realism, expressive character animation, emotionally-driven storytelling beats"},
  {cat:"Animator/Studio",name:"Laika (stop-motion)",style:"tactile handcrafted stop-motion texture, gothic whimsical production design, tangible physical detail"},
  {cat:"Animator/Studio",name:"Genndy Tartakovsky",style:"bold graphic shapes, dynamic silhouette staging, high-contrast stylized action"},
  {cat:"Animator/Studio",name:"Satoshi Kon",style:"surreal reality-bending match cuts, psychological tension, meticulous detailed backgrounds"},
  {cat:"Animator/Studio",name:"Makoto Shinkai",style:"hyper-detailed painterly skies, lush lighting, emotionally lush romantic atmosphere"},
  {cat:"Animator/Studio",name:"Ufotable",style:"seamless 2D/3D hybrid compositing, sweeping dynamic 3D camera moves around hand-drawn characters, glowing elemental particle effects (embers, water, light trails), high-contrast impact frames, fluid action with motion-blur bursts"},
  {cat:"Composer/Music",name:"Hans Zimmer",style:"pulsing orchestral drones, rhythmic tension-building brass, sweeping emotional crescendos"},
  {cat:"Composer/Music",name:"Ennio Morricone",style:"sparse haunting whistles and strings, dramatic silence, iconic western tension"},
  {cat:"Composer/Music",name:"Joe Hisaishi",style:"gentle piano motifs, sweeping orchestral warmth, nostalgic emotional swells"},
  {cat:"Composer/Music",name:"Trent Reznor",style:"industrial electronic dread, minimalist unsettling ambience, cold synthetic tension"},
  {cat:"Cultural Cinema",name:"Korean Cinema (New Wave)",style:"sharp genre-blending tonal shifts, socially-charged tension, meticulous visual symbolism"},
  {cat:"Cultural Cinema",name:"French New Wave",style:"handheld naturalistic camera, jump cuts, improvisational intimate energy, natural light"},
  {cat:"Cultural Cinema",name:"Italian Neorealism",style:"raw documentary-style naturalism, non-professional grounded performances, everyday locations"},
  {cat:"Cultural Cinema",name:"Hong Kong Action Cinema",style:"kinetic wire-work choreography, dynamic multi-angle coverage, high-energy practical stunts"},
];
function renderHierarchyPanel(projectId,activeAssistantId,allDirectors){
  const project=S.projects.find(p=>p.id===projectId);
  const showrunnerName=(S.user&&S.user.email!=="guest")?S.user.email:"Not signed in";
  const roster=S.team||[];
  const episodeDirectorOptions=[{email:showrunnerName,label:`${maskEmail(showrunnerName)} (Showrunner)`},...roster.map(m=>({email:m.email,label:`${maskEmail(m.email)} (${m.role})`}))];
  const currentEpDirector=project?(project.episodeDirector||showrunnerName):showrunnerName;
  const activeAssistant=allDirectors.find(d=>d.id===activeAssistantId);

  return `<div class="panel">
    <div class="panel-title">🏛 Director Hierarchy</div>
    ${S.projects.length>1?`<div class="f-group"><label class="f-label">Project</label><select class="f-select" onchange="setHierarchyProject(this.value)">${S.projects.map(p=>`<option value="${p.id}" ${p.id===projectId?'selected':''}>${p.name}</option>`).join('')}</select></div>`:''}
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(201,151,42,0.08);border-radius:8px 8px 0 0">
        <span style="font-size:18px">👑</span>
        <div style="flex:1"><div style="font-size:9px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em">Showrunner</div><div style="font-size:12px;font-weight:600;color:var(--text)">${maskEmail(showrunnerName)}</div></div>
      </div>
      <div style="height:14px;width:1.5px;background:var(--border);margin-left:19px"></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(61,31,122,0.05)">
        <span style="font-size:18px">🎬</span>
        <div style="flex:1">
          <div style="font-size:9px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em">Episode Director ${project?'— '+project.name:''}</div>
          ${project?`<select class="f-select" style="margin-top:4px;font-size:12px;padding:4px 8px" onchange="setEpisodeDirector('${project.id}',this.value)">
            ${episodeDirectorOptions.map(o=>`<option value="${o.email}" ${o.email===currentEpDirector?'selected':''}>${o.label}</option>`).join('')}
          </select>`:`<div style="font-size:12px;color:var(--textm)">No project selected — create one to assign an Episode Director</div>`}
        </div>
      </div>
      <div style="height:14px;width:1.5px;background:var(--border);margin-left:19px"></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(61,31,122,0.05)">
        <span style="font-size:18px">🎥</span>
        <div style="flex:1"><div style="font-size:9px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em">Assistant Director</div><div style="font-size:12px;font-weight:600;color:var(--text)">${activeAssistant?activeAssistant.name+' — '+activeAssistant.style:'None selected yet — pick one below'}</div></div>
      </div>
      <div style="height:14px;width:1.5px;background:var(--border);margin-left:19px"></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(61,31,122,0.05);border-radius:0 0 8px 8px">
        <span style="font-size:18px">✍️</span>
        <div style="flex:1"><div style="font-size:9px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.06em">Prompt Writer</div><div style="font-size:12px;color:var(--textm)">Automatic — the Assistant Director's approach, the active Character's Identity Lock, and your shot's camera/VFX choices are combined into the final generation prompt</div></div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--textm);margin-top:10px">All 6 Assistant Directors work every genre — they're distinguished by <i>how</i> they direct (pacing, scale, emotional focus), not locked to one visual style. Pick whichever approach fits this shot.</div>
  </div>`;
}

function setHierarchyProject(projectId){
  S.hierarchyProjectId=projectId;
  renderDirectors(document.getElementById("moduleContent"));
}

function setEpisodeDirector(projectId,email){
  const p=S.projects.find(x=>x.id===projectId);
  if(!p)return;
  p.episodeDirector=email;
  save("projects");
  toast(`🎬 ${email} set as Episode Director for ${p.name}`,"success");
}

function renderDirectors(el){
  const activeId=gs("active_director","");
  const activeStyleRef=gs("active_style_ref","");
  const cats=[...new Set(STYLE_LIBRARY.map(s=>s.cat))];
  const allDirectors=getAllDirectors();
  const hierarchyProjectId=S.hierarchyProjectId||(S.projects[0]&&S.projects[0].id)||"";
  el.innerHTML=`
    ${renderHierarchyPanel(hierarchyProjectId,activeId,allDirectors)}
    <div style="margin-bottom:14px">
      <div style="font-family:'Cinzel',serif;font-size:18px;font-weight:700;color:var(--violet)">🎥 Directorial Studio</div>
      <div style="font-size:11px;color:var(--textm);margin-top:2px">${activeId?`Active: ${allDirectors.find(d=>d.id===activeId)?.name||''} — style is auto-injected into AI Director chat and Image/Video prompts`:'Select a director to shape the visual style of every generation'}</div>
    </div>
    <div class="grid2">${allDirectors.map(d=>`<div class="director-card ${d.cls||''}${activeId===d.id?' selected':''}" onclick="selectDirector('${d.id}',this)">
      <div style="font-size:24px;margin-bottom:8px">${d.icon||'🎬'}</div>
      <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:700;color:var(--violet)">${d.name}${d.custom?' <span class="badge badge-gray" style="font-size:9px">custom</span>':''}</div>
      <div style="font-size:11px;color:var(--textm);margin-top:4px">${d.style||d.prompt}</div>
      ${activeId===d.id?'<div style="margin-top:6px"><span class="badge badge-green">✓ Active</span></div>':''}
    </div>`).join('')}</div>
    ${activeId?`<div class="panel" style="margin-top:14px"><div class="panel-title">🎨 Style Signature</div><div style="font-size:12px;color:var(--textm);line-height:1.6;font-family:monospace;background:rgba(61,31,122,0.05);border-radius:8px;padding:10px">${allDirectors.find(d=>d.id===activeId)?.prompt||''}</div><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="clearDirector()">✕ Clear Selection</button></div>`:''}

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">📚 Style Intelligence <span style="font-weight:400;color:var(--texts);font-size:11px">— layer a real director/animator/composer reference on top</span></div>
      <input class="f-input" id="styleLibSearch" placeholder="Search by name…" oninput="filterStyleLibrary()" style="margin-bottom:10px">
      ${activeStyleRef?`<div style="margin-bottom:10px"><span class="badge badge-green">✓ Layered: ${STYLE_LIBRARY.find(s=>s.name===activeStyleRef)?.name}</span> <button class="btn btn-ghost btn-xs" onclick="clearStyleRef()">✕ Remove</button></div>`:''}
      <div id="styleLibList">${cats.map(cat=>`
        <div style="font-size:10px;font-weight:700;color:var(--textm);text-transform:uppercase;letter-spacing:0.4px;margin:10px 0 6px">${cat}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${STYLE_LIBRARY.filter(s=>s.cat===cat).map(s=>`<button class="btn ${activeStyleRef===s.name?'btn-primary':'btn-outline'} btn-xs style-lib-item" data-name="${s.name.toLowerCase()}" onclick="selectStyleRef('${s.name.replace(/'/g,"\\'")}')" title="${s.style.replace(/"/g,'&quot;')}">${s.name}</button>`).join('')}
        </div>`).join('')}</div>
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🔍 AI Creative Feedback <span style="font-weight:400;color:var(--texts);font-size:11px">— AI opinion, not a trained prediction model</span></div>
      <div style="font-size:11px;color:var(--textm);margin-bottom:10px">Heads up: there's no real API anywhere that gives a statistically validated "virality score" — nothing on the market actually predicts hold rate or share velocity with real accuracy. What this does instead: your AI brain reads the shot/hook and gives honest creative feedback — hook strength, pacing risk, what's generic — the way a sharp editor friend would, not a black-box number.</div>
      <div class="f-group">
        <label class="f-label">Paste your hook / opening line / shot description</label>
        <textarea class="f-textarea" id="feedbackInput" placeholder="e.g. Opens on a galaxy cat leaping through nebula clouds, camera whip-pans to reveal a cyberpunk city below…" style="min-height:70px"></textarea>
      </div>
      <button class="btn btn-primary btn-full" onclick="analyzeShotFeedback()">🔍 Get Feedback</button>
      <div id="feedbackResult" style="margin-top:12px"></div>
    </div>
  `;
}

async function analyzeShotFeedback(){
  const text=document.getElementById("feedbackInput").value.trim();
  if(!text){toast("Paste a hook or shot description first","error");return;}
  const model=gs("ai_model","claude");
  const apiKeyMap={claude:"api_anthropic",gemini:"api_gemini",groq:"api_groq",deepseek:"api_deepseek",openai:"api_openai",aicredits:"api_aicredits"};
  if(!gs(apiKeyMap[model],"")){toast("Add an AI API key in Settings first","error");return;}
  const resultEl=document.getElementById("feedbackResult");
  resultEl.innerHTML=`<div style="text-align:center;padding:20px;color:var(--textm);font-size:13px">🔍 Analyzing…</div>`;
  try{
    const feedback=await callAiSimple(
      `Give honest, specific creative feedback on this short-form video hook/opening shot, as a sharp, experienced short-form video editor would — not generic praise. Cover: (1) Hook Strength — would this stop a scroll in the first 3 seconds, and why/why not, (2) Pacing — any risk of dragging or confusing cuts, (3) What's Generic — any cliché or overused element, (4) One Concrete Suggestion to strengthen it. Keep each section to 1-2 sentences. Content: "${text}"`,
      "You are a blunt, experienced short-form video editor giving quick honest feedback. Be specific and direct, not falsely encouraging. No preamble, just the feedback."
    );
    resultEl.innerHTML=`<div style="font-size:12px;color:var(--text);line-height:1.7;white-space:pre-wrap;background:rgba(61,31,122,0.05);border-radius:8px;padding:12px">${feedback}</div>`;
  }catch(err){
    resultEl.innerHTML=`<div style="color:var(--red);font-size:13px;padding:10px">❌ ${err.message}</div>`;
  }
}

function filterStyleLibrary(){
  const q=document.getElementById("styleLibSearch").value.toLowerCase();
  document.querySelectorAll(".style-lib-item").forEach(btn=>{
    btn.style.display=btn.dataset.name.includes(q)?"":"none";
  });
}

function selectStyleRef(name){
  const current=gs("active_style_ref","");
  saveSetting("active_style_ref",current===name?"":name);
  toast(current===name?"Style reference removed":`📚 ${name} layered onto generation prompts`,"success");
  renderDirectors(document.getElementById("moduleContent"));
}

function clearStyleRef(){
  saveSetting("active_style_ref","");
  renderDirectors(document.getElementById("moduleContent"));
}

function selectDirector(id,el){
  document.querySelectorAll(".director-card").forEach(c=>c.classList.remove("selected"));
  el.classList.add("selected");
  saveSetting("active_director",id);
  const d=DIRECTORS.find(x=>x.id===id);
  toast(`🎬 ${d.name} selected — style now injected into AI Director & generation prompts`,"success");
  renderDirectors(document.getElementById("moduleContent"));
}

function clearDirector(){
  saveSetting("active_director","");
  toast("Director cleared","");
  renderDirectors(document.getElementById("moduleContent"));
}

function getActiveDirectorPrompt(){
  const parts=[];
  const dirId=gs("active_director","");
  if(dirId){
    const d=getAllDirectors().find(x=>x.id===dirId);
    if(d)parts.push(d.prompt);
  }
  const styleRefName=gs("active_style_ref","");
  if(styleRefName){
    const s=STYLE_LIBRARY.find(x=>x.name===styleRefName);
    if(s)parts.push(s.style);
  }
  return parts.join(", ");
}

// ── AD STUDIO ── (moved to adstudio.js — loaded via <script src="adstudio.js"> near the end of <body>, second module extracted from this file)

// ══════════════════════════════════════════════════════════════════════
// AD STUDIO MODULE — second extraction from index.html (module split phase
// 2, following the same verified pattern as audio.js). Plain global script,
// not an ES module — no import/export, runs on the same window scope.
//
// LOAD ORDER: must load AFTER index.html's main inline script (needs S,
// gs(), save(), toast(), pIcon(), logCost(), and the generation helpers it
// calls). No top-level parse-time statements in this module (unlike
// audio.js, which had 11) — even simpler to place safely.
// ══════════════════════════════════════════════════════════════════════

// ── AD STUDIO ──
function renderAdStudio(el){
  const hasAiKey=gs("api_anthropic")||gs("api_groq")||gs("api_deepseek")||gs("api_openai");
  const products=gs("product_library",[])||[];
  el.innerHTML=`
    <div class="panel">
      <div class="panel-title">📢 Ad Brief Generator ${hasAiKey?'<span class="badge badge-green">ACTIVE</span>':'<span class="badge badge-red">NO KEY</span>'}</div>
      ${!hasAiKey?`<div style="font-size:12px;color:var(--textm);margin-bottom:12px">Add an AI Director key (Anthropic/Groq/DeepSeek/OpenAI) in Settings — same one powering AI Director chat.</div>`:''}
      <div style="font-size:11px;color:var(--textm);background:rgba(201,151,42,0.08);border:1px solid rgba(201,151,42,0.2);border-radius:8px;padding:8px;margin-bottom:12px">💡 No "paste a URL and get a full ad" here — browsers block fetching arbitrary websites cross-origin (CORS), so that would fail silently for most real sites. Paste the product details below instead — same result, actually works.</div>
      ${products.length?`<div class="f-group"><label class="f-label">Load from Product Library</label><select class="f-select" id="productLibSelect" onchange="loadLibraryProduct()"><option value="">— Select saved product —</option>${products.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('')}</select></div>`:''}
      <div class="f-group">
        <label class="f-label">Product / Service</label>
        <input class="f-input" id="adProduct" placeholder="e.g. KosmicKat AI Studio, a cinematic video toolkit">
      </div>
      <div class="f-group">
        <label class="f-label">Key selling point</label>
        <textarea class="f-textarea" id="adUSP" placeholder="What makes this worth talking about? e.g. Generate full cinematic scenes from a single prompt, no editing skills needed." style="min-height:60px"></textarea>
      </div>
      <button class="btn btn-outline btn-sm btn-full" style="margin-bottom:10px" onclick="saveLibraryProduct()">💾 Save to Product Library</button>
      <div class="f-row">
        <div class="f-group">
          <label class="f-label">Ad Format</label>
          <select class="f-select" id="adFormat">
            <option>UGC (talking head / testimonial style)</option>
            <option>CGI Commercial</option>
            <option>Cinematic Narrative</option>
            <option>Wild Card / Experimental</option>
          </select>
        </div>
        <div class="f-group">
          <label class="f-label">Platform</label>
          <select class="f-select" id="adPlatform">
            <option value="9:16">TikTok / Reels / Shorts (9:16)</option>
            <option value="1:1">Meta Feed — Instagram/Facebook (1:1)</option>
            <option value="16:9">YouTube Pre-roll (16:9)</option>
            <option value="1:1">LinkedIn (1:1)</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-full" id="adGenBtn" ${!hasAiKey?'disabled':''} onclick="generateAdBrief()">${hasAiKey?'✨ Generate Ad Brief + Hooks':'🔑 Add API Key First'}</button>
      <button class="btn btn-outline btn-full" style="margin-top:8px" id="adVariantBtn" ${!hasAiKey?'disabled':''} onclick="generateAdVariants()">🎲 Generate 10 Hook Variants</button>
    </div>
    <div class="panel" id="adResultPanel" style="display:none;margin-top:14px">
      <div class="panel-title">📋 Result</div>
      <div id="adResultContent" style="font-size:13px;color:var(--textm);line-height:1.7;white-space:pre-wrap"></div>
    </div>
    <div class="panel" id="adVariantPanel" style="display:none;margin-top:14px">
      <div class="panel-title">🎲 Hook Variants</div>
      <div id="adVariantContent" style="font-size:13px;color:var(--textm);line-height:1.7;white-space:pre-wrap"></div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="panel-title">🎬 Produce This Ad <span style="font-weight:400;color:var(--texts);font-size:11px">— jumps over with the right aspect ratio for your selected platform</span></div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="produceAdIn('videocanvas')">🎬 Video Canvas</button>
        <button class="btn btn-outline btn-sm" onclick="produceAdIn('imagegen')">🖼 Image Gen</button>
      </div>
    </div>
  `;
}

// ── PRODUCT LIBRARY ──
function saveLibraryProduct(){
  const name=document.getElementById("adProduct").value.trim();
  const usp=document.getElementById("adUSP").value.trim();
  if(!name){toast("Enter a product name first","error");return;}
  const products=gs("product_library",[])||[];
  const existing=products.findIndex(p=>p.name===name);
  if(existing>=0)products[existing]={name,usp};
  else products.push({name,usp});
  saveSetting("product_library",products);
  toast(`💾 "${name}" saved to Product Library`,"success");
  renderAdStudio(document.getElementById("moduleContent"));
}

function loadLibraryProduct(){
  const idx=document.getElementById("productLibSelect").value;
  if(idx==="")return;
  const products=gs("product_library",[])||[];
  const p=products[parseInt(idx)];
  if(!p)return;
  document.getElementById("adProduct").value=p.name;
  document.getElementById("adUSP").value=p.usp||"";
  toast(`📚 Loaded "${p.name}"`,"success");
}

// ── AD VARIANT GENERATOR ──
async function generateAdVariants(){
  const product=document.getElementById("adProduct").value.trim();
  const usp=document.getElementById("adUSP").value.trim();
  if(!product||!usp){toast("Fill in product and selling point first","error");return;}
  const btn=document.getElementById("adVariantBtn");
  const panel=document.getElementById("adVariantPanel");
  const content=document.getElementById("adVariantContent");
  btn.disabled=true;btn.textContent="⏳ Generating…";
  panel.style.display="block";
  content.textContent="Writing 10 distinct hook variants…";
  try{
    const reply=await callAiSimple(
      `Product: ${product}\nSelling point: ${usp}\n\nWrite exactly 10 short-form video ad hooks (opening lines, first 3 seconds). Each must use a genuinely different angle — curiosity, bold claim, question, pattern interrupt, social proof, problem-first, humor, controversy, direct offer, and story-open. Number them 1-10. One line each, no explanations.`,
      "You are a direct-response ad copywriter. Output only the numbered list, nothing else."
    );
    content.textContent=reply;
    logCost(gs("ai_model","claude")+"_ad_variants","Ad variants: "+product.slice(0,40));
    toast("🎲 10 hook variants generated","success");
  }catch(err){
    content.innerHTML=`<div style="color:var(--red)">❌ ${err.message}</div>`;
    toast("❌ Generation failed: "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="🎲 Generate 10 Hook Variants";
}

// ── PRODUCE HAND-OFF (platform-aware aspect ratio) ──
function produceAdIn(mod){
  const platformSel=document.getElementById("adPlatform");
  const ratio=platformSel?platformSel.value:"9:16";
  const product=document.getElementById("adProduct").value.trim();
  if(mod==="imagegen"){
    switchMod('imagegen',document.querySelector('[data-mod=imagegen]'));
    setTimeout(()=>{
      const ratioEl=document.getElementById("igRatio");
      const promptEl=document.getElementById("igChatInput");
      if(ratioEl)ratioEl.value=ratio;
      if(promptEl&&product)promptEl.value=`Product hero shot for ${product}, `;
    },50);
    toast(`🖼 Image Gen ready — aspect ratio set to ${ratio}`,"success");
  } else {
    S.pendingShotPrompt=product?`Ad hero shot for ${product}`:"";
    goToVideoCanvasFor("");
    toast(`🎬 Pick a project, add a shot — set its aspect ratio to ${ratio} for this platform`,"success");
  }
}

async function generateAdBrief(){
  const product=document.getElementById("adProduct").value.trim();
  const usp=document.getElementById("adUSP").value.trim();
  if(!product||!usp){toast("Fill in product and selling point first","error");return;}
  const format=document.getElementById("adFormat").value;
  const platformSel=document.getElementById("adPlatform");
  const platform=platformSel.options[platformSel.selectedIndex].text;

  const btn=document.getElementById("adGenBtn");
  const resultPanel=document.getElementById("adResultPanel");
  const resultContent=document.getElementById("adResultContent");
  btn.disabled=true;btn.textContent="⏳ Writing…";
  resultPanel.style.display="block";
  resultContent.textContent="Thinking through hooks and shot structure…";

  const directorStyle=getActiveDirectorPrompt();
  const systemPrompt=`You are an expert direct-response ad creative strategist. Write a tight, practical ad brief for short-form video ads. Be concrete and specific, not generic marketing fluff. Format your response in clear sections with markdown-style headers.${directorStyle?` Visual style to reference: ${directorStyle}.`:''}`;
  const userPrompt=`Product: ${product}\nKey selling point: ${usp}\nFormat: ${format}\nPlatform: ${platform}\n\nWrite:\n1. A one-line creative concept\n2. 5 scroll-stopping hook variations (first 3 seconds)\n3. A simple 4-shot structure (what happens in each shot)\n4. A suggested CTA line\n\nKeep it tight and production-ready — this will be used directly to generate video/image prompts.`;

  try{
    const reply=await callAiSimple(userPrompt,systemPrompt);
    resultContent.textContent=reply;
    logCost(gs("ai_model","claude")+"_ad_brief","Ad brief: "+product.slice(0,40));
    toast("✨ Ad brief generated!","success");
  }catch(err){
    console.error("Ad brief error:",err);
    resultContent.innerHTML=`<div style="color:var(--red)">❌ ${err.message}</div>`;
    toast("❌ Generation failed: "+err.message,"error");
  }
  btn.disabled=false;btn.textContent="✨ Generate Ad Brief + Hooks";
}


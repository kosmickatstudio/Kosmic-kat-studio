from pathlib import Path

HOME=Path('home.js')
AGENT=Path('agentfeline.js')
MARK='// ── EXTRA BRAIN PROVIDERS: GROK + KIMI ──'

s=HOME.read_text(encoding='utf-8')
if MARK not in s:
    replacements={
      '>Claude (Anthropic) (Best quality, supports images)</option>':'>Claude (Anthropic) — Claude Fable 5.1 / Opus 5</option>',
      '>Google Gemini — Free (3.8 Flash latest)</option>':'>Google Gemini — Gemini 3.8 Flash (Free)</option>',
      '>OpenAI GPT-4o (Supports images)</option>':'>OpenAI — GPT-5.6 Sol / Terra / Luna</option>',
      '>Groq — Free (GPT-OSS 120B / Qwen 3.8 27B)</option>':'>Groq — GPT-OSS 120B / 20B / Qwen 3.8 (Free)</option>',
      '>DeepSeek V4 Flash (Ultra cheap, text only)</option>':'>DeepSeek — V4 Flash</option>',
    }
    for old,new in replacements.items(): s=s.replace(old,new)
    old='''  groq:[
    {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B — FREE (latest)"},
    {id:"openai/gpt-oss-20b",label:"GPT-OSS 20B — FREE (fast)"},
    {id:"qwen/qwen3.8-27b",label:"Qwen 3.8 27B — FREE"}
  ]'''
    new='''  groq:[
    {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B — FREE (latest)"},
    {id:"openai/gpt-oss-20b",label:"GPT-OSS 20B — FREE (fast)"},
    {id:"qwen/qwen3.8-27b",label:"Qwen 3.8 27B — FREE"}
  ],
  grok:[
    {id:"grok-4.6",label:"Grok 4.6 — xAI flagship"}
  ],
  kimi:[
    {id:"kimi-k3",label:"Kimi K3 — EvoLink"}
  ]'''
    if old not in s: raise SystemExit('home catalog block not found')
    s=s.replace(old,new,1)
    old='''              {id:"deepseek",label:"DeepSeek V4",ready:!!gs("api_deepseek")},
              {id:"aicredits",label:"AICredits",ready:!!gs("api_aicredits")},'''
    new='''              {id:"deepseek",label:"DeepSeek V4",ready:!!gs("api_deepseek")},
              {id:"grok",label:"Grok 4.6 (xAI)",ready:!!gs("api_xai")},
              {id:"kimi",label:"Kimi K3 (EvoLink)",ready:!!gs("api_evolink")},
              {id:"aicredits",label:"AICredits",ready:!!gs("api_aicredits")},'''
    if old not in s: raise SystemExit('home quick list not found')
    s=s.replace(old,new,1)
    old='''<option value="deepseek" ${gs("ai_model","claude")==="deepseek"?"selected":""}>DeepSeek V4 Flash (Ultra cheap, text only)</option>'''
    new='''<option value="deepseek" ${gs("ai_model","claude")==="deepseek"?"selected":""}>DeepSeek — V4 Flash</option>
        <option value="grok" ${gs("ai_model","claude")==="grok"?"selected":""}>Grok 4.6 (xAI)</option>
        <option value="kimi" ${gs("ai_model","claude")==="kimi"?"selected":""}>Kimi K3 (EvoLink)</option>'''
    if old not in s: raise SystemExit('home select option not found')
    s=s.replace(old,new,1)
    old="onchange=\"saveSetting('ai_model',this.value);updateAiModelLabel();updateAicreditsModelVisibility();updateBrainSubModelVisibility();"
    new="onchange=\"saveSetting('ai_model',this.value);ensureExtraBrainKey(this.value);updateAiModelLabel();updateAicreditsModelVisibility();updateBrainSubModelVisibility();"
    if old not in s: raise SystemExit('home select onchange not found')
    s=s.replace(old,new,1)
    old='''function setBrainModelQuick(id){
  saveSetting("ai_model",id);'''
    new='''function setBrainModelQuick(id){
  if(!ensureExtraBrainKey(id))return;
  saveSetting("ai_model",id);'''
    if old not in s: raise SystemExit('quick setter not found')
    s=s.replace(old,new,1)
    s += '''
// ── EXTRA BRAIN PROVIDERS: GROK + KIMI ──
function ensureExtraBrainKey(provider){
  if(provider!=="grok"&&provider!=="kimi")return true;
  const keyName=provider==="grok"?"api_xai":"api_evolink";
  if(gs(keyName,""))return true;
  const label=provider==="grok"?"xAI API key (Grok 4.6)":"EvoLink API key (Kimi K3)";
  const key=prompt("Enter your "+label+". It will be stored only in this browser.");
  if(!key||!key.trim()){toast("No API key entered — provider not selected","error");return false;}
  saveSetting(keyName,key.trim());
  return true;
}
(function(){
  if(window.__kosmicExtraBrainsInstalled)return;
  window.__kosmicExtraBrainsInstalled=true;
  const original=window.callAiSimple;
  if(typeof original!=="function")return;
  async function direct(endpoint,key,model,userPrompt,systemPrompt){
    const messages=[];
    if(systemPrompt)messages.push({role:"system",content:systemPrompt});
    messages.push({role:"user",content:userPrompt});
    const res=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model,messages,reasoning_effort:"high",max_tokens:4000})});
    const data=await res.json();
    if(!res.ok||data.error)throw new Error((data.error&&data.error.message)||data.message||( "Provider error "+res.status));
    return (data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content)||"(No response)";
  }
  window.callAiSimple=async function(userPrompt,systemPrompt){
    const provider=gs("ai_model","claude");
    if(provider==="grok")return direct("https://api.x.ai/v1/chat/completions",gs("api_xai",""),gs("grok_brain_model","grok-4.6"),userPrompt,systemPrompt);
    if(provider==="kimi")return direct("https://direct.evolink.ai/v1/chat/completions",gs("api_evolink",""),gs("kimi_brain_model","kimi-k3"),userPrompt,systemPrompt);
    return original(userPrompt,systemPrompt);
  };
})();
'''
    HOME.write_text(s,encoding='utf-8')

s=AGENT.read_text(encoding='utf-8')
MARK2='// ── KIMI EVOLINK ROUTE: 2026-09-08 ──'
if MARK2 not in s:
    old='''  // No standalone Kimi key on this site — routed through the existing
  // fal.ai key via fal's OpenRouter-powered any-model endpoint, per Kosmic's
  // own hunch that fal might carry it. Confirmed: it does.
  const apiKey=gs("api_falai","");
  const model=getBrainModel("kimi")||"moonshotai/kimi-k3";
  const res=await fetch("https://fal.run/openrouter/router",{'''
    new='''  // Kimi K3 is routed directly through EvoLink's OpenAI-compatible API.
  const apiKey=gs("api_evolink","");
  const model=getBrainModel("kimi")||"kimi-k3";
  const res=await fetch("https://direct.evolink.ai/v1/chat/completions",{'''
    if old not in s: raise SystemExit('Agent Feline Kimi route not found')
    s=s.replace(old,new,1)
    s=s.replace('''    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},''','''    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},''',1)
    old='''  kimi:{id:"kimi",name:"Kimi",logoKey:"kimi",
    hasTextKey:()=>!!gs("api_falai",""),hasImageKey:()=>!!gs("api_falai",""),
    imageLabel:"FLUX.2 Max (via fal.ai)",imageKeyHint:"a fal.ai",'''
    new='''  kimi:{id:"kimi",name:"Kimi K3",logoKey:"kimi",
    hasTextKey:()=>!!gs("api_evolink",""),hasImageKey:()=>false,
    imageLabel:"Kimi K3 multimodal input",imageKeyHint:"an EvoLink",'''
    if old not in s: raise SystemExit('Agent Feline Kimi definition not found')
    s=s.replace(old,new,1)
    s += '\n'+MARK2+'\n'
    AGENT.write_text(s,encoding='utf-8')

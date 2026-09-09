/* KOSMIC KAT — HOME CURRENT LLM CATALOG
 * Runtime presentation/data layer for the existing Home AI Director Brain picker.
 * Does not store keys, alter generation routing, or replace the existing picker UI.
 * Last verified catalog snapshot: 2026-09-10.
 */
(function installHomeCurrentModels(){
  "use strict";
  if(window.__kosmicHomeCurrentModels)return;
  window.__kosmicHomeCurrentModels=true;

  const CATALOG={
    claude:[
      {id:"claude-fable-5-1",label:"Claude Fable 5.1 — latest / frontier"},
      {id:"claude-fable-5",label:"Claude Fable 5 — frontier"},
      {id:"claude-opus-5",label:"Claude Opus 5 — advanced reasoning"},
      {id:"claude-sonnet-5",label:"Claude Sonnet 5 — balanced"},
      {id:"claude-haiku-4-5-20251001",label:"Claude Haiku 4.5 — fast"},
      {id:"claude-opus-4-8",label:"Claude Opus 4.8"},
      {id:"claude-opus-4-7",label:"Claude Opus 4.7"},
      {id:"claude-opus-4-6",label:"Claude Opus 4.6"},
      {id:"claude-sonnet-4-6",label:"Claude Sonnet 4.6"}
    ],
    gemini:[
      {id:"gemini-3.8-flash",label:"Gemini 3.8 Flash — latest"},
      {id:"gemini-3.7-flash",label:"Gemini 3.7 Flash"},
      {id:"gemini-3.6-flash",label:"Gemini 3.6 Flash"},
      {id:"gemini-3.5-flash",label:"Gemini 3.5 Flash"},
      {id:"gemini-3.5-flash-lite",label:"Gemini 3.5 Flash-Lite — fastest"},
      {id:"gemini-3.1-flash-lite",label:"Gemini 3.1 Flash-Lite — efficient"}
    ],
    openai:[
      {id:"gpt-5.6-sol",label:"GPT-5.6 Sol — flagship"},
      {id:"gpt-5.6-terra",label:"GPT-5.6 Terra — balanced"},
      {id:"gpt-5.6-luna",label:"GPT-5.6 Luna — cost-efficient"}
    ],
    groq:[
      {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B — reasoning"},
      {id:"openai/gpt-oss-20b",label:"GPT-OSS 20B — fast"}
    ],
    deepseek:[
      {id:"deepseek-v4-pro",label:"DeepSeek V4 Pro — advanced reasoning"},
      {id:"deepseek-v4-flash",label:"DeepSeek V4 Flash — fast"},
      {id:"deepseek-v4-flash-vision-exp",label:"DeepSeek V4 Flash Vision — experimental"}
    ],
    grok:[
      {id:"grok-4.6",label:"Grok 4.6 — xAI flagship"},
      {id:"grok-4.20-0309-reasoning",label:"Grok 4.20 Reasoning"},
      {id:"grok-4.20-0309-non-reasoning",label:"Grok 4.20 — fast"}
    ],
    kimi:[
      {id:"kimi-k3",label:"Kimi K3 — EvoLink"}
    ]
  };

  window.KOSMIC_HOME_LLM_CATALOG=CATALOG;

  function applyCatalog(){
    if(typeof BRAIN_SUBMODELS==="undefined")return false;
    Object.keys(CATALOG).forEach(provider=>{
      BRAIN_SUBMODELS[provider]=CATALOG[provider].map(model=>({id:model.id,label:model.label}));
    });
    return true;
  }

  function updatePicker(){
    const providerSel=document.getElementById("aiModelSelect");
    const wrap=document.getElementById("brainSubModelWrap");
    const sel=document.getElementById("brainSubModelSelect");
    const label=document.getElementById("brainSubModelLabel");
    if(!providerSel||!wrap||!sel)return false;
    const provider=providerSel.value;
    const options=CATALOG[provider]||[];
    if(!options.length){
      wrap.style.display="none";
      sel.innerHTML="";
      return true;
    }
    wrap.style.display="block";
    const providerNames={
      claude:"Claude",gemini:"Gemini",openai:"OpenAI",groq:"Groq",
      deepseek:"DeepSeek",grok:"Grok (xAI)",kimi:"Kimi K3 (EvoLink)"
    };
    if(label)label.textContent="(which "+(providerNames[provider]||provider)+" model to actually use)";
    const key=provider+"_brain_model";
    const stored=typeof gs==="function"?gs(key,options[0].id):options[0].id;
    const current=options.some(model=>model.id===stored)?stored:options[0].id;
    sel.innerHTML=options.map(model=>{
      const value=String(model.id).replace(/"/g,"&quot;");
      const selected=model.id===current?" selected":"";
      return '<option value="'+value+'"'+selected+'>'+model.label+'</option>';
    }).join("");
    if(typeof renderSimpleTrigger==="function")renderSimpleTrigger("brainSubModelSelect");
    return true;
  }

  function refresh(){
    if(!applyCatalog())return false;
    return updatePicker();
  }

  window.refreshCurrentLlmUI=function(){
    refresh();
    if(typeof renderModelTrigger==="function"&&document.getElementById("aiModelSelect")){
      renderModelTrigger("aiModelSelect","brain");
    }
  };
  window.updateBrainSubModelVisibility=function(){refresh();};

  let tries=0;
  const timer=setInterval(()=>{
    if(refresh()||++tries>=80)clearInterval(timer);
  },50);
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",refresh,{once:true});
  }else{
    setTimeout(refresh,0);
  }
})();

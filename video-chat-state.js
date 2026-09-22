/* KOSMIC KAT — Video conversational state bridge
 * Shared source of truth for chat intent, references, and generation context.
 * No provider requests and no API-key storage.
 */
(function installKosmicVideoChatState(){
  "use strict";
  if(window.__kosmicVideoChatStateInstalled)return;
  window.__kosmicVideoChatStateInstalled=true;

  const S=window.S||(window.S={});
  const existing=window.__kosmicVideoChatState||{};
  const state=window.__kosmicVideoChatState=Object.assign({
    version:4,
    conversationId:null,
    messages:[],
    references:[],
    outputs:[],
    activeGeneration:null,
    directorOpen:false,
    composerDraft:"",
    execution:{route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",audio:true},
    createdAt:Date.now(),
    updatedAt:Date.now()
  },existing);

  if(!Array.isArray(state.messages))state.messages=[];
  if(!Array.isArray(state.references))state.references=[];
  if(!Array.isArray(state.outputs))state.outputs=[];
  if(!state.execution||typeof state.execution!=="object")state.execution={route:"seedance-2.5-text-to-video",duration:5,quality:"720p",aspect:"16:9",audio:true};

  const listeners=new Set();
  state.touch=function(){state.updatedAt=Date.now();listeners.forEach(fn=>{try{fn(state);}catch(err){console.error("Kosmic video state listener failed",err);}});return state;};
  state.subscribe=function(fn){if(typeof fn!=="function")return()=>{};listeners.add(fn);return()=>listeners.delete(fn);};
  state.addMessage=function(role,content,meta={}){
    const item={id:"vmsg_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),role,content:String(content||""),meta:Object.assign({},meta),createdAt:Date.now()};
    state.messages.push(item);state.touch();return item;
  };
  state.setActiveGeneration=function(payload){state.activeGeneration=payload?Object.assign({},payload):null;state.touch();};

  state.addReference=function(ref){
    const incoming=ref||{};
    const kind=String(incoming.kind||"image");
    const url=String(incoming.url||incoming.dataUrl||"");
    const existingRef=state.references.find(r=>r.kind===kind&&String(r.url||r.dataUrl||"")===url&&url);
    if(existingRef){
      if(incoming.name&&!existingRef.name)existingRef.name=incoming.name;
      state.touch();state.syncV3&&state.syncV3();return existingRef;
    }
    const item=Object.assign({id:"vref_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),createdAt:Date.now()},incoming,{kind,url:url||incoming.url});
    state.references.push(item);state.touch();state.syncV3&&state.syncV3();return item;
  };
  state.removeReference=function(id){state.references=state.references.filter(x=>x.id!==id);state.touch();state.syncV3&&state.syncV3();};
  state.clearReferences=function(){state.references=[];state.touch();state.syncV3&&state.syncV3();};

  const pick=kind=>state.references.filter(r=>r.kind===kind).map(r=>({url:r.url,name:r.name||"Reference",dataUrl:r.url}));
  const cleanRoute=v=>String(v||"seedance-2.5-text-to-video");

  /* Pull execution controls from the authoritative V3 state before any chat
   * operation. This prevents stale Chat metadata after Director edits. */
  state.syncFromV3=function(){
    const v3=window.__kosmicVideoV3State;
    if(!v3)return state;
    const next={
      route:cleanRoute(v3.route),
      duration:v3.duration??state.execution.duration,
      quality:v3.quality??state.execution.quality,
      aspect:v3.aspect??state.execution.aspect,
      audio:v3.audio!==false
    };
    state.execution=next;
    return state;
  };

  /* V3 is the sole Video Canvas execution state. Chat remains the
   * conversational source of truth for prompt and references. */
  state.syncV3=function(){
    const v3=window.__kosmicVideoV3State;
    const images=pick("image"),videos=pick("video"),audios=pick("audio");
    if(v3){
      v3.prompt=state.composerDraft||v3.prompt||"";
      v3.images=images;v3.videos=videos;v3.audios=audios;
      state.execution={route:cleanRoute(v3.route),duration:v3.duration??state.execution.duration,quality:v3.quality??state.execution.quality,aspect:v3.aspect??state.execution.aspect,audio:v3.audio!==false};
    }
    if(window.S){
      S.vcMultiImages=images.map(x=>({dataUrl:x.url,name:x.name}));
      S.vcMultiVideos=videos.map(x=>({dataUrl:x.url,name:x.name}));
      S.vcMultiAudios=audios.map(x=>({dataUrl:x.url,name:x.name}));
    }
    state.touch();
  };

  state.syncFromV3();
  window.addEventListener("kosmic:video-director-toggle",e=>{
    state.directorOpen=!!e.detail?.open;
    state.syncFromV3();
  });
})();

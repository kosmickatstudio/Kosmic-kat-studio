/* KOSMIC KAT — Video conversational state bridge
 * Phase 2 foundation only. No provider requests, no API-key storage.
 * CHAT = intent/context. V3 will consume this same state in Phase 4.
 */
(function installKosmicVideoChatState(){
  "use strict";
  if(window.__kosmicVideoChatStateInstalled)return;
  window.__kosmicVideoChatStateInstalled=true;

  const S=window.S||(window.S={});
  const existing=window.__kosmicVideoChatState||{};
  const state=window.__kosmicVideoChatState=Object.assign({
    version:1,
    conversationId:null,
    messages:[],
    references:[],
    activeGeneration:null,
    directorOpen:false,
    composerDraft:"",
    createdAt:Date.now(),
    updatedAt:Date.now()
  },existing);

  if(!Array.isArray(state.messages))state.messages=[];
  if(!Array.isArray(state.references))state.references=[];

  state.touch=function(){state.updatedAt=Date.now();return state;};
  state.addMessage=function(role,content,meta={}){
    const item={id:"vmsg_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),role,content:String(content||""),meta:Object.assign({},meta),createdAt:Date.now()};
    state.messages.push(item);state.touch();return item;
  };
  state.setActiveGeneration=function(payload){state.activeGeneration=payload?Object.assign({},payload):null;state.touch();};
  state.addReference=function(ref){
    const item=Object.assign({id:"vref_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),createdAt:Date.now()},ref||{});
    state.references.push(item);state.touch();return item;
  };
  state.removeReference=function(id){state.references=state.references.filter(x=>x.id!==id);state.touch();};
  state.clearReferences=function(){state.references=[];state.touch();};

  /* Keep the existing Video/V3 states as execution-facing state, not a second
   * source of truth for chat history. This is intentionally shallow. */
  state.syncLegacy=function(){
    const v2=window.__kosmicVideoV2State;
    const v3=window.__kosmicVideoV3State;
    if(v2){v2.prompt=state.composerDraft||v2.prompt||"";v2.images=state.references.filter(r=>r.kind==="image").map(r=>({url:r.url,name:r.name||"Reference"}));}
    if(v3){v3.prompt=state.composerDraft||v3.prompt||"";v3.images=state.references.filter(r=>r.kind==="image").map(r=>({url:r.url,name:r.name||"Reference"}));}
    if(window.S){S.vcMultiImages=state.references.filter(r=>r.kind==="image").map(r=>({dataUrl:r.url,name:r.name||"Reference"}));}
  };
})();
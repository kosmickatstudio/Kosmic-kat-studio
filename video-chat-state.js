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
    version:3,
    conversationId:null,
    messages:[],
    references:[],
    outputs:[],
    activeGeneration:null,
    directorOpen:false,
    composerDraft:"",
    createdAt:Date.now(),
    updatedAt:Date.now()
  },existing);

  if(!Array.isArray(state.messages))state.messages=[];
  if(!Array.isArray(state.references))state.references=[];
  if(!Array.isArray(state.outputs))state.outputs=[];

  state.touch=function(){state.updatedAt=Date.now();return state;};
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
      state.touch();state.syncLegacy&&state.syncLegacy();return existingRef;
    }
    const item=Object.assign({id:"vref_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),createdAt:Date.now()},incoming,{kind,url:url||incoming.url});
    state.references.push(item);state.touch();state.syncLegacy&&state.syncLegacy();return item;
  };
  state.removeReference=function(id){state.references=state.references.filter(x=>x.id!==id);state.touch();state.syncLegacy&&state.syncLegacy();};
  state.clearReferences=function(){state.references=[];state.touch();state.syncLegacy&&state.syncLegacy();};

  const pick=kind=>state.references.filter(r=>r.kind===kind).map(r=>({url:r.url,name:r.name||"Reference",dataUrl:r.url}));

  /* Keep the existing V2/V3 states as execution-facing state. Chat remains the
   * conversational source of truth while the existing execution layer consumes
   * mirrored references in its established image/video/audio arrays. */
  state.syncLegacy=function(){
    const v2=window.__kosmicVideoV2State;
    const v3=window.__kosmicVideoV3State;
    const images=pick("image"),videos=pick("video"),audios=pick("audio");
    if(v2){v2.prompt=state.composerDraft||v2.prompt||"";v2.images=images;v2.videos=videos;v2.audios=audios;}
    if(v3){v3.prompt=state.composerDraft||v3.prompt||"";v3.images=images;v3.videos=videos;v3.audios=audios;}
    if(window.S){
      S.vcMultiImages=images.map(x=>({dataUrl:x.url,name:x.name}));
      S.vcMultiVideos=videos.map(x=>({dataUrl:x.url,name:x.name}));
      S.vcMultiAudios=audios.map(x=>({dataUrl:x.url,name:x.name}));
    }
  };
})();

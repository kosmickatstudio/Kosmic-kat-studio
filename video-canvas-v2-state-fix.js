/* KOSMIC KAT — Video Canvas V2 state defaults */
(function(){
  "use strict";
  const apply=()=>{
    const s=window.__kosmicVideoV2State;
    if(!s)return false;
    if(typeof s.content_filter!=="boolean")s.content_filter=true;
    if(typeof s.audio!=="boolean")s.audio=true;
    return true;
  };
  if(!apply()){let n=0;const t=setInterval(()=>{if(apply()||++n>80)clearInterval(t);},50);}
})();

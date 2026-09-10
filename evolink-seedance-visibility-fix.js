/* KOSMIC KAT — Seedance playground visibility fix
 * The schema adapter originally mounted its panel inside Video Settings.
 * That made the schema technically present but invisible during normal Video
 * Canvas use. This presentation-only layer moves the existing panel into the
 * visible model-control area. It does not change API keys, auth, storage,
 * generation routing, or the native settings shutter.
 */
(function installSeedanceVisibilityFix(){
  "use strict";
  if(window.__kosmicSeedanceVisibilityFix)return;
  window.__kosmicSeedanceVisibilityFix=true;

  function place(){
    const panel=document.getElementById("evoSeedanceSchemaPanel");
    const model=document.getElementById("vcModel");
    if(!panel||!model)return false;
    const host=model.closest(".f-group,.vc-model-wrap,.model-control,.control-group")||model.parentElement;
    if(!host)return false;
    const parent=host.parentElement||host;
    if(panel.parentElement!==parent)parent.appendChild(panel);
    panel.hidden=false;
    panel.removeAttribute("aria-hidden");
    panel.style.display="block";
    panel.dataset.kosmicVisible="1";
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    if(place()||++tries>240)clearInterval(timer);
  },100);
  place();
})();

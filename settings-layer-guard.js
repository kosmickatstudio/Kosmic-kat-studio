/* KOSMIC KAT — SETTINGS LAYER GUARD
 * Presentation/DOM-layer hardening for every bottom-sheet settings surface.
 *
 * Settings sheets can be created inside module/chat containers that also use
 * glass blur, transforms, filters or stacking contexts. A normal fixed sheet
 * can then be trapped under its backdrop, producing a large blurred veil over
 * the controls. This guard moves the sheet/backdrop to <body> and gives them
 * one dedicated topmost layer.
 *
 * Intentionally event-driven. No broad MutationObserver is used because the
 * studio performs frequent DOM updates during generation.
 */
(function installSettingsLayerGuard(){
  "use strict";
  if(window.__kosmicSettingsLayerGuard)return;
  window.__kosmicSettingsLayerGuard=true;

  const Z_BACKDROP=2147483646;
  const Z_SHEET=2147483647;
  const OPEN_STATES=["open","active","show","is-open"];

  const isOpen=sheet=>OPEN_STATES.some(state=>sheet.classList.contains(state));

  function relatedBackdrop(sheet){
    if(!sheet)return null;
    const id=sheet.id||"";
    const candidates=[];
    if(id.endsWith("Panel"))candidates.push(id.slice(0,-5)+"Backdrop");
    if(id.endsWith("Sheet"))candidates.push(id.slice(0,-5)+"Backdrop");
    candidates.push(id.replace(/Panel$/,"Backdrop"),id+"Backdrop");
    for(const candidate of candidates){
      const el=document.getElementById(candidate);
      if(el)return el;
    }
    return null;
  }

  function promote(sheet){
    if(!sheet||!sheet.classList.contains("ig-settings-sheet"))return;
    const backdrop=relatedBackdrop(sheet);

    // Backdrop first, sheet second. This ordering plus z-index is the hard
    // boundary that prevents future feature overlays from covering the sheet.
    if(backdrop){
      if(backdrop.parentElement!==document.body)document.body.appendChild(backdrop);
      backdrop.style.zIndex=String(Z_BACKDROP);
      backdrop.style.filter="none";
      backdrop.style.webkitFilter="none";
      backdrop.style.backdropFilter="none";
      backdrop.style.webkitBackdropFilter="none";
    }
    if(sheet.parentElement!==document.body)document.body.appendChild(sheet);
    sheet.style.zIndex=String(Z_SHEET);
    sheet.style.filter="none";
    sheet.style.webkitFilter="none";

    // Only touch geometry/visibility while the sheet is actually open. Closed
    // sheets keep their original transition/hidden state from the app.
    if(isOpen(sheet)){
      sheet.style.visibility="visible";
      sheet.style.opacity="1";
      sheet.style.pointerEvents="auto";
      sheet.style.transform=window.innerWidth<=700?"translateY(0)":"translateX(-50%) translateY(0)";
    }
  }

  function promoteAll(){document.querySelectorAll(".ig-settings-sheet").forEach(promote);}

  function runForIds(){
    ["toggleIgSettings","toggleVcSettings","toggleCsSettings","openDirSheet"].forEach(name=>{
      const fn=window[name];
      if(typeof fn!=="function"||fn.__kosmicSettingsGuardWrapped)return;
      const wrapped=function(){
        promoteAll();
        const result=fn.apply(this,arguments);
        promoteAll();
        setTimeout(promoteAll,0);
        return result;
      };
      wrapped.__kosmicSettingsGuardWrapped=true;
      wrapped.__kosmicOriginal=fn;
      window[name]=wrapped;
    });
  }

  // Covers click-driven settings launchers even if a future implementation
  // changes the global function name.
  document.addEventListener("click",function(event){
    const target=event.target&&event.target.closest?event.target.closest("[onclick]"):null;
    if(!target)return;
    const code=target.getAttribute("onclick")||"";
    if(/toggle(?:Ig|Vc|Cs)Settings|openDirSheet/i.test(code)){
      promoteAll();
      setTimeout(promoteAll,0);
    }
  },true);

  let tries=0;
  const timer=setInterval(()=>{
    runForIds();
    promoteAll();
    if(++tries>80)clearInterval(timer);
  },50);

  promoteAll();
  window.__kosmicPromoteSettingsSheets=promoteAll;
})();

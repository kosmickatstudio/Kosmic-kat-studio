/* KOSMIC KAT — SETTINGS LAYER GUARD
 * Presentation/DOM-layer hardening for every bottom-sheet settings surface.
 *
 * Why this exists:
 *   Settings sheets were historically created inside module/chat containers.
 *   Glass effects and later feature overlays can create stacking/containing
 *   contexts that place a backdrop above the sheet body, making the controls
 *   look "blurred away" even though the sheet itself is open.
 *
 * Policy:
 *   1. Any .ig-settings-sheet is promoted to <body>.
 *   2. Its matching .ig-settings-backdrop is promoted to <body> first.
 *   3. Backdrop and sheet use a dedicated topmost z-index band.
 *   4. No blur/filter is allowed on the settings backdrop itself.
 *   5. This layer never changes application state, auth, generation, or saves.
 *
 * Intentionally event-driven. No broad MutationObserver is used, because the
 * studio performs frequent DOM updates during generation and a permanent
 * subtree observer previously caused avoidable work/freezes.
 */
(function installSettingsLayerGuard(){
  "use strict";
  if(window.__kosmicSettingsLayerGuard)return;
  window.__kosmicSettingsLayerGuard=true;

  const Z_BACKDROP=2147483644;
  const Z_SHEET=2147483645;

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

    // Backdrop first, sheet second. This is the critical DOM ordering.
    if(backdrop){
      if(backdrop.parentElement!==document.body)document.body.appendChild(backdrop);
      backdrop.style.zIndex=String(Z_BACKDROP);
      backdrop.style.filter="none";
      backdrop.style.webkitFilter="none";
      backdrop.style.backdropFilter="none";
      backdrop.style.webkitBackdropFilter="none";
      backdrop.style.opacity="1";
    }
    if(sheet.parentElement!==document.body)document.body.appendChild(sheet);
    sheet.style.zIndex=String(Z_SHEET);
    sheet.style.filter="none";
    sheet.style.webkitFilter="none";
    sheet.style.transform=window.innerWidth<=700?"translateY(0)":"translateX(-50%) translateY(0)";
    sheet.style.visibility="visible";
    sheet.style.opacity="1";
    sheet.style.pointerEvents="auto";
  }

  function promoteAll(){
    document.querySelectorAll(".ig-settings-sheet").forEach(promote);
  }

  function runForIds(){
    [
      "toggleIgSettings",
      "toggleVcSettings",
      "toggleCsSettings",
      "openDirSheet"
    ].forEach(name=>{
      const fn=window[name];
      if(typeof fn!=="function"||fn.__kosmicSettingsGuardWrapped)return;
      const wrapped=function(){
        promoteAll();
        const result=fn.apply(this,arguments);
        // The toggle may create its panel during the call, so repair once
        // immediately after the DOM has been updated and once on the next task.
        promoteAll();
        setTimeout(promoteAll,0);
        return result;
      };
      wrapped.__kosmicSettingsGuardWrapped=true;
      wrapped.__kosmicOriginal=fn;
      window[name]=wrapped;
    });
  }

  // Protect click-driven openings even if a future implementation renames or
  // replaces one of the global toggle functions.
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

  // A final lightweight initial pass covers sheets already present when this
  // guard is loaded.
  promoteAll();
  window.__kosmicPromoteSettingsSheets=promoteAll;
})();

/* KOSMIC KAT — SETTINGS LAYER GUARD
 * Presentation/DOM-layer hardening for every settings surface.
 * This guard owns only document-layer placement and z-index. It deliberately
 * never writes transform/geometry while a sheet is open, because the existing
 * sheetSwipeStart/Move/End handlers own the shutter gesture.
 */
(function installSettingsLayerGuard(){
  "use strict";
  if(window.__kosmicSettingsLayerGuard)return;
  window.__kosmicSettingsLayerGuard=true;

  const Z_BACKDROP=2147481000;
  const Z_SHEET=2147481001;
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
    // Do not write transform/left/right/bottom/opacity/visibility here while
    // open. Those are part of the existing shutter/open/close implementation.
    if(isOpen(sheet)){
      sheet.style.pointerEvents="auto";
    }
  }

  function promoteAll(){
    document.querySelectorAll(".ig-settings-sheet").forEach(promote);
  }

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

  // Keep settings controls themselves untouched. A click outside a settings
  // sheet may promote the sheet, but this guard never auto-closes it and never
  // cancels the original event.
  document.addEventListener("click",function(event){
    const target=event.target;
    if(!target?.closest)return;
    const sheet=target.closest(".ig-settings-sheet");
    if(sheet){
      promote(sheet);
      return;
    }
    const launcher=target.closest("[onclick]");
    const code=launcher?.getAttribute("onclick")||"";
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

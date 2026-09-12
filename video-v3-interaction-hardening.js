/* KOSMIC KAT — Video V3 interaction hardening
 * Keeps the existing V3 engine intact while removing misleading controls,
 * preventing no-op storyboard actions, preserving stateful UI affordances,
 * and improving keyboard/accessibility behavior after V3 re-renders.
 */
(function installKosmicVideoV3Hardening(){
  "use strict";
  if(window.__kosmicVideoV3InteractionHardening)return;
  window.__kosmicVideoV3InteractionHardening=true;

  const css=()=>{
    if(document.getElementById("kk-v3-hardening-css"))return;
    const s=document.createElement("style");s.id="kk-v3-hardening-css";
    s.textContent=`
      #kkVideoCanvasV3 .kkv3-tab[aria-selected="true"]{outline:2px solid rgba(98,64,176,.16);outline-offset:-2px}
      #kkVideoCanvasV3 .kkv3-pill[aria-pressed="true"],#kkVideoCanvasV3 .kkv3-route[aria-selected="true"]{box-shadow:0 0 0 2px rgba(98,64,176,.10) inset}
      #kkVideoCanvasV3 button:disabled{opacity:.42;cursor:not-allowed;filter:none;transform:none!important}
      #kkVideoCanvasV3 .kkv3-shot-actions{flex-wrap:wrap}
      #kkVideoCanvasV3 .kkv3-shot-actions button[disabled]{pointer-events:none}
      @media(max-width:700px){#kkVideoCanvasV3 .kkv3-shot-actions button{min-height:34px}}
    `;
    document.head.appendChild(s);
  };

  function v3(){return document.getElementById("kkVideoCanvasV3");}

  function harden(){
    const root=v3();if(!root)return;

    // "Popular" was previously a decorative control with no behavior. Remove it
    // rather than leaving a button that lies to the user about being interactive.
    root.querySelector("#kkv3Popular")?.remove();

    root.querySelectorAll("[data-workspace]").forEach(btn=>{
      const active=btn.dataset.workspace===window.__kosmicVideoV3State?.workspace;
      btn.setAttribute("aria-selected",active?"true":"false");
      btn.setAttribute("role","tab");
      btn.tabIndex=active?0:-1;
    });

    root.querySelectorAll("[data-route]").forEach(btn=>{
      const active=btn.dataset.route===window.__kosmicVideoV3State?.route;
      btn.setAttribute("aria-selected",active?"true":"false");
    });

    root.querySelectorAll("[data-quality],[data-aspect]").forEach(btn=>{
      const state=window.__kosmicVideoV3State||{};
      const active=(btn.dataset.quality!=null&&btn.dataset.quality===state.quality)||(btn.dataset.aspect!=null&&btn.dataset.aspect===state.aspect);
      btn.setAttribute("aria-pressed",active?"true":"false");
    });

    // The first storyboard shot cannot be removed or copied from a predecessor.
    // Disable those actions rather than letting a click appear to do nothing.
    const shots=root.querySelectorAll("[data-story-prompt]");
    shots.forEach((field,index)=>{
      const row=field.closest(".kkv3-shot");if(!row)return;
      const remove=row.querySelector("[data-story-remove]");
      const copy=row.querySelector("[data-story-copy]");
      if(remove){
        const only=shots.length===1;
        remove.disabled=only;
        remove.title=only?"The storyboard needs at least one shot.":"Remove this shot";
        remove.setAttribute("aria-disabled",only?"true":"false");
      }
      if(copy){
        const first=index===0;
        copy.disabled=first;
        copy.title=first?"There is no previous shot to copy.":"Copy the previous shot's prompt";
        copy.setAttribute("aria-disabled",first?"true":"false");
      }
    });

    const activePrompt=root.querySelector("#kkv3Prompt");
    if(activePrompt){
      activePrompt.setAttribute("aria-label","Video shot prompt");
      activePrompt.setAttribute("autocomplete","off");
    }

    root.querySelectorAll("button").forEach(btn=>{
      if(!btn.getAttribute("type"))btn.setAttribute("type","button");
    });
  }

  function boot(){
    css();
    const root=document.getElementById("kkVideoCanvasV3")||document.body;
    const mo=new MutationObserver(()=>{if(document.getElementById("kkVideoCanvasV3"))harden();});
    mo.observe(root,{childList:true,subtree:true});
    window.__kosmicVideoV3HardeningObserver=mo;
    harden();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

/* KOSMIC KAT — Video V3 interaction hardening
 * Keeps the existing V3 engine intact while removing misleading controls,
 * preventing no-op storyboard actions, adding real shot reordering,
 * preserving stateful UI affordances, and improving keyboard/accessibility
 * behavior after V3 re-renders.
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
      #kkVideoCanvasV3 .kkv3-reorder{display:inline-flex;align-items:center;justify-content:center;min-width:34px}
      @media(max-width:700px){#kkVideoCanvasV3 .kkv3-shot-actions button{min-height:34px}}
    `;
    document.head.appendChild(s);
  };

  function v3(){return document.getElementById("kkVideoCanvasV3");}
  function rerender(){
    const root=v3();
    const tab=root?.querySelector('[data-workspace]');
    if(tab)tab.click();
  }

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

      let reorder=row.querySelector(".kkv3-reorder-wrap");
      if(!reorder){
        reorder=document.createElement("span");reorder.className="kkv3-reorder-wrap";reorder.style.cssText="display:inline-flex;gap:6px";
        const up=document.createElement("button");up.type="button";up.className="kkv3-reorder";up.textContent="↑";up.title="Move shot up";up.setAttribute("aria-label","Move shot up");up.dataset.kkReorder="up";
        const down=document.createElement("button");down.type="button";down.className="kkv3-reorder";down.textContent="↓";down.title="Move shot down";down.setAttribute("aria-label","Move shot down");down.dataset.kkReorder="down";
        reorder.append(up,down);
        row.querySelector(".kkv3-shot-actions")?.appendChild(reorder);
        up.addEventListener("click",()=>moveShot(index,-1));
        down.addEventListener("click",()=>moveShot(index,1));
      }
      const up=reorder.querySelector('[data-kk-reorder="up"]');
      const down=reorder.querySelector('[data-kk-reorder="down"]');
      if(up)up.disabled=index===0;
      if(down)down.disabled=index===shots.length-1;
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

  function moveShot(index,delta){
    const state=window.__kosmicVideoV3State;if(!state||!Array.isArray(state.storyboard))return;
    const next=index+delta;if(next<0||next>=state.storyboard.length)return;
    const [shot]=state.storyboard.splice(index,1);
    state.storyboard.splice(next,0,shot);
    rerender();
  }

  function boot(){
    css();
    const target=document.getElementById("kkVideoCanvasV3")||document.body;
    const mo=new MutationObserver(()=>{if(document.getElementById("kkVideoCanvasV3"))harden();});
    mo.observe(target,{childList:true,subtree:true});
    window.__kosmicVideoV3HardeningObserver=mo;
    harden();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();

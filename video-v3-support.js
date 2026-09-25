/* KOSMIC KAT — Video V3 support
 * Deterministic helpers for the canonical Video Canvas.
 * No provider calls, credentials, or MutationObservers.
 */
(function(){
  "use strict";
  if(window.__kosmicVideoV3Support)return;
  window.__kosmicVideoV3Support=true;

  const byId=id=>document.getElementById(id);
  const root=()=>byId("kkVideoCanvasV3");
  const state=()=>window.__kosmicVideoV3State;
  const catalog=()=>window.KOSMIC_EVOLINK_VIDEO?.index||{};
  const modeOf=r=>{
    const s=String(r?.mode||r?.id||"").toLowerCase();
    return s.includes("reference")?"reference":s.includes("extend")?"extend":s.includes("edit")?"edit":s.includes("motion")?"motion":s.includes("upscale")?"upscale":s.includes("avatar")?"avatar":s.includes("image")?"image":"text";
  };
  const esc=v=>String(v??"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));

  function assetKind(a){
    const k=String(a?.kind||a?.type||"").toLowerCase();
    return k==="video"?"videos":k==="audio"?"audios":"images";
  }
  function assetUrl(a){return String(a?.data||a?.url||"");}

  function openAssetPicker(){
    byId("kkv3AssetPicker")?.remove();
    const uploads=Array.isArray(window.S?.uploads)?window.S.uploads:[];
    const overlay=document.createElement("div");
    overlay.id="kkv3AssetPicker";
    overlay.style.cssText="position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px";
    const backdrop=document.createElement("div");
    backdrop.style.cssText="position:absolute;inset:0;background:rgba(20,12,40,.36);backdrop-filter:blur(8px)";
    const panel=document.createElement("section");
    panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
    panel.style.cssText="position:relative;width:min(560px,100%);max-height:min(78vh,680px);overflow:hidden;border:1px solid var(--border,rgba(61,31,122,.14));border-radius:20px;background:var(--surface,#fff);box-shadow:0 24px 80px rgba(31,18,64,.28);display:flex;flex-direction:column";
    panel.innerHTML='<header style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:15px;border-bottom:1px solid var(--border,rgba(61,31,122,.09))"><div><h3 style="margin:0;font-size:14px;color:var(--violet,#3d1f7a)">Upload from Assets</h3><p style="margin:4px 0 0;font-size:9px;color:var(--texts,#9488ae);line-height:1.4">Select an existing Asset Library file for this Video route.</p></div><button type="button" data-close aria-label="Close" style="width:32px;height:32px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:50%;background:var(--pearl2,#f3eff8);color:var(--textm,#5a4880);font-size:18px">×</button></header>';
    const list=document.createElement("div");
    list.style.cssText="padding:12px;overflow:auto;display:flex;flex-direction:column;gap:7px";
    if(!uploads.length){
      list.innerHTML='<div style="padding:30px 12px;text-align:center;color:var(--texts,#9488ae);font-size:10px">No uploaded assets yet. Open Asset Library to upload files first.</div>';
    }else{
      uploads.forEach((a,i)=>{
        const url=assetUrl(a),kind=String(a?.kind||a?.type||"").toLowerCase(),name=String(a?.name||("Asset "+(i+1))),key=assetKind(a),s=state();
        const attached=!!s?.[key]?.some(x=>x.url===url);
        const item=document.createElement("button");item.type="button";item.dataset.index=String(i);item.disabled=attached;
        item.style.cssText="display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:7px;border:1px solid var(--border,rgba(61,31,122,.10));border-radius:13px;background:var(--surface,#fff);text-align:left;color:var(--text,#1e1230)";
        const media=kind==="video"?"<video src=\""+esc(url)+"\" muted playsinline style=\"width:54px;height:54px;object-fit:cover;border-radius:9px\"></video>":kind==="audio"?"<div style=\"width:54px;height:54px;display:grid;place-items:center;font-size:20px\">🎧</div>":"<img src=\""+esc(url)+"\" alt=\"\" style=\"width:54px;height:54px;object-fit:cover;border-radius:9px\">";
        item.innerHTML='<span>'+media+'</span><span style="min-width:0;display:flex;flex-direction:column;gap:3px"><b style="font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(name)+'</b><small style="font-size:8px;color:var(--texts,#9488ae)">'+esc(kind||"image")+(attached?" • already attached":"")+'</small></span><span style="font-size:9px;font-weight:850;color:var(--violet,#3d1f7a);padding:7px 9px;border-radius:9px;background:rgba(98,64,176,.08)">'+(attached?"✓":"Add")+'</span>';
        list.appendChild(item);
      });
    }
    panel.appendChild(list);overlay.append(backdrop,panel);document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.addEventListener("click",e=>{
      if(e.target.closest("[data-close]")||e.target===backdrop){close();return;}
      const item=e.target.closest("[data-index]");if(!item)return;
      const a=uploads[Number(item.dataset.index)],s=state();if(!a||!s)return;
      const key=assetKind(a),url=assetUrl(a),route=catalog()[s.route],lim=route?.model?.schema?.refs||route?.schema?.refs||{},total=s.images.length+s.videos.length+s.audios.length;
      if(!url){toast("This asset has no usable file URL.","error");return;}
      if((lim.total!=null&&total>=Number(lim.total))||(lim[key]!=null&&s[key].length>=Number(lim[key]))){toast("Reference limit reached for this route.","error");return;}
      s[key].push({url,name:a.name||"Asset reference"});close();window.__kosmicVideoCanvasV3Render?.();toast("Asset added as a Video reference.","success");
    });
  }

  function historyAction(index,action){
    const s=state(),item=s?.history?.[index];if(!s||!item||item.error)return;
    if(action==="download"){
      if(!/^https?:\/\//i.test(String(item.url||""))){toast("This result has no downloadable URL.","error");return;}
      const a=document.createElement("a");a.href=item.url;a.target="_blank";a.rel="noopener";a.download=(item.model||"kosmic-video")+"-"+Date.now()+".mp4";a.click();return;
    }
    if(action==="regenerate"){
      s.workspace="shot";s.prompt=item.prompt||"";window.__kosmicVideoCanvasV3Render?.();setTimeout(()=>root()?.querySelector("[data-stable-generate]")?.click(),60);return;
    }
    const routes=Object.values(catalog());
    const isSeed25=id=>String(id||"").startsWith("seedance-2.5-");
    const target=action==="reference"
      ? routes.find(r=>isSeed25(r.id)&&modeOf(r)==="reference")||routes.find(r=>modeOf(r)==="reference")
      : routes.find(r=>isSeed25(r.id)&&modeOf(r)===action)||routes.find(r=>modeOf(r)===action);
    if(!target){toast("No compatible Video route is available for that action.","error");return;}
    s.route=target.id;s.videos=[{url:item.url,name:"Generated video"}];s.images=[];s.audios=[];s.prompt=item.prompt||"";s.workspace="shot";
    window.__kosmicVideoCanvasV3Render?.();
  }

  function bind(){
    const r=root();if(!r||r.__kkv3SupportBound)return;
    r.__kkv3SupportBound=true;
    r.addEventListener("click",e=>{
      const asset=e.target.closest("[data-kosmic-video-assets]");
      if(asset){openAssetPicker();return;}
      const b=e.target.closest("[data-history-action]");
      if(b)historyAction(Number(b.dataset.historyIndex),b.dataset.historyAction);
    });
  }

  window.__kosmicVideoOpenAssetPicker=openAssetPicker;
  window.addEventListener("kosmic:video-v3-rendered",bind);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
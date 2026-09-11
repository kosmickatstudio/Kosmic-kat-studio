/* KOSMIC KAT — VIDEO CANVAS V2 SETTINGS
 * Replaces the retired Video Settings shutter. This file owns ONLY the
 * Video Canvas settings surface; generation stays in video-canvas-v2.js.
 */
(function installVideoCanvasV2Settings(){
  "use strict";
  if(window.__kosmicVideoCanvasV2Settings)return;
  window.__kosmicVideoCanvasV2Settings=true;

  const PANEL_ID="kkv2SettingsSheet";
  const BACKDROP_ID="kkv2SettingsBackdrop";
  const oldPanel=()=>document.getElementById("vcSettingsPanel");
  const oldBackdrop=()=>document.getElementById("vcSettingsBackdrop");
  const $=id=>document.getElementById(id);
  const st=()=>window.__kosmicVideoV2State||{};
  const getKey=()=>String(typeof gs==="function"?gs("api_evolink",""):"").trim();
  const setKey=v=>{ if(typeof saveSetting==="function")saveSetting("api_evolink",String(v||"").trim()); };

  function hideLegacy(){
    const p=oldPanel(),b=oldBackdrop();
    [p,b].forEach(el=>{
      if(!el)return;
      el.classList.remove("open","active","show","is-open");
      el.hidden=true;
      el.setAttribute("aria-hidden","true");
      el.style.setProperty("display","none","important");
      el.style.setProperty("pointer-events","none","important");
    });
  }

  function css(){
    if($("kkv2-settings-css"))return;
    const s=document.createElement("style");
    s.id="kkv2-settings-css";
    s.textContent=`
      #${BACKDROP_ID}{position:fixed;inset:0;background:rgba(14,10,24,.46);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease;z-index:2147483000}
      #${BACKDROP_ID}.open{opacity:1;visibility:visible;pointer-events:auto}
      #${PANEL_ID}{position:fixed;left:50%;bottom:0;width:min(560px,100vw);max-height:min(82vh,760px);transform:translate(-50%,110%);background:var(--surface,#fff);color:var(--text,#20182d);border:1px solid var(--border,rgba(61,31,122,.12));border-bottom:0;border-radius:24px 24px 0 0;box-shadow:0 -18px 64px rgba(23,14,45,.24);z-index:2147483001;display:flex;flex-direction:column;overflow:hidden;opacity:0;visibility:hidden;pointer-events:none;transition:transform .28s cubic-bezier(.32,.72,0,1),opacity .18s ease}
      #${PANEL_ID}.open{transform:translate(-50%,0);opacity:1;visibility:visible;pointer-events:auto}
      .kkv2s-head{display:flex;align-items:center;gap:10px;padding:15px 16px;border-bottom:1px solid var(--border,rgba(61,31,122,.1));flex:0 0 auto}
      .kkv2s-handle{width:42px;height:4px;border-radius:99px;background:rgba(98,64,176,.20);position:absolute;top:8px;left:50%;transform:translateX(-50%)}
      .kkv2s-title{font-size:15px;font-weight:850;letter-spacing:-.01em}.kkv2s-sub{font-size:9px;color:var(--texts,#9488ae);margin-top:2px}
      .kkv2s-close{margin-left:auto;width:34px;height:34px;border:1px solid var(--border,rgba(61,31,122,.1));border-radius:10px;background:transparent;color:var(--textm,#5a4880);font-size:18px}
      .kkv2s-body{padding:14px;overflow:auto;min-height:0;display:flex;flex-direction:column;gap:12px}
      .kkv2s-card{border:1px solid var(--border,rgba(61,31,122,.1));background:var(--pearl2,#f3eff8);border-radius:16px;padding:13px}
      .kkv2s-card h3{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--texts,#9488ae);margin-bottom:8px}
      .kkv2s-provider{display:flex;align-items:center;gap:10px}.kkv2s-dot{width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 10px rgba(16,185,129,.45);flex:0 0 auto}.kkv2s-provider strong{font-size:12px}.kkv2s-provider span{display:block;font-size:9px;color:var(--texts,#9488ae);margin-top:2px}
      .kkv2s-status{margin-left:auto;font-size:9px;font-weight:800;padding:5px 8px;border-radius:999px;background:rgba(16,185,129,.10);color:#059669}.kkv2s-status.missing{background:rgba(245,158,11,.12);color:#b45309}
      .kkv2s-label{display:block;font-size:9px;font-weight:800;color:var(--textm,#5a4880);margin:10px 0 6px}.kkv2s-input{width:100%;min-height:40px;padding:9px 10px;border:1px solid var(--border,rgba(61,31,122,.1));border-radius:11px;background:var(--surface,#fff);color:var(--text,#20182d);outline:none}.kkv2s-input:focus{border-color:rgba(98,64,176,.45);box-shadow:0 0 0 3px rgba(98,64,176,.08)}
      .kkv2s-actions{display:flex;gap:8px;margin-top:9px}.kkv2s-btn{border:1px solid var(--border,rgba(61,31,122,.1));border-radius:10px;min-height:36px;padding:8px 12px;font-size:10px;font-weight:850;background:var(--surface,#fff);color:var(--text,#20182d)}.kkv2s-btn.primary{border-color:transparent;background:linear-gradient(135deg,var(--violet,#3d1f7a),var(--ice,#4aa9d9));color:#fff}.kkv2s-btn.danger{color:#b91c1c;background:rgba(239,68,68,.06)}
      .kkv2s-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.kkv2s-choice{width:100%;padding:10px;border:1px solid var(--border,rgba(61,31,122,.1));border-radius:11px;background:var(--surface,#fff);font-size:10px;font-weight:800;color:var(--textm,#5a4880)}.kkv2s-choice.active{border-color:var(--violet,#3d1f7a);background:rgba(98,64,176,.10);color:var(--violet,#3d1f7a)}
      .kkv2s-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border,rgba(61,31,122,.07))}.kkv2s-toggle:first-child{border-top:0;padding-top:0}.kkv2s-toggle:last-child{padding-bottom:0}.kkv2s-toggle strong{font-size:10px}.kkv2s-toggle span{display:block;font-size:8px;color:var(--texts,#9488ae);margin-top:2px}.kkv2s-switch{position:relative;width:40px;height:22px;flex:0 0 auto}.kkv2s-switch input{opacity:0;width:0;height:0}.kkv2s-slider{position:absolute;inset:0;border-radius:99px;background:#d7d0e3;transition:.2s}.kkv2s-slider:before{content:"";position:absolute;width:18px;height:18px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.2s}.kkv2s-switch input:checked + .kkv2s-slider{background:#7c3aed}.kkv2s-switch input:checked + .kkv2s-slider:before{transform:translateX(18px)}
      @media(max-width:700px){#${PANEL_ID}{left:0;width:100vw;max-width:100vw;transform:translateY(110%);border-radius:20px 20px 0 0}#${PANEL_ID}.open{transform:translateY(0)}.kkv2s-body{padding:12px}.kkv2s-grid{grid-template-columns:1fr 1fr}}
      html[data-theme="dark"] #${PANEL_ID}{background:var(--surface,#191324);border-color:rgba(195,174,250,.15);box-shadow:0 -18px 70px rgba(0,0,0,.5)}
    `;
    document.head.appendChild(s);
  }

  function sync(){
    const q=st();
    const input=$("kkv2sApiKey"); if(input&&!input.matches(":focus"))input.value=getKey();
    const status=$("kkv2sApiStatus");
    if(status){const ok=!!getKey();status.textContent=ok?"Connected":"Not configured";status.classList.toggle("missing",!ok);}
    const ar=$("kkv2sAudio"); if(ar)ar.checked=q.audio!==false;
    const cf=$("kkv2sContent"); if(cf)cf.checked=q.content!==false;
    const ws=$("kkv2sWebSearch"); if(ws)ws.checked=q.webSearch===true;
    document.querySelectorAll("#kkv2sQuality .kkv2s-choice").forEach(b=>b.classList.toggle("active",b.dataset.value===q.quality));
  }

  function build(){
    css();hideLegacy();
    if($(PANEL_ID))return;
    const back=document.createElement("div");back.id=BACKDROP_ID;back.addEventListener("click",close);
    const panel=document.createElement("section");panel.id=PANEL_ID;panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Video Playground Settings");
    panel.innerHTML=`
      <div class="kkv2s-handle"></div>
      <div class="kkv2s-head"><div><div class="kkv2s-title">Video Playground Settings</div><div class="kkv2s-sub">EvoLink configuration and generation defaults</div></div><button class="kkv2s-close" type="button" aria-label="Close" id="kkv2sClose">×</button></div>
      <div class="kkv2s-body">
        <div class="kkv2s-card">
          <h3>Video engine</h3>
          <div class="kkv2s-provider"><i class="kkv2s-dot"></i><div><strong>EvoLink</strong><span>Canonical backend for Video Canvas and Seedance 2.5</span></div><div class="kkv2s-status" id="kkv2sApiStatus">Not configured</div></div>
          <label class="kkv2s-label" for="kkv2sApiKey">EvoLink API key</label>
          <input class="kkv2s-input" id="kkv2sApiKey" type="password" autocomplete="off" placeholder="Paste your EvoLink key">
          <div class="kkv2s-actions"><button class="kkv2s-btn primary" id="kkv2sSaveKey" type="button">Save key</button><button class="kkv2s-btn" id="kkv2sClearKey" type="button">Clear</button></div>
        </div>
        <div class="kkv2s-card">
          <h3>Default quality</h3>
          <div class="kkv2s-grid" id="kkv2sQuality"><button class="kkv2s-choice" data-value="480p" type="button">480p</button><button class="kkv2s-choice" data-value="720p" type="button">720p</button><button class="kkv2s-choice" data-value="1080p" type="button">1080p</button><button class="kkv2s-choice" data-value="auto" type="button">Use route default</button></div>
        </div>
        <div class="kkv2s-card">
          <h3>Generation behavior</h3>
          <div class="kkv2s-toggle"><div><strong>Audio</strong><span>Request audio where the selected route supports it.</span></div><label class="kkv2s-switch"><input id="kkv2sAudio" type="checkbox"><span class="kkv2s-slider"></span></label></div>
          <div class="kkv2s-toggle"><div><strong>Content filter</strong><span>Keep the provider safety/content-filter option enabled.</span></div><label class="kkv2s-switch"><input id="kkv2sContent" type="checkbox"><span class="kkv2s-slider"></span></label></div>
          <div class="kkv2s-toggle"><div><strong>Web search</strong><span>Allow supported routes to use live web-search augmentation.</span></div><label class="kkv2s-switch"><input id="kkv2sWebSearch" type="checkbox"><span class="kkv2s-slider"></span></label></div>
        </div>
        <div class="kkv2s-card"><h3>Workspace</h3><div class="kkv2s-actions"><button class="kkv2s-btn danger" id="kkv2sReset" type="button">Reset playground defaults</button></div></div>
      </div>`;
    document.body.appendChild(back);document.body.appendChild(panel);
    $("kkv2sClose").addEventListener("click",close);
    $("kkv2sSaveKey").addEventListener("click",()=>{const v=$("kkv2sApiKey")?.value||"";if(!v.trim()){toast("Enter an EvoLink API key first","error");return;}setKey(v);sync();toast("EvoLink API key saved","success");});
    $("kkv2sClearKey").addEventListener("click",()=>{setKey("");sync();toast("EvoLink API key cleared","success");});
    document.querySelectorAll("#kkv2sQuality .kkv2s-choice").forEach(btn=>btn.addEventListener("click",()=>{const q=st();const v=btn.dataset.value;q.quality=v==="auto"?"720p":v;sync();if(typeof window.renderVideoCanvasV2==="function")window.renderVideoCanvasV2();}));
    $("kkv2sAudio").addEventListener("change",e=>{st().audio=e.target.checked;});
    $("kkv2sContent").addEventListener("change",e=>{st().content=e.target.checked;});
    $("kkv2sWebSearch").addEventListener("change",e=>{st().webSearch=e.target.checked;});
    $("kkv2sReset").addEventListener("click",()=>{const q=st();q.duration=5;q.quality="720p";q.aspect="16:9";q.audio=true;q.content=true;q.webSearch=false;sync();if(typeof window.renderVideoCanvasV2==="function")window.renderVideoCanvasV2();toast("Video Playground defaults reset","success");});
    sync();
  }

  function open(){build();hideLegacy();sync();$(PANEL_ID)?.classList.add("open");$(BACKDROP_ID)?.classList.add("open");document.body.classList.add("kkv2-settings-open");}
  function close(){const p=$(PANEL_ID),b=$(BACKDROP_ID);p?.classList.remove("open");b?.classList.remove("open");document.body.classList.remove("kkv2-settings-open");}

  window.toggleVcSettings=function(){
    const p=$(PANEL_ID);
    if(p?.classList.contains("open"))close();else open();
  };
  window.openVcV2Settings=open;
  window.closeVcV2Settings=close;

  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$(PANEL_ID)?.classList.contains("open"))close();});

  let n=0;
  const timer=setInterval(()=>{
    hideLegacy();
    if($("vcSettingsPanel")||$("vcSettingsBackdrop")){
      const btns=document.querySelectorAll('[onclick*="toggleVcSettings"]');
      btns.forEach(btn=>{btn.addEventListener("click",()=>{if(typeof window.toggleVcSettings==="function")window.toggleVcSettings();},{capture:true,once:false});});
    }
    if(++n>120)clearInterval(timer);
  },50);
})();

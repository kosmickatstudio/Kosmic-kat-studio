/* KOSMIC KAT — shared glassmorphic chat kit
 * Same look and controls as Video Studio, used by the Image module and Agent Feline:
 *   header (history / title / new chat / delete chat), glass bubbles, glass composer
 *   with a settings button + summary chip, and a slide-up chat-history sheet.
 * Pure presentation + a history sheet: generation logic stays in each module.
 */
(function(){
  "use strict";
  if(window.KosmicChatGlass)return;

  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const ic=(d,w=19)=>`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC={
    menu:ic('<path d="M4 7h16M4 12h10M4 17h16"/>'),
    plus:ic('<path d="M12 5v14M5 12h14"/>'),
    trash:ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    sliders:ic('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    send:ic('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>'),
    spark:ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',26),
    chev:ic('<path d="M9 6l6 6-6 6"/>',16)
  };

  function injectCss(){
    if(document.getElementById("kc-css"))return;
    const s=document.createElement("style");s.id="kc-css";
    s.textContent=`
.kc{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;isolation:isolate;border-radius:inherit;color:var(--text,#1e1230);font-size:13px}
.kc *{box-sizing:border-box}
.kc::before{content:"";position:absolute;inset:-25%;z-index:-1;pointer-events:none;filter:blur(36px);
  background:radial-gradient(38% 32% at 14% 12%,rgba(98,64,176,.34),transparent 70%),radial-gradient(34% 30% at 92% 28%,rgba(94,210,225,.28),transparent 70%),radial-gradient(46% 38% at 38% 98%,rgba(196,181,253,.36),transparent 70%)}
.kc-glass{background:var(--glass,rgba(255,255,255,.55));-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);border:1px solid var(--glass-brd,rgba(61,31,122,.14));box-shadow:0 8px 32px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.32)}
.kc-head{display:flex;align-items:center;gap:8px;padding:8px 10px;margin:8px 8px 0;border-radius:20px;flex:0 0 auto;z-index:2}
.kc-htitle{flex:1;min-width:0;padding:0 2px}
.kc-title{font-size:15px;font-weight:800;color:var(--violet,#3d1f7a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kc-subt{font-size:10px;color:var(--texts,#9488ae);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kc-ibtn{width:38px;height:38px;flex:0 0 auto;border-radius:13px;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:var(--glass,rgba(255,255,255,.55));color:var(--textm,#5a4880);display:grid;place-items:center;cursor:pointer;padding:0}
.kc-ibtn:active{transform:scale(.94)}
.kc-ibtn.sm{width:36px;height:36px;border-radius:12px}
.kc-thread.ig-chat-thread{flex:1!important;height:auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden;padding:14px 12px 10px!important;gap:14px!important;background:transparent!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.kc .ig-bubble-user{background:linear-gradient(135deg,rgba(98,64,176,.96),rgba(61,31,122,.96))!important;color:#fff!important;border-radius:20px 20px 6px 20px!important;box-shadow:0 10px 26px rgba(61,31,122,.30)!important;border:0!important;animation:kcIn .28s ease both;overflow-wrap:anywhere}
.kc .ig-bubble-assistant,.kc .ig-bubble-loading{background:var(--glass,rgba(255,255,255,.55))!important;-webkit-backdrop-filter:blur(18px) saturate(1.4)!important;backdrop-filter:blur(18px) saturate(1.4)!important;border:1px solid var(--glass-brd,rgba(61,31,122,.14))!important;border-radius:20px 20px 20px 6px!important;box-shadow:0 8px 28px rgba(61,31,122,.10),inset 0 1px 0 rgba(255,255,255,.3)!important;animation:kcIn .28s ease both;overflow-wrap:anywhere}
.kc .ig-bubble-assistant img{max-width:100%;height:auto}
@keyframes kcIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kc-empty{margin:auto;text-align:center;padding:18px 10px;max-width:420px}
.kc-orb{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:28px;background:linear-gradient(135deg,#6240b0,#5ed2e1);box-shadow:0 12px 34px rgba(98,64,176,.4)}
.kc-etitle{font-size:16px;font-weight:800;color:var(--violet,#3d1f7a)}
.kc-esub{font-size:12px;color:var(--texts,#9488ae);line-height:1.5;margin:6px 0 14px}
.kc-ideas{display:flex;flex-direction:column;gap:8px}
.kc-idea{text-align:left;border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:var(--glass,rgba(255,255,255,.55));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:var(--textm,#5a4880);border-radius:14px;padding:10px 12px;font-size:12px;line-height:1.4;cursor:pointer;font-family:inherit}
.kc-attach{margin:0 10px 6px;border-radius:14px;padding:6px 12px;font-size:11px;color:var(--textm,#5a4880);align-items:center;gap:8px}
.kc-composer-wrap.ig-chat-inputbar{flex:0 0 auto;display:flex;padding:6px 8px calc(8px + env(safe-area-inset-bottom,0px))!important;z-index:2}
.kc-composer{flex:1;min-width:0;border-radius:26px;padding:10px 10px 8px}
.kc-ta{display:block;width:100%;border:0!important;outline:0;background:transparent!important;box-shadow:none!important;resize:none;font:inherit;font-size:14px;line-height:1.45;color:var(--text,#1e1230);max-height:140px;min-height:30px;padding:4px 8px;overflow-y:auto}
.kc-ta::placeholder{color:var(--texts,#9488ae)}
.kc-crow{display:flex;align-items:center;gap:6px;margin-top:6px}
.kc-summary{flex:1;min-width:0;text-align:left;border:0;background:rgba(98,64,176,.12);color:var(--textm,#5a4880);border-radius:99px;padding:9px 13px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-family:inherit}
.kc-tbtn{width:36px;height:36px;flex:0 0 auto;border-radius:50%;border:0;background:rgba(98,64,176,.10);color:var(--textm,#5a4880);display:grid;place-items:center;cursor:pointer;padding:0}
.kc-tbtn.recording{background:var(--red,#d93a52);color:#fff}
.kc-send{width:44px;height:44px;flex:0 0 auto;border-radius:50%;border:0;background:linear-gradient(135deg,#6240b0,#5ed2e1);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 22px rgba(98,64,176,.4);padding:0}
.kc-send:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.kc-hint{font-size:9.5px;color:var(--texts,#9488ae);padding:4px 8px 0;display:flex;justify-content:space-between;gap:8px}
#igGalleryView.kc-gal{flex:1;min-height:0;overflow-y:auto}
#igGalleryView.kc-gal>div:last-child{max-height:none!important}
/* settings shutter = the module's existing bottom sheet, restyled to match */
html .ig-settings-sheet.kc-sheet{background:var(--glass-solid,rgba(252,250,255,.96))!important;-webkit-backdrop-filter:blur(26px) saturate(1.6)!important;backdrop-filter:blur(26px) saturate(1.6)!important;border:1px solid var(--glass-brd,rgba(61,31,122,.14))!important;border-bottom:0!important;border-radius:26px 26px 0 0!important;box-shadow:0 -12px 48px rgba(61,31,122,.22)!important}
html .ig-settings-backdrop{background:rgba(15,8,32,.38)!important;-webkit-backdrop-filter:blur(3px)!important;backdrop-filter:blur(3px)!important}
.kc-sheet .ig-sheet-handle{background:var(--lav2,#d8ccf5)!important;box-shadow:none!important;opacity:1!important;height:5px!important;width:42px!important;border-radius:99px!important}
.kc-sheet .ig-sheet-header{background:transparent!important;border-bottom:0!important}
.kc-sheet .ig-sheet-header>div{font-family:inherit!important;font-weight:800!important;font-size:15px!important}
.kc-sheet .ig-icon-btn{border-radius:12px!important}
.kc-tools{margin-top:14px;border-top:1px solid var(--glass-brd,rgba(61,31,122,.12));padding-top:12px}
/* history sheet */
.kch-back{position:fixed;inset:0;z-index:2147481000;background:rgba(15,8,32,.38);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .25s ease}
.kch-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147481001;max-height:78vh;display:flex;flex-direction:column;border-radius:26px 26px 0 0;transform:translateY(104%);transition:transform .32s cubic-bezier(.2,.8,.2,1);padding-bottom:env(safe-area-inset-bottom,0px);background:var(--glass-solid,rgba(252,250,255,.96));-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);border:1px solid var(--glass-brd,rgba(61,31,122,.14));border-bottom:0;box-shadow:0 -12px 48px rgba(61,31,122,.22);color:var(--text,#1e1230);max-width:640px;margin:0 auto}
.kch-open .kch-back{opacity:1}.kch-open .kch-sheet{transform:none}
.kch-grab{width:42px;height:5px;border-radius:99px;background:var(--lav2,#d8ccf5);margin:9px auto 4px;flex:0 0 auto;cursor:pointer}
.kch-head{display:flex;align-items:center;justify-content:space-between;padding:6px 16px 8px;flex:0 0 auto}
.kch-head b{font-size:15px;color:var(--violet,#3d1f7a)}
.kch-body{overflow-y:auto;padding:4px 12px 16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.kch-row{display:flex;align-items:center;gap:6px;border-radius:16px;padding:4px 4px 4px 4px;margin-bottom:8px;background:var(--glass,rgba(255,255,255,.55));border:1px solid var(--glass-brd,rgba(61,31,122,.12))}
.kch-row.cur{border-color:var(--vm,#6240b0);background:rgba(98,64,176,.14)}
.kch-main{flex:1;min-width:0;text-align:left;border:0;background:transparent;color:inherit;padding:9px 10px;cursor:pointer;font-family:inherit}
.kch-main b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kch-main small{display:block;font-size:10.5px;color:var(--texts,#9488ae);margin-top:2px}
.kch-btn{border:1px solid var(--glass-brd,rgba(61,31,122,.14));background:rgba(98,64,176,.10);color:var(--textm,#5a4880);border-radius:11px;padding:7px 13px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
.kch-del{width:36px;height:36px;border-radius:12px;border:0;background:transparent;color:#b3263e;display:grid;place-items:center;cursor:pointer;flex:0 0 auto;padding:0}
.kch-danger{width:100%;margin-top:4px;background:rgba(200,50,70,.12);color:#b3263e;border-color:rgba(200,50,70,.25);padding:10px}
.kch-none{text-align:center;color:var(--texts,#9488ae);font-size:12px;padding:22px 10px;line-height:1.5}
@media(min-width:760px){.kc-head,.kc-composer-wrap{max-width:820px;width:100%;margin-left:auto;margin-right:auto}.kc-thread.ig-chat-thread{padding-left:max(12px,calc(50% - 410px))!important;padding-right:max(12px,calc(50% - 410px))!important}}
`;
    document.head.appendChild(s);
  }

  /* ── building blocks (return HTML strings) ── */
  function header(o){
    return `<div class="kc-head kc-glass">
      <button class="kc-ibtn" onclick="${o.hist}" aria-label="Chats" title="Chats">${IC.menu}</button>
      <div class="kc-htitle"><div class="kc-title">${o.title}</div><div class="kc-subt" ${o.subId?`id="${o.subId}"`:""}>${o.sub||""}</div></div>
      <button class="kc-ibtn" onclick="${o.newChat}" aria-label="New chat" title="New chat">${IC.plus}</button>
      <button class="kc-ibtn" onclick="${o.delChat}" aria-label="Delete this chat" title="Delete this chat">${IC.trash}</button>
    </div>`;
  }

  function composer(o){
    const tools=(o.tools||[]).map(t=>`<button type="button" class="kc-tbtn"${t.id?` id="${t.id}"`:""} onclick="${t.onclick}" title="${esc(t.title)}" aria-label="${esc(t.title)}">${t.icon}</button>`).join("");
    return `<div class="kc-composer-wrap ig-chat-inputbar">
      <div class="kc-composer kc-glass">
        <textarea class="kc-ta" id="${o.inputId}" rows="1" placeholder="${esc(o.placeholder)}" onkeydown="${o.keydown}" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px'"></textarea>
        <div class="kc-crow">
          <button type="button" class="kc-tbtn" onclick="${o.settings}" aria-label="Settings" title="Settings">${IC.sliders}</button>
          <button type="button" class="kc-summary" id="${o.summaryId}" onclick="${o.settings}"></button>
          ${tools}
          <button type="button" class="kc-send" id="${o.sendId}" onclick="${o.send}" aria-label="Send" title="Send">${IC.send}</button>
        </div>
        ${o.hint||""}
      </div>
    </div>`;
  }

  function empty(o){
    const ideas=(o.ideas||[]).map(t=>`<button type="button" class="kc-idea" onclick="KosmicChatGlass.useIdea('${o.inputId}',this)" data-t="${esc(t)}">${esc(t)}</button>`).join("");
    return `<div class="kc-empty"><div class="kc-orb">${o.icon||IC.spark}</div><div class="kc-etitle">${esc(o.title)}</div><div class="kc-esub">${esc(o.sub)}</div>${ideas?`<div class="kc-ideas">${ideas}</div>`:""}</div>`;
  }

  function useIdea(inputId,btn){
    const ta=document.getElementById(inputId);if(!ta)return;
    ta.value=btn.dataset.t||"";ta.dispatchEvent(new Event("input",{bubbles:true}));ta.focus();
  }

  function setSummary(id,text){
    const el=document.getElementById(id);if(el)el.textContent=text||"Settings";
  }

  /* ── history sheet ──
   * o: {title, current:{title,meta}|null, sessions:[{id,title,meta}], load:"fn", del:"fn", clear:"fn", newChat:"fn", empty:"text"}
   * load/del take the session id string. */
  function closeHistory(){
    const el=document.getElementById("kchRoot");if(!el)return;
    el.classList.remove("kch-open");
    setTimeout(()=>el.remove(),300);
  }
  function openHistory(o){
    injectCss();
    const old=document.getElementById("kchRoot");if(old)old.remove();
    const q=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const cur=o.current?`<div class="kch-row cur"><div class="kch-main" style="cursor:default"><b>${esc(o.current.title)}</b><small>Current chat · ${esc(o.current.meta||"")}</small></div></div>`:"";
    const rows=(o.sessions||[]).map(s=>`<div class="kch-row">
        <button class="kch-main" onclick="KosmicChatGlass.closeHistory();${o.load}('${q(s.id)}')"><b>${esc(s.title||"Untitled chat")}</b><small>${esc(s.meta||"")}</small></button>
        <button class="kch-del" onclick="KosmicChatGlass.closeHistory();${o.del}('${q(s.id)}')" aria-label="Delete chat">${IC.trash}</button>
      </div>`).join("");
    const body=(cur||rows)?cur+rows:`<div class="kch-none">${esc(o.empty||"No chats yet — start a new chat and your current one will be saved here.")}</div>`;
    const root=document.createElement("div");root.id="kchRoot";
    root.innerHTML=`<div class="kch-back" onclick="KosmicChatGlass.closeHistory()"></div>
      <div class="kch-sheet" role="dialog" aria-label="Chats">
        <div class="kch-grab" onclick="KosmicChatGlass.closeHistory()"></div>
        <div class="kch-head"><b>${esc(o.title||"Chats")}</b><button class="kch-btn" onclick="KosmicChatGlass.closeHistory();${o.newChat}()">＋ New chat</button></div>
        <div class="kch-body">${body}${(o.sessions||[]).length>1?`<button class="kch-btn kch-danger" onclick="KosmicChatGlass.closeHistory();${o.clear}()">Delete all saved chats</button>`:""}</div>
      </div>`;
    document.body.appendChild(root);
    requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.add("kch-open")));
  }

  function ago(iso){
    const t=new Date(iso).getTime();if(!t)return"";
    const s=Math.max(0,Math.round((Date.now()-t)/1000));
    if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+" min ago";
    if(s<86400)return Math.floor(s/3600)+" h ago";return new Date(t).toLocaleDateString();
  }

  injectCss();
  window.KosmicChatGlass={esc,IC,header,composer,empty,useIdea,setSummary,openHistory,closeHistory,ago,injectCss};
})();

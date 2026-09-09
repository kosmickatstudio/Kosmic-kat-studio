/* KOSMIC KAT — Video Settings structural parity
 * The Image Settings sheet is a page-level sibling; Video Settings is created
 * inside the Video chat shell. Reparent the Video sheet/backdrop to <body>
 * before the existing toggle runs so it uses the exact same DOM layer.
 * Presentation/structure fix only. Existing controls and toggle logic remain.
 */
(function installVideoSettingsParity(){
  "use strict";
  if(window.__kosmicVideoSettingsParity)return;
  window.__kosmicVideoSettingsParity=true;

  // Phase 8 UI is loaded here because this helper is already a guaranteed,
  // post-main-script global loader. The stylesheet itself is presentation-only.
  if(!document.querySelector('link[data-kosmic-ui-v2-phase="8"]')){
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="ui-v2-phase8.css";
    css.dataset.kosmicUiV2Phase="8";
    document.head.appendChild(css);
  }
  // EvoLink Video ecosystem is loaded from this established post-main-script
  // helper so motion.js remains untouched.
  if(!document.querySelector('link[data-kosmic-evo-video-css="1"]')){
    const css=document.createElement("link");
    css.rel="stylesheet";
    css.href="ui-v2-evolink-video.css";
    css.dataset.kosmicEvoVideoCss="1";
    document.head.appendChild(css);
  }
  const loadScript=(src,marker,callback)=>{
    if(document.querySelector(`script[${marker}]`)){if(callback)callback();return;}
    const s=document.createElement("script");
    s.src=src;
    s.async=false;
    s.setAttribute(marker,"");
    s.onload=()=>callback&&callback();
    document.head.appendChild(s);
  };
  loadScript("evolink-video.js","data-kosmic-evo-video","()=>{
    // Route corrections must run after the base catalog has registered itself.
    loadScript("evolink-video-current.js","data-kosmic-evo-video-current");
  });

  function parityToggle(){
    const panel=document.getElementById("vcSettingsPanel");
    const backdrop=document.getElementById("vcSettingsBackdrop");
    if(backdrop && backdrop.parentElement!==document.body)document.body.appendChild(backdrop);
    if(panel && panel.parentElement!==document.body)document.body.appendChild(panel);
    return window.__kosmicOriginalToggleVcSettings.apply(this,arguments);
  }

  const install=()=>{
    const fn=window.toggleVcSettings;
    if(typeof fn!=="function"||fn.__kosmicVideoParityWrapped)return false;
    if(window.__kosmicOriginalToggleVcSettings)return true;
    window.__kosmicOriginalToggleVcSettings=fn;
    parityToggle.__kosmicVideoParityWrapped=true;
    parityToggle.__kosmicOriginal=fn;
    window.toggleVcSettings=parityToggle;
    return true;
  };

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{
      if(install()||++tries>60)clearInterval(timer);
    },50);
  }
})();

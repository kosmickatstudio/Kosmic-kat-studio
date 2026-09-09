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

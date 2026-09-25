import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SITE_URL=process.env.KOSMIC_SITE_URL||'https://kosmickat.art/';
const OUT=process.env.KOSMIC_QA_DIR||'qa-artifacts';
const failures=[],warnings=[],consoleErrors=[],pageErrors=[],requestFailures=[],badResponses=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=(m,d)=>failures.push(d?m+": "+d:m);
const warn=(m,d)=>warnings.push(d?m+": "+d:m);
const visible=async(page,sel)=>{const x=page.locator(sel).first();return await x.count()>0&&await x.isVisible().catch(()=>false);};

async function openVideo(page){
  const candidates=[
    page.locator('.mod-btn[data-mod="videocanvas"]').first(),
    page.getByRole('button',{name:/Video/i}).first(),
    page.getByText(/^Video$/i).first()
  ];
  for(const c of candidates){
    if(await c.count()&&await c.isVisible().catch(()=>false)){await c.click().catch(()=>{});await sleep(1400);return true;}
  }
  return false;
}

async function auditCanonicalVideo(page){
  const v3=await visible(page,'#kkVideoCanvasV3');
  if(!v3){fail('Canonical Video Canvas V3 is not visible');return {v3:false};}

  const selectors=await page.evaluate(()=>({
    v3:document.querySelectorAll('#kkVideoCanvasV3').length,
    model:document.querySelectorAll('#kkVideoCanvasV3 #kkv3Model').length,
    modelVisible:[...document.querySelectorAll('#kkVideoCanvasV3 #kkv3Model')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>2&&r.height>2&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';}).length,
    generate:document.querySelectorAll('#kkVideoCanvasV3 [data-stable-generate]').length,
    gallery:document.querySelectorAll('#kkVideoCanvasV3 [data-kosmic-video-gallery]').length,
    assets:document.querySelectorAll('#kkVideoCanvasV3 [data-kosmic-video-assets]').length,
    uploads:document.querySelectorAll('#kkVideoCanvasV3 [data-kosmic-browser-uploads]').length,
    images:document.querySelectorAll('#kkVideoCanvasV3 #kkv3Images').length,
    videos:document.querySelectorAll('#kkVideoCanvasV3 #kkv3Videos').length,
    audios:document.querySelectorAll('#kkVideoCanvasV3 #kkv3Audios').length,
    prompt:document.querySelectorAll('#kkVideoCanvasV3 #kkv3Prompt').length,
    storyboard:document.querySelectorAll('#kkVideoCanvasV3 [data-workspace="storyboard"]').length,
    videoChat:document.querySelectorAll('#kkVideoChat').length,
    legacyMount:document.querySelectorAll('#kk-video-legacy-mount').length,
    legacyIds:["#vcModel","#vcSettingsPanel","#vcSettingsBackdrop","#vcGalleryView"].filter(sel=>[...document.querySelectorAll(sel)].some(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>2&&r.height>2&&s.display!=="none"&&s.visibility!=="hidden"&&s.opacity!=="0";}))
  }));
  for(const [k,expected] of Object.entries({v3:1,model:1,modelVisible:1,generate:1,gallery:1,assets:1,uploads:1,images:1,videos:1,audios:1,prompt:1,storyboard:1})){
    if(selectors[k]!==expected)fail('Canonical Video DOM invariant failed',k+"="+selectors[k]+", expected "+expected);
  }
  if(selectors.videoChat)fail('Video Chat is still auto-mounted inside the canonical Video module');
  if(selectors.legacyMount||selectors.legacyIds.length)fail('Legacy Video UI remains visibly mounted',JSON.stringify(selectors.legacyIds));

  const models=await page.evaluate(()=>{
    const s=document.querySelector('#kkv3Model');
    return {values:[...s?.options||[]].map(o=>o.value),labels:[...s?.options||[]].map(o=>o.textContent.trim())};
  });
  if(!models.values.length)fail('Video model catalog produced no selectable models');
  if(new Set(models.values).size!==models.values.length)fail('Video model selector contains duplicate route/model IDs');
  if(models.values.some(v=>!v.trim()))fail('Video model selector contains an empty model ID');

  const routeState=await page.evaluate(()=>({
    route:window.__kosmicVideoV3State?.route||null,
    indexed:!!window.KOSMIC_EVOLINK_VIDEO?.index?.[window.__kosmicVideoV3State?.route],
    stackLoaded:!!window.__kosmicVideoStackLoaded,
    support:!!window.__kosmicVideoV3Support,
    safety:!!window.__kosmicVideoV3Safety
  }));
  if(!routeState.indexed)fail('V3 selected route is not present in the EvoLink catalog',String(routeState.route));
  if(!routeState.stackLoaded||!routeState.support||!routeState.safety)fail('Canonical Video stack did not finish loading',JSON.stringify(routeState));

  const legacyScripts=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean).filter(src=>/video-chat-|video-v3-(interaction-hardening|final-fixes|ux-fixes)|video-canvas-mobile-upload-fix|video-settings-parity|evolink-seedance25-(fal-parity|request-bridge|functional)|evolink-video-canvas-adapter|evolink-video-route-hud|evolink-video-final-guard/i.test(src)));
  if(legacyScripts.length)fail('Retired Video repair/chat scripts were loaded',legacyScripts.join(', '));

  const action=page.locator('#kkVideoCanvasV3 [data-stable-generate]').first();
  const before=await page.evaluate(()=>({busy:!!window.__kosmicVideoV3State?.busy,history:Array.isArray(window.S?.assets)?window.S.assets.filter(a=>a?.type==="video"&&a?.url).length:0}));
  let generateDisabled=true;
  if(await action.isVisible().catch(()=>false)){
    generateDisabled=await action.isDisabled().catch(()=>true);
    if(!generateDisabled)await action.click({force:true}).catch(e=>warn('Generate click test could not execute',String(e.message||e)));
    await sleep(150);
  }
  const after=await page.evaluate(()=>({busy:!!window.__kosmicVideoV3State?.busy,history:Array.isArray(window.S?.assets)?window.S.assets.filter(a=>a?.type==="video"&&a?.url).length:0,arm:window.__kosmicVideoSafety?.status?.()||null}));
  if(!generateDisabled && after.busy)warn('Generate entered busy state during no-key QA; it should fail before provider submission');
  if((after.history-before.history)>0)fail('Generate produced a history entry during no-key QA');

  return {v3:true,selectors,models:modelSummary(models),routeState,legacyScripts,before,after};
}
function modelSummary(m){return{count:m?.values?.length||0,sample:(m?.labels||[]).slice(0,8)};}

async function auditInteraction(page){
  const model=page.locator('#kkv3Model').first();
  const original=await model.inputValue();
  const options=await model.locator('option').evaluateAll(xs=>xs.map(x=>x.value));
  if(options.length>1){
    const next=options.find(x=>x!==original);
    await model.selectOption(next);
    await sleep(100);
    const changed=await page.evaluate(()=>window.__kosmicVideoV3State?.route||null);
    if(!changed)fail('Changing the Video model selector did not update V3 route state');
    await model.selectOption(original);await sleep(100);
  }

  await page.locator('#kkVideoCanvasV3 [data-workspace="storyboard"]').click({force:true}).catch(()=>{});
  await sleep(100);
  if(!(await visible(page,'#kkVideoCanvasV3 #kkv3AddShot')))fail('Storyboard workspace did not render');
  await page.locator('#kkVideoCanvasV3 [data-workspace="shot"]').click({force:true}).catch(()=>{});
  await sleep(100);

  await page.locator('#kkVideoCanvasV3 [data-kosmic-video-assets]').click({force:true}).catch(()=>{});
  await sleep(100);
  const picker=await visible(page,'#kkv3AssetPicker');
  if(!picker)fail('Upload from Assets did not open the canonical asset picker');
  await page.locator('#kkv3AssetPicker [data-close]').first().click({force:true}).catch(()=>{});
  await sleep(50);
  if(await visible(page,'#kkv3AssetPicker'))fail('Asset picker did not close cleanly');

  const ref=page.locator('#kkVideoCanvasV3 [data-route="seedance-2.5-reference-to-video"]').first();
  if(await ref.count()){await ref.click({force:true});await sleep(100);}
  const accepts=await page.evaluate(()=>({
    image:document.querySelector('#kkv3Images')?.accept||'',
    video:document.querySelector('#kkv3Videos')?.accept||'',
    audio:document.querySelector('#kkv3Audios')?.accept||''
  }));
  if(accepts.image!=='image/*'||accepts.video!=='video/*'||accepts.audio!=='audio/*')fail('Video reference file accept types are incorrect',JSON.stringify(accepts));
  return {modelChanged:true,storyboard:true,assetPicker:picker,accepts};
}

async function main(){
  fs.mkdirSync(OUT,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'light'});
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('requestfailed',r=>requestFailures.push(r.method()+' '+r.url()+' :: '+(r.failure()?.errorText||'unknown')));
  page.on('response',r=>{if(r.status()>=500)badResponses.push(r.status()+' '+r.request().method()+' '+r.url());});
  let response;
  try{response=await page.goto(SITE_URL,{waitUntil:'domcontentloaded',timeout:45000});}catch(e){fail('Initial navigation failed',String(e.message||e));}
  if(!response)fail('Initial navigation returned no response');else if(response.status()>=400)fail('Initial navigation returned HTTP '+response.status());
  await page.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});await sleep(1800);
  const opened=await openVideo(page);if(!opened)fail('Could not open Video module');
  await sleep(800);
  const canonical=await auditCanonicalVideo(page);
  const interaction=canonical.v3?await auditInteraction(page):null;

  const title=await page.title();if(!/KosmicKat/i.test(title))warn('Unexpected title',title);
  await page.setViewportSize({width:390,height:844});await sleep(250);
  const mobile=await page.evaluate(()=>{const r=document.querySelector('#kkVideoCanvasV3');const scrolling=document.scrollingElement;return r?{rootHeight:r.clientHeight,rootScrollHeight:r.scrollHeight,documentHeight:scrolling?.scrollHeight||0,viewport:innerHeight}:null;});
  if(!mobile||mobile.documentHeight<=mobile.viewport)warn('Mobile page did not report vertical overflow',JSON.stringify(mobile));
  await page.screenshot({path:path.join(OUT,'kosmic-video-canonical.png'),fullPage:true}).catch(()=>{});

  const report={site:SITE_URL,checkedAt:new Date().toISOString(),title,navigation:response?{status:response.status(),url:response.url()}:null,openedVideo:opened,canonical,interaction,mobile,warnings,failures,consoleErrors,pageErrors,requestFailures,badResponses};
  fs.writeFileSync(path.join(OUT,'kosmic-runtime-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
  if(failures.length){console.error('KOSMIC VIDEO QA FAILED — '+failures.length+' failure(s)');process.exitCode=1;}else console.log('KOSMIC VIDEO QA PASSED — '+warnings.length+' warning(s)');
}
main().catch(e=>{console.error(e?.stack||e);process.exitCode=1;});
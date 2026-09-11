import fs from 'node:fs';
import { chromium } from 'playwright';

const SITE_URL = process.env.KOSMIC_SITE_URL || 'https://kosmickat.art/';
const OUT = process.env.KOSMIC_QA_DIR || 'qa-artifacts';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [], warnings = [], consoleErrors = [], pageErrors = [], scriptErrors = [], requestFailures = [], badResponses = [];
function fail(m,d=''){ failures.push(d ? `${m}: ${d}` : m); }
function warn(m,d=''){ warnings.push(d ? `${m}: ${d}` : m); }
async function visible(page, selector){ const l=page.locator(selector).first(); return await l.count()>0 && await l.isVisible().catch(()=>false); }
async function auditEvoLink(page){
  const snapshot=await page.evaluate(()=>{const api=window.KOSMIC_EVOLINK_VIDEO;if(!api)return{present:false};const cards=Array.isArray(api.catalog)?api.catalog:[];const ids=cards.flatMap(c=>(c?.routes||[]).map(r=>r?.id).filter(Boolean));return{present:true,cardCount:cards.length,routeCount:ids.length,indexedRouteCount:Object.keys(api.index||{}).length,revision:api.routeRevision||null,seed25:['seedance-2.5-text-to-video','seedance-2.5-image-to-video','seedance-2.5-reference-to-video','seedance-2.5-video-edit','seedance-2.5-video-extend'].map(id=>({id,present:!!api.index?.[id]}))};});
  if(!snapshot.present)fail('EvoLink runtime catalog is missing');
  if(snapshot.cardCount<25)fail('EvoLink runtime catalog unexpectedly small',String(snapshot.cardCount));
  for(const x of snapshot.seed25||[])if(!x.present)fail('Required Seedance 2.5 route missing',x.id);
  const ui=await page.evaluate(()=>{const s=document.getElementById('vcModel');return{modelSelect:!!s,seed25Option:!!s&&[...s.options].some(o=>o.value==='seedance-2.5-text-to-video'),parity:!!document.querySelector('#evoSeedanceSchemaPanel.evo-seedance25-parity'),falWarning:[...document.querySelectorAll('body *')].some(e=>/add\s+a\s+fal(?:\.ai|-ai)?\s+api\s+key\s+in\s+settings/i.test((e.textContent||'').trim())&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden')};});
  if(!ui.modelSelect)warn('Video Canvas model select not found');
  if(!ui.seed25Option)warn('Seedance 2.5 T2V option not found');
  if(!ui.parity)warn('Seedance 2.5 parity panel not visible');
  if(ui.falWarning)fail('Visible Fal.ai API-key warning remains on Seedance 2.5 UI');
  return {...snapshot,ui};
}
async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'light'});
  const page=await context.newPage();
  await page.addInitScript(()=>{window.__kosmicQaScriptErrors=[];window.addEventListener('error',e=>{if(e?.filename||e?.lineno||e?.colno)window.__kosmicQaScriptErrors.push({message:String(e.message||e.error||'Script error'),filename:String(e.filename||''),lineno:Number(e.lineno||0),colno:Number(e.colno||0)});});});
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('requestfailed',r=>requestFailures.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText||'unknown'}`));
  page.on('response',r=>{if(r.status()>=500)badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`);});
  let response;try{response=await page.goto(SITE_URL,{waitUntil:'domcontentloaded',timeout:45000});}catch(e){fail('Initial navigation threw',String(e?.message||e));}
  if(!response)fail('Initial navigation returned no response'); else if(response.status()>=400)fail('Initial navigation failed',`${response.status()} ${response.url()}`);
  await page.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});await sleep(2200);
  scriptErrors.push(...await page.evaluate(()=>window.__kosmicQaScriptErrors||[]));
  const title=await page.title();
  if(!/KosmicKat/i.test(title))warn('Unexpected page title',title);
  for(const s of ['body','header','.studio-body','.main-content'])if(!(await visible(page,s)))fail('Required shell element missing/invisible',s);
  const evo=await auditEvoLink(page);
  await page.screenshot({path:`${OUT}/kosmic-live.png`,fullPage:true}).catch(()=>{});
  if(scriptErrors.length)fail('Browser script errors detected',scriptErrors.slice(0,20).map(e=>`${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`).join(' | '));
  if(pageErrors.length)fail('Runtime page errors detected',pageErrors.slice(0,20).join(' | '));
  if(badResponses.length)fail('HTTP 5xx responses detected',badResponses.slice(0,20).join(' | '));
  if(requestFailures.length)warn('Network requests failed',requestFailures.slice(0,20).join(' | '));
  if(consoleErrors.length)warn('Console errors detected',consoleErrors.slice(0,20).join(' | '));
  const report={site:SITE_URL,checkedAt:new Date().toISOString(),navigation:response?{status:response.status(),url:response.url()}:null,title,failures,warnings,consoleErrors,pageErrors,scriptErrors,requestFailures,badResponses,evo};
  fs.writeFileSync(`${OUT}/kosmic-runtime-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(failures.length){console.error(`KOSMIC QA FAILED — ${failures.length} failure(s)`);process.exitCode=1}else console.log(`KOSMIC QA PASSED — ${warnings.length} warning(s)`);
}
main().catch(e=>{console.error(e?.stack||e);process.exitCode=1;});

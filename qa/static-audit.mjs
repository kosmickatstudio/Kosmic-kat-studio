import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const failures=[];
const fail=(m)=>failures.push(m);
const required=[
  'index.html','motion.js','video-canvas-v3.js','video-canvas-v3-loader.js',
  'video-v3-support.js','video-v3-safety.js','evolink-video.js',
  'evolink-video-current.js','evolink-video-expansion.js','evolink-video-integrity.js','evolink-video-pricing.js'
];
for(const rel of required)if(!fs.existsSync(path.join(root,rel)))fail('Missing required file: '+rel);

const oldLoader=path.join(root,'video-canvas-v2-loader.js');
if(fs.existsSync(oldLoader))fail('Retired loader still exists: video-canvas-v2-loader.js');

const index=fs.existsSync(path.join(root,'index.html'))?fs.readFileSync(path.join(root,'index.html'),'utf8'):'';
const localSrcs=[...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]).filter(src=>!/^https?:\/\//i.test(src));
for(const src of localSrcs){
  const clean=src.split('?')[0].split('#')[0];
  if(!clean)continue;
  if(!fs.existsSync(path.join(root,clean)))fail('index.html references missing local script: '+src);
}
if(!/videocanvas\s*:\s*renderVideoCanvasV3Module/.test(index))fail('index.html no longer maps Video module to renderVideoCanvasV3Module');
if(!/function\s+renderVideoCanvasV3Module\s*\(/.test(index))fail('renderVideoCanvasV3Module entrypoint is missing');

const loader=fs.readFileSync(path.join(root,'video-canvas-v3-loader.js'),'utf8');
const requiredLoaderRefs=['evolink-video.js','evolink-video-current.js','evolink-video-expansion.js','evolink-video-integrity.js','evolink-video-pricing.js','video-canvas-v3.js','video-v3-safety.js','video-v3-support.js'];
for(const ref of requiredLoaderRefs)if(!loader.includes('"'+ref+'"'))fail('Canonical Video loader is missing '+ref);
const forbiddenLoaderRefs=['video-chat-shell.js','video-chat-state.js','video-chat-generation.js','video-chat-director.js','video-chat-primary.js','video-v3-interaction-hardening.js','video-v3-final-fixes.js','video-v3-ux-fixes.js','video-canvas-mobile-upload-fix-v2.js','video-settings-parity.js','evolink-seedance25-fal-parity.js','evolink-seedance25-request-bridge.js','evolink-seedance25-functional.js','evolink-video-canvas-adapter.js','evolink-video-route-hud.js','evolink-video-final-guard.js'];
for(const ref of forbiddenLoaderRefs)if(loader.includes(ref))fail('Retired Video layer is still loaded: '+ref);

const v3=fs.readFileSync(path.join(root,'video-canvas-v3.js'),'utf8');
for(const token of ['kkv3Model','data-stable-generate','data-kosmic-video-gallery','data-kosmic-video-assets','createVideoAsset','generateEvoLinkVideo'])if(!v3.includes(token))fail('Canonical V3 is missing required token: '+token);
if(/getElementById\(["']kkv3Generate/.test(v3))fail('Canonical V3 still depends on removed #kkv3Generate');
if(v3.includes('kkvcSend')||v3.includes('kkVideoChat'))fail('Canonical V3 contains Chat-surface dependencies');

const support=fs.readFileSync(path.join(root,'video-v3-support.js'),'utf8');
const safety=fs.readFileSync(path.join(root,'video-v3-safety.js'),'utf8');
if(/MutationObserver/.test(support))fail('V3 support module must not use MutationObserver');
if(/video-chat|kkvcSend/.test(safety))fail('Canonical V3 safety gate contains Chat dependencies');

for(const rel of ['video-canvas-v3-loader.js','video-canvas-v3.js','video-v3-support.js','video-v3-safety.js','runtime-audit.mjs']){
  const file=fs.readFileSync(path.join(root,rel),'utf8');
  try{new vm.Script(file,{filename:rel});}catch(e){fail('JavaScript syntax error in '+rel+': '+e.message);}
}

const scriptBlocks=[...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
let inlineCount=0;
for(const m of scriptBlocks){
  const tag=m[0].slice(0,m[0].indexOf('>')+1);
  if(/type=["']application\/ld\+json["']/i.test(tag))continue;
  const code=m[1].trim();
  if(!code)continue;
  inlineCount++;
  try{new vm.Script(code,{filename:'index.html:inline-script-'+inlineCount});}catch(e){fail('JavaScript syntax error in index.html inline script #'+inlineCount+': '+e.message);}
}

const report={checkedAt:new Date().toISOString(),failures,requiredFiles:required.length,localScriptReferences:localSrcs.length,inlineScriptsParsed:inlineCount};
console.log(JSON.stringify(report,null,2));
if(failures.length){console.error('STATIC QA FAILED — '+failures.length+' failure(s)');process.exitCode=1;}
else console.log('STATIC QA PASSED');

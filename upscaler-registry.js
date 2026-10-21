// ══════════════════════════════════════════════════════════════════════
// UPSCALER REGISTRY — pure data, no DOM, no network. Describes every
// enhancement tool the Upscaler module can run (Topaz Labs on fal.ai, plus
// the two classic engines the app already shipped). The engine and UI in
// upscaler.js are generic and read everything from here, so adding a tool
// or a model is a data change only.
//
// Sources: each fal.ai model page's own input schema (checked Oct 2026).
// Params carry `only` (model ids it applies to) / `not` (model ids it does
// not). A param the user never touched is NOT sent — fal then applies the
// model's own default, which for several Topaz params "varies by model".
//
// Param types:  range {min,max,step}  ·  int {min,max}  ·  bool {d}
//               seg {opts:[[value,label]]}  ·  text {max}
// ══════════════════════════════════════════════════════════════════════
(function(){
  "use strict";
  const m=(id,sub)=>({id,sub:sub||""});

  const FPS=[16,24,30,48,60];
  const IMG_FACTORS=[1,2,3,4];

  // Shared face-enhancement block (precision + generative image upscalers).
  const faceParams=(extra)=>[
    {k:"face_enhancement",t:"bool",d:true,l:"Face enhancement",hint:"Restores faces it detects",...(extra||{})},
    {k:"face_enhancement_strength",t:"range",min:0,max:1,step:.05,d:.8,l:"Face strength",needs:"face_enhancement",...(extra||{})},
    {k:"face_enhancement_creativity",t:"range",min:0,max:1,step:.05,l:"Face creativity",needs:"face_enhancement",...(extra||{})}
  ];
  const subjectDetection={k:"subject_detection",t:"seg",opts:[["All","All"],["Foreground","Foreground"],["Background","Background"]],l:"Subject detection",hint:"What the upscaler focuses detail on"};

  const TOOLS=[
    // ───────────── IMAGE · Upscale ─────────────
    {id:"img-precision",kind:"image",cat:"Upscale",ep:"topaz/upscale/image/precision",name:"Precision",tag:"Faithful · non-generative",
      desc:"Classic upscaling that stays true to your pixels, up to 4×.",
      models:[m("Standard V2","General purpose · default"),m("High Fidelity V3","Pro shots, keeps fine detail"),m("High Fidelity V2","Pro shots, earlier gen"),
        m("Low Resolution V2","Compressed / low-quality sources"),m("CGI","Art & rendered graphics"),m("Text Refine","Keeps text & shapes crisp"),m("Faces","Face Recovery 3")],
      defModel:"Standard V2",factor:{opts:IMG_FACTORS,def:2},fmt:true,
      params:[subjectDetection,
        {k:"sharpen",t:"range",min:0,max:1,step:.05,l:"Sharpen"},
        {k:"denoise",t:"range",min:0,max:1,step:.05,l:"Denoise"},
        {k:"fix_compression",t:"range",min:0,max:1,step:.05,l:"Fix compression",not:["CGI"]},
        {k:"strength",t:"range",min:.01,max:1,step:.01,l:"Text strength",only:["Text Refine"]},
        ...faceParams()]},
    {id:"img-generative",kind:"image",cat:"Upscale",ep:"topaz/upscale/image/generative",name:"Generative",tag:"Rebuilds lost detail",
      desc:"Diffusion-based upscaling that reconstructs detail the source never had.",
      models:[m("Wonder 3.5","Newest Wonder"),m("Wonder 3","Default"),m("Wonder 2"),m("Wonder"),m("Recover 3","Rebuilds natural detail"),
        m("Standard MAX","Maximum-quality standard"),m("Redefine","Prompt-guided, most creative"),m("Recovery V2","Restore with detail control"),m("Recovery","Original recovery")],
      defModel:"Wonder 3",factor:{opts:[2,4],def:2},fmt:true,
      params:[
        {k:"enhancement_strength",t:"seg",opts:[["low","Low"],["medium","Medium"],["high","High"]],l:"Enhancement",only:["Wonder 3","Wonder 3.5"]},
        {...subjectDetection,only:["Wonder 3","Recovery","Recovery V2"]},
        {k:"creativity",t:"int",min:1,max:6,l:"Creativity",only:["Redefine"]},
        {k:"texture",t:"int",min:1,max:5,l:"Texture",only:["Redefine"]},
        {k:"autoprompt",t:"bool",d:false,l:"Auto prompt",only:["Redefine"],hint:"Let Topaz describe the image itself"},
        {k:"prompt",t:"text",max:1024,l:"Prompt",only:["Redefine"],hint:"Guides the generated detail"},
        {k:"sharpen",t:"range",min:0,max:1,step:.05,l:"Sharpen",only:["Redefine"]},
        {k:"denoise",t:"range",min:0,max:1,step:.05,l:"Denoise",only:["Redefine"]},
        {k:"detail",t:"range",min:0,max:1,step:.05,l:"Detail",only:["Recovery V2"]},
        {k:"crop_to_fill",t:"bool",d:false,l:"Crop to fill"},
        ...faceParams()]},
    {id:"img-creative",kind:"image",cat:"Upscale",ep:"topaz/upscale/image/creative",name:"Creative",tag:"For AI-generated images",
      desc:"Adds new texture and detail — made for AI art and illustrations.",
      models:[m("Bloom 2","Newest · most control"),m("Bloom"),m("Bloom Realism","Photoreal bias")],
      defModel:"Bloom 2",factor:{opts:[2,4],def:2},fmt:true,
      params:[
        {k:"creativity",t:"int",min:1,max:9,l:"Creativity",only:["Bloom 2"],hint:"Higher invents more detail"},
        {k:"autoprompt",t:"bool",d:true,l:"Auto prompt",only:["Bloom 2"]},
        {k:"color_preservation",t:"bool",d:false,l:"Keep original colors",only:["Bloom 2"]},
        {k:"crop_to_fill",t:"bool",d:false,l:"Crop to fill"}]},
    {id:"img-transparent",kind:"image",cat:"Upscale",ep:"topaz/upscale/image/transparent",name:"Transparent",tag:"Keeps alpha · 4× PNG",
      desc:"For logos, stickers and cut-outs — preserves transparency end to end.",
      models:[],fixed:"Always 4× · PNG",params:[]},

    // ───────────── IMAGE · Enhance ─────────────
    {id:"img-restore",kind:"image",cat:"Enhance",ep:"topaz/restore/image",name:"Restore",tag:"Old & damaged photos",
      desc:"Rebuilds degraded photos, cleans dust and scratches, restores faces.",
      models:[m("Recover 3","Rebuilds natural detail"),m("Dust-Scratch V2","Cleans film dust & scratches"),m("Faces","Face Recovery 3")],
      defModel:"Recover 3",fmt:true,params:[]},
    {id:"img-denoise",kind:"image",cat:"Enhance",ep:"topaz/denoise/image",name:"Denoise",tag:"At source resolution",
      desc:"Removes noise without changing the image size.",
      models:[m("Normal"),m("Strong"),m("Extreme"),m("Denoise Max","Heaviest cleanup")],
      defModel:"Normal",fmt:true,params:[]},
    {id:"img-sharpen",kind:"image",cat:"Enhance",ep:"topaz/sharpen/image",name:"Sharpen",tag:"Deblur by blur type",
      desc:"Sharpening and deblur tuned per blur type.",
      models:[m("Standard"),m("Strong"),m("Natural"),m("Lens Blur V2","Out-of-focus"),m("Motion Blur","Camera / subject movement"),m("Refocus"),
        m("Wildlife"),m("Portrait"),m("Auto Sharpen"),m("Super Focus V3","Generative deblur, newest"),m("Super Focus V2","Generative deblur")],
      defModel:"Standard",fmt:true,params:[]},
    {id:"img-adjust",kind:"image",cat:"Enhance",ep:"topaz/adjust/image",name:"Adjust",tag:"Light · colour · colorize",
      desc:"Fix exposure, correct white balance, or colorize black & white.",
      models:[m("Adjust V2","Exposure / lighting"),m("White Balance","Colour correction"),m("Colorize","Adds colour to B&W")],
      defModel:"Adjust V2",fmt:true,params:[]},

    // ───────────── IMAGE · Classic (pre-Topaz engines) ─────────────
    {id:"img-esrgan",kind:"image",cat:"Classic",ep:"fal-ai/esrgan",name:"Real-ESRGAN",tag:"Fast · 4× general",
      desc:"The original fast general-purpose upscaler.",models:[],legacy:true,params:[]},
    {id:"img-clarity",kind:"image",cat:"Classic",ep:"fal-ai/clarity-upscaler",name:"Clarity",tag:"High fidelity · slower",
      desc:"The original high-fidelity upscaler.",models:[],legacy:true,params:[]},

    // ───────────── VIDEO · Upscale ─────────────
    {id:"vid-precision",kind:"video",cat:"Upscale",ep:"topaz/upscale/video/precision",name:"Precision",tag:"Faithful · non-generative",
      desc:"Classic Topaz Video AI upscaling. Pick the model family that matches your footage.",
      models:[m("Proteus","All-rounder · default"),m("Proteus Natural"),m("Iris","Faces & people"),m("Iris Low Quality"),
        m("Dione DV","Interlaced DV"),m("Dione TV","Interlaced broadcast"),m("Dione Robust"),m("Dione Dehalo"),m("Dione Robust Dehalo"),
        m("Artemis High Quality"),m("Artemis Medium Quality"),m("Artemis Low Quality"),m("Artemis Strong Halo"),m("Artemis Medium Halo"),m("Artemis Aliasing & Moire"),
        m("Gaia HQ","CG / animation"),m("Gaia CG"),m("Gaia 2","Half price"),m("Rhea"),m("Theia Fine Tune Detail"),m("Theia Fine Tune Fidelity")],
      defModel:"Proteus",factor:{opts:[1,2,3,4],def:2},fps:FPS,h264:true,
      params:[
        {k:"compression",t:"range",min:0,max:1,step:.05,l:"Compression fix"},
        {k:"noise",t:"range",min:0,max:1,step:.05,l:"Noise"},
        {k:"halo",t:"range",min:0,max:1,step:.05,l:"Halo"},
        {k:"grain",t:"range",min:0,max:.1,step:.005,l:"Film grain"},
        {k:"recover_detail",t:"range",min:0,max:1,step:.05,l:"Recover detail",hint:"Higher keeps more original detail"}]},
    {id:"vid-generative",kind:"video",cat:"Upscale",ep:"topaz/upscale/video/generative",name:"Starlight",tag:"Diffusion restoration",
      desc:"Rebuilds detail that isn't in the source — best for low-quality, compressed or AI footage.",
      models:[m("Starlight Precise 2.6","Realism pass for AI video · default"),m("Starlight HQ","Max quality, hi-res sources"),m("Starlight Mini","Archival restoration"),
        m("Starlight Sharp","Fast, sharper detail"),m("Starlight Fast 2","Fastest & cheapest")],
      defModel:"Starlight Precise 2.6",factor:{opts:[1,2,3,4],def:2},fps:FPS,h264:true,
      params:[{k:"softness",t:"int",min:1,max:5,l:"Softness",only:["Starlight Precise 2.6"],hint:"1 sharpest · 5 softest"}]},
    {id:"vid-creative",kind:"video",cat:"Upscale",ep:"topaz/upscale/video/creative",name:"Astra 2",tag:"Creative · up to 4K",
      desc:"Generates new detail and texture. Best on stylised, wide or detail-sparse scenes.",
      models:[],fixed:"Astra 2 · billed by delivered resolution",factor:{opts:[1,2,3,4],def:2,note:"The model may snap to its own supported sizes"},fps:FPS,h264:true,
      params:[
        {k:"creativity",t:"range",min:0,max:1,step:.05,d:.5,l:"Creativity"},
        {k:"realism",t:"range",min:0,max:1,step:.05,l:"Realism"},
        {k:"sharp",t:"range",min:0,max:1,step:.05,d:.5,l:"Sharpness",hint:"0.5 is neutral"},
        {k:"prompt",t:"text",max:600,l:"Prompt",hint:"Optional. Limits input to 450 frames"}]},

    // ───────────── VIDEO · Enhance ─────────────
    {id:"vid-denoise",kind:"video",cat:"Enhance",ep:"topaz/denoise/video",name:"Denoise",tag:"Noise & grain",
      desc:"Noise reduction at source resolution, with optional upscaling.",
      models:[m("Nyx","Quality + texture · default"),m("Nyx Fast","High-volume"),m("Nyx XL","Extreme noise"),m("Nyx HF","Precision, no upscaling")],
      defModel:"Nyx",factor:{opts:[1,2,3,4],def:1},h264:true,
      params:[
        {k:"noise",t:"range",min:0,max:1,step:.05,l:"Noise"},
        {k:"compression",t:"range",min:0,max:1,step:.05,l:"Compression fix"},
        {k:"halo",t:"range",min:0,max:1,step:.05,l:"Halo"}]},
    {id:"vid-deblur",kind:"video",cat:"Enhance",ep:"topaz/deblur/video",name:"Deblur",tag:"Themis 2",
      desc:"Motion deblur for fast-moving footage.",models:[],fixed:"Themis 2",h264:true,params:[]},
    {id:"vid-colorize",kind:"video",cat:"Enhance",ep:"topaz/colorize/video",name:"Colorize",tag:"B&W → colour",
      desc:"Adds colour to black-and-white video. Output is at least 1080p.",models:[],fixed:"Colorize",h264:true,params:[]},
    {id:"vid-hdr",kind:"video",cat:"Enhance",ep:"topaz/sdr-to-hdr/video",name:"SDR → HDR",tag:"Hyperion 2.5",
      desc:"Converts 8-bit SDR footage to HDR. Resolution and frame rate stay the same.",models:[],fixed:"Hyperion 2.5",
      outFmt:{opts:[["mp4","MP4 · HDR10"],["prores","ProRes 422 HQ"]],def:"mp4",hint:"ProRes is for grading — files are much larger"},params:[]},

    // ───────────── VIDEO · Motion ─────────────
    {id:"vid-interpolate",kind:"video",cat:"Motion",ep:"topaz/interpolate/video",name:"Interpolate",tag:"Slow-mo · up to 60 fps",
      desc:"Frame interpolation and slow motion. Resolution stays the same.",
      models:[m("Apollo","General purpose · default"),m("Chronos","Real-world motion"),m("Aion","Extreme / complex motion")],
      defModel:"Apollo",fps:[24,30,48,60,120],defFps:60,h264:true,
      params:[{k:"slowdown_factor",t:"int",min:1,max:8,d:1,l:"Slow-motion ×",hint:"1 = original speed"}]}
  ];

  const CATS={image:["Upscale","Enhance","Classic"],video:["Upscale","Enhance","Motion"]};
  const byId={};TOOLS.forEach(t=>byId[t.id]=t);
  const byEp={};TOOLS.forEach(t=>byEp[t.ep]=t);

  window.UP_REGISTRY={TOOLS,CATS,byId,byEp,
    defaultTool:{image:"img-precision",video:"vid-precision"},
    // Params that apply to a given model (honours only / not).
    paramsFor(tool,model){return(tool.params||[]).filter(p=>(!p.only||p.only.includes(model))&&(!p.not||!p.not.includes(model)))}
  };
})();

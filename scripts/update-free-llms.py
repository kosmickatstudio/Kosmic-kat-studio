# Deterministic deployment-time patch for the Home Brain model catalog.
from pathlib import Path

HOME = Path("home.js")
MARKER = "const DIRECTOR_BANNERS={"
OVERRIDE = r'''// ── CURRENT FREE LLM OVERRIDES ──
// Provider IDs verified against current provider documentation on 2026-09-08.
if(typeof BRAIN_SUBMODELS!=="undefined"){
  Object.assign(BRAIN_SUBMODELS,{
    gemini:[
      {id:"gemini-3.8-flash",label:"Gemini 3.8 Flash — FREE (latest)"},
      {id:"gemini-3.7-flash",label:"Gemini 3.7 Flash — FREE"},
      {id:"gemini-3.1-flash-lite",label:"Gemini 3.1 Flash-Lite — FREE (fast)"}
    ],
    groq:[
      {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B — FREE"},
      {id:"openai/gpt-oss-20b",label:"GPT-OSS 20B — FREE (fast)"},
      {id:"qwen/qwen3.8-27b",label:"Qwen 3.8 27B — FREE"}
    ]
  });
  if(typeof gs==="function" && typeof saveSetting==="function"){
    const gemini=BRAIN_SUBMODELS.gemini.map(x=>x.id);
    const groq=BRAIN_SUBMODELS.groq.map(x=>x.id);
    if(!gemini.includes(gs("gemini_brain_model",""))) saveSetting("gemini_brain_model",gemini[0]);
    if(!groq.includes(gs("groq_brain_model",""))) saveSetting("groq_brain_model",groq[0]);
  }
}

'''

s = HOME.read_text(encoding="utf-8")
if MARKER not in s:
    raise SystemExit("home.js marker not found")
if "CURRENT FREE LLM OVERRIDES" not in s:
    s = s.replace(MARKER, OVERRIDE + MARKER, 1)

s = s.replace(
    "Google Gemini (Vision-capable, cheap, supports images)",
    "Google Gemini — Free Tier models",
)
s = s.replace(
    "Groq GPT-OSS 120B (Free & fast, text only)",
    "Groq — Free LLMs (GPT-OSS / Qwen)",
)
HOME.write_text(s, encoding="utf-8")
print("Free LLM UI wiring applied to home.js")

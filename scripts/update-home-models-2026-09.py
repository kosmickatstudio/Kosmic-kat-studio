from pathlib import Path

home=Path("home.js")
s=home.read_text(encoding="utf-8")
marker='const DIRECTOR_BANNERS={'
override=r'''// ── HOME CURRENT MODEL CATALOG — 2026-09-10 ──
if(typeof BRAIN_SUBMODELS!=="undefined")Object.assign(BRAIN_SUBMODELS,{
  claude:[
    {id:"claude-fable-5-1",label:"Claude Fable 5.1 — latest / frontier"},
    {id:"claude-fable-5",label:"Claude Fable 5 — frontier"},
    {id:"claude-opus-5",label:"Claude Opus 5 — advanced reasoning"},
    {id:"claude-sonnet-5",label:"Claude Sonnet 5 — balanced"},
    {id:"claude-haiku-4-5-20251001",label:"Claude Haiku 4.5 — fast"},
    {id:"claude-opus-4-8",label:"Claude Opus 4.8"},
    {id:"claude-opus-4-7",label:"Claude Opus 4.7"},
    {id:"claude-opus-4-6",label:"Claude Opus 4.6"},
    {id:"claude-sonnet-4-6",label:"Claude Sonnet 4.6"}
  ],
  gemini:[
    {id:"gemini-3.8-flash",label:"Gemini 3.8 Flash — latest"},
    {id:"gemini-3.7-flash",label:"Gemini 3.7 Flash"},
    {id:"gemini-3.6-flash",label:"Gemini 3.6 Flash"},
    {id:"gemini-3.5-flash",label:"Gemini 3.5 Flash"},
    {id:"gemini-3.5-flash-lite",label:"Gemini 3.5 Flash-Lite — fastest"},
    {id:"gemini-3.1-flash-lite",label:"Gemini 3.1 Flash-Lite — efficient"}
  ],
  openai:[
    {id:"gpt-5.6-sol",label:"GPT-5.6 Sol — flagship"},
    {id:"gpt-5.6-terra",label:"GPT-5.6 Terra — balanced"},
    {id:"gpt-5.6-luna",label:"GPT-5.6 Luna — cost-efficient"}
  ],
  groq:[
    {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B — reasoning"},
    {id:"openai/gpt-oss-20b",label:"GPT-OSS 20B — fast"}
  ],
  deepseek:[
    {id:"deepseek-v4-pro",label:"DeepSeek V4 Pro — advanced reasoning"},
    {id:"deepseek-v4-flash",label:"DeepSeek V4 Flash — fast"},
    {id:"deepseek-v4-flash-vision-exp",label:"DeepSeek V4 Flash Vision — experimental"}
  ],
  grok:[
    {id:"grok-4.6",label:"Grok 4.6 — xAI flagship"},
    {id:"grok-4.20-0309-reasoning",label:"Grok 4.20 Reasoning"},
    {id:"grok-4.20-0309-non-reasoning",label:"Grok 4.20 — fast"}
  ],
  kimi:[{id:"kimi-k3",label:"Kimi K3 — EvoLink"}]
});

'''
if marker not in s: raise SystemExit("home marker not found")
if "HOME CURRENT MODEL CATALOG — 2026-09-10" not in s:
    s=s.replace(marker,override+marker,1)
home.write_text(s,encoding="utf-8")
print("Home current model catalog patched")

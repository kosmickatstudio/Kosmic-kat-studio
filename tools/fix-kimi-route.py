from pathlib import Path

p=Path('agentfeline.js')
s=p.read_text(encoding='utf-8')
marker='// ── KIMI EVOLINK API FIX: 2026-09-08 ──'
if marker not in s:
    old='''  const res=await fetch("https://direct.evolink.ai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},
    body:JSON.stringify({model,prompt:userText,system_prompt:afSystemPrompt("Kimi")})
  });'''
    new='''  const res=await fetch("https://direct.evolink.ai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},
    body:JSON.stringify({model,messages:[{role:"system",content:afSystemPrompt("Kimi")},{role:"user",content:userText}],reasoning_effort:"high",max_tokens:4000})
  });'''
    if old not in s:
        raise SystemExit('Expected Kimi EvoLink request block not found')
    s=s.replace(old,new,1)

    # Restore the pre-existing fal.ai Seedream auth header that an earlier
    # broad replacement accidentally changed. No other fal.ai code is touched.
    old='''fetch("https://fal.run/bytedance/seedream/v5/pro/text-to-image",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},'''
    new='''fetch("https://fal.run/bytedance/seedream/v5/pro/text-to-image",{
    method:"POST",headers:{"Content-Type":"application/json","Authorization":"Key "+apiKey},'''
    if old in s:
        s=s.replace(old,new,1)

    s+='\n'+marker+'\n'
    p.write_text(s,encoding='utf-8')
    print('Fixed Kimi EvoLink request and restored existing fal.ai auth')
else:
    print('Kimi route already fixed')

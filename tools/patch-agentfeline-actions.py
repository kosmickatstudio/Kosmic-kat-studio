from pathlib import Path

p = Path('agentfeline.js')
s = p.read_text(encoding='utf-8')
marker = 'function afRenderAgentCard(msg){'
if marker not in s:
    raise SystemExit('Agent Feline render marker not found')

helper = r'''// ── AGENT FELINE RESPONSE ACTIONS ──
// Copy, native Share (with clipboard fallback), and a persistent Like toggle.
function afActionKey(msg){return String(msg.agentId||'agent')+'_'+String(msg.turnId||'');}
async function afCopyResponse(key){
  const msg=(S.afChatHistory||[]).find(m=>m.role==='assistant'&&afActionKey(m)===key);
  if(!msg)return;
  const text=String(msg.content||'');
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else{
      const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('✓ Response copied','');
  }catch(e){toast('Could not copy the response','error');}
}
async function afShareResponse(key){
  const msg=(S.afChatHistory||[]).find(m=>m.role==='assistant'&&afActionKey(m)===key);
  if(!msg)return;
  const text=String(msg.content||'');
  try{
    if(navigator.share) await navigator.share({title:'Agent Feline — '+String(msg.agentName||'AI'),text});
    else{
      await afCopyResponse(key);
      toast('Share is unavailable here — response copied instead','');
    }
  }catch(e){
    if(e&&e.name!=='AbortError')toast('Could not share the response','error');
  }
}
function afToggleLike(key){
  const msg=(S.afChatHistory||[]).find(m=>m.role==='assistant'&&afActionKey(m)===key);
  if(!msg)return;
  msg.liked=msg.liked!==true;
  save('afChatHistory');
  renderAfChatThread();
}
function afResponseActions(msg){
  const key=afActionKey(msg).replace(/'/g,"\\'");
  const liked=msg.liked===true;
  return `<div style="display:flex;align-items:center;gap:4px;margin-top:9px;padding-top:7px;border-top:1px solid var(--border)">
    <button type="button" onclick="afCopyResponse('${key}')" title="Copy response" aria-label="Copy response" style="border:0;background:transparent;color:var(--textm);font-size:11px;padding:5px 7px;border-radius:7px;cursor:pointer">${pIcon('copy',12)} <span>Copy</span></button>
    <button type="button" onclick="afShareResponse('${key}')" title="Share response" aria-label="Share response" style="border:0;background:transparent;color:var(--textm);font-size:11px;padding:5px 7px;border-radius:7px;cursor:pointer">${pIcon('share',12)} <span>Share</span></button>
    <button type="button" onclick="afToggleLike('${key}')" title="${liked?'Unlike response':'Like response'}" aria-label="${liked?'Unlike response':'Like response'}" style="border:0;background:transparent;color:${liked?'var(--violet)':'var(--textm)'};font-size:11px;font-weight:${liked?'700':'500'};padding:5px 7px;border-radius:7px;cursor:pointer">${liked?'♥':'♡'} <span>${liked?'Liked':'Like'}</span></button>
  </div>`;
}

'''

if '// ── AGENT FELINE RESPONSE ACTIONS ──' not in s:
    s = s.replace(marker, helper + marker, 1)

old = '''  if(msg.imageError)body+=`<div style="font-size:10.5px;color:var(--gold);margin-top:6px">${pIcon('search',10)} ${afEscape(msg.imageError)}</div>`;
  return `<div class="ig-bubble-assistant" style="margin:0">${header}${body}</div>`;'''
new = '''  if(msg.imageError)body+=`<div style="font-size:10.5px;color:var(--gold);margin-top:6px">${pIcon('search',10)} ${afEscape(msg.imageError)}</div>`;
  if(!msg.error)body+=afResponseActions(msg);
  return `<div class="ig-bubble-assistant" style="margin:0">${header}${body}</div>`;'''
if old not in s:
    raise SystemExit('Agent Feline card return block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('Agent Feline response actions patched')

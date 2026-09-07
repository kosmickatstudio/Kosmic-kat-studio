from pathlib import Path

p = Path('agentfeline.js')
s = p.read_text(encoding='utf-8')

helper = r'''// ── AGENT FELINE RESPONSE ACTIONS ──
// UI-level actions attached to every rendered Agent Feline assistant bubble.
(function(){
  if(window.__afResponseActionsInstalled)return;
  window.__afResponseActionsInstalled=true;
  const keyPrefix='kosmic_af_like_';
  function textFor(bubble){
    const clone=bubble.cloneNode(true);
    clone.querySelectorAll('.af-response-actions').forEach(x=>x.remove());
    return (clone.innerText||clone.textContent||'').trim();
  }
  function hash(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return String(h);}
  function addActions(bubble){
    if(!bubble||bubble.querySelector('.af-response-actions'))return;
    const text=textFor(bubble); if(!text)return;
    const key=keyPrefix+hash(text);
    const liked=localStorage.getItem(key)==='1';
    const bar=document.createElement('div');
    bar.className='af-response-actions';
    bar.style.cssText='display:flex;align-items:center;gap:4px;margin-top:9px;padding-top:7px;border-top:1px solid var(--border);font-size:11px';
    function btn(label,icon,fn,active){
      const b=document.createElement('button'); b.type='button'; b.title=label; b.setAttribute('aria-label',label);
      b.style.cssText='border:0;background:transparent;color:'+(active?'var(--violet)':'var(--textm)')+';font-size:11px;font-weight:'+(active?'700':'500')+';padding:5px 7px;border-radius:7px;cursor:pointer';
      b.innerHTML='<span style="font-size:13px;vertical-align:-1px">'+icon+'</span> <span>'+label.replace(' response','')+'</span>';
      b.addEventListener('click',fn); return b;
    }
    bar.appendChild(btn('Copy response','▣',async()=>{
      try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);else{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();} if(typeof toast==='function')toast('✓ Response copied','');}catch(e){if(typeof toast==='function')toast('Could not copy the response','error');}
    }));
    bar.appendChild(btn('Share response','↗',async()=>{
      try{if(navigator.share)await navigator.share({title:'Agent Feline',text});else{if(navigator.clipboard)await navigator.clipboard.writeText(text);if(typeof toast==='function')toast('Share unavailable — response copied','');}}catch(e){if(e&&e.name!=='AbortError'&&typeof toast==='function')toast('Could not share the response','error');}
    }));
    const like=btn(liked?'Unlike response':'Like response',liked?'♥':'♡',()=>{
      const now=localStorage.getItem(key)!=='1'; localStorage.setItem(key,now?'1':'0');
      like.innerHTML='<span style="font-size:13px;vertical-align:-1px">'+(now?'♥':'♡')+'</span> <span>'+(now?'Liked':'Like')+'</span>';
      like.style.color=now?'var(--violet)':'var(--textm)'; like.style.fontWeight=now?'700':'500'; like.title=now?'Unlike response':'Like response'; like.setAttribute('aria-label',like.title);
    },liked);
    bar.appendChild(like);
    bubble.appendChild(bar);
  }
  function scan(root){
    (root.querySelectorAll?root.querySelectorAll('.ig-bubble-assistant'):[]).forEach(addActions);
    if(root.matches&&root.matches('.ig-bubble-assistant'))addActions(root);
  }
  scan(document);
  new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n);})).observe(document.documentElement,{childList:true,subtree:true});
})();
'''

if '// ── AGENT FELINE RESPONSE ACTIONS ──' not in s:
    s += '\n' + helper
p.write_text(s,encoding='utf-8')
print('Agent Feline response actions installed')

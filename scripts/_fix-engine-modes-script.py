from pathlib import Path
import re

p=Path('scripts/_apply-engine-modes.py')
s=p.read_text(encoding='utf-8')

# Input bar: keep the already-prepared replacement HTML, but replace brittle exact matching with structural matching.
a=s.index("old='''", s.index("p=Path('kosmicengine.js')"))
b=s.index("marker='  let _engineTab", a)
block=s[a:b]
n=block.index("new=")+len("new=")
ne=block.index("\nif old not in s", n)
new_literal=block[n:ne]
replacement=f'''bar_start=s.index('      <div id="dcInputBar"')\ntail=s.index('      </div>\\n    </div>\\n  `;',bar_start)\nbar_end=tail+len('      </div>')\nnew={new_literal}\ns=s[:bar_start]+new+s[bar_end:]\n\n'''
s=s[:a]+replacement+s[b:]

# Draft: match the actual multiline object instead of assuming one physical source line.
a=s.index("old='''        continuity:", s.index("s=s.replace(old,new,1)"))
b=s.index("old='''  function engineBrainPreflight", a)
draft_patch='''old='''
new='''  _draft_re=re.compile(r'(S\\.directorChat\\.draft=\\{.*?continuity:"both",)brainModel:gs\\("ai_model","claude"\\),',re.S)\nif not _draft_re.search(s): raise SystemExit('draft marker not found')\ns=_draft_re.sub(r'\\1brainModel:engineSelection().provider,brainSubModel:engineSelection().model,engineTier:engineSelection().tier,engineModel:engineSelection().model,',s,count=1)\n\n'''
s=s[:a]+new+s[b:]

# Session initialization and running-production session are also matched structurally.
s=re.sub(r'(S\\.directorChat=\\{active:true,productionId:null,projectId:pid,.*?permissionPaused:false)(\\};)',r'\\1,engineTier:"lite",engineModel:"gemini-3.8-flash"\\2',s,count=1,flags=re.S)
s=re.sub(r'(S\\.directorChat=\\{active:true,productionId:prodId,projectId:p\\.projectId\\|\\|S\\.kosmicEngineProjectId\\|\\|null,.*?draft:\{episodeCount:p\\.episodes\\.length)(\\},intakeStage:"running")',r'const _sel=engineSelection();\\n    S.directorChat={active:true,productionId:prodId,projectId:p.projectId||S.kosmicEngineProjectId||null,directorName:directorName(),messages:[],tasks:null,awaitingApprovalTaskId:null,draft:{episodeCount:p.episodes.length,engineTier:_sel.tier,engineModel:_sel.model,brainModel:_sel.provider,brainSubModel:_sel.model\\1\\2',s,count=1,flags=re.S)

p.write_text(s,encoding='utf-8')
print('engine patch script normalized')

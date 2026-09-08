from pathlib import Path

p=Path('scripts/_apply-engine-modes.py')
s=p.read_text(encoding='utf-8')
a=s.index("old='''", s.index("p=Path('kosmicengine.js')"))
b=s.index("marker='  let _engineTab", a)
block=s[a:b]
n=block.index("new=")+len("new=")
ne=block.index("\nif old not in s", n)
new_literal=block[n:ne]
replacement=f'''bar_start=s.index('      <div id="dcInputBar"')\ntail=s.index('      </div>\\n    </div>\\n  `;',bar_start)\nbar_end=tail+len('      </div>')\nnew={new_literal}\ns=s[:bar_start]+new+s[bar_end:]\n\n'''
s=s[:a]+replacement+s[b:]
p.write_text(s,encoding='utf-8')
print('engine patch script marker fixed')

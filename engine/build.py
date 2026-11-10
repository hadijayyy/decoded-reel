#!/usr/bin/env python3
"""Build <project>/build/reel.html from <project>/project.json (inlines engine, config, logo paths, icons, fonts)."""
import base64, json, os, sys
ENG = os.path.dirname(os.path.abspath(__file__))
proj = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
cfg = json.load(open(os.path.join(proj, 'project.json')))
P = lambda p: os.path.join(proj, p)
fonts = cfg.get('fonts', {})
ff = ''
for fam in ['FD', 'FX', 'FS', 'FR']:
    src = fonts.get(fam) or fonts.get('FD')
    if not src: sys.exit(f'missing font for {fam} in project.json "fonts"')
    if src.startswith('local:'):
        ff += f"@font-face{{font-family:{fam};src:local('{src[6:]}');}}\n"; continue
    ext = os.path.splitext(src)[1][1:].lower(); fmt = {'woff2': 'woff2', 'woff': 'woff', 'ttf': 'truetype', 'otf': 'opentype'}[ext]
    b64 = base64.b64encode(open(P(src), 'rb').read()).decode()
    ff += f"@font-face{{font-family:{fam};src:url(data:font/{ext};base64,{b64}) format('{fmt}');}}\n"
logo = open(P(cfg['logo']['paths'])).read()
icons = open(P(cfg['icons'])).read() if cfg.get('icons') else '{}'
js = 'const CFG=' + json.dumps(cfg, ensure_ascii=False) + ';\nconst LOGOPATHS=' + logo + ';\nconst ICONDATA=' + icons + ';\n'
for f in ['core.js', 'templates.js', 'main.js']:
    js += open(os.path.join(ENG, f)).read() + '\n'
os.makedirs(P('build'), exist_ok=True)
html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{ff}html,body{{margin:0;background:#000}}canvas{{display:block}}</style></head><body><canvas id='c'></canvas><script>{js}</script></body></html>"
open(P('build/reel.html'), 'w').write(html)
print('built', P('build/reel.html'), f'{len(html)//1024} KB')

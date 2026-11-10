#!/usr/bin/env python3
"""symbols_to_icons.py <sprite.svg> <out.json> id1 id2 ...   -> {"id": {"vb":[x,y,w,h], "d":[...]}} for the engine's icon()."""
import json, re, sys
s = open(sys.argv[1], errors='replace').read(); out = {}
for i in sys.argv[3:]:
    m = re.search(r'<symbol([^>]*)\bid="%s"([^>]*)>(.*?)</symbol>' % re.escape(i), s, re.S)
    if not m: print('missing', i); continue
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', m.group(1) + m.group(2)).group(1).split()]
    out[i] = {'vb': vb, 'd': re.findall(r'\sd="([^"]+)"', m.group(3))}
json.dump(out, open(sys.argv[2], 'w')); print(len(out), 'icons ->', sys.argv[2])

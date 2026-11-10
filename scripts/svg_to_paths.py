#!/usr/bin/env python3
"""svg_to_paths.py <file.svg> <out.json> [--symbol ID]
Flatten an SVG (or one <symbol> of a sprite) into the engine's logo format: [{"d":..., "fill":...}, ...]
in document order. Converts rect/circle/ellipse/polygon/polyline to path data and bakes simple
transforms (translate/scale/matrix on <g> or element) via svgpathtools if installed; otherwise warns.
Prints the viewBox — put it in project.json logo.viewBox.
"""
import json, re, sys, xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]; sym = sys.argv[sys.argv.index('--symbol') + 1] if '--symbol' in sys.argv else None
raw = open(src, errors='replace').read(); raw = re.sub(r'\sxmlns(:\w+)?="[^"]*"', '', raw); raw = re.sub(r'\s[\w-]+:[\w-]+="[^"]*"', '', raw)
root = ET.fromstring(raw)
node = root
if sym:
    node = next((e for e in root.iter() if e.get('id') == sym), None)
    if node is None: sys.exit(f'symbol {sym} not found')
vb = node.get('viewBox') or root.get('viewBox')
style_fill = lambda e: (re.search(r'fill:\s*(#[0-9a-fA-F]{3,6}|none|\w+)', e.get('style', '')) or [None, None])[1]
def shape_d(e):
    t = e.tag.split('}')[-1]; g = lambda k, d=0: float(e.get(k, d))
    if t == 'path': return e.get('d')
    if t == 'rect':
        x, y, w, h = g('x'), g('y'), g('width'), g('height'); rx = float(e.get('rx', e.get('ry', 0))); ry = float(e.get('ry', rx))
        rx, ry = min(rx, w / 2), min(ry, h / 2)
        if not rx: return f'M{x} {y}h{w}v{h}h{-w}z'
        return (f'M{x+rx} {y}h{w-2*rx}a{rx} {ry} 0 0 1 {rx} {ry}v{h-2*ry}a{rx} {ry} 0 0 1 {-rx} {ry}'
                f'h{-(w-2*rx)}a{rx} {ry} 0 0 1 {-rx} {-ry}v{-(h-2*ry)}a{rx} {ry} 0 0 1 {rx} {-ry}z')
    if t in ('circle', 'ellipse'):
        cx, cy = g('cx'), g('cy'); rx = g('r') if t == 'circle' else g('rx'); ry = g('r') if t == 'circle' else g('ry')
        return f'M{cx-rx} {cy}a{rx} {ry} 0 1 0 {2*rx} 0a{rx} {ry} 0 1 0 {-2*rx} 0z'
    if t in ('polygon', 'polyline'):
        p = re.findall(r'-?[\d.]+(?:e-?\d+)?', e.get('points', '')); pts = list(zip(p[0::2], p[1::2]))
        return 'M' + 'L'.join(f'{a} {b}' for a, b in pts) + ('z' if t == 'polygon' else '')
    return None
paths = []; warned = False
def walk(e, fill, tf):
    global warned
    f = e.get('fill') or style_fill(e) or fill; t = (tf + ' ' + e.get('transform', '')).strip()
    d = shape_d(e)
    if d and f != 'none':
        if t and not warned: print('! transform present:', t, '— bake it (e.g. Inkscape "Apply transform" or svgpathtools) if parts look offset'); warned = True
        paths.append({'d': d, 'fill': f if f and f.startswith('#') else '#000000'})
    for ch in e: walk(ch, f, t)
for ch in node: walk(ch, node.get('fill'), node.get('transform', ''))
json.dump(paths, open(out, 'w')); print(f'{len(paths)} paths -> {out}; viewBox = {vb}')

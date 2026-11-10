#!/usr/bin/env python3
"""add_plate.py <paths.json> <out.json> [--padx 170] [--pady 150] [--radius 90] [--ring 14] [--outline #15569e] [--inner #0d173a]
For wordmark-only logos: put the traced letters on a rounded "plate" so the engine has a frame to work with.
Output paths: index 0 = plate outline (ring colour), index 1 = inner plate, then the original paths shifted into place.
Understands absolute M/L/C/z path data (what png_to_paths.py writes). Prints the viewBox, centre and one bbox per
path so you can group paths into parts. Plate aspect ~3:1 is fine; the mosaic/lockup templates adapt (faceK/logoH, layout:"stack").
"""
import json, re, sys
args = sys.argv[1:]; src, out = args[0], args[1]
opt = lambda k, d: type(d)(args[args.index(k) + 1]) if k in args else d
padx, pady, rad, ring = opt('--padx', 170.0), opt('--pady', 150.0), opt('--radius', 90.0), opt('--ring', 14.0)
c_out, c_in = opt('--outline', '#15569e'), opt('--inner', '#0d173a')
P = json.load(open(src))
def nums(d): return [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?(?:e-?\d+)?', d)]
def bbox(d):
    n = nums(d); xs, ys = n[0::2], n[1::2]; return min(xs), min(ys), max(xs), max(ys)
bb = [bbox(p['d']) for p in P]
x0, y0 = min(b[0] for b in bb), min(b[1] for b in bb); x1, y1 = max(b[2] for b in bb), max(b[3] for b in bb)
dx, dy = padx - x0, pady - y0; W, H = (x1 - x0) + 2 * padx, (y1 - y0) + 2 * pady
def shift(d):
    out = []
    for tok in re.findall(r'[MLCz]|-?\d+(?:\.\d+)?(?:e-?\d+)?', d):
        out.append(tok)
    res, i, k = '', 0, 0
    for tok in out:
        if tok in 'MLCz': res += tok; k = 0; continue
        res += f'{float(tok) + (dx if k % 2 == 0 else dy):.2f}' + ' '; k += 1
    return res.strip()
def plate(x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    return f'M{x + r:.2f} {y:.2f}H{x + w - r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x + w:.2f} {y + r:.2f}V{y + h - r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x + w - r:.2f} {y + h:.2f}H{x + r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x:.2f} {y + h - r:.2f}V{y + r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x + r:.2f} {y:.2f}z'
res = [{'d': plate(0, 0, W, H, rad), 'fill': c_out}, {'d': plate(ring, ring, W - 2 * ring, H - 2 * ring, rad - ring), 'fill': c_in}]
res += [{'d': shift(p['d']), 'fill': p['fill']} for p in P]
json.dump(res, open(out, 'w'))
print(f'{len(res)} paths -> {out}; viewBox = [{W:.0f}, {H:.0f}]  center = [{W/2:.0f}, {H/2:.0f}]')
for i, b in enumerate(bb): print(f'  path {i + 2}: bbox x {b[0] + dx:.0f}-{b[2] + dx:.0f}  y {b[1] + dy:.0f}-{b[3] + dy:.0f}  centre [{(b[0] + b[2]) / 2 + dx:.0f}, {(b[1] + b[3]) / 2 + dy:.0f}]')

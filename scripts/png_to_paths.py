#!/usr/bin/env python3
"""png_to_paths.py <logo.png> <out.json> [--fill #ffffff] [--threshold 128] [--invert] [--up 3] [--turd 8]
Vectorise a PNG-only logo (a flat, single-colour mark or wordmark) into the engine's logo format:
[{"d": ..., "fill": ...}, ...]. One path per connected component (holes stay inside their parent), sorted
left-to-right, so letters/shapes get stable indexes. The mask is upsampled (--up) before tracing so curves come
out smooth. Needs: pip install potracer numpy scipy pillow. Use the largest PNG you can find (>= 1000 px wide).
Prints viewBox = PNG size. For logos that exist as SVG, use svg_to_paths.py instead.
"""
import json, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage
import potrace

args = sys.argv[1:]
src, out = args[0], args[1]
opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
thr = int(opt('--threshold', 128)); fill = opt('--fill', '#000000'); turd = int(opt('--turd', 8)); UP = int(opt('--up', 3))
im = Image.open(src).convert('RGBA'); a = np.array(im).astype(float)
alpha = a[..., 3] / 255.0; lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
if alpha.min() < 0.99:                       # transparent background: the alpha channel is the shape
    cov = alpha
else:                                        # opaque: dark ink on light (or the reverse with --invert)
    cov = (lum / 255.0) if '--invert' in args else 1 - lum / 255.0
h, w = cov.shape
lab, n = ndimage.label(cov > thr / 255.0, structure=np.ones((3, 3)))
items = []
for k, sl in enumerate(ndimage.find_objects(lab), start=1):
    if sl is None: continue
    y0, y1 = max(sl[0].start - 3, 0), min(sl[0].stop + 3, h); x0, x1 = max(sl[1].start - 3, 0), min(sl[1].stop + 3, w)
    own = (lab[y0:y1, x0:x1] == k)
    if own.sum() < turd * turd: continue
    c = np.where(own | ndimage.binary_dilation(own, iterations=2), cov[y0:y1, x0:x1], 0.0)  # keep this component's anti-aliased edge only
    up = np.array(Image.fromarray((c * 255).astype(np.uint8)).resize((c.shape[1] * UP, c.shape[0] * UP), Image.BICUBIC)).astype(float)
    big = ndimage.gaussian_filter(up, UP * 0.6) > 127   # light blur: removes 1-px stair-steps so flat edges trace straight
    plist = potrace.Bitmap(~big).trace(turdsize=turd * UP, alphamax=1.0, opticurve=True, opttolerance=0.3)
    f = lambda p: (p.x / UP + x0, p.y / UP + y0)
    d = ''
    for cu in plist:
        sx, sy = f(cu.start_point); d += f'M{sx:.2f} {sy:.2f}'
        for s in cu.segments:
            if s.is_corner: (ax, ay), (bx, by) = f(s.c), f(s.end_point); d += f'L{ax:.2f} {ay:.2f}L{bx:.2f} {by:.2f}'
            else: (ax, ay), (bx, by), (ex, ey) = f(s.c1), f(s.c2), f(s.end_point); d += f'C{ax:.2f} {ay:.2f} {bx:.2f} {by:.2f} {ex:.2f} {ey:.2f}'
        d += 'z'
    items.append((x0, {'d': d, 'fill': fill}))
items.sort(key=lambda t: t[0])
json.dump([it for _, it in items], open(out, 'w'))
print(f'{len(items)} paths -> {out}; viewBox = 0 0 {w} {h}')

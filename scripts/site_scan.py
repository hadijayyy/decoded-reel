#!/usr/bin/env python3
"""site_scan.py <url> <outdir>
Download a site's homepage + stylesheets and report what a motion designer needs:
web fonts (downloads woff2/woff), SVG sprites/logos (downloads), inline <svg>/<symbol> ids,
top brand colours from CSS, <title>/meta description and headings. Writes <outdir>/scan.json.
"""
import json, os, re, sys, urllib.parse, urllib.request
from collections import Counter
url, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, 'raw'), exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; decoded-reel/1.0)'}
def get(u, binary=False):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
            b = r.read(); return b if binary else b.decode('utf-8', 'replace')
    except Exception as e:
        print('  ! fetch failed', u, e); return b'' if binary else ''
def absu(u, base): return urllib.parse.urljoin(base, 'https:' + u if u.startswith('//') else u)
html = get(url); open(os.path.join(out, 'raw', 'index.html'), 'w').write(html)
css_urls = sorted({absu(m, url) for m in re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"', html)})
css = ''; fonts = set()
FONT_RE = r'url\(["\']?([^"\')]+\.(?:woff2|woff|ttf|otf))'
for cu in css_urls[:12]:
    c = get(cu); css += c; fonts |= {absu(u, cu) for u in re.findall(FONT_RE, c)}
inline_css = ''.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S)); css += inline_css
fonts |= {absu(u, url) for u in re.findall(FONT_RE, inline_css + html)}
stems = {f.rsplit('.', 1)[0] for f in fonts if f.endswith('.woff2')}
fonts = sorted(f for f in fonts if f.endswith('.woff2') or f.rsplit('.', 1)[0] not in stems)
open(os.path.join(out, 'raw', 'all.css'), 'w').write(css)
assets = sorted({absu(u, url) for u in re.findall(r'["\'(]((?:https?:)?//[^"\')\s]+\.svg|/[^"\')\s]+\.svg)', html + css)})
saved = []
for u in fonts[:24] + assets[:40]:
    fn = os.path.join(out, 'raw', os.path.basename(urllib.parse.urlparse(u).path))
    b = get(u, True)
    if b: open(fn, 'wb').write(b); saved.append(fn)
colors = Counter(c.lower() for c in re.findall(r'#[0-9a-fA-F]{6}\b', css))
symbols = {}
for fn in saved:
    if fn.endswith('.svg'):
        s = open(fn, errors='replace').read(); ids = re.findall(r'<symbol[^>]*\bid="([^"]+)"', s)
        if ids: symbols[os.path.basename(fn)] = ids
inline = re.findall(r'<symbol[^>]*\bid="([^"]+)"', html)
info = {
    'url': url, 'title': (re.findall(r'<title[^>]*>(.*?)</title>', html, re.S) or [''])[0].strip(),
    'description': (re.findall(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', html) or [''])[0],
    'headings': [re.sub('<[^>]+>', '', h).strip() for h in re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.S)][:40],
    'fonts': fonts, 'svgs': assets, 'sprite_symbols': symbols, 'inline_symbols': inline,
    'logo_candidates': [a for a in assets if re.search(r'logo|crest|badge|brand|mark|emblem|icon', a, re.I)],
    'top_colors': colors.most_common(20), 'saved': saved,
}
json.dump(info, open(os.path.join(out, 'scan.json'), 'w'), indent=1)
print(json.dumps({k: (v if k not in ('headings', 'svgs', 'saved') else len(v)) for k, v in info.items()}, indent=1)[:4000])

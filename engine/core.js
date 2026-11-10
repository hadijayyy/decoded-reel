// ============================================================
// Decoded engine — core helpers (pure functions of time, Canvas 2D)
// Globals injected by build.py: CFG (project.json), LOGOPATHS, ICONDATA
// ============================================================
const W = 1920, H = 1080, FPS = CFG.fps || 60;
const TS = (CFG.bpm || 120) / 120;           // templates are authored at 120 BPM (1 bar = 2 s)
const BAR = 2 / TS;

// palette: keys from project.json; any value may also be a raw hex
const PAL = Object.assign({ bg: '#181733', ink: '#0b0b14', paper: '#ffffff', a1: '#004b95', a2: '#a4234b', a3: '#e2b900', a4: '#ffdf00', a5: '#db2f36' }, CFG.palette || {});
const col = k => (k && k[0] === '#') || (k && k.startsWith('rgb')) ? k : (PAL[k] || k || '#ffffff');

let ctx;
let VIEW = new DOMMatrix();

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const expo = (x, k = 6) => { x = clamp(x); return (1 - Math.exp(-k * x)) / (1 - Math.exp(-k)); };
const ein = (x, p = 3) => Math.pow(clamp(x), p);
const eio = x => { x = clamp(x); return x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; };
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const decay = (u, k = 14) => u < 0 ? 0 : Math.exp(-u * k);

function hex2rgb(h) { if (h.startsWith('rgb')) return h.match(/[\d.]+/g).slice(0, 3).map(Number); const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, x) { const A = hex2rgb(col(a)), B = hex2rgb(col(b)); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(x)))).join(',')})`; }
function rgba(h, a) { const [r, g, b] = hex2rgb(col(h)); return `rgba(${r},${g},${b},${a})`; }

function fillRect(x, y, w, h, c) { ctx.fillStyle = col(c); ctx.fillRect(x, y, w, h); }
function circ(x, y, r, c) { if (r <= 0) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col(c); ctx.fill(); }
function line(x1, y1, x2, y2, c, w = 2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = col(c); ctx.lineWidth = w; ctx.stroke(); }

// font roles: FD display (condensed, bold), FX heavy (wordmark), FS ui (semibold), FR body (regular)
function setFont(f, s, ls = 0) { ctx.font = `${s}px ${f}`; ctx.letterSpacing = ls + 'px'; }
function tw(s, f, size, ls = 0) { setFont(f, size, ls); return ctx.measureText(s).width; }
function tx(s, x, y, f, size, c, al = 'l', ls = 0) {
  setFont(f, size, ls); ctx.fillStyle = col(c); ctx.textBaseline = 'alphabetic';
  ctx.textAlign = al === 'c' ? 'center' : al === 'r' ? 'right' : 'left';
  ctx.fillText(s, x, y); ctx.textAlign = 'left';
}
// per-character masked rise. o: {t, t0, st, dur, al, ls, out, outDur}
function rise(s, x, y, f, size, c, o) {
  if (!s) return;
  const st = o.st ?? 0.022, dur = o.dur ?? 0.5;
  if (o.t < o.t0) return;
  setFont(f, size, o.ls || 0);
  const wTot = ctx.measureText(s).width;
  const x0 = o.al === 'c' ? x - wTot / 2 : o.al === 'r' ? x - wTot : x;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - size, y - size * 1.08, wTot + size * 2, size * 1.4); ctx.clip();
  ctx.fillStyle = col(c); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let acc = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]; const cx = x0 + ctx.measureText(acc).width; acc += ch;
    if (ch === ' ') continue;
    const e = expo((o.t - (o.t0 + i * st)) / dur, 7);
    if (e <= 0.001) continue;
    let dy = (1 - e) * size * 1.15;
    if (o.out != null) { const a = o.out + i * st * 0.6; dy -= ein(seg(o.t, a, a + (o.outDur ?? 0.35)), 3) * size * 1.2; }
    ctx.fillText(ch, cx, y + dy);
  }
  ctx.restore();
}
function num(str, x, y, f, size, c, al = 'c') {
  setFont(f, size, 0); const cw = ctx.measureText('0').width;
  const widths = [...str].map(ch => /[0-9]/.test(ch) ? cw : ctx.measureText(ch).width);
  const tot = widths.reduce((a, b) => a + b, 0);
  let cx = al === 'c' ? x - tot / 2 : al === 'r' ? x - tot : x;
  ctx.fillStyle = col(c); ctx.textAlign = 'center';
  [...str].forEach((ch, i) => { ctx.fillText(ch, cx + widths[i] / 2, y); cx += widths[i]; });
  ctx.textAlign = 'left'; return tot;
}
// shrink a font size so `s` fits in maxW
function fit(s, f, size, maxW, ls = 0) { if (!s) return size; const w = tw(s, f, size, ls); return w > maxW ? size * maxW / w : size; }
function fmt(n, sep = ',') { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep); }

// ---------- logo (official vector, split into parts) ----------
// CFG.logo: { viewBox:[w,h], center:[cx,cy], outline:i, inner:i, frame:[items], parts:{name:{pivot,draw:[items]}}, order:[...] }
// item: {i:pathIndex, fill?, clip?:[x,y,w,h]} | {circle:[x,y,r], fill}
const LG = CFG.logo;
let CP = [], CF = [];
const LCX = LG.center[0], LCY = LG.center[1], LVH = LG.viewBox[1];
let FILL_OVERRIDE = null;
function drawItem(it) {
  if (it.circle) { ctx.beginPath(); ctx.arc(it.circle[0], it.circle[1], it.circle[2], 0, Math.PI * 2); ctx.fillStyle = FILL_OVERRIDE || col(it.fill || '#000'); ctx.fill(); return; }
  if (it.clip) { ctx.save(); ctx.beginPath(); ctx.rect(...it.clip); ctx.clip(); }
  ctx.fillStyle = FILL_OVERRIDE || col(it.fill || CF[it.i]); ctx.fill(CP[it.i]);
  if (it.clip) ctx.restore();
}
function partItems(name) { return name === 'frame' ? LG.frame : LG.parts[name].draw; }
function partPivot(name) { return name === 'frame' ? LG.center : LG.parts[name].pivot; }
const ORDER = ['frame', ...(LG.order || Object.keys(LG.parts))];
const PARTS = ORDER.filter(n => n !== 'frame');
function logoBase(x, y, h) { return new DOMMatrix().translate(x, y).scale(h / LVH).translate(-LCX, -LCY); }
function partM(base, name, p = {}) {
  const [px, py] = partPivot(name);
  return new DOMMatrix().translate(p.sx || 0, p.sy || 0).multiply(base)
    .translate(px + (p.dx || 0), py + (p.dy || 0)).rotate((p.r || 0) * 57.29578).scale(p.s ?? 1).translate(-px, -py);
}
function drawPart(name, m) { ctx.save(); ctx.setTransform(VIEW.multiply(m)); for (const it of partItems(name)) drawItem(it); ctx.restore(); }
function drawPartShadow(name, m, dx, dy, c) {
  ctx.save(); ctx.setTransform(VIEW.multiply(new DOMMatrix().translate(dx, dy)).multiply(m));
  FILL_OVERRIDE = c; for (const it of partItems(name)) drawItem(it); FILL_OVERRIDE = null; ctx.restore();
}
function drawLogo(base, parts = {}) { for (const n of ORDER) { const p = parts[n] || {}; if (p.hide) continue; drawPart(n, partM(base, n, p)); } }
// draw one part standalone, centred on its pivot, scaled so that `unitsToPx` maps logo units to px
function drawPartAt(name, x, y, scale, rot = 0) {
  const [px, py] = partPivot(name);
  drawPart(name, new DOMMatrix().translate(x, y).rotate(rot * 57.29578).scale(scale).translate(-px, -py));
}
// stripes pattern in logo coordinates (matches the logo's own stripes when LG.pattern is set)
const PAT = LG.pattern || { x0: LCX - LG.viewBox[0] / 16, period: LG.viewBox[0] / 8, colors: ['a1', 'a2'] };
function patternStripes() { for (let n = -90; n <= 90; n++) fillRect(PAT.x0 + n * PAT.period, -40000, PAT.period + 0.3, 80000, PAT.colors[((n % 2) + 2) % 2]); }

// ---------- icons ----------
let ICONS = {};
function icon(name, xc, ytop, h, c) {
  const I = ICONS[name]; if (!I) return; const s = h / I.vb[3];
  ctx.save(); ctx.translate(xc - I.vb[2] * s / 2, ytop); ctx.scale(s, s); ctx.fillStyle = col(c);
  for (const p of I.p) ctx.fill(p); ctx.restore();
}

// ---------- HUD (editorial micro-type in the corners) ----------
function hud(c, right, bl, br) {
  const Hc = CFG.hud || {}; if (Hc.off) return;
  ctx.save(); ctx.globalAlpha = 0.8;
  tx(Hc.tl || '', 64, 76, 'FS', 19, c, 'l', 3.5);
  tx(right || '', W - 64, 76, 'FS', 19, c, 'r', 3.5);
  tx(bl ?? Hc.bl ?? '', 64, H - 56, 'FS', 19, c, 'l', 3.5);
  tx(br ?? Hc.br ?? '', W - 64, H - 56, 'FS', 19, c, 'r', 3.5);
  ctx.restore();
}

// ---------- geometry probes (run once at init) ----------
const PROBE = document.createElement('canvas').getContext('2d');
// best inscribed point inside path `inI` (logo units), outside paths `notIn`, inside rect `box`
function bestPoint(inI, notIn = [], box = null) {
  const ok = (x, y) => PROBE.isPointInPath(CP[inI], x, y) && !notIn.some(j => PROBE.isPointInPath(CP[j], x, y)) && (!box || (x >= box[0] && y >= box[1] && x <= box[0] + box[2] && y <= box[1] + box[3]));
  const [vw, vh] = LG.viewBox; const step = Math.max(vw, vh) / 220;
  let best = [LCX, LCY], br = -1;
  for (let x = 0; x < vw; x += step) for (let y = 0; y < vh; y += step) {
    if (!ok(x, y)) continue; let r = 0;
    for (let rr = step; rr < vw / 3; rr += step) { let all = true; for (let a = 0; a < 16; a++) if (!ok(x + Math.cos(a / 16 * 6.283) * rr, y + Math.sin(a / 16 * 6.283) * rr)) { all = false; break; } if (!all) break; r = rr; }
    if (r > br) { br = r; best = [x, y]; }
  }
  return best;
}
// largest inscribed point of a text string (for the hook's dive-through-letter)
function textCore(word, size) {
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = `${size}px FD`;
  const w = Math.ceil(g.measureText(word).width) + 20; c.width = Math.ceil(w / 4); c.height = Math.ceil(size * 1.3 / 4);
  g.scale(0.25, 0.25); g.font = `${size}px FD`; g.fillStyle = '#fff'; g.fillText(word, 10, size); const d = g.getImageData(0, 0, c.width, c.height).data;
  const inside = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 128;
  let best = [w / 2, size / 2], br = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (!inside(x, y)) continue; let r = 0;
    for (let rr = 1; rr < 60; rr++) { let all = true; for (let a = 0; a < 12; a++) if (!inside(Math.round(x + Math.cos(a / 12 * 6.283) * rr), Math.round(y + Math.sin(a / 12 * 6.283) * rr))) { all = false; break; } if (!all) break; r = rr; }
    if (r > br) { br = r; best = [x * 4 - 10, y * 4 - size]; }
  }
  return best; // relative to (textX, baseline)
}

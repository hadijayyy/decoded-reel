// ============================================================
// Decoded engine — init, timeline, dispatcher, motion-blur seek
// ============================================================
const cv = document.getElementById('c'); cv.width = W; cv.height = H;
const mctx = cv.getContext('2d');
const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d');
ctx = octx;
LAY = document.createElement('canvas'); LAY.width = W; LAY.height = H; lctx = LAY.getContext('2d');
CP = LOGOPATHS.map(p => new Path2D(p.d)); CF = LOGOPATHS.map(p => p.fill || '#000000');
for (const k in ICONDATA) ICONS[k] = { vb: ICONDATA[k].vb, p: ICONDATA[k].d.map(d => new Path2D(d)) };

// mask start height: big enough that the logo silhouette covers the frame
const MASK_H0 = LG.maskStart || 1.35 * Math.max(W * LVH / LG.viewBox[0], H) * (LVH / LVH);
let DIVE_PT = null; const GLYPH_PT = {}; const PARTBB = {};

// ---------- timeline ----------
const SC = []; let T = 0;
for (const [idx, c] of CFG.timeline.entries()) {
  const s = TPL[c.tpl](c); s.c = c; s.idx = idx; s.t0 = T; s.dur = s.bars * BAR; SC.push(s); T += s.dur;
}
const END = T, HOLD = END - 0.5;

function partBBox(nm) {
  const its = partItems(nm); const [vw, vh] = LG.viewBox; const st = Math.max(vw, vh) / 200;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of its) {
    if (it.circle) { const [cx, cy, r] = it.circle; x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r); continue; }
    for (let x = 0; x <= vw; x += st) for (let y = 0; y <= vh; y += st) {
      if (it.clip && (x < it.clip[0] || y < it.clip[1] || x > it.clip[0] + it.clip[2] || y > it.clip[1] + it.clip[3])) continue;
      if (PROBE.isPointInPath(CP[it.i], x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

function initGeometry() {
  for (const nm of PARTS) PARTBB[nm] = partBBox(nm);
  const dec = CFG.timeline.find(c => c.tpl === 'decode');
  if (dec && dec.dive) DIVE_PT = bestPoint(dec.dive.in, dec.dive.notIn || [], dec.dive.box || null);
  for (const c of CFG.timeline) if (c.tpl === 'glyph' && c.shape && c.shape.startsWith('part:')) {
    const nm = c.shape.slice(5); const its = partItems(nm).filter(i => i.i != null);
    const big = c.zoomItem ?? its[its.length - 1].i; GLYPH_PT[nm] = bestPoint(big, c.zoomNotIn || []);
  }
}

function initMosaic() {
  const mc = CFG.timeline.find(c => c.tpl === 'mosaic'); if (!mc) return;
  const Cn = 64, Rn = 36;
  const mk = () => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; return c; };
  const t1 = mk(), t2 = mk(); const save = ctx;
  ctx = t1.getContext('2d');
  const sc = mc.stripes || PAT.colors; for (let i = 0; i < 8; i++) fillRect(i * 80, 0, 80, 360, sc[i % 2 ? 1 : 0]);
  const lines = mc.lines || ['']; const s = Math.min(170 * 2 / lines.length, ...lines.map(l => 170 * 580 / Math.max(1, tw(l, 'FD', 170))));
  setFont('FD', s); const cap = ctx.measureText('H').actualBoundingBoxAscent; const gap = cap * 0.42; const tot = lines.length * cap + (lines.length - 1) * gap;
  lines.forEach((l, i) => tx(l, 320, 180 - tot / 2 + cap + i * (cap + gap), 'FD', s, mc.textColor || 'a3', 'c'));
  ctx = t2.getContext('2d');
  const fk = mc.faceK || 560 / 1200, lh = mc.logoH || 560;   // faceK: face-on wall scale (wide logos: raise it); logoH: logo height in px
  fillRect(0, 0, 640, 360, mc.cardBg || mix(mc.bg || 'bg', '#ffffff', 0.06)); VIEW = new DOMMatrix(); drawLogo(logoBase(320, 180, lh / (4 * fk)));
  ctx = save;
  const d1 = t1.getContext('2d').getImageData(0, 0, 640, 360).data, d2 = t2.getContext('2d').getImageData(0, 0, 640, 360).data;
  const crowd = mc.crowd || ['#232150', '#232150', '#2c2a5e', '#1d1c45', '#2c2a5e', '#3a1f45', '#183565', '#232150'];
  const cards = [];
  for (let r = 0; r < Rn; r++) for (let c = 0; c < Cn; c++) {
    const id = r * Cn + c, pi = ((r * 10 + 5) * 640 + (c * 10 + 5)) * 4;
    const dn = Math.hypot((c - 31.5) / 31.5, (r - 17.5) / 17.5) / 1.4142;
    cards.push({
      a: hex2rgb(col(crowd[Math.floor(hash(id * 3.1) * crowd.length)])), b: [d1[pi], d1[pi + 1], d1[pi + 2]], c: [d2[pi], d2[pi + 1], d2[pi + 2]],
      d1: dn * 0.85 + (hash(id * 1.3) - 0.5) * 0.14, d2: 2.0 + (c / 63) * 0.85 + (r / 35) * 0.3 + (hash(id * 2.7) - 0.5) * 0.14,
      dr: 5.05 + 0.25 * dn + hash(id * 4.1) * 0.3, jit: 0.94 + hash(id * 7.7) * 0.12,
    });
  }
  MOS = { C: Cn, R: Rn, CELL: 40, CARD: 35, cards, Dface: F / fk };
  FINAL = document.createElement('canvas'); FINAL.width = W; FINAL.height = H;
  ctx = FINAL.getContext('2d'); fillRect(0, 0, W, H, mc.bg || 'bg'); VIEW = new DOMMatrix(); drawLogo(logoBase(960, 540, lh)); ctx = save;
}

function frame(t) {
  let i = SC.length - 1; while (i > 0 && t < SC[i].t0) i--;
  const s = SC[i], u = (t - s.t0) * TS;
  VIEW = new DOMMatrix();
  if (i > 0 && s.tr && u < s.tr) {
    const pv = SC[i - 1]; fillRect(0, 0, W, H, pv.bg); pv.f((t - pv.t0) * TS, pv); VIEW = new DOMMatrix();
    ctx.save(); ctx.beginPath();
    if (s.w === 'down') { const qa = expo(u / (s.tr * 0.8), 5), qm = expo((u - 0.09) / (s.tr - 0.09), 5); fillRect(0, 0, W, H * qa, s.acc); ctx.rect(0, 0, W, H * qm); }
    else if (s.w === 'cols') { for (let c = 0; c < 10; c++) { const q = expo(seg(u, 0.03 * c, 0.03 * c + 0.4), 5); const hh = H * q; ctx.rect(c * 192, c % 2 ? 0 : H - hh, 192, hh); } }
    ctx.clip(); fillRect(0, 0, W, H, s.bg); s.f(u, s); ctx.restore();
  } else { fillRect(0, 0, W, H, s.bg); s.f(u, s); }
  VIEW = new DOMMatrix();
}

const GR = [0, 1, 2].map(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 540; const g = c.getContext('2d'); const im = g.createImageData(960, 540);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; });
function grain(t) {
  const g = CFG.grain ?? 0.07; if (!g) return; const n = Math.floor(t * FPS + 0.5);
  mctx.save(); mctx.globalCompositeOperation = 'overlay'; mctx.globalAlpha = g;
  mctx.drawImage(GR[n % 3], -Math.floor(hash(n) * 400), -Math.floor(hash(n + 7) * 200), 2880, 1620); mctx.restore();
}

window.seek = (t, span, M) => {
  for (let i = 0; i < M; i++) {
    let ti = t + span * ((i + 0.5) / M - 0.5); if (t >= HOLD) ti = HOLD; ti = clamp(ti, 0, END - 0.001);
    ctx = octx; octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over';
    octx.save(); frame(ti); octx.restore();
    mctx.globalAlpha = 1 / (i + 1); mctx.drawImage(off, 0, 0);
  }
  mctx.globalAlpha = 1; grain(t);
};
window.ready = Promise.all(['FD', 'FX', 'FS', 'FR'].map(f => document.fonts.load(`100px ${f}`, 'AÉÇ0123'))).then(() => {
  initGeometry(); initMosaic();
  window.META = { duration: END, fps: FPS, bpm: CFG.bpm || 120, frames: Math.round(END * FPS), segFrames: Math.round(BAR * FPS),
    sections: SC.map(s => ({ tpl: s.c.tpl, t0: s.t0, bars: s.bars })), music: CFG.music || {} };
  window.CUES = SC.flatMap(s => s.cues(s)).sort((a, b) => a.t - b.t);
  return true;
});

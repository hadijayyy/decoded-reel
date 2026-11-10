// ============================================================
// Decoded engine — scene templates
// Each template: TPL.name(c) -> { bars, bg, tr?, w?, acc?, f(u, sc), cues(sc) }
//   u   : scene-local time in 120-BPM seconds (1 bar = 2.0)
//   sc  : the scene record { t0 (absolute s), dur, idx, c }
//   cues: absolute-time audio events consumed by engine/audio.py
// Templates are designed to chain (see references/templates.md for the continuity contract).
// ============================================================
const TPL = {};
let LAY, lctx, FINAL, MOS, HERO = null;
const at = (sc, u) => sc.t0 + u / TS;           // template time -> absolute seconds

// shared: draw the "hero" object (a logo part such as a ball, or a plain disc)
function heroSpec(h) {   // lazy: part bounding boxes are measured at init
  if (h && h.startsWith('part:')) { const n = h.slice(5); return { part: n, get r() { const bb = PARTBB[n]; return Math.max(bb[2], bb[3]) / 2; } }; }
  return { part: null, r: 1 };
}
function drawHero(spec, x, y, R, rot, c = 'a3') {
  if (spec.part) drawPartAt(spec.part, x, y, R / spec.r, rot);
  else { const m = VIEW; const p = m.transformPoint({ x, y }); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); circ(p.x, p.y, R * Math.hypot(m.a, m.b), c); ctx.restore(); }
}

// ------------------------------------------------------------ hook
// Type as a window onto the logo's stripe pattern; dives through the last word.
TPL.hook = c => {
  const words = c.words; const n = words.length; const per = 2 / n; let LS = null;
  const lay = () => {
    if (LS) return LS; LS = words.map(wd => {
      const w100 = tw(wd, 'FD', 100); const size = Math.min(860, 1640 / w100 * 100);
      setFont('FD', size); const cap = ctx.measureText('H').actualBoundingBoxAscent; const w = ctx.measureText(wd).width;
      return { size, w, x0: 960 - w / 2, base: 540 + cap / 2, cap };
    });
    const L = LS[n - 1]; const core = textCore(words[n - 1], L.size); L.P = [L.x0 + core[0], L.base + core[1]]; return LS;
  };
  return {
    bars: 1, bg: c.bg || 'bg',
    f(u) {
      const L = lay(); const wi = Math.min(n - 1, Math.floor(u / per)), wu = u - wi * per, wd = words[wi], l = L[wi];
      const P = wi === n - 1 ? l.P : [960, 540];
      const z = Math.exp(ein(seg(u, 1.6, 2.0), 2.7) * Math.log(90));
      const pop = wi === 0 ? 1 : 1 + 0.07 * (1 - expo(wu / 0.32, 6));
      const o = -260 * (2 - u) * (1 - eio(seg(u, 1.4, 2.0)));
      const k = lerp(150 / PAT.period, MASK_H0 / LVH, eio(seg(u, 1.5, 2.0)));
      const main = ctx; ctx = lctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
      ctx.setTransform(new DOMMatrix().translate(P[0], P[1]).scale(z * pop).translate(-P[0], -P[1]));
      tx(wd, l.x0, l.base, 'FD', l.size, '#fff');
      ctx.setTransform(new DOMMatrix().translate(960 + o, 540).scale(k).translate(-LCX, -LCY)); ctx.globalCompositeOperation = 'source-atop';
      patternStripes();
      ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx = main; ctx.drawImage(LAY, 0, 0);
      hud(c.hudColor || '#fff', c.hud || '00 / 05');
    },
    cues(sc) {
      const q = [{ t: at(sc, 0), k: 'boom', a: 0.9 }, { t: at(sc, 0), k: 'groove', t1: at(sc, 2), hat: 0.08, bass: 0.28 }];
      words.forEach((w, i) => q.push({ t: at(sc, i * per), k: 'stab', a: 0.33, up: [0, 3, 5, 7, 10, 12][i % 6] }));
      q.push({ t: at(sc, 1.55), k: 'whoosh', d: 0.47, a: 0.35, f0: 200, f1: 6000, rise: 0.92 });
      return q;
    },
  };
};

// ------------------------------------------------------------ decode
// Logo-shaped mask lands over the stripes, parts land, explode into a labelled diagram, dive into one part.
TPL.decode = c => {
  const sweepParts = c.sweep || [];
  const landParts = PARTS.filter(p => !sweepParts.includes(p));
  const land = Object.assign({}, ...landParts.map((p, i) => ({ [p]: 0.56 + 0.08 * i })), c.land || {});
  const expl = c.explode || {};
  const labels = c.labels || {};
  const H1 = c.size || 540;
  return {
    bars: 1, bg: c.bg || 'bg',
    f(u) {
      const e = expo(seg(u, 0, 0.55), 4.2);
      const ex = eio(seg(u, 0.95, 1.42));
      const h = Math.exp(lerp(Math.log(MASK_H0), Math.log(H1), e)) * lerp(1, 0.86, ex);
      const base = logoBase(960, 540 - 40 * ex, h);
      const parts = {};
      ORDER.forEach((nm, idx) => {
        const lt = land[nm] ?? 0; const el = expo(seg(u, lt, lt + 0.2), 6);
        const pv = partPivot(nm); const dflt = [(pv[0] - LCX) / LVH * 900, (pv[1] - LCY) / LVH * 700, 0];
        const [ox, oy, orr] = nm === 'frame' ? [0, 0, 0] : (expl[nm] || dflt);
        const exn = nm === 'frame' ? 0 : eio(seg(u, 0.95 + 0.03 * idx, 1.42 + 0.03 * idx));
        parts[nm] = { sx: ox * exn, sy: oy * exn, r: orr * exn, s: nm in land ? lerp(1.6, 1, el) : 1, hide: nm in land && u < lt, exn };
      });
      let Pc = { x: 960, y: 540 };
      if (DIVE_PT) Pc = partM(base, c.dive.part, parts[c.dive.part]).transformPoint({ x: DIVE_PT[0], y: DIVE_PT[1] });
      const zoom = DIVE_PT ? Math.exp(ein(seg(u, 1.55, 2.0), 2.4) * Math.log(320)) : 1;
      VIEW = new DOMMatrix().translate(Pc.x, Pc.y).scale(zoom).translate(-Pc.x, -Pc.y);
      const sweep = lerp(-10, LG.viewBox[1] * 1.06, eio(seg(u, 0.36, 0.62)));
      if (sweep < LG.viewBox[1]) { ctx.save(); ctx.setTransform(VIEW.multiply(base)); ctx.fillStyle = col(CF[LG.outline] || '#000'); ctx.fill(CP[LG.outline]); ctx.clip(CP[LG.inner]); patternStripes(); ctx.restore(); }
      if (sweep > -10) {
        ctx.save();
        if (sweep < LG.viewBox[1] * 1.05) { ctx.setTransform(VIEW.multiply(base)); ctx.beginPath(); ctx.rect(-50, -50, LG.viewBox[0] + 100, sweep + 50); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(); }
        if (ex > 0) {
          ctx.save(); ctx.setTransform(VIEW.multiply(partM(base, 'frame', parts.frame)));
          ctx.fillStyle = mix(CF[LG.outline] || '#000', c.ghostLine || 'a3', ex); ctx.fill(CP[LG.outline]);
          ctx.fillStyle = mix(CF[LG.inner], c.ghostFill || mix(c.bg || 'bg', '#ffffff', 0.05), ex); ctx.fill(CP[LG.inner]);
          ctx.restore();
        } else drawPart('frame', partM(base, 'frame', parts.frame));
        for (const nm of sweepParts) { const p = parts[nm]; if (p.exn > 0) drawPartShadow(nm, partM(base, nm, p), 10 * p.exn, 18 * p.exn, 'rgba(0,0,0,0.35)'); drawPart(nm, partM(base, nm, p)); }
        ctx.restore();
      }
      for (const nm of landParts) {
        const p = parts[nm]; if (p.hide) continue;
        const lift = Math.max((p.s - 1) / 0.6, p.exn);
        if (lift > 0.002) drawPartShadow(nm, partM(base, nm, { ...p, s: 1 }), 10 * lift, 18 * lift, 'rgba(0,0,0,0.35)');
        drawPart(nm, partM(base, nm, p));
      }
      if (u > 1.1) {
        ctx.save(); ctx.setTransform(VIEW);
        Object.entries(labels).forEach(([nm, [no, title, lx, ly]], i) => {
          const [px, py] = partPivot(nm); const q = partM(base, nm, parts[nm]).transformPoint({ x: px, y: py });
          rise(no, q.x + lx, q.y + ly - 40, 'FS', 20, c.labelNo || 'a3', { t: u, t0: 1.16 + i * 0.035, ls: 4, al: 'c' });
          rise(title, q.x + lx, q.y + ly + 8, 'FD', 46, c.labelColor || '#fff', { t: u, t0: 1.19 + i * 0.035, st: 0.012, al: 'c' });
        });
        ctx.restore();
      }
      VIEW = new DOMMatrix();
      hud(c.hudColor || '#fff', c.hud || '00 / 05');
    },
    cues(sc) {
      const q = [{ t: at(sc, 0), k: 'boom', a: 0.6, d: 1.4 }, { t: at(sc, 0), k: 'kick', a: 0.9 },
      { t: at(sc, -0.02), k: 'whoosh', d: 0.55, a: 0.2, f0: 5000, f1: 300, rise: 0.1 },
      { t: at(sc, 0.5), k: 'groove', t1: at(sc, 2), hat: 0.09, bass: 0.3, clap: 0.4 },
      { t: at(sc, 0.36), k: 'whoosh', d: 0.3, a: 0.16, f0: 800, f1: 6000, rise: 0.5 },
      { t: at(sc, 1.0), k: 'motif', a: 0.22, mode: 'minor' },
      { t: at(sc, 0.92), k: 'whoosh', d: 0.6, a: 0.22, f0: 400, f1: 3000, rise: 0.4, p0: -0.6, p1: 0.6 }];
      Object.values(land).forEach((lt, i) => { q.push({ t: at(sc, lt + 0.18), k: 'tom', n: [0, 3, 7, 10, 12, 15][i % 6], a: 0.4, d: 0.3 }); q.push({ t: at(sc, lt + 0.18), k: 'tick', a: 0.25, f: 3000 }); });
      Object.keys(labels).forEach((l, i) => q.push({ t: at(sc, 1.19 + i * 0.035), k: 'pluck', n: 31 + [0, 2, 3, 5, 7, 10][i % 6], a: 0.12, d: 0.25, pan: -0.5 + i * 0.25 }));
      if (c.dive) q.push({ t: at(sc, 1.5), k: 'whoosh', d: 0.52, a: 0.42, f0: 150, f1: 9000, rise: 0.96 });
      return q;
    },
  };
};

// ------------------------------------------------------------ glyph
// One bold shape (a plus, or a logo part) grows on the right, title on the left, then the shape zooms to fill the frame.
TPL.glyph = c => {
  const shape = c.shape || 'plus';
  return {
    bars: 1, bg: c.bg || 'paper',
    f(u) {
      const cx = c.x || 1300, cy = c.y || 540;
      const z = Math.exp(ein(seg(u, 1.5, 2.0), 2.6) * Math.log(c.zoom || 20));
      const sh = 16 * (1 - seg(u, 1.5, 1.7));
      if (shape === 'plus') {
        const T = c.thick || 150, Lh = c.size || 740; const ev = expo(seg(u, 0, 0.4), 6), eh = expo(seg(u, 0.5, 0.88), 6);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z);
        ctx.fillStyle = col(c.shadow || mix(c.bg || 'paper', '#000', 0.08));
        ctx.fillRect(-T / 2 + sh, -Lh / 2 * ev + sh, T, Lh * ev); if (eh > 0) ctx.fillRect(-Lh / 2 * eh + sh, -T / 2 + sh, Lh * eh, T);
        ctx.fillStyle = col(c.color || 'a5');
        ctx.fillRect(-T / 2, -Lh / 2 * ev, T, Lh * ev); if (eh > 0) ctx.fillRect(-Lh / 2 * eh, -T / 2, Lh * eh, T);
        ctx.restore();
      } else {
        const nm = shape.slice(5); const bb = PARTBB[nm]; const s0 = (c.size || 640) / Math.max(bb[2], bb[3]);
        const g = expo(seg(u, 0, 0.5), 6); const zp = GLYPH_PT[nm] || partPivot(nm);
        const m = new DOMMatrix().translate(cx, cy).scale(z).rotate((1 - g) * -12).scale(s0 * g).translate(-zp[0], -zp[1]);
        if (g > 0.001) { drawPartShadow(nm, m, sh, sh, c.shadow || 'rgba(0,0,0,0.12)'); drawPart(nm, m); }
      }
      const tc = c.textColor || 'ink';
      rise(c.tag, 140, 400, 'FS', 24, c.tagColor || 'a5', { t: u, t0: 0.15, ls: 5, st: 0.012, out: 1.1 });
      rise(c.title, 140, 640, 'FD', fit(c.title, 'FD', c.titleSize || 250, (shape === 'plus' ? cx - (c.size || 740) / 2 : cx - (c.size || 640) / 2) - 200), tc, { t: u, t0: 0.22, st: 0.03, out: 1.12 });
      (c.sub || []).forEach((s, i) => rise(s, 144, 720 + i * 48, 'FR', 38, c.subColor || mix(tc, c.bg || 'paper', 0.3), { t: u, t0: 0.42 + i * 0.06, st: 0.008, out: 1.16 + i * 0.02 }));
      hud(c.hudColor || tc, c.hud || '');
    },
    cues(sc) {
      return [{ t: at(sc, 0), k: 'boom', a: 0.55, d: 1.2 }, { t: at(sc, 0), k: 'groove', t1: at(sc, 2), hat: 0.09, bass: 0.3 },
      { t: at(sc, 0), k: 'stab', a: 0.32 }, { t: at(sc, 0.5), k: 'stab', a: 0.3, up: 5 }, { t: at(sc, 0), k: 'pad', d: 1.8, a: 0.08 },
      { t: at(sc, 1.5), k: 'whoosh', d: 0.5, a: 0.38, f0: 200, f1: 7000, rise: 0.95 }];
    },
  };
};

// ------------------------------------------------------------ bars
// Full-frame colour splits into N bars, the bars compress into a block on the right and "press" on sixteenths.
TPL.bars = c => {
  const N = c.n || 4;
  return {
    bars: 1, bg: c.bg || 'a4',
    f(u) {
      const bc = c.barColor || 'a5';
      const k = eio(seg(u, 0.5, 1.02));
      const bx0 = lerp(-2, 1060, k), bx1 = lerp(1922, 1780, k), by0 = lerp(-2, 160, k), by1 = lerp(1082, 920, k);
      const sw = (bx1 - bx0) / (2 * N + 1); const mid = N / 2;
      const gw = [...Array(N + 1)].map((_, g) => sw * expo(seg(u, 0.06 * Math.abs(g - mid), 0.06 * Math.abs(g - mid) + 0.42), 5));
      const gc = g => bx0 + (2 * g + 0.5) * sw;
      const exitE = ein(seg(u, 1.55, 1.95), 2.6);
      const lw = gc(0) - gw[0] / 2 - bx0; if (lw > 0.01) fillRect(bx0, by0, lw, by1 - by0, bc);
      const rw = bx1 - (gc(N) + gw[N] / 2); if (rw > 0.01) fillRect(bx1 - rw, by0, rw, by1 - by0, bc);
      for (let j = 0; j < N; j++) {
        const x0 = gc(j) + gw[j] / 2, x1 = gc(j + 1) - gw[j + 1] / 2;
        const tp = 1.0 + (0.5 / N) * j;
        const press = u > tp ? 28 * Math.sin(Math.PI * clamp((u - tp) / 0.2)) : 0;
        fillRect(x0, by0 + press + exitE * 1300 * (j % 2 ? -1 : 1), x1 - x0, by1 - by0, bc);
      }
      const tc = c.textColor || 'ink';
      rise(c.tag, 140, 400, 'FS', 24, c.tagColor || tc, { t: u, t0: 0.62, ls: 5, st: 0.012, out: 1.45 });
      rise(c.title, 140, 640, 'FD', fit(c.title, 'FD', c.titleSize || 250, 860), tc, { t: u, t0: 0.68, st: 0.03, out: 1.48 });
      (c.sub || []).forEach((s, i) => rise(s, 144, 720 + i * 48, 'FR', 38, c.subColor || mix(tc, c.bg || 'a4', 0.3), { t: u, t0: 0.86 + i * 0.06, st: 0.008, out: 1.52 + i * 0.02 }));
      hud(c.hudColor || tc, c.hud || '');
    },
    cues(sc) {
      const q = [{ t: at(sc, 0), k: 'boom', a: 0.5, d: 1.2 }, { t: at(sc, 0), k: 'whoosh', d: 0.45, a: 0.2, f0: 6000, f1: 1200, rise: 0.08 },
      { t: at(sc, 0), k: 'groove', t1: at(sc, 2), hat: 0.1, bass: 0.3 }, { t: at(sc, 0.48), k: 'whoosh', d: 0.5, a: 0.18, f0: 300, f1: 2500, rise: 0.5 },
      { t: at(sc, 1.5), k: 'whoosh', d: 0.5, a: 0.3, f0: 300, f1: 5000, rise: 0.9 }];
      for (let j = 0; j < N; j++) { const n = [0, 3, 7, 12, 15, 19][j % 6]; q.push({ t: at(sc, 1.0 + (0.5 / N) * j), k: 'tom', n: n, a: 0.55, d: 0.35 }); q.push({ t: at(sc, 1.0 + (0.5 / N) * j), k: 'pluck', n: n + 12, a: 0.18, pan: -0.4 + 0.8 * j / Math.max(1, N - 1) }); }
      return q;
    },
  };
};

// ------------------------------------------------------------ slam
// Big letters slam in on the beat (font text, or letters cut from a logo path) + an odometer that rolls a number.
TPL.slam = c => {
  let LET = null;
  const prep = () => {
    if (LET) return LET;
    if (c.logoLetters) {
      const { path, band } = c.logoLetters; const cols = [];
      for (let x = 0; x <= LG.viewBox[0]; x += 0.5) { let on = false; for (let y = band[0]; y <= band[1]; y += 1) if (PROBE.isPointInPath(CP[path], x, y)) { on = true; break; } cols.push([x, on]); }
      const runs = []; let st = null; for (const [x, on] of cols) { if (on && st === null) st = x; if (!on && st !== null) { runs.push([st, x]); st = null; } }
      let y0 = 1e9, y1 = -1e9; for (let y = band[0]; y <= band[1]; y += 0.5) for (let x = runs[0][0]; x <= runs[runs.length - 1][1]; x += 1) if (PROBE.isPointInPath(CP[path], x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      LET = { mode: 'logo', path, runs, y0, y1 };
    } else {
      const t = c.text || 'ABC'; const size0 = 400; setFont('FD', size0); const gap = size0 * 0.22;
      const ws = [...t].map(ch => ctx.measureText(ch).width); const tot = ws.reduce((a, b) => a + b, 0) + gap * (t.length - 1);
      const cap = ctx.measureText('H').actualBoundingBoxAscent; const s = Math.min(1480 / tot, 330 / cap);
      LET = { mode: 'text', chars: [...t], ws: ws.map(w => w * s), gap: gap * s, size: size0 * s, cap: cap * s, tot: tot * s };
    }
    return LET;
  };
  const times = n => [...Array(n)].map((_, i) => 0.5 + i * (n <= 3 ? 0.25 : 0.5 / (n - 1)));
  return {
    bars: 1, bg: c.bg || 'a3', tr: 0.62, w: 'down', acc: c.wipeAccent || 'a5',
    f(u) {
      const L = prep(); const n = L.mode === 'logo' ? L.runs.length : L.chars.length; const TL = times(n);
      let shake = 0; TL.forEach(tl => { if (u > tl) shake += 9 * decay(u - tl, 11) * Math.sin((u - tl) * 70); });
      const ink = c.color || 'ink', shd = c.shadow || mix(c.bg || 'a3', '#000', 0.13);
      for (const pass of [0, 1]) for (let i = 0; i < n; i++) {
        const tl = TL[i]; if (u < tl - 0.24) continue;
        const d = ein(seg(u, tl - 0.24, tl), 2.2); const off = pass === 0 ? 14 : 0; const dy = 350 + shake + off - (1 - d) * 1100;
        if (L.mode === 'logo') {
          const lw = L.runs[n - 1][1] - L.runs[0][0], lh = L.y1 - L.y0; const s = Math.min(1480 / lw, 320 / lh);
          const lcx = (L.runs[0][0] + L.runs[n - 1][1]) / 2, lcy = (L.y0 + L.y1) / 2;
          ctx.save(); ctx.setTransform(new DOMMatrix().translate(960 + off, dy).scale(s).translate(-lcx, -lcy));
          ctx.beginPath(); ctx.rect(L.runs[i][0] - 1, L.y0 - 1, L.runs[i][1] - L.runs[i][0] + 2, L.y1 - L.y0 + 2); ctx.clip();
          ctx.fillStyle = col(pass === 0 ? shd : ink); ctx.fill(CP[L.path]); ctx.restore();
        } else {
          let x = 960 - L.tot / 2; for (let j = 0; j < i; j++) x += L.ws[j] + L.gap;
          tx(L.chars[i], x + off, dy + L.cap / 2, 'FD', L.size, pass === 0 ? shd : ink);
        }
      }
      const od = c.odometer;
      if (od && u > 1.0) {
        const size = 170, base = 790 + shake * 0.4;
        setFont('FD', size); const pre = od.prefix || ''; const wp = ctx.measureText(pre).width, cw = ctx.measureText('0').width;
        const nd = String(Math.max(od.from, od.to)).length; const tot = wp + cw * nd, x0 = 960 - tot / 2;
        rise(pre, x0, base, 'FD', size, ink, { t: u, t0: 1.02, st: 0.02 });
        const ee = expo(seg(u, 1.06, 1.35), 6); const v = lerp(od.from, od.to, eio(seg(u, 1.08, 1.78)));
        const cap = size * 0.74, lh2 = size * 0.92;
        ctx.save(); ctx.beginPath(); ctx.rect(x0 + wp - 4, base - cap - 18, cw * nd + 8, cap + 34); ctx.clip();
        setFont('FD', size); ctx.fillStyle = col(ink); ctx.textAlign = 'center';
        for (let k = nd - 1; k >= 0; k--) {
          const p = Math.pow(10, k); const dd = Math.floor(v / p) % 10; const f = k === 0 ? v - Math.floor(v) : clamp((v % p) - (p - 1));
          const cx = x0 + wp + (nd - 1 - k) * cw + cw / 2; const dy = (1 - ee) * size;
          ctx.fillText(String(dd), cx, base - f * lh2 + dy); ctx.fillText(String((dd + 1) % 10), cx, base + (1 - f) * lh2 + dy);
        }
        ctx.restore(); ctx.textAlign = 'left';
      }
      rise(c.caption, 960, 878, 'FR', 38, c.captionColor || rgba(ink, 0.78), { t: u, t0: 1.3, st: 0.008, al: 'c' });
      hud(c.hudColor || ink, c.hud || '');
    },
    cues(sc) {
      const n = c.logoLetters ? 3 : (c.text || 'ABC').length; const TL = times(n);
      const q = [{ t: at(sc, -0.05), k: 'whoosh', d: 0.55, a: 0.28, f0: 4000, f1: 400, rise: 0.15 }, { t: at(sc, 0), k: 'groove', t1: at(sc, 2), hat: 0.08, bass: 0.28, clap: 0.3 }];
      TL.forEach((tl, i) => { q.push({ t: at(sc, tl), k: 'boom', a: 0.5, d: 1.0 }); q.push({ t: at(sc, tl), k: 'kick', a: 0.85 }); q.push({ t: at(sc, tl), k: 'stab', a: 0.32, up: [0, 2, 3, 5, 7, 8, 10][i % 7] }); });
      if (c.odometer) { q.push({ t: at(sc, 1.08), k: 'ticks', t1: at(sc, 1.78), a: 0.13, f0: 5000, f1: 2500, curve: 'decel' }); q.push({ t: at(sc, 1.06), k: 'whoosh', d: 0.75, a: 0.15, f0: 3000, f1: 500, rise: 0.3 }); }
      return q;
    },
  };
};

// ------------------------------------------------------------ count
// Stripes become a field of dots (people/users/items), a big counter counts up, one dot becomes the hero object.
TPL.count = c => {
  const cols = c.colors || PAT.colors; const hero = heroSpec(c.hero || 'dot'); const D = { i: 19, j: 18, x: 24 + 48 * 19, y: 540 + 7 * 48 };
  return {
    bars: 2, bg: c.bg || 'bg', tr: 0.7, w: 'cols',
    f(u, sc) {
      HERO = hero;
      const e = expo(seg(u, 0.32, 1.25), 4);
      const holeOn = expo(seg(u, 0.35, 1.0), 5) * (1 - expo(seg(u, 3.0, 3.6), 4));
      const zz = seg(u, 3.15, 4.0); const zs = Math.exp(ein(zz, 2.6) * Math.log(26)); const zt = eio(zz);
      const vm = new DOMMatrix().translate(lerp(D.x, 960, zt), lerp(D.y, 540, zt)).scale(zs).translate(-D.x, -D.y);
      ctx.save(); ctx.setTransform(vm);
      for (let i = 0; i < 40; i++) for (let j = 0; j < 23; j++) {
        const x = 24 + 48 * i, y = 540 + (j - 11) * 48;
        const X = vm.a * x + vm.e, Y = vm.d * y + vm.f; if (X < -60 * zs || X > W + 60 * zs || Y < -60 * zs || Y > H + 60 * zs) continue;
        const special = (i === D.i && j === D.j); if (special && u > 2.6) continue;
        let sz = lerp(48.6, 30, e);
        if (!special) { sz *= 1 + 0.16 * e * Math.sin(x * 0.011 + y * 0.007 - u * 5); const d = Math.hypot((x - 960) / 780, (y - 575) / 330); sz *= lerp(1, smooth(0.72, 1.12, d), holeOn); }
        if (sz < 0.6) continue;
        ctx.beginPath(); ctx.roundRect(x - sz / 2, y - sz / 2, sz, sz, sz / 2 * e); ctx.fillStyle = col(cols[Math.floor(x / 192) % 2]); ctx.fill();
      }
      ctx.restore();
      if (u > 2.6) { VIEW = vm; drawHero(hero, D.x, D.y, 15 * (1 + 0.7 * decay(u - 2.6, 9)), at(sc, u) * 2.4, c.heroColor); VIEW = new DOMMatrix(); }
      if (u > 0.4) {
        const cv = c.value * expo(seg(u, 0.42, 1.65), 4.2); const ent = expo(seg(u, 0.4, 0.8), 6), ex = ein(seg(u, 3.0, 3.3), 3);
        ctx.save(); ctx.beginPath(); ctx.rect(200, 330, 1520, 270); ctx.clip();
        const full = (c.prefix || '') + fmt(c.value, c.sep || ',') + (c.suffix || '');
        num((c.prefix || '') + fmt(cv, c.sep || ',') + (c.suffix || ''), 960, 570 + (1 - ent) * 260 - ex * 280, 'FD', fit(full, 'FD', c.size || 300, 1500), c.numColor || '#fff'); ctx.restore();
      }
      const lc = c.labelColor || 'a3', cc = c.captionColor || 'rgba(255,255,255,0.72)';
      rise(c.label, 960, 690, 'FD', 100, lc, { t: u, t0: 0.62, al: 'c', ls: 4, out: c.label2 ? 1.8 : 3.0 });
      rise(c.label2, 960, 690, 'FD', 100, lc, { t: u, t0: 2.02, al: 'c', ls: 4, out: 3.0 });
      rise(c.caption, 960, 752, 'FR', 32, cc, { t: u, t0: 0.85, al: 'c', st: 0.006, out: c.caption2 ? 1.78 : 3.02 });
      rise(c.caption2, 960, 752, 'FR', 32, cc, { t: u, t0: 2.28, al: 'c', st: 0.008, out: 3.02 });
      hud(c.hudColor || '#fff', c.hud || '');
    },
    cues(sc) {
      const q = [{ t: at(sc, -0.05), k: 'whoosh', d: 0.35, a: 0.12, f0: 400, f1: 3000, rise: 0.6 }, { t: at(sc, 0), k: 'groove', t1: at(sc, 4), hat: 0.1, bass: 0.32, clap: 0.5 },
      { t: at(sc, 0), k: 'pad', d: 3.9 / TS, a: 0.09, cut: 1400 }, { t: at(sc, 0.42), k: 'ticks', t1: at(sc, 1.65), a: 0.1, f0: 5000, f1: 5000, curve: 'expo' },
      { t: at(sc, 2.6), k: 'bell', n: 36, a: 0.25, d: 1.4 }, { t: at(sc, 3.1), k: 'whoosh', d: 0.9, a: 0.32, f0: 200, f1: 8000, rise: 0.95 }, { t: at(sc, 3.2), k: 'riser', d: 0.8, a: 0.15 }];
      if (c.label2) { q.push({ t: at(sc, 2.0), k: 'stab', a: 0.4, up: 7 }); q.push({ t: at(sc, 2.0), k: 'clap', a: 0.6, n: 14 }); }
      return q;
    },
  };
};

// ------------------------------------------------------------ roll
// The hero rolls along a baseline, revealing up to 4 stat columns; then a kicker/title + a list of names.
TPL.roll = c => {
  const hero = heroSpec(c.hero || 'dot'); const stats = c.stats || []; const COLX = [390, 770, 1150, 1530]; const list = c.list || {};
  return {
    bars: 2, bg: c.bg || 'bg',
    f(u, sc) {
      let bx, by, R;
      if (u < 0.5) { const q = expo(u / 0.5, 4.5); bx = lerp(960, 390, q); by = lerp(540, 900, q); R = Math.exp(lerp(Math.log(390), Math.log(46), q)); }
      else { bx = 390 + 1520 * (u - 0.5); by = 900; R = 46; }
      const rot = u < 0.5 ? at(sc, u) * 2.4 : at(sc, 0.5) * 2.4 + 1520 * (u - 0.5) / 46;
      if (u > 0.5) { const x1 = Math.min(bx, 1780); const xo = 140 + ein(seg(u, 2.0, 2.4), 3) * 1700; if (x1 > xo) line(Math.max(390, xo), 946, x1, 946, 'rgba(255,255,255,0.28)', 2); }
      stats.forEach((s, i) => {
        const tc = 0.5 + 0.25 * i; if (u < tc - 0.02) return;
        const ex = -1300 * ein(seg(u, 2.0 + 0.05 * i, 2.38 + 0.05 * i), 3); const e1 = expo(seg(u, tc - 0.02, tc + 0.4), 6);
        ctx.save(); ctx.translate(0, ex);
        if (s.icon) { ctx.save(); ctx.beginPath(); ctx.rect(COLX[i] - 160, 150, 320, 345); ctx.clip(); ctx.translate(0, (1 - e1) * 330); icon(s.icon, COLX[i], 250, 190, c.iconColor || 'a3'); ctx.restore(); }
        const nv = Math.round(s.value * expo(seg(u, tc, tc + 0.42), 5));
        ctx.save(); ctx.beginPath(); ctx.rect(COLX[i] - 190, 440, 380, 230); ctx.clip();
        num((s.prefix || '') + fmt(nv) + (s.suffix || ''), COLX[i], 655 + (1 - e1) * 230, 'FD', s.size || 220, c.numColor || '#fff'); ctx.restore();
        rise(s.label, COLX[i], 718, 'FS', 24, 'rgba(255,255,255,0.7)', { t: u, t0: tc + 0.08, al: 'c', ls: 3, st: 0.01 });
        ctx.restore();
      });
      if (u < 1.9) { VIEW = new DOMMatrix(); drawHero(hero, bx, by, R, rot, c.heroColor); }
      const exL = -1200 * ein(seg(u, 3.5, 3.88), 3), exR = 1200 * ein(seg(u, 3.52, 3.9), 3);
      ctx.save(); ctx.translate(exL, 0);
      rise(list.kicker, 140, 400, 'FS', 30, c.accent || 'a3', { t: u, t0: 2.22, ls: 7, st: 0.015 });
      rise(list.title, 132, 630, 'FD', fit(list.title, 'FD', list.titleSize || 250, 840), '#fff', { t: u, t0: 2.26, st: 0.03 });
      rise(list.caption, 140, 700, 'FR', 36, 'rgba(255,255,255,0.72)', { t: u, t0: 2.42, st: 0.008 });
      ctx.restore();
      ctx.save(); ctx.translate(exR, 0);
      const lp = expo(seg(u, 2.36, 2.8), 5); if (lp > 0 && (list.items || []).length) line(1020, 300, 1020, 300 + 500 * lp, 'rgba(255,255,255,0.3)', 2);
      (list.items || []).forEach((nm, i) => rise(nm, 1090, 380 + i * 110, 'FD', fit(nm, 'FD', 100, 760), '#fff', { t: u, t0: 2.5 + 0.25 * i, st: 0.018 }));
      rise(list.footnote, 1092, 830, 'FS', 24, c.accent || 'a3', { t: u, t0: 3.3, ls: 3, st: 0.008 });
      ctx.restore();
      hud(c.hudColor || '#fff', c.hud || '');
    },
    cues(sc) {
      const q = [{ t: at(sc, 0), k: 'boom', a: 0.55, d: 1.2 }, { t: at(sc, 0), k: 'groove', t1: at(sc, 4), hat: 0.1, bass: 0.32 }, { t: at(sc, 0.5), k: 'kick', a: 1.0 }];
      stats.forEach((s, i) => { const tc = 0.5 + 0.25 * i; q.push({ t: at(sc, tc), k: 'stab', a: 0.34, up: [0, 3, 5, 7][i] }); q.push({ t: at(sc, tc + 0.05), k: 'pluck', n: 24 + [0, 3, 5, 7][i], a: 0.15 }); q.push({ t: at(sc, tc), k: 'ticks', t1: at(sc, tc + 0.36), a: 0.05, f0: 6000, f1: 6000, curve: 'even' }); });
      q.push({ t: at(sc, 1.9), k: 'whoosh', d: 0.5, a: 0.28, f0: 400, f1: 5000, rise: 0.5 });
      (list.items || []).forEach((n, i) => q.push({ t: at(sc, 2.5 + 0.25 * i), k: 'pluck', n: 19 + [0, 3, 7, 12, 15, 19][i % 6], a: 0.22, d: 0.5, pan: -0.4 + 0.27 * i }));
      q.push({ t: at(sc, 3.48), k: 'whoosh', d: 0.5, a: 0.3, f0: 300, f1: 6000, rise: 0.9, p0: -0.7, p1: 0.7 });
      return q;
    },
  };
};

// ------------------------------------------------------------ reassemble
// The parts fly back into the frame on accelerating sixteenths; a type ring orbits; riser into a silent beat.
let RING = null;
TPL.reassemble = c => {
  const fly = {}; const n = PARTS.length;
  PARTS.forEach((p, i) => {
    const pv = partPivot(p); let dx = pv[0] - LCX, dy = pv[1] - LCY; const L = Math.hypot(dx, dy) || 1; if (L < 5) { dx = 1; dy = 0.3; }
    fly[p] = (c.fly && c.fly[p]) || [0.5 + i * Math.min(0.125, 0.5 / n), dx / Math.hypot(dx, dy) * 1700, dy / Math.hypot(dx, dy) * 1200, (i % 2 ? 0.7 : -0.7)];
  });
  return {
    bars: 1, bg: c.bg || 'bg',
    f(u) {
      let punch = 1; for (const k in fly) { const t = fly[k][0]; if (u > t) punch += 0.03 * decay(u - t, 12); }
      const fr = expo(seg(u, 0.0, 0.3), 6); const push = 1 + 0.12 * eio(seg(u, 1.0, 2.0));
      const base = logoBase(960, 540, (c.size || 560) * push * punch);
      VIEW = new DOMMatrix().translate(960, 540).scale(lerp(0.3, 1, fr)).translate(-960, -540);
      drawPart('frame', partM(base, 'frame'));
      for (const nm of PARTS) {
        const [t, fx, fy, fr0] = fly[nm]; if (u < t - 0.32) continue;
        const e = ein(seg(u, t - 0.32, t), 2.4);
        drawPart(nm, partM(base, nm, { sx: fx * (1 - e), sy: fy * (1 - e), r: fr0 * (1 - e), s: lerp(1.3, 1, e) }));
      }
      VIEW = new DOMMatrix();
      if (c.ring && u > 1.02) {
        const Rr = (c.ringRadius || 400) * push; setFont('FS', 24, 7);
        if (!RING) { const unit = c.ring + ' · '; let s = ''; while (ctx.measureText(s + unit).width < 2 * Math.PI * (c.ringRadius || 400) - 10) s += unit; RING = s || unit; }
        const tot = ctx.measureText(RING).width; const sc = 2 * Math.PI * Rr / tot; let acc = ''; const rot = -u * 0.35;
        for (let i = 0; i < RING.length; i++) {
          const ch = RING[i]; const x0 = ctx.measureText(acc).width; acc += ch; if (ch === ' ') continue;
          const p = expo(seg(u, 1.02 + i * 0.006, 1.3 + i * 0.006), 6); if (p <= 0.001) continue;
          const a = rot + (x0 * sc) / Rr - Math.PI / 2;
          ctx.save(); ctx.translate(960 + Math.cos(a) * Rr, 540 + Math.sin(a) * Rr); ctx.rotate(a + Math.PI / 2);
          ctx.fillStyle = `rgba(255,255,255,${0.75 * p})`; ctx.fillText(ch, 0, (1 - p) * 30); ctx.restore();
        }
      }
      hud(c.hudColor || '#fff', c.hud || '');
    },
    cues(sc) {
      const q = [{ t: at(sc, 0), k: 'boom', a: 0.5, d: 1.6 }, { t: at(sc, 0), k: 'pad', d: 1.0 / TS, a: 0.13, cut: 1500, chord: 'iv' }, { t: at(sc, 1.0), k: 'pad', d: 1.75 / TS, a: 0.15, cut: 1800, chord: 'V' }];
      Object.values(fly).forEach(([t, fx], i) => {
        q.push({ t: at(sc, t - 0.3), k: 'whoosh', d: 0.32, a: 0.18, f0: 400, f1: 6000, rise: 0.95, p0: clamp(fx / 1700, -0.8, 0.8), p1: 0 });
        q.push({ t: at(sc, t), k: 'kick', a: 0.7, d: 0.25 }); q.push({ t: at(sc, t), k: 'tick', a: 0.3, f: 3000 }); q.push({ t: at(sc, t), k: 'tom', n: 7 + [0, 2, 4, 5, 7, 9, 11][i % 7], a: 0.35, d: 0.25 });
      });
      q.push({ t: at(sc, 1.0), k: 'motif', a: 0.3, mode: 'minor' });
      if (c.ring) q.push({ t: at(sc, 1.02), k: 'ticks', t1: at(sc, 1.32), a: 0.03, f0: 7000, f1: 7000, curve: 'even', sp: 0.01 });
      q.push({ t: at(sc, 0.95), k: 'riser', d: 0.8, a: 0.45 }); q.push({ t: at(sc, 1.2), k: 'whoosh', d: 0.55, a: 0.25, f0: 300, f1: 10000, rise: 0.98 });
      return q;
    },
  };
};

// ------------------------------------------------------------ mosaic
// The drop: a tilted wall of 64x36 cards flips to a message, then to the logo; camera goes face-on and the cards resolve into the vector logo.
const F = 1400;
TPL.mosaic = c => ({
  bars: 3, bg: c.bg || 'bg',
  f(u) {
    const a = eio(seg(u, 0, 4.0)); let p = lerp(0.62, 0.36, a), q = lerp(-0.34, 0.2, a), D = lerp(1300, 1520, a);
    const b = eio(seg(u, 3.95, 5.05)); p = lerp(p, 0, b); q = lerp(q, 0, b); D = Math.exp(lerp(Math.log(D), Math.log(MOS.Dface), b));
    const cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q);
    const pr = (X, Y, Z) => { const y1 = cp * Y + sp * Z, z1 = -sp * Y + cp * Z; const x2 = X * cq + z1 * sq, z2 = -X * sq + z1 * cq; const zz = D + z2; return [960 + F * x2 / zz, 540 + F * y1 / zz]; };
    const k = F / D, faceOn = u >= 5.05, hc = MOS.CARD / 2;
    for (let r = 0; r < MOS.R; r++) for (let cc = 0; cc < MOS.C; cc++) {
      const cd = MOS.cards[r * MOS.C + cc]; const px = (cc - MOS.C / 2 + 0.5) * MOS.CELL, py = (r - MOS.R / 2 + 0.5) * MOS.CELL;
      if (faceOn && u >= cd.dr) {
        const g = expo(seg(u, cd.dr, cd.dr + 0.14), 6); const half = lerp(hc, MOS.CELL / 2, g) * k; const sx = 960 + px * k, sy = 540 + py * k;
        ctx.drawImage(FINAL, sx - half, sy - half, half * 2, half * 2, sx - half, sy - half, half * 2, half * 2); continue;
      }
      let c0, c1, f;
      if (u >= cd.d2) { c0 = cd.b; c1 = cd.c; f = eio(seg(u, cd.d2, cd.d2 + 0.36)); } else { c0 = cd.a; c1 = cd.b; f = eio(seg(u, cd.d1, cd.d1 + 0.36)); }
      const ph = f * Math.PI, cph = Math.cos(ph), sph = Math.sin(ph); const cr = ph < Math.PI / 2 ? c0 : c1; const br = (0.6 + 0.4 * Math.abs(cph)) * cd.jit;
      const P = [[-hc, -hc], [hc, -hc], [hc, hc], [-hc, hc]].map(([aa, bb]) => pr(px + aa, py + bb * cph, -bb * sph * 0.8));
      if (P[0][0] > W + 40 && P[3][0] > W + 40) continue; if (P[1][0] < -40 && P[2][0] < -40) continue;
      if (P[2][1] < -40 && P[3][1] < -40) continue; if (P[0][1] > H + 40 && P[1][1] > H + 40) continue;
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.closePath();
      ctx.fillStyle = `rgb(${Math.min(255, cr[0] * br) | 0},${Math.min(255, cr[1] * br) | 0},${Math.min(255, cr[2] * br) | 0})`; ctx.fill();
    }
    if (u < 4.6) hud(c.hudColor || '#fff', c.hud || '', c.hudBL, c.hudBR);
  },
  cues(sc) {
    const q = [{ t: at(sc, 0), k: 'boom', a: 1.0, d: 2.6 }, { t: at(sc, 0), k: 'crash', a: 0.42, d: 3.0 }, { t: at(sc, 0), k: 'kick', a: 1.0 },
    { t: at(sc, 0), k: 'groove', t1: at(sc, 4), kick: 1.0, hat: 0.12, bass: 0.36, clap: 0.55 }, { t: at(sc, 0), k: 'stab', a: 0.42 }, { t: at(sc, 2), k: 'stab', a: 0.4 },
    { t: at(sc, 2), k: 'crash', a: 0.32, d: 2.4 }, { t: at(sc, 2), k: 'boom', a: 0.6, d: 1.4 },
    { t: at(sc, 4), k: 'groove', t1: at(sc, 5), kick: 0.7, hat: 0.06, bass: 0.25, clap: 0.3, four: false }, { t: at(sc, 4), k: 'pad', d: 2.0 / TS, a: 0.14, cut: 1600 },
    { t: at(sc, 3.95), k: 'whoosh', d: 1.1, a: 0.22, f0: 4000, f1: 300, rise: 0.2 },
    { t: at(sc, 5.05), k: 'ticks', t1: at(sc, 5.6), a: 0.05, f0: 4000, f1: 8000, curve: 'even', sp: 0.0135 }, { t: at(sc, 5.3), k: 'riser', d: 0.68, a: 0.3 }];
    if (c.crowdSfx !== false) q.push({ t: at(sc, 0), k: 'crowd', d: 4.6, a: 0.32 });
    if (c.chant) for (let k = 0; k < 4; k++) q.push({ t: at(sc, 0.5 + k), k: 'chant', a: 0.22 });
    [0, 4, 7, 12].forEach((n, i) => q.push({ t: at(sc, 5.1 + 0.11 * i), k: 'pluck', n: 22 + n, a: 0.12, d: 0.5, pan: -0.4 + 0.25 * i, chordTone: true }));
    MOS.cards.forEach((cd, idx) => { if (hash(idx * 9.9) > 0.22) return; const pan = ((idx % MOS.C) - 31.5) / 40;
      q.push({ t: at(sc, cd.d1 + 0.18), k: 'tick', a: 0.07, f: 3500 + 2000 * hash(idx), pan }); q.push({ t: at(sc, cd.d2 + 0.18), k: 'tick', a: 0.06, f: 3000 + 2500 * hash(idx + 1), pan }); });
    return q;
  },
});

// ------------------------------------------------------------ lockup
// Logo slides left; wordmark, tagline, small line, URL pill, info chip; a pattern band runs along the bottom.
TPL.lockup = c => ({
  bars: 2, bg: c.bg || 'bg',
  f(u) {
    const uu = Math.min(u, 3.5); const e = eio(seg(uu, 0, 0.75)); const drift = 1 + 0.014 * seg(uu, 0.75, 3.5);
    drawLogo(logoBase(lerp(960, 488, e), 540, lerp(560, 430, e) * drift));
    const X = 748; const wm = Math.min(104, 104 * 960 / tw(c.wordmark || '', 'FX', 104));
    rise(c.wordmark, X, 455, 'FX', wm, '#fff', { t: uu, t0: 0.32, st: 0.024 });
    rise(c.tagline, X + 4, 538, 'FD', fit(c.tagline, 'FD', 70, 1080), c.accent || 'a3', { t: uu, t0: 0.5, ls: 3, st: 0.02 });
    rise(c.small, X + 4, 590, 'FR', 30, 'rgba(255,255,255,0.72)', { t: uu, t0: 0.64, st: 0.008 });
    let wU = 0;
    if (c.url) {
      wU = tw(c.url, 'FS', 28) + 60; const pe = expo(seg(uu, 0.92, 1.35), 6);
      if (pe > 0.001) { ctx.beginPath(); ctx.roundRect(X + 4, 636, Math.max(62, wU * pe), 62, 31); ctx.fillStyle = col(c.accent || 'a3'); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.roundRect(X + 4, 636, Math.max(62, wU * pe), 62, 31); ctx.clip(); rise(c.url, X + 34, 677, 'FS', 28, c.urlText || 'ink', { t: uu, t0: 1.0, st: 0.01 }); ctx.restore(); }
    }
    if (c.chip) {
      const wc = tw(c.chip, 'FS', 19, 1.5) + 52; const ce = expo(seg(uu, 1.12, 1.55), 6);
      if (ce > 0.001) { const x0 = X + 4 + (wU ? wU + 16 : 0);
        ctx.save(); ctx.beginPath(); ctx.roundRect(x0, 636, Math.max(62, wc * ce), 62, 31); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.stroke(); ctx.clip();
        rise(c.chip, x0 + 26, 674, 'FS', 19, '#fff', { t: uu, t0: 1.2, ls: 1.5, st: 0.004 }); ctx.restore(); }
    }
    const bc = c.band || PAT.colors; const be = expo(seg(uu, 0.2, 0.9), 5); const o = (uu * 60) % 128;
    ctx.save(); ctx.beginPath(); ctx.rect(0, H - 14 * be, W, 14); ctx.clip();
    for (let x = -128; x < W + 128; x += 128) { fillRect(x - o, H - 14, 64, 14, bc[0]); fillRect(x - o + 64, H - 14, 64, 14, bc[1]); }
    ctx.restore();
  },
  cues(sc) {
    return [{ t: at(sc, 0), k: 'boom', a: 0.9, d: 2.8 }, { t: at(sc, 0), k: 'crash', a: 0.3, d: 3.2 }, { t: at(sc, 0), k: 'kick', a: 1.0 },
    { t: at(sc, 0), k: 'final', d: 3.6 }, { t: at(sc, 0), k: 'motif', a: 0.55, mode: 'major' },
    { t: at(sc, 0.5), k: 'groove', t1: at(sc, 3.0), kick: 0.55, hat: 0.05, bass: 0.2, clap: 0.28, four: false },
    { t: at(sc, 0.32), k: 'pluck', n: 34, a: 0.1, d: 0.3 }, { t: at(sc, 0.5), k: 'pluck', n: 39, a: 0.1, d: 0.3 },
    { t: at(sc, 0.92), k: 'tick', a: 0.25, f: 3000 }, { t: at(sc, 1.12), k: 'tick', a: 0.2, f: 3500 },
    { t: at(sc, 3.0), k: 'bell', n: 27, a: 0.18, d: 2.0 }, { t: at(sc, 3.0), k: 'kick', a: 0.6 }];
  },
});

#!/usr/bin/env python3
"""Decoded engine — score generator.
Reads <project>/build/cues.json + meta.json (written by preview.js) and synthesises an original,
beat-synced stereo score: <project>/build/score.wav.  numpy + scipy only, ~5 s.

Music model: minor key (project.json "music": {"key": "D"}), bars follow i-VI-III-VII,
iv -> V before the drop (reassemble bar), i-VI-VII under the mosaic, resolving to the
relative major (III) on the lockup. Sonic logo = short-long rising 4th ("motif").
"""
import json, math, os, sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

proj = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
B = os.path.join(proj, 'build')
META = json.load(open(os.path.join(B, 'meta.json'))); CUES = json.load(open(os.path.join(B, 'cues.json')))
MUSIC = META.get('music') or {}
SR = 44100; DUR = META['duration']; N = int(SR * DUR)
BPM = META.get('bpm', 120); BEAT = 60.0 / BPM; BARLEN = 4 * BEAT
L = np.zeros(N); R = np.zeros(N); rng = np.random.default_rng(MUSIC.get('seed', 7))

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
ROOT = 48 + NOTE[MUSIC.get('key', 'D')]          # key root at octave 3 (D -> D3 = 50)
def nf(n): return 440.0 * 2 ** ((n - 69) / 12)

# ---------- chord plan per bar ----------
DEG = {'i': (0, 'm'), 'ii': (2, 'm'), 'III': (3, 'M'), 'iv': (5, 'm'), 'v': (7, 'm'), 'V': (7, 'M'), 'VI': (8, 'M'), 'VII': (10, 'M')}
nbars = int(round(DUR / BARLEN))
plan = [['i', 'VI', 'III', 'VII'][b % 4] for b in range(nbars)]
for s in META['sections']:
    b0 = int(round(s['t0'] / BARLEN))
    if s['tpl'] == 'reassemble':
        if b0 > 0: plan[b0 - 1] = 'iv'
        for k in range(s['bars']): plan[b0 + k] = 'V'
    if s['tpl'] == 'mosaic':
        for k, d in enumerate(['i', 'VI', 'VII'][:s['bars']]): plan[b0 + k] = d
    if s['tpl'] == 'lockup':
        for k in range(s['bars']): plan[b0 + k] = 'III'
if MUSIC.get('chords'): plan = MUSIC['chords']
def triad(deg):
    off, q = DEG[deg]; r = ROOT + off - (12 if off >= 5 else 0)
    return [r, r + (3 if q == 'm' else 4), r + 7]
def chord_at(t): return triad(plan[min(nbars - 1, max(0, int(t // BARLEN)))])

# ---------- dsp helpers ----------
def filt(x, kind, f, order=2):
    sos = butter(order, [f[0], f[1]], 'bandpass', fs=SR, output='sos') if kind == 'bp' else butter(order, f, kind, fs=SR, output='sos')
    return sosfilt(sos, x)
def put(x, t, amp=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:N - i]; gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
    L[i:i + len(x)] += x * amp * gl * 1.414; R[i:i + len(x)] += x * amp * gr * 1.414
def tt(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.003, k=8.0): t = tt(d); return np.exp(-t * k) * np.minimum(1, t / a)
def saw(f, t): return 2 * ((f * t) % 1.0) - 1

# ---------- instruments ----------
def kick(amp=1.0, d=0.45):
    t = tt(d); f = 45 + 110 * np.exp(-t * 28); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = filt(rng.standard_normal(len(t)), 'hp', 2500) * np.exp(-t * 300) * 0.35
    return np.tanh((x + click) * 1.6) * amp
def boom(amp=1.0, d=2.2):
    t = tt(d); f = 28 + 80 * np.exp(-t * 9); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    return np.tanh((x + filt(rng.standard_normal(len(t)), 'lp', 900) * np.exp(-t * 5) * 0.5) * 1.8) * amp
def clap_one(d=0.25):
    t = tt(d); e = np.zeros(len(t))
    for o in (0, 0.009, 0.019): e += (t >= o) * np.exp(-(t - o).clip(0) * (90 if o < 0.019 else 22))
    return filt(rng.standard_normal(len(t)), 'bp', (900, 4200)) * e
def crowd_clap(t0, amp=0.5, n=10):
    for _ in range(n): put(clap_one(), t0 + rng.normal(0, 0.009), amp / math.sqrt(n) * 1.6, rng.uniform(-0.8, 0.8))
def hat(amp=0.12, d=0.05): t = tt(d); return filt(rng.standard_normal(len(t)), 'hp', 7000) * np.exp(-t * 70) * amp
def tom(note, amp=0.7, d=0.5):
    t = tt(d); f = nf(note) * (1 + 0.6 * np.exp(-t * 30)); return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 1.5) * amp
def supersaw(notes, d, amp=0.3, cutoff=2600, a=0.005, k=5.0):
    t = tt(d); x = np.zeros(len(t))
    for n in notes:
        for det in (-0.12, 0, 0.11): x += saw(nf(n + det), t + rng.uniform(0, 1))
    return filt(x, 'lp', cutoff) / (len(notes) * 3) ** 0.5 * env(d, a, k) * amp
def pad(notes, d, amp=0.15, cutoff=1100):
    t = tt(d); x = np.zeros(len(t))
    for n in notes:
        for det in (-0.08, 0.07): x += saw(nf(n + det), t + rng.uniform(0, 1))
    return filt(x, 'lp', cutoff) / (len(notes) * 2) ** 0.5 * np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.35) * amp
def bassnote(note, d=0.22, amp=0.4):
    t = tt(d); f = nf(note); x = 0.7 * np.sin(2 * np.pi * f * t) + 0.3 * filt(saw(f, t), 'lp', 400)
    return np.tanh(x * 1.5) * env(d, 0.004, 9) * amp
def pluck(note, amp=0.3, d=0.4):
    t = tt(d); f = nf(note)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 18) + 0.15 * np.sin(6 * np.pi * f * t) * np.exp(-t * 30)
    return x * env(d, 0.002, 11) * amp
def bell(note, amp=0.3, d=1.6):
    t = tt(d); f = nf(note); mod = np.sin(2 * np.pi * f * 3.5 * t) * 1.2 * np.exp(-t * 4)
    return (np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(4 * np.pi * f * t)) * env(d, 0.002, 2.6) * amp
def tick(amp=0.15, f=4500):
    t = tt(0.02); return filt(rng.standard_normal(len(t)), 'bp', (f * 0.7, min(f * 1.4, 18000))) * np.exp(-t * 400) * amp
def whoosh(t0, d, amp=0.3, f0=300, f1=5000, rise=0.7, pan0=0.0, pan1=0.0):
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 256
    for s in range(0, n, blk):   # block-wise sweeping band-pass
        fc = f0 * (f1 / f0) ** (s / n); lo = max(40, fc * 0.6); hi = min(SR / 2 - 100, fc * 1.6)
        out[s:s + blk] = filt(x[max(0, s - 2048):s + blk], 'bp', (lo, hi))[-len(x[s:s + blk]):]
    tq = np.arange(n) / n; e = np.where(tq < rise, (tq / rise) ** 2, ((1 - tq) / max(1e-3, 1 - rise)) ** 1.5)
    out = out * e / (np.abs(out).max() + 1e-9)
    put(out * (1 - 0.5 * tq), t0, amp, pan0); put(out * 0.5 * tq, t0, amp, pan1)
def crash(amp=0.35, d=2.5):
    t = tt(d); x = filt(rng.standard_normal(len(t)), 'hp', 3500) + 0.3 * np.sin(2 * np.pi * 5200 * t + 3 * np.sin(2 * np.pi * 730 * t))
    return x * env(d, 0.001, 2.2) * amp
def riser(t0, d, amp=0.35):
    t = tt(d); q = t / d; ph = 2 * np.pi * np.cumsum(110 * 2 ** (q * 3)) / SR
    x = filt((2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.4, 'lp', 3000) + filt(rng.standard_normal(len(t)), 'hp', 1500) * q ** 2 * 0.6
    put(x * q ** 1.6, t0, amp, -0.3); put(x * q ** 1.6, t0 + 0.012, amp, 0.3)
def crowd(t0, d, amp=0.25):
    t = tt(d); q = t / d
    for pan in (-0.7, 0.7):
        n = np.cumsum(rng.standard_normal(len(t))); n = n - filt(n, 'lp', 40); n /= np.abs(n).max()
        x = filt(n, 'bp', (300, 2200)) + 0.6 * filt(n, 'bp', (600, 900)) + 0.4 * filt(n, 'bp', (1100, 1400)); x /= np.abs(x).max()
        put(x * np.minimum(1, q / 0.06) * (1 - q) ** 0.8, t0, amp, pan)
def chant(t0, amp=0.18):
    for (o, d, f1, f2) in ((0, 0.16, 650, 1100), (0.25, 0.42, 720, 1250)):
        t = tt(d)
        for _ in range(6):
            n = rng.standard_normal(len(t)); x = filt(n, 'bp', (f1 * 0.85, f1 * 1.15)) + 0.7 * filt(n, 'bp', (f2 * 0.88, f2 * 1.12))
            e = np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.08)
            put(x * (1 + 0.3 * np.sin(2 * np.pi * rng.uniform(150, 220) * t)) * e, t0 + o + rng.normal(0, 0.012), amp / 2.5, rng.uniform(-0.8, 0.8))
def motif(t, amp=0.4, mode='minor'):
    a, b = (ROOT + 22, ROOT + 27) if mode == 'major' else (ROOT + 19, ROOT + 24)
    put(bell(a, amp * 0.8, 0.5), t); put(bell(b, amp, 2.2), t + BEAT / 2)
    put(pluck(a + 12, amp * 0.25, 0.3), t, 1, -0.3); put(pluck(b + 12, amp * 0.3, 0.8), t + BEAT / 2, 1, 0.3)
def groove(a, b, kick_amp=0.9, clap_amp=0.45, hat_amp=0.1, bass_amp=0.32, four=True):
    k = 0; t = a
    while t < b - 1e-6:
        bt = int(round((t % BARLEN) / BEAT)) % 4
        if four or bt in (0, 2): put(kick(kick_amp), t)
        if bt in (1, 3) and clap_amp > 0: crowd_clap(t, clap_amp)
        for s in range(4):
            if hat_amp > 0: put(hat(hat_amp * (1.0 if s == 2 else 0.55)), t + s * BEAT / 4, 1, 0.35 if s % 2 else -0.35)
        if bass_amp > 0:
            root = chord_at(t)[0] - 12
            put(bassnote(root, 0.2, bass_amp), t + BEAT / 2); put(bassnote(root + (12 if bt == 3 else 0), 0.1, bass_amp * 0.6), t + BEAT * 0.75)
        t += BEAT
def ticks(t0, t1, amp, f0, f1, curve, sp=0.045):
    if curve == 'decel':
        t = t0
        while t < t1: q = (t - t0) / (t1 - t0); put(tick(amp, f0 + (f1 - f0) * q), t, 1, rng.uniform(-0.3, 0.3)); t += 0.022 + 0.05 * q ** 2
    elif curve == 'expo':
        prev = 0; t = t0
        while t < t1:
            q = (t - t0) / (t1 - t0); v = (1 - math.exp(-4.2 * q)) / (1 - math.exp(-4.2))
            if v - prev > 0.0165 or q > 0.8: put(tick(amp, f0), t, 1, rng.uniform(-0.4, 0.4)); prev = v
            t += 0.03
    else:
        n = max(1, int((t1 - t0) / sp))
        for i in range(n): put(tick(amp, f0 + (f1 - f0) * i / n), t0 + i * sp, 1, rng.uniform(-0.7, 0.7))

# ---------- render cues ----------
for c in CUES:
    t, k = c['t'], c['k']
    if k == 'groove': groove(t, c['t1'], c.get('kick', 0.9), c.get('clap', 0.45), c.get('hat', 0.1), c.get('bass', 0.32), c.get('four', True))
    elif k == 'boom': put(boom(c.get('a', 0.8), c.get('d', 2.2)), t)
    elif k == 'kick': put(kick(c.get('a', 0.9), c.get('d', 0.45)), t)
    elif k == 'stab': put(supersaw([n + 12 + c.get('up', 0) for n in chord_at(t)], 0.45, c.get('a', 0.35), 2800), t)
    elif k == 'whoosh': whoosh(t, c['d'], c.get('a', 0.3), c.get('f0', 300), c.get('f1', 5000), c.get('rise', 0.7), c.get('p0', 0), c.get('p1', 0))
    elif k == 'ticks': ticks(t, c['t1'], c.get('a', 0.1), c.get('f0', 4000), c.get('f1', 4000), c.get('curve', 'even'), c.get('sp', 0.045))
    elif k == 'tick': put(tick(c.get('a', 0.15), c.get('f', 4500)), t, 1, c.get('pan', 0))
    elif k == 'tom': put(tom(ROOT + c['n'], c.get('a', 0.5), c.get('d', 0.4)), t)
    elif k == 'pluck': put(pluck(ROOT + c['n'], c.get('a', 0.2), c.get('d', 0.4)), t, 1, c.get('pan', 0))
    elif k == 'bell': put(bell(ROOT + c['n'], c.get('a', 0.25), c.get('d', 1.4)), t)
    elif k == 'motif': motif(t, c.get('a', 0.4), c.get('mode', 'minor'))
    elif k == 'riser': riser(t, c['d'], c.get('a', 0.35))
    elif k == 'crash': put(crash(c.get('a', 0.35), c.get('d', 2.5)), t)
    elif k == 'crowd': crowd(t, c['d'], c.get('a', 0.25))
    elif k == 'chant': chant(t, c.get('a', 0.18))
    elif k == 'clap': crowd_clap(t, c.get('a', 0.5), c.get('n', 10))
    elif k == 'pad':
        notes = triad(c['chord']) if c.get('chord') else chord_at(t + 0.01)
        put(pad(notes, c['d'], c.get('a', 0.12), c.get('cut', 1100)), t)
    elif k == 'final':
        r = ROOT + 3; put(supersaw([r, r + 4, r + 7, r + 12], c.get('d', 3.6), 0.3, 2200, 0.01, 0.9), t)
        put(pad([r - 12, r - 5, r + 4], c.get('d', 3.6) + 0.3, 0.16, 900), t)

mix = np.stack([L, R], 1); mix = filt(mix.T, 'hp', 28).T
mix /= np.abs(mix).max() + 1e-9; mix = np.tanh(mix * 1.25) / np.tanh(1.25)
fi = int(0.002 * SR); fo = int(0.35 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]; mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
wavfile.write(os.path.join(B, 'score.wav'), SR, (mix * 32000).astype(np.int16))
print('score', os.path.join(B, 'score.wav'), f'{DUR:.1f}s', len(CUES), 'cues; chords:', ' '.join(plan))

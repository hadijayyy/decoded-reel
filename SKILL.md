---
name: decoded-reel
description: Make a 30-second, beat-synced motion-graphics brand film for any website, brand, app or product with the "Decoded" concept. The real logo is split into its parts, each part tells one true story about the brand, then the parts fly back together, a stadium-style card mosaic drops, and the film ends on a lockup. Uses the brand's real logo, fonts and colours from its website, and generates an original score whose cues come from the animation. Use when asked for a brand film, promo, sizzle, showreel, launch video, motion graphics or "a video for <url>", or when someone says "decode the logo/brand". Output is a 1920x1080 60 fps MP4 rendered with Canvas, Playwright, ffmpeg and numpy.
---

# Decoded reel

**The concept:** *one mark, N stories.* The brand's real logo is taken apart. Each part gets a chapter backed by a real fact. The parts then reassemble, a card-mosaic "drop" delivers the line, and the film ends on the lockup. The engine is data-driven: you write `project.json`, and the scene templates, transitions and score all follow from it.

Proven on FC Barcelona (examples/fc-barcelona) and on a fictional app (examples/demo-app). A 30 s film renders in about 3 min on 4 cores.

## 0. Ask first (one AskUserQuestion call, then work without stopping)
Ask about **format/length** (the default is 16:9, 30 s, 15 bars), **angle** (or "you decide after research"), **branding** (official assets vs. inspired-by), and **audio** (generated score + SFX, silent, or their own track). If the user said "you decide", decide and say what you chose.

## 1. Research (real facts only)
- Use WebFetch on the homepage plus 1–2 key pages (about/history/product). Collect: what the brand is, its tagline, 4–6 *true, specific* facts (dates, counts, names, places), the next event or CTA, and the URL.
- Run `python3 scripts/site_scan.py <url> <project>/assets/scan`. It downloads web fonts and SVG sprites and reports the top CSS colours and the `<symbol>` ids. Open `scan.json`.
- Do a quick WebSearch for current motion and sound-design trends, and name the ones you apply in your summary.
- Never invent stats. A fictional brand must say so on screen (see demo-app).

## 2. Find the mark and split it
1. Get the logo as an SVG: a sprite `<symbol>`, an inline `<svg>`, an `.svg` file, or the user's file. PNG only works as a last resort, and parts then can't be split.
2. Run `python3 scripts/svg_to_paths.py logo.svg <project>/assets/logo_paths.json [--symbol ID]` and note the viewBox it prints.
3. Run `node scripts/path_sheet.js <project>/assets/logo_paths.json <vbW> <vbH> sheet.png` and **look at it**. Every path gets an index.
4. Group the paths into **3–6 parts**. Each part needs a meaning, so it can carry a chapter. Strategies, best first:
   - **Emblem/crest:** use its quarters, symbols and bands (FCB: cross = city, Senyera = Catalonia, FCB letters = founding, stripes = members, ball = game).
   - **Icon + shapes:** use each geometric piece (demo-app: ring, planet, moon, spark).
   - **Wordmark only:** each letter or letter group is a part. Pair it with brand facts (`clip` boxes cut letters out of one path).
   - **Single-shape logo:** split it with `clip` rects into slices, or use the product's own UI icons as the "parts".
   One SVG path can feed several parts through `clip: [x,y,w,h]`. Use `{"circle":[x,y,r]}` to fill holes (FCB ball socket).
5. Pick the **frame** (the background/shield the parts sit on: `outline` path plus `inner` path) and an optional **pattern** (`x0`, `period`, `colors`) that matches stripes in the logo. The hook and the mask landing are built on that pattern.

## 3. Storyboard (15 bars at 120 BPM = 30 s; every scene starts on a bar line)
Default timeline: `hook(1) → decode(1) → glyph(1) → bars(1) → slam(1) → count(2) → roll(2) → reassemble(1) → mosaic(3) → lockup(2)`.
- Map **one part → one chapter**, using the template whose motion fits the part (a cross → `glyph` plus; flag bars → `bars`; letters → `slam`; stripes/people → `count`; a ball/round part → `hero` of `count`/`roll`).
- Copy rules: hook = 2–4 punchy words, read as a riddle (e.g. ONE / CREST. / FIVE / STORIES.). Titles are ≤ 2 words. Subs are ≤ 2 short lines. Each chapter carries **one** real fact. The tagline goes in the mosaic and the lockup. Use the brand's own language for tags (bilingual reads premium).
- **Continuity contract** (read references/templates.md): `decode.dive` must end on the colour of the next scene's `bg`; `glyph` zooms into its shape colour, so the next scene must start with it (`bars.barColor`); `count` ends on its hero at R=390 at the centre, which `roll` picks up.
- **Question the plan before building.** Does frame 0 already look finished? Is every transition motivated by the previous shape? Is there one idea per bar and no dead holds? If it feels templated, change the parts, the copy or the order, not the engine.

## 4. Build → preview → fix → render
```bash
python3 engine/build.py <project>                       # -> <project>/build/reel.html
node engine/preview.js <project> sheet.png 0.25 1.9 2.5 3.5 4.7 6.6 9.4 12.3 14.8   # 3x3 contact sheet (+ writes cues.json/meta.json)
node engine/render.js <project> 4                       # 4 workers, one mp4 per bar, resumable; FORCE=3,7 re-renders bars
python3 engine/audio.py <project>                       # build/score.wav from the cues
bash engine/mux.sh <project> <out.mp4>                  # concat + mux + loudnorm -15 LUFS + ffprobe
```
- **Look at contact sheets for every scene** before the full render, at entrances, mid-motion, and just before each cut. Fix with the config first and the engine second.
- Requirements: Node with `playwright` + Chromium, Python 3 with numpy and scipy, and ffmpeg. In Claude Code cloud sessions all of these are preinstalled except scipy (`pip install scipy`).

## 5. QA and delivery
- ffprobe: frames must equal fps × duration, and audio duration must equal video duration.
- Pull 6–9 frames from the final MP4 and check the motion blur and that no text is clipped.
- You can't hear the audio, so render a waveform and spectrogram (`showwavespic`/`showspectrumpic`) and check that the drop is the loudest moment, with the silent beat just before it.
- Deliver the MP4 file itself, with a one-paragraph summary: the concept, the chapters, the trends used, what is official and what is invented, and anything unverified. Note that official logos and fonts are the brand's trademarks and licensed files: they are fetched at build time and **never committed** (see `.gitignore`).

See references/templates.md (all parameters), references/craft.md (motion and sound rules, trends, bugs that bit), and examples/*/project.json.

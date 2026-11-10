# decoded-reel: a Claude skill for "Decoded" brand films

Turn any website, brand or app into a **30-second, beat-synced motion-graphics film**:
the real logo is split into its parts, each part tells one true story, the parts fly back together,
a stadium-style card mosaic drops the line, and the film lands on a lockup. The original score
is generated from cues emitted by the animation itself.

| | |
|---|---|
| Output | 1920×1080, 60 fps MP4, motion-blurred, original score at −15 LUFS |
| Stack | Canvas 2D → Playwright (Chromium) → ffmpeg; numpy/scipy for audio |
| Render | about 3 min for 30 s on 4 cores |

## Use it as a skill
- **Claude Code:** copy this folder to `~/.claude/skills/decoded-reel/` (or `.claude/skills/` in a project), then ask:
  *"Make a decoded reel for https://example.com"*.
- **claude.ai:** zip the folder and upload it in *Settings → Capabilities → Skills*.

## Quick start (by hand)
```bash
pip install numpy scipy && npm i playwright        # plus ffmpeg on PATH
examples/demo-app/fetch_assets.sh                  # open-source fonts + the demo logo
python3 engine/build.py examples/demo-app
node engine/preview.js examples/demo-app sheet.png 0.3 2.5 3.5 4.8 7.3 9.4 12.4 21.4 28
node engine/render.js examples/demo-app 4
python3 engine/audio.py examples/demo-app
bash engine/mux.sh examples/demo-app demo.mp4
```

## Layout
```
SKILL.md                 the workflow Claude follows (ask → research → split the mark → storyboard → build → QA)
engine/                  core.js · templates.js · main.js · build.py · preview.js · render.js · audio.py · mux.sh
scripts/                 site_scan.py · svg_to_paths.py · path_sheet.js · symbols_to_icons.py
references/              templates.md (every parameter + continuity contract) · craft.md (motion/sound rules, trends, pitfalls)
examples/fc-barcelona/   "The Crest, Decoded": official crest/fonts fetched from fcbarcelona.com at build time
examples/demo-app/       "Orbit": a fictional app with a hand-drawn logo and OFL fonts from npm
```

## Assets and licensing
Brand logos, fonts and icons are **not** in this repo. Each example has a `fetch_assets.sh` that downloads
them into `assets/` (git-ignored). Official marks belong to their owners. Treat these films as unofficial
concept pieces, and get permission before publishing one.

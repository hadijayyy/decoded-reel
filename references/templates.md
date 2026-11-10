# project.json and template reference

All times are in 120-BPM "template seconds" (1 bar = 2.0). Set `bpm` to another tempo and everything scales.
Colours can be palette keys (`bg ink paper a1..a5`) or raw hex.

## Top level
| key | meaning |
|---|---|
| `fps`, `bpm`, `grain` | 60, 120, 0.07 (overlay film-grain opacity, 0 = off) |
| `music.key` | minor key root, e.g. `"D"`. Optional `music.chords` overrides the per-bar plan (degrees `i ii III iv v V VI VII`), and `music.seed` changes the noise seed |
| `palette` | `bg` (dark base), `ink` (dark text), `paper` (light base), `a1`–`a5` accents |
| `fonts` | `FD` display condensed bold, `FX` heavy wordmark, `FS` UI semibold, `FR` body. Each is a woff2/woff/ttf/otf path, or `local:Font Name` |
| `icons` | JSON from `scripts/symbols_to_icons.py` (`{id:{vb,d[]}}`), used by `roll.stats[].icon` |
| `hud` | corner micro-type: `tl`, `bl`, `br` (`tr` is per-scene `hud`). Set `off: true` to hide |
| `logo` | see below |
| `timeline` | ordered list of scenes `{ "tpl": name, ...params }` |

## logo
```json
"logo": {
  "paths": "assets/logo_paths.json", "viewBox": [w, h], "center": [cx, cy],
  "outline": 0, "inner": 1,              // frame silhouette paths: the mask, and the ghost outline in the diagram
  "maskStart": 2600,                     // optional: logo height (px) when the mask lands (must cover the frame)
  "pattern": { "x0": 184.3, "period": 63.5, "colors": ["a1","a2"] },  // stripes in logo units; match the logo's own stripes
  "frame": [ {"i":0}, {"i":1} ],         // items drawn as the fixed background of the mark
  "order": ["stripes","ball", ...],      // draw order of parts (back to front)
  "parts": { "name": { "pivot": [x,y], "draw": [ {"i":11,"clip":[x,y,w,h],"fill":"#000"}, {"circle":[x,y,r],"fill":"#000"} ] } }
}
```
`pivot` is the part's rotation/scale centre and its label anchor.

## Templates and their continuity contract
| tpl | bars | starts on | ends on | key params |
|---|---|---|---|---|
| `hook` | 1 | `bg` with words filled by `pattern` | full-frame pattern at mask scale | `words[]` (2–4), `hud` |
| `decode` | 1 | full pattern (from hook) | colour at `dive` point, full frame | `sweep[]` parts revealed with the frame (parts that coincide with the pattern), `land{part:t}`, `explode{part:[dx,dy,rot]}` px, `labels{part:[no,title,dx,dy]}`, `dive{part,in,notIn[]}` (path indexes), `size`, `ghostLine`, `ghostFill` |
| `glyph` | 1 | `bg` (must equal the decode dive colour) | full frame in the shape colour | `shape` `"plus"` or `"part:NAME"`, `color`, `x,y,size,thick`, `zoom`, `zoomItem`, `tag,title,sub[]`, `textColor,subColor,tagColor,shadow`, `titleSize` |
| `bars` | 1 | full frame `barColor` | `bg` (bars exit) | `n`, `barColor`, `bg`, `tag,title,sub[]`, colours |
| `slam` | 1 | wipe `down` in `wipeAccent` | `bg` | `text` (font letters) **or** `logoLetters{path,band:[y0,y1]}`, `color`, `shadow`, `odometer{prefix,from,to}`, `caption` |
| `count` | 2 | column wipe | hero at screen centre, R=390 | `value`, `prefix/suffix/sep`, `label,caption`, `label2,caption2` (bar-2 swap), `colors[2]`, `hero` `"part:NAME"` or `"dot"`, `heroColor` |
| `roll` | 2 | hero at centre R=390 | `bg` | `hero`, `stats[≤4]{icon?,value,prefix?,suffix?,label}`, `list{kicker,title,caption,items[≤4],footnote}`, `accent`, `iconColor` |
| `reassemble` | 1 | `bg` | full logo (hard cut to the drop) | `ring` (orbiting type), `fly{part:[landT,fromX,fromY,rot]}`, `size` |
| `mosaic` | 3 | 64×36 card wall (crowd) | vector logo at centre, h=560 | `lines[]` (1–3 short lines), `textColor`, `stripes[2]`, `crowd[]` card colours, `cardBg`, `chant`, `crowdSfx`, `hudBL/BR` |
| `lockup` | 2 | logo at centre h=560 | static last 0.5 s | `wordmark`, `tagline`, `small`, `url`, `urlText`, `chip`, `band[2]`, `accent` |

You can reorder, repeat or drop the chapter templates (`glyph`, `bars`, `slam`, `count`, `roll`), but keep the contract: the colour/shape a scene ends on must be what the next scene starts with, or use a template that has its own wipe (`slam` = down, `count` = columns).

## Audio cues (emitted by each template, consumed by engine/audio.py)
`groove` (kick/clap/hats/bass section), `boom`, `kick`, `stab` (chord of the bar, `up` semitones), `whoosh` (band-pass sweep, `f0→f1`, `rise`, pan), `ticks` (`decel|expo|even`), `tick`, `tom`/`pluck`/`bell` (`n` = semitones above the key root at octave 3), `motif` (sonic logo, `minor` or `major`), `riser`, `crash`, `crowd`, `chant`, `clap`, `pad`, `final` (relative-major chord). The mosaic emits one click per sampled card, at that card's real flip time.
Chord plan: `i VI III VII` loop; `iv` the bar before `reassemble`, `V` on it; `i VI VII` under `mosaic`; `III` (relative major) on `lockup`.

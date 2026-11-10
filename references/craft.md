# Craft notes: what makes it read as world-class

## Motion rules baked into the engine
- **Every frame is a pure function of time.** Any frame can be rendered alone, and motion blur averages M=8 sub-frame samples over a 180° shutter.
- **No crossfades.** Every change is a shape: a zoom through a letter, a logo-shaped mask, a dive into a colour, bars splitting, a down-wipe, column wipes, a dot becoming the hero, a hard cut on the drop.
- **Easing:** entrances use exponential ease-out, exits accelerate (ease-in power 3), and moves use a quintic in-out. Nothing bounces. "Slams" accelerate into a hard stop followed by a decaying screen shake.
- **Frame 0 is already finished** (the hook's first word is on screen). The only hold is the last 0.5 s, with no other hold longer than a beat.
- **Text:** per-character masked rise with a 12–30 ms stagger, tabular numerals for counters, and an odometer for years. Micro-type HUD sits in the corners (coordinates, chapter index, founding year) for an editorial feel.
- **Tactile depth on flat colour:** hard offset shadows, light overlay grain, and per-card brightness jitter plus human timing jitter in the mosaic.

## 2026 trends this format answers (cite in your summary)
- Bold minimalism and kinetic typography (type as a window, oversized condensed display).
- Tactile, imperfect, human-feeling motion (paper shadows, grain, a crowd-timed card flip) as a counterweight to AI-generated sameness.
- Procedural and generative animation (the dot crowd and the card-wave mosaic).
- Local culture and authenticity: the brand's own language, places and real numbers.
- Sound: **sonic systems over one-off jingles.** A recurring 2-note motif plays at every logo moment and resolves to major at the end. Sound is generated from the edit itself, so SFX land on exact frames. There is a silent beat before the drop.

## Story checklist
1. Is the hook a riddle the film answers? ("ONE CREST. FIVE STORIES.")
2. Does every part have a true, specific fact? (dates, counts, names; no adjectives instead of facts)
3. Does each transition come from the previous shape?
4. Is the drop the loudest and biggest moment, with the payoff line on it?
5. Does the lockup have one CTA (URL) plus one timely detail (next event, launch date, store badges)?

## Bugs that bit (already fixed in the engine; watch for them in new templates)
- `source-in` compositing with multiple `fillRect`s clears the layer (each fill is unbounded). Use `source-atop` for text-as-window.
- A clip set with a moving part's transform will crop that part once it moves. Drop the clip once the sweep is done.
- Exploded diagrams in isometric 3D read as clutter in a 1 s beat. A flat Swiss explode with labels is clearer.
- Text exits that overlap the next line's entrance: stagger `out` ≥ 0.2 s before the next `t0`.
- Long titles collide with the shape: the engine auto-fits (`fit()`), but keep titles to ≤ 2 words.
- Hero/part sizes measured at init: anything that depends on `PARTBB` must be lazy.
- The audio is never heard by the agent: always check a waveform and spectrogram, and keep big hits at moderate level so the drop has headroom.

## Licensing
Official logos, fonts and icons belong to the brand. The fetch scripts download them at build time for concept and pitch use, and `.gitignore` keeps them out of git. Don't publish a film that impersonates the brand's official channels, and tell the user it is an unofficial concept piece.

# Adaptive Layout Engine

One declarative ad spec. Any surface. No per-surface hand-authoring.

The engine takes a creative authored **once** — elements, priorities, a theme, a few rules — and
decides, per surface, which elements survive, how they are arranged, how large the text is, how
images are cropped, and how safe areas are respected. A 320×50 banner and a 9:16 story come out of
the same input, and the engine can tell you exactly why each one looks the way it does.

> **Status: Milestone 1 complete.** The engine core, its types, the `stack` archetype and the test
> suite are in place. Milestones 2–5 (the other three archetypes, the React playground, the Express
> API, deployment) are described in [Roadmap](#roadmap).

```
packages/engine     the core — zero framework dependencies, runs in Node and the browser
packages/shared     zod schemas shared by the engine, the API and the client
scripts/            font-metric capture tooling
```

## Quick start

```bash
npm install
npm test          # 163 engine tests
npm run typecheck
npm run lint
npm run bench     # prints the solve-time distribution
```

## The pipeline

`solve(spec, surface)` runs ten steps in order. Every step appends to a trace, so the output
explains itself.

| # | Step | Decision it makes |
|---|------|-------------------|
| 1 | `normalize` | Validate with zod, resolve role defaults, order elements by priority. |
| 2 | `classify` | Aspect bucket, density class, minimum touch target, content box. |
| 3 | `selectArchetype` | Pick a composition from an `(aspect × density)` table. |
| 4 | `budget` | Weighted space allocation honouring `minSize` and `aspectLock`. |
| 5 | `fitText` | Binary-search the font size so wrapped text fits its region. |
| 6 | `degrade` | Drop the least important element and re-run 4–5 until it fits. |
| 7 | `safeArea` | Inset frames; grow CTAs to the surface's touch target. |
| 8 | `imageCrop` | Cover-fit crop that keeps the focal point in view. |
| 9 | `contrast` | Enforce the WCAG floor by recolouring, or by adding a scrim. |
| 10 | `fingerprint` | Hash the visible outcome so golden tests can pin it. |

`solve()` is pure: no clock, no randomness, no DOM, no I/O. The same input produces a
byte-identical `LayoutResult` in Node and in the browser — which is what makes the golden tests and
(from milestone 4) the client/server parity test meaningful. A test asserts this by spying on
`Math.random` and `Date.now` and by scanning the engine source for platform imports.

### Reading a trace

```
 1   p0 normalize: spec "Trailhead — Spring Launch" accepted elements=7 neverDrop=3 pairs=1
 2   p0 normalize: priority order: bg > headline > cta > logo > hero > subhead > legal
 3 > p0 classify [banner-320x50]: 320x50 is ultrawide/micro aspect=6.4 area=16000 minTouchTarget=44
 4 ! p0 selectArchetype: archetype "strip" is not implemented yet; falling back to "stack"
 5   p0 budget [copy]: region "copy" is 29.6px short shortfallPx=29.6
 7 ! p0 fitText [headline]: "headline" does not fit at its 14px floor neededLines=1 maxLines=3
11 > p0 degrade [legal]: dropping legal + logo — priority 90 to recover 236px of unmet minimums
12   p1 budget: 5 frames placed deficitPx=105.1 shortfalls=4
```

`>` marks a decision, `!` a compromise, `pN` the degradation pass. Entries are numbered and
timestamp-free so two runs diff cleanly.

## Text measurement without the DOM

The engine cannot call `canvas.measureText` — it has to give the same answer on a server as in a
browser. So it carries its own metrics.

- **The advance tables are measured, not guessed.** Every character from U+0020 to U+007E plus
  common punctuation was measured in isolation with `canvas.measureText` against the real Inter
  webfont and the Georgia and Menlo system fonts. Isolated glyphs carry no kerning, so those
  advances are exact. Regenerate them with `scripts/measure-fonts.html`.
- **The approximation is in the summation.** Adding advances ignores kerning pairs, and modelling
  bold as one multiplier rather than a second table adds a little more error. A named
  `stringFitScale` per weight corrects for both, fitted against whole-string measurements held in
  `packages/engine/tests/fixtures/reference-widths.json`.
- **Measured accuracy: worst case 0.81% across the 26-sample reference set**, against a documented
  tolerance of ±3%. Renderers apply a `0.97` safety factor to fitted widths so a positive error
  still lands inside the box rather than clipping.
- **What it does not model**, stated plainly: kerning pairs, ligatures, optical sizing, and text
  shaping. Arabic and Devanagari joining forms are measured as isolated glyphs, which
  over-estimates them badly; RTL is not handled at all. CJK and emoji fall back to a flat 1.0em
  advance — correct for full-width ideographs, wrong for half-width kana.

## Notes on the classification thresholds

Worth knowing before reading the archetype table: with the specified aspect buckets, a 9:16 story
is `0.5625`, which lands in **portrait**, not `tall`. `tall` (< 0.45) is skyscraper territory —
160×600 and narrower. The `overlay` archetype is therefore aimed at skyscrapers rather than
stories, and stories compose with `stack`.

## Roadmap

| Milestone | Contents | State |
|---|---|---|
| 1 | Engine skeleton, types, `stack`, golden tests | **done** |
| 2 | `strip`, `split`, `overlay` archetypes | next |
| 3 | React playground: presets, free resize, debug overlay, matrix view | |
| 4 | Express + Mongo API, auth, share links, `/render` parity test | |
| 5 | Deployment, seeded demos, `?demo=1` route | |

The remaining README sections required by the brief — the worked degradation example, the full
tradeoffs discussion, the performance distribution across the preset matrix and the live demo
links — land with the milestones that make them true.

## Performance

Measured on the benchmark test (Node 24, Apple silicon), 7-element spec, 200 samples:

```
solve(): p50 0.159ms   p95 0.283ms   max 0.636ms
```

Budget is 5ms, because the playground's free-resize mode re-solves on every animation frame.

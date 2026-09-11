import { describe, expect, it } from 'vitest';
import { solve } from '../src/solve.js';
import { SpecError } from '../src/errors.js';
import { DEMO_SPEC, MINIMAL_SPEC, PRESET_SURFACES, presetSurface } from '../src/fixtures/index.js';
import type { AdSpec, Surface } from '../src/types.js';

const square = presetSurface('square-1080');
const banner = presetSurface('banner-320x50');
const story = presetSurface('story-1080x1920');

function ids(list: readonly { id: string }[]): string[] {
  return list.map((p) => p.id).sort();
}

describe('solve — contract', () => {
  it('places every element when there is room', () => {
    const result = solve(DEMO_SPEC, square);
    expect(result.dropped).toEqual([]);
    expect(ids(result.placed)).toEqual(ids(DEMO_SPEC.elements));
  });

  it('uses the stack archetype for square surfaces', () => {
    expect(solve(DEMO_SPEC, square).archetype).toBe('stack');
  });

  it('reports the surface classification it used', () => {
    const result = solve(DEMO_SPEC, square);
    expect(result.surfaceClass.aspectBucket).toBe('square');
    expect(result.surfaceClass.densityClass).toBe('large');
    expect(result.surfaceClass.minTouchTarget).toBe(44);
  });

  it('keeps every frame inside the safe area', () => {
    const result = solve(DEMO_SPEC, story);
    const box = result.surfaceClass.contentBox;
    for (const p of result.placed) {
      if (p.id === 'bg') continue; // backgrounds bleed on purpose
      expect(p.frame.x).toBeGreaterThanOrEqual(box.x - 0.01);
      expect(p.frame.y).toBeGreaterThanOrEqual(box.y - 0.01);
      expect(p.frame.x + p.frame.w).toBeLessThanOrEqual(box.x + box.w + 0.01);
      expect(p.frame.y + p.frame.h).toBeLessThanOrEqual(box.y + box.h + 0.01);
    }
  });

  it('gives every full-bleed element the whole surface, not a share of it', () => {
    // Regression: two elements with role "background" were band-allocated
    // against each other, so each got half the canvas and the ad rendered as
    // two stacked colour blocks. Bands divide a region between elements that
    // must share it; anything that bleeds shares with nobody.
    const twoBackgrounds: AdSpec = {
      ...MINIMAL_SPEC,
      elements: [
        { id: 'bg', role: 'background', priority: 0, content: { kind: 'shape', fill: '#0f172a' } },
        { id: 'bg2', role: 'background', priority: 0, content: { kind: 'shape', fill: '#85a9ff' } },
        ...MINIMAL_SPEC.elements,
      ],
    };
    for (const preset of [square, banner, story]) {
      const result = solve(twoBackgrounds, preset);
      for (const id of ['bg', 'bg2']) {
        const placed = result.placed.find((p) => p.id === id);
        expect(placed?.frame, `${id} on ${preset.label}`).toEqual({
          x: 0,
          y: 0,
          w: preset.width,
          h: preset.height,
        });
      }
    }
  });

  it('keeps solving while a text field is being retyped', () => {
    // Regression: clearing a text box to retype it made the whole spec
    // invalid, so the canvas, the matrix and the inspector all went blank
    // mid-keystroke. An element with nothing to say is nothing to place, and
    // is reported as dropped rather than rejecting the document.
    const midEdit: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) =>
        el.id === 'subhead' && el.content.kind === 'text'
          ? { ...el, content: { ...el.content, value: '   ' } }
          : el,
      ),
    };
    const result = solve(midEdit, square);
    expect(result.placed.map((p) => p.id)).not.toContain('subhead');
    expect(result.dropped.find((d) => d.id === 'subhead')?.reason).toContain('no text');
    // Everything else still lays out.
    expect(result.placed.map((p) => p.id)).toContain('headline');
  });

  it('never sets a lower-ranked role larger than the copy above it', () => {
    // Regression: each text element was fitted to fill its own band, so a
    // two-word subhead outgrew a long headline — the copy with least to say
    // won the most room, and the ad read upside down.
    const shortSubhead: AdSpec = {
      ...MINIMAL_SPEC,
      elements: [
        { id: 'bg', role: 'background', priority: 0, content: { kind: 'shape', fill: '#0f172a' } },
        {
          id: 'headline',
          role: 'headline',
          priority: 0,
          content: {
            kind: 'text',
            value: 'A headline long enough to wrap twice',
            maxLines: 3,
            minFontPx: 14,
          },
        },
        {
          id: 'subhead',
          role: 'subhead',
          priority: 60,
          content: { kind: 'text', value: 'Two words', maxLines: 3, minFontPx: 12 },
        },
        {
          id: 'cta',
          role: 'cta',
          priority: 5,
          content: { kind: 'text', value: 'Go', maxLines: 1, minFontPx: 12 },
        },
      ],
    };

    for (const preset of PRESET_SURFACES) {
      const result = solve(shortSubhead, preset);
      const size = (id: string) => result.placed.find((p) => p.id === id)?.fontSizePx ?? 0;
      const headline = size('headline');
      if (headline === 0) continue;
      for (const id of ['subhead', 'cta']) {
        const other = size(id);
        if (other === 0) continue;
        expect(other, `${id} on ${preset.label}`).toBeLessThanOrEqual(headline + 0.01);
      }
    }
  });

  it('steps the hierarchy down the theme type scale, not merely to equal', () => {
    const result = solve(DEMO_SPEC, square);
    const size = (id: string) => result.placed.find((p) => p.id === id)?.fontSizePx ?? 0;
    // A subhead the same size as the headline reads as two headlines.
    expect(size('subhead')).toBeLessThan(size('headline'));
  });

  it('honours pinTo on every archetype, not just stack', () => {
    // Regression: pinTo was resolved only by `stack`, so pinning a logo to the
    // bottom silently did nothing on a landscape surface, which uses `split`.
    const pinned = (pin: 'top' | 'bottom'): AdSpec => ({
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) => (el.id === 'logo' ? { ...el, pinTo: pin } : el)),
    });
    for (const preset of [presetSurface('tv-1920x1080'), presetSurface('square-1080')]) {
      const top = solve(pinned('top'), preset).placed.find((p) => p.id === 'logo');
      const bottom = solve(pinned('bottom'), preset).placed.find((p) => p.id === 'logo');
      expect(top, preset.label).toBeDefined();
      expect(bottom, preset.label).toBeDefined();
      expect(bottom!.frame.y, `${preset.label} moved the pinned logo`).toBeGreaterThan(
        top!.frame.y,
      );
    }
  });

  it('caps an element at maxSize without breaking its aspect lock', () => {
    const tv = presetSurface('tv-1920x1080');
    const uncapped = solve(DEMO_SPEC, tv).placed.find((p) => p.id === 'logo')!;

    // Pick a cap that actually binds, or the assertion proves nothing.
    const capWidth = Math.round(uncapped.frame.w / 2);
    const capped: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) =>
        el.id === 'logo' ? { ...el, maxSize: { w: capWidth, h: capWidth } } : el,
      ),
    };
    const logo = solve(capped, tv).placed.find((p) => p.id === 'logo')!;

    expect(logo.frame.w).toBeLessThanOrEqual(capWidth + 0.01);
    expect(logo.frame.w).toBeLessThan(uncapped.frame.w);
    // aspectLock is 3 in the demo spec; capping must not distort it.
    expect(logo.frame.w / logo.frame.h).toBeCloseTo(3, 2);
  });

  it('heals a size cap that is zero or nonsense rather than rejecting the spec', () => {
    // Regression: typing "1" into a width field derived a height of 0, which
    // failed the schema and blanked the whole editor. Values that cannot mean
    // anything now mean "no cap on that axis".
    for (const maxSize of [{ w: 1, h: 0 }, { w: 0, h: 0 }, { w: -5 }, 'nonsense', null]) {
      const spec = {
        ...DEMO_SPEC,
        elements: DEMO_SPEC.elements.map((el) => (el.id === 'logo' ? { ...el, maxSize } : el)),
      } as AdSpec;
      expect(() => solve(spec, square), JSON.stringify(maxSize)).not.toThrow();
    }
  });

  it('lets the background bleed past the safe area', () => {
    const bg = solve(DEMO_SPEC, story).placed.find((p) => p.id === 'bg');
    expect(bg?.frame).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });

  it('never drops a protected element, even on a 320x50 banner', () => {
    const result = solve(DEMO_SPEC, banner);
    const droppedIds = new Set(result.dropped.map((d) => d.id));
    expect(droppedIds.has('headline')).toBe(false);
    expect(droppedIds.has('cta')).toBe(false);
  });

  it('drops more on a banner than on a square', () => {
    expect(solve(DEMO_SPEC, banner).dropped.length).toBeGreaterThan(
      solve(DEMO_SPEC, square).dropped.length,
    );
  });

  it('drops the highest priority number first', () => {
    const result = solve(DEMO_SPEC, banner);
    // `legal` is priority 90, the highest in the spec. It is bound to `badge`,
    // so the first round removes the pair — both are ordered together.
    const firstRound = result.dropped.slice(0, 2).map((d) => d.id);
    expect(firstRound).toContain('legal');
    expect(firstRound).toContain('badge');
  });

  it('honours alwaysPairs by dropping bound elements together', () => {
    const result = solve(DEMO_SPEC, banner);
    const droppedIds = new Set(result.dropped.map((d) => d.id));
    expect(droppedIds.has('legal')).toBe(droppedIds.has('badge'));
  });

  it('keeps a low-priority logo that nothing binds to a doomed element', () => {
    // Regression: pairing the logo to the legal line made every non-square
    // surface lose the brand mark for a reason that had nothing to do with it.
    const result = solve(DEMO_SPEC, presetSurface('leaderboard-728x90'));
    expect(result.dropped.map((d) => d.id)).not.toContain('logo');
  });

  it('only reports warnings about the layout it actually delivered', () => {
    const result = solve(DEMO_SPEC, banner);
    const droppedIds = new Set(result.dropped.map((d) => d.id));
    for (const warning of result.warnings) {
      for (const id of droppedIds) {
        expect(warning).not.toContain(`"${id}"`);
      }
    }
  });

  it('records a reason for every drop', () => {
    for (const d of solve(DEMO_SPEC, banner).dropped) {
      expect(d.reason.length).toBeGreaterThan(10);
    }
  });

  it('meets the tap target for the CTA', () => {
    const cta = solve(DEMO_SPEC, square).placed.find((p) => p.id === 'cta');
    expect(cta?.frame.h).toBeGreaterThanOrEqual(44);
  });

  it('meets the larger remote target on TV', () => {
    const cta = solve(DEMO_SPEC, presetSurface('tv-1920x1080')).placed.find((p) => p.id === 'cta');
    expect(cta?.frame.h).toBeGreaterThanOrEqual(64);
  });

  it('pre-wraps text instead of leaving it to the browser', () => {
    const headline = solve(DEMO_SPEC, presetSurface('mpu-300x250')).placed.find(
      (p) => p.id === 'headline',
    );
    expect(headline?.lines?.length).toBeGreaterThan(0);
    expect(headline?.lines?.join(' ')).toContain('trail');
  });

  it('emits a crop for every image', () => {
    for (const p of solve(DEMO_SPEC, square).placed) {
      const source = DEMO_SPEC.elements.find((e) => e.id === p.id);
      if (source?.content.kind === 'image') expect(p.imageCrop).toBeDefined();
    }
  });

  it('paints in z order, low first', () => {
    const zs = solve(DEMO_SPEC, square).placed.map((p) => p.z);
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
  });

  it('produces a trace with an entry for every pipeline stage it ran', () => {
    const steps = new Set(solve(DEMO_SPEC, square).trace.map((t) => t.step));
    for (const step of [
      'normalize',
      'classify',
      'selectArchetype',
      'budget',
      'fitText',
      'imageCrop',
      'fingerprint',
    ]) {
      expect(steps.has(step as never)).toBe(true);
    }
  });

  it('numbers trace entries monotonically from 1', () => {
    const trace = solve(DEMO_SPEC, square).trace;
    expect(trace.map((t) => t.seq)).toEqual(trace.map((_, i) => i + 1));
  });

  it('advances the trace pass counter once per degradation round', () => {
    const result = solve(DEMO_SPEC, banner);
    const rounds = result.trace.filter(
      (t) => t.step === 'degrade' && t.level === 'decision',
    ).length;
    expect(Math.max(...result.trace.map((t) => t.pass))).toBe(rounds);
    // A bound pair leaves in one round, so drops can outnumber rounds.
    expect(result.dropped.length).toBeGreaterThanOrEqual(rounds);
  });

  it('surfaces warnings on the result as well as in the trace', () => {
    const result = solve(DEMO_SPEC, banner);
    const traceWarnings = result.trace.filter((t) => t.level === 'warn').map((t) => t.message);
    for (const w of result.warnings) expect(traceWarnings).toContain(w);
  });

  it('pushes through a drop that temporarily makes the fit worse', () => {
    // Regression: at 400x130 removing the legal line leaves the deficit
    // slightly worse (201px -> 204px) and only the next drop resolves it.
    // Stopping at the first non-improving drop shipped a clamped, overlapping
    // layout with every element still on it.
    const cramped: Surface = {
      id: 'cramped',
      label: 'Cramped strip',
      width: 400,
      height: 130,
      dpr: 2,
      interactionHint: 'tap',
    };
    const result = solve(DEMO_SPEC, cramped);
    expect(result.dropped.length).toBeGreaterThan(2);
    expect(result.warnings).toEqual([]);
  });

  it('never ships a layout worse than one it already found', () => {
    // Whatever the degradation loop explores, the result it returns must be
    // the best fit it saw, not wherever it happened to stop.
    for (const width of [360, 400, 460, 520, 640]) {
      for (const height of [90, 130, 200, 320]) {
        const result = solve(DEMO_SPEC, {
          id: `${width}x${height}`,
          label: `${width}x${height}`,
          width,
          height,
          dpr: 2,
          interactionHint: 'tap',
        });
        // A clamped layout is allowed, but only when nothing droppable is left.
        const clamped = result.warnings.some((w) => w.includes('still overflows'));
        if (clamped) {
          const survivors = result.placed.map((p) => p.id);
          const droppable = survivors.filter((id) => !['bg', 'headline', 'cta'].includes(id));
          expect(
            droppable,
            `${width}x${height} clamped with ${droppable.join(',')} still droppable`,
          ).toEqual([]);
        }
      }
    }
  });

  it('works with a two-element spec and no rules block', () => {
    const result = solve(MINIMAL_SPEC, square);
    expect(result.placed).toHaveLength(2);
    expect(result.warnings.filter((w) => w.includes('overflow'))).toEqual([]);
  });
});

describe('solve — invalid input', () => {
  it('throws SpecError with issues for a malformed spec', () => {
    const bad = { ...MINIMAL_SPEC, elements: [] } as unknown as AdSpec;
    expect(() => solve(bad, square)).toThrowError(SpecError);
    try {
      solve(bad, square);
    } catch (err) {
      expect(err).toBeInstanceOf(SpecError);
      if (err instanceof SpecError) {
        expect(err.code).toBe('INVALID_SPEC');
        expect(err.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it('rejects duplicate element ids', () => {
    const dupe: AdSpec = {
      ...MINIMAL_SPEC,
      elements: [...MINIMAL_SPEC.elements, MINIMAL_SPEC.elements[0]!],
    };
    expect(() => solve(dupe, square)).toThrowError(/invalid/);
  });

  it('rejects rules that name unknown elements', () => {
    const bad: AdSpec = { ...MINIMAL_SPEC, rules: { neverDrop: ['nope'] } };
    expect(() => solve(bad, square)).toThrowError(SpecError);
  });

  it('throws when the safe area consumes the whole surface', () => {
    const impossible: Surface = {
      id: 'impossible',
      label: 'Impossible',
      width: 100,
      height: 100,
      dpr: 1,
      safeArea: { top: 60, right: 0, bottom: 60, left: 0 },
      interactionHint: 'tap',
    };
    expect(() => solve(MINIMAL_SPEC, impossible)).toThrowError(/safe area/);
  });

  it('rejects a surface with a non-integer dpr', () => {
    const bad = { ...square, dpr: 1.5 } as unknown as Surface;
    expect(() => solve(MINIMAL_SPEC, bad)).toThrowError(SpecError);
  });
});

/**
 * An author can write a ceiling below their own floor — a size handle dragged
 * past `minSize` does it in one gesture. The element is then unsatisfiable at
 * any size, and left alone it costs the rest of the layout: every pass reports
 * an unmet minimum, and degradation drops healthy elements chasing space that
 * would never have helped.
 */
describe('solve — a cap below the floor', () => {
  const withCappedLogo = (maxSize: { w?: number; h?: number }): AdSpec => ({
    ...DEMO_SPEC,
    elements: DEMO_SPEC.elements.map((el) =>
      el.id === 'logo' ? { ...el, minSize: { w: 48, h: 16 }, maxSize } : el,
    ),
  });

  it('raises the cap to the floor rather than starving the layout', () => {
    const result = solve(withCappedLogo({ w: 4, h: 4 }), story);
    const logo = result.placed.find((p) => p.id === 'logo');

    expect(logo).toBeDefined();
    expect(logo?.frame.w).toBeGreaterThanOrEqual(48);
    expect(logo?.frame.h).toBeGreaterThanOrEqual(16);
  });

  it('drops nothing that a sane cap would have kept', () => {
    const sane = solve(withCappedLogo({ w: 240 }), story);
    const absurd = solve(withCappedLogo({ w: 4, h: 4 }), story);

    expect(ids(absurd.dropped)).toEqual(ids(sane.dropped));
  });

  it('says it made the correction', () => {
    const result = solve(withCappedLogo({ h: 2 }), story);
    expect(result.warnings.some((w) => w.includes('caps itself below its own minimum'))).toBe(true);
  });

  it('leaves a cap on one axis alone when only the other is impossible', () => {
    const result = solve(withCappedLogo({ w: 240, h: 2 }), story);
    const logo = result.placed.find((p) => p.id === 'logo');
    expect(logo?.frame.w).toBeLessThanOrEqual(240.01);
    expect(logo?.frame.h).toBeGreaterThanOrEqual(16);
  });
});

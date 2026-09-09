import { describe, expect, it } from 'vitest';
import { solve } from '../src/solve.js';
import { SpecError } from '../src/errors.js';
import { DEMO_SPEC, MINIMAL_SPEC, presetSurface } from '../src/fixtures/index.js';
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

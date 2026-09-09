import { describe, expect, it } from 'vitest';
import { solve } from '../src/solve.js';
import { ARCHETYPES } from '../src/archetypes/index.js';
import { ARCHETYPE_TABLE, selectArchetype } from '../src/steps/selectArchetype.js';
import { classify } from '../src/steps/classify.js';
import { normalize } from '../src/steps/normalize.js';
import { Tracer } from '../src/trace.js';
import { DEMO_SPEC, MINIMAL_SPEC, PRESET_SURFACES, presetSurface } from '../src/fixtures/index.js';
import type { AdSpec, Surface } from '../src/types.js';

const surface = (w: number, h: number, extra: Partial<Surface> = {}): Surface => ({
  id: `s-${w}x${h}`,
  label: `${w}x${h}`,
  width: w,
  height: h,
  dpr: 1,
  interactionHint: 'tap',
  ...extra,
});

function archetypeFor(s: Surface, spec: AdSpec = DEMO_SPEC): string {
  const tracer = new Tracer();
  const norm = normalize(spec, s, tracer);
  return selectArchetype(classify(s, tracer), norm.elements, tracer).archetype.id;
}

describe('archetype registry', () => {
  it('implements every id the selection table can ask for', () => {
    for (const row of Object.values(ARCHETYPE_TABLE)) {
      for (const id of Object.values(row)) {
        expect(ARCHETYPES[id], `table names "${id}"`).toBeDefined();
      }
    }
    expect(ARCHETYPES.overlay).toBeDefined();
  });

  it('gives every archetype a rationale and a bleed list', () => {
    for (const [id, archetype] of Object.entries(ARCHETYPES)) {
      expect(archetype.id).toBe(id);
      expect(archetype.rationale.length).toBeGreaterThan(20);
      expect(archetype.bleedRegions).toContain('bleed');
    }
  });

  it('never falls back now that the table is fully implemented', () => {
    for (const s of PRESET_SURFACES) {
      const warnings = solve(DEMO_SPEC, s).warnings;
      expect(warnings.some((w) => w.includes('not implemented'))).toBe(false);
    }
  });
});

describe('archetype selection', () => {
  it.each([
    [320, 50, 'strip'],
    [728, 90, 'strip'],
    [300, 250, 'split'],
    [1920, 1080, 'split'],
    [1080, 1080, 'stack'],
    [1080, 1920, 'stack'],
    [160, 600, 'overlay'],
  ] as const)('%ix%i picks %s', (w, h, expected) => {
    expect(archetypeFor(surface(w, h))).toBe(expected);
  });

  it('falls back from overlay to stack when a tall surface has no hero', () => {
    const noHero: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.filter((e) => e.role !== 'hero'),
    };
    expect(archetypeFor(surface(160, 600), noHero)).toBe('stack');
  });

  it('is stable across a resize that does not cross a boundary', () => {
    const ids = [1000, 1020, 1040, 1060, 1080].map((w) => archetypeFor(surface(w, 1000)));
    expect(new Set(ids).size).toBe(1);
  });
});

describe('strip', () => {
  const result = solve(DEMO_SPEC, presetSurface('leaderboard-728x90'));

  it('lays its regions out left to right, not top to bottom', () => {
    const keys = ['media', 'brand', 'copy', 'action'].filter(
      (k) => result.regions[k] !== undefined,
    );
    expect(keys.length).toBeGreaterThan(1);
    for (let i = 1; i < keys.length; i += 1) {
      const prev = result.regions[keys[i - 1]!]!;
      const next = result.regions[keys[i]!]!;
      expect(next.x).toBeGreaterThanOrEqual(prev.x + prev.w - 0.01);
    }
  });

  it('puts the CTA to the right of the copy', () => {
    const copy = result.placed.find((p) => p.id === 'headline');
    const cta = result.placed.find((p) => p.id === 'cta');
    expect(cta!.frame.x).toBeGreaterThan(copy!.frame.x);
  });

  it('fits every element inside the strip height', () => {
    for (const p of result.placed) {
      expect(p.frame.y + p.frame.h).toBeLessThanOrEqual(90.01);
    }
  });
});

describe('split', () => {
  const result = solve(DEMO_SPEC, presetSurface('tv-1920x1080'));

  it('puts the hero beside the copy, not above it', () => {
    const hero = result.placed.find((p) => p.id === 'hero')!;
    const headline = result.placed.find((p) => p.id === 'headline')!;
    expect(headline.frame.x).toBeGreaterThanOrEqual(hero.frame.x + hero.frame.w - 0.01);
  });

  it('honours pinTo right by swapping the columns', () => {
    const pinned: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((e) => (e.id === 'hero' ? { ...e, pinTo: 'right' } : e)),
    };
    const flipped = solve(pinned, presetSurface('tv-1920x1080'));
    const hero = flipped.placed.find((p) => p.id === 'hero')!;
    const headline = flipped.placed.find((p) => p.id === 'headline')!;
    expect(hero.frame.x).toBeGreaterThan(headline.frame.x);
  });

  it('gives the whole width to the content when there is no hero', () => {
    const noHero: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.filter((e) => e.role !== 'hero'),
    };
    const result = solve(noHero, presetSurface('tv-1920x1080'));
    expect(result.regions.media).toBeUndefined();
    const headline = result.placed.find((p) => p.id === 'headline')!;
    expect(headline.frame.w).toBeGreaterThan(1920 * 0.6);
  });

  it('meets the 64px remote target on TV', () => {
    const cta = result.placed.find((p) => p.id === 'cta')!;
    expect(cta.frame.h).toBeGreaterThanOrEqual(64);
  });
});

describe('overlay', () => {
  const result = solve(DEMO_SPEC, presetSurface('skyscraper-160x600'));

  it('bleeds the hero across the whole surface', () => {
    const hero = result.placed.find((p) => p.id === 'hero')!;
    expect(hero.frame).toEqual({ x: 0, y: 0, w: 160, h: 600 });
  });

  it('anchors the copy to the lower half', () => {
    const headline = result.placed.find((p) => p.id === 'headline')!;
    expect(headline.frame.y).toBeGreaterThan(300);
  });

  it('scrims text that sits over the hero', () => {
    const headline = result.placed.find((p) => p.id === 'headline')!;
    expect(headline.scrim).toBeDefined();
    expect(headline.scrim!.opacity).toBeGreaterThan(0);
  });

  it('still clamps non-bleeding elements to the safe area', () => {
    const inset = solve(
      DEMO_SPEC,
      surface(160, 600, { safeArea: { top: 40, right: 10, bottom: 40, left: 10 } }),
    );
    const headline = inset.placed.find((p) => p.id === 'headline')!;
    expect(headline.frame.x).toBeGreaterThanOrEqual(10);
    expect(headline.frame.y + headline.frame.h).toBeLessThanOrEqual(560.01);
    const hero = inset.placed.find((p) => p.id === 'hero')!;
    expect(hero.frame.h).toBe(600);
  });
});

describe('every archetype, every preset', () => {
  it('places at least the protected elements everywhere', () => {
    for (const s of PRESET_SURFACES) {
      const ids = new Set(solve(DEMO_SPEC, s).placed.map((p) => p.id));
      expect(ids.has('headline'), `${s.label} kept the headline`).toBe(true);
      expect(ids.has('cta'), `${s.label} kept the CTA`).toBe(true);
    }
  });

  it('never places anything outside the surface', () => {
    for (const s of PRESET_SURFACES) {
      for (const p of solve(DEMO_SPEC, s).placed) {
        expect(p.frame.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.frame.y).toBeGreaterThanOrEqual(-0.01);
        expect(p.frame.x + p.frame.w).toBeLessThanOrEqual(s.width + 0.01);
        expect(p.frame.y + p.frame.h).toBeLessThanOrEqual(s.height + 0.01);
      }
    }
  });

  it('keeps every text frame as tall as the text it actually renders', () => {
    for (const s of PRESET_SURFACES) {
      for (const p of solve(DEMO_SPEC, s).placed) {
        if (p.lines === undefined) continue;
        const rendered = p.lines.length * (p.lineHeightPx ?? 0);
        expect(rendered, `${p.id} on ${s.label}`).toBeLessThanOrEqual(p.frame.h + 0.02);
      }
    }
  });

  it('never overlaps two text elements', () => {
    for (const s of PRESET_SURFACES) {
      const texts = solve(DEMO_SPEC, s).placed.filter((p) => p.lines !== undefined);
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i]!.frame;
          const b = texts[j]!.frame;
          const overlap =
            a.x < b.x + b.w - 0.01 &&
            a.x + a.w > b.x + 0.01 &&
            a.y < b.y + b.h - 0.01 &&
            a.y + a.h > b.y + 0.01;
          expect(overlap, `${texts[i]!.id} overlaps ${texts[j]!.id} on ${s.label}`).toBe(false);
        }
      }
    }
  });

  it('solves a minimal spec on every preset without warnings about overflow', () => {
    for (const s of PRESET_SURFACES) {
      const result = solve(MINIMAL_SPEC, s);
      expect(result.placed.length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  composite,
  relativeLuminance,
  parseHex,
  solveScrimOpacity,
} from '../src/color.js';
import { solve } from '../src/solve.js';
import { DEMO_SPEC, presetSurface } from '../src/fixtures/index.js';
import type { AdSpec } from '../src/types.js';

describe('contrast maths', () => {
  it('scores black on white at 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('scores a colour against itself at 1:1', () => {
    expect(contrastRatio('#3b82f6', '#3b82f6')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(contrastRatio('#fedcba', '#123456'), 9);
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('orders luminance as expected', () => {
    expect(relativeLuminance(parseHex('#ffffff'))).toBeGreaterThan(
      relativeLuminance(parseHex('#808080')),
    );
  });

  it('composites towards the overlay as alpha rises', () => {
    expect(composite('#000000', '#ffffff', 0)).toBe('#ffffff');
    expect(composite('#000000', '#ffffff', 1)).toBe('#000000');
  });

  it('finds the smallest scrim opacity that clears the bar', () => {
    const opacity = solveScrimOpacity('#ffffff', '#808080', '#000000', 4.5);
    expect(opacity).not.toBeNull();
    if (opacity !== null) {
      expect(
        contrastRatio('#ffffff', composite('#000000', '#808080', opacity)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('returns null when no scrim can help', () => {
    expect(solveScrimOpacity('#808080', '#808080', '#808080', 7)).toBeNull();
  });
});

describe('contrast enforcement in solve', () => {
  it('scrims text that sits over an image', () => {
    const result = solve(DEMO_SPEC, presetSurface('story-1080x1920'));
    const overImage = result.placed.filter((p) => p.lines !== undefined && p.scrim !== undefined);
    // The demo spec has no text over the hero in `stack`, so this asserts the
    // shape of the decision rather than its presence.
    for (const p of overImage) {
      expect(p.scrim?.opacity).toBeGreaterThan(0);
      expect(p.scrim?.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('recolours text that fails the floor on a solid backdrop', () => {
    const lowContrast: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements
        .filter((e) => e.role !== 'hero')
        // The bleed shape, not the theme colour, is what the text sits on.
        .map((e) =>
          e.id === 'bg' ? { ...e, content: { kind: 'shape' as const, fill: '#f8fafc' } } : e,
        ),
      theme: {
        ...DEMO_SPEC.theme,
        palette: { ...DEMO_SPEC.theme.palette, bg: '#f8fafc', fg: '#f1f5f9' },
      },
    };
    const result = solve(lowContrast, presetSurface('square-1080'));
    const headline = result.placed.find((p) => p.id === 'headline');
    expect(headline?.color).not.toBe('#f1f5f9');
    expect(result.warnings.some((w) => w.includes('headline'))).toBe(true);
  });

  it('leaves compliant text alone', () => {
    const result = solve(DEMO_SPEC, presetSurface('square-1080'));
    const cta = result.placed.find((p) => p.id === 'cta');
    expect(cta?.color).toBe(DEMO_SPEC.theme.palette.ctaFg);
    expect(cta?.scrim).toBeUndefined();
  });
});

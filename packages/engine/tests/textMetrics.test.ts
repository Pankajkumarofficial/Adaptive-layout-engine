import { describe, expect, it } from 'vitest';
import {
  ellipsize,
  estimateWidth,
  MEASUREMENT_ERROR_MARGIN,
  wrap,
} from '../src/measure/textMetrics.js';
import { classifyFamily } from '../src/measure/fontTables.js';
import referenceWidths from './fixtures/reference-widths.json' with { type: 'json' };

const inter = { family: 'Inter, sans-serif', fontSizePx: 16, weight: 400 };

describe('estimateWidth', () => {
  it('is zero for an empty string', () => {
    expect(estimateWidth('', inter)).toBe(0);
  });

  it('scales linearly with font size', () => {
    const a = estimateWidth('Adaptive layout', { ...inter, fontSizePx: 16 });
    const b = estimateWidth('Adaptive layout', { ...inter, fontSizePx: 32 });
    expect(b).toBeCloseTo(a * 2, 5);
  });

  it('makes bold text wider than regular', () => {
    expect(estimateWidth('Shop now', { ...inter, weight: 700 })).toBeGreaterThan(
      estimateWidth('Shop now', { ...inter, weight: 400 }),
    );
  });

  it('gives every monospace glyph the same advance', () => {
    const style = { family: 'Menlo, monospace', fontSizePx: 20, weight: 400 };
    const narrow = estimateWidth('iiiiiiiiii', style);
    expect(estimateWidth('abcdefghij', style)).toBeCloseTo(narrow, 6);
    expect(estimateWidth('WWWWWWWWWW', style)).toBeCloseTo(narrow, 6);
    // Menlo's measured advance is 0.6021em, not the folklore 0.6.
    expect(narrow / 10 / 20).toBeCloseTo(0.6021, 6);
  });

  it('counts an emoji once, not twice', () => {
    // Full width, give or take the family's string-fit correction.
    expect(estimateWidth('🎧', inter) / 16).toBeCloseTo(1, 1);
    expect(estimateWidth('🎧🎧', inter)).toBeCloseTo(2 * estimateWidth('🎧', inter), 6);
  });

  it('treats CJK as full width', () => {
    expect(estimateWidth('日本語', inter) / (3 * 16)).toBeCloseTo(1, 1);
  });

  it('is deterministic', () => {
    expect(estimateWidth('Every trail starts somewhere', inter)).toBe(
      estimateWidth('Every trail starts somewhere', inter),
    );
  });
});

describe('estimateWidth vs reference measurements', () => {
  // Provenance: see tests/fixtures/reference-widths.json and
  // scripts/measure-fonts.html, which regenerates the file in a real browser.
  for (const sample of referenceWidths.samples) {
    it(`is within ±${MEASUREMENT_ERROR_MARGIN * 100}% for "${sample.text}" (${sample.family})`, () => {
      const estimated = estimateWidth(sample.text, {
        family: sample.family,
        fontSizePx: sample.fontSizePx,
        weight: sample.weight,
      });
      const error = Math.abs(estimated - sample.measuredPx) / sample.measuredPx;
      expect(error).toBeLessThanOrEqual(MEASUREMENT_ERROR_MARGIN);
    });
  }
});

describe('classifyFamily', () => {
  it.each([
    ['Inter, system-ui, sans-serif', 'sans'],
    ['Georgia, serif', 'serif'],
    ['Menlo, monospace', 'mono'],
    ['SF Mono', 'mono'],
    ['Something Unknown', 'sans'],
  ] as const)('%s resolves to %s', (family, expected) => {
    expect(classifyFamily(family)).toBe(expected);
  });
});

describe('wrap', () => {
  it('keeps short text on one line', () => {
    expect(wrap('Shop now', inter, { maxWidthPx: 400 }).lines).toEqual(['Shop now']);
  });

  it('breaks at word boundaries', () => {
    const result = wrap('Every trail starts somewhere out there', inter, { maxWidthPx: 120 });
    expect(result.lines.length).toBeGreaterThan(1);
    for (const line of result.lines) {
      expect(line.startsWith(' ')).toBe(false);
      expect(line.endsWith(' ')).toBe(false);
    }
    expect(result.lines.join(' ')).toBe('Every trail starts somewhere out there');
  });

  it('never produces a line wider than the box', () => {
    const result = wrap('Boots, packs and layers built for the long way round.', inter, {
      maxWidthPx: 140,
    });
    for (const line of result.lines) {
      expect(estimateWidth(line, inter)).toBeLessThanOrEqual(140.01);
    }
  });

  it('hyphenates a single word that cannot fit', () => {
    const result = wrap('Donaudampfschifffahrtsgesellschaft', inter, { maxWidthPx: 60 });
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0]?.endsWith('-')).toBe(true);
    expect(result.lines.join('').replace(/-/g, '')).toBe('Donaudampfschifffahrtsgesellschaft');
  });

  it('honours explicit newlines', () => {
    expect(wrap('one\ntwo', inter, { maxWidthPx: 500 }).lines).toEqual(['one', 'two']);
  });

  it('truncates with an ellipsis at maxLines', () => {
    const result = wrap('Boots, packs and layers built for the long way round.', inter, {
      maxWidthPx: 100,
      maxLines: 2,
    });
    expect(result.lines).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.lines[1]?.endsWith('…')).toBe(true);
  });

  it('reports the widest line', () => {
    const result = wrap('aaa bbbbbbbbbb cc', inter, { maxWidthPx: 120 });
    const widest = Math.max(...result.lines.map((l) => estimateWidth(l, inter)));
    expect(result.maxLineWidthPx).toBeCloseTo(widest, 6);
  });

  it('terminates on a box narrower than one glyph', () => {
    const result = wrap('impossible', inter, { maxWidthPx: 1 });
    expect(result.lines.length).toBeGreaterThan(0);
  });
});

describe('ellipsize', () => {
  it('appends an ellipsis when it fits', () => {
    expect(ellipsize('Shop', inter, 400)).toBe('Shop…');
  });

  it('trims until the ellipsis fits', () => {
    const out = ellipsize('Boots packs and layers', inter, 60);
    expect(out.endsWith('…')).toBe(true);
    expect(estimateWidth(out, inter)).toBeLessThanOrEqual(60.01);
  });
});

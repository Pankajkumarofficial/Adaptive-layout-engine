import { describe, expect, it } from 'vitest';
import { fitText, typeLadder, TYPE_BASE_PX } from '../src/steps/fitText.js';
import { normalize } from '../src/steps/normalize.js';
import { Tracer } from '../src/trace.js';
import { estimateWidth, WIDTH_SAFETY_FACTOR } from '../src/measure/textMetrics.js';
import { MINIMAL_SPEC, presetSurface } from '../src/fixtures/index.js';
import type { AdSpec, Rect } from '../src/types.js';

const theme = MINIMAL_SPEC.theme;

function element(id: string, value: string, overrides: Partial<AdSpec['elements'][number]> = {}) {
  const spec: AdSpec = {
    ...MINIMAL_SPEC,
    elements: [
      {
        id,
        role: 'headline',
        priority: 0,
        content: { kind: 'text', value, maxLines: 4, minFontPx: 8 },
        ...overrides,
      },
    ],
  };
  const norm = normalize(spec, presetSurface('square-1080'), new Tracer());
  const el = norm.elements[0];
  if (el === undefined) throw new Error('fixture element missing');
  return el;
}

const box = (w: number, h: number): Rect => ({ x: 0, y: 0, w, h });

describe('fitText', () => {
  it('fills a large box with large type', () => {
    const fit = fitText(element('h', 'Hello'), box(600, 300), theme, new Tracer());
    expect(fit.fontSizePx).toBeGreaterThan(60);
    expect(fit.overflow).toBe(false);
  });

  it('shrinks type as the box narrows', () => {
    const el = element('h', 'Every trail starts somewhere');
    const wide = fitText(el, box(600, 200), theme, new Tracer()).fontSizePx;
    const narrow = fitText(el, box(200, 200), theme, new Tracer()).fontSizePx;
    expect(narrow).toBeLessThan(wide);
  });

  it('never returns a size below minFontPx', () => {
    const el = element('h', 'Every trail starts somewhere', {
      content: { kind: 'text', value: 'Every trail starts somewhere', maxLines: 1, minFontPx: 14 },
    });
    expect(fitText(el, box(40, 20), theme, new Tracer()).fontSizePx).toBeGreaterThanOrEqual(14);
  });

  it('flags overflow when even the floor does not fit', () => {
    const el = element('h', 'Every trail starts somewhere here and beyond', {
      content: {
        kind: 'text',
        value: 'Every trail starts somewhere here and beyond',
        maxLines: 1,
        minFontPx: 20,
      },
    });
    const fit = fitText(el, box(60, 24), theme, new Tracer());
    expect(fit.overflow).toBe(true);
    expect(fit.fontSizePx).toBe(20);
  });

  it('respects maxLines', () => {
    const el = element('h', 'Boots, packs and layers built for the long way round.', {
      content: {
        kind: 'text',
        value: 'Boots, packs and layers built for the long way round.',
        maxLines: 2,
        minFontPx: 8,
      },
    });
    expect(fitText(el, box(300, 400), theme, new Tracer()).lines.length).toBeLessThanOrEqual(2);
  });

  it('keeps every fitted line inside the safety-factored width', () => {
    const el = element('h', 'Boots, packs and layers built for the long way round.');
    const b = box(280, 400);
    const fit = fitText(el, b, theme, new Tracer());
    for (const line of fit.lines) {
      const w = estimateWidth(line, {
        family: theme.fontFamily,
        fontSizePx: fit.fontSizePx,
        weight: 700,
      });
      expect(w).toBeLessThanOrEqual(b.w * WIDTH_SAFETY_FACTOR + 0.01);
    }
  });

  it('keeps the text block inside the box height', () => {
    const el = element('h', 'Boots, packs and layers built for the long way round.');
    const b = box(300, 120);
    const fit = fitText(el, b, theme, new Tracer());
    expect(fit.blockHeightPx).toBeLessThanOrEqual(b.h + 0.01);
  });

  it('snaps to the typographic ladder when the cost is small', () => {
    const fit = fitText(element('h', 'Hi'), box(600, 300), theme, new Tracer());
    if (fit.snapped) {
      expect(typeLadder(theme.scaleRatio)).toContain(fit.fontSizePx);
    }
    expect(typeof fit.snapped).toBe('boolean');
  });

  it('is deterministic for the same box', () => {
    const el = element('h', 'Every trail starts somewhere');
    const a = fitText(el, box(321, 137), theme, new Tracer());
    const b = fitText(el, box(321, 137), theme, new Tracer());
    expect(a).toEqual(b);
  });

  it('is monotonic: a bigger box never yields smaller type', () => {
    const el = element('h', 'Every trail starts somewhere');
    let previous = 0;
    for (const w of [120, 200, 320, 480, 640]) {
      const size = fitText(el, box(w, 400), theme, new Tracer()).fontSizePx;
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
  });
});

describe('typeLadder', () => {
  it('contains the base size', () => {
    expect(typeLadder(1.25)).toContain(TYPE_BASE_PX);
  });

  it('is strictly ascending', () => {
    const ladder = typeLadder(1.25);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
    }
  });

  it('is denser for a smaller ratio', () => {
    const tight = typeLadder(1.125);
    const loose = typeLadder(1.5);
    expect(Math.max(...tight)).toBeLessThan(Math.max(...loose));
  });
});

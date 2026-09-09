import { describe, expect, it } from 'vitest';
import { allocateBands, compactRegion } from '../src/steps/budget.js';
import { rect } from '../src/geometry.js';

const box = rect(0, 0, 100, 300);

describe('allocateBands', () => {
  it('splits proportionally when nothing is constrained', () => {
    const { rects, shortfallPx } = allocateBands(
      box,
      [
        { key: 'a', weight: 1, min: 0 },
        { key: 'b', weight: 3, min: 0 },
      ],
      0,
      'vertical',
    );
    expect(shortfallPx).toBe(0);
    expect(rects.a?.h).toBeCloseTo(75, 6);
    expect(rects.b?.h).toBeCloseTo(225, 6);
  });

  it('subtracts gutters from the available extent', () => {
    const { rects } = allocateBands(
      box,
      [
        { key: 'a', weight: 1, min: 0 },
        { key: 'b', weight: 1, min: 0 },
      ],
      20,
      'vertical',
    );
    expect((rects.a?.h ?? 0) + (rects.b?.h ?? 0)).toBeCloseTo(280, 6);
    expect(rects.b?.y).toBeCloseTo(160, 6);
  });

  it('pins a band to its minimum and re-shares the rest', () => {
    const { rects, shortfallPx } = allocateBands(
      box,
      [
        { key: 'small', weight: 0.1, min: 100 },
        { key: 'big', weight: 0.9, min: 0 },
      ],
      0,
      'vertical',
    );
    expect(shortfallPx).toBe(0);
    expect(rects.small?.h).toBeCloseTo(100, 6);
    expect(rects.big?.h).toBeCloseTo(200, 6);
  });

  it('reports a shortfall and scales down when minimums cannot fit', () => {
    const { rects, shortfallPx } = allocateBands(
      box,
      [
        { key: 'a', weight: 1, min: 250 },
        { key: 'b', weight: 1, min: 250 },
      ],
      0,
      'vertical',
    );
    expect(shortfallPx).toBeCloseTo(200, 6);
    expect((rects.a?.h ?? 0) + (rects.b?.h ?? 0)).toBeCloseTo(300, 6);
    expect(rects.a?.h).toBeCloseTo(150, 6);
  });

  it('lays bands out horizontally when asked', () => {
    const { rects } = allocateBands(
      rect(10, 5, 300, 100),
      [
        { key: 'a', weight: 1, min: 0 },
        { key: 'b', weight: 1, min: 0 },
      ],
      0,
      'horizontal',
    );
    expect(rects.a).toEqual({ x: 10, y: 5, w: 150, h: 100 });
    expect(rects.b).toEqual({ x: 160, y: 5, w: 150, h: 100 });
  });

  it('handles zero bands', () => {
    expect(allocateBands(box, [], 8, 'vertical')).toEqual({ rects: {}, shortfallPx: 0 });
  });

  it('falls back to equal shares when every weight is zero', () => {
    const { rects } = allocateBands(
      box,
      [
        { key: 'a', weight: 0, min: 0 },
        { key: 'b', weight: 0, min: 0 },
      ],
      0,
      'vertical',
    );
    expect(rects.a?.h).toBeCloseTo(150, 6);
    expect(rects.b?.h).toBeCloseTo(150, 6);
  });

  it('never returns a negative size', () => {
    const { rects } = allocateBands(
      rect(0, 0, 100, 10),
      [
        { key: 'a', weight: 1, min: 40 },
        { key: 'b', weight: 1, min: 40 },
      ],
      20,
      'vertical',
    );
    for (const r of Object.values(rects)) expect(r.h).toBeGreaterThanOrEqual(0);
  });
});

describe('compactRegion', () => {
  it('centres a group of measured frames in its region', () => {
    const out = compactRegion(
      rect(0, 0, 100, 300),
      [
        { id: 'a', frame: rect(0, 0, 100, 40) },
        { id: 'b', frame: rect(0, 0, 100, 60) },
      ],
      10,
    );
    // 40 + 10 + 60 = 110, so the group starts at (300 - 110) / 2 = 95.
    expect(out.a?.y).toBeCloseTo(95, 6);
    expect(out.b?.y).toBeCloseTo(145, 6);
  });

  it('is a no-op for an empty region', () => {
    expect(compactRegion(rect(0, 0, 10, 10), [], 4)).toEqual({});
  });
});

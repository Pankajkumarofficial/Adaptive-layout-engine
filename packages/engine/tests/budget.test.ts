import { describe, expect, it } from 'vitest';
import { allocateBands, compactRegion, compactRow } from '../src/steps/budget.js';
import { rect } from '../src/geometry.js';
import type { Rect } from '../src/types.js';

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

describe('compactRow', () => {
  const region: Rect = { x: 100, y: 0, w: 1000, h: 60 };
  const item = (
    id: string,
    x: number,
    w: number,
    naturalW: number,
    align: 'left' | 'center' | 'right',
  ) => ({ id, frame: { x, y: 0, w, h: 60 }, naturalW, align });

  it('packs a row so the leftover falls outside the group, not inside it', () => {
    // The reported shape: a small logo and a one-word badge each holding half a
    // header, then sitting at opposite ends of their own half.
    const packed = compactRow(
      region,
      [item('logo', 100, 180, 180, 'left'), item('badge', 700, 400, 280, 'left')],
      24,
    );

    expect(packed.logo?.x).toBe(100);
    expect(packed.badge?.x).toBe(100 + 180 + 24);
    // The gap between them is the gutter and nothing else.
    const gap = packed.badge!.x - (packed.logo!.x + packed.logo!.w);
    expect(gap).toBe(24);
  });

  it('keeps a pinned element on its edge, because that was asked for', () => {
    const packed = compactRow(
      region,
      [item('logo', 100, 180, 180, 'left'), item('badge', 700, 400, 280, 'right')],
      24,
    );

    expect(packed.logo?.x).toBe(100);
    expect(packed.badge!.x + packed.badge!.w).toBeCloseTo(region.x + region.w, 5);
  });

  it('centres a centred run between the edges', () => {
    const packed = compactRow(
      region,
      [item('a', 100, 200, 200, 'center'), item('b', 400, 200, 200, 'center')],
      20,
    );
    const left = packed.a!.x;
    const right = packed.b!.x + packed.b!.w;
    expect(left - region.x).toBeCloseTo(region.x + region.w - right, 5);
  });

  it('leaves a full row alone rather than inventing an overlap', () => {
    const packed = compactRow(
      region,
      [item('a', 100, 600, 600, 'left'), item('b', 700, 600, 600, 'left')],
      24,
    );
    expect(packed).toEqual({});
  });

  it('does nothing to a row of one', () => {
    expect(compactRow(region, [item('only', 100, 200, 200, 'left')], 24)).toEqual({});
  });
});

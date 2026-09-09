import { describe, expect, it } from 'vitest';
import { coverCrop } from '../src/steps/imageCrop.js';
import { rect } from '../src/geometry.js';

const source = { w: 2400, h: 1600 };

describe('coverCrop', () => {
  it('uses the whole image when the aspect ratios match', () => {
    expect(coverCrop(source, rect(0, 0, 600, 400))).toEqual({ sx: 0, sy: 0, sw: 2400, sh: 1600 });
  });

  it('crops the sides for a narrower frame', () => {
    const crop = coverCrop(source, rect(0, 0, 400, 400));
    expect(crop.sh).toBe(1600);
    expect(crop.sw).toBe(1600);
    expect(crop.sx).toBe(400);
  });

  it('crops top and bottom for a wider frame', () => {
    const crop = coverCrop(source, rect(0, 0, 1600, 400));
    expect(crop.sw).toBe(2400);
    expect(crop.sh).toBe(600);
    expect(crop.sy).toBe(500);
  });

  it('keeps the crop window inside the source bounds', () => {
    for (const focal of [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.5 },
    ]) {
      const crop = coverCrop(source, rect(0, 0, 300, 500), focal);
      expect(crop.sx).toBeGreaterThanOrEqual(0);
      expect(crop.sy).toBeGreaterThanOrEqual(0);
      expect(crop.sx + crop.sw).toBeLessThanOrEqual(source.w + 0.01);
      expect(crop.sy + crop.sh).toBeLessThanOrEqual(source.h + 0.01);
    }
  });

  it('shifts the window towards the focal point', () => {
    const left = coverCrop(source, rect(0, 0, 400, 400), { x: 0.2, y: 0.5 });
    const right = coverCrop(source, rect(0, 0, 400, 400), { x: 0.8, y: 0.5 });
    expect(right.sx).toBeGreaterThan(left.sx);
  });

  it('defaults to the centre', () => {
    expect(coverCrop(source, rect(0, 0, 400, 400))).toEqual(
      coverCrop(source, rect(0, 0, 400, 400), { x: 0.5, y: 0.5 }),
    );
  });

  it('clamps out-of-range focal points instead of escaping the image', () => {
    const crop = coverCrop(source, rect(0, 0, 400, 400), { x: 5, y: -5 });
    expect(crop.sx).toBe(source.w - crop.sw);
    expect(crop.sy).toBe(0);
  });

  it('survives a degenerate frame', () => {
    const crop = coverCrop(source, rect(0, 0, 0, 0));
    expect(crop.sw).toBeGreaterThan(0);
    expect(crop.sh).toBeGreaterThan(0);
  });
});

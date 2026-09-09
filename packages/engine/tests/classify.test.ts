import { describe, expect, it } from 'vitest';
import { aspectBucketOf, classify, densityClassOf, gutterFor } from '../src/steps/classify.js';
import { Tracer } from '../src/trace.js';
import type { Surface } from '../src/types.js';

const surface = (w: number, h: number, extra: Partial<Surface> = {}): Surface => ({
  id: 's',
  label: 's',
  width: w,
  height: h,
  dpr: 1,
  interactionHint: 'tap',
  ...extra,
});

describe('aspect buckets', () => {
  // Worth pinning explicitly: a 9:16 story is 0.5625, which the brief's own
  // thresholds put in `portrait`, not `tall`. `tall` is skyscraper territory.
  it.each([
    [3000, 500, 'ultrawide'],
    [728, 90, 'ultrawide'],
    [1920, 1080, 'landscape'],
    [1080, 1080, 'square'],
    [1080, 1440, 'portrait'],
    [1080, 1920, 'portrait'],
    [160, 600, 'tall'],
  ] as const)('%ix%i is %s', (w, h, expected) => {
    expect(aspectBucketOf(w / h)).toBe(expected);
  });

  it('treats the boundaries as lower-inclusive', () => {
    expect(aspectBucketOf(2.2)).toBe('landscape');
    expect(aspectBucketOf(2.21)).toBe('ultrawide');
    expect(aspectBucketOf(1.2)).toBe('landscape');
    expect(aspectBucketOf(0.8)).toBe('square');
    expect(aspectBucketOf(0.45)).toBe('portrait');
    expect(aspectBucketOf(0.449)).toBe('tall');
  });
});

describe('density classes', () => {
  it.each([
    [320 * 50, 'micro'],
    [300 * 250, 'small'],
    [600 * 600, 'medium'],
    [1080 * 1080, 'large'],
  ] as const)('area %i is %s', (area, expected) => {
    expect(densityClassOf(area)).toBe(expected);
  });
});

describe('classify', () => {
  it('derives the touch target from the interaction hint', () => {
    const t = new Tracer();
    expect(classify(surface(800, 600, { interactionHint: 'tap' }), t).minTouchTarget).toBe(44);
    expect(classify(surface(800, 600, { interactionHint: 'click' }), t).minTouchTarget).toBe(24);
    expect(classify(surface(800, 600, { interactionHint: 'remote' }), t).minTouchTarget).toBe(64);
    expect(classify(surface(800, 600, { interactionHint: 'none' }), t).minTouchTarget).toBe(0);
  });

  it('subtracts the safe area from the content box', () => {
    const klass = classify(
      surface(1000, 1000, { safeArea: { top: 10, right: 20, bottom: 30, left: 40 } }),
      new Tracer(),
    );
    expect(klass.contentBox).toEqual({ x: 40, y: 10, w: 940, h: 960 });
  });

  it('scales the gutter with density', () => {
    expect(gutterFor('micro')).toBeLessThan(gutterFor('small'));
    expect(gutterFor('small')).toBeLessThan(gutterFor('medium'));
    expect(gutterFor('medium')).toBeLessThan(gutterFor('large'));
  });
});

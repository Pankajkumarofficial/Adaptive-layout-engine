import { describe, expect, it } from 'vitest';
import { solve } from '@ale/engine';
import { DEMO_SPEC, presetSurface } from '@ale/engine';
import type { AdSpec } from '@ale/engine';
import { capFromHandle, focalFromDrag, nearestEdge, panAxes, PINNABLE } from './gestures';

const INTRINSIC = { w: 2400, h: 1600 };

describe('nearestEdge', () => {
  it('resolves to the edge a drop is nearest', () => {
    expect(nearestEdge(0.05, 0.5)).toBe('left');
    expect(nearestEdge(0.95, 0.5)).toBe('right');
    expect(nearestEdge(0.5, 0.03)).toBe('top');
    expect(nearestEdge(0.5, 0.97)).toBe('bottom');
  });

  it('resolves to centre when no edge is close', () => {
    expect(nearestEdge(0.5, 0.5)).toBe('center');
  });

  it('picks the nearer of two edges in a corner', () => {
    // Nearer the top than the left, so a corner drop is not ambiguous.
    expect(nearestEdge(0.12, 0.04)).toBe('top');
    expect(nearestEdge(0.04, 0.12)).toBe('left');
  });
});

describe('panAxes', () => {
  it('locks an axis the crop did not trim', () => {
    const crop = { sx: 0, sy: 0, sw: 2400, sh: 1571 };
    expect(panAxes(INTRINSIC, crop)).toEqual({ x: false, y: true });
  });

  it('locks both axes when nothing was cropped', () => {
    const crop = { sx: 0, sy: 0, sw: 2400, sh: 1600 };
    expect(panAxes(INTRINSIC, crop)).toEqual({ x: false, y: false });
  });

  it('locks both axes when there is no crop at all', () => {
    expect(panAxes(INTRINSIC, undefined)).toEqual({ x: false, y: false });
  });
});

describe('focalFromDrag', () => {
  const crop = { sx: 800, sy: 0, sw: 800, sh: 1600 };
  const displayed = { w: 200, h: 400 };
  const pan = { x: true, y: false };

  it('moves the focal point opposite the drag, because the window travels', () => {
    const start = { x: 0.5, y: 0.5 };
    const dragged = focalFromDrag(start, -20, 0, displayed, INTRINSIC, crop, pan);
    // 20 displayed px is 80 intrinsic px, which is 1/30th of the image width.
    expect(dragged.x).toBeCloseTo(0.5 + 80 / 2400, 5);
  });

  it('leaves a locked axis exactly where it was', () => {
    const start = { x: 0.31, y: 0.62 };
    expect(focalFromDrag(start, 40, 400, displayed, INTRINSIC, crop, pan).y).toBe(0.62);
  });

  it('clamps to the unit square', () => {
    const start = { x: 0.5, y: 0.5 };
    expect(focalFromDrag(start, -100000, 0, displayed, INTRINSIC, crop, pan).x).toBe(1);
    expect(focalFromDrag(start, 100000, 0, displayed, INTRINSIC, crop, pan).x).toBe(0);
  });
});

describe('capFromHandle', () => {
  it('reads the handle in surface pixels, not screen pixels', () => {
    expect(capFromHandle(120, 60, 0.5)).toEqual({ w: 240, h: 120 });
  });

  it('never writes a cap the schema would reject', () => {
    expect(capFromHandle(0, -40, 0.25)).toEqual({ w: 8, h: 8 });
  });

  it('stops at the floor the element already declared', () => {
    // Dragged to nothing, against a logo whose minSize is 48x16.
    expect(capFromHandle(0, 0, 1, { w: 48, h: 16 })).toEqual({ w: 48, h: 16 });
  });

  it('leaves a cap above the floor alone', () => {
    expect(capFromHandle(240, 80, 1, { w: 48, h: 16 })).toEqual({ w: 240, h: 80 });
  });
});

/**
 * The claim the feature makes: a gesture edits the spec once and every surface
 * answers. If a pin only moved the surface you dragged on, the editor would be
 * the per-surface hand-authoring the engine exists to remove.
 */
describe('a single gesture reaches every surface', () => {
  const SURFACES = [
    'banner-320x50',
    'leaderboard-728x90',
    'mpu-300x250',
    'skyscraper-160x600',
    'square-1080',
    'story-1080x1920',
    'tv-1920x1080',
  ];

  const withLogoPinned = (pin: 'top' | 'bottom'): AdSpec => ({
    ...DEMO_SPEC,
    elements: DEMO_SPEC.elements.map((el) => (el.id === 'logo' ? { ...el, pinTo: pin } : el)),
  });

  it('pins the logo on every surface that still places it', () => {
    const top = withLogoPinned('top');
    const bottom = withLogoPinned('bottom');
    let moved = 0;

    for (const id of SURFACES) {
      const surface = presetSurface(id);
      const a = solve(top, surface).placed.find((p) => p.id === 'logo');
      const b = solve(bottom, surface).placed.find((p) => p.id === 'logo');
      if (a === undefined || b === undefined) continue;
      expect(b.frame.y).toBeGreaterThanOrEqual(a.frame.y);
      if (b.frame.y > a.frame.y) moved += 1;
    }

    // Not every surface has room to honour it — a 320×50 banner has one band —
    // but the majority must, or the gesture is decorative.
    expect(moved).toBeGreaterThanOrEqual(4);
  });

  it('recentres every crop when the focal point moves', () => {
    const left: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) =>
        el.id === 'hero' && el.content.kind === 'image'
          ? { ...el, content: { ...el.content, focalPoint: { x: 0.1, y: 0.5 } } }
          : el,
      ),
    };
    const right: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) =>
        el.id === 'hero' && el.content.kind === 'image'
          ? { ...el, content: { ...el.content, focalPoint: { x: 0.9, y: 0.5 } } }
          : el,
      ),
    };

    let recentred = 0;
    for (const id of SURFACES) {
      const surface = presetSurface(id);
      const a = solve(left, surface).placed.find((p) => p.id === 'hero');
      const b = solve(right, surface).placed.find((p) => p.id === 'hero');
      if (a?.imageCrop === undefined || b?.imageCrop === undefined) continue;
      // Only a surface that actually trims horizontally can answer.
      if (a.imageCrop.sw < 2400) {
        expect(b.imageCrop.sx).toBeGreaterThan(a.imageCrop.sx);
        recentred += 1;
      }
    }
    expect(recentred).toBeGreaterThan(0);
  });

  it('caps the logo everywhere once maxSize is written', () => {
    const capped: AdSpec = {
      ...DEMO_SPEC,
      elements: DEMO_SPEC.elements.map((el) =>
        el.id === 'logo' ? { ...el, maxSize: { w: 60 } } : el,
      ),
    };

    for (const id of SURFACES) {
      const surface = presetSurface(id);
      const logo = solve(capped, surface).placed.find((p) => p.id === 'logo');
      if (logo === undefined) continue;
      expect(logo.frame.w).toBeLessThanOrEqual(60.01);
    }
  });
});

describe('PINNABLE', () => {
  it('covers only roles whose position an author can express', () => {
    expect([...PINNABLE].sort()).toEqual(['badge', 'cta', 'legal', 'logo']);
  });
});

import { describe, expect, it } from 'vitest';
import { solve } from '../src/solve.js';
import { DEMO_SPEC, PRESET_SURFACES, presetSurface } from '../src/fixtures/index.js';
import { expectGolden } from './golden.js';

describe('golden layouts', () => {
  for (const surface of PRESET_SURFACES) {
    it(`is stable for ${surface.label}`, () => {
      expectGolden(`demo-${surface.id}`, solve(DEMO_SPEC, surface));
    });
  }

  it('is byte-identical across repeated solves', () => {
    const a = solve(DEMO_SPEC, presetSurface('square-1080'));
    const b = solve(DEMO_SPEC, presetSurface('square-1080'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('gives different surfaces different fingerprints', () => {
    const fingerprints = new Set(PRESET_SURFACES.map((s) => solve(DEMO_SPEC, s).fingerprint));
    expect(fingerprints.size).toBe(PRESET_SURFACES.length);
  });
});

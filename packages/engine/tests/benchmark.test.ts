import { describe, expect, it } from 'vitest';
import { solve } from '../src/solve.js';
import { DEMO_SPEC, PRESET_SURFACES, presetSurface } from '../src/fixtures/index.js';

/** The playground re-solves on every animation frame, so 5ms is the budget. */
const BUDGET_MS = 5;

function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[index] ?? 0;
}

describe('performance', () => {
  it(`solves a ${DEMO_SPEC.elements.length}-element spec in under ${BUDGET_MS}ms at the 95th percentile`, () => {
    const surface = presetSurface('story-1080x1920');
    // Warm up so the first-call compile cost is not measured.
    for (let i = 0; i < 50; i += 1) solve(DEMO_SPEC, surface);

    const samples: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const started = performance.now();
      solve(DEMO_SPEC, surface);
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);

    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);
    // Reported so `npm run bench` prints the distribution the README quotes.
    console.log(
      `solve(): p50 ${p50.toFixed(3)}ms  p95 ${p95.toFixed(3)}ms  max ${percentile(samples, 1).toFixed(3)}ms`,
    );
    expect(p95).toBeLessThan(BUDGET_MS);
  });

  it('stays within budget across the whole preset matrix', () => {
    for (const surface of PRESET_SURFACES) {
      for (let i = 0; i < 20; i += 1) solve(DEMO_SPEC, surface);
      const started = performance.now();
      for (let i = 0; i < 50; i += 1) solve(DEMO_SPEC, surface);
      const average = (performance.now() - started) / 50;
      expect(average, `${surface.label} averaged ${average.toFixed(3)}ms`).toBeLessThan(BUDGET_MS);
    }
  });
});

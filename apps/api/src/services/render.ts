import { solve } from '@ale/engine';
import type { AdSpec, LayoutResult, Surface } from '@ale/engine';

export interface TimedResult {
  result: LayoutResult;
  solveMs: number;
}

/**
 * The server-side solve.
 *
 * It calls exactly the same `solve()` the browser calls — same package, same
 * source. That is the whole reason the engine forbids DOM measurement and
 * platform APIs, and `tests/parity.test.ts` asserts the fingerprints match.
 */
export function renderMany(spec: AdSpec, surfaces: readonly Surface[]): TimedResult[] {
  return surfaces.map((surface) => {
    const started = performance.now();
    const result = solve(spec, surface);
    return { result, solveMs: Math.round((performance.now() - started) * 1000) / 1000 };
  });
}

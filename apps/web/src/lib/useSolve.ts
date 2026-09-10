import { useMemo } from 'react';
import { solve } from '@ale/engine';
import type { AdSpec, LayoutResult, Surface } from '@ale/engine';

export interface SolveOutcome {
  result: LayoutResult | null;
  /** A SpecError when the spec is invalid; its `issues` name the exact fields. */
  error: Error | null;
  /** Wall-clock time of the solve, in ms. Shown in the inspector. */
  ms: number;
}

/**
 * Solves on every render that changes the spec or surface — including every
 * frame of a resize drag. That is affordable because a solve is well under a
 * millisecond; if it ever stops being, the inspector's timing readout is where
 * it will show up first.
 */
export function useSolve(spec: AdSpec, surface: Surface): SolveOutcome {
  return useMemo(() => {
    const started = performance.now();
    try {
      const result = solve(spec, surface);
      return { result, error: null, ms: performance.now() - started };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err : new Error(String(err)),
        ms: performance.now() - started,
      };
    }
  }, [spec, surface]);
}

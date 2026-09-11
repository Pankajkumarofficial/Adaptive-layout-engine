import { useMemo, useRef } from 'react';
import { solve } from '@ale/engine';
import type { AdSpec, LayoutResult, Surface } from '@ale/engine';

export interface SolveOutcome {
  /** The current layout, or the last one that worked if the spec is mid-edit. */
  result: LayoutResult | null;
  /** True when `result` is the previous good layout rather than the current spec. */
  stale: boolean;
  /** A SpecError when the spec is invalid; its `issues` name the exact fields. */
  error: Error | null;
  /** Wall-clock time of the solve, in ms. */
  ms: number;
}

/**
 * Solves on every render that changes the spec or surface — including every
 * frame of a resize drag. That is affordable because a solve is well under a
 * millisecond.
 *
 * The last good result is kept and returned when the current one fails. Editing
 * passes through invalid states constantly — a half-typed number, a field
 * cleared to be retyped — and blanking the canvas on each of them takes away
 * the view you are editing against at exactly the moment you need it. The
 * layout goes stale rather than absent, and the error is shown over it.
 */
export function useSolve(spec: AdSpec, surface: Surface): SolveOutcome {
  const lastGood = useRef<LayoutResult | null>(null);

  return useMemo(() => {
    const started = performance.now();
    try {
      const result = solve(spec, surface);
      lastGood.current = result;
      return { result, stale: false, error: null, ms: performance.now() - started };
    } catch (err) {
      return {
        result: lastGood.current,
        stale: true,
        error: err instanceof Error ? err : new Error(String(err)),
        ms: performance.now() - started,
      };
    }
  }, [spec, surface]);
}

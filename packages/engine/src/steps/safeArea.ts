import { containRect, roundTo } from '../geometry.js';
import type { Rect, SurfaceClass } from '../types.js';
import type { NormalizedElement } from './normalize.js';
import type { Tracer } from '../trace.js';

export interface SafeAreaResult {
  frames: Record<string, Rect>;
  /** CTAs that had to be grown to meet the surface's touch-target floor. */
  grown: string[];
  /** CTAs still under the floor after clamping — the box is simply too small. */
  unresolved: string[];
}

/**
 * Step 7 — keep everything inside the safe area, and keep interactive things
 * big enough to hit.
 *
 * Regions are carved inside the content box already, so clamping is a guard
 * rather than the main event; growing CTAs is the part that can create new
 * pressure, which is why `solve` may re-enter the budget after this.
 */
export function enforceSafeArea(
  frames: Readonly<Record<string, Rect>>,
  elements: readonly NormalizedElement[],
  klass: SurfaceClass,
  tracer: Tracer,
): SafeAreaResult {
  const out: Record<string, Rect> = {};
  const grown: string[] = [];
  const unresolved: string[] = [];

  for (const el of elements) {
    const frame = frames[el.id];
    if (frame === undefined) continue;

    if (el.bleed) {
      // Backgrounds are meant to run under the notch; that is the whole point.
      out[el.id] = frame;
      continue;
    }

    let next = containRect(frame, klass.contentBox);

    if (el.role === 'cta' && klass.minTouchTarget > 0) {
      const needH = Math.max(klass.minTouchTarget, next.h);
      const needW = Math.max(klass.minTouchTarget, next.w);
      if (needH > next.h + 0.01 || needW > next.w + 0.01) {
        const candidate: Rect = {
          x: next.x - (needW - next.w) / 2,
          y: next.y - (needH - next.h) / 2,
          w: needW,
          h: needH,
        };
        next = containRect(candidate, klass.contentBox);
        grown.push(el.id);
        tracer.decision(
          'safeArea',
          `grew "${el.id}" to the ${klass.minTouchTarget}px ${describeTarget(klass)} target`,
          {
            subject: el.id,
            data: { w: roundTo(next.w), h: roundTo(next.h), target: klass.minTouchTarget },
          },
        );
        if (next.h + 0.01 < klass.minTouchTarget || next.w + 0.01 < klass.minTouchTarget) {
          unresolved.push(el.id);
        }
      }
    }

    out[el.id] = next;
  }

  return { frames: out, grown, unresolved };
}

function describeTarget(klass: SurfaceClass): string {
  return klass.minTouchTarget >= 64 ? 'remote focus' : klass.minTouchTarget >= 44 ? 'tap' : 'click';
}

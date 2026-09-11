import type { ElementRole, PinTo } from '../types.js';
import type { NormalizedElement } from '../steps/normalize.js';

/**
 * Reading order within a region, low first. Shared by every archetype so an
 * element's relationship to its neighbours does not change just because the
 * surface did.
 */
export const ROLE_RANK: Readonly<Record<ElementRole, number>> = {
  background: 0,
  logo: 1,
  badge: 2,
  hero: 3,
  headline: 4,
  subhead: 5,
  body: 6,
  cta: 7,
  legal: 8,
};

/** Deterministic ordering: reading order, then importance, then id. */
export function byReadingOrder(a: NormalizedElement, b: NormalizedElement): number {
  return (
    ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.priority - b.priority || a.id.localeCompare(b.id)
  );
}

/** Groups elements by the region an archetype assigns them to. */
export function groupByRegion(
  elements: readonly NormalizedElement[],
  regionKeyFor: (el: NormalizedElement) => string,
  skip: string,
): Map<string, NormalizedElement[]> {
  const out = new Map<string, NormalizedElement[]>();
  for (const el of elements) {
    const key = regionKeyFor(el);
    if (key === skip) continue;
    const list = out.get(key);
    if (list === undefined) out.set(key, [el]);
    else list.push(el);
  }
  return out;
}

/**
 * Only chrome may be re-homed by `pinTo`. Copy and hero keep their reading
 * order — a headline pinned to the footer is not a layout, it is a mistake.
 */
export const PINNABLE: ReadonlySet<ElementRole> = new Set<ElementRole>([
  'logo',
  'badge',
  'legal',
  'cta',
]);

/**
 * Resolves `pinTo` against the regions an archetype actually has.
 *
 * Every archetype has to do this or the setting silently does nothing on that
 * composition — which is exactly what happened when only `stack` honoured it.
 */
export function pinnedRegion(
  el: NormalizedElement,
  available: Partial<Record<PinTo, string>>,
): string | null {
  if (el.pinTo === null || !PINNABLE.has(el.role)) return null;
  return available[el.pinTo] ?? null;
}

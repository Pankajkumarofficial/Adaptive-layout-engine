import { allocateBands, minHeightOf, minWidthOf } from '../steps/budget.js';
import { insetRect, rect } from '../geometry.js';
import type { NormalizedElement } from '../steps/normalize.js';
import type { ElementRole, Rect, Surface } from '../types.js';
import { BLEED_REGION, type Archetype, type ArchetypeContext, type Assignment } from './types.js';
import { byReadingOrder, groupByRegion, pinnedRegion } from './shared.js';

/**
 * `strip` — one horizontal row, for banners and anything else with no vertical
 * room to spend.
 *
 * A 320x50 banner has about as much usable height as a single line of text, so
 * stacking is not an option: everything that survives has to sit side by side.
 * The row reads left to right as thumbnail, brand, message, action.
 */

const REGION_ORDER = ['media', 'brand', 'copy', 'action'] as const;
type RegionKey = (typeof REGION_ORDER)[number];

/** Share of the horizontal axis each region asks for before minimums apply. */
const REGION_WEIGHTS: Readonly<Record<RegionKey, number>> = {
  media: 0.16,
  brand: 0.16,
  copy: 0.44,
  action: 0.24,
};

const ROLE_REGION: Readonly<Record<ElementRole, RegionKey | typeof BLEED_REGION>> = {
  background: BLEED_REGION,
  hero: 'media',
  logo: 'brand',
  badge: 'brand',
  headline: 'copy',
  subhead: 'copy',
  body: 'copy',
  legal: 'copy',
  cta: 'action',
};

export function stripRegionKeyFor(el: NormalizedElement): string {
  // A row has no top or bottom to pin to; left and right are the ends.
  return pinnedRegion(el, { left: 'brand', right: 'action' }) ?? ROLE_REGION[el.role];
}

export const stripArchetype: Archetype = {
  id: 'strip',
  rationale: 'a single row is the only composition that fits when height is the scarce axis',
  bleedRegions: [BLEED_REGION],

  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect> {
    const pad = Math.min(ctx.gutter, ctx.content.h * 0.12);
    const inner = insetRect(ctx.content, { top: pad, right: pad, bottom: pad, left: pad });
    const occupancy = groupByRegion(ctx.elements, stripRegionKeyFor, BLEED_REGION);

    const bands = REGION_ORDER.filter((key) => occupancy.has(key)).map((key) => {
      const members = occupancy.get(key) ?? [];
      // Horizontal layout, so the binding constraint is width, not height.
      const min = members.reduce((widest, el) => {
        const aspect = el.aspectLock;
        // A logo with a locked aspect is as wide as the row is tall.
        const locked = aspect !== null && aspect > 0 ? inner.h * aspect : 0;
        return Math.max(widest, minWidthOf(el, ctx.klass), locked);
      }, 0);
      return { key, weight: REGION_WEIGHTS[key], min };
    });

    const allocation = allocateBands(inner, bands, ctx.gutter, 'horizontal');
    return {
      [BLEED_REGION]: rect(0, 0, surface.width, surface.height),
      ...allocation.rects,
    };
  },

  assign(elements: readonly NormalizedElement[], regions: Record<string, Rect>): Assignment[] {
    return elements
      .filter((el) => regions[stripRegionKeyFor(el)] !== undefined)
      .slice()
      .sort(byReadingOrder)
      .map((el) => ({ elementId: el.id, region: stripRegionKeyFor(el) }));
  },
};

/** Re-exported for tests that need the same minimum the archetype used. */
export { minHeightOf };

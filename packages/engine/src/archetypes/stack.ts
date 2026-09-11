import { allocateBands, minHeightOf } from '../steps/budget.js';
import { insetRect, rect } from '../geometry.js';
import type { NormalizedElement } from '../steps/normalize.js';
import type { ElementRole, Rect, Surface } from '../types.js';
import { BLEED_REGION, type Archetype, type ArchetypeContext, type Assignment } from './types.js';
import { byReadingOrder, groupByRegion, pinnedRegion } from './shared.js';

/**
 * `stack` — vertical flow for portrait and square surfaces.
 *
 * Reading order top to bottom: hero, brand, copy, action, legal. This is the
 * default composition and the one every other archetype is measured against.
 */

const REGION_ORDER = ['media', 'header', 'copy', 'action', 'footer'] as const;
type RegionKey = (typeof REGION_ORDER)[number];

/** Share of the vertical axis each region asks for before minimums apply. */
const REGION_WEIGHTS: Readonly<Record<RegionKey, number>> = {
  media: 0.44,
  header: 0.1,
  copy: 0.3,
  action: 0.12,
  footer: 0.04,
};

const ROLE_REGION: Readonly<Record<ElementRole, RegionKey | typeof BLEED_REGION>> = {
  background: BLEED_REGION,
  hero: 'media',
  logo: 'header',
  badge: 'header',
  headline: 'copy',
  subhead: 'copy',
  body: 'copy',
  cta: 'action',
  legal: 'footer',
};

export function regionKeyFor(el: NormalizedElement): string {
  return pinnedRegion(el, { top: 'header', bottom: 'footer' }) ?? ROLE_REGION[el.role];
}

export const stackArchetype: Archetype = {
  id: 'stack',
  rationale: 'vertical reading order suits portrait and square surfaces with room to breathe',
  bleedRegions: [BLEED_REGION],

  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect> {
    const inner = insetRect(ctx.content, {
      top: ctx.gutter,
      right: ctx.gutter,
      bottom: ctx.gutter,
      left: ctx.gutter,
    });

    const occupancy = groupByRegion(ctx.elements, regionKeyFor, BLEED_REGION);

    const bands = REGION_ORDER.filter((key) => occupancy.has(key)).map((key) => {
      const members = occupancy.get(key) ?? [];
      const mins = members.map((el) => minHeightOf(el, ctx.klass, ctx.gutter));
      // A region must be at least as tall as everything it has to stack.
      const min = mins.reduce((a, b) => a + b, 0) + ctx.gutter * Math.max(0, members.length - 1);
      return { key, weight: REGION_WEIGHTS[key], min };
    });

    const allocation = allocateBands(inner, bands, ctx.gutter, 'vertical');
    return {
      [BLEED_REGION]: rect(0, 0, surface.width, surface.height),
      ...allocation.rects,
    };
  },

  assign(elements: readonly NormalizedElement[], regions: Record<string, Rect>): Assignment[] {
    return elements
      .filter((el) => regions[regionKeyFor(el)] !== undefined)
      .slice()
      .sort(byReadingOrder)
      .map((el) => ({ elementId: el.id, region: regionKeyFor(el) }));
  },
};

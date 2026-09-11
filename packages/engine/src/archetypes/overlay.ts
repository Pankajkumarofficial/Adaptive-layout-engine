import { allocateBands, minHeightOf } from '../steps/budget.js';
import { insetRect, rect } from '../geometry.js';
import type { NormalizedElement } from '../steps/normalize.js';
import type { ElementRole, Rect, Surface } from '../types.js';
import { BLEED_REGION, type Archetype, type ArchetypeContext, type Assignment } from './types.js';
import { byReadingOrder, groupByRegion, pinnedRegion } from './shared.js';

/**
 * `overlay` — full-bleed hero with the copy sitting on top of it.
 *
 * For very tall surfaces there is no proportion that gives both a decent image
 * and a decent block of type; the only way to use the whole canvas is to let
 * them share it. The copy is anchored to the bottom, where a scrim reads as
 * intentional rather than as a patch, and step 9 puts one there automatically
 * because text over an image can never be proven to meet contrast.
 */

const REGION_ORDER = ['header', 'spacer', 'copy', 'action', 'footer'] as const;
type RegionKey = (typeof REGION_ORDER)[number];

/**
 * `spacer` holds no elements. It exists to soak up the leftover height so the
 * copy stays anchored to the bottom instead of drifting to the middle.
 */
const REGION_WEIGHTS: Readonly<Record<RegionKey, number>> = {
  header: 0.1,
  spacer: 0.52,
  copy: 0.2,
  action: 0.13,
  footer: 0.05,
};

const ROLE_REGION: Readonly<Record<ElementRole, RegionKey | 'media' | typeof BLEED_REGION>> = {
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

export function overlayRegionKeyFor(el: NormalizedElement): string {
  return pinnedRegion(el, { top: 'header', bottom: 'footer' }) ?? ROLE_REGION[el.role];
}

export const overlayArchetype: Archetype = {
  id: 'overlay',
  rationale:
    'a very tall canvas cannot afford to divide image from type, so the type sits on the image',
  bleedRegions: [BLEED_REGION, 'media'],
  rowRegions: ['header', 'footer'],

  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect> {
    const full = rect(0, 0, surface.width, surface.height);
    const inner = insetRect(ctx.content, {
      top: ctx.gutter,
      right: ctx.gutter,
      bottom: ctx.gutter,
      left: ctx.gutter,
    });

    const occupancy = groupByRegion(ctx.elements, overlayRegionKeyFor, BLEED_REGION);
    const hasHero = ctx.elements.some((el) => overlayRegionKeyFor(el) === 'media');

    const bands = REGION_ORDER.filter((key) => key === 'spacer' || occupancy.has(key)).map(
      (key) => {
        const members = occupancy.get(key) ?? [];
        const min =
          members.reduce((acc, el) => acc + minHeightOf(el, ctx.klass, ctx.gutter), 0) +
          ctx.gutter * Math.max(0, members.length - 1);
        return { key, weight: REGION_WEIGHTS[key], min };
      },
    );

    const allocation = allocateBands(inner, bands, ctx.gutter, 'vertical');

    return {
      [BLEED_REGION]: full,
      // The hero is the canvas, not an element on it.
      ...(hasHero ? { media: full } : {}),
      ...allocation.rects,
    };
  },

  assign(elements: readonly NormalizedElement[], regions: Record<string, Rect>): Assignment[] {
    return elements
      .filter((el) => regions[overlayRegionKeyFor(el)] !== undefined)
      .slice()
      .sort(byReadingOrder)
      .map((el) => ({ elementId: el.id, region: overlayRegionKeyFor(el) }));
  },
};

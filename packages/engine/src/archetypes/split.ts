import { allocateBands, minHeightOf, minWidthOf } from '../steps/budget.js';
import { insetRect, rect } from '../geometry.js';
import type { NormalizedElement } from '../steps/normalize.js';
import type { ElementRole, Rect, Surface } from '../types.js';
import { BLEED_REGION, type Archetype, type ArchetypeContext, type Assignment } from './types.js';
import { byReadingOrder, groupByRegion, pinnedRegion } from './shared.js';

/**
 * `split` — hero on one side, everything else stacked on the other.
 *
 * Landscape surfaces have width to spare and not much height, so putting the
 * image above the copy wastes the axis that is actually scarce. Side by side
 * keeps the type large enough to read at TV distance.
 */

const COLUMN_ORDER = ['media', 'content'] as const;
const CONTENT_ORDER = ['header', 'copy', 'action', 'footer'] as const;
type ContentKey = (typeof CONTENT_ORDER)[number];

/** The hero's share of the horizontal axis. */
const MEDIA_WEIGHT = 0.44;
const CONTENT_WEIGHT = 0.56;

const CONTENT_WEIGHTS: Readonly<Record<ContentKey, number>> = {
  header: 0.14,
  copy: 0.48,
  action: 0.26,
  footer: 0.12,
};

const ROLE_REGION: Readonly<Record<ElementRole, ContentKey | 'media' | typeof BLEED_REGION>> = {
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

export function splitRegionKeyFor(el: NormalizedElement): string {
  return pinnedRegion(el, { top: 'header', bottom: 'footer' }) ?? ROLE_REGION[el.role];
}

export const splitArchetype: Archetype = {
  id: 'split',
  rationale:
    'landscape surfaces have width to spare and height to protect, so the hero sits beside the copy',
  bleedRegions: [BLEED_REGION],

  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect> {
    const inner = insetRect(ctx.content, {
      top: ctx.gutter,
      right: ctx.gutter,
      bottom: ctx.gutter,
      left: ctx.gutter,
    });

    const occupancy = groupByRegion(ctx.elements, splitRegionKeyFor, BLEED_REGION);
    const hero = ctx.elements.find((el) => splitRegionKeyFor(el) === 'media');

    // With no hero there is nothing to split, so content takes the full width.
    const columns = COLUMN_ORDER.filter((key) => key === 'content' || hero !== undefined).map(
      (key) => ({
        key,
        weight: key === 'media' ? MEDIA_WEIGHT : CONTENT_WEIGHT,
        min: key === 'media' && hero !== undefined ? minWidthOf(hero, ctx.klass) : 0,
      }),
    );

    const columnAllocation = allocateBands(inner, columns, ctx.gutter, 'horizontal');
    const media = columnAllocation.rects.media;
    const content = columnAllocation.rects.content ?? inner;

    // The hero honours `pinTo: 'right'`; otherwise it leads, as it would in print.
    const heroOnRight = hero?.pinTo === 'right';
    const mediaRect = media !== undefined && heroOnRight ? { ...media, x: content.x } : media;
    const contentRect = media !== undefined && heroOnRight ? { ...content, x: media.x } : content;

    const contentBands = CONTENT_ORDER.filter((key) => occupancy.has(key)).map((key) => {
      const members = occupancy.get(key) ?? [];
      const min =
        members.reduce((acc, el) => acc + minHeightOf(el, ctx.klass, ctx.gutter), 0) +
        ctx.gutter * Math.max(0, members.length - 1);
      return { key, weight: CONTENT_WEIGHTS[key], min };
    });

    const contentAllocation = allocateBands(contentRect, contentBands, ctx.gutter, 'vertical');

    return {
      [BLEED_REGION]: rect(0, 0, surface.width, surface.height),
      ...(mediaRect !== undefined ? { media: mediaRect } : {}),
      ...contentAllocation.rects,
    };
  },

  assign(elements: readonly NormalizedElement[], regions: Record<string, Rect>): Assignment[] {
    return elements
      .filter((el) => regions[splitRegionKeyFor(el)] !== undefined)
      .slice()
      .sort(byReadingOrder)
      .map((el) => ({ elementId: el.id, region: splitRegionKeyFor(el) }));
  },
};

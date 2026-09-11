import { allocateBands, minHeightOf } from '../steps/budget.js';
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

const CONTENT_ORDER = ['header', 'copy', 'action', 'footer'] as const;
type ContentKey = (typeof CONTENT_ORDER)[number];

/**
 * Bounds on the hero's share of the horizontal axis.
 *
 * Within these the image's own proportions choose: a landscape photograph
 * wants a wide column because it needs little height, a portrait one wants a
 * narrow column because it needs all of it. A single fixed split forced every
 * image into the same slot, and a landscape photo in a full-height column is
 * cover-cropped to a vertical sliver — half the picture thrown away on a 16:9
 * surface, two thirds of it on an MPU.
 */
const MEDIA_MIN_SHARE = 0.3;
const MEDIA_MAX_SHARE = 0.55;
/** Used when the hero has no intrinsic aspect to reason about. */
const MEDIA_DEFAULT_SHARE = 0.44;

/** The hero's intrinsic aspect, when it has one. */
function heroAspect(hero: NormalizedElement): number | null {
  const content = hero.source.content;
  if (content.kind !== 'image') return null;
  const aspect = content.intrinsic.w / content.intrinsic.h;
  return Number.isFinite(aspect) && aspect > 0 ? aspect : null;
}

/** Width the hero wants: enough to fill the height at its own proportions. */
function mediaWidthFor(hero: NormalizedElement, height: number, available: number): number {
  const aspect = heroAspect(hero);
  if (aspect === null) return available * MEDIA_DEFAULT_SHARE;
  return Math.max(
    available * MEDIA_MIN_SHARE,
    Math.min(available * MEDIA_MAX_SHARE, height * aspect),
  );
}

/** Height that keeps the picture whole at the width it was given. */
function mediaHeightFor(hero: NormalizedElement, width: number, available: number): number {
  const aspect = heroAspect(hero);
  if (aspect === null) return available;
  return Math.min(available, width / aspect);
}

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
  rowRegions: ['header', 'footer'],

  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect> {
    const inner = insetRect(ctx.content, {
      top: ctx.gutter,
      right: ctx.gutter,
      bottom: ctx.gutter,
      left: ctx.gutter,
    });

    const occupancy = groupByRegion(ctx.elements, splitRegionKeyFor, BLEED_REGION);
    const hero = ctx.elements.find((el) => splitRegionKeyFor(el) === 'media');

    // Two columns, laid out directly rather than by weight. The hero's own
    // proportions choose the split, so the picture is shown whole instead of
    // being sliced to fit a slot that was sized without looking at it.
    const gap = hero === undefined ? 0 : ctx.gutter;
    const available = Math.max(0, inner.w - gap);
    const mediaWidth = hero === undefined ? 0 : mediaWidthFor(hero, inner.h, available);
    const contentWidth = Math.max(0, available - mediaWidth);
    const mediaHeight = hero === undefined ? 0 : mediaHeightFor(hero, mediaWidth, inner.h);

    // The hero honours `pinTo: 'right'`; otherwise it leads, as it would in print.
    const heroOnRight = hero?.pinTo === 'right';
    const mediaX = heroOnRight ? inner.x + contentWidth + gap : inner.x;
    const contentX = heroOnRight ? inner.x : inner.x + mediaWidth + gap;

    const mediaRect =
      hero === undefined
        ? undefined
        : {
            x: mediaX,
            y: inner.y + (inner.h - mediaHeight) / 2,
            w: mediaWidth,
            h: mediaHeight,
          };
    const contentRect = { x: contentX, y: inner.y, w: contentWidth, h: inner.h };

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

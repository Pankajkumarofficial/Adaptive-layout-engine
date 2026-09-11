import { clamp, containRect, rect } from '../geometry.js';
import type { Rect, SurfaceClass } from '../types.js';
import type { NormalizedElement } from './normalize.js';
import type { Assignment } from '../archetypes/types.js';
import type { Tracer } from '../trace.js';

export type Axis = 'vertical' | 'horizontal';

export interface BandRequest {
  key: string;
  /** Relative share of leftover space after every minimum is satisfied. */
  weight: number;
  /** Hard floor in px along the main axis. */
  min: number;
}

export interface BandAllocation {
  rects: Record<string, Rect>;
  /** px of minimum that could not be satisfied. 0 means everything fit. */
  shortfallPx: number;
}

/**
 * Step 4 core — weighted space allocation with hard minimums.
 *
 * Bands get a weight-proportional share; any band that lands under its minimum
 * is pinned there and the rest re-share what's left. When the minimums alone
 * exceed the box, every band is scaled down proportionally and the difference
 * is reported as a shortfall for `degrade` to act on.
 */
export function allocateBands(
  box: Rect,
  bands: readonly BandRequest[],
  gutter: number,
  axis: Axis,
): BandAllocation {
  const rects: Record<string, Rect> = {};
  const n = bands.length;
  if (n === 0) return { rects, shortfallPx: 0 };

  const extent = axis === 'vertical' ? box.h : box.w;
  const total = extent - gutter * (n - 1);
  const sumMin = bands.reduce((acc, b) => acc + b.min, 0);

  const sizes = new Array<number>(n).fill(0);
  let shortfallPx = 0;

  if (total <= 0) {
    shortfallPx = sumMin + Math.max(0, -total);
  } else if (sumMin > total) {
    const scale = total / sumMin;
    for (let i = 0; i < n; i += 1) sizes[i] = (bands[i]?.min ?? 0) * scale;
    shortfallPx = sumMin - total;
  } else {
    const pinned = new Array<boolean>(n).fill(false);
    for (let guard = 0; guard <= n; guard += 1) {
      let pinnedTotal = 0;
      let freeWeight = 0;
      let freeCount = 0;
      for (let i = 0; i < n; i += 1) {
        if (pinned[i]) pinnedTotal += sizes[i] ?? 0;
        else {
          freeWeight += bands[i]?.weight ?? 0;
          freeCount += 1;
        }
      }
      const remaining = Math.max(0, total - pinnedTotal);
      let changed = false;
      for (let i = 0; i < n; i += 1) {
        if (pinned[i]) continue;
        const band = bands[i];
        if (band === undefined) continue;
        const share =
          freeWeight > 0
            ? (remaining * band.weight) / freeWeight
            : freeCount > 0
              ? remaining / freeCount
              : 0;
        if (share < band.min) {
          sizes[i] = band.min;
          pinned[i] = true;
          changed = true;
        } else {
          sizes[i] = share;
        }
      }
      if (!changed) break;
    }
  }

  let cursor = axis === 'vertical' ? box.y : box.x;
  for (let i = 0; i < n; i += 1) {
    const band = bands[i];
    if (band === undefined) continue;
    const size = sizes[i] ?? 0;
    rects[band.key] =
      axis === 'vertical' ? rect(box.x, cursor, box.w, size) : rect(cursor, box.y, size, box.h);
    cursor += size + gutter;
  }

  return { rects, shortfallPx };
}

// ---------------------------------------------------------------------------
// Element-level budgeting
// ---------------------------------------------------------------------------

export interface Shortfall {
  elementId: string;
  axis: 'w' | 'h';
  required: number;
  available: number;
}

export interface BudgetResult {
  /** Provisional frames, keyed by element id. `fitText` refines text heights. */
  frames: Record<string, Rect>;
  shortfalls: Shortfall[];
  /** Sum of every unmet px. Zero means the layout fits as specified. */
  deficitPx: number;
}

/** Vertical padding inside a CTA chip, as a fraction of the gutter. */
const CTA_PAD_RATIO = 0.75;

/** Smallest main-axis extent at which an element still communicates anything. */
export function minHeightOf(el: NormalizedElement, klass: SurfaceClass, gutter: number): number {
  if (el.bleed) return 0;
  if (el.text !== null) {
    const oneLine = el.text.minFontPx * el.text.leading;
    if (el.role === 'cta') {
      return Math.max(klass.minTouchTarget, el.minSize.h, oneLine + gutter * CTA_PAD_RATIO * 2);
    }
    return Math.max(el.minSize.h, oneLine);
  }
  return el.minSize.h;
}

export function minWidthOf(el: NormalizedElement, klass: SurfaceClass): number {
  if (el.bleed) return 0;
  if (el.role === 'cta') return Math.max(el.minSize.w, klass.minTouchTarget);
  return el.minSize.w;
}

/**
 * Step 4 — carve each region into per-element frames.
 *
 * Regions are already sized by the archetype; this decides who gets how much of
 * one, honouring `minSize`, `aspectLock` and the surface's touch-target floor.
 */
export function budget(
  regions: Readonly<Record<string, Rect>>,
  assignments: readonly Assignment[],
  elements: readonly NormalizedElement[],
  klass: SurfaceClass,
  gutter: number,
  bleeding: ReadonlySet<string>,
  rowRegions: ReadonlySet<string>,
  tracer: Tracer,
): BudgetResult {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const frames: Record<string, Rect> = {};
  const shortfalls: Shortfall[] = [];

  const grouped = new Map<string, NormalizedElement[]>();
  for (const a of assignments) {
    const el = byId.get(a.elementId);
    if (el === undefined) continue;
    const list = grouped.get(a.region);
    if (list === undefined) grouped.set(a.region, [el]);
    else list.push(el);
  }

  for (const [regionKey, regionElements] of grouped) {
    const region = regions[regionKey];
    if (region === undefined) continue;

    // Anything that bleeds fills its region outright. Bands divide a region
    // between elements that have to share it; a background shares with nobody,
    // and two of them stacked must overlap, not take half the surface each.
    const stacked: NormalizedElement[] = [];
    for (const el of regionElements) {
      if (bleeding.has(el.id)) frames[el.id] = region;
      else stacked.push(el);
    }
    if (stacked.length === 0) continue;

    if (stacked.length === 1) {
      const only = stacked[0];
      if (only !== undefined) {
        frames[only.id] = fitInBand(only, region, klass, false);
        continue;
      }
    }

    // A row divides its width between elements; a column divides its height.
    const axis: Axis = rowRegions.has(regionKey) ? 'horizontal' : 'vertical';
    const bands = stacked.map((el) => ({
      key: el.id,
      weight: el.bandWeight,
      min: axis === 'horizontal' ? minWidthOf(el, klass) : minHeightOf(el, klass, gutter),
    }));
    const allocation = allocateBands(region, bands, gutter, axis);
    if (allocation.shortfallPx > 0) {
      tracer.info('budget', `region "${regionKey}" is ${round1(allocation.shortfallPx)}px short`, {
        subject: regionKey,
        data: { shortfallPx: round1(allocation.shortfallPx) },
      });
    }
    for (const el of stacked) {
      const band = allocation.rects[el.id];
      if (band === undefined) continue;
      frames[el.id] = fitInBand(el, band, klass, bleeding.has(el.id));
    }
  }

  for (const el of elements) {
    const frame = frames[el.id];
    if (frame === undefined || bleeding.has(el.id)) continue;
    const minH = minHeightOf(el, klass, gutter);
    const minW = minWidthOf(el, klass);
    if (frame.h + 0.01 < minH) {
      shortfalls.push({ elementId: el.id, axis: 'h', required: minH, available: frame.h });
    }
    if (frame.w + 0.01 < minW) {
      shortfalls.push({ elementId: el.id, axis: 'w', required: minW, available: frame.w });
    }
  }

  const deficitPx = shortfalls.reduce((acc, s) => acc + (s.required - s.available), 0);

  tracer.info('budget', `${Object.keys(frames).length} frames placed`, {
    data: { deficitPx: round1(deficitPx), shortfalls: shortfalls.length },
  });

  return { frames, shortfalls, deficitPx };
}

/** Applies aspect lock and cross-axis alignment inside an allocated band. */
function fitInBand(el: NormalizedElement, band: Rect, klass: SurfaceClass, bleeds: boolean): Rect {
  if (bleeds) return band;

  let w = band.w;
  let h = band.h;

  if (el.aspectLock !== null && el.aspectLock > 0) {
    w = Math.min(band.w, band.h * el.aspectLock);
    h = w / el.aspectLock;
  } else if (el.role === 'logo' || el.role === 'badge') {
    w = Math.min(band.w, Math.max(el.minSize.w, band.h * 3));
  }

  if (el.maxSize !== null) {
    if (el.maxSize.w !== undefined) w = Math.min(w, el.maxSize.w);
    if (el.maxSize.h !== undefined) h = Math.min(h, el.maxSize.h);
    // Re-derive against the lock, or capping one axis would distort the other.
    if (el.aspectLock !== null && el.aspectLock > 0) {
      w = Math.min(w, h * el.aspectLock);
      h = w / el.aspectLock;
    }
  }

  const x = alignCross(el, band, w);
  const y = band.y + (h < band.h ? (band.h - h) / 2 : 0);
  return containRect(rect(x, y, w, h), band);
}

export type CrossAlign = 'left' | 'center' | 'right';

/**
 * Where an element sits across its band, in a column.
 *
 * A narrower frame inside a full-width band follows the alignment of the copy
 * it holds: a centred headline gets a centred frame. That is right for a
 * column, where the band spans the region and the alignment is the only thing
 * saying where the ink goes.
 */
export function crossAlignOf(el: NormalizedElement): CrossAlign {
  const pin = el.pinTo;
  if (pin === 'left' || pin === 'right' || pin === 'center') return pin;
  return el.text?.align ?? (el.role === 'logo' ? 'left' : 'center');
}

/**
 * Where an element sits along a row — a different question, and previously
 * answered with the same value.
 *
 * "This text is right-aligned in its frame" and "this frame belongs at the
 * right of the header" are not the same statement, but a badge defaults to the
 * first and was being read as the second, so a logo and a badge flew apart to
 * opposite ends of a header they were never asked to span. Along a row,
 * position is an explicit `pinTo` or it is reading order.
 */
export function rowAlignOf(el: NormalizedElement): CrossAlign {
  const pin = el.pinTo;
  if (pin === 'left' || pin === 'right' || pin === 'center') return pin;
  return 'left';
}

function alignCross(el: NormalizedElement, band: Rect, w: number): number {
  const align = crossAlignOf(el);
  if (align === 'left') return band.x;
  if (align === 'right') return band.x + band.w - w;
  return band.x + (band.w - w) / 2;
}

export interface RowItem {
  id: string;
  frame: Rect;
  /** Width the element actually needs, once its text has been measured. */
  naturalW: number;
  align: CrossAlign;
}

/**
 * The horizontal counterpart of `compactRegion`, and for the same reason.
 *
 * A row divides its width into equal shares, which is right while the elements
 * are competing for space and wrong once they are not: a 48px icon and a
 * one-word badge each take half a header, then sit at opposite ends of their
 * own half, so all the slack collects in the middle as a hole. On a 1002px
 * header that hole was 317px wide — between a logo and the word beside it.
 *
 * So the leftover goes to the outside of the group rather than between its
 * members. Elements keep the alignment they asked for: a run of left-aligned
 * chrome packs from the leading edge, a right-aligned badge still hugs the
 * trailing edge, and anything centred forms a group in the middle. An author
 * who wants the logo and the badge at opposite ends says so with `pinTo`, and
 * gets it on every surface — which is the point.
 */
export function compactRow(
  region: Rect,
  items: readonly RowItem[],
  gutter: number,
): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  if (items.length < 2) return out;

  const widthOf = (it: RowItem): number => Math.min(it.naturalW, it.frame.w);
  const total = items.reduce((acc, it) => acc + widthOf(it), 0) + gutter * (items.length - 1);
  // Nothing to give back. Leave the share-based layout alone rather than
  // inventing an overlap.
  if (total > region.w) return out;

  const runs: CrossAlign[] = ['left', 'center', 'right'];
  for (const run of runs) {
    const members = items.filter((it) => it.align === run);
    if (members.length === 0) continue;

    const runWidth =
      members.reduce((acc, it) => acc + widthOf(it), 0) + gutter * (members.length - 1);
    let cursor =
      run === 'left'
        ? region.x
        : run === 'right'
          ? region.x + region.w - runWidth
          : region.x + (region.w - runWidth) / 2;

    for (const it of members) {
      const w = widthOf(it);
      out[it.id] = containRect({ x: cursor, y: it.frame.y, w, h: it.frame.h }, region);
      cursor += w + gutter;
    }
  }
  return out;
}

/**
 * Second half of step 4, run after `fitText` knows real text heights: restack
 * a region's elements at their measured heights and centre the group.
 *
 * Without this, a headline that fits in 30px still sits centred in its 90px
 * band and the whole composition reads as if it were floating.
 */
export function compactRegion(
  region: Rect,
  items: readonly { id: string; frame: Rect }[],
  gutter: number,
): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  if (items.length === 0) return out;

  const totalH = items.reduce((acc, it) => acc + it.frame.h, 0) + gutter * (items.length - 1);
  let cursor = region.y + Math.max(0, (region.h - totalH) / 2);
  for (const it of items) {
    out[it.id] = {
      x: it.frame.x,
      y: clamp(cursor, region.y, Math.max(region.y, region.y + region.h - it.frame.h)),
      w: it.frame.w,
      h: it.frame.h,
    };
    cursor += it.frame.h + gutter;
  }
  return out;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

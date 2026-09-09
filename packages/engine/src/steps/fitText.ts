import { clamp, containRect, roundTo } from '../geometry.js';
import { estimateWidth, wrap, WIDTH_SAFETY_FACTOR } from '../measure/textMetrics.js';
import type { Rect, SurfaceClass, Theme } from '../types.js';
import type { NormalizedElement } from './normalize.js';
import type { Tracer } from '../trace.js';

export interface TextFit {
  fontSizePx: number;
  lineHeightPx: number;
  lines: string[];
  blockHeightPx: number;
  maxLineWidthPx: number;
  /** True when the size landed on the typographic ladder rather than free-sized. */
  snapped: boolean;
  /** True when even `minFontPx` did not fit; the caller must degrade or clamp. */
  overflow: boolean;
}

/** Ladder anchor. Everything snaps relative to a 16px base. */
export const TYPE_BASE_PX = 16;
const LADDER_STEPS_DOWN = 7;
const LADDER_STEPS_UP = 12;
/** A snap is only worth taking if it costs less than this fraction of the fit. */
const SNAP_TOLERANCE = 0.85;
/** Binary search resolution, in px. */
const SIZE_STEP = 0.5;
const MAX_FONT_PX = 240;

export function typeLadder(ratio: number): number[] {
  const out: number[] = [];
  for (let n = -LADDER_STEPS_DOWN; n <= LADDER_STEPS_UP; n += 1) {
    out.push(roundTo(TYPE_BASE_PX * ratio ** n, 2));
  }
  return out;
}

/** Inner box of a CTA chip: the text sits inside padding, not on the edge. */
export function ctaPadding(gutter: number): { x: number; y: number } {
  return { x: Math.max(6, gutter), y: Math.max(4, gutter * 0.75) };
}

export function textBoxOf(el: NormalizedElement, frame: Rect, gutter: number): Rect {
  if (el.role !== 'cta') return frame;
  const pad = ctaPadding(gutter);
  return {
    x: frame.x + pad.x,
    y: frame.y + pad.y,
    w: Math.max(1, frame.w - pad.x * 2),
    h: Math.max(1, frame.h - pad.y * 2),
  };
}

/**
 * Step 5 — largest font size at which the greedily-wrapped text still fits.
 *
 * Binary search rather than a closed form because the fit predicate is a step
 * function: wrapping means width and line count change discontinuously with
 * size, so there is nothing to invert. The predicate is monotone (bigger text
 * never fits when smaller text did not), which is all a bisection needs.
 */
export function fitText(el: NormalizedElement, box: Rect, theme: Theme, tracer: Tracer): TextFit {
  const text = el.text;
  if (text === null) {
    throw new Error(`fitText called on non-text element "${el.id}"`);
  }

  const maxWidth = Math.max(1, box.w * WIDTH_SAFETY_FACTOR);
  const styleAt = (fontSizePx: number) => ({
    family: theme.fontFamily,
    fontSizePx,
    weight: text.weight,
  });

  const evaluate = (fontSizePx: number) => {
    const style = styleAt(fontSizePx);
    const wrapped = wrap(text.value, style, { maxWidthPx: maxWidth });
    const lineHeightPx = roundTo(fontSizePx * text.leading, 2);
    const blockHeightPx = roundTo(wrapped.lines.length * lineHeightPx, 2);
    const fits =
      wrapped.lines.length <= text.maxLines &&
      blockHeightPx <= box.h + 0.01 &&
      wrapped.maxLineWidthPx <= maxWidth + 0.01;
    return { wrapped, lineHeightPx, blockHeightPx, fits };
  };

  const loUnits = Math.max(1, Math.round(text.minFontPx / SIZE_STEP));
  const hiUnits = Math.max(
    loUnits,
    Math.round(Math.min(MAX_FONT_PX, Math.max(text.minFontPx, box.h)) / SIZE_STEP),
  );

  let lo = loUnits;
  let hi = hiUnits;
  let bestUnits = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (evaluate(mid * SIZE_STEP).fits) {
      bestUnits = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestUnits < 0) {
    // Nothing fits, not even the floor. Render at the floor, truncate, and let
    // `degrade` decide whether this element deserves the space at all.
    const style = styleAt(text.minFontPx);
    const wrapped = wrap(text.value, style, {
      maxWidthPx: maxWidth,
      maxLines: text.maxLines,
    });
    const lineHeightPx = roundTo(text.minFontPx * text.leading, 2);
    tracer.warn('fitText', `"${el.id}" does not fit at its ${text.minFontPx}px floor`, {
      subject: el.id,
      data: {
        minFontPx: text.minFontPx,
        boxW: roundTo(box.w),
        boxH: roundTo(box.h),
        neededLines: wrapped.lines.length,
        maxLines: text.maxLines,
      },
    });
    return {
      fontSizePx: text.minFontPx,
      lineHeightPx,
      lines: wrapped.lines,
      blockHeightPx: roundTo(wrapped.lines.length * lineHeightPx, 2),
      maxLineWidthPx: roundTo(wrapped.maxLineWidthPx, 2),
      snapped: false,
      overflow: true,
    };
  }

  const freeSize = roundTo(bestUnits * SIZE_STEP, 2);
  const snapCandidate = largestLadderValueAtMost(freeSize, theme.scaleRatio);
  const snapAcceptable =
    snapCandidate !== null &&
    snapCandidate >= text.minFontPx &&
    snapCandidate >= freeSize * SNAP_TOLERANCE;
  const fontSizePx = snapAcceptable && snapCandidate !== null ? snapCandidate : freeSize;

  const final = evaluate(fontSizePx);
  const wrapped = wrap(text.value, styleAt(fontSizePx), {
    maxWidthPx: maxWidth,
    maxLines: text.maxLines,
  });

  tracer.info(
    'fitText',
    `"${el.id}" set at ${fontSizePx}px over ${wrapped.lines.length} line${wrapped.lines.length === 1 ? '' : 's'}`,
    {
      subject: el.id,
      data: {
        freeSizePx: freeSize,
        snapped: snapAcceptable,
        lines: wrapped.lines.length,
        maxLines: text.maxLines,
        lineHeightPx: final.lineHeightPx,
      },
    },
  );

  return {
    fontSizePx,
    lineHeightPx: final.lineHeightPx,
    lines: wrapped.lines,
    blockHeightPx: roundTo(wrapped.lines.length * final.lineHeightPx, 2),
    maxLineWidthPx: roundTo(wrapped.maxLineWidthPx, 2),
    snapped: snapAcceptable,
    overflow: false,
  };
}

function largestLadderValueAtMost(size: number, ratio: number): number | null {
  let best: number | null = null;
  for (const step of typeLadder(ratio)) {
    if (step <= size && (best === null || step > best)) best = step;
  }
  return best;
}

/**
 * Shrink-wraps a text element's frame around its fitted lines: full band width
 * for copy, hugging the label for a CTA chip.
 */
export function textFrameFor(
  el: NormalizedElement,
  band: Rect,
  fit: TextFit,
  klass: SurfaceClass,
  gutter: number,
): Rect {
  if (el.role === 'cta') {
    const pad = ctaPadding(gutter);
    const w = clamp(
      fit.maxLineWidthPx + pad.x * 2,
      Math.max(klass.minTouchTarget, el.minSize.w),
      band.w,
    );
    const h = clamp(
      fit.blockHeightPx + pad.y * 2,
      Math.max(klass.minTouchTarget, el.minSize.h),
      Math.max(band.h, klass.minTouchTarget),
    );
    const x = band.x + (band.w - w) / 2;
    const y = band.y + (band.h - h) / 2;
    return { x, y, w, h };
  }

  const h = Math.min(fit.blockHeightPx, band.h);
  return containRect({ x: band.x, y: band.y + (band.h - h) / 2, w: band.w, h }, band);
}

/**
 * Estimated width of a string at a given size — re-exported so callers that
 * need a one-off measurement do not reach into `measure/`.
 */
export function measure(text: string, family: string, fontSizePx: number, weight: number): number {
  return estimateWidth(text, { family, fontSizePx, weight });
}

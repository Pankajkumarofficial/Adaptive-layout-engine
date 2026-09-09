import type { Insets, Rect } from './types.js';

export const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function insetRect(r: Rect, insets: Insets): Rect {
  return {
    x: r.x + insets.left,
    y: r.y + insets.top,
    w: Math.max(0, r.w - insets.left - insets.right),
    h: Math.max(0, r.h - insets.top - insets.bottom),
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return value < min ? min : value > max ? max : value;
}

/** Clamp `inner` so it sits inside `outer`, shrinking it only if it is too big. */
export function containRect(inner: Rect, outer: Rect): Rect {
  const w = Math.min(inner.w, outer.w);
  const h = Math.min(inner.h, outer.h);
  return {
    x: clamp(inner.x, outer.x, outer.x + outer.w - w),
    y: clamp(inner.y, outer.y, outer.y + outer.h - h),
    w,
    h,
  };
}

/**
 * Rounding is part of the contract, not a formatting nicety: frames are hashed
 * into the fingerprint, so they must be free of float noise.
 */
export function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  // +0 normalises -0, which would otherwise serialise differently.
  return Math.round(value * f) / f + 0;
}

export function roundRect(r: Rect, decimals = 2): Rect {
  return {
    x: roundTo(r.x, decimals),
    y: roundTo(r.y, decimals),
    w: roundTo(r.w, decimals),
    h: roundTo(r.h, decimals),
  };
}

export function isEmptyRect(r: Rect): boolean {
  return r.w <= 0 || r.h <= 0;
}

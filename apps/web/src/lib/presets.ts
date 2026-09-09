import { PRESET_SURFACES } from '@ale/engine';
import type { Surface } from '@ale/engine';

export const PRESETS: readonly Surface[] = PRESET_SURFACES;

export const CUSTOM_SURFACE_ID = 'custom';

/** Bounds on a hand-dragged surface: small enough to be a badge, large enough
 * to be a billboard, and never so extreme the canvas cannot show it. */
export const MIN_SURFACE = { w: 48, h: 32 };
export const MAX_SURFACE = { w: 4096, h: 4096 };

export function customSurface(width: number, height: number): Surface {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  return {
    id: CUSTOM_SURFACE_ID,
    label: 'Custom',
    width: clamp(width, MIN_SURFACE.w, MAX_SURFACE.w),
    height: clamp(height, MIN_SURFACE.h, MAX_SURFACE.h),
    dpr: 2,
    interactionHint: 'tap',
  };
}

/** Fits a surface inside a box, never enlarging past 1:1. */
export function fitScale(surface: Surface, boxW: number, boxH: number, max = 1): number {
  if (surface.width <= 0 || surface.height <= 0) return max;
  return Math.min(max, boxW / surface.width, boxH / surface.height);
}

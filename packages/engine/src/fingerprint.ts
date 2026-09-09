import { fnv1a32 } from './hash.js';
import type { DroppedElement, PlacedElement } from './types.js';

/**
 * Bumped whenever the canonical form changes, so a golden-test failure tells
 * you whether the layout moved or only the hashing did.
 */
export const FINGERPRINT_VERSION = 1;

/**
 * Step 10 — a stable hash of what the viewer would actually see.
 *
 * Frames are rounded to whole pixels first: sub-pixel jitter from a different
 * float rounding path must not change the fingerprint, but a visible move must.
 */
export function fingerprint(
  archetype: string,
  surfaceWidth: number,
  surfaceHeight: number,
  placed: readonly PlacedElement[],
  dropped: readonly DroppedElement[],
): string {
  const parts: string[] = [
    `v${FINGERPRINT_VERSION}`,
    archetype,
    `${Math.round(surfaceWidth)}x${Math.round(surfaceHeight)}`,
  ];

  for (const p of [...placed].sort((a, b) => a.id.localeCompare(b.id))) {
    const f = p.frame;
    const type =
      p.lines !== undefined
        ? `t:${Math.round(p.fontSizePx ?? 0)}:${p.lines.length}`
        : p.imageCrop !== undefined
          ? `i:${Math.round(p.imageCrop.sx)},${Math.round(p.imageCrop.sy)},${Math.round(p.imageCrop.sw)},${Math.round(p.imageCrop.sh)}`
          : 's';
    parts.push(
      `${p.id}@${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.w)},${Math.round(f.h)}|${type}|z${p.z}`,
    );
  }

  const droppedIds = [...dropped].map((d) => d.id).sort();
  parts.push(`-${droppedIds.join(',')}`);

  return `fp_${fnv1a32(parts.join(';'))}`;
}

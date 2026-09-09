import {
  bestMonochrome,
  contrastRatio,
  parseHex,
  relativeLuminance,
  solveScrimOpacity,
} from '../color.js';
import { roundTo } from '../geometry.js';
import type { Rect, Scrim, Theme } from '../types.js';
import type { NormalizedElement } from './normalize.js';
import type { Tracer } from '../trace.js';

/**
 * The engine cannot sample pixels, so text over an image is scored against a
 * pessimistic mid-grey. This is the same assumption broadcast and OOH tooling
 * makes, and it is why text over imagery nearly always gets a scrim.
 */
export const ASSUMED_IMAGE_BACKDROP = '#808080';

export interface ContrastDecision {
  color: string;
  scrim?: Scrim;
  ratio: number;
}

interface Backdrop {
  color: string;
  /** False when the backdrop is an image and the colour is an assumption. */
  certain: boolean;
  source: string;
}

/**
 * Step 9 — guarantee the contrast floor, by recolouring if that is enough and
 * by scrimming if it is not.
 */
export function enforceContrast(
  el: NormalizedElement,
  frame: Rect,
  beneath: readonly { el: NormalizedElement; frame: Rect }[],
  theme: Theme,
  minRatio: number,
  tracer: Tracer,
): ContrastDecision {
  const desired = el.role === 'cta' ? theme.palette.ctaFg : theme.palette.fg;
  const backdrop = resolveBackdrop(el, frame, beneath, theme);
  const ratio = contrastRatio(desired, backdrop.color);

  if (backdrop.certain && ratio >= minRatio) {
    return { color: desired, ratio: roundTo(ratio, 2) };
  }

  if (backdrop.certain) {
    const swapped = bestMonochrome(backdrop.color);
    const swappedRatio = contrastRatio(swapped, backdrop.color);
    if (swappedRatio >= minRatio) {
      tracer.warn(
        'contrast',
        `"${el.id}" was ${roundTo(ratio, 2)}:1 on ${backdrop.source}; recoloured to ${swapped} for ${roundTo(swappedRatio, 2)}:1`,
        {
          subject: el.id,
          data: { required: minRatio, before: roundTo(ratio, 2), after: roundTo(swappedRatio, 2) },
        },
      );
      return { color: swapped, ratio: roundTo(swappedRatio, 2) };
    }
  }

  const scrimFill = relativeLuminance(parseHex(desired)) > 0.5 ? '#000000' : '#ffffff';
  const opacity = solveScrimOpacity(desired, backdrop.color, scrimFill, minRatio);

  if (opacity === null) {
    const swapped = bestMonochrome(backdrop.color);
    tracer.warn(
      'contrast',
      `"${el.id}" cannot reach ${minRatio}:1 over ${backdrop.source}; using ${swapped} without a scrim`,
      { subject: el.id, data: { required: minRatio, achieved: roundTo(ratio, 2) } },
    );
    return { color: swapped, ratio: roundTo(contrastRatio(swapped, backdrop.color), 2) };
  }

  const achieved = contrastRatio(desired, backdrop.color);
  tracer.warn(
    'contrast',
    `"${el.id}" sits over ${backdrop.source}; added a ${Math.round(opacity * 100)}% ${scrimFill === '#000000' ? 'dark' : 'light'} scrim to hold ${minRatio}:1`,
    {
      subject: el.id,
      data: {
        required: minRatio,
        unscrimmed: roundTo(achieved, 2),
        opacity,
        assumedBackdrop: backdrop.certain ? backdrop.color : ASSUMED_IMAGE_BACKDROP,
      },
    },
  );

  return { color: desired, scrim: { fill: scrimFill, opacity }, ratio: roundTo(achieved, 2) };
}

function resolveBackdrop(
  el: NormalizedElement,
  frame: Rect,
  beneath: readonly { el: NormalizedElement; frame: Rect }[],
  theme: Theme,
): Backdrop {
  if (el.role === 'cta') {
    return { color: theme.palette.ctaBg, certain: true, source: 'the CTA fill' };
  }

  // Topmost thing underneath that actually covers this frame wins.
  const covering = beneath
    .filter((b) => b.el.z < el.z && overlaps(frame, b.frame))
    .sort((a, b) => b.el.z - a.el.z);

  for (const candidate of covering) {
    const content = candidate.el.source.content;
    if (content.kind === 'image') {
      return {
        color: ASSUMED_IMAGE_BACKDROP,
        certain: false,
        source: `image "${candidate.el.id}"`,
      };
    }
    if (content.kind === 'shape') {
      return { color: content.fill, certain: true, source: `shape "${candidate.el.id}"` };
    }
  }

  return { color: theme.palette.bg, certain: true, source: 'the theme background' };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

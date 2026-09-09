import { SpecError } from '../errors.js';
import { insetRect, isEmptyRect, rect, roundTo, ZERO_INSETS } from '../geometry.js';
import type { Tracer } from '../trace.js';
import type {
  AspectBucket,
  DensityClass,
  InteractionHint,
  Surface,
  SurfaceClass,
} from '../types.js';

/** Aspect bucket boundaries. Lower bound inclusive, upper bound exclusive. */
export const ASPECT_BREAKPOINTS = {
  ultrawide: 2.2,
  landscape: 1.2,
  square: 0.8,
  portrait: 0.45,
} as const;

/** Total CSS-px area boundaries. */
export const DENSITY_BREAKPOINTS = {
  micro: 40_000,
  small: 200_000,
  medium: 800_000,
} as const;

/**
 * Minimum interactive edge length. `remote` is largest because a D-pad focus
 * ring on a couch-distance screen needs far more than a fingertip does.
 */
export const MIN_TOUCH_TARGET: Readonly<Record<InteractionHint, number>> = {
  tap: 44,
  click: 24,
  remote: 64,
  none: 0,
};

export function aspectBucketOf(aspect: number): AspectBucket {
  if (aspect > ASPECT_BREAKPOINTS.ultrawide) return 'ultrawide';
  if (aspect >= ASPECT_BREAKPOINTS.landscape) return 'landscape';
  if (aspect >= ASPECT_BREAKPOINTS.square) return 'square';
  if (aspect >= ASPECT_BREAKPOINTS.portrait) return 'portrait';
  return 'tall';
}

export function densityClassOf(area: number): DensityClass {
  if (area < DENSITY_BREAKPOINTS.micro) return 'micro';
  if (area < DENSITY_BREAKPOINTS.small) return 'small';
  if (area < DENSITY_BREAKPOINTS.medium) return 'medium';
  return 'large';
}

/**
 * Step 2 — turn raw pixels into the two axes every later decision keys off:
 * what shape the surface is, and how much room there is to say anything.
 */
export function classify(surface: Surface, tracer: Tracer): SurfaceClass {
  const aspect = surface.width / surface.height;
  const area = surface.width * surface.height;
  const aspectBucket = aspectBucketOf(aspect);
  const densityClass = densityClassOf(area);
  const minTouchTarget = MIN_TOUCH_TARGET[surface.interactionHint];

  const contentBox = insetRect(
    rect(0, 0, surface.width, surface.height),
    surface.safeArea ?? ZERO_INSETS,
  );
  if (isEmptyRect(contentBox)) {
    throw new SpecError(
      'EMPTY_CONTENT_BOX',
      `safe area leaves no drawable region on surface "${surface.id}"`,
    );
  }

  tracer.decision(
    'classify',
    `${surface.width}x${surface.height} is ${aspectBucket}/${densityClass}`,
    {
      subject: surface.id,
      data: {
        aspect: roundTo(aspect, 3),
        area,
        dpr: surface.dpr,
        minTouchTarget,
        contentW: roundTo(contentBox.w),
        contentH: roundTo(contentBox.h),
      },
    },
  );

  return { aspect, aspectBucket, area, densityClass, minTouchTarget, contentBox };
}

/** Spacing scale derived from density; used as both gutter and region padding. */
export function gutterFor(density: DensityClass): number {
  switch (density) {
    case 'micro':
      return 4;
    case 'small':
      return 8;
    case 'medium':
      return 16;
    case 'large':
      return 24;
  }
}

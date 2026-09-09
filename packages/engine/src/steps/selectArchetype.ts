import { ARCHETYPES, FALLBACK_ARCHETYPE_ID, type Archetype } from '../archetypes/index.js';
import type { Tracer } from '../trace.js';
import type { AspectBucket, DensityClass, SurfaceClass } from '../types.js';
import type { NormalizedElement } from './normalize.js';

/**
 * The archetype table: the engine's whole opinion about composition, in one
 * readable grid. `tall` is resolved dynamically because it depends on whether
 * the spec has a hero to bleed behind the copy.
 */
const TABLE: Readonly<Record<AspectBucket, Readonly<Record<DensityClass, string>>>> = {
  ultrawide: { micro: 'strip', small: 'strip', medium: 'strip', large: 'split' },
  landscape: { micro: 'strip', small: 'split', medium: 'split', large: 'split' },
  square: { micro: 'strip', small: 'stack', medium: 'stack', large: 'stack' },
  portrait: { micro: 'strip', small: 'stack', medium: 'stack', large: 'stack' },
  // `tall` is skyscraper territory (<0.45); a 9:16 story is 0.5625 and lands in
  // `portrait`. Without a hero there is nothing to overlay, so it stacks.
  tall: { micro: 'strip', small: 'stack', medium: 'stack', large: 'stack' },
};

export interface ArchetypeChoice {
  archetype: Archetype;
  /** What the table asked for, which may differ from what is implemented yet. */
  requestedId: string;
}

/**
 * Step 3 — choose a composition from (aspect bucket x density class).
 *
 * A lookup table rather than a solver: it is inspectable, it is stable under
 * small resizes, and a reviewer can predict its output by reading it.
 */
export function selectArchetype(
  klass: SurfaceClass,
  elements: readonly NormalizedElement[],
  tracer: Tracer,
): ArchetypeChoice {
  const hasHero = elements.some((el) => el.role === 'hero');
  const row = TABLE[klass.aspectBucket];
  let requestedId = row[klass.densityClass];

  if (klass.aspectBucket === 'tall' && hasHero && klass.densityClass !== 'micro') {
    requestedId = 'overlay';
  }

  const implemented = ARCHETYPES[requestedId];
  if (implemented !== undefined) {
    tracer.decision('selectArchetype', `chose "${implemented.id}" — ${implemented.rationale}`, {
      data: {
        aspectBucket: klass.aspectBucket,
        densityClass: klass.densityClass,
        hasHero,
      },
    });
    return { archetype: implemented, requestedId };
  }

  const fallback = ARCHETYPES[FALLBACK_ARCHETYPE_ID];
  if (fallback === undefined) {
    throw new Error('no archetypes registered');
  }
  tracer.warn(
    'selectArchetype',
    `archetype "${requestedId}" is not implemented yet; falling back to "${fallback.id}"`,
    { data: { aspectBucket: klass.aspectBucket, densityClass: klass.densityClass } },
  );
  return { archetype: fallback, requestedId };
}

export const ARCHETYPE_TABLE = TABLE;

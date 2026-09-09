import { overlayArchetype } from './overlay.js';
import { splitArchetype } from './split.js';
import { stackArchetype } from './stack.js';
import { stripArchetype } from './strip.js';
import type { Archetype } from './types.js';

export * from './types.js';
export { byReadingOrder, groupByRegion, ROLE_RANK } from './shared.js';
export { overlayArchetype, splitArchetype, stackArchetype, stripArchetype };

/** Every implemented archetype, keyed by id. */
export const ARCHETYPES: Readonly<Record<string, Archetype>> = {
  [stackArchetype.id]: stackArchetype,
  [stripArchetype.id]: stripArchetype,
  [splitArchetype.id]: splitArchetype,
  [overlayArchetype.id]: overlayArchetype,
};

export const FALLBACK_ARCHETYPE_ID = stackArchetype.id;

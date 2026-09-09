import { stackArchetype } from './stack.js';
import type { Archetype } from './types.js';

export * from './types.js';
export { stackArchetype };

/**
 * Every implemented archetype, keyed by id.
 *
 * Milestone 1 ships `stack` only; `strip`, `split` and `overlay` land in
 * milestone 2 and register here without any change to `selectArchetype`.
 */
export const ARCHETYPES: Readonly<Record<string, Archetype>> = {
  [stackArchetype.id]: stackArchetype,
};

export const FALLBACK_ARCHETYPE_ID = stackArchetype.id;

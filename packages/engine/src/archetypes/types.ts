import type { NormalizedElement } from '../steps/normalize.js';
import type { Rect, Surface, SurfaceClass, Theme } from '../types.js';

/** Region key used for anything painted edge-to-edge, outside the safe area. */
export const BLEED_REGION = 'bleed';

export interface ArchetypeContext {
  klass: SurfaceClass;
  /** Safe-area content box, already padded by the archetype's own margin. */
  content: Rect;
  /** Spacing unit for this density: used as both gutter and inner padding. */
  gutter: number;
  theme: Theme;
  elements: readonly NormalizedElement[];
}

export interface Assignment {
  elementId: string;
  region: string;
}

/**
 * An archetype is a named opinion about how a family of surfaces should be
 * composed. It answers two questions and nothing else: what regions exist, and
 * which element goes in which one. All sizing lives in `budget`/`fitText`.
 */
export interface Archetype {
  id: string;
  /** Human-readable rationale, shown in the trace when this archetype is picked. */
  rationale: string;
  /**
   * Regions whose contents are painted edge-to-edge and are therefore exempt
   * from safe-area clamping. Always includes `bleed`; `overlay` also bleeds its
   * media region, because a full-bleed hero is the entire point of it.
   */
  bleedRegions: readonly string[];
  regions(surface: Surface, ctx: ArchetypeContext): Record<string, Rect>;
  assign(elements: readonly NormalizedElement[], regions: Record<string, Rect>): Assignment[];
}

// Imported by relative path rather than by package name. `@ale/shared` is a
// workspace symlink whose entry point is a `.ts` file, and a serverless
// bundler leaves node_modules external — which would ask Node to `import`
// TypeScript at runtime. A path inside the source tree is compiled in.
import { adSpecSchema, surfaceSchema } from '../../../shared/src/index.js';
import { SpecError, type SpecIssue } from '../errors.js';
import type {
  AdElement,
  AdSpec,
  ElementRole,
  PinTo,
  Size,
  SizeCap,
  Surface,
  TextAlign,
} from '../types.js';
import type { Tracer } from '../trace.js';

/** Per-role defaults. Authors override any of these on the element itself. */
export interface RoleDefaults {
  maxLines: number;
  minFontPx: number;
  /** Font weight passed to the metrics estimator. */
  weight: number;
  /** line-height as a multiple of font size. */
  leading: number;
  align: TextAlign;
  minSize: Size;
  /** Paint order. Higher sits on top. */
  z: number;
  /** Relative share of its region's main axis. */
  bandWeight: number;
  /** Painted edge-to-edge, exempt from safe-area insetting. */
  bleed: boolean;
}

export const ROLE_DEFAULTS: Readonly<Record<ElementRole, RoleDefaults>> = {
  background: {
    maxLines: 1,
    minFontPx: 8,
    weight: 400,
    leading: 1.2,
    align: 'center',
    minSize: { w: 0, h: 0 },
    z: 0,
    bandWeight: 0,
    bleed: true,
  },
  hero: {
    maxLines: 1,
    minFontPx: 8,
    weight: 400,
    leading: 1.2,
    align: 'center',
    minSize: { w: 48, h: 40 },
    z: 10,
    bandWeight: 1,
    bleed: false,
  },
  logo: {
    maxLines: 1,
    minFontPx: 8,
    weight: 600,
    leading: 1.2,
    align: 'left',
    minSize: { w: 24, h: 16 },
    z: 30,
    bandWeight: 1,
    bleed: false,
  },
  badge: {
    maxLines: 1,
    minFontPx: 9,
    weight: 600,
    leading: 1.2,
    align: 'right',
    minSize: { w: 20, h: 16 },
    z: 30,
    bandWeight: 1,
    bleed: false,
  },
  headline: {
    maxLines: 3,
    minFontPx: 13,
    weight: 700,
    leading: 1.15,
    align: 'center',
    minSize: { w: 60, h: 14 },
    z: 20,
    bandWeight: 1,
    bleed: false,
  },
  subhead: {
    maxLines: 2,
    minFontPx: 11,
    weight: 500,
    leading: 1.25,
    align: 'center',
    minSize: { w: 60, h: 12 },
    z: 20,
    bandWeight: 0.7,
    bleed: false,
  },
  body: {
    maxLines: 4,
    minFontPx: 10,
    weight: 400,
    leading: 1.4,
    align: 'center',
    minSize: { w: 60, h: 12 },
    z: 20,
    bandWeight: 0.9,
    bleed: false,
  },
  cta: {
    maxLines: 1,
    minFontPx: 12,
    weight: 600,
    leading: 1.2,
    align: 'center',
    minSize: { w: 64, h: 28 },
    z: 40,
    bandWeight: 0.6,
    bleed: false,
  },
  legal: {
    maxLines: 2,
    minFontPx: 8,
    weight: 400,
    leading: 1.3,
    align: 'center',
    minSize: { w: 40, h: 9 },
    z: 20,
    bandWeight: 0.4,
    bleed: false,
  },
};

export interface NormalizedText {
  value: string;
  maxLines: number;
  minFontPx: number;
  weight: number;
  leading: number;
  align: TextAlign;
}

export interface NormalizedElement {
  readonly source: AdElement;
  id: string;
  role: ElementRole;
  priority: number;
  minSize: Size;
  maxSize: SizeCap | null;
  aspectLock: number | null;
  pinTo: PinTo | null;
  z: number;
  bandWeight: number;
  bleed: boolean;
  /** Present only for text elements. */
  text: NormalizedText | null;
}

export interface NormalizedSpec {
  spec: AdSpec;
  surface: Surface;
  /** Sorted by priority ascending (0 = most important), then by author order. */
  elements: NormalizedElement[];
  /** Text elements with nothing to say. Reported as dropped, never laid out. */
  empty: string[];
  neverDrop: ReadonlySet<string>;
  alwaysPairs: readonly [string, string][];
  minContrastRatio: number;
}

/**
 * Step 1 — validate, resolve defaults, order by importance.
 *
 * Everything downstream may assume the returned shape is complete: no optional
 * field lookups, no `?? default` scattered through the layout code.
 */
export function normalize(spec: AdSpec, surface: Surface, tracer: Tracer): NormalizedSpec {
  const specResult = adSpecSchema.safeParse(spec);
  if (!specResult.success) {
    throw new SpecError(
      'INVALID_SPEC',
      `spec "${spec?.id ?? '<unknown>'}" is invalid`,
      toIssues(specResult.error.issues),
    );
  }
  const surfaceResult = surfaceSchema.safeParse(surface);
  if (!surfaceResult.success) {
    throw new SpecError(
      'INVALID_SURFACE',
      `surface "${surface?.id ?? '<unknown>'}" is invalid`,
      toIssues(surfaceResult.error.issues),
    );
  }

  const parsed = specResult.data as AdSpec;
  const parsedSurface = surfaceResult.data as Surface;

  const ordered = parsed.elements
    .map((el, index) => ({ el, index }))
    .sort((a, b) => a.el.priority - b.el.priority || a.index - b.index)
    .map(({ el }) => normalizeElement(el));

  // A cap below the floor is a contradiction, and one an author can write by
  // accident — drag a size handle past a minSize and the element becomes
  // unsatisfiable at any size. Left alone it poisons the whole layout: budget
  // reports an unmet minimum every pass, and degrade drops perfectly healthy
  // elements trying to recover space that would never have helped. The floor
  // wins, because it is the promise: below it the element is not worth drawing.
  for (const el of ordered) {
    if (el.maxSize === null) continue;
    const w = el.maxSize.w !== undefined && el.maxSize.w < el.minSize.w ? el.minSize.w : undefined;
    const h = el.maxSize.h !== undefined && el.maxSize.h < el.minSize.h ? el.minSize.h : undefined;
    if (w === undefined && h === undefined) continue;
    const raised = {
      ...el.maxSize,
      ...(w !== undefined ? { w } : {}),
      ...(h !== undefined ? { h } : {}),
    };
    tracer.warn(
      'normalize',
      `"${el.id}" is capped at ${describeCap(el.maxSize)}, under its own ` +
        `${el.minSize.w}x${el.minSize.h} minimum; using the minimum`,
      {
        subject: el.id,
        data: { cap: describeCap(el.maxSize), floor: `${el.minSize.w}x${el.minSize.h}` },
      },
    );
    el.maxSize = raised;
  }

  // An element with no text is not content, whatever its priority says. Laying
  // one out would reserve space for an empty box; refusing the spec would make
  // the editor unusable while you clear a field to retype it.
  const empty = ordered
    .filter((el) => el.text !== null && el.text.value.trim().length === 0)
    .map((el) => el.id);
  const emptySet = new Set(empty);
  const elements = ordered.filter((el) => !emptySet.has(el.id));

  if (empty.length > 0) {
    tracer.info(
      'normalize',
      `${empty.join(', ')} ${empty.length === 1 ? 'has' : 'have'} no text to place`,
      {
        data: { empty: empty.length },
      },
    );
  }

  const neverDrop = new Set(parsed.rules?.neverDrop ?? []);
  // Priority 0 is a promise in the data model, so it implies neverDrop.
  for (const el of elements) {
    if (el.priority === 0) neverDrop.add(el.id);
  }

  const minContrastRatio = parsed.rules?.minContrastRatio ?? 4.5;

  tracer.info('normalize', `spec "${parsed.name}" accepted`, {
    data: {
      elements: elements.length,
      neverDrop: neverDrop.size,
      pairs: parsed.rules?.alwaysPairs?.length ?? 0,
      minContrastRatio,
    },
  });
  tracer.info('normalize', `priority order: ${elements.map((e) => e.id).join(' > ')}`);

  return {
    spec: parsed,
    surface: parsedSurface,
    elements,
    empty,
    neverDrop,
    alwaysPairs: parsed.rules?.alwaysPairs ?? [],
    minContrastRatio,
  };
}

function normalizeElement(el: AdElement): NormalizedElement {
  const defaults = ROLE_DEFAULTS[el.role];
  const text: NormalizedText | null =
    el.content.kind === 'text'
      ? {
          value: el.content.value,
          maxLines: el.content.maxLines ?? defaults.maxLines,
          minFontPx: el.content.minFontPx ?? defaults.minFontPx,
          weight: defaults.weight,
          leading: defaults.leading,
          align: defaults.align,
        }
      : null;

  return {
    source: el,
    id: el.id,
    role: el.role,
    priority: el.priority,
    minSize: el.minSize ?? defaults.minSize,
    maxSize: el.maxSize ?? null,
    aspectLock: el.aspectLock ?? null,
    pinTo: el.pinTo ?? null,
    z: defaults.z,
    bandWeight: defaults.bandWeight,
    bleed: defaults.bleed,
    text,
  };
}

/** "240x80", "240 wide", "80 tall" — never "240x-", which reads as a typo. */
function describeCap(cap: SizeCap): string {
  if (cap.w !== undefined && cap.h !== undefined) return `${cap.w}x${cap.h}`;
  if (cap.w !== undefined) return `${cap.w} wide`;
  if (cap.h !== undefined) return `${cap.h} tall`;
  return 'nothing';
}

function toIssues(issues: readonly { path: (string | number)[]; message: string }[]): SpecIssue[] {
  return issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

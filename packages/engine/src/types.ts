/**
 * The public data model of the layout engine.
 *
 * Three shapes matter:
 *   AdSpec      — what the author writes, once, with no surface in mind.
 *   Surface     — where it has to render.
 *   LayoutResult — what the engine decided, fully resolved, with no work left
 *                  for the renderer beyond painting rectangles.
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** A ceiling on one or both axes. An absent axis is uncapped. */
export interface SizeCap {
  w?: number;
  h?: number;
}

// ---------------------------------------------------------------------------
// AdSpec
// ---------------------------------------------------------------------------

export type ElementRole =
  'logo' | 'headline' | 'subhead' | 'body' | 'cta' | 'hero' | 'background' | 'legal' | 'badge';

export type PinTo = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface TextContent {
  kind: 'text';
  value: string;
  /** Hard cap on wrapped line count. Defaults are role-derived. */
  maxLines?: number;
  /** The engine will not render this text smaller than this; it drops it instead. */
  minFontPx?: number;
}

export interface ImageContent {
  kind: 'image';
  url: string;
  /** Normalised 0..1 coordinates of the part of the image that must survive cropping. */
  focalPoint?: Point;
  intrinsic: Size;
}

export interface ShapeContent {
  kind: 'shape';
  fill: string;
}

export type ElementContent = TextContent | ImageContent | ShapeContent;

export interface AdElement {
  id: string;
  role: ElementRole;
  /** 0 = must never drop, 100 = drop first. */
  priority: number;
  content: ElementContent;
  /** px, below which the element is useless and should be dropped rather than shrunk. */
  minSize?: Size;
  /**
   * px ceiling on the rendered frame.
   *
   * Without one, an element with room to grow takes it — which is right for a
   * hero and wrong for a logo, where "as large as it fits" is never what an
   * author means. The cap applies on every surface; smaller ones are already
   * limited by the region, so it only bites where there was room to spare.
   *
   * Each axis is independent and optional: capping the width of a logo says
   * nothing about its height, and deriving the other axis from the one given
   * is how you end up computing a zero.
   */
  maxSize?: SizeCap;
  /** width / height, held exactly for logos and badges. */
  aspectLock?: number;
  pinTo?: PinTo;
}

export interface Palette {
  bg: string;
  fg: string;
  accent: string;
  ctaBg: string;
  ctaFg: string;
}

export interface Theme {
  palette: Palette;
  fontFamily: string;
  /** Typographic scale ratio; fitted sizes snap to this ladder where they can. */
  scaleRatio: number;
  cornerRadius: number;
}

export interface SpecRules {
  neverDrop?: string[];
  /** Element pairs that are dropped together or not at all. */
  alwaysPairs?: [string, string][];
  /** WCAG contrast floor for text over its resolved backdrop. Default 4.5. */
  minContrastRatio?: number;
}

export interface AdSpec {
  id: string;
  name: string;
  elements: AdElement[];
  theme: Theme;
  rules?: SpecRules;
}

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

export type InteractionHint = 'tap' | 'click' | 'remote' | 'none';

export interface Surface {
  id: string;
  label: string;
  width: number;
  height: number;
  dpr: 1 | 2 | 3;
  safeArea?: Insets;
  interactionHint: InteractionHint;
}

// ---------------------------------------------------------------------------
// Surface classification (step 2 output, also surfaced to the UI)
// ---------------------------------------------------------------------------

export type AspectBucket = 'ultrawide' | 'landscape' | 'square' | 'portrait' | 'tall';
export type DensityClass = 'micro' | 'small' | 'medium' | 'large';

export interface SurfaceClass {
  aspect: number;
  aspectBucket: AspectBucket;
  /** width * height in CSS px, before dpr. */
  area: number;
  densityClass: DensityClass;
  /** Minimum edge length for an interactive target on this surface. */
  minTouchTarget: number;
  /** The surface box minus safe-area insets. All non-bleed content lives here. */
  contentBox: Rect;
}

// ---------------------------------------------------------------------------
// LayoutResult
// ---------------------------------------------------------------------------

export type TextAlign = 'left' | 'center' | 'right';

export interface ImageCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * A scrim the renderer must paint *behind* a text element because the engine
 * could not otherwise meet the contrast floor. Produced by step 9.
 */
export interface Scrim {
  fill: string;
  opacity: number;
}

export interface PlacedElement {
  id: string;
  frame: Rect;
  fontSizePx?: number;
  lineHeightPx?: number;
  /** Pre-wrapped by the engine. The renderer must not let the browser re-wrap. */
  lines?: string[];
  textAlign?: TextAlign;
  imageCrop?: ImageCrop;
  /** Resolved foreground colour, after any contrast-driven swap. */
  color?: string;
  /** Resolved background fill for shapes and CTA chips. */
  fill?: string;
  scrim?: Scrim;
  opacity: number;
  z: number;
}

export interface DroppedElement {
  id: string;
  reason: string;
}

export interface LayoutResult {
  surface: Surface;
  surfaceClass: SurfaceClass;
  archetype: string;
  /** Named regions the archetype carved out, kept for the debug overlay. */
  regions: Record<string, Rect>;
  placed: PlacedElement[];
  dropped: DroppedElement[];
  warnings: string[];
  trace: TraceEntry[];
  /** Stable hash of the visual outcome. Golden tests compare this first. */
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// Trace
// ---------------------------------------------------------------------------

export type TraceStep =
  | 'normalize'
  | 'classify'
  | 'selectArchetype'
  | 'budget'
  | 'fitText'
  | 'degrade'
  | 'safeArea'
  | 'imageCrop'
  | 'contrast'
  | 'fingerprint';

/**
 * `info`     — something the engine observed.
 * `decision` — a branch was taken; this is what a reviewer reads.
 * `warn`     — the engine could not fully satisfy the spec and compromised.
 */
export type TraceLevel = 'info' | 'decision' | 'warn';

export type TraceValue = string | number | boolean | null;

export interface TraceEntry {
  /** 1-based, monotonic within a single solve(). No timestamps — solves are pure. */
  seq: number;
  step: TraceStep;
  level: TraceLevel;
  /** Degradation pass index: 0 is the first attempt, 1 the layout after one drop, etc. */
  pass: number;
  /** One sentence, present tense, written for a human reading the inspector. */
  message: string;
  /** Element id or region key this entry is about, when it is about one thing. */
  subject?: string;
  /** Flat, JSON-safe numbers behind the sentence. Rendered as chips in the UI. */
  data?: Record<string, TraceValue>;
}

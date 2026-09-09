/**
 * Per-character advance-width tables, in em units.
 *
 * WHY THIS EXISTS
 * ---------------
 * The engine must produce identical output in Node and in the browser, and
 * `canvas.measureText` exists in only one of those. Server-side solves, golden
 * tests and the client all have to agree byte-for-byte, so the engine carries
 * its own metrics instead of asking the platform.
 *
 * WHERE THE NUMBERS COME FROM
 * ---------------------------
 * Measured, not guessed: `canvas.measureText` on each character in isolation,
 * in Chrome on macOS, against the real Inter webfont and the Georgia and Menlo
 * system fonts. Regenerate with `scripts/measure-fonts.html`. Isolated
 * characters carry no kerning, so these advances are exact — the approximation
 * is in *summing* them, which is what `MEASUREMENT_ERROR_MARGIN` bounds.
 *
 * KNOWN LIMITS (documented, not hidden)
 * ------------------------------------
 *  - No kerning pairs and no ligatures: "AV" measures slightly wide.
 *  - No shaping. Arabic and Devanagari joining forms are measured as isolated
 *    glyphs, which over-estimates their width badly. RTL is not handled at all.
 *  - CJK and emoji fall back to a flat 1.0em advance, which is right for
 *    full-width ideographs and wrong for half-width kana.
 *  - Bold is modelled as a single multiplier per family rather than a second
 *    table, because ad copy is short and the residual is well inside tolerance.
 */

export type FontClass = 'sans' | 'serif' | 'mono';

export interface FontMetrics {
  /** Advance width in em units, keyed by character. */
  advances: Readonly<Record<string, number>>;
  /** Mean lowercase advance, used for any glyph missing from the table. */
  fallbackAdvance: number;
  /** Multiplier per font weight; the tables themselves are Regular (400). */
  weightScale: Readonly<Record<number, number>>;
  /**
   * Correction from "sum of isolated glyph advances" to "width Chrome actually
   * renders", fitted per weight against `tests/fixtures/reference-widths.json`.
   *
   * It absorbs the two approximations this model makes: kerning pairs, which
   * pull real strings slightly tighter, and modelling bold as one multiplier
   * rather than a second advance table. Kept as its own named factor so the
   * measured advances above stay measured rather than quietly fudged.
   */
  stringFitScale: Readonly<Record<number, number>>;
}

/** Documented tolerance of whole-string estimates against real measurement. */
export const MEASUREMENT_ERROR_MARGIN = 0.03;

/**
 * Renderers multiply fitted widths by this so a positive estimation error
 * still lands inside the box rather than clipping.
 */
export const WIDTH_SAFETY_FACTOR = 0.97;

/** Full-width advance for ideographic and emoji code points. */
const WIDE_GLYPH_ADVANCE = 1.0;

/** Characters covered by the packed tables, in order. */
const CHARSET =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2013\u2014\u2019\u2018\u201c\u201d\u2022\u2026\u00d7';

/**
 * Advances as integers of 1/10000 em, positionally aligned to CHARSET. Packed
 * rather than written as an object literal because this is generated data:
 * three hundred hand-maintained key/value lines would invite hand-editing.
 */
const INTER_PACKED =
  '2813 2876 4658 6333 6416 9819 6440 2998 3647 3647 5010 6616 2881 4600 2881 3604 6309 4067 ' +
  '6099 6177 6460 5933 6201 5659 6187 6201 2881 3018 6616 6616 6616 5112 9658 6899 6543 7305 ' +
  '7217 6011 5903 7461 7432 2686 5708 6719 5654 9033 7534 7646 6387 7646 6436 6416 6455 7441 ' +
  '6899 9854 6821 6787 6289 3647 3604 3647 4712 4561 3228 5615 6123 5713 6123 5830 3701 6133 ' +
  '5913 2422 2422 5488 2422 8760 5908 5996 6123 6123 3765 5278 3271 5913 5620 8184 5459 5620 ' +
  '5522 4263 3325 4263 6616 5000 10000 2607 2607 4404 4404 5625 8643 6616';

const GEORGIA_PACKED =
  '2412 3311 4116 6431 6099 8174 7104 2153 3750 3750 4722 6431 2695 3740 2695 4688 6138 4297 ' +
  '5586 5518 5649 5283 5659 5024 5962 5659 3125 3125 6431 6431 6431 4785 9287 6709 6538 6421 ' +
  '7490 6533 5991 7251 8149 3896 5176 6943 6035 9272 7671 7441 6099 7441 7017 5610 6187 7563 ' +
  '6665 9756 7104 6152 6016 3750 4688 3750 6431 6431 5000 5039 5601 4541 5742 4834 3252 5093 ' +
  '5820 2930 2920 5356 2861 8809 5908 5391 5713 5596 4097 4321 3452 5752 4966 7373 5049 4922 ' +
  '4438 4302 3750 4302 6431 6431 8569 2266 2266 4102 4102 3926 8071 6431';

/** Menlo, SF Mono, Roboto Mono and Courier are uniform by construction. */
const MONO_ADVANCE = 0.6021;

function unpack(packed: string): Record<string, number> {
  const values = packed.split(' ');
  const out: Record<string, number> = {};
  for (let i = 0; i < CHARSET.length; i += 1) {
    const ch = CHARSET[i];
    const raw = values[i];
    if (ch === undefined || raw === undefined) continue;
    out[ch] = Number(raw) / 10000;
  }
  return out;
}

const INTER: FontMetrics = {
  advances: unpack(INTER_PACKED),
  fallbackAdvance: 0.5363,
  weightScale: { 300: 0.978, 400: 1, 500: 1.0188, 600: 1.0375, 700: 1.0563, 800: 1.0793 },
  // Inter kerns noticeably, and more so at heavier weights.
  stringFitScale: { 300: 0.9965, 400: 0.9965, 500: 0.9892, 600: 0.982, 700: 0.9747, 800: 0.9747 },
};

const GEORGIA: FontMetrics = {
  advances: unpack(GEORGIA_PACKED),
  fallbackAdvance: 0.4991,
  // Georgia ships Regular and Bold only; Chrome resolves 500 to Regular and
  // everything from 600 up to Bold, so the scale is a step, not a ramp.
  weightScale: { 300: 1, 400: 1, 500: 1, 600: 1.1398, 700: 1.1398, 800: 1.1398 },
  // Georgia Regular sums exactly; Bold needs the correction because one
  // multiplier cannot express its per-glyph widening.
  stringFitScale: { 300: 1, 400: 1, 500: 1, 600: 1.0258, 700: 1.0258, 800: 1.0258 },
};

const MONO: FontMetrics = {
  advances: {},
  fallbackAdvance: MONO_ADVANCE,
  weightScale: { 300: 1, 400: 1, 500: 1, 600: 1, 700: 1, 800: 1 },
  // Monospace is uniform and unkerned: the model is exact.
  stringFitScale: { 300: 1, 400: 1, 500: 1, 600: 1, 700: 1, 800: 1 },
};

const TABLES: Readonly<Record<FontClass, FontMetrics>> = {
  sans: INTER,
  serif: GEORGIA,
  mono: MONO,
};

/**
 * Maps an arbitrary CSS font stack onto one of the three bundled tables.
 * Unknown families resolve to sans, which is the safest average.
 */
export function classifyFamily(family: string): FontClass {
  const f = family.toLowerCase();
  if (/mono|courier|consolas|menlo/.test(f)) return 'mono';
  if (/georgia|times|garamond|playfair|charter/.test(f)) return 'serif';
  if (/\bserif\b/.test(f) && !/sans-serif/.test(f)) return 'serif';
  return 'sans';
}

export function metricsFor(family: string): FontMetrics {
  return TABLES[classifyFamily(family)];
}

/** Advance of a single code point, in em units. */
export function advanceOf(metrics: FontMetrics, ch: string): number {
  const known = metrics.advances[ch];
  if (known !== undefined) return known;
  const code = ch.codePointAt(0) ?? 0;
  // CJK, Hangul, Kana, ideographic punctuation and emoji are full-width.
  if (code >= 0x1100 && code <= 0x11ff) return WIDE_GLYPH_ADVANCE;
  if (code >= 0x2e80 && code <= 0xa4cf) return WIDE_GLYPH_ADVANCE;
  if (code >= 0xac00 && code <= 0xd7a3) return WIDE_GLYPH_ADVANCE;
  if (code >= 0xf900 && code <= 0xfaff) return WIDE_GLYPH_ADVANCE;
  if (code >= 0x1f000) return WIDE_GLYPH_ADVANCE;
  return metrics.fallbackAdvance;
}

/** Combined per-weight multiplier: glyph widening times the string-fit correction. */
export function weightScaleFor(metrics: FontMetrics, weight: number): number {
  return (metrics.weightScale[weight] ?? 1) * (metrics.stringFitScale[weight] ?? 1);
}

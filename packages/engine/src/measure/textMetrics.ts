import {
  advanceOf,
  classifyFamily,
  metricsFor,
  weightScaleFor,
  MEASUREMENT_ERROR_MARGIN,
  WIDTH_SAFETY_FACTOR,
} from './fontTables.js';

export { MEASUREMENT_ERROR_MARGIN, WIDTH_SAFETY_FACTOR, classifyFamily };

export interface TextStyle {
  family: string;
  fontSizePx: number;
  weight: number;
}

/**
 * Estimated rendered width of `text` in px.
 *
 * Accurate to roughly ±3% against real browser measurement for Latin text; see
 * `fontTables.ts` for what it deliberately does not model.
 */
export function estimateWidth(text: string, style: TextStyle): number {
  const metrics = metricsFor(style.family);
  const scale = weightScaleFor(metrics, style.weight);
  let em = 0;
  // Iterating the string yields whole code points, so astral glyphs (emoji)
  // count once rather than twice.
  for (const ch of text) em += advanceOf(metrics, ch);
  return em * style.fontSizePx * scale;
}

export interface WrapOptions {
  maxWidthPx: number;
  /** Stop after this many lines; the caller decides whether that is a failure. */
  maxLines?: number;
  /** Character appended when a single word has to be split. */
  hyphen?: string;
}

export interface WrapResult {
  lines: string[];
  /** Width of the widest line, in px. */
  maxLineWidthPx: number;
  /** True when `maxLines` cut the text short. */
  truncated: boolean;
}

/**
 * Greedy word wrapping. Greedy rather than Knuth–Plass because the engine
 * re-wraps on every frame of a free-resize drag, and greedy is O(n) with no
 * lookahead; the ragged-edge quality difference is invisible at ad copy length.
 */
export function wrap(text: string, style: TextStyle, options: WrapOptions): WrapResult {
  const hyphen = options.hyphen ?? '-';
  const maxWidth = Math.max(1, options.maxWidthPx);
  const lines: string[] = [];

  const paragraphs = text.split('\n');
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (estimateWidth(candidate, style) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current.length > 0) {
        lines.push(current);
        current = '';
      }
      // The word alone may still be too wide: break it with a hyphen.
      if (estimateWidth(word, style) <= maxWidth) {
        current = word;
      } else {
        const pieces = breakLongWord(word, style, maxWidth, hyphen);
        const last = pieces.pop();
        for (const piece of pieces) lines.push(piece);
        current = last ?? '';
      }
    }
    if (current.length > 0) lines.push(current);
  }

  const maxLines = options.maxLines;
  let truncated = false;
  let output = lines;
  if (maxLines !== undefined && lines.length > maxLines) {
    output = lines.slice(0, maxLines);
    truncated = true;
    const lastIndex = output.length - 1;
    const last = output[lastIndex];
    if (last !== undefined) {
      output[lastIndex] = ellipsize(last, style, maxWidth);
    }
  }

  let widest = 0;
  for (const line of output) widest = Math.max(widest, estimateWidth(line, style));

  return { lines: output, maxLineWidthPx: widest, truncated };
}

/** Splits a word too wide for the line into hyphenated chunks. */
function breakLongWord(word: string, style: TextStyle, maxWidth: number, hyphen: string): string[] {
  const chars = [...word];
  const pieces: string[] = [];
  let chunk = '';
  for (const ch of chars) {
    const candidate = chunk + ch;
    if (estimateWidth(candidate + hyphen, style) > maxWidth && chunk.length > 0) {
      pieces.push(chunk + hyphen);
      chunk = ch;
    } else {
      chunk = candidate;
    }
  }
  if (chunk.length > 0) pieces.push(chunk);
  // A box narrower than a single glyph would loop forever above; guard it.
  return pieces.length > 0 ? pieces : [word];
}

/** Trims a line so that it plus an ellipsis fits `maxWidth`. */
export function ellipsize(line: string, style: TextStyle, maxWidth: number): string {
  const ellipsis = '…';
  if (estimateWidth(line + ellipsis, style) <= maxWidth) return line + ellipsis;
  const chars = [...line];
  while (chars.length > 0) {
    chars.pop();
    const candidate = chars.join('').trimEnd();
    if (estimateWidth(candidate + ellipsis, style) <= maxWidth) return candidate + ellipsis;
  }
  return ellipsis;
}

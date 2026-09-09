/** WCAG 2.1 contrast maths. Pure, no DOM colour parsing. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) {
    // Callers validate with zod first; this keeps the function total.
    return { r: 0, g: 0, b: 0 };
  }
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function toHex(c: Rgb): string {
  const part = (v: number): string =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(c.r)}${part(c.g)}${part(c.b)}`;
}

function channelLuminance(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** WCAG contrast ratio in [1, 21]. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/** Alpha-composite `fg` over `bg` — used to model a semi-opaque scrim. */
export function composite(fg: string, bg: string, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const a = Math.max(0, Math.min(1, alpha));
  return toHex({
    r: f.r * a + b.r * (1 - a),
    g: f.g * a + b.g * (1 - a),
    b: f.b * a + b.b * (1 - a),
  });
}

/**
 * Smallest scrim opacity (in 5% steps) that lifts `text` over `backdrop` to the
 * required ratio. Returns null when even a fully opaque scrim cannot do it.
 */
export function solveScrimOpacity(
  text: string,
  backdrop: string,
  scrimFill: string,
  required: number,
): number | null {
  for (let step = 1; step <= 20; step += 1) {
    const alpha = step * 0.05;
    if (contrastRatio(text, composite(scrimFill, backdrop, alpha)) >= required) {
      return Math.round(alpha * 100) / 100;
    }
  }
  return null;
}

/** Picks whichever of black/white contrasts best against `backdrop`. */
export function bestMonochrome(backdrop: string): string {
  return contrastRatio('#ffffff', backdrop) >= contrastRatio('#000000', backdrop)
    ? '#ffffff'
    : '#000000';
}

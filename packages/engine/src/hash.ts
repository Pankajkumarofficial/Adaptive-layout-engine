/**
 * FNV-1a 32-bit. Chosen over anything crypto because the engine must run
 * identically in Node and in the browser with zero imports, and this is 8 lines
 * of integer math with no platform surface at all.
 */
export function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

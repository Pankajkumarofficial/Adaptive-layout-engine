import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { LayoutResult } from '../src/types.js';

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'golden');

/** `UPDATE_GOLDEN=1 npm test` rewrites the snapshots instead of asserting. */
const UPDATE = process.env.UPDATE_GOLDEN === '1';

/**
 * The snapshot deliberately drops nothing: trace included. A layout change that
 * does not move a pixel but changes *why* is still a change worth reviewing.
 */
export function expectGolden(name: string, result: LayoutResult): void {
  const file = join(GOLDEN_DIR, `${name}.json`);
  const serialised = JSON.stringify(result, null, 2) + '\n';

  if (UPDATE || !existsSync(file)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(file, serialised, 'utf8');
    return;
  }

  const expected = readFileSync(file, 'utf8');
  if (serialised !== expected) {
    // Compare parsed objects so vitest prints a structural diff, not a 200-line
    // string mismatch.
    expect(JSON.parse(serialised)).toEqual(JSON.parse(expected));
    // Fall through only if the objects match but the bytes do not.
    expect(serialised).toBe(expected);
  }
}

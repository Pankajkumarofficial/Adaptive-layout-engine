import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solve } from '../src/solve.js';
import { DEMO_SPEC, PRESET_SURFACES } from '../src/fixtures/index.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

describe('engine purity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports no Node built-ins, DOM globals or frameworks', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of [
        /from 'node:/,
        /require\(/,
        /\bdocument\./,
        /\bwindow\./,
        /from 'react/,
        /from 'mongoose/,
        /from 'express/,
      ]) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('calls neither Math.random nor Date.now', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    for (const surface of PRESET_SURFACES) solve(DEMO_SPEC, surface);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('does not mutate the spec it is given', () => {
    const before = JSON.stringify(DEMO_SPEC);
    for (const surface of PRESET_SURFACES) solve(DEMO_SPEC, surface);
    expect(JSON.stringify(DEMO_SPEC)).toBe(before);
  });

  it('does not mutate the surface it is given', () => {
    const before = JSON.stringify(PRESET_SURFACES);
    for (const surface of PRESET_SURFACES) solve(DEMO_SPEC, surface);
    expect(JSON.stringify(PRESET_SURFACES)).toBe(before);
  });

  it('produces JSON-safe output with no NaN or Infinity', () => {
    for (const surface of PRESET_SURFACES) {
      const result = solve(DEMO_SPEC, surface);
      const json = JSON.stringify(result);
      // JSON.stringify turns NaN and Infinity into null, so scan the numbers
      // themselves rather than trusting the serialised string.
      for (const p of result.placed) {
        for (const v of [p.frame.x, p.frame.y, p.frame.w, p.frame.h, p.opacity, p.z]) {
          expect(Number.isFinite(v)).toBe(true);
        }
      }
      expect(json.includes('null')).toBe(false);
    }
  });
});

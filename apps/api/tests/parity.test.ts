import { describe, expect, it } from 'vitest';
import { solve, DEMO_SPEC, PRESET_SURFACES } from '@ale/engine';
import { renderMany } from '../src/services/render.js';

/**
 * The claim the whole architecture rests on: a solve on the server and a solve
 * in the browser are the same solve.
 *
 * This test runs the server's render path and compares it, field for field,
 * with a direct `solve()` — the call the client makes. If the engine ever grew
 * a dependency on the DOM, a clock, or randomness, this is what would break.
 */
describe('client/server parity', () => {
  it('produces identical fingerprints for every preset', () => {
    const server = renderMany(DEMO_SPEC, PRESET_SURFACES);
    PRESET_SURFACES.forEach((surface, i) => {
      const client = solve(DEMO_SPEC, surface);
      expect(server[i]?.result.fingerprint, surface.label).toBe(client.fingerprint);
    });
  });

  it('produces byte-identical results, not merely matching hashes', () => {
    const server = renderMany(DEMO_SPEC, PRESET_SURFACES);
    PRESET_SURFACES.forEach((surface, i) => {
      const client = solve(DEMO_SPEC, surface);
      expect(JSON.stringify(server[i]?.result), surface.label).toBe(JSON.stringify(client));
    });
  });

  it('agrees on which elements were dropped and why', () => {
    for (const surface of PRESET_SURFACES) {
      const [server] = renderMany(DEMO_SPEC, [surface]);
      const client = solve(DEMO_SPEC, surface);
      expect(server?.result.dropped).toEqual(client.dropped);
    }
  });

  it('measures a solve time without changing the result', () => {
    const [a] = renderMany(DEMO_SPEC, [PRESET_SURFACES[0]!]);
    const [b] = renderMany(DEMO_SPEC, [PRESET_SURFACES[0]!]);
    expect(a?.result.fingerprint).toBe(b?.result.fingerprint);
    expect(a?.solveMs).toBeGreaterThanOrEqual(0);
  });
});

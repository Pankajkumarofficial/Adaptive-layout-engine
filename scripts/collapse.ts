/**
 * The worked example in the README: what a spec loses as its surface shrinks,
 * and at exactly which threshold.
 *
 *   npm run collapse
 */
import { solve, DEMO_SPEC, PRESET_SURFACES } from '../packages/engine/src/index.js';
import type { AdSpec, Surface } from '../packages/engine/src/index.js';

const spec: AdSpec = DEMO_SPEC;
const ids = spec.elements.map((el) => el.id);

function surfaceOf(width: number, height: number): Surface {
  return {
    id: `${width}x${height}`,
    label: `${width}x${height}`,
    width,
    height,
    dpr: 2,
    interactionHint: 'tap',
  };
}

function survivors(width: number, height: number): Set<string> {
  return new Set(solve(spec, surfaceOf(width, height)).placed.map((p) => p.id));
}

// --- 1. The preset chain -----------------------------------------------------
console.log('| Surface | Archetype | Survives | Dropped |');
console.log('| --- | --- | --: | --- |');
for (const surface of PRESET_SURFACES) {
  const result = solve(spec, surface);
  console.log(
    `| ${surface.label} | \`${result.archetype}\` | ${result.placed.length}/${ids.length} | ` +
      `${result.dropped.length === 0 ? '—' : result.dropped.map((d) => `\`${d.id}\``).join(', ')} |`,
  );
}

// --- 2. Exact thresholds at a fixed 320px width ------------------------------
// Binary search the height at which each element stops being placed. The engine
// is deterministic, so a threshold is an exact pixel, not an estimate.
const WIDTH = 320;
const TALL = 1200;
const SHORT = 40;

console.log('\n| Element | Priority | Last height it survives at 320px wide | Reason given |');
console.log('| --- | --: | --: | --- |');

for (const el of [...spec.elements].sort((a, b) => b.priority - a.priority)) {
  if (!survivors(WIDTH, TALL).has(el.id)) continue;
  if (survivors(WIDTH, SHORT).has(el.id)) {
    console.log(`| \`${el.id}\` | ${el.priority} | survives to ${SHORT}px | never dropped |`);
    continue;
  }

  let lo = SHORT;
  let hi = TALL;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (survivors(WIDTH, mid).has(el.id)) hi = mid;
    else lo = mid;
  }

  const atDrop = solve(spec, surfaceOf(WIDTH, lo));
  const reason = atDrop.dropped.find((d) => d.id === el.id)?.reason ?? 'not placed';
  console.log(`| \`${el.id}\` | ${el.priority} | ${hi}px | ${reason} |`);
}

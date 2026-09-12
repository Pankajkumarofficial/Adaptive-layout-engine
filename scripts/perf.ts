/**
 * Solve-time distribution across the preset matrix, for the README.
 *
 *   npm run perf
 */
import process from 'node:process';
import { solve, DEMO_SPEC, PRESET_SURFACES } from '../packages/engine/src/index.js';

const WARMUP = 200;
const SAMPLES = 2000;

function percentile(sorted: readonly number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[i] ?? 0;
}

const rows: string[] = [];
rows.push('| Surface | Archetype | Dropped | p50 | p95 | p99 |');
rows.push('| --- | --- | --: | --: | --: | --: |');

const all: number[] = [];
for (const surface of PRESET_SURFACES) {
  for (let i = 0; i < WARMUP; i += 1) solve(DEMO_SPEC, surface);

  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const started = performance.now();
    solve(DEMO_SPEC, surface);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  all.push(...samples);

  const result = solve(DEMO_SPEC, surface);
  rows.push(
    `| ${surface.label} | \`${result.archetype}\` | ${result.dropped.length} | ` +
      `${percentile(samples, 0.5).toFixed(3)} ms | ${percentile(samples, 0.95).toFixed(3)} ms | ` +
      `${percentile(samples, 0.99).toFixed(3)} ms |`,
  );
}

all.sort((a, b) => a - b);
rows.push(
  `| **All presets** | | | **${percentile(all, 0.5).toFixed(3)} ms** | ` +
    `**${percentile(all, 0.95).toFixed(3)} ms** | **${percentile(all, 0.99).toFixed(3)} ms** |`,
);

console.log(rows.join('\n'));
console.log(
  `\nnode ${process.version}, ${SAMPLES} samples per surface after ${WARMUP} warmup runs`,
);

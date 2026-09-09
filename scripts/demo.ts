/**
 * Solves the demo spec across the whole preset matrix and prints the result.
 *
 * Lives outside `packages/engine/src` on purpose: it imports `node:process`,
 * and the purity test forbids platform imports inside the engine itself.
 *
 *   npm run demo              # every preset, summary only
 *   npm run demo -- --trace   # include the full decision trace
 *   npm run demo -- banner    # only presets whose id or label matches
 */
import process from 'node:process';
import {
  solve,
  formatTrace,
  DEMO_SPEC,
  PRESET_SURFACES,
  type LayoutResult,
  type PlacedElement,
} from '../packages/engine/src/index.js';

const args = process.argv.slice(2);
const showTrace = args.includes('--trace');
const filters = args.filter((a) => !a.startsWith('--'));

const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const RESET = '\u001b[0m';
const YELLOW = '\u001b[33m';
const GREEN = '\u001b[32m';

function describe(p: PlacedElement): string {
  if (p.lines !== undefined) {
    const scrim = p.scrim !== undefined ? ` +scrim ${p.scrim.fill}@${p.scrim.opacity}` : '';
    return `${p.fontSizePx}px/${p.lineHeightPx} ${p.color} ${JSON.stringify(p.lines)}${scrim}`;
  }
  if (p.imageCrop !== undefined) {
    const c = p.imageCrop;
    return `crop ${c.sw}x${c.sh} at ${c.sx},${c.sy}`;
  }
  return p.fill !== undefined ? `fill ${p.fill}` : '';
}

function report(result: LayoutResult): void {
  const { surface: s, surfaceClass: k } = result;
  console.log(
    `\n${BOLD}${s.label}${RESET}  ${s.width}x${s.height}  ` +
      `${DIM}${k.aspectBucket}/${k.densityClass}  aspect ${k.aspect.toFixed(3)}  ` +
      `touch ${k.minTouchTarget}px${RESET}`,
  );
  console.log(
    `  archetype ${GREEN}${result.archetype}${RESET}   ${DIM}${result.fingerprint}${RESET}`,
  );

  for (const p of result.placed) {
    const f = p.frame;
    const box = `${String(f.w).padStart(7)}x${String(f.h).padEnd(7)} at ${String(f.x).padStart(6)},${String(f.y).padStart(7)}`;
    console.log(
      `    ${DIM}z${String(p.z).padStart(2)}${RESET} ${p.id.padEnd(9)} ${box}  ${describe(p)}`,
    );
  }

  for (const d of result.dropped) {
    console.log(`    ${YELLOW}dropped${RESET} ${d.id.padEnd(9)} ${DIM}${d.reason}${RESET}`);
  }
  for (const w of result.warnings) {
    console.log(`    ${YELLOW}warn${RESET}    ${w}`);
  }
  if (showTrace) {
    console.log(`\n${DIM}${formatTrace(result.trace)}${RESET}`);
  }
}

const surfaces = PRESET_SURFACES.filter(
  (s) =>
    filters.length === 0 ||
    filters.some((f) => s.id.includes(f) || s.label.toLowerCase().includes(f.toLowerCase())),
);

if (surfaces.length === 0) {
  console.error(`no preset matches ${filters.join(', ')}`);
  process.exit(1);
}

console.log(`${BOLD}${DEMO_SPEC.name}${RESET} — ${DEMO_SPEC.elements.length} elements, one spec`);

let totalMs = 0;
for (const surface of surfaces) {
  const started = performance.now();
  const result = solve(DEMO_SPEC, surface);
  totalMs += performance.now() - started;
  report(result);
}

console.log(
  `\n${DIM}solved ${surfaces.length} surface${surfaces.length === 1 ? '' : 's'} in ${totalMs.toFixed(2)}ms${RESET}\n`,
);

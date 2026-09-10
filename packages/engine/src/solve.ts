import type { Archetype, ArchetypeContext, Assignment } from './archetypes/index.js';
import { fingerprint } from './fingerprint.js';
import { roundRect, roundTo } from './geometry.js';
import { Tracer } from './trace.js';
import { classify, gutterFor } from './steps/classify.js';
import { budget, compactRegion, type Shortfall } from './steps/budget.js';
import { chooseDrop } from './steps/degrade.js';
import { enforceContrast } from './steps/contrast.js';
import { enforceSafeArea } from './steps/safeArea.js';
import { fitText, textBoxOf, textFrameFor, type TextFit } from './steps/fitText.js';
import { coverCrop, DEFAULT_FOCAL_POINT } from './steps/imageCrop.js';
import { normalize, type NormalizedElement, type NormalizedSpec } from './steps/normalize.js';
import { selectArchetype } from './steps/selectArchetype.js';
import type {
  AdSpec,
  DroppedElement,
  LayoutResult,
  PlacedElement,
  Rect,
  Surface,
  SurfaceClass,
} from './types.js';

/** Ignore deficits smaller than this; they are float noise, not design problems. */
const DEFICIT_EPSILON = 0.5;

/**
 * Upper bound on touch-target re-entries, per the pipeline contract. Reached
 * only when a CTA cannot be grown even after the region was re-budgeted.
 */
const MAX_TOUCH_REENTRIES = 2;

/**
 * How many consecutive drops may fail to improve the fit before the engine
 * concludes that dropping is not the answer here.
 *
 * It cannot be zero. Degradation is not monotonic: removing the legal line from
 * a cramped strip can leave the deficit slightly worse, and only the *next*
 * drop — the badge it is bound to competing for the same row — resolves it. One
 * bad step is normal; two in a row means the constraint is somewhere no
 * droppable element is competing for.
 */
const DEGRADE_PATIENCE = 2;

interface Attempt {
  regions: Record<string, Rect>;
  assignments: Assignment[];
  frames: Record<string, Rect>;
  fits: Map<string, TextFit>;
  shortfalls: Shortfall[];
  deficitPx: number;
  unresolvedTouchTargets: string[];
}

/**
 * Solve one spec for one surface.
 *
 * Pure and deterministic by construction: no clock, no randomness, no DOM, no
 * I/O. The same (spec, surface) pair produces a byte-identical LayoutResult in
 * Node and in the browser, which is what makes the golden tests and the
 * client/server parity test meaningful.
 */
export function solve(spec: AdSpec, surface: Surface): LayoutResult {
  const tracer = new Tracer();

  // 1 — normalize
  const norm = normalize(spec, surface, tracer);

  // 2 — classify
  const klass = classify(norm.surface, tracer);
  const gutter = gutterFor(klass.densityClass);

  // 3 — select archetype
  const { archetype } = selectArchetype(klass, norm.elements, tracer);

  // 4-7 — budget, fit, degrade, safe area
  let active = norm.elements.slice();
  const dropped: DroppedElement[] = norm.empty.map((id) => ({
    id,
    reason: 'has no text to place',
  }));
  let attempt = runAttempt(archetype, norm, klass, gutter, active, tracer);

  let pass = 0;
  const maxPasses = norm.elements.length;

  // The best fit seen so far, so a cascade that overshoots can be rewound to
  // the layout that actually worked rather than to wherever it stopped.
  let best = { active, attempt, dropped: dropped.slice(), pass };
  let stale = 0;

  while (attempt.deficitPx > DEFICIT_EPSILON && pass < maxPasses) {
    const plan = chooseDrop(active, attempt.shortfalls, norm.neverDrop, norm.alwaysPairs, tracer);
    if (plan === null) break;

    const removing = new Set(plan.ids);
    active = active.filter((el) => !removing.has(el.id));
    for (const id of plan.ids) {
      dropped.push({ id, reason: plan.reasons[id] ?? 'dropped to resolve a layout deficit' });
    }

    pass += 1;
    tracer.setPass(pass);
    attempt = runAttempt(archetype, norm, klass, gutter, active, tracer);

    if (attempt.deficitPx < best.attempt.deficitPx - DEFICIT_EPSILON) {
      best = { active, attempt, dropped: dropped.slice(), pass };
      stale = 0;
      continue;
    }

    stale += 1;
    if (stale >= DEGRADE_PATIENCE) break;
  }

  // Never ship a layout worse than one already found. Dropping content that
  // bought no room is pure loss, so rewind to the best fit seen.
  if (attempt.deficitPx > best.attempt.deficitPx + DEFICIT_EPSILON) {
    const abandoned = dropped.slice(best.dropped.length).map((d) => d.id);
    active = best.active;
    attempt = best.attempt;
    dropped.length = 0;
    dropped.push(...best.dropped);
    pass = best.pass;
    // Set the pass back *before* the warning, so it is reported against the
    // layout that actually shipped rather than filtered out as a stale pass.
    tracer.setPass(pass);
    tracer.warn(
      'degrade',
      `dropping ${abandoned.join(', ')} did not buy any room, so ${abandoned.length === 1 ? 'it is' : 'they are'} kept and the layout is clamped instead`,
      { data: { deficitPx: Math.round(attempt.deficitPx), abandoned: abandoned.length } },
    );
  }

  if (attempt.deficitPx > DEFICIT_EPSILON) {
    tracer.warn(
      'degrade',
      `layout still overflows by ${Math.round(attempt.deficitPx)}px with only protected elements left; clamping`,
      { data: { deficitPx: Math.round(attempt.deficitPx), remaining: active.length } },
    );
  }

  if (attempt.unresolvedTouchTargets.length > 0) {
    tracer.warn(
      'safeArea',
      `CTA ${attempt.unresolvedTouchTargets.join(', ')} stays below the ${klass.minTouchTarget}px target after ${MAX_TOUCH_REENTRIES} re-budget attempts`,
      { data: { target: klass.minTouchTarget } },
    );
  }

  // 8-9 — image crop and contrast, then materialise
  const placed = materialise(active, attempt, norm, tracer);

  // 10 — fingerprint
  const fp = fingerprint(archetype.id, norm.surface.width, norm.surface.height, placed, dropped);
  tracer.info('fingerprint', `layout hashes to ${fp}`, {
    data: { placed: placed.length, dropped: dropped.length },
  });

  return {
    surface: norm.surface,
    surfaceClass: klass,
    archetype: archetype.id,
    regions: Object.fromEntries(Object.entries(attempt.regions).map(([k, v]) => [k, roundRect(v)])),
    placed,
    dropped,
    warnings: tracer.warnings(),
    trace: tracer.snapshot(),
    fingerprint: fp,
  };
}

/**
 * One full pass of steps 4, 5 and 7 over a candidate element set.
 *
 * Split out because `degrade` re-runs it verbatim after each drop; keeping it
 * a pure function of `active` is what makes the degradation loop trivially
 * correct.
 */
function runAttempt(
  archetype: Archetype,
  norm: NormalizedSpec,
  klass: SurfaceClass,
  gutter: number,
  active: readonly NormalizedElement[],
  tracer: Tracer,
): Attempt {
  const ctx: ArchetypeContext = {
    klass,
    content: klass.contentBox,
    gutter,
    theme: norm.spec.theme,
    elements: active,
  };

  const regions = archetype.regions(norm.surface, ctx);
  const assignments = archetype.assign(active, regions);

  // Which elements paint edge-to-edge is a property of the composition, not of
  // the element: a hero is inset in `stack` and full-bleed in `overlay`.
  const bleedRegions = new Set(archetype.bleedRegions);
  const bleeding = new Set<string>();
  for (const a of assignments) {
    if (bleedRegions.has(a.region)) bleeding.add(a.elementId);
  }

  const budgeted = budget(regions, assignments, active, klass, gutter, bleeding, tracer);
  const shortfalls: Shortfall[] = [...budgeted.shortfalls];

  // Step 5 — fit text, then shrink each text frame onto its real line box.
  const fits = new Map<string, TextFit>();
  const frames: Record<string, Rect> = { ...budgeted.frames };
  for (const el of active) {
    if (el.text === null) continue;
    const band = frames[el.id];
    if (band === undefined) continue;
    const box = textBoxOf(el, band, gutter);
    const fit = fitText(el, box, norm.spec.theme, tracer);
    fits.set(el.id, fit);
    frames[el.id] = textFrameFor(el, band, fit, klass, gutter);
    if (fit.overflow) {
      // Report the genuine shortfall on whichever axis is binding: how much
      // more room this text needed than it was given. Anything that does not
      // shrink when the box grows would make the degradation loop blind.
      const shortH = fit.neededHeightPx - box.h;
      const shortW = fit.neededWidthPx - box.w;
      shortfalls.push(
        shortW > shortH
          ? { elementId: el.id, axis: 'w', required: fit.neededWidthPx, available: box.w }
          : { elementId: el.id, axis: 'h', required: fit.neededHeightPx, available: box.h },
      );
    }
  }

  // Second half of step 4 — restack each region now that heights are real.
  const byRegion = new Map<string, { id: string; frame: Rect }[]>();
  for (const a of assignments) {
    if (bleedRegions.has(a.region)) continue;
    const frame = frames[a.elementId];
    if (frame === undefined) continue;
    const list = byRegion.get(a.region);
    if (list === undefined) byRegion.set(a.region, [{ id: a.elementId, frame }]);
    else list.push({ id: a.elementId, frame });
  }
  for (const [regionKey, items] of byRegion) {
    const region = regions[regionKey];
    // Bleed regions are not compacted: their contents are meant to fill them.
    if (region === undefined || bleedRegions.has(regionKey)) continue;
    const compacted = compactRegion(region, items, gutter);
    for (const [id, frame] of Object.entries(compacted)) frames[id] = frame;
  }

  // Step 7 — safe area and touch targets.
  const safe = enforceSafeArea(frames, active, klass, bleeding, tracer);
  let deficitPx = shortfalls.reduce((acc, s) => acc + (s.required - s.available), 0);

  // A CTA that had to grow took space nobody budgeted for. Rather than a
  // separate re-entry loop, that pressure is folded back into the deficit so
  // the existing degradation loop resolves it — same outcome, one code path.
  for (const id of safe.grown) {
    const before = frames[id];
    const after = safe.frames[id];
    if (before === undefined || after === undefined) continue;
    deficitPx += Math.max(0, after.h - before.h);
  }

  return {
    regions,
    assignments,
    frames: safe.frames,
    fits,
    shortfalls,
    deficitPx,
    unresolvedTouchTargets: safe.unresolved,
  };
}

/** Steps 8 and 9, plus serialisation into `PlacedElement`s. */
function materialise(
  active: readonly NormalizedElement[],
  attempt: Attempt,
  norm: NormalizedSpec,
  tracer: Tracer,
): PlacedElement[] {
  const withFrames = active
    .filter((el) => attempt.frames[el.id] !== undefined)
    .map((el) => ({ el, frame: attempt.frames[el.id] as Rect }));

  const ordered = withFrames
    .slice()
    .sort((a, b) => a.el.z - b.el.z || a.el.id.localeCompare(b.el.id));

  const placed: PlacedElement[] = [];
  for (const { el, frame } of ordered) {
    const content = el.source.content;
    const base: PlacedElement = {
      id: el.id,
      frame: roundRect(frame),
      opacity: 1,
      z: el.z,
    };

    if (content.kind === 'shape') {
      placed.push({ ...base, fill: content.fill });
      continue;
    }

    if (content.kind === 'image') {
      const focal = content.focalPoint ?? DEFAULT_FOCAL_POINT;
      const crop = coverCrop(content.intrinsic, frame, focal);
      tracer.info(
        'imageCrop',
        `cropped "${el.id}" to ${Math.round(crop.sw)}x${Math.round(crop.sh)} around focal ${focal.x},${focal.y}`,
        {
          subject: el.id,
          data: {
            sx: crop.sx,
            sy: crop.sy,
            sw: crop.sw,
            sh: crop.sh,
            intrinsicW: content.intrinsic.w,
            intrinsicH: content.intrinsic.h,
          },
        },
      );
      placed.push({ ...base, imageCrop: crop });
      continue;
    }

    const fit = attempt.fits.get(el.id);
    const text = el.text;
    if (fit === undefined || text === null) {
      placed.push(base);
      continue;
    }

    const decision = enforceContrast(
      el,
      frame,
      ordered,
      norm.spec.theme,
      norm.minContrastRatio,
      tracer,
    );

    const entry: PlacedElement = {
      ...base,
      fontSizePx: roundTo(fit.fontSizePx, 2),
      lineHeightPx: roundTo(fit.lineHeightPx, 2),
      lines: fit.lines,
      textAlign: text.align,
      color: decision.color,
    };
    if (el.role === 'cta') entry.fill = norm.spec.theme.palette.ctaBg;
    if (decision.scrim !== undefined) entry.scrim = decision.scrim;
    placed.push(entry);
  }

  return placed;
}

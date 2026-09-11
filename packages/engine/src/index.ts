export * from './types.js';
export { solve } from './solve.js';
export { SpecError, type SpecIssue } from './errors.js';
export { Tracer, formatTrace } from './trace.js';
export { fingerprint, FINGERPRINT_VERSION } from './fingerprint.js';
export {
  ARCHETYPES,
  BLEED_REGION,
  stackArchetype,
  stripArchetype,
  splitArchetype,
  overlayArchetype,
  byReadingOrder,
  PINNABLE,
  ROLE_RANK,
  type Archetype,
  type ArchetypeContext,
  type Assignment,
} from './archetypes/index.js';
export {
  aspectBucketOf,
  densityClassOf,
  classify,
  gutterFor,
  ASPECT_BREAKPOINTS,
  DENSITY_BREAKPOINTS,
  MIN_TOUCH_TARGET,
} from './steps/classify.js';
export { normalize, ROLE_DEFAULTS, type NormalizedElement } from './steps/normalize.js';
export { selectArchetype, ARCHETYPE_TABLE } from './steps/selectArchetype.js';
export {
  allocateBands,
  budget,
  compactRegion,
  compactRow,
  crossAlignOf,
  rowAlignOf,
  minHeightOf,
  minWidthOf,
} from './steps/budget.js';
export { fitText, typeLadder, textFrameFor, TYPE_BASE_PX } from './steps/fitText.js';
export { chooseDrop, pairClosure } from './steps/degrade.js';
export { enforceSafeArea } from './steps/safeArea.js';
export { coverCrop, DEFAULT_FOCAL_POINT } from './steps/imageCrop.js';
export { enforceContrast, ASSUMED_IMAGE_BACKDROP } from './steps/contrast.js';
export {
  estimateWidth,
  wrap,
  ellipsize,
  MEASUREMENT_ERROR_MARGIN,
  WIDTH_SAFETY_FACTOR,
} from './measure/textMetrics.js';
export { classifyFamily, metricsFor } from './measure/fontTables.js';
export { contrastRatio, relativeLuminance, parseHex, composite } from './color.js';
export { insetRect, containRect, roundRect, roundTo, clamp, rect } from './geometry.js';
export * from './fixtures/index.js';

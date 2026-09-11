import type { ImageCrop, PinTo, Point, Size } from '@ale/engine';

/**
 * The arithmetic behind canvas direct manipulation, kept out of the component
 * so it can be tested without a DOM — which is the same reason the engine has
 * no DOM either.
 *
 * Every function here turns a pointer movement into a value that belongs in the
 * spec. None of them produce a position for the renderer.
 */

/** Roles whose position an author can actually express. Others have none. */
export const PINNABLE: ReadonlySet<string> = new Set(['logo', 'badge', 'legal', 'cta']);

/** Within this fraction of an edge, a drop means that edge; otherwise, centre. */
export const EDGE_ZONE = 0.28;

/**
 * The edge a drop lands on, from a point in 0..1 surface coordinates.
 *
 * Deliberately coarse: `pinTo` has five values, so the gesture should resolve
 * to five outcomes and say which one before you let go. A continuous position
 * would imply the spec can hold one, and it cannot.
 */
export function nearestEdge(x: number, y: number): PinTo {
  const edges: Array<[PinTo, number]> = [
    ['left', x],
    ['right', 1 - x],
    ['top', y],
    ['bottom', 1 - y],
  ];
  let best: [PinTo, number] = edges[0] as [PinTo, number];
  for (const edge of edges) if (edge[1] < best[1]) best = edge;
  return best[1] < EDGE_ZONE ? best[0] : 'center';
}

export interface PanAxes {
  x: boolean;
  y: boolean;
}

/**
 * Which axes of a picture can actually be panned on this surface.
 *
 * An axis the crop did not trim has nowhere to travel. Dragging it would write
 * a large `focalPoint` change that this canvas cannot show and the other
 * surfaces would lurch to, so the axis is locked instead.
 */
export function panAxes(intrinsic: Size, crop: ImageCrop | undefined): PanAxes {
  if (crop === undefined) return { x: false, y: false };
  return { x: intrinsic.w - crop.sw > 1, y: intrinsic.h - crop.sh > 1 };
}

/**
 * Focal point after dragging the picture by (dx, dy) displayed pixels.
 *
 * Dragging right pulls the image right, which means the crop window travels
 * left — hence the subtraction. One displayed pixel is `crop.sw / displayedW`
 * intrinsic pixels, and moving the window by one intrinsic pixel moves the
 * focal point by `1 / intrinsic.w`.
 */
export function focalFromDrag(
  start: Point,
  dx: number,
  dy: number,
  displayed: Size,
  intrinsic: Size,
  crop: ImageCrop,
  pan: PanAxes,
): Point {
  const perPx = crop.sw / Math.max(1, displayed.w) / intrinsic.w;
  const perPy = crop.sh / Math.max(1, displayed.h) / intrinsic.h;
  return {
    x: pan.x ? clamp01(start.x - dx * perPx) : start.x,
    y: pan.y ? clamp01(start.y - dy * perPy) : start.y,
  };
}

/** Smallest cap the corner handle may write, so the spec stays valid. */
export const MIN_CAP_PX = 8;

/**
 * Size cap from a corner handle dragged to (dx, dy) from the frame's origin.
 *
 * The handle stops at the element's own `minSize`. Dragged past it you would be
 * asking for something smaller than the floor you already declared, which no
 * surface can satisfy — the engine raises such a cap back and says so, but the
 * gesture should not be able to express the contradiction in the first place.
 */
export function capFromHandle(
  dx: number,
  dy: number,
  scale: number,
  minSize?: Partial<Size>,
): { w: number; h: number } {
  const floorW = Math.max(MIN_CAP_PX, minSize?.w ?? 0);
  const floorH = Math.max(MIN_CAP_PX, minSize?.h ?? 0);
  return {
    w: Math.max(floorW, Math.round(dx / scale)),
    h: Math.max(floorH, Math.round(dy / scale)),
  };
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

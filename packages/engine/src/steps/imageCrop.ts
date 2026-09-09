import { clamp, roundTo } from '../geometry.js';
import type { ImageCrop, Point, Rect, Size } from '../types.js';

export const DEFAULT_FOCAL_POINT: Point = { x: 0.5, y: 0.5 };

/**
 * Step 8 — cover-fit crop that keeps the focal point in view.
 *
 * The crop window is the largest rectangle of the source with the frame's
 * aspect ratio, centred on the focal point and then slid back inside the
 * source bounds. Sliding rather than scaling is deliberate: the subject drifts
 * off-centre near the edges, but it is never cropped out and the image is
 * never letterboxed.
 */
export function coverCrop(
  intrinsic: Size,
  frame: Rect,
  focal: Point = DEFAULT_FOCAL_POINT,
): ImageCrop {
  const safeIntrinsic: Size = {
    w: Math.max(1, intrinsic.w),
    h: Math.max(1, intrinsic.h),
  };
  const frameW = Math.max(1, frame.w);
  const frameH = Math.max(1, frame.h);

  const scale = Math.max(frameW / safeIntrinsic.w, frameH / safeIntrinsic.h);
  const sw = Math.min(safeIntrinsic.w, frameW / scale);
  const sh = Math.min(safeIntrinsic.h, frameH / scale);

  const fx = clamp(focal.x, 0, 1);
  const fy = clamp(focal.y, 0, 1);

  const sx = clamp(fx * safeIntrinsic.w - sw / 2, 0, safeIntrinsic.w - sw);
  const sy = clamp(fy * safeIntrinsic.h - sh / 2, 0, safeIntrinsic.h - sh);

  return {
    sx: roundTo(sx, 2),
    sy: roundTo(sy, 2),
    sw: roundTo(sw, 2),
    sh: roundTo(sh, 2),
  };
}

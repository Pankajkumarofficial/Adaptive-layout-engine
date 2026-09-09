import type { Surface } from '../types.js';

/**
 * The preset matrix. These are the surfaces the playground shows side by side
 * and the ones the golden tests pin.
 */
export const PRESET_SURFACES: readonly Surface[] = [
  {
    id: 'banner-320x50',
    label: 'Mobile Banner 320x50',
    width: 320,
    height: 50,
    dpr: 2,
    interactionHint: 'tap',
  },
  {
    id: 'leaderboard-728x90',
    label: 'Leaderboard 728x90',
    width: 728,
    height: 90,
    dpr: 1,
    interactionHint: 'click',
  },
  {
    id: 'mpu-300x250',
    label: 'MPU 300x250',
    width: 300,
    height: 250,
    dpr: 2,
    interactionHint: 'tap',
  },
  {
    id: 'skyscraper-160x600',
    label: 'Skyscraper 160x600',
    width: 160,
    height: 600,
    dpr: 2,
    interactionHint: 'tap',
  },
  {
    id: 'square-1080',
    label: 'Social Square 1:1',
    width: 1080,
    height: 1080,
    dpr: 2,
    interactionHint: 'tap',
  },
  {
    id: 'story-1080x1920',
    label: 'Story 9:16',
    width: 1080,
    height: 1920,
    dpr: 3,
    safeArea: { top: 132, right: 24, bottom: 180, left: 24 },
    interactionHint: 'tap',
  },
  {
    id: 'tv-1920x1080',
    label: 'TV 16:9',
    width: 1920,
    height: 1080,
    dpr: 1,
    safeArea: { top: 54, right: 96, bottom: 54, left: 96 },
    interactionHint: 'remote',
  },
];

export function presetSurface(id: string): Surface {
  const found = PRESET_SURFACES.find((s) => s.id === id);
  if (found === undefined) throw new Error(`unknown preset surface "${id}"`);
  return found;
}

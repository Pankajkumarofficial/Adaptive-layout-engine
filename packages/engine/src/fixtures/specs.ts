import type { AdSpec } from '../types.js';

/**
 * Inlined so the demo renders with no network at all. Real specs point at
 * uploaded assets; this one has to work in a golden test and on a plane.
 */
const LOGO_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160">' +
      '<rect width="480" height="160" rx="16" fill="#f97316"/>' +
      '<path d="M56 112 L96 48 L136 112 Z" fill="#1c1917"/>' +
      '<text x="168" y="104" font-family="Inter,system-ui,sans-serif" font-size="56" ' +
      'font-weight="700" fill="#1c1917">TRAILHEAD</text>' +
      '</svg>',
  );

/**
 * The showcase spec: five elements with a clean priority gradient, so the
 * degradation ladder is visible as the surface shrinks.
 */
export const DEMO_SPEC: AdSpec = {
  id: 'demo-trailhead',
  name: 'Trailhead — Spring Launch',
  elements: [
    {
      id: 'bg',
      role: 'background',
      priority: 0,
      content: { kind: 'shape', fill: '#0f172a' },
    },
    {
      id: 'hero',
      role: 'hero',
      priority: 40,
      content: {
        kind: 'image',
        url: 'https://picsum.photos/id/1015/2400/1600',
        focalPoint: { x: 0.62, y: 0.38 },
        intrinsic: { w: 2400, h: 1600 },
      },
      minSize: { w: 80, h: 60 },
    },
    {
      id: 'logo',
      role: 'logo',
      priority: 10,
      content: {
        kind: 'image',
        url: LOGO_DATA_URI,
        intrinsic: { w: 480, h: 160 },
      },
      aspectLock: 3,
      minSize: { w: 48, h: 16 },
      pinTo: 'top',
    },
    {
      id: 'badge',
      role: 'badge',
      priority: 70,
      content: { kind: 'text', value: 'New season', maxLines: 1, minFontPx: 10 },
      minSize: { w: 56, h: 18 },
      pinTo: 'right',
    },
    {
      id: 'headline',
      role: 'headline',
      priority: 0,
      content: {
        kind: 'text',
        value: 'Every trail starts somewhere',
        maxLines: 3,
        minFontPx: 14,
      },
    },
    {
      id: 'subhead',
      role: 'subhead',
      priority: 60,
      content: {
        kind: 'text',
        value: 'Boots, packs and layers built for the long way round.',
        maxLines: 2,
        minFontPx: 12,
      },
    },
    {
      id: 'cta',
      role: 'cta',
      priority: 5,
      content: { kind: 'text', value: 'Shop the range', maxLines: 1, minFontPx: 12 },
      minSize: { w: 96, h: 32 },
    },
    {
      id: 'legal',
      role: 'legal',
      priority: 90,
      content: {
        kind: 'text',
        value: 'Free returns within 30 days. Terms apply.',
        maxLines: 2,
        minFontPx: 8,
      },
    },
  ],
  theme: {
    palette: {
      bg: '#0f172a',
      fg: '#f8fafc',
      accent: '#f97316',
      ctaBg: '#f97316',
      ctaFg: '#1c1917',
    },
    fontFamily: 'Inter, system-ui, sans-serif',
    scaleRatio: 1.25,
    cornerRadius: 8,
  },
  rules: {
    neverDrop: ['headline', 'cta'],
    // The badge makes a claim and the legal line qualifies it. Shipping either
    // one alone would be a compliance problem, so they live and die together.
    alwaysPairs: [['badge', 'legal']],
    minContrastRatio: 4.5,
  },
};

/** Minimal spec used by unit tests that only care about one mechanism. */
export const MINIMAL_SPEC: AdSpec = {
  id: 'minimal',
  name: 'Minimal',
  elements: [
    {
      id: 'headline',
      role: 'headline',
      priority: 0,
      content: { kind: 'text', value: 'Hello world', maxLines: 2, minFontPx: 12 },
    },
    {
      id: 'cta',
      role: 'cta',
      priority: 20,
      content: { kind: 'text', value: 'Go', maxLines: 1, minFontPx: 12 },
    },
  ],
  theme: {
    palette: {
      bg: '#ffffff',
      fg: '#111111',
      accent: '#2563eb',
      ctaBg: '#2563eb',
      ctaFg: '#ffffff',
    },
    fontFamily: 'Inter, sans-serif',
    scaleRatio: 1.25,
    cornerRadius: 4,
  },
};

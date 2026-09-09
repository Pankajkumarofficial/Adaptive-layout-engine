import type { AdSpec } from '../types.js';

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
        url: 'https://images.example.com/trailhead-hero.jpg',
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
        url: 'https://images.example.com/trailhead-logo.svg',
        intrinsic: { w: 480, h: 160 },
      },
      aspectLock: 3,
      minSize: { w: 48, h: 16 },
      pinTo: 'top',
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
    alwaysPairs: [['logo', 'legal']],
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

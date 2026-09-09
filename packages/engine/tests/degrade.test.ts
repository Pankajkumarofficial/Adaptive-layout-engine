import { describe, expect, it } from 'vitest';
import { chooseDrop, pairClosure } from '../src/steps/degrade.js';
import { normalize } from '../src/steps/normalize.js';
import { Tracer } from '../src/trace.js';
import { presetSurface } from '../src/fixtures/index.js';
import type { AdSpec } from '../src/types.js';

const theme: AdSpec['theme'] = {
  palette: { bg: '#ffffff', fg: '#000000', accent: '#ff0000', ctaBg: '#000000', ctaFg: '#ffffff' },
  fontFamily: 'Inter, sans-serif',
  scaleRatio: 1.25,
  cornerRadius: 0,
};

function elementsFrom(priorities: Record<string, number>, rules?: AdSpec['rules']) {
  const spec: AdSpec = {
    id: 'x',
    name: 'x',
    theme,
    rules,
    elements: Object.entries(priorities).map(([id, priority]) => ({
      id,
      role: 'body' as const,
      priority,
      content: { kind: 'text' as const, value: id },
    })),
  };
  return normalize(spec, presetSurface('square-1080'), new Tracer());
}

describe('chooseDrop', () => {
  it('drops the highest priority number first', () => {
    const norm = elementsFrom({ a: 10, b: 90, c: 50 });
    expect(chooseDrop(norm.elements, [], norm.neverDrop, [], new Tracer())?.ids).toEqual(['b']);
  });

  it('skips protected elements', () => {
    const norm = elementsFrom({ a: 10, b: 90, c: 50 }, { neverDrop: ['b'] });
    expect(chooseDrop(norm.elements, [], norm.neverDrop, [], new Tracer())?.ids).toEqual(['c']);
  });

  it('treats priority 0 as implicitly protected', () => {
    const norm = elementsFrom({ a: 0, b: 0 });
    expect(chooseDrop(norm.elements, [], norm.neverDrop, [], new Tracer())).toBeNull();
  });

  it('drops a bound pair together', () => {
    const norm = elementsFrom({ a: 10, b: 90, c: 50 }, { alwaysPairs: [['b', 'c']] });
    expect(
      chooseDrop(norm.elements, [], norm.neverDrop, norm.alwaysPairs, new Tracer())?.ids,
    ).toEqual(['b', 'c']);
  });

  it('explains each half of a bound pair from its own point of view', () => {
    const norm = elementsFrom({ a: 10, b: 90, c: 50 }, { alwaysPairs: [['b', 'c']] });
    const plan = chooseDrop(norm.elements, [], norm.neverDrop, norm.alwaysPairs, new Tracer());
    expect(plan?.reasons.b).toContain('bound to c');
    expect(plan?.reasons.c).toContain('bound to b');
    expect(plan?.reasons.c).toContain('priority 50');
  });

  it('refuses to drop a pair whose partner is protected', () => {
    const norm = elementsFrom(
      { a: 10, b: 90, c: 50 },
      { neverDrop: ['c'], alwaysPairs: [['b', 'c']] },
    );
    expect(
      chooseDrop(norm.elements, [], norm.neverDrop, norm.alwaysPairs, new Tracer())?.ids,
    ).toEqual(['a']);
  });

  it('returns null when everything left is protected', () => {
    const norm = elementsFrom({ a: 10 }, { neverDrop: ['a'] });
    expect(chooseDrop(norm.elements, [], norm.neverDrop, [], new Tracer())).toBeNull();
  });

  it('explains itself in the reason string', () => {
    const norm = elementsFrom({ a: 10, b: 90 });
    const plan = chooseDrop(norm.elements, [], norm.neverDrop, [], new Tracer());
    expect(plan?.reasons.b).toMatch(/priority 90/);
  });
});

describe('pairClosure', () => {
  it('returns the element alone when unbound', () => {
    expect(pairClosure('a', [])).toEqual(['a']);
  });

  it('follows chains transitively', () => {
    expect(
      pairClosure('a', [
        ['a', 'b'],
        ['b', 'c'],
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('is order-independent', () => {
    expect(
      pairClosure('c', [
        ['a', 'b'],
        ['b', 'c'],
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('terminates on a cycle', () => {
    expect(
      pairClosure('a', [
        ['a', 'b'],
        ['b', 'a'],
      ]),
    ).toEqual(['a', 'b']);
  });
});

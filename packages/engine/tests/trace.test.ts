import { describe, expect, it } from 'vitest';
import { formatTrace, Tracer } from '../src/trace.js';

describe('Tracer', () => {
  it('numbers entries from 1', () => {
    const t = new Tracer();
    t.info('normalize', 'first');
    t.decision('classify', 'second');
    expect(t.snapshot().map((e) => e.seq)).toEqual([1, 2]);
  });

  it('stamps the current pass onto later entries', () => {
    const t = new Tracer();
    t.info('budget', 'pass zero');
    t.setPass(2);
    t.info('budget', 'pass two');
    expect(t.snapshot().map((e) => e.pass)).toEqual([0, 2]);
  });

  it('collects warnings in order without duplicates', () => {
    const t = new Tracer();
    t.warn('fitText', 'too small');
    t.info('fitText', 'fine');
    t.warn('contrast', 'too dim');
    t.warn('fitText', 'too small');
    expect(t.warnings()).toEqual(['too small', 'too dim']);
  });

  it('returns copies so callers cannot mutate the log', () => {
    const t = new Tracer();
    t.info('normalize', 'hello');
    const snapshot = t.snapshot();
    const first = snapshot[0];
    if (first !== undefined) first.message = 'tampered';
    expect(t.snapshot()[0]?.message).toBe('hello');
  });

  it('omits absent optional fields rather than writing undefined', () => {
    const t = new Tracer();
    t.info('normalize', 'plain');
    expect(Object.keys(t.snapshot()[0] ?? {})).toEqual(['seq', 'step', 'level', 'pass', 'message']);
  });

  it('formats a readable line per entry', () => {
    const t = new Tracer();
    t.decision('classify', 'chose stack', { subject: 'sq', data: { aspect: 1 } });
    expect(formatTrace(t.snapshot())).toBe(' 1 > p0 classify [sq]: chose stack aspect=1');
  });
});

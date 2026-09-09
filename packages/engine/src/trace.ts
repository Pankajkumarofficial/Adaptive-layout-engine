import type { TraceEntry, TraceLevel, TraceStep, TraceValue } from './types.js';

export interface TracePayload {
  subject?: string;
  data?: Record<string, TraceValue>;
}

/**
 * Ordered decision log for one solve().
 *
 * Deliberately has no clock and no randomness: two runs of the same input
 * produce byte-identical traces, which is what lets the golden tests diff them.
 */
export class Tracer {
  private readonly entries: TraceEntry[] = [];
  private seq = 0;
  private currentPass = 0;

  /** Degradation pass index applied to every subsequent entry. */
  setPass(pass: number): void {
    this.currentPass = pass;
  }

  get pass(): number {
    return this.currentPass;
  }

  info(step: TraceStep, message: string, payload: TracePayload = {}): void {
    this.push('info', step, message, payload);
  }

  decision(step: TraceStep, message: string, payload: TracePayload = {}): void {
    this.push('decision', step, message, payload);
  }

  warn(step: TraceStep, message: string, payload: TracePayload = {}): void {
    this.push('warn', step, message, payload);
  }

  /** Warnings surfaced to `LayoutResult.warnings`, in trace order, de-duplicated. */
  warnings(): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of this.entries) {
      if (e.level === 'warn' && !seen.has(e.message)) {
        seen.add(e.message);
        out.push(e.message);
      }
    }
    return out;
  }

  snapshot(): TraceEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }

  private push(level: TraceLevel, step: TraceStep, message: string, payload: TracePayload): void {
    this.seq += 1;
    const entry: TraceEntry = {
      seq: this.seq,
      step,
      level,
      pass: this.currentPass,
      message,
    };
    if (payload.subject !== undefined) entry.subject = payload.subject;
    if (payload.data !== undefined) entry.data = payload.data;
    this.entries.push(entry);
  }
}

/** Renders a trace as the numbered list shown in the inspector rail / CLI. */
export function formatTrace(trace: readonly TraceEntry[]): string {
  return trace
    .map((e) => {
      const mark = e.level === 'decision' ? '>' : e.level === 'warn' ? '!' : ' ';
      const subject = e.subject ? ` [${e.subject}]` : '';
      const data = e.data
        ? ' ' +
          Object.entries(e.data)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
        : '';
      return `${String(e.seq).padStart(2, ' ')} ${mark} p${e.pass} ${e.step}${subject}: ${e.message}${data}`;
    })
    .join('\n');
}

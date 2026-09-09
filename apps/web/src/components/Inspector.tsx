import type { LayoutResult, TraceEntry } from '@ale/engine';

/**
 * The decision ledger. Entries are numbered because the trace genuinely is a
 * sequence, ruled off wherever a degradation pass begins, so you can see the
 * engine give up on something and start again.
 */
export function Inspector({ result, ms }: { result: LayoutResult; ms: number }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-rule px-4 py-3">
        <Stat label="Archetype" value={result.archetype} accent />
        <Stat label="Solved in" value={`${ms.toFixed(2)} ms`} />
        <Stat
          label="Shape"
          value={`${result.surfaceClass.aspectBucket} / ${result.surfaceClass.densityClass}`}
        />
        <Stat label="Fingerprint" value={result.fingerprint} mono />
      </dl>

      {result.warnings.length > 0 && (
        <ul className="border-b border-rule px-4 py-3">
          {result.warnings.map((warning) => (
            <li
              key={warning}
              className="mb-1 flex gap-2 text-tiny leading-snug text-mark last:mb-0"
            >
              <span aria-hidden className="mt-[7px] h-px w-2 shrink-0 bg-mark" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      <ol className="min-h-0 flex-1 overflow-auto">
        {result.trace.map((entry, i) => (
          <TraceRow
            key={entry.seq}
            entry={entry}
            startsPass={i > 0 && entry.pass !== result.trace[i - 1]?.pass}
          />
        ))}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-micro text-ink-3">{label}</dt>
      <dd
        className={`${mono ? 'font-mono text-tiny' : 'text-sm font-semibold'} tabular ${
          accent ? 'text-guide' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function TraceRow({ entry, startsPass }: { entry: TraceEntry; startsPass: boolean }) {
  const tone =
    entry.level === 'warn' ? 'text-mark' : entry.level === 'decision' ? 'text-ink' : 'text-ink-2';

  return (
    <>
      {startsPass && (
        <li className="flex items-center gap-2 px-4 pb-1 pt-3" aria-hidden>
          <span className="h-px flex-1 bg-rule" />
          <span className="tabular text-micro text-ink-3">pass {entry.pass}</span>
          <span className="h-px flex-1 bg-rule" />
        </li>
      )}
      <li className="flex gap-3 px-4 py-1">
        <span className="w-5 shrink-0 pt-px text-right tabular text-micro tabular text-ink-3">
          {entry.seq}
        </span>
        <span
          className={`w-24 shrink-0 truncate pt-px tabular text-micro ${
            entry.level === 'decision' ? 'text-guide' : 'text-ink-3'
          }`}
          title={entry.step}
        >
          {entry.step}
        </span>
        <span className={`flex-1 text-tiny leading-snug ${tone}`}>
          {entry.message}
          {entry.data !== undefined && (
            <span className="ml-1 tabular text-micro text-ink-3">
              {Object.entries(entry.data)
                .map(([k, v]) => `${k}=${v}`)
                .join('  ')}
            </span>
          )}
        </span>
      </li>
    </>
  );
}

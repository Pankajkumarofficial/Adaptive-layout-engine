import { useEffect, useMemo, useState } from 'react';
import { solve } from '@ale/engine';
import type { AdSpec } from '@ale/engine';
import { PRESETS } from '../lib/presets';
import { api } from '../lib/api';

/**
 * Which elements the engine sacrifices, and where.
 *
 * The obvious form for "how often is each element dropped" is a bar chart of
 * counts — but the count is the least interesting half of the answer. A bar
 * says the legal line dies four times; the matrix says it dies on exactly the
 * four surfaces with no vertical room, which is a fact you can act on. So the
 * mark is a presence grid with the count as a row label, and it is built as a
 * real table: the accessible view and the visual are the same object.
 *
 * Everything here is computed in the browser from the current spec, so it works
 * with no account and updates as you type. When the API is reachable it adds
 * the lifetime figures from RenderLog underneath.
 */

/** Column codes. The full label rides along in `title` and the row caption. */
const SHORT: Readonly<Record<string, string>> = {
  'banner-320x50': '320',
  'leaderboard-728x90': '728',
  'mpu-300x250': 'MPU',
  'skyscraper-160x600': '160',
  'square-1080': '1:1',
  'story-1080x1920': '9:16',
  'tv-1920x1080': 'TV',
};

interface Row {
  id: string;
  priority: number;
  droppedOn: Set<string>;
  protectedElement: boolean;
}

export function DropRates({ spec }: { spec: AdSpec }) {
  const { rows, clean } = useMemo(() => {
    const dropped = new Map<string, Set<string>>();
    let cleanSurfaces = 0;

    for (const surface of PRESETS) {
      try {
        const result = solve(spec, surface);
        if (result.dropped.length === 0) cleanSurfaces += 1;
        for (const d of result.dropped) {
          const set = dropped.get(d.id) ?? new Set<string>();
          set.add(surface.id);
          dropped.set(d.id, set);
        }
      } catch {
        // An invalid spec is reported by the canvas; this panel just shows less.
      }
    }

    const neverDrop = new Set(spec.rules?.neverDrop ?? []);
    const out: Row[] = spec.elements.map((el) => ({
      id: el.id,
      priority: el.priority,
      droppedOn: dropped.get(el.id) ?? new Set<string>(),
      protectedElement: neverDrop.has(el.id) || el.priority === 0,
    }));

    out.sort(
      (a, b) =>
        b.droppedOn.size - a.droppedOn.size || b.priority - a.priority || a.id.localeCompare(b.id),
    );
    return { rows: out, clean: cleanSurfaces };
  }, [spec]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <p className="border-b border-rule px-4 py-3 text-tiny leading-snug text-ink-2">
        <span className="text-sm font-semibold text-ink">
          {clean} of {PRESETS.length}
        </span>{' '}
        preset surfaces hold this spec whole. Below, a filled cell is an element the engine had to
        give up on that surface.
      </p>

      <table className="w-full border-collapse px-4 text-tiny">
        <caption className="px-4 pb-2 pt-3 text-left text-micro text-ink-3">
          Elements by how often they are dropped, most first
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-4 pb-1 text-left font-medium text-ink-3">
              Element
            </th>
            {PRESETS.map((s) => (
              <th
                key={s.id}
                scope="col"
                title={s.label}
                className="w-8 pb-1 text-center text-micro font-normal text-ink-3"
              >
                {SHORT[s.id] ?? s.id.slice(0, 3)}
              </th>
            ))}
            <th scope="col" className="px-3 pb-1 text-right font-medium text-ink-3">
              Lost
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-rule/60">
              <th scope="row" className="max-w-[92px] truncate px-4 py-1 text-left font-medium">
                {row.id}
                {row.protectedElement && (
                  <span className="ml-1 font-normal text-ink-3" title="Never dropped">
                    held
                  </span>
                )}
              </th>
              {PRESETS.map((s) => {
                const lost = row.droppedOn.has(s.id);
                return (
                  <td key={s.id} className="w-8 p-[2px] text-center align-middle">
                    <span
                      className={`block h-3.5 w-full rounded-[1px] ${lost ? 'bg-reg' : 'bg-rule/45'}`}
                      title={`${row.id} — ${lost ? 'dropped on' : 'kept on'} ${s.label}`}
                    />
                    <span className="sr-only">{lost ? 'dropped' : 'kept'}</span>
                  </td>
                );
              })}
              <td className="px-3 py-1 text-right tabular">
                {row.droppedOn.size === 0 ? (
                  <span className="text-ink-3">&mdash;</span>
                ) : (
                  <span className="font-semibold">{row.droppedOn.size}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="flex items-center gap-3 px-4 py-3 text-micro text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="block h-3 w-4 rounded-[1px] bg-reg" aria-hidden /> dropped
        </span>
        <span className="flex items-center gap-1.5">
          <span className="block h-3 w-4 rounded-[1px] bg-rule/45" aria-hidden /> kept
        </span>
      </p>

      <LifetimeDrops />
    </div>
  );
}

interface Lifetime {
  byElement: { elementId: string; drops: number }[];
  timing: { renders: number; avgSolveMs: number; maxSolveMs: number };
}

/**
 * The same question asked of every render the API has ever served, rather than
 * of the spec currently open. Absent without the API, which is fine — this
 * panel's primary answer does not depend on a server.
 */
function LifetimeDrops() {
  const [data, setData] = useState<Lifetime | null>(null);

  useEffect(() => {
    let live = true;
    void api
      .analytics()
      .then((d) => {
        if (live) setData(d as Lifetime);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (data === null || data.timing.renders === 0) return null;

  const max = Math.max(1, ...data.byElement.map((d) => d.drops));
  return (
    <section className="border-t border-rule px-4 py-3">
      <h3 className="mb-1 text-micro text-ink-3">
        Across {data.timing.renders} server renders &mdash; average{' '}
        {data.timing.avgSolveMs.toFixed(2)} ms
      </h3>
      <ul>
        {data.byElement.slice(0, 8).map((d) => (
          <li key={d.elementId} className="flex items-center gap-2 py-0.5">
            <span className="w-[92px] shrink-0 truncate text-tiny">{d.elementId}</span>
            <span className="h-2 flex-1 bg-rule/40">
              <span
                className="block h-full rounded-r-[2px] bg-reg"
                style={{ width: `${(d.drops / max) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-micro tabular">{d.drops}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { solve } from '@ale/engine';
import type { AdSpec } from '@ale/engine';
import { AdRenderer } from '../renderer/AdRenderer';
import { PRESETS, fitScale } from '../lib/presets';

const TILE_W = 190;
const TILE_H = 150;

/**
 * Every preset at once. The whole claim of the project is that one spec
 * survives all of these, so the proof should be one glance rather than a
 * sequence of clicks.
 */
export function MatrixView({ spec }: { spec: AdSpec }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(true);

  const solved = useMemo(
    () =>
      PRESETS.map((surface) => {
        try {
          return { surface, result: solve(spec, surface) };
        } catch {
          return { surface, result: null };
        }
      }),
    [spec],
  );

  const exportPng = async () => {
    const node = stripRef.current;
    if (node === null) return;
    setExporting(true);
    try {
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: '#c8cbc1', cacheBust: true });
      const link = document.createElement('a');
      link.download = `${spec.id}-matrix.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('[playground] matrix export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="border-t border-rule bg-paper">
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-display text-[17px] font-medium leading-none text-ink hover:text-guide"
        >
          <span aria-hidden className="mr-1.5 inline-block text-ink-3">
            {open ? '\u2212' : '+'}
          </span>
          Every surface, one spec
        </button>
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="ml-auto rounded-bench border border-rule px-2 py-1 text-tiny text-ink-2 hover:border-guide hover:text-ink disabled:opacity-50"
        >
          {exporting ? 'Rendering…' : 'Export PNG'}
        </button>
      </div>

      <div ref={stripRef} className={`gap-4 overflow-x-auto px-4 pb-4 ${open ? 'flex' : 'hidden'}`}>
        {solved.map(({ surface, result }) => {
          const scale = fitScale(surface, TILE_W, TILE_H);
          return (
            <figure key={surface.id} className="shrink-0" style={{ width: TILE_W }}>
              <div
                className="flex items-center justify-center rounded-bench bg-proof"
                style={{ height: TILE_H }}
              >
                {result !== null && (
                  <div style={{ width: surface.width * scale, height: surface.height * scale }}>
                    <AdRenderer spec={spec} surface={surface} result={result} scale={scale} />
                  </div>
                )}
              </div>
              <figcaption className="mt-1.5 flex items-baseline gap-1.5 border-t border-rule pt-1">
                <span className="truncate text-tiny text-ink-2">{surface.label}</span>
                <span className="ml-auto shrink-0 tabular text-micro text-guide">
                  {result?.archetype ?? 'error'}
                </span>
              </figcaption>
              {result !== null && result.dropped.length > 0 && (
                <p className="tabular text-micro text-reg">
                  &minus;{result.dropped.map((d) => d.id).join(' ')}
                </p>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

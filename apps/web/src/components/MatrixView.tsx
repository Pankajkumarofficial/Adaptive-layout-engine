import { useMemo, useRef, useState } from 'react';
import { getFontEmbedCSS, toPng } from 'html-to-image';
import { solve } from '@ale/engine';
import type { AdSpec, LayoutResult, Surface } from '@ale/engine';
import { AdRenderer } from '../renderer/AdRenderer';
import { PRESETS, fitScale } from '../lib/presets';
import { tokenColor } from '../lib/theme';
import { composeContactSheet, loadImage, type SheetTile } from '../lib/contactSheet';

const TILE_W = 190;
const TILE_H = 150;

/**
 * Every preset at once. The whole claim of the project is that one spec
 * survives all of these, so the proof should be one glance rather than a
 * sequence of clicks.
 */
export function MatrixView({ spec }: { spec: AdSpec }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  /**
   * Renders every surface at its true pixel size and composes the results.
   *
   * The strip on screen is a scrollable row of 190px previews, so capturing it
   * produced a picture of the editor: clipped at the viewport, three surfaces
   * missing, the ads shown as thumbnails and the drop lists baked in as if they
   * were artwork. Each ad is drawn off-screen at 1:1 instead, and the sheet is
   * composed on a canvas.
   */
  const exportPng = async () => {
    const stage = stageRef.current;
    if (stage === null) return;
    setExporting(true);
    setError(null);
    try {
      // Type has to be ready before anything is captured, or the first export
      // of a session comes out in the fallback face.
      if (document.fonts !== undefined) await document.fonts.ready;
      await nextFrame();

      // Every toPng call otherwise re-reads the webfont stylesheet, and a
      // cross-origin sheet cannot be read from cssRules, so it falls back to
      // fetching the CSS and every font file it names — once per surface.
      // Seven of those is the difference between an export and a hang.
      const fontEmbedCSS = await getFontEmbedCSS(stage).catch(() => '');

      const tiles: SheetTile[] = [];
      for (const { surface, result } of solved) {
        if (result === null) continue;
        const node = stage.querySelector<HTMLElement>(`[data-export-id="${surface.id}"]`);
        if (node === null) continue;
        const url = await withTimeout(
          toPng(node, {
            pixelRatio: 1,
            width: surface.width,
            height: surface.height,
            fontEmbedCSS,
          }),
          `${surface.label} took too long to render.`,
        );
        tiles.push({
          label: surface.label,
          archetype: result.archetype,
          dropped: result.dropped.map((d) => d.id),
          image: await loadImage(url),
          width: surface.width,
          height: surface.height,
        });
      }

      if (tiles.length === 0) {
        setError('Nothing solved, so there was nothing to export.');
        return;
      }

      // Resolved at export time so the sheet matches the theme on screen.
      const canvas = composeContactSheet(
        spec.name,
        `One spec, ${tiles.length} surfaces, no per-surface authoring`,
        tiles,
        {
          board: tokenColor('--c-board', '#c8cbc1'),
          proof: tokenColor('--c-proof', '#9aa09a'),
          ink: tokenColor('--c-ink', '#1a1a17'),
          ink2: tokenColor('--c-ink-2', '#4a4a44'),
          ink3: tokenColor('--c-ink-3', '#6f6f68'),
          rule: tokenColor('--c-rule', '#b4b7ad'),
          guide: tokenColor('--c-guide', '#2f6fd0'),
          reg: tokenColor('--c-reg', '#c8402f'),
        },
      );

      const link = document.createElement('a');
      link.download = `${spec.id}-every-surface.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[playground] matrix export failed', err);
      setError(err instanceof Error ? err.message : 'The export did not finish.');
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

      <div className={`gap-4 overflow-x-auto px-4 pb-4 ${open ? 'flex' : 'hidden'}`}>
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

      {error !== null && (
        <p role="alert" className="px-4 pb-3 text-tiny text-reg">
          {error}
        </p>
      )}

      {/* The export stage: every surface at 1:1, off-screen. Kept in the tree
          rather than mounted on demand so a click exports what is on screen
          now, with its images already decoded. `left` rather than `display`,
          because a hidden subtree has no layout to capture. */}
      <div
        ref={stageRef}
        aria-hidden
        className="pointer-events-none fixed top-0 opacity-0"
        style={{ left: -20000, width: 1, height: 1, overflow: 'visible' }}
      >
        {solved.map(({ surface, result }) =>
          result === null ? null : (
            <ExportStage key={surface.id} spec={spec} surface={surface} result={result} />
          ),
        )}
      </div>
    </section>
  );
}

function ExportStage({
  spec,
  surface,
  result,
}: {
  spec: AdSpec;
  surface: Surface;
  result: LayoutResult;
}) {
  return (
    <div
      data-export-id={surface.id}
      style={{
        width: surface.width,
        height: surface.height,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    >
      <AdRenderer spec={spec} surface={surface} result={result} scale={1} />
    </div>
  );
}

/**
 * An export that never finishes leaves the button saying "Rendering…" forever,
 * which is worse than a failure: there is nothing to retry and nothing to read.
 */
const EXPORT_TIMEOUT_MS = 20_000;

function withTimeout<T>(work: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), EXPORT_TIMEOUT_MS)),
  ]);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

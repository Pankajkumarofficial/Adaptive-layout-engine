import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LayoutResult } from '@ale/engine';
import { AdRenderer } from '../renderer/AdRenderer';
import { CanvasEditor } from './CanvasEditor';
import { DebugOverlay } from '../renderer/DebugOverlay';
import { usePlayground } from '../lib/store';
import { CUSTOM_SURFACE_ID, fitScale, PRESETS } from '../lib/presets';

/**
 * The proofing bench. The artwork sits at its real pixel size, scaled to fit,
 * with drafting callouts along two edges so the surface is measured rather than
 * merely displayed. The corner mark is the resize grip.
 */
export function SurfaceCanvas({ result }: { result: LayoutResult | null }) {
  const surface = usePlayground((s) => s.surface);
  const spec = usePlayground((s) => s.spec);
  const showDebug = usePlayground((s) => s.showDebug);
  const selectPreset = usePlayground((s) => s.selectPreset);
  const setSurfaceSize = usePlayground((s) => s.setSurfaceSize);
  const toggleDebug = usePlayground((s) => s.toggleDebug);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 800, h: 520 });
  const [editOnCanvas, setEditOnCanvas] = useState(true);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (node === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scale = fitScale(surface, stage.w - 80, stage.h - 80);
  const drag = useResizeGrip(surface.width, surface.height, scale, setSurfaceSize);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-rule px-4 py-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => selectPreset(preset.id)}
            className={`rounded-bench px-2 py-1 text-tiny transition-colors ${
              surface.id === preset.id
                ? 'bg-guide text-on-accent'
                : 'text-ink-2 hover:bg-card hover:text-ink'
            }`}
          >
            {preset.label.replace(/\s*\d+x\d+$/, '')}
            <span
              className={`ml-1 tabular ${
                surface.id === preset.id ? 'text-on-accent/75' : 'text-ink-3'
              }`}
            >
              {preset.width}&times;{preset.height}
            </span>
          </button>
        ))}
        <span
          className={`rounded-bench px-2 py-1 text-tiny ${
            surface.id === CUSTOM_SURFACE_ID ? 'bg-guide text-on-accent' : 'text-ink-3'
          }`}
        >
          Custom
          {surface.id === CUSTOM_SURFACE_ID && (
            <span className="ml-1 tabular">
              {surface.width}&times;{surface.height}
            </span>
          )}
        </span>

        <span className="ml-auto flex items-center gap-1 text-tiny text-ink-3">
          <SizeInput
            label="width"
            value={surface.width}
            onChange={(w) => setSurfaceSize(w, surface.height)}
          />
          <span aria-hidden>&times;</span>
          <SizeInput
            label="height"
            value={surface.height}
            onChange={(h) => setSurfaceSize(surface.width, h)}
          />
        </span>

        <button
          type="button"
          onClick={toggleDebug}
          aria-pressed={showDebug}
          className={`rounded-bench border px-2 py-1 text-tiny transition-colors ${
            showDebug
              ? 'border-guide text-guide'
              : 'border-rule text-ink-2 hover:border-guide hover:text-ink'
          }`}
        >
          Regions
        </button>

        {/* Direct manipulation edits the spec, not this surface's output, so it
            is the same kind of control as Regions: a way of looking at the
            engine rather than a way around it. */}
        <button
          type="button"
          onClick={() => setEditOnCanvas((on) => !on)}
          aria-pressed={editOnCanvas}
          title="Drag elements here to set pinTo, focalPoint and maxSize on the spec"
          className={`rounded-bench border px-2 py-1 text-tiny transition-colors ${
            editOnCanvas
              ? 'border-guide text-guide'
              : 'border-rule text-ink-2 hover:border-guide hover:text-ink'
          }`}
        >
          Drag to edit
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 select-none items-center justify-center bg-proof p-9"
      >
        {result !== null && (
          <div
            className="relative"
            style={{ width: surface.width * scale, height: surface.height * scale }}
          >
            <div className="absolute inset-0 shadow-paste">
              <AdRenderer spec={spec} surface={surface} result={result} scale={scale} />
            </div>
            {showDebug && <DebugOverlay spec={spec} result={result} scale={scale} />}
            {editOnCanvas && <CanvasEditor spec={spec} result={result} scale={scale} />}

            <WidthCallout width={surface.width} scale={scale} />
            <HeightCallout height={surface.height} scale={scale} />

            <button
              type="button"
              aria-label="Drag to resize the surface"
              onPointerDown={drag}
              className="group absolute -bottom-3.5 -right-3.5 z-20 h-9 w-9 cursor-nwse-resize touch-none select-none"
            >
              <span className="absolute bottom-3 right-3 block h-5 w-[2px] bg-guide transition-all group-hover:h-7 group-hover:bg-ink" />
              <span className="absolute bottom-3 right-3 block h-[2px] w-5 bg-guide transition-all group-hover:w-7 group-hover:bg-ink" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SizeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      aria-label={`Surface ${label} in pixels`}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n > 0) onChange(n);
      }}
      className="w-16 rounded-bench border border-rule bg-card px-1.5 py-1 text-right tabular text-tiny tabular text-ink focus:border-guide focus:outline-none"
    />
  );
}

/** Dimension line below the artwork, drafting-style. */
function WidthCallout({ width, scale }: { width: number; scale: number }) {
  return (
    <div className="absolute -bottom-7 left-0 flex w-full items-center gap-2">
      <span className="h-2.5 w-px bg-guide" />
      <span className="h-px flex-1 bg-guide" />
      <span className="tabular text-micro text-ink">{width}</span>
      <span className="h-px flex-1 bg-guide" />
      <span className="h-2.5 w-px bg-guide" />
      <span className="sr-only">pixels wide, shown at {Math.round(scale * 100)} percent</span>
    </div>
  );
}

function HeightCallout({ height, scale }: { height: number; scale: number }) {
  return (
    <div className="absolute -left-8 top-0 flex h-full flex-col items-center gap-2">
      <span className="h-px w-2.5 bg-guide" />
      <span className="w-px flex-1 bg-guide" />
      <span className="tabular text-micro text-ink [writing-mode:vertical-rl]">{height}</span>
      <span className="w-px flex-1 bg-guide" />
      <span className="h-px w-2.5 bg-guide" />
      <span className="sr-only">pixels tall, shown at {Math.round(scale * 100)} percent</span>
    </div>
  );
}

/**
 * Resize driven by pointer events and coalesced onto animation frames.
 *
 * A timeout would decouple the drag from the compositor and show up as lag on
 * the callouts; rAF keeps exactly one solve per painted frame, which is the
 * point of the engine being sub-millisecond.
 */
function useResizeGrip(
  width: number,
  height: number,
  scale: number,
  setSize: (w: number, h: number) => void,
) {
  const frame = useRef<number | null>(null);
  const pending = useRef<{ w: number; h: number } | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = width;
    const startH = height;

    const flush = () => {
      frame.current = null;
      const next = pending.current;
      if (next !== null) {
        pending.current = null;
        setSize(next.w, next.h);
      }
    };

    const move = (e: PointerEvent) => {
      pending.current = {
        w: startW + (e.clientX - startX) / scale,
        h: startH + (e.clientY - startY) / scale,
      };
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      flush();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };
}

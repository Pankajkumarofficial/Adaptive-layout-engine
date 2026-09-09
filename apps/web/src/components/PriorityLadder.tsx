import { useCallback, useRef } from 'react';
import type { AdElement, LayoutResult } from '@ale/engine';
import { usePlayground } from '../lib/store';

/**
 * The spec editor, built as the thing the spec actually is: a priority ladder.
 *
 * Every element sits at its priority along a 0-100 track, so the order in which
 * the engine will sacrifice them is the same thing you drag to change it. When
 * the current surface drops an element, its rung goes dark and its reason sits
 * underneath — the editor and the outcome are one view instead of two.
 */
export function PriorityLadder({ result }: { result: LayoutResult | null }) {
  const spec = usePlayground((s) => s.spec);
  const selectedId = usePlayground((s) => s.selectedElementId);
  const selectElement = usePlayground((s) => s.selectElement);
  const setPriority = usePlayground((s) => s.setPriority);

  const droppedById = new Map((result?.dropped ?? []).map((d) => [d.id, d.reason]));
  const neverDrop = new Set(spec.rules?.neverDrop ?? []);
  const ordered = [...spec.elements].sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col">
      <div className="border-b border-rule px-4 pb-2 pt-2">
        <p className="mb-1.5 text-tiny leading-snug text-ink-2">
          Drag a marker to change what the engine gives up first.
        </p>
        <div className="relative h-3">
          <span className="absolute top-0 h-full w-px bg-rule-2" />
          <span className="absolute right-0 top-0 h-full w-px bg-rule-2" />
          <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-rule" />
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-rule"
              style={{ left: `${t}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between pt-0.5 text-micro text-ink-3">
          <span>0 &middot; never drops</span>
          <span>drops first &middot; 100</span>
        </div>
      </div>

      <ul className="flex flex-col">
        {ordered.map((element) => (
          <Rung
            key={element.id}
            element={element}
            selected={selectedId === element.id}
            dropReason={droppedById.get(element.id)}
            locked={neverDrop.has(element.id) || element.priority === 0}
            onSelect={() => selectElement(selectedId === element.id ? null : element.id)}
            onPriority={(p) => setPriority(element.id, p)}
          />
        ))}
      </ul>
    </div>
  );
}

interface RungProps {
  element: AdElement;
  selected: boolean;
  dropReason: string | undefined;
  locked: boolean;
  onSelect: () => void;
  onPriority: (priority: number) => void;
}

function Rung({ element, selected, dropReason, locked, onSelect, onPriority }: RungProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dropped = dropReason !== undefined;

  const priorityFromEvent = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (track === null) return null;
    const box = track.getBoundingClientRect();
    return ((clientX - box.left) / box.width) * 100;
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = priorityFromEvent(event.clientX);
    if (next !== null) onPriority(next);
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = priorityFromEvent(event.clientX);
    if (next !== null) onPriority(next);
  };

  return (
    <li
      className={`border-l-2 px-4 py-2 transition-colors ${
        selected ? 'border-guide bg-card' : 'border-transparent hover:bg-paper'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-baseline gap-2 text-left"
        aria-expanded={selected}
      >
        <span
          className={`text-sm font-semibold tracking-[-0.005em] ${
            dropped ? 'text-ink-3 line-through decoration-reg decoration-2' : 'text-ink'
          }`}
        >
          {element.id}
        </span>
        <span className="text-tiny text-ink-3">{element.role}</span>
        <span className="ml-auto tabular text-tiny tabular text-ink-2">
          {locked ? 'held' : element.priority}
        </span>
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={`${element.id} priority`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={element.priority}
        aria-disabled={locked}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === 'ArrowLeft') onPriority(element.priority - (e.shiftKey ? 10 : 1));
          if (e.key === 'ArrowRight') onPriority(element.priority + (e.shiftKey ? 10 : 1));
        }}
        className={`relative mt-2 h-4 ${locked ? 'cursor-default' : 'cursor-ew-resize'} focus:outline-none focus-visible:ring-1 focus-visible:ring-guide`}
      >
        <span className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-rule-2" />
        <span className="absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-rule-2" />
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-rule" />
        <span
          className={`absolute top-1/2 h-[11px] w-[5px] -translate-x-1/2 -translate-y-1/2 border ${
            locked ? 'border-guide bg-guide' : dropped ? 'border-reg bg-reg' : 'border-ink bg-card'
          }`}
          style={{ left: `${element.priority}%` }}
        />
      </div>

      {dropped && (
        <p className="mt-1 border-l-2 border-reg pl-2 text-micro leading-snug text-reg">
          {dropReason}
        </p>
      )}
    </li>
  );
}

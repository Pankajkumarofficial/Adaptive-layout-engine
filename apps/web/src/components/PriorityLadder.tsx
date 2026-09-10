import { useCallback, useRef, useState } from 'react';
import type { AdElement, ElementRole, LayoutResult } from '@ale/engine';
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

      <AddElement existingIds={new Set(spec.elements.map((el) => el.id))} />
    </div>
  );
}

/**
 * Default priority per role: the order a person would sacrifice them in if
 * asked. Authoring a new element should land somewhere sensible on the ladder
 * rather than at zero, which would silently make it undroppable.
 */
const ROLE_PRIORITY: Readonly<Record<ElementRole, number>> = {
  background: 0,
  headline: 0,
  cta: 5,
  logo: 10,
  hero: 40,
  subhead: 60,
  body: 65,
  badge: 70,
  legal: 90,
};

const PLACEHOLDER: Readonly<Record<ElementRole, string>> = {
  headline: 'Your headline here',
  subhead: 'A supporting line for surfaces with room',
  body: 'Longer copy that only survives where there is space for it.',
  cta: 'Get started',
  legal: 'Terms apply.',
  badge: 'New',
  logo: '',
  hero: '',
  background: '',
};

/** Builds a valid element for a role, so nothing added here can fail the schema. */
function blankElement(role: ElementRole, id: string, fill: string): AdElement {
  if (role === 'background') {
    return { id, role, priority: ROLE_PRIORITY[role], content: { kind: 'shape', fill } };
  }
  if (role === 'hero' || role === 'logo') {
    return {
      id,
      role,
      priority: ROLE_PRIORITY[role],
      content: {
        kind: 'image',
        url: 'https://picsum.photos/id/1043/2000/1300',
        focalPoint: { x: 0.5, y: 0.5 },
        intrinsic: { w: 2000, h: 1300 },
      },
      ...(role === 'logo' ? { aspectLock: 3, minSize: { w: 48, h: 16 } } : {}),
    };
  }
  return {
    id,
    role,
    priority: ROLE_PRIORITY[role],
    content: {
      kind: 'text',
      value: PLACEHOLDER[role],
      maxLines: role === 'cta' ? 1 : 2,
      minFontPx: 12,
    },
    ...(role === 'cta' ? { minSize: { w: 96, h: 32 } } : {}),
  };
}

const ROLES: readonly ElementRole[] = [
  'headline',
  'subhead',
  'body',
  'cta',
  'hero',
  'logo',
  'badge',
  'legal',
  'background',
];

function AddElement({ existingIds }: { existingIds: Set<string> }) {
  const addElement = usePlayground((s) => s.addElement);
  const themeBg = usePlayground((s) => s.spec.theme.palette.bg);
  const [role, setRole] = useState<ElementRole>('subhead');

  const add = (): void => {
    let id: string = role;
    let n = 2;
    while (existingIds.has(id)) id = `${role}-${n++}`;
    addElement(blankElement(role, id, themeBg));
  };

  return (
    <div className="flex items-center gap-2 border-t border-rule px-4 py-2.5">
      <label className="sr-only" htmlFor="new-element-role">
        Role for the new element
      </label>
      <select
        id="new-element-role"
        value={role}
        onChange={(e) => setRole(e.target.value as ElementRole)}
        className="flex-1 border border-rule bg-card px-2 py-1 text-tiny text-ink focus:border-guide focus:outline-none"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        className="bg-ink px-2.5 py-1 text-tiny text-on-accent hover:opacity-90"
      >
        Add element
      </button>
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

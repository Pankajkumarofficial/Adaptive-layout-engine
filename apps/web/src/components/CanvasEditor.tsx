import { useRef, useState } from 'react';
import type { AdElement, AdSpec, LayoutResult, PinTo, PlacedElement } from '@ale/engine';
import { ROLE_DEFAULTS } from '@ale/engine';
import { usePlayground } from '../lib/store';
import {
  capFromHandle,
  focalFromDrag,
  nearestEdge,
  panAxes,
  PINNABLE,
  type PanAxes,
} from '../lib/gestures';

/**
 * Direct manipulation on the canvas — of the spec, never of the output.
 *
 * Dragging a region into place per surface is the thing this engine exists to
 * remove; it would make the canvas an authoring tool for one shape and leave
 * the other six unexplained. So every gesture here writes an authored-once
 * property instead, and the matrix below re-solves for all seven surfaces at
 * once. Dragging is how the argument gets made, not an escape from it.
 *
 *   drag the body of a pinnable element  -> pinTo
 *   drag the body of an image            -> focalPoint (pans the picture)
 *   drag the corner handle               -> maxSize
 *
 * This is an editor layer. It reads frames the engine decided and writes back
 * to the spec; it never computes a position for the renderer.
 */

type Gesture =
  | { kind: 'pin'; id: string; pin: PinTo }
  | { kind: 'focal'; id: string; startX: number; startY: number }
  | { kind: 'size'; id: string; w: number; h: number };

export interface CanvasEditorProps {
  spec: AdSpec;
  result: LayoutResult;
  scale: number;
}

export function CanvasEditor({ spec, result, scale }: CanvasEditorProps) {
  const selectedId = usePlayground((s) => s.selectedElementId);
  const selectElement = usePlayground((s) => s.selectElement);
  const updateElement = usePlayground((s) => s.updateElement);
  const [gesture, setGesture] = useState<Gesture | null>(null);

  const byId = new Map(spec.elements.map((el) => [el.id, el]));
  const surface = result.surface;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: surface.width * scale, height: surface.height * scale }}
    >
      {result.placed.map((placed) => {
        const element = byId.get(placed.id);
        if (element === undefined) return null;
        return (
          <Handle
            key={placed.id}
            element={element}
            placed={placed}
            scale={scale}
            selected={selectedId === placed.id}
            onSelect={() => selectElement(placed.id)}
            onUpdate={(patch) => updateElement(placed.id, patch)}
            onGesture={setGesture}
          />
        );
      })}

      {gesture !== null && <GestureHint gesture={gesture} />}
    </div>
  );
}

interface HandleProps {
  element: AdElement;
  placed: PlacedElement;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<AdElement>) => void;
  onGesture: (g: Gesture | null) => void;
}

function Handle({ element, placed, scale, selected, onSelect, onUpdate, onGesture }: HandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The label names the property a drag will write. It belongs to the gesture,
  // not to the selection: left up for as long as an element is selected it
  // covers whatever sits beside a small element, which on a footer logo is the
  // call to action.
  const [showLabel, setShowLabel] = useState(false);
  const frame = placed.frame;
  const canPin = PINNABLE.has(element.role);
  // An uncropped axis has nowhere to pan, so dragging it must not pretend
  // otherwise: on a surface whose frame already matches the picture, a sideways
  // drag would write a large focalPoint change that this canvas cannot show and
  // the other six surfaces would lurch. Lock the axis instead.
  const pan: PanAxes =
    !canPin && element.content.kind === 'image'
      ? panAxes(element.content.intrinsic, placed.imageCrop)
      : { x: false, y: false };
  const canFocal = pan.x || pan.y;
  const draggable = canPin || canFocal;

  const bodyDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    onSelect();
    if (!draggable) return;
    setShowLabel(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    const startFocal =
      element.content.kind === 'image'
        ? (element.content.focalPoint ?? { x: 0.5, y: 0.5 })
        : { x: 0.5, y: 0.5 };

    const move = (e: PointerEvent): void => {
      if (canFocal && element.content.kind === 'image' && placed.imageCrop !== undefined) {
        // Pan the picture under its window: dragging right should move the
        // image right, which means the crop window travels left.
        const next = focalFromDrag(
          startFocal,
          e.clientX - startX,
          e.clientY - startY,
          { w: frame.w * scale, h: frame.h * scale },
          element.content.intrinsic,
          placed.imageCrop,
          pan,
        );
        onUpdate({ content: { ...element.content, focalPoint: next } });
        onGesture({ kind: 'focal', id: element.id, startX: next.x, startY: next.y });
        return;
      }

      // Pin: whichever edge the pointer is nearest, in surface coordinates.
      const box = ref.current?.parentElement?.getBoundingClientRect();
      if (box === undefined) return;
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      onGesture({ kind: 'pin', id: element.id, pin: nearestEdge(x, y) });
    };

    const up = (e: PointerEvent): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setShowLabel(false);
      if (canPin) {
        const box = ref.current?.parentElement?.getBoundingClientRect();
        if (box !== undefined) {
          const x = (e.clientX - box.left) / box.width;
          const y = (e.clientY - box.top) / box.height;
          onUpdate({ pinTo: nearestEdge(x, y) });
        }
      }
      onGesture(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const cornerDrag = (event: React.PointerEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    const box = ref.current?.getBoundingClientRect();
    if (box === undefined) return;
    // The floor the engine will apply, authored or from the role, so the handle
    // stops where the engine would have stopped it anyway.
    const floor = element.minSize ?? ROLE_DEFAULTS[element.role].minSize;

    const move = (e: PointerEvent): void => {
      const cap = capFromHandle(e.clientX - box.left, e.clientY - box.top, scale, floor);
      onUpdate({ maxSize: cap });
      onGesture({ kind: 'size', id: element.id, ...cap });
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onGesture(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={ref}
      onPointerDown={bodyDrag}
      onPointerEnter={() => setShowLabel(true)}
      onPointerLeave={() => setShowLabel(false)}
      role="button"
      tabIndex={-1}
      aria-label={`${element.id}, ${describe(canPin, pan)}`}
      className={`pointer-events-auto absolute ${cursorFor(canPin, draggable, pan)} ${
        selected ? 'ring-2 ring-guide' : 'hover:ring-1 hover:ring-guide/60'
      }`}
      style={{
        left: frame.x * scale,
        top: frame.y * scale,
        width: frame.w * scale,
        height: frame.h * scale,
        zIndex: placed.z + 1,
      }}
    >
      {showLabel && (
        <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap bg-guide px-1 text-micro text-on-accent">
          {element.id} &middot; {describe(canPin, pan)}
        </span>
      )}
      {selected && (
        <button
          type="button"
          onPointerDown={cornerDrag}
          aria-label={`Set the largest size for ${element.id}`}
          title="Drag to cap how large this may be drawn, on every surface"
          className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize border border-on-accent bg-guide"
        />
      )}
    </div>
  );
}

/** Says what this drag will do here, in the spec's terms, before you commit. */
function describe(canPin: boolean, pan: PanAxes): string {
  if (canPin) return 'drag to pin';
  if (pan.x && pan.y) return 'drag to reframe';
  if (pan.x) return 'drag sideways to reframe';
  if (pan.y) return 'drag up or down to reframe';
  return 'nothing to move here';
}

function cursorFor(canPin: boolean, draggable: boolean, pan: PanAxes): string {
  if (canPin) return 'cursor-grab';
  if (!draggable) return 'cursor-pointer';
  if (pan.x && pan.y) return 'cursor-move';
  return pan.x ? 'cursor-ew-resize' : 'cursor-ns-resize';
}

/** What the gesture is about to write, said in the spec's own vocabulary. */
function GestureHint({ gesture }: { gesture: Gesture }) {
  const text =
    gesture.kind === 'pin'
      ? `pinTo: "${gesture.pin}"`
      : gesture.kind === 'focal'
        ? `focalPoint: ${gesture.startX.toFixed(2)}, ${gesture.startY.toFixed(2)}`
        : `maxSize: ${gesture.w} × ${gesture.h}`;

  return (
    <div className="pointer-events-none absolute left-1/2 top-2 z-[999] -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 font-mono text-micro text-on-accent">
      {gesture.id} &middot; {text} &middot; applies to every surface
    </div>
  );
}

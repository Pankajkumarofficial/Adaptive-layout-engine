import type { AdElement } from '@ale/engine';
import { usePlayground } from '../lib/store';
import { Field, Swatch } from './Field';

/** Inline editing for whichever element the ladder has open. */
export function ElementInspector({ element }: { element: AdElement }) {
  const updateElement = usePlayground((s) => s.updateElement);
  const removeElement = usePlayground((s) => s.removeElement);
  const content = element.content;

  return (
    <div className="border-t border-rule bg-card px-4 py-3">
      {content.kind === 'text' && (
        <>
          <Field label="Text">
            <textarea
              value={content.value}
              rows={2}
              onChange={(e) =>
                updateElement(element.id, { content: { ...content, value: e.target.value } })
              }
              className="w-full resize-y rounded-bench border border-rule bg-card px-2 py-1 text-sm text-ink focus:border-guide focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max lines">
              <NumberInput
                value={content.maxLines ?? 1}
                min={1}
                max={12}
                onChange={(maxLines) =>
                  updateElement(element.id, { content: { ...content, maxLines } })
                }
              />
            </Field>
            <Field label="Min size (px)">
              <NumberInput
                value={content.minFontPx ?? 12}
                min={4}
                max={200}
                onChange={(minFontPx) =>
                  updateElement(element.id, { content: { ...content, minFontPx } })
                }
              />
            </Field>
          </div>
        </>
      )}

      {content.kind === 'image' && (
        <>
          <Field label="Image URL">
            <input
              value={content.url}
              onChange={(e) =>
                updateElement(element.id, { content: { ...content, url: e.target.value } })
              }
              className="w-full rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny text-ink focus:border-guide focus:outline-none"
            />
          </Field>
          <Field label="Focal point — click the image to set what must survive the crop">
            <FocalPicker
              url={content.url}
              point={content.focalPoint ?? { x: 0.5, y: 0.5 }}
              aspect={content.intrinsic.w / content.intrinsic.h}
              onChange={(focalPoint) =>
                updateElement(element.id, { content: { ...content, focalPoint } })
              }
            />
          </Field>
        </>
      )}

      {content.kind === 'shape' && (
        <Field label="Fill">
          <Swatch
            value={content.fill}
            onChange={(fill) => updateElement(element.id, { content: { ...content, fill } })}
          />
        </Field>
      )}

      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-tiny text-ink-2">
          Pin
          <select
            value={element.pinTo ?? ''}
            onChange={(e) =>
              updateElement(element.id, {
                pinTo: e.target.value === '' ? undefined : (e.target.value as AdElement['pinTo']),
              })
            }
            className="rounded-bench border border-rule bg-card px-1 py-0.5 text-tiny text-ink focus:border-guide focus:outline-none"
          >
            <option value="">auto</option>
            <option value="top">top</option>
            <option value="bottom">bottom</option>
            <option value="left">left</option>
            <option value="right">right</option>
            <option value="center">center</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => removeElement(element.id)}
          className="text-tiny text-ink-3 hover:text-reg"
        >
          Remove element
        </button>
      </div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      className="w-full rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny tabular text-ink focus:border-guide focus:outline-none"
    />
  );
}

function FocalPicker({
  url,
  point,
  aspect,
  onChange,
}: {
  url: string;
  point: { x: number; y: number };
  aspect: number;
  onChange: (p: { x: number; y: number }) => void;
}) {
  return (
    <div
      className="relative w-full cursor-crosshair overflow-hidden rounded-bench border border-rule bg-card"
      style={{ aspectRatio: aspect }}
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onChange({
          x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
          y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
        });
      }}
    >
      <img src={url} alt="" className="h-full w-full object-cover opacity-80" draggable={false} />
      <span
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-guide shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
      />
    </div>
  );
}

import { useRef, useState } from 'react';
import type { AdElement, ImageContent } from '@ale/engine';
import { usePlayground } from '../lib/store';
import { importImageFile } from '../lib/importImage';
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
          <ImagePicker
            content={content}
            onPick={(next) => updateElement(element.id, { content: { ...content, ...next } })}
          />
          <SizeCap element={element} />
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

/**
 * Choosing the picture. A file from the machine is inlined into the spec so it
 * travels with export and share; a URL is still accepted because pointing at a
 * CDN is the sane thing to do for anything real.
 */
function ImagePicker({
  content,
  onPick,
}: {
  content: ImageContent;
  onPick: (next: Pick<ImageContent, 'url' | 'intrinsic'>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const imported = await importImageFile(file);
      onPick({ url: imported.url, intrinsic: imported.intrinsic });
      setStatus(
        imported.warning !== undefined
          ? { tone: 'info', text: imported.warning }
          : {
              tone: 'info',
              text: `Using ${file.name} at ${imported.intrinsic.w}\u00d7${imported.intrinsic.h}.`,
            },
      );
    } catch (err) {
      setStatus({
        tone: 'error',
        text: err instanceof Error ? err.message : 'That file did not work.',
      });
    } finally {
      setBusy(false);
    }
  };

  const isInlined = content.url.startsWith('data:');

  return (
    <div className="mb-3">
      <span className="mb-1 block text-tiny leading-snug text-ink-3">Picture</span>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="bg-ink px-2.5 py-1 text-tiny text-on-accent disabled:opacity-50"
        >
          {busy ? 'Reading\u2026' : 'Choose a file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void choose(file);
            e.target.value = '';
          }}
        />
        <span className="self-center truncate text-micro text-ink-3">
          {isInlined ? 'stored in the spec' : 'from a URL'}
        </span>
      </div>

      <label className="mt-2 block">
        <span className="mb-1 block text-micro text-ink-3">or paste an image address</span>
        <input
          value={isInlined ? '' : content.url}
          placeholder={
            isInlined ? 'a file is in use \u2014 paste a URL to replace it' : 'https://\u2026'
          }
          onChange={(e) => {
            // Dimensions are unknown until it loads; measure rather than guess,
            // because the crop maths depends on them.
            const url = e.target.value;
            onPick({ url, intrinsic: content.intrinsic });
            if (url === '') return;
            const probe = new Image();
            probe.onload = () =>
              onPick({ url, intrinsic: { w: probe.naturalWidth, h: probe.naturalHeight } });
            probe.src = url;
          }}
          className="w-full rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny text-ink focus:border-guide focus:outline-none"
        />
      </label>

      {status !== null && (
        <p
          className={`mt-1 text-micro leading-snug ${status.tone === 'error' ? 'text-reg' : 'text-ink-2'}`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}

/**
 * A ceiling on the rendered frame.
 *
 * Without one an element takes whatever room its region offers, which is right
 * for a hero and wrong for a logo — "as large as it fits" is never what anyone
 * means by a logo. Blank means no cap, which is the previous behaviour.
 */
function SizeCap({ element }: { element: AdElement }) {
  const updateElement = usePlayground((s) => s.updateElement);
  const max = element.maxSize;

  /**
   * Each axis is written independently. An empty, zero or negative entry
   * removes that axis's cap rather than storing it — the previous version
   * derived the other axis from the one you typed, so a width of 1 produced a
   * height of 0 and invalidated the whole document mid-keystroke.
   */
  const set = (axis: 'w' | 'h', raw: string): void => {
    const n = Number(raw);
    const valid = raw.trim() !== '' && Number.isFinite(n) && n > 0;
    const next: { w?: number; h?: number } = { ...max };
    if (valid) next[axis] = n;
    else delete next[axis];
    updateElement(element.id, {
      maxSize: next.w === undefined && next.h === undefined ? undefined : next,
    });
  };

  return (
    <div className="mb-3">
      <span className="mb-1 block text-tiny leading-snug text-ink-3">
        Largest it may be drawn, in px &mdash; leave either blank for no limit
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          placeholder="any width"
          aria-label="Maximum width in pixels"
          value={max?.w ?? ''}
          onChange={(e) => set('w', e.target.value)}
          className="w-full rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny text-ink focus:border-guide focus:outline-none"
        />
        <span aria-hidden className="text-tiny text-ink-3">
          &times;
        </span>
        <input
          type="number"
          min={1}
          placeholder="any height"
          aria-label="Maximum height in pixels"
          value={max?.h ?? ''}
          onChange={(e) => set('h', e.target.value)}
          className="w-full rounded-bench border border-rule bg-card px-2 py-1 tabular text-tiny text-ink focus:border-guide focus:outline-none"
        />
      </div>
      {element.aspectLock !== undefined && (
        <p className="mt-1 text-micro text-ink-3">
          Held at {element.aspectLock}:1, so whichever limit binds first wins.
        </p>
      )}
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

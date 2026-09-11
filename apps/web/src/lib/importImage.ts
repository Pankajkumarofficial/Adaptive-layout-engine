/**
 * Turns a picked file into something the engine can lay out.
 *
 * Two things matter beyond the pixels. The engine needs intrinsic dimensions to
 * compute a crop, so they are measured from the decoded image rather than
 * trusted from anywhere. And the result is inlined as a data URI so a spec
 * stays self-contained — it can be exported, shared and re-opened without an
 * asset server — which means it has to be small enough to survive being put in
 * localStorage alongside everything else.
 */

/** Longest edge kept. Beyond this a photo costs storage without showing more. */
const MAX_EDGE = 1400;

/** Above this a spec starts risking the browser's storage quota. */
const WARN_BYTES = 1_200_000;

export interface ImportedImage {
  url: string;
  intrinsic: { w: number; h: number };
  /** Present when the result is large enough to be worth mentioning. */
  warning?: string;
}

export async function importImageFile(file: File): Promise<ImportedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image.`);
  }

  // SVG is already small and resolution-independent; rasterising it would only
  // throw away the one property that makes it a good logo.
  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
    const box = readSvgViewBox(text);
    return { url, intrinsic: box ?? { w: 480, h: 160 } };
  }

  const dataUrl = await readAsDataUrl(file);
  const image = await decode(dataUrl);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));

  // Small enough already, and a format we should not re-encode.
  if (scale === 1 && file.size < WARN_BYTES) {
    return { url: dataUrl, intrinsic: { w: image.naturalWidth, h: image.naturalHeight } };
  }

  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return { url: dataUrl, intrinsic: { w: image.naturalWidth, h: image.naturalHeight } };
  }
  ctx.drawImage(image, 0, 0, w, h);

  // PNG keeps transparency, which a logo usually depends on; everything else
  // is a photograph and compresses far better as JPEG.
  const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const url = canvas.toDataURL(keepsAlpha ? 'image/png' : 'image/jpeg', 0.85);

  return {
    url,
    intrinsic: { w, h },
    ...(url.length > WARN_BYTES
      ? {
          warning:
            'That image is large. It is stored inside the spec, so exporting or saving it may be slow.',
        }
      : {}),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file could not be decoded as an image.'));
    image.src = url;
  });
}

/** An SVG has no natural pixel size; its viewBox is the closest thing. */
function readSvgViewBox(text: string): { w: number; h: number } | null {
  const match = /viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(text);
  if (match === null) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
}

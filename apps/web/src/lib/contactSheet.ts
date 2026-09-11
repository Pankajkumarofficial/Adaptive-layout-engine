/**
 * Composes the seven solved surfaces into one image.
 *
 * The previous export screenshotted the strip on screen, which meant it
 * inherited everything wrong with being a strip: it is horizontally scrollable,
 * so the capture stopped at the viewport and three surfaces never appeared; the
 * tiles are 190px previews, so the ads were thumbnails; and the editor's own
 * furniture — archetype labels, drop lists, the proof backing — came along as
 * if it were part of the artwork.
 *
 * So this composes rather than captures. Each ad arrives already rendered at
 * its real pixel size, is drawn to fit its cell, and the captions are drawn as
 * type rather than photographed from the DOM.
 */

export interface SheetTile {
  label: string;
  archetype: string;
  dropped: readonly string[];
  /** The ad, rendered at its true surface dimensions. */
  image: HTMLImageElement;
  width: number;
  height: number;
}

export interface SheetPalette {
  board: string;
  proof: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  guide: string;
  reg: string;
}

const PAD = 56;
const GAP = 40;
const CELL_W = 520;
const CELL_H = 380;
const CAPTION_H = 64;
const HEADER_H = 104;
/** Drawn at 2x so the type in the captions is not soft on a retina screen. */
const SCALE = 2;

const BODY = '"Archivo", system-ui, -apple-system, sans-serif';
const DISPLAY = '"Bodoni Moda", Georgia, serif';

function columnsFor(count: number): number {
  if (count <= 2) return count;
  if (count <= 4) return 2;
  return 3;
}

export function composeContactSheet(
  title: string,
  subtitle: string,
  tiles: readonly SheetTile[],
  palette: SheetPalette,
): HTMLCanvasElement {
  const cols = Math.max(1, columnsFor(tiles.length));
  const rows = Math.ceil(tiles.length / cols);
  const rowH = CELL_H + CAPTION_H;

  const width = PAD * 2 + CELL_W * cols + GAP * (cols - 1);
  const height = PAD * 2 + HEADER_H + rowH * rows + GAP * (rows - 1);

  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = palette.board;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.ink;
  ctx.font = `500 34px ${DISPLAY}`;
  ctx.fillText(title, PAD, PAD + 30);
  ctx.fillStyle = palette.ink3;
  ctx.font = `400 15px ${BODY}`;
  ctx.fillText(subtitle, PAD, PAD + 58);

  ctx.strokeStyle = palette.rule;
  ctx.lineWidth = 1;
  line(ctx, PAD, PAD + 78.5, width - PAD, PAD + 78.5);

  tiles.forEach((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (CELL_W + GAP);
    const y = PAD + HEADER_H + row * (rowH + GAP);

    ctx.fillStyle = palette.proof;
    ctx.fillRect(x, y, CELL_W, CELL_H);

    // Never enlarge: a 320x50 banner printed four times its size would be a
    // claim about the artwork that the artwork does not make.
    const fit = Math.min(1, (CELL_W - 48) / tile.width, (CELL_H - 48) / tile.height);
    const w = tile.width * fit;
    const h = tile.height * fit;
    const ix = x + (CELL_W - w) / 2;
    const iy = y + (CELL_H - h) / 2;
    ctx.drawImage(tile.image, ix, iy, w, h);

    ctx.strokeStyle = palette.rule;
    line(ctx, x, y + CELL_H + 12.5, x + CELL_W, y + CELL_H + 12.5);

    const textY = y + CELL_H + 34;
    ctx.font = `500 16px ${BODY}`;
    ctx.fillStyle = palette.ink2;
    ctx.textAlign = 'left';
    ctx.fillText(tile.label, x, textY);

    ctx.font = `400 13px ${BODY}`;
    ctx.fillStyle = palette.guide;
    ctx.textAlign = 'right';
    ctx.fillText(tile.archetype, x + CELL_W, textY);

    ctx.textAlign = 'left';
    ctx.font = `400 13px ${BODY}`;
    if (tile.dropped.length > 0) {
      ctx.fillStyle = palette.reg;
      ctx.fillText(`−${tile.dropped.join(' ')}`, x, textY + 20);
    } else {
      ctx.fillStyle = palette.ink3;
      ctx.fillText('everything survives', x, textY + 20);
    }

    // Scale is worth stating: the same ad is shown at different reductions in
    // neighbouring cells, and without this the sheet implies they are the same
    // size when a banner is a twentieth of a story.
    ctx.fillStyle = palette.ink3;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${tile.width}×${tile.height} at ${Math.round(fit * 100)}%`,
      x + CELL_W,
      textY + 20,
    );
    ctx.textAlign = 'left';
  });

  return canvas;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Decodes a data URL into an image the canvas can draw. */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode a rendered surface.'));
    img.src = dataUrl;
  });
}

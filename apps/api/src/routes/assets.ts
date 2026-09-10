import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import multer from 'multer';
import { imageSize } from 'image-size';
import { readFile } from 'node:fs/promises';
import { ApiError, ok, route } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import type { Env } from '../env.js';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

export function assetRoutes(env: Env): Router {
  const router = Router();
  const dir = resolve(process.cwd(), env.UPLOAD_DIR);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    // A read-only filesystem must not take the whole API down at import time;
    // the upload route will fail on its own with a real status instead.
    console.warn(`[api] uploads unavailable at ${dir}:`, err);
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      // Never trust the client filename: generate one and keep only the
      // extension, so an upload cannot write outside the directory.
      filename: (_req, file, cb) =>
        cb(null, `${randomBytes(12).toString('hex')}${safeExtension(file.originalname)}`),
    }),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        cb(new ApiError(415, 'UNSUPPORTED_TYPE', `${file.mimetype} is not an image we accept`));
        return;
      }
      cb(null, true);
    },
  });

  router.post(
    '/',
    requireUser,
    upload.single('file'),
    route(async (req, res) => {
      const file = req.file;
      if (file === undefined) throw ApiError.badRequest('Attach a file field called "file"');

      // The engine needs intrinsic dimensions to compute a crop, so measure the
      // bytes rather than trusting anything the client said.
      const intrinsic = await measure(join(dir, file.filename));
      ok(res, { url: `/uploads/${file.filename}`, intrinsic, bytes: file.size }, 201);
    }),
  );

  return router;
}

function safeExtension(name: string): string {
  const ext = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

async function measure(path: string): Promise<{ w: number; h: number }> {
  try {
    const size = imageSize(await readFile(path));
    if (size.width === undefined || size.height === undefined) throw new Error('no dimensions');
    return { w: size.width, h: size.height };
  } catch {
    // SVGs without an intrinsic size still need a ratio for the crop maths.
    return { w: 1000, h: 1000 };
  }
}

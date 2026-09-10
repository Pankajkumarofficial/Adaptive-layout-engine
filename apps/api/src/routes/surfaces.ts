import { Router } from 'express';
import { z } from 'zod';
import { surfaceSchema } from '../shared.js';
import { PRESET_SURFACES } from '../engine.js';
import type { Surface } from '../engine.js';
import { ApiError, ok, route } from '../http.js';
import { validateBody } from '../middleware/validate.js';
import { requireUser } from '../middleware/auth.js';
import { SurfaceDoc } from '../models/index.js';

export function surfaceRoutes(): Router {
  const router = Router();

  /** Presets are readable without an account; they are not user data. */
  router.get(
    '/',
    route(async (req, res) => {
      const custom =
        req.userId === undefined ? [] : await SurfaceDoc.find({ owner: req.userId }).lean();
      ok(res, {
        presets: PRESET_SURFACES,
        custom: custom.map((doc) => ({ id: String(doc._id), surface: doc.surface })),
      });
    }),
  );

  router.post(
    '/',
    requireUser,
    validateBody(z.object({ surface: surfaceSchema })),
    route(async (req, res) => {
      const { surface } = req.body as { surface: Surface };
      const created = await SurfaceDoc.create({ owner: req.userId, surface });
      ok(res, { id: String(created._id), surface }, 201);
    }),
  );

  router.delete(
    '/:id',
    requireUser,
    route(async (req, res) => {
      const id = req.params.id;
      if (id === undefined || !/^[0-9a-fA-F]{24}$/.test(id)) throw ApiError.notFound('Surface');
      const doc = await SurfaceDoc.findById(id).lean();
      if (doc === null) throw ApiError.notFound('Surface');
      if (String(doc.owner) !== req.userId) throw ApiError.forbidden();
      await SurfaceDoc.deleteOne({ _id: id });
      ok(res, { id, deleted: true });
    }),
  );

  return router;
}

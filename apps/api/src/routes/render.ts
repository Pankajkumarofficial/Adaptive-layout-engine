import { Router } from 'express';
import { z } from 'zod';
import { adSpecSchema, surfaceSchema } from '../shared.js';
import { PRESET_SURFACES } from '../engine.js';
import type { AdSpec, Surface } from '../engine.js';
import { ApiError, ok, route } from '../http.js';
import { validateBody } from '../middleware/validate.js';
import { AdSpecDoc, RenderLog } from '../models/index.js';
import { renderMany } from '../services/render.js';

/**
 * Either name a stored spec or send one inline. The inline form is what makes
 * the client/server parity test possible without a database round trip.
 */
const renderBody = z
  .object({
    specId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(),
    spec: adSpecSchema.optional(),
    surfaceIds: z.array(z.string().min(1)).max(50).optional(),
    surfaces: z.array(surfaceSchema).max(50).optional(),
  })
  .refine((b) => b.specId !== undefined || b.spec !== undefined, {
    message: 'send either specId or spec',
  });

export function renderRoutes(): Router {
  const router = Router();

  router.post(
    '/',
    validateBody(renderBody),
    route(async (req, res) => {
      const body = req.body as z.infer<typeof renderBody>;

      let spec = body.spec as AdSpec | undefined;
      const specId: string | undefined = body.specId;
      if (spec === undefined && specId !== undefined) {
        const doc = await AdSpecDoc.findById(specId).lean();
        if (doc === null) throw ApiError.notFound('Spec');
        if (req.userId !== undefined && String(doc.owner) !== req.userId) {
          throw ApiError.forbidden('That spec belongs to someone else');
        }
        spec = doc.spec as AdSpec;
      }
      if (spec === undefined) throw ApiError.badRequest('No spec to render');

      const surfaces = resolveSurfaces(body);
      if (surfaces.length === 0) throw ApiError.badRequest('No surfaces to render on');

      const rendered = renderMany(spec, surfaces);

      // Fire-and-forget analytics: a logging failure must not fail the render.
      if (specId !== undefined) {
        void RenderLog.insertMany(
          rendered.map(({ result, solveMs }) => ({
            specId,
            surfaceId: result.surface.id,
            archetype: result.archetype,
            droppedIds: result.dropped.map((d) => d.id),
            solveMs,
          })),
        ).catch((err: unknown) => console.error('[api] render log failed', err));
      }

      ok(res, {
        results: rendered.map((r) => r.result),
        timings: rendered.map((r) => ({ surfaceId: r.result.surface.id, solveMs: r.solveMs })),
      });
    }),
  );

  return router;
}

function resolveSurfaces(body: { surfaceIds?: string[]; surfaces?: Surface[] }): Surface[] {
  if (body.surfaces !== undefined && body.surfaces.length > 0) return body.surfaces;
  if (body.surfaceIds === undefined) return [...PRESET_SURFACES];
  const byId = new Map(PRESET_SURFACES.map((s) => [s.id, s]));
  return body.surfaceIds.flatMap((id) => {
    const found = byId.get(id);
    return found === undefined ? [] : [found];
  });
}

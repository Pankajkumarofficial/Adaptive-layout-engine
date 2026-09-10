import { Router } from 'express';
import { PRESET_SURFACES } from '../engine.js';
import type { AdSpec } from '../engine.js';
import { ApiError, ok, route } from '../http.js';
import { AdSpecDoc, ShareLink } from '../models/index.js';
import { renderMany } from '../services/render.js';

/**
 * The no-login surface of the API. A share link hands over the spec plus every
 * preset already solved, so a recipient sees the finished matrix immediately
 * instead of waiting on a round trip per surface.
 */
export function publicRoutes(): Router {
  const router = Router();

  router.get(
    '/:slug',
    route(async (req, res) => {
      const slug = req.params.slug;
      if (slug === undefined || slug.length === 0) throw ApiError.notFound('Share link');

      const link = await ShareLink.findOne({ slug }).lean();
      if (link === null) throw ApiError.notFound('Share link');

      const doc = await AdSpecDoc.findById(link.spec).lean();
      if (doc === null) throw ApiError.notFound('Spec');

      const spec = doc.spec as AdSpec;
      const rendered = renderMany(spec, PRESET_SURFACES);

      ok(res, {
        slug,
        name: doc.name,
        spec,
        results: rendered.map((r) => r.result),
      });
    }),
  );

  return router;
}

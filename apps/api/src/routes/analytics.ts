import { Router } from 'express';
import { ok, route } from '../http.js';
import { requireUser } from '../middleware/auth.js';
import { RenderLog } from '../models/index.js';

/**
 * Which elements the engine sacrifices most often, and where.
 *
 * This is the dataset the README's "ML-driven archetype selection" idea would
 * learn from: every drop the engine has ever made, grouped by element and by
 * surface, plus the solve times that justify doing it in real time.
 */
export function analyticsRoutes(): Router {
  const router = Router();
  router.use(requireUser);

  router.get(
    '/drops',
    route(async (_req, res) => {
      const [byElement, bySurface, timing] = await Promise.all([
        RenderLog.aggregate([
          { $unwind: '$droppedIds' },
          { $group: { _id: '$droppedIds', drops: { $sum: 1 } } },
          { $sort: { drops: -1 } },
          { $limit: 20 },
        ]),
        RenderLog.aggregate([
          {
            $group: {
              _id: { surfaceId: '$surfaceId', archetype: '$archetype' },
              renders: { $sum: 1 },
              dropped: { $sum: { $size: '$droppedIds' } },
            },
          },
          { $sort: { renders: -1 } },
          { $limit: 20 },
        ]),
        RenderLog.aggregate([
          {
            $group: {
              _id: null,
              renders: { $sum: 1 },
              avgSolveMs: { $avg: '$solveMs' },
              maxSolveMs: { $max: '$solveMs' },
            },
          },
        ]),
      ]);

      ok(res, {
        byElement: byElement.map((row: { _id: string; drops: number }) => ({
          elementId: row._id,
          drops: row.drops,
        })),
        bySurface: bySurface.map(
          (row: {
            _id: { surfaceId: string; archetype: string };
            renders: number;
            dropped: number;
          }) => ({
            surfaceId: row._id.surfaceId,
            archetype: row._id.archetype,
            renders: row.renders,
            dropped: row.dropped,
          }),
        ),
        timing: timing[0] ?? { renders: 0, avgSolveMs: 0, maxSolveMs: 0 },
      });
    }),
  );

  return router;
}

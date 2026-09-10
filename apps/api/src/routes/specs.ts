import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { adSpecSchema } from '../shared.js';
import type { AdSpec } from '../engine.js';
import { ApiError, ok, route } from '../http.js';
import { validateBody } from '../middleware/validate.js';
import { requireUser } from '../middleware/auth.js';
import { AdSpecDoc, ShareLink } from '../models/index.js';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});

const patchBody = z.object({
  name: z.string().min(1).optional(),
  spec: adSpecSchema.optional(),
});

/** URL-safe, unguessable, and short enough to paste into a message. */
export function makeSlug(): string {
  return randomBytes(9).toString('base64url');
}

export function specRoutes(): Router {
  const router = Router();
  router.use(requireUser);

  router.get(
    '/',
    route(async (req, res) => {
      const { page, limit, q } = listQuery.parse(req.query);
      const filter: Record<string, unknown> = { owner: req.userId };
      if (q !== undefined && q.length > 0) {
        // Escaped so a user searching for "a.b" does not get a regex.
        filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      }
      const [items, total] = await Promise.all([
        AdSpecDoc.find(filter)
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        AdSpecDoc.countDocuments(filter),
      ]);
      ok(res, {
        items: items.map(present),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    }),
  );

  router.post(
    '/',
    validateBody(z.object({ spec: adSpecSchema })),
    route(async (req, res) => {
      const { spec } = req.body as { spec: AdSpec };
      const created = await AdSpecDoc.create({ owner: req.userId, name: spec.name, spec });
      ok(res, present(created.toObject()), 201);
    }),
  );

  router.get(
    '/:id',
    route(async (req, res) => {
      ok(res, present(await mine(req.params.id, req.userId)));
    }),
  );

  router.patch(
    '/:id',
    validateBody(patchBody),
    route(async (req, res) => {
      const patch = req.body as z.infer<typeof patchBody>;
      const doc = await mine(req.params.id, req.userId);
      const next = {
        name: patch.name ?? (patch.spec?.name as string | undefined) ?? doc.name,
        spec: (patch.spec as AdSpec | undefined) ?? doc.spec,
      };
      const updated = await AdSpecDoc.findByIdAndUpdate(doc._id, next, { new: true }).lean();
      if (updated === null) throw ApiError.notFound('Spec');
      ok(res, present(updated));
    }),
  );

  router.delete(
    '/:id',
    route(async (req, res) => {
      const doc = await mine(req.params.id, req.userId);
      await Promise.all([
        AdSpecDoc.deleteOne({ _id: doc._id }),
        // A share link to a deleted spec would 404 forever; remove it too.
        ShareLink.deleteMany({ spec: doc._id }),
      ]);
      ok(res, { id: String(doc._id), deleted: true });
    }),
  );

  router.post(
    '/:id/duplicate',
    route(async (req, res) => {
      const doc = await mine(req.params.id, req.userId);
      const source = doc.spec as AdSpec;
      const copy: AdSpec = {
        ...source,
        id: `${source.id}-copy-${randomBytes(3).toString('hex')}`,
        name: `${source.name} (copy)`,
      };
      const created = await AdSpecDoc.create({ owner: req.userId, name: copy.name, spec: copy });
      ok(res, present(created.toObject()), 201);
    }),
  );

  router.post(
    '/:id/share',
    route(async (req, res) => {
      const doc = await mine(req.params.id, req.userId);
      // Sharing twice returns the same link rather than accumulating slugs.
      const existing = await ShareLink.findOne({ spec: doc._id }).lean();
      if (existing !== null) {
        ok(res, { slug: existing.slug });
        return;
      }
      const link = await ShareLink.create({
        slug: makeSlug(),
        spec: doc._id,
        owner: req.userId,
      });
      ok(res, { slug: link.slug }, 201);
    }),
  );

  return router;
}

interface StoredSpec {
  _id: unknown;
  name: string;
  spec: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

async function mine(id: string | undefined, owner: string | undefined): Promise<StoredSpec> {
  if (id === undefined || !/^[0-9a-fA-F]{24}$/.test(id)) throw ApiError.notFound('Spec');
  const doc = await AdSpecDoc.findById(id).lean();
  if (doc === null) throw ApiError.notFound('Spec');
  if (String(doc.owner) !== owner) throw ApiError.forbidden('That spec belongs to someone else');
  return doc as StoredSpec;
}

function present(doc: StoredSpec): Record<string, unknown> {
  return {
    id: String(doc._id),
    name: doc.name,
    spec: doc.spec,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

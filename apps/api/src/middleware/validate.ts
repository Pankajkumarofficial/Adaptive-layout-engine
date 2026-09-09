import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Replaces `req.body` with the parsed value, so handlers receive data that has
 * already been through the same schema the client validated against.
 *
 * Query strings are parsed inline in the routes that take them: they are small,
 * and `req.query` is not reliably writable across Express versions.
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

import { ZodError } from 'zod';
import { SpecError } from '../engine.js';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../http.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
};

/**
 * The single place an error becomes a response. Engine and validation errors
 * are translated here so route code never has to think about status codes.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'That request does not match the schema',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof SpecError) {
    res.status(422).json({
      error: { code: err.code, message: err.message, details: err.issues },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  // Log the whole thing server-side; return nothing that leaks internals.
  console.error('[api] unhandled', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side', details: undefined },
  });
  void message;
};

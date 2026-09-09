import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Every response is `{ data }` or `{ error }`. Nothing else leaves the API. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Sign in to continue'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'That is not yours'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(what: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${what} not found`);
  }
  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

/**
 * Express 4 does not forward rejected promises to the error handler, so every
 * async handler goes through this. Without it a thrown error inside an await
 * becomes an unhandled rejection and the request hangs.
 */
export function route(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

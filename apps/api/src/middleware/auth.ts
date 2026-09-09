import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { ApiError } from '../http.js';
import { AUTH_COOKIE } from '../env.js';

export interface AuthedRequest {
  userId?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function signToken(userId: string, secret: string, expiresIn: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn } as jwt.SignOptions);
}

/** Populates `req.userId` when a valid cookie is present; never rejects. */
export function attachUser(secret: string): RequestHandler {
  return (req, _res, next) => {
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      next();
      return;
    }
    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload === 'object' && payload !== null && typeof payload.sub === 'string') {
        req.userId = payload.sub;
      }
    } catch {
      // An expired or forged cookie is simply not a session. The route guard
      // below turns that into a 401 if the route needed one.
    }
    next();
  };
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (req.userId === undefined) {
    next(ApiError.unauthorized());
    return;
  }
  next();
};

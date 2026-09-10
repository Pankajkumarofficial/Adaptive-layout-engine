import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AUTH_COOKIE, COOKIE_MAX_AGE_MS, type Env } from '../env.js';
import { ApiError, ok, route } from '../http.js';
import { validateBody } from '../middleware/validate.js';
import { requireUser, signToken } from '../middleware/auth.js';
import { User } from '../models/index.js';

const credentials = z.object({
  email: z.string().email('that does not look like an email address'),
  password: z.string().min(8, 'use at least 8 characters'),
});

const BCRYPT_ROUNDS = 12;

export function authRoutes(env: Env): Router {
  const router = Router();

  const setSession = (res: Response, userId: string): void => {
    // Served from one origin — Vite's proxy in development, one Vercel project
    // in production — `lax` is correct and stricter. Split across two hosts, a
    // `lax` cookie is simply never sent on the cross-site request and the
    // session would silently never exist, so that case opts into `none`, which
    // in turn requires `secure`.
    const crossSite = env.COOKIE_CROSS_SITE;
    res.cookie(AUTH_COOKIE, signToken(userId, env.JWT_SECRET, env.JWT_EXPIRES_IN), {
      httpOnly: true,
      sameSite: crossSite ? 'none' : 'lax',
      secure: crossSite || env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
  };

  router.post(
    '/register',
    validateBody(credentials),
    route(async (req, res) => {
      const { email, password } = req.body as z.infer<typeof credentials>;
      const existing = await User.findOne({ email: email.toLowerCase() }).lean();
      if (existing !== null) {
        throw ApiError.conflict('An account with that email already exists');
      }
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      });
      setSession(res, String(user._id));
      ok(res, { id: String(user._id), email: user.email }, 201);
    }),
  );

  router.post(
    '/login',
    validateBody(credentials),
    route(async (req, res) => {
      const { email, password } = req.body as z.infer<typeof credentials>;
      const user = await User.findOne({ email: email.toLowerCase() });
      // Compare regardless of whether the user exists, so the response time
      // does not reveal which emails are registered.
      const hash =
        user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
      const matches = await bcrypt.compare(password, hash);
      if (user === null || !matches) {
        throw new ApiError(401, 'INVALID_CREDENTIALS', 'That email and password do not match');
      }
      setSession(res, String(user._id));
      ok(res, { id: String(user._id), email: user.email });
    }),
  );

  router.post('/logout', (_req, res) => {
    const crossSite = env.COOKIE_CROSS_SITE;
    res.clearCookie(AUTH_COOKIE, {
      path: '/',
      sameSite: crossSite ? 'none' : 'lax',
      secure: crossSite || env.NODE_ENV === 'production',
    });
    ok(res, { ok: true });
  });

  router.get(
    '/me',
    requireUser,
    route(async (req, res) => {
      const user = await User.findById(req.userId).lean();
      if (user === null) throw ApiError.unauthorized();
      ok(res, { id: String(user._id), email: user.email });
    }),
  );

  return router;
}

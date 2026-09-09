import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { resolve } from 'node:path';
import type { Env } from './env.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRoutes } from './routes/auth.js';
import { specRoutes } from './routes/specs.js';
import { surfaceRoutes } from './routes/surfaces.js';
import { renderRoutes } from './routes/render.js';
import { publicRoutes } from './routes/public.js';
import { assetRoutes } from './routes/assets.js';
import { analyticsRoutes } from './routes/analytics.js';

/**
 * Builds the app without listening, so tests can drive it over supertest
 * without binding a port.
 */
export function createApp(env: Env): Express {
  const app = express();

  app.use(
    helmet({
      // Uploaded images are served to a different origin (the Vite dev server
      // and the deployed frontend), which the default same-origin policy blocks.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(attachUser(env.JWT_SECRET));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { ok: true, env: env.NODE_ENV } });
  });

  app.use('/uploads', express.static(resolve(process.cwd(), env.UPLOAD_DIR), { maxAge: '7d' }));

  app.use('/api/auth', authRoutes(env));
  app.use('/api/specs', specRoutes());
  app.use('/api/surfaces', surfaceRoutes());
  app.use('/api/render', renderRoutes());
  app.use('/api/public', publicRoutes());
  app.use('/api/assets', assetRoutes(env));
  app.use('/api/analytics', analyticsRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

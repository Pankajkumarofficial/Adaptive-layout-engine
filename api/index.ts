import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../apps/api/src/app.js';
import { connectToDatabase } from '../apps/api/src/db.js';
import { loadDotenv, loadEnv } from '../apps/api/src/env.js';

/**
 * Vercel serverless entry point.
 *
 * The same Express app the standalone server runs — it is simply handed each
 * request instead of being told to listen. `vercel.json` rewrites every
 * `/api/*` path here, and Express does its own routing from the original URL.
 *
 * The app is built once per container, at module scope, so warm invocations
 * skip it entirely. The database connection is established per request but
 * cached across them; see `db.ts` for why that matters on a free Atlas tier.
 */
loadDotenv();
const env = loadEnv();
const app = createApp(env);

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await connectToDatabase(env.MONGODB_URI);
  } catch (err) {
    console.error('[api] database unavailable', err);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is not reachable right now. Try again in a moment.',
        },
      }),
    );
    return;
  }

  app(req, res);
}

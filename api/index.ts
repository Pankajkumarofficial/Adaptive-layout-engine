import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../apps/api/src/app.js';
import { connectToDatabase } from '../apps/api/src/db.js';
import { loadDotenv, loadEnv, type Env } from '../apps/api/src/env.js';

/**
 * Vercel serverless entry point.
 *
 * The same Express app the standalone server runs — it is simply handed each
 * request instead of being told to listen. `vercel.json` rewrites every
 * `/api/*` path here, and Express routes from the original URL.
 *
 * Everything that can be done once per container is done at module scope, so
 * warm invocations skip it. Nothing here is allowed to throw at module scope:
 * a misconfigured deployment must answer with a readable reason, not with
 * FUNCTION_INVOCATION_FAILED, because that is the one situation where you
 * cannot attach a debugger.
 */
let env: Env | null = null;
let startupError: string | null = null;
let app: ReturnType<typeof createApp> | null = null;

try {
  loadDotenv();
  env = loadEnv();
  app = createApp(env);
} catch (err) {
  startupError = err instanceof Error ? err.message : String(err);
  console.error('[api] failed to start', err);
}

function fail(res: ServerResponse, status: number, code: string, message: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: { code, message } }));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (env === null || app === null) {
    fail(
      res,
      500,
      'MISCONFIGURED',
      `The API is not configured. ${startupError ?? 'Unknown startup error.'}`,
    );
    return;
  }

  // Health must answer even when the database does not, so that "the function
  // is broken" and "the database is unreachable" are distinguishable from the
  // outside. Everything else needs a connection before Express sees it.
  if (req.url?.startsWith('/api/health') === true) {
    let database = 'ok';
    try {
      await connectToDatabase(env.MONGODB_URI);
    } catch (err) {
      database = err instanceof Error ? `unreachable: ${err.message}` : 'unreachable';
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({ data: { ok: true, env: env.NODE_ENV, database, runtime: 'serverless' } }),
    );
    return;
  }

  try {
    await connectToDatabase(env.MONGODB_URI);
  } catch (err) {
    console.error('[api] database unavailable', err);
    fail(
      res,
      503,
      'DATABASE_UNAVAILABLE',
      'The database is not reachable right now. Try again in a moment.',
    );
    return;
  }

  app(req, res);
}

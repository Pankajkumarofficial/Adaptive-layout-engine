import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Vercel serverless entry point.
 *
 * Everything is imported lazily, inside the handler, on purpose. A top-level
 * import that throws — a module the bundler failed to trace, a CommonJS
 * interop mismatch, a package that touches the filesystem when it loads —
 * takes the function down before any code of ours runs, and the platform can
 * only report FUNCTION_INVOCATION_FAILED. That is the least useful thing to
 * read on a deployment you cannot attach a debugger to.
 *
 * Deferring the imports costs one dynamic import on a cold start and buys a
 * readable JSON error for every failure mode, including the ones that happen
 * while loading. The result is cached on the module, so warm invocations pay
 * nothing.
 */
interface Loaded {
  app: (req: IncomingMessage, res: ServerResponse) => void;
  mongoUri: string;
  nodeEnv: string;
  connect: (uri: string) => Promise<unknown>;
}

let loaded: Loaded | null = null;
let loadError: { stage: string; message: string; stack?: string } | null = null;

async function load(): Promise<Loaded | null> {
  if (loaded !== null || loadError !== null) return loaded;

  let stage = 'import';
  try {
    const [{ createApp }, { connectToDatabase }, envModule] = await Promise.all([
      import('../apps/api/src/app.js'),
      import('../apps/api/src/db.js'),
      import('../apps/api/src/env.js'),
    ]);

    stage = 'config';
    envModule.loadDotenv();
    const env = envModule.loadEnv();

    stage = 'app';
    loaded = {
      app: createApp(env) as Loaded['app'],
      mongoUri: env.MONGODB_URI,
      nodeEnv: env.NODE_ENV,
      connect: connectToDatabase,
    };
  } catch (err) {
    loadError = {
      stage,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join(' | ') : undefined,
    };
    console.error(`[api] startup failed during ${stage}`, err);
  }
  return loaded;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const ready = await load();

  if (ready === null) {
    json(res, 500, {
      error: {
        code: 'STARTUP_FAILED',
        message: `The API could not start (${loadError?.stage ?? 'unknown'}): ${loadError?.message ?? 'unknown error'}`,
        details: loadError?.stack,
      },
    });
    return;
  }

  // Health answers even when the database does not, so "the function is
  // broken" and "the database is unreachable" are distinguishable from
  // outside — the first question worth answering when a deploy misbehaves.
  if (req.url?.startsWith('/api/health') === true) {
    let database = 'ok';
    try {
      await ready.connect(ready.mongoUri);
    } catch (err) {
      database = err instanceof Error ? `unreachable: ${err.message}` : 'unreachable';
    }
    json(res, 200, { data: { ok: true, env: ready.nodeEnv, database, runtime: 'serverless' } });
    return;
  }

  try {
    await ready.connect(ready.mongoUri);
  } catch (err) {
    console.error('[api] database unavailable', err);
    json(res, 503, {
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: err instanceof Error ? err.message : 'The database is not reachable right now.',
      },
    });
    return;
  }

  ready.app(req, res);
}

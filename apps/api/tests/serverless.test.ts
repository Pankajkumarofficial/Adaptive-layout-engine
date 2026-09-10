import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { clearDb, startDb, stopDb, TEST_ENV } from './harness.js';

/**
 * The Vercel entry point, exercised exactly as Vercel invokes it.
 *
 * `api/index.ts` is a second way into the same Express app, and a second way
 * in is a second way to break: a bad import path or a missing env var there
 * would sail past every other test in this suite and only surface as a 500 on
 * the deployed site.
 */
describe('serverless handler', () => {
  let handler: (req: unknown, res: unknown) => unknown;

  beforeAll(async () => {
    await startDb();
    // The entry reads env at module scope, so it has to be set before import.
    Object.assign(process.env, TEST_ENV, { MONGODB_URI: process.env.MONGODB_URI });
    handler = (await import('../../../api/index.js')).default as typeof handler;
  });
  afterAll(stopDb);

  it('serves health through the function entry', async () => {
    const res = await request(handler as never)
      .get('/api/health')
      .expect(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('routes a real API path, not just the function root', async () => {
    await request(handler as never)
      .get('/api/specs')
      .expect(401);
  });

  it('runs the engine server-side through the function', async () => {
    await clearDb();
    const { DEMO_SPEC, PRESET_SURFACES, solve } = await import('@ale/engine');
    const res = await request(handler as never)
      .post('/api/render')
      .send({ spec: DEMO_SPEC, surfaceIds: [PRESET_SURFACES[0]!.id] })
      .expect(200);
    expect(res.body.data.results[0].fingerprint).toBe(
      solve(DEMO_SPEC, PRESET_SURFACES[0]!).fingerprint,
    );
  });

  it('answers unknown routes in the standard envelope', async () => {
    const res = await request(handler as never)
      .get('/api/nope')
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

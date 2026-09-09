import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { DEMO_SPEC, PRESET_SURFACES, solve } from '@ale/engine';
import { clearDb, signedIn, startDb, stopDb, testApp } from './harness.js';

let app: Express;

beforeAll(async () => {
  await startDb();
  app = testApp();
});
afterAll(stopDb);
afterEach(clearDb);

describe('auth', () => {
  it('registers, identifies and signs out', async () => {
    const { agent } = await signedIn(app);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.data.email).toBe('proofer@example.com');
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  it('refuses a duplicate email', async () => {
    await signedIn(app);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'proofer@example.com', password: 'correct horse battery' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a short password with a field-level message', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details[0].path).toBe('password');
  });

  it('does not say whether an email exists when the password is wrong', async () => {
    await signedIn(app);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'proofer@example.com', password: 'not the password' })
      .expect(401);
    const noSuchUser = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not the password' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
  });

  it('signs back in with the right password', async () => {
    await signedIn(app);
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'proofer@example.com', password: 'correct horse battery' })
      .expect(200);
    await agent.get('/api/auth/me').expect(200);
  });
});

describe('specs', () => {
  it('creates, reads, updates and deletes', async () => {
    const { agent } = await signedIn(app);

    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data.name).toBe(DEMO_SPEC.name);

    await agent.get(`/api/specs/${id}`).expect(200);

    const renamed = await agent.patch(`/api/specs/${id}`).send({ name: 'Renamed' }).expect(200);
    expect(renamed.body.data.name).toBe('Renamed');

    await agent.delete(`/api/specs/${id}`).expect(200);
    await agent.get(`/api/specs/${id}`).expect(404);
  });

  it('rejects a spec that fails the shared schema', async () => {
    const { agent } = await signedIn(app);
    const res = await agent
      .post('/api/specs')
      .send({ spec: { ...DEMO_SPEC, elements: [] } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('paginates and searches', async () => {
    const { agent } = await signedIn(app);
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      await agent
        .post('/api/specs')
        .send({ spec: { ...DEMO_SPEC, name } })
        .expect(201);
    }
    const page = await agent.get('/api/specs?page=1&limit=2').expect(200);
    expect(page.body.data.items).toHaveLength(2);
    expect(page.body.data.total).toBe(3);
    expect(page.body.data.pages).toBe(2);

    const search = await agent.get('/api/specs?q=bet').expect(200);
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].name).toBe('Beta');
  });

  it('duplicates a spec under a new id', async () => {
    const { agent } = await signedIn(app);
    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const copy = await agent.post(`/api/specs/${created.body.data.id}/duplicate`).expect(201);
    expect(copy.body.data.id).not.toBe(created.body.data.id);
    expect(copy.body.data.spec.id).not.toBe(DEMO_SPEC.id);
    expect(copy.body.data.name).toContain('copy');
  });

  it("will not let one account read another account's spec", async () => {
    const owner = await signedIn(app, 'owner@example.com');
    const created = await owner.agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const intruder = await signedIn(app, 'intruder@example.com');
    await intruder.agent.get(`/api/specs/${created.body.data.id}`).expect(403);
  });

  it('requires a session', async () => {
    await request(app).get('/api/specs').expect(401);
  });
});

describe('render', () => {
  it('solves an inline spec across the presets', async () => {
    const { agent } = await signedIn(app);
    const res = await agent
      .post('/api/render')
      .send({ spec: DEMO_SPEC, surfaceIds: PRESET_SURFACES.map((s) => s.id) })
      .expect(200);
    expect(res.body.data.results).toHaveLength(PRESET_SURFACES.length);
  });

  it('returns the same fingerprint the client computes', async () => {
    const { agent } = await signedIn(app);
    const surface = PRESET_SURFACES[3]!;
    const res = await agent
      .post('/api/render')
      .send({ spec: DEMO_SPEC, surfaceIds: [surface.id] })
      .expect(200);
    expect(res.body.data.results[0].fingerprint).toBe(solve(DEMO_SPEC, surface).fingerprint);
  });

  it('records a render log for stored specs', async () => {
    const { agent } = await signedIn(app);
    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    await agent
      .post('/api/render')
      .send({ specId: created.body.data.id, surfaceIds: ['banner-320x50'] })
      .expect(200);

    // The insert is deliberately not awaited by the route; give it a tick.
    await new Promise((r) => setTimeout(r, 250));
    const analytics = await agent.get('/api/analytics/drops').expect(200);
    expect(analytics.body.data.timing.renders).toBeGreaterThan(0);
    expect(analytics.body.data.byElement.length).toBeGreaterThan(0);
  });

  it('needs either a spec or a specId', async () => {
    const { agent } = await signedIn(app);
    await agent.post('/api/render').send({ surfaceIds: [] }).expect(400);
  });
});

describe('sharing', () => {
  it('serves a shared spec with pre-solved presets and no auth', async () => {
    const { agent } = await signedIn(app);
    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const shared = await agent.post(`/api/specs/${created.body.data.id}/share`).expect(201);
    const slug = shared.body.data.slug as string;

    const anonymous = await request(app).get(`/api/public/${slug}`).expect(200);
    expect(anonymous.body.data.spec.name).toBe(DEMO_SPEC.name);
    expect(anonymous.body.data.results).toHaveLength(PRESET_SURFACES.length);
  });

  it('returns the same slug when shared twice', async () => {
    const { agent } = await signedIn(app);
    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const first = await agent.post(`/api/specs/${created.body.data.id}/share`).expect(201);
    const second = await agent.post(`/api/specs/${created.body.data.id}/share`).expect(200);
    expect(second.body.data.slug).toBe(first.body.data.slug);
  });

  it('404s an unknown slug', async () => {
    await request(app).get('/api/public/not-a-real-slug').expect(404);
  });

  it('revokes the link when the spec is deleted', async () => {
    const { agent } = await signedIn(app);
    const created = await agent.post('/api/specs').send({ spec: DEMO_SPEC }).expect(201);
    const shared = await agent.post(`/api/specs/${created.body.data.id}/share`).expect(201);
    await agent.delete(`/api/specs/${created.body.data.id}`).expect(200);
    await request(app).get(`/api/public/${shared.body.data.slug}`).expect(404);
  });
});

describe('surfaces', () => {
  it('lists the built-in presets without a session', async () => {
    const res = await request(app).get('/api/surfaces').expect(200);
    expect(res.body.data.presets).toHaveLength(PRESET_SURFACES.length);
    expect(res.body.data.custom).toEqual([]);
  });

  it('stores and removes a custom surface', async () => {
    const { agent } = await signedIn(app);
    const surface = {
      id: 'wall',
      label: 'Lobby wall',
      width: 3840,
      height: 720,
      dpr: 1,
      interactionHint: 'none',
    };
    const created = await agent.post('/api/surfaces').send({ surface }).expect(201);
    const listed = await agent.get('/api/surfaces').expect(200);
    expect(listed.body.data.custom).toHaveLength(1);
    await agent.delete(`/api/surfaces/${created.body.data.id}`).expect(200);
    const after = await agent.get('/api/surfaces').expect(200);
    expect(after.body.data.custom).toEqual([]);
  });
});

describe('errors', () => {
  it('answers an unknown route in the standard envelope', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports health', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.data.ok).toBe(true);
  });
});

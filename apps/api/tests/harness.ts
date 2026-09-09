import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';

let mongo: MongoMemoryServer | null = null;

export const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '4999',
  JWT_SECRET: 'test-secret-that-is-long-enough',
  WEB_ORIGIN: 'http://localhost:5173',
  UPLOAD_DIR: 'uploads-test',
} as const;

export async function startDb(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('ale-test'));
}

export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = null;
}

export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export function testApp(): Express {
  return createApp(loadEnv({ ...process.env, ...TEST_ENV }));
}

export interface Session {
  agent: ReturnType<typeof request.agent>;
  userId: string;
}

/** Registers a user and returns an agent that carries their session cookie. */
export async function signedIn(app: Express, email = 'proofer@example.com'): Promise<Session> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ email, password: 'correct horse battery' })
    .expect(201);
  return { agent, userId: res.body.data.id as string };
}

import mongooseDefault from 'mongoose';
import type { Mongoose } from 'mongoose';

/**
 * Connection reuse across serverless invocations.
 *
 * A serverless function keeps its container alive between requests, but module
 * state is the only thing that survives — so a naive `mongoose.connect()` per
 * invocation opens a new pool every time and exhausts an Atlas free tier's
 * connection limit within a few minutes of traffic. Caching the *promise*
 * rather than the connection also collapses the thundering herd when several
 * requests hit a cold container at once.
 *
 * On a long-running server this is simply a no-op after the first call.
 */
interface ConnectionCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

const globalCache = globalThis as typeof globalThis & { __aleMongoose?: ConnectionCache };
const cache: ConnectionCache = (globalCache.__aleMongoose ??= { conn: null, promise: null });

export async function connectToDatabase(uri: string): Promise<Mongoose> {
  if (cache.conn !== null) return cache.conn;

  if (cache.promise === null) {
    cache.promise = mongooseDefault.connect(uri, {
      // Fail fast rather than hold a serverless invocation open for 30s.
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Let the next request try again instead of caching a failure forever.
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

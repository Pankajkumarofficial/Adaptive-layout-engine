import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectToDatabase } from './db.js';
import { loadDotenv, loadEnv } from './env.js';

const envFiles = loadDotenv();
const env = loadEnv();

async function main(): Promise<void> {
  if (envFiles.length > 0) console.log(`[api] config from ${envFiles.join(', ')}`);
  await connectToDatabase(env.MONGODB_URI);
  console.log('[api] connected to mongo');

  const server = createApp(env).listen(env.PORT, () => {
    console.log(`[api] listening on :${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[api] ${signal} received, closing`);
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// A rejected bootstrap must exit loudly rather than leave a half-started
// process holding the port.
main().catch((err: unknown) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenvFile } from 'dotenv';
import { z } from 'zod';

/**
 * Reads a `.env` before the schema runs.
 *
 * npm workspaces run scripts with the cwd set to the workspace, so a file at
 * the repo root would otherwise be invisible. Both placements are accepted and
 * the workspace-local one wins, because dotenv never overwrites a key that is
 * already set.
 */
export function loadDotenv(cwd: string = process.cwd()): string[] {
  const candidates = [resolve(cwd, '.env'), resolve(cwd, '..', '..', '.env')];
  const used: string[] = [];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    loadDotenvFile({ path });
    used.push(path);
  }
  return used;
}

/**
 * Environment is validated once, at boot, so a missing secret is a startup
 * failure with a clear message rather than a 500 at 3am.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/adaptive-layout-engine'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * Set this only when the frontend and the API are on different sites, which
   * forces SameSite=None. Served from one Vercel project they share an origin,
   * so the default keeps the stricter Lax.
   */
  COOKIE_CROSS_SITE: z.coerce.boolean().default(false),
  ASSET_STORAGE: z.enum(['disk']).default('disk'),
  /**
   * Serverless filesystems are read-only except for /tmp, so the default has
   * to move there when we are running as a function. Uploads are ephemeral in
   * that case, which is stated in the README rather than hidden.
   */
  UPLOAD_DIR: z.string().default(process.env.VERCEL === undefined ? 'uploads' : '/tmp/uploads'),
  /** True when running as a serverless function rather than a listening server. */
  SERVERLESS: z.coerce.boolean().default(process.env.VERCEL !== undefined),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment:\n  ${detail}`);
  }
  return parsed.data;
}

/** Seven days in ms, matching the default token lifetime. */
export const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const AUTH_COOKIE = 'ale_token';

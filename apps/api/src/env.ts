import { z } from 'zod';

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
  ASSET_STORAGE: z.enum(['disk']).default('disk'),
  UPLOAD_DIR: z.string().default('uploads'),
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

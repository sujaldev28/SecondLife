import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const vercelDefaultBaseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;

const defaultAppUrl = vercelDefaultBaseUrl ?? 'http://localhost:3000';
const defaultApiUrl = vercelDefaultBaseUrl ?? 'http://localhost:4000';
const defaultCorsOrigins = vercelDefaultBaseUrl ?? 'http://localhost:3000';
const defaultGoogleCallbackUrl = `${defaultApiUrl}/api/v1/auth/google/callback`;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default(defaultAppUrl),
  API_URL: z.string().url().default(defaultApiUrl),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default(defaultCorsOrigins),
  TRUST_PROXY: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DATABASE_URL: z.string().min(1).default('pglite://./.data/pglite'),
  DATABASE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  REDIS_URL: z.string().optional().default(''),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default('dev-secondlife-access-secret-key-min-32-chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('dev-secondlife-refresh-secret-key-min-32-chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).default(604800),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  INTERNAL_SERVICE_TOKEN: z.string().default('dev-internal-ai-service-token'),
  DEMO_MODE_ENABLED: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default(defaultGoogleCallbackUrl),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./.data/storage'),
  GITHUB_TOKEN: z.string().optional().default(''),
  GITLAB_TOKEN: z.string().optional().default(''),
  BITBUCKET_TOKEN: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().email().default('no-reply@secondlife.local'),
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  AI_MAX_ARCHIVE_BYTES: z.coerce.number().int().default(52_428_800),
  AI_ANALYSIS_TIMEOUT_SECONDS: z.coerce.number().int().default(45),
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production') {
  if (
    parsed.JWT_ACCESS_SECRET.startsWith('dev-') ||
    parsed.JWT_REFRESH_SECRET.startsWith('dev-')
  ) {
    throw new Error('Production environment requires non-default JWT secrets');
  }
}

export const env = parsed;

/**
 * Resolves the public application base URL for email links and OAuth redirects.
 * Honors explicit `APP_URL` env configuration; otherwise derives from the incoming
 * Vercel / reverse-proxy host before falling back to `env.APP_URL`.
 */
export function resolvePublicAppUrl(req?: {
  get(name: string): string | undefined;
  protocol?: string;
}): string {
  if (process.env.APP_URL?.trim()) {
    return env.APP_URL.replace(/\/+$/, '');
  }
  const forwardedHost = req?.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req?.get('host')?.trim();
  if (host && (process.env.VERCEL === '1' || vercelDefaultBaseUrl)) {
    const proto = req?.get('x-forwarded-proto')?.split(',')[0]?.trim() || req?.protocol || 'https';
    return `${proto}://${host}`;
  }
  return env.APP_URL.replace(/\/+$/, '');
}

/**
 * Resolves the Google OAuth callback URL, honoring explicit `GOOGLE_OAUTH_REDIRECT_URI`
 * or deriving from the public request origin on Vercel.
 */
export function resolveGoogleOAuthRedirectUri(req?: {
  get(name: string): string | undefined;
  protocol?: string;
}): string {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()) {
    return env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  if (process.env.VERCEL === '1' || vercelDefaultBaseUrl) {
    return `${resolvePublicAppUrl(req)}/api/v1/auth/google/callback`;
  }
  return env.GOOGLE_OAUTH_REDIRECT_URI;
}

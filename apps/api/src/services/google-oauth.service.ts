import crypto from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../config/env.js';
import { getDb } from '../db/client.js';
import { oauthStates } from '../db/schema.js';
import { generateSecureToken, sha256Hex } from '../utils/crypto.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

let remoteJwks: JWTVerifyGetKey | null = null;

function getGoogleJwks(): JWTVerifyGetKey {
  if (!remoteJwks) {
    remoteJwks = createRemoteJWKSet(GOOGLE_JWKS_URL);
  }
  return remoteJwks;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Prevents open redirects after OAuth callbacks by allowing only safe relative paths.
 */
export function sanitizeRedirectPath(candidate: string | undefined, fallback = '/dashboard/owner'): string {
  if (!candidate || typeof candidate !== 'string') return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return fallback;
  }
  return trimmed;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createGoogleAuthStartUrl(redirectPath?: string): Promise<string> {
  if (!isGoogleOAuthConfigured()) {
    throw new BadRequestError('Google OAuth is not configured on this server');
  }

  const statePlain = generateSecureToken(24);
  const noncePlain = generateSecureToken(24);
  const codeVerifier = toBase64Url(crypto.randomBytes(32));
  const codeChallenge = toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  const safeRedirect = sanitizeRedirectPath(redirectPath);

  const db = await getDb();
  await db.insert(oauthStates).values({
    provider: 'google',
    stateHash: sha256Hex(statePlain),
    nonce: noncePlain,
    codeVerifier,
    redirectPath: safeRedirect,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: statePlain,
    nonce: noncePlain,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function consumeOAuthState(statePlain: string) {
  if (!statePlain) {
    throw new BadRequestError('Missing OAuth state parameter');
  }
  const db = await getDb();
  const stateHash = sha256Hex(statePlain);
  const record = await db.query.oauthStates.findFirst({
    where: and(
      eq(oauthStates.provider, 'google'),
      eq(oauthStates.stateHash, stateHash),
      isNull(oauthStates.usedAt),
      gt(oauthStates.expiresAt, new Date()),
    ),
  });

  if (!record) {
    throw new UnauthorizedError('Invalid or expired OAuth state');
  }

  await db
    .update(oauthStates)
    .set({ usedAt: new Date() })
    .where(eq(oauthStates.id, record.id));

  return record;
}

export async function exchangeGoogleCodeForIdToken(
  code: string,
  codeVerifier: string,
): Promise<{ idToken: string }> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new UnauthorizedError(`Google token exchange failed (${resp.status})`);
  }

  const json = (await resp.json()) as { id_token?: string };
  if (!json.id_token) {
    throw new UnauthorizedError('Google response missing OIDC id_token');
  }
  return { idToken: json.id_token };
}

export interface VerifiedGoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
  customKeyResolver?: JWTVerifyGetKey,
  expectedAudience = env.GOOGLE_OAUTH_CLIENT_ID,
): Promise<VerifiedGoogleClaims> {
  if (!expectedAudience) {
    throw new UnauthorizedError('Google OAuth client ID is not configured');
  }

  const keyResolver = customKeyResolver ?? getGoogleJwks();
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(idToken, keyResolver, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: expectedAudience,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch (err) {
    throw new UnauthorizedError(`Google ID token verification failed: ${(err as Error).message}`);
  }

  if (payload.nonce !== expectedNonce) {
    throw new UnauthorizedError('Google ID token nonce mismatch');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email.split('@')[0];

  if (!sub || !email) {
    throw new UnauthorizedError('Google ID token missing required identity claims');
  }

  if (!emailVerified) {
    throw new UnauthorizedError('Google account email is not verified');
  }

  return { sub, email, emailVerified, name };
}

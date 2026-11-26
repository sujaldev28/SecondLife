import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import { closeDb, getDb, resetDbForTesting, type Database } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { DEMO_SAMPLE_PASSWORD } from '../services/demo.service.js';
import {
  consumeOAuthState,
  createGoogleAuthStartUrl,
  sanitizeRedirectPath,
  verifyGoogleIdToken,
} from '../services/google-oauth.service.js';
import { generateSecureToken, sha256Hex } from '../utils/crypto.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  env.DEMO_MODE_ENABLED = true;
  const client = new PGlite();
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Database;
  resetDbForTesting(db, client);
  await runMigrations();
  await seedDatabase();
  app = createApp();
});

afterAll(async () => {
  await closeDb();
});

describe('1. Registration Validation & Email Verification', () => {
  it('registers a user cleanly, enforces password/email rules, detects duplicates, and verifies email', async () => {
    const weakPw = await request(app).post('/api/v1/auth/register').send({
      email: 'weak@example.com',
      password: 'weak',
      confirmPassword: 'weak',
      fullName: 'Weak User',
    });
    expect(weakPw.status).toBe(400);

    const mismatch = await request(app).post('/api/v1/auth/register').send({
      email: 'mismatch@example.com',
      password: 'ValidPassword@123',
      confirmPassword: 'DifferentPassword@123',
      fullName: 'Mismatch User',
    });
    expect(mismatch.status).toBe(400);

    const badEmail = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      fullName: 'Bad Email',
    });
    expect(badEmail.status).toBe(400);

    const ok = await request(app).post('/api/v1/auth/register').send({
      email: 'customer.one@example.com',
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      fullName: 'Customer One',
      accountType: 'individual',
      role: 'individual_owner',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.user.emailVerified).toBe(false);

    const dup = await request(app).post('/api/v1/auth/register').send({
      email: 'CUSTOMER.ONE@example.com',
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      fullName: 'Duplicate User',
    });
    expect(dup.status).toBe(409);

    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: ok.body.devVerificationToken });
    expect(verify.status).toBe(200);
    expect(verify.body.verified).toBe(true);
  });
});

describe('2. Sign In, Session Lifecycle, Brute Force, Password Recovery & Disabled Accounts', () => {
  it('handles valid login, session persistence, token refresh, immediate logout invalidation, and password reset', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer.one@example.com',
      password: 'ValidPassword@123',
    });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = login.body;

    // Session persistence
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('customer.one@example.com');

    // Refresh token rotation
    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // Logout immediately invalidates session and rejects subsequent access token use
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`);
    expect(logout.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`);
    expect(afterLogout.status).toBe(401);

    // Forgot & Reset Password
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'customer.one@example.com' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.devResetToken).toBeTruthy();

    // Unknown email returns identical generic message (enumeration protection)
    const unknownForgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(unknownForgot.status).toBe(200);
    expect(unknownForgot.body.message).toBe(forgot.body.message);

    const reset = await request(app).post('/api/v1/auth/reset-password').send({
      token: forgot.body.devResetToken,
      newPassword: 'RotatedPassword@456',
    });
    expect(reset.status).toBe(200);

    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer.one@example.com',
      password: 'RotatedPassword@456',
    });
    expect(newLogin.status).toBe(200);
  });

  it('rejects invalid credentials, locks after repeated failures, rejects expired sessions and disabled accounts', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'locktest@example.com',
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      fullName: 'Lock Test',
    });

    for (let i = 0; i < 4; i++) {
      const bad = await request(app).post('/api/v1/auth/login').send({
        email: 'locktest@example.com',
        password: 'WrongPassword@999',
      });
      expect(bad.status).toBe(401);
    }

    // 5th consecutive failure triggers brute-force lockout
    const fifth = await request(app).post('/api/v1/auth/login').send({
      email: 'locktest@example.com',
      password: 'WrongPassword@999',
    });
    expect(fifth.status).toBe(401);

    const lockedAttempt = await request(app).post('/api/v1/auth/login').send({
      email: 'locktest@example.com',
      password: 'ValidPassword@123',
    });
    expect(lockedAttempt.status).toBe(429);

    // Expired session rejection
    const okLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer.one@example.com',
      password: 'RotatedPassword@456',
    });
    const db = await getDb();
    const userRow = await db.query.users.findFirst({
      where: eq(schema.users.email, 'customer.one@example.com'),
    });
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(schema.sessions.userId, userRow!.id));

    const expiredAccess = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${okLogin.body.accessToken}`);
    expect(expiredAccess.status).toBe(401);

    // Disabled account rejection
    await db
      .update(schema.users)
      .set({ accountStatus: 'suspended' })
      .where(eq(schema.users.id, userRow!.id));
    const disabledLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer.one@example.com',
      password: 'RotatedPassword@456',
    });
    expect(disabledLogin.status).toBe(401);
  });
});

describe('3. Google OAuth 2.0 / OIDC Security & Flows', () => {
  it('validates Google OIDC RS256 signature, issuer, audience, expiry, nonce, OAuth state, redirects & callbacks', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = 'test-google-kid';
    publicJwk.alg = 'RS256';
    const localJwks = createLocalJWKSet({ keys: [publicJwk] });

    const testClientId = 'test-google-client.apps.googleusercontent.com';

    // Valid token verification
    const validJwt = await new SignJWT({
      sub: 'google-sub-12345',
      email: 'google.user@example.com',
      email_verified: true,
      name: 'Google Tester',
      nonce: 'nonce-abc-123',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-google-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience(testClientId)
      .setExpirationTime('10m')
      .sign(privateKey);

    const claims = await verifyGoogleIdToken(validJwt, 'nonce-abc-123', localJwks, testClientId);
    expect(claims.email).toBe('google.user@example.com');
    expect(claims.sub).toBe('google-sub-12345');

    // Nonce mismatch rejected
    await expect(
      verifyGoogleIdToken(validJwt, 'wrong-nonce', localJwks, testClientId),
    ).rejects.toThrow(/nonce mismatch/i);

    // Wrong audience rejected
    await expect(
      verifyGoogleIdToken(validJwt, 'nonce-abc-123', localJwks, 'other-client-id'),
    ).rejects.toThrow(/verification failed/i);

    // Expired ID token rejected
    const expiredJwt = await new SignJWT({
      sub: 'google-sub-12345',
      email: 'google.user@example.com',
      email_verified: true,
      nonce: 'nonce-abc-123',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-google-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience(testClientId)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    await expect(
      verifyGoogleIdToken(expiredJwt, 'nonce-abc-123', localJwks, testClientId),
    ).rejects.toThrow(/verification failed/i);

    // OAuth state creation, single-use consumption, replay rejection, and open-redirect sanitization
    expect(sanitizeRedirectPath('//evil.com')).toBe('/dashboard/owner');
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/dashboard/owner');
    expect(sanitizeRedirectPath('/dashboard/buyer')).toBe('/dashboard/buyer');

    const prevId = env.GOOGLE_OAUTH_CLIENT_ID;
    const prevSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
    env.GOOGLE_OAUTH_CLIENT_ID = testClientId;
    env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';

    const authUrl = await createGoogleAuthStartUrl('/dashboard/buyer');
    const parsedUrl = new URL(authUrl);
    const stateParam = parsedUrl.searchParams.get('state')!;
    expect(stateParam).toBeTruthy();

    const consumed = await consumeOAuthState(stateParam);
    expect(consumed.redirectPath).toBe('/dashboard/buyer');

    // Replaying same state must fail
    await expect(consumeOAuthState(stateParam)).rejects.toThrow(/Invalid or expired OAuth state/);

    // Invalid state callback redirects cleanly with oauth_error=failed
    const invalidCb = await request(app).get('/api/v1/auth/google/callback?code=fake&state=nonexistent');
    expect(invalidCb.status).toBe(302);
    expect(invalidCb.headers.location).toContain('oauth_error=failed');

    // Cancelled OAuth callback redirects cleanly with oauth_error=cancelled
    const cancelCb = await request(app).get('/api/v1/auth/google/callback?error=access_denied');
    expect(cancelCb.status).toBe(302);
    expect(cancelCb.headers.location).toContain('oauth_error=cancelled');

    // Missing callback parameters
    const emptyCb = await request(app).get('/api/v1/auth/google/callback');
    expect(emptyCb.status).toBe(302);
    expect(emptyCb.headers.location).toContain('oauth_error=invalid_callback');

    env.GOOGLE_OAUTH_CLIENT_ID = prevId;
    env.GOOGLE_OAUTH_CLIENT_SECRET = prevSecret;
  });

  it('provisions new user on Google login and safely links existing verified email accounts', async () => {
    const db = await getDb();
    // Pre-register a local user with matching email
    await request(app).post('/api/v1/auth/register').send({
      email: 'linktarget@example.com',
      password: 'ValidPassword@123',
      confirmPassword: 'ValidPassword@123',
      fullName: 'Link Target',
    });

    // Simulate verified OAuth state + token verification via direct service call against DB
    const { provisionGoogleUserAndSession } = await import('../modules/auth/auth.routes.js');
    const mockReq = { ip: '127.0.0.1', get: () => 'vitest' } as unknown as import('express').Request;
    const mockRes = { cookie: () => {} } as unknown as import('express').Response;

    const linked = await provisionGoogleUserAndSession(
      { sub: 'google-link-sub-1', email: 'linktarget@example.com', emailVerified: true, name: 'Link Target' },
      mockReq,
      mockRes,
    );
    expect(linked.user.email).toBe('linktarget@example.com');
    expect(linked.accessToken).toBeTruthy();

    const updatedUser = await db.query.users.findFirst({
      where: eq(schema.users.email, 'linktarget@example.com'),
    });
    expect(updatedUser?.authProvider).toBe('hybrid');
    expect(updatedUser?.emailVerified).toBe(true);

    // Brand new Google user provisioning
    const brandNew = await provisionGoogleUserAndSession(
      { sub: 'google-new-sub-2', email: 'brandnew.google@example.com', emailVerified: true, name: 'Brand New' },
      mockReq,
      mockRes,
    );
    expect(brandNew.user.email).toBe('brandnew.google@example.com');
    expect(brandNew.user.authProvider).toBe('google');
  });
});

describe('4. Fictional Demo Accounts, RBAC, Isolation & Repeatable Seed', () => {
  it('authenticates all 5 demo accounts with correct roles/permissions and isolates demo data & real payments', async () => {
    // Repeatable seed verification: running seedDatabase again must not fail or duplicate users
    await seedDatabase();
    const db = await getDb();
    const demoUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isDemoAccount, true));
    expect(demoUsers.length).toBe(5);

    const cfg = await request(app).get('/api/v1/auth/config');
    expect(cfg.status).toBe(200);
    expect(cfg.body.demoModeEnabled).toBe(true);
    expect(cfg.body.demoAccounts).toHaveLength(5);

    const loginDemo = async (email: string) =>
      request(app).post('/api/v1/auth/login').send({ email, password: DEMO_SAMPLE_PASSWORD });

    const [aliceRes, bobRes, charlieRes, dianaRes, ethanRes] = await Promise.all([
      loginDemo('alice@demo.secondlife.test'),
      loginDemo('bob@demo.secondlife.test'),
      loginDemo('charlie@demo.secondlife.test'),
      loginDemo('diana@demo.secondlife.test'),
      loginDemo('ethan@demo.secondlife.test'),
    ]);

    expect(aliceRes.body.user.primaryRole).toBe('individual_owner');
    expect(bobRes.body.user.primaryRole).toBe('buyer');
    expect(charlieRes.body.user.primaryRole).toBe('developer');
    expect(dianaRes.body.user.primaryRole).toBe('org_admin');
    expect(ethanRes.body.user.primaryRole).toBe('platform_admin');

    // Alice can create her own demo asset, cannot access admin overview
    const aliceAsset = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${aliceRes.body.accessToken}`)
      .send({
        name: 'Alice Demo Utility',
        description: 'Demo software module created by Alice Morgan in demo mode.',
        assetType: 'developer_tool',
        categorySlug: 'developer-tools',
        primaryLanguage: 'TypeScript',
      });
    expect(aliceAsset.status).toBe(201);
    expect(aliceAsset.body.asset.isDemoSeed).toBe(true);

    const aliceAdmin = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${aliceRes.body.accessToken}`);
    expect(aliceAdmin.status).toBe(403);

    // Bob can save assets & submit buyer requirements, cannot create assets
    const bobAssetFail = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${bobRes.body.accessToken}`)
      .send({
        name: 'Bob Unauthorized Asset',
        description: 'Buyers should not create assets.',
        assetType: 'developer_tool',
        categorySlug: 'developer-tools',
      });
    expect(bobAssetFail.status).toBe(403);

    const bobReq = await request(app)
      .post('/api/v1/buyer/requirements')
      .set('Authorization', `Bearer ${bobRes.body.accessToken}`)
      .send({
        title: 'Bob Demo Sourcing Requirement',
        description: 'Looking for TypeScript FinTech modules in demo environment.',
        requiredTechnologies: ['TypeScript'],
      });
    expect(bobReq.status).toBe(201);

    // Charlie (developer) can read Northstar Demo Labs assets & trigger analysis, cannot manage org team
    const charlieAssets = await request(app)
      .get('/api/v1/assets')
      .set('Authorization', `Bearer ${charlieRes.body.accessToken}`);
    expect(charlieAssets.status).toBe(200);
    expect(charlieAssets.body.assets.length).toBeGreaterThanOrEqual(1);

    const charlieInviteFail = await request(app)
      .post(`/api/v1/organizations/${charlieRes.body.user.activeOrganizationId}/invitations`)
      .set('Authorization', `Bearer ${charlieRes.body.accessToken}`)
      .send({ email: 'someone@example.com', role: 'developer' });
    expect(charlieInviteFail.status).toBe(403);

    // Diana (org_admin) manages Northstar Demo Labs members
    const dianaMembers = await request(app)
      .get(`/api/v1/organizations/${dianaRes.body.user.activeOrganizationId}/members`)
      .set('Authorization', `Bearer ${dianaRes.body.accessToken}`);
    expect(dianaMembers.status).toBe(200);
    expect(dianaMembers.body.members.length).toBe(2);

    // Ethan (platform_admin in demo) sees ONLY demo users in /admin/users (demo data isolation)
    const ethanUsers = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${ethanRes.body.accessToken}`);
    expect(ethanUsers.status).toBe(200);
    expect(ethanUsers.body.users.every((u: { isDemoAccount: boolean }) => u.isDemoAccount === true)).toBe(true);

    // Ethan cannot modify production system settings
    const ethanSettingsFail = await request(app)
      .put('/api/v1/admin/settings/pricing.commission_bps')
      .set('Authorization', `Bearer ${ethanRes.body.accessToken}`)
      .send({ settingValue: { non_exclusive_license: 0 } });
    expect(ethanSettingsFail.status).toBe(403);

    // Bob (demo buyer) cannot initiate real payment transactions
    const bobTxnBlocked = await request(app)
      .post('/api/v1/deals/00000000-0000-4000-8000-000000000001/transactions/initiate')
      .set('Authorization', `Bearer ${bobRes.body.accessToken}`)
      .send({ idempotencyKey: 'demo-blocked-txn' });
    expect(bobTxnBlocked.status).toBe(403);

    // Disable demo mode -> config hides demo credentials AND demo login is blocked!
    env.DEMO_MODE_ENABLED = false;
    const disabledCfg = await request(app).get('/api/v1/auth/config');
    expect(disabledCfg.body.demoModeEnabled).toBe(false);
    expect(disabledCfg.body.demoAccounts).toHaveLength(0);

    const blockedDemoLogin = await loginDemo('alice@demo.secondlife.test');
    expect(blockedDemoLogin.status).toBe(403);

    // Production default check (NODE_ENV=production without explicit DEMO_MODE_ENABLED=true)
    const prevEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    env.DEMO_MODE_ENABLED = undefined;
    const prodCfg = await request(app).get('/api/v1/auth/config');
    expect(prodCfg.body.demoModeEnabled).toBe(false);
    expect(prodCfg.body.demoAccounts).toHaveLength(0);
    env.NODE_ENV = prevEnv;
    env.DEMO_MODE_ENABLED = true;
  });
});

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { loginSchema, registerSchema } from '@secondlife/shared';
import { env, resolveGoogleOAuthRedirectUri, resolvePublicAppUrl } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import {
  emailTokens,
  oauthAccounts,
  organizationMembers,
  organizations,
  sessions,
  subscriptionPlans,
  subscriptions,
  users,
  workspaces,
} from '../../db/schema.js';
import { requireAuth } from '../../middleware/auth.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { DEMO_ACCOUNTS, isDemoModeEnabled } from '../../services/demo.service.js';
import { sendEmail } from '../../services/email.service.js';
import {
  consumeOAuthState,
  createGoogleAuthStartUrl,
  exchangeGoogleCodeForIdToken,
  isGoogleOAuthConfigured,
  sanitizeRedirectPath,
  verifyGoogleIdToken,
  type VerifiedGoogleClaims,
} from '../../services/google-oauth.service.js';
import { generateSecureToken, sha256Hex, slugify } from '../../utils/crypto.js';
import {
  AppError,
  asyncHandler,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/errors.js';

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function signAccessToken(payload: {
  userId: string;
  sessionId: string;
  orgId?: string | null;
  wsId?: string | null;
}): string {
  return jwt.sign(
    {
      sub: payload.userId,
      sid: payload.sessionId,
      orgId: payload.orgId ?? null,
      wsId: payload.wsId ?? null,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
  );
}

function setAuthCookies(
  res: import('express').Response,
  accessToken: string,
  refreshToken: string,
): void {
  res.cookie('sl_access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
    path: '/',
  });
  res.cookie('sl_refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
    path: '/api/v1/auth',
  });
}

async function createSessionForUser(
  userId: string,
  req: import('express').Request,
  res: import('express').Response,
) {
  const db = await getDb();
  const membership = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')),
  });
  const defaultWs = membership
    ? await db.query.workspaces.findFirst({
        where: eq(workspaces.organizationId, membership.organizationId),
      })
    : null;

  const refreshTokenPlain = generateSecureToken(32);
  const refreshTokenHash = sha256Hex(refreshTokenPlain);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      refreshTokenHash,
      activeOrgId: membership?.organizationId ?? null,
      activeWorkspaceId: defaultWs?.id ?? null,
      userAgent: req.get('user-agent') ?? null,
      ipAddress: req.ip ?? null,
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    })
    .returning();

  const accessToken = signAccessToken({
    userId,
    sessionId: session.id,
    orgId: membership?.organizationId ?? null,
    wsId: defaultWs?.id ?? null,
  });

  setAuthCookies(res, accessToken, refreshTokenPlain);

  return {
    session,
    accessToken,
    refreshToken: refreshTokenPlain,
    organizationId: membership?.organizationId ?? null,
    workspaceId: defaultWs?.id ?? null,
  };
}

export async function provisionGoogleUserAndSession(
  claims: VerifiedGoogleClaims,
  req: import('express').Request,
  res: import('express').Response,
) {
  const db = await getDb();

  // 1. Check existing OAuth link
  const existingLink = await db.query.oauthAccounts.findFirst({
    where: and(
      eq(oauthAccounts.provider, 'google'),
      eq(oauthAccounts.providerAccountId, claims.sub),
    ),
  });

  let userRecord = existingLink
    ? await db.query.users.findFirst({ where: eq(users.id, existingLink.userId) })
    : await db.query.users.findFirst({ where: eq(users.email, claims.email) });

  if (userRecord) {
    if (userRecord.accountStatus !== 'active') {
      throw new ForbiddenError('Account is deactivated or suspended');
    }
    if (userRecord.isDemoAccount) {
      throw new ForbiddenError('Demo accounts cannot be linked to external OAuth identities');
    }

    if (!existingLink) {
      await db.transaction(async (tx) => {
        await tx.insert(oauthAccounts).values({
          userId: userRecord!.id,
          provider: 'google',
          providerAccountId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
        });
        await tx
          .update(users)
          .set({
            emailVerified: true,
            emailVerifiedAt: userRecord!.emailVerifiedAt ?? new Date(),
            authProvider: userRecord!.passwordHash ? 'hybrid' : 'google',
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, userRecord!.id));
      });
    } else {
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userRecord.id));
    }
  } else {
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: claims.email,
          passwordHash: null,
          fullName: claims.name,
          primaryRole: 'individual_owner',
          authProvider: 'google',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        })
        .returning();

      await tx.insert(oauthAccounts).values({
        userId: user.id,
        provider: 'google',
        providerAccountId: claims.sub,
        email: claims.email,
        emailVerified: claims.emailVerified,
      });

      const orgName = `${claims.name} Workspace`;
      const baseSlug = slugify(orgName) || 'workspace';
      const [org] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          slug: `${baseSlug}-${user.id.slice(0, 6)}`,
          orgType: 'individual',
          ownerUserId: user.id,
          isPersonal: true,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: 'individual_owner',
        status: 'active',
      });

      await tx.insert(workspaces).values({
        organizationId: org.id,
        name: 'Default Workspace',
        slug: 'default',
        isDefault: true,
      });

      const starterPlan = await tx.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.code, 'starter_free'),
      });
      if (starterPlan) {
        await tx.insert(subscriptions).values({
          organizationId: org.id,
          planId: starterPlan.id,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }

      return user;
    });

    userRecord = created;
  }

  const sessionData = await createSessionForUser(userRecord.id, req, res);

  await recordAuditLog({
    actorUserId: userRecord.id,
    organizationId: sessionData.organizationId,
    action: 'auth.google_login',
    resourceType: 'session',
    resourceId: sessionData.session.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return { user: userRecord, ...sessionData };
}

// Public Auth Capabilities (single source of truth for demo mode & OAuth availability)
authRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const demoEnabled = isDemoModeEnabled();
    res.json({
      demoModeEnabled: demoEnabled,
      googleOAuthEnabled: isGoogleOAuthConfigured(),
      demoAccounts: demoEnabled
        ? DEMO_ACCOUNTS.map((d) => ({
            fullName: d.fullName,
            email: d.email,
            password: d.password,
            role: d.role,
            roleLabel: d.roleLabel,
            description: d.description,
          }))
        : [],
    });
  }),
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const db = await getDb();
    const normalizedEmail = input.email.toLowerCase();

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const verifyTokenPlain = generateSecureToken(24);
    const verifyTokenHash = sha256Hex(verifyTokenPlain);

    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash,
          fullName: input.fullName,
          primaryRole: input.role,
          authProvider: 'local',
          emailVerified: false,
        })
        .returning();

      const orgName =
        input.accountType === 'organization' && input.organizationName
          ? input.organizationName
          : `${input.fullName} Workspace`;
      const baseSlug = slugify(orgName) || 'workspace';
      const uniqueSlug = `${baseSlug}-${user.id.slice(0, 6)}`;

      const [org] = await tx
        .insert(organizations)
        .values({
          name: orgName,
          slug: uniqueSlug,
          orgType: input.accountType === 'organization' ? 'startup' : 'individual',
          ownerUserId: user.id,
          isPersonal: input.accountType === 'individual',
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: input.accountType === 'organization' ? 'org_owner' : input.role,
        status: 'active',
      });

      const [ws] = await tx
        .insert(workspaces)
        .values({
          organizationId: org.id,
          name: 'Default Workspace',
          slug: 'default',
          isDefault: true,
        })
        .returning();

      const starterPlan = await tx.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.code, 'starter_free'),
      });
      if (starterPlan) {
        await tx.insert(subscriptions).values({
          organizationId: org.id,
          planId: starterPlan.id,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
      }

      await tx.insert(emailTokens).values({
        userId: user.id,
        tokenType: 'email_verify',
        tokenHash: verifyTokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return { user, org, ws };
    });

    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your SecondLife account',
      text: `Welcome to SecondLife, ${input.fullName}. Verify your email at ${resolvePublicAppUrl(req)}/verify-email?token=${verifyTokenPlain}`,
    });

    await recordAuditLog({
      actorUserId: created.user.id,
      organizationId: created.org.id,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: created.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      user: {
        id: created.user.id,
        email: created.user.email,
        fullName: created.user.fullName,
        primaryRole: created.user.primaryRole,
        emailVerified: created.user.emailVerified,
      },
      organization: created.org,
      workspace: created.ws,
      ...(env.NODE_ENV !== 'production' ? { devVerificationToken: verifyTokenPlain } : {}),
    });
  }),
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const db = await getDb();
    const tokenHash = sha256Hex(token);

    const record = await db.query.emailTokens.findFirst({
      where: and(
        eq(emailTokens.tokenHash, tokenHash),
        eq(emailTokens.tokenType, 'email_verify'),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    });

    if (!record) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, record.userId));
      await tx
        .update(emailTokens)
        .set({ usedAt: new Date() })
        .where(eq(emailTokens.id, record.id));
    });

    await recordAuditLog({
      actorUserId: record.userId,
      action: 'auth.email_verified',
      resourceType: 'user',
      resourceId: record.userId,
      ipAddress: req.ip,
    });

    res.json({ verified: true });
  }),
);

authRouter.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const db = await getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    let devVerificationToken: string | undefined;
    if (user && user.accountStatus === 'active' && !user.emailVerified) {
      const plain = generateSecureToken(24);
      devVerificationToken = plain;
      await db.insert(emailTokens).values({
        userId: user.id,
        tokenType: 'email_verify',
        tokenHash: sha256Hex(plain),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await sendEmail({
        to: user.email,
        subject: 'Verify your SecondLife account',
        text: `Verify your email at ${resolvePublicAppUrl(req)}/verify-email?token=${plain}`,
      });
    }

    res.json({
      message: 'If your account requires email verification, a new verification link has been sent.',
      ...(env.NODE_ENV !== 'production' && devVerificationToken ? { devVerificationToken } : {}),
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const db = await getDb();
    const normalizedEmail = input.email.toLowerCase();

    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.isDemoAccount && !isDemoModeEnabled()) {
      await recordAuditLog({
        actorUserId: user.id,
        action: 'auth.demo_login_blocked',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
      });
      throw new ForbiddenError('Demo authentication is disabled in this environment');
    }

    if (user.accountStatus !== 'active') {
      throw new UnauthorizedError('Account is deactivated or suspended');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        429,
        'ACCOUNT_LOCKED',
        'Account temporarily locked due to repeated failed sign-in attempts. Try again later.',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedError(
        'This account uses Google Sign-In. Please continue with Google or reset your password.',
      );
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      const nextFailures = user.failedLoginAttempts + 1;
      const shouldLock = nextFailures >= MAX_FAILED_ATTEMPTS;
      await db
        .update(users)
        .set({
          failedLoginAttempts: nextFailures,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      await recordAuditLog({
        actorUserId: user.id,
        action: shouldLock ? 'auth.account_locked' : 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const sessionData = await createSessionForUser(user.id, req, res);

    await recordAuditLog({
      actorUserId: user.id,
      organizationId: sessionData.organizationId,
      action: user.isDemoAccount ? 'auth.demo_login' : 'auth.login',
      resourceType: 'session',
      resourceId: sessionData.session.id,
      ipAddress: req.ip,
    });

    res.json({
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        primaryRole: user.primaryRole,
        emailVerified: user.emailVerified,
        isDemoAccount: user.isDemoAccount,
        activeOrganizationId: sessionData.organizationId,
        activeWorkspaceId: sessionData.workspaceId,
      },
    });
  }),
);

// Google OAuth 2.0 / OpenID Connect Start
authRouter.get(
  '/google/start',
  asyncHandler(async (req, res) => {
    const redirectTo = sanitizeRedirectPath(
      typeof req.query.redirectTo === 'string' ? req.query.redirectTo : undefined,
    );
    const appUrl = resolvePublicAppUrl(req);
    const redirectUri = resolveGoogleOAuthRedirectUri(req);

    if (!isGoogleOAuthConfigured()) {
      if (req.query.mode === 'json') {
        res.status(503).json({
          error: {
            code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
            message: 'Google OAuth credentials are not configured on this server.',
          },
        });
        return;
      }
      res.redirect(`${appUrl}/login?oauth_error=google_not_configured`);
      return;
    }

    const authUrl = await createGoogleAuthStartUrl(redirectTo, redirectUri);
    if (req.query.mode === 'json') {
      res.json({ authUrl });
      return;
    }
    res.redirect(authUrl);
  }),
);

// Google OAuth 2.0 / OpenID Connect Callback
authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const appUrl = resolvePublicAppUrl(req);
    const redirectUri = resolveGoogleOAuthRedirectUri(req);
    const errorParam = typeof req.query.error === 'string' ? req.query.error : '';
    const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
    const codeParam = typeof req.query.code === 'string' ? req.query.code : '';

    if (errorParam) {
      const code = errorParam === 'access_denied' ? 'cancelled' : 'failed';
      await recordAuditLog({
        action: 'auth.google_oauth_error',
        resourceType: 'oauth',
        ipAddress: req.ip,
        metadata: { error: errorParam },
      });
      res.redirect(`${appUrl}/login?oauth_error=${code}`);
      return;
    }

    if (!codeParam || !stateParam) {
      res.redirect(`${appUrl}/login?oauth_error=invalid_callback`);
      return;
    }

    try {
      const stateRecord = await consumeOAuthState(stateParam);
      const { idToken } = await exchangeGoogleCodeForIdToken(
        codeParam,
        stateRecord.codeVerifier,
        redirectUri,
      );
      const claims = await verifyGoogleIdToken(idToken, stateRecord.nonce);
      const { user } = await provisionGoogleUserAndSession(claims, req, res);

      const fallbackDest =
        user.primaryRole === 'buyer'
          ? '/dashboard/buyer'
          : user.primaryRole === 'platform_admin' || user.primaryRole === 'super_admin'
            ? '/dashboard/admin'
            : '/dashboard/owner';
      const safeTarget = sanitizeRedirectPath(stateRecord.redirectPath, fallbackDest);
      res.redirect(`${appUrl}${safeTarget}`);
    } catch (err) {
      await recordAuditLog({
        action: 'auth.google_oauth_failed',
        resourceType: 'oauth',
        ipAddress: req.ip,
        metadata: { reason: (err as Error).message },
      });
      res.redirect(`${appUrl}/login?oauth_error=failed`);
    }
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token =
      (typeof req.body?.refreshToken === 'string' && req.body.refreshToken) ||
      req.cookies?.sl_refresh_token;
    if (!token) {
      throw new UnauthorizedError('Refresh token missing');
    }

    const db = await getDb();
    const tokenHash = sha256Hex(token);
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.refreshTokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    });

    if (!session) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user || user.accountStatus !== 'active') {
      throw new UnauthorizedError('Account is inactive');
    }
    if (user.isDemoAccount && !isDemoModeEnabled()) {
      throw new ForbiddenError('Demo authentication is disabled');
    }

    const nextRefreshPlain = generateSecureToken(32);
    const nextRefreshHash = sha256Hex(nextRefreshPlain);

    await db
      .update(sessions)
      .set({
        refreshTokenHash: nextRefreshHash,
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
      })
      .where(eq(sessions.id, session.id));

    const accessToken = signAccessToken({
      userId: session.userId,
      sessionId: session.id,
      orgId: session.activeOrgId,
      wsId: session.activeWorkspaceId,
    });

    setAuthCookies(res, accessToken, nextRefreshPlain);
    res.json({ accessToken, refreshToken: nextRefreshPlain });
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, req.auth!.sessionId));

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: req.auth!.sessionId,
      ipAddress: req.ip,
    });

    res.clearCookie('sl_access_token', { path: '/' });
    res.clearCookie('sl_refresh_token', { path: '/api/v1/auth' });
    res.json({ loggedOut: true });
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().trim().email() }).parse(req.body);
    const db = await getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    let devResetToken: string | undefined;
    if (user && user.accountStatus === 'active' && !user.isDemoAccount) {
      const plain = generateSecureToken(24);
      devResetToken = plain;
      await db.insert(emailTokens).values({
        userId: user.id,
        tokenType: 'password_reset',
        tokenHash: sha256Hex(plain),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await sendEmail({
        to: user.email,
        subject: 'SecondLife Password Reset',
        text: `Reset your SecondLife password at ${resolvePublicAppUrl(req)}/reset-password?token=${plain}`,
      });
    }

    res.json({
      message: 'If an account matches that email, password reset instructions have been issued.',
      ...(env.NODE_ENV !== 'production' && devResetToken ? { devResetToken } : {}),
    });
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = z
      .object({
        token: z.string().min(10),
        newPassword: z
          .string()
          .min(10, 'Password must be at least 10 characters')
          .max(128)
          .regex(/[A-Z]/, 'Password must include an uppercase letter')
          .regex(/[a-z]/, 'Password must include a lowercase letter')
          .regex(/[0-9]/, 'Password must include a number')
          .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character'),
      })
      .parse(req.body);

    const db = await getDb();
    const record = await db.query.emailTokens.findFirst({
      where: and(
        eq(emailTokens.tokenHash, sha256Hex(token)),
        eq(emailTokens.tokenType, 'password_reset'),
        isNull(emailTokens.usedAt),
        gt(emailTokens.expiresAt, new Date()),
      ),
    });

    if (!record) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash,
          authProvider: user?.authProvider === 'google' ? 'hybrid' : (user?.authProvider ?? 'local'),
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, record.userId));
      await tx.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, record.id));
      await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, record.userId));
    });

    await recordAuditLog({
      actorUserId: record.userId,
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: record.userId,
      ipAddress: req.ip,
    });

    res.json({ reset: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.auth!.userId),
    });
    if (!user) throw new NotFoundError('User not found');

    const memberships = await db
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        orgType: organizations.orgType,
        role: organizationMembers.role,
        isPersonal: organizations.isPersonal,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.status, 'active')));

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        headline: user.headline,
        bio: user.bio,
        primaryRole: user.primaryRole,
        emailVerified: user.emailVerified,
        isDemoAccount: user.isDemoAccount,
        authProvider: user.authProvider,
        notificationPrefs: user.notificationPrefs,
        createdAt: user.createdAt,
      },
      activeOrganizationId: req.auth!.organizationId,
      activeWorkspaceId: req.auth!.workspaceId,
      permissions: Array.from(req.auth!.permissions),
      organizations: memberships,
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        fullName: z.string().trim().min(2).max(120).optional(),
        headline: z.string().trim().max(200).optional(),
        bio: z.string().trim().max(2000).optional(),
        notificationPrefs: z
          .object({
            emailDeals: z.boolean(),
            emailVerification: z.boolean(),
            emailMarketing: z.boolean(),
          })
          .optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const [updated] = await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, req.auth!.userId))
      .returning();

    res.json({
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        headline: updated.headline,
        bio: updated.bio,
        notificationPrefs: updated.notificationPrefs,
      },
    });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, req.auth!.userId))
      .orderBy(desc(sessions.createdAt))
      .limit(20);

    res.json({ sessions: rows, currentSessionId: req.auth!.sessionId });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, req.params.id), eq(sessions.userId, req.auth!.userId)));
    res.json({ revoked: true });
  }),
);

authRouter.post(
  '/deactivate',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.auth!.isDemoAccount) {
      throw new ForbiddenError('Demo accounts cannot be deactivated via self-service');
    }
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ accountStatus: 'deactivated', deactivatedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, req.auth!.userId));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, req.auth!.userId));
    });
    res.clearCookie('sl_access_token', { path: '/' });
    res.clearCookie('sl_refresh_token', { path: '/api/v1/auth' });
    res.json({ deactivated: true });
  }),
);

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hasPermission, type Permission, resolvePermissions } from '@secondlife/shared';
import { env } from '../config/env.js';
import { getDb } from '../db/client.js';
import { organizationMembers, sessions, users, workspaces } from '../db/schema.js';
import { isDemoModeEnabled } from '../services/demo.service.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  primaryRole: string;
  emailVerified: boolean;
  isDemoAccount: boolean;
  sessionId: string;
  organizationId: string | null;
  workspaceId: string | null;
  orgRole: string | null;
  effectiveRoles: string[];
  permissions: Set<Permission>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface JwtPayload {
  sub: string;
  sid: string;
  orgId?: string | null;
  wsId?: string | null;
  type: 'access' | 'refresh';
}

export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.sl_access_token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

async function buildAuthContext(payload: JwtPayload, requestedOrgId?: string): Promise<AuthContext> {
  const db = await getDb();
  const activeSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, payload.sid),
      eq(sessions.userId, payload.sub),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    ),
  });

  if (!activeSession) {
    throw new UnauthorizedError('Session has expired or been revoked');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (!user || user.accountStatus !== 'active') {
    throw new UnauthorizedError('User account is inactive or unavailable');
  }

  if (user.isDemoAccount && !isDemoModeEnabled()) {
    throw new UnauthorizedError('Demo authentication is disabled in this environment');
  }

  let organizationId: string | null = requestedOrgId ?? payload.orgId ?? null;
  let workspaceId: string | null = payload.wsId ?? null;
  let orgRole: string | null = null;
  let customPerms: string[] = [];

  if (organizationId) {
    // Strictly verify tenant membership server-side; never trust client org ID alone
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    });

    if (!membership) {
      throw new ForbiddenError('You are not an active member of the requested organization');
    }

    orgRole = membership.role;
    customPerms = membership.customPermissions ?? [];

    if (!workspaceId) {
      const defaultWs = await db.query.workspaces.findFirst({
        where: eq(workspaces.organizationId, organizationId),
      });
      workspaceId = defaultWs?.id ?? null;
    }
  } else {
    const firstMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.status, 'active'),
      ),
    });
    if (firstMembership) {
      organizationId = firstMembership.organizationId;
      orgRole = firstMembership.role;
      customPerms = firstMembership.customPermissions ?? [];
      const defaultWs = await db.query.workspaces.findFirst({
        where: eq(workspaces.organizationId, firstMembership.organizationId),
      });
      workspaceId = defaultWs?.id ?? null;
    }
  }

  const effectiveRoles = [user.primaryRole, ...(orgRole ? [orgRole] : [])];
  const permissions = resolvePermissions(effectiveRoles, customPerms);

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    primaryRole: user.primaryRole,
    emailVerified: user.emailVerified,
    isDemoAccount: user.isDemoAccount,
    sessionId: payload.sid,
    organizationId,
    workspaceId,
    orgRole,
    effectiveRoles,
    permissions,
  };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication token missing');
    }
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (decoded.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }

    const headerOrgId =
      typeof req.headers['x-organization-id'] === 'string'
        ? req.headers['x-organization-id'].trim()
        : undefined;

    req.auth = await buildAuthContext(decoded, headerOrgId || undefined);
    next();
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    next(new UnauthorizedError('Invalid or expired session token'));
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractAccessToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (decoded.type === 'access') {
      req.auth = await buildAuthContext(decoded);
    }
  } catch {
    // Public routes ignore invalid optional tokens
  }
  next();
}

export function requirePermission(required: Permission | Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    const ok = hasPermission(
      req.auth.effectiveRoles,
      required,
      Array.from(req.auth.permissions),
    );
    if (!ok) {
      next(new ForbiddenError(`Missing required permission: ${Array.isArray(required) ? required.join(', ') : required}`));
      return;
    }
    next();
  };
}

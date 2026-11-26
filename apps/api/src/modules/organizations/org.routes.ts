import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  createOrganizationSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  ROLES,
} from '@secondlife/shared';
import { env } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import {
  auditLogs,
  organizationInvitations,
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
import { sendEmail } from '../../services/email.service.js';
import { generateSecureToken, sha256Hex, slugify } from '../../utils/crypto.js';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const orgRouter = Router();

async function assertOrgMembership(userId: string, orgId: string, requiredRoles?: string[]) {
  const db = await getDb();
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, 'active'),
    ),
  });
  if (!membership) {
    throw new ForbiddenError('Not a member of this organization');
  }
  if (requiredRoles && !requiredRoles.includes(membership.role)) {
    throw new ForbiddenError('Insufficient organization role for this operation');
  }
  return membership;
}

orgRouter.get(
  '/subscriptions/plans',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));
    res.json({ plans });
  }),
);

orgRouter.get(
  '/organizations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        orgType: organizations.orgType,
        website: organizations.website,
        description: organizations.description,
        verificationStatus: organizations.verificationStatus,
        isPersonal: organizations.isPersonal,
        role: organizationMembers.role,
        createdAt: organizations.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(and(eq(organizationMembers.userId, req.auth!.userId), eq(organizationMembers.status, 'active')));
    res.json({ organizations: rows });
  }),
);

orgRouter.post(
  '/organizations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createOrganizationSchema.parse(req.body);
    const db = await getDb();
    const slug = `${input.slug || slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;

    const created = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.name,
          slug,
          orgType: input.orgType,
          website: input.website || null,
          description: input.description || null,
          ownerUserId: req.auth!.userId,
          isPersonal: false,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: req.auth!.userId,
        role: 'org_owner',
        status: 'active',
      });

      const [ws] = await tx
        .insert(workspaces)
        .values({
          organizationId: org.id,
          name: 'Primary Workspace',
          slug: 'primary',
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

      return { org, ws };
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: created.org.id,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: created.org.id,
      ipAddress: req.ip,
    });

    res.status(201).json(created);
  }),
);

orgRouter.post(
  '/organizations/switch',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { organizationId, workspaceId } = z
      .object({
        organizationId: z.string().uuid(),
        workspaceId: z.string().uuid().optional(),
      })
      .parse(req.body);

    const membership = await assertOrgMembership(req.auth!.userId, organizationId);
    const db = await getDb();

    let resolvedWorkspaceId = workspaceId ?? null;
    if (resolvedWorkspaceId) {
      const ws = await db.query.workspaces.findFirst({
        where: and(eq(workspaces.id, resolvedWorkspaceId), eq(workspaces.organizationId, organizationId)),
      });
      if (!ws) throw new NotFoundError('Workspace not found in this organization');
    } else {
      const defaultWs = await db.query.workspaces.findFirst({
        where: eq(workspaces.organizationId, organizationId),
      });
      resolvedWorkspaceId = defaultWs?.id ?? null;
    }

    await db
      .update(sessions)
      .set({ activeOrgId: organizationId, activeWorkspaceId: resolvedWorkspaceId })
      .where(eq(sessions.id, req.auth!.sessionId));

    const accessToken = jwt.sign(
      {
        sub: req.auth!.userId,
        sid: req.auth!.sessionId,
        orgId: organizationId,
        wsId: resolvedWorkspaceId,
        type: 'access',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_TTL_SECONDS },
    );

    res.cookie('sl_access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
      path: '/',
    });

    res.json({
      accessToken,
      activeOrganizationId: organizationId,
      activeWorkspaceId: resolvedWorkspaceId,
      role: membership.role,
    });
  }),
);

orgRouter.get(
  '/organizations/:orgId/members',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId);
    const db = await getDb();
    const members = await db
      .select({
        memberId: organizationMembers.id,
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        role: organizationMembers.role,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, req.params.orgId));

    const invites = await db
      .select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        expiresAt: organizationInvitations.expiresAt,
      })
      .from(organizationInvitations)
      .where(eq(organizationInvitations.organizationId, req.params.orgId));

    res.json({ members, invitations: invites });
  }),
);

orgRouter.post(
  '/organizations/:orgId/invitations',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId, ['org_owner', 'org_admin']);
    const input = inviteMemberSchema.parse(req.body);
    const db = await getDb();

    const plainToken = generateSecureToken(24);
    const [invite] = await db
      .insert(organizationInvitations)
      .values({
        organizationId: req.params.orgId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash: sha256Hex(plainToken),
        invitedByUserId: req.auth!.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();

    await sendEmail({
      to: input.email,
      subject: 'Invitation to join a SecondLife organization',
      text: `You were invited to join an organization on SecondLife as ${input.role}. Token: ${plainToken}`,
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.params.orgId,
      action: 'organization.member_invited',
      resourceType: 'organization_invitation',
      resourceId: invite.id,
      metadata: { invitedEmail: input.email, role: input.role },
    });

    res.status(201).json({
      invitation: { id: invite.id, email: invite.email, role: invite.role, status: invite.status },
      ...(env.NODE_ENV !== 'production' ? { devInviteToken: plainToken } : {}),
    });
  }),
);

orgRouter.post(
  '/organizations/invitations/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const db = await getDb();
    const invite = await db.query.organizationInvitations.findFirst({
      where: and(
        eq(organizationInvitations.tokenHash, sha256Hex(token)),
        eq(organizationInvitations.status, 'pending'),
      ),
    });
    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestError('Invalid or expired invitation token');
    }
    if (invite.email.toLowerCase() !== req.auth!.email.toLowerCase()) {
      throw new ForbiddenError('This invitation belongs to a different email address');
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(organizationMembers)
        .values({
          organizationId: invite.organizationId,
          userId: req.auth!.userId,
          role: invite.role,
          status: 'active',
        })
        .onConflictDoNothing();
      await tx
        .update(organizationInvitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(organizationInvitations.id, invite.id));
    });

    res.json({ accepted: true, organizationId: invite.organizationId });
  }),
);

orgRouter.patch(
  '/organizations/:orgId/members/:memberId/role',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId, ['org_owner', 'org_admin']);
    const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body);
    const db = await getDb();
    const [updated] = await db
      .update(organizationMembers)
      .set({ role })
      .where(
        and(
          eq(organizationMembers.id, req.params.memberId),
          eq(organizationMembers.organizationId, req.params.orgId),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundError('Organization member not found');

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.params.orgId,
      action: 'organization.role_updated',
      resourceType: 'organization_member',
      resourceId: updated.id,
      metadata: { newRole: role },
    });

    res.json({ member: updated });
  }),
);

orgRouter.get(
  '/organizations/:orgId/workspaces',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId);
    const db = await getDb();
    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.organizationId, req.params.orgId));
    res.json({ workspaces: rows });
  }),
);

orgRouter.post(
  '/organizations/:orgId/workspaces',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId, ['org_owner', 'org_admin']);
    const input = createWorkspaceSchema.parse(req.body);
    const db = await getDb();
    const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const [ws] = await db
      .insert(workspaces)
      .values({
        organizationId: req.params.orgId,
        name: input.name,
        slug,
        description: input.description ?? null,
      })
      .returning();
    res.status(201).json({ workspace: ws });
  }),
);

orgRouter.get(
  '/organizations/:orgId/audit-logs',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId, ['org_owner', 'org_admin']);
    const db = await getDb();
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, req.params.orgId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json({ auditLogs: logs });
  }),
);

orgRouter.get(
  '/organizations/:orgId/subscription',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId);
    const db = await getDb();
    const current = await db
      .select({
        subscriptionId: subscriptions.id,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        planCode: subscriptionPlans.code,
        planName: subscriptionPlans.name,
        monthlyPriceMinor: subscriptionPlans.monthlyPriceMinor,
        maxAssets: subscriptionPlans.maxAssets,
        maxTeamSeats: subscriptionPlans.maxTeamSeats,
        features: subscriptionPlans.features,
      })
      .from(subscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
      .where(eq(subscriptions.organizationId, req.params.orgId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    res.json({ subscription: current[0] ?? null });
  }),
);

orgRouter.post(
  '/organizations/:orgId/subscription',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertOrgMembership(req.auth!.userId, req.params.orgId, ['org_owner', 'org_admin']);
    const { planCode } = z.object({ planCode: z.string().min(2) }).parse(req.body);
    const db = await getDb();
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.code, planCode),
    });
    if (!plan) throw new NotFoundError('Subscription plan not found');

    const [created] = await db
      .insert(subscriptions)
      .values({
        organizationId: req.params.orgId,
        planId: plan.id,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .returning();

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.params.orgId,
      action: 'subscription.updated',
      resourceType: 'subscription',
      resourceId: created.id,
      metadata: { planCode },
    });

    res.status(201).json({ subscription: created, plan });
  }),
);

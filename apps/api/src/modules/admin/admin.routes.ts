import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import {
  analysisJobs,
  assetCategories,
  assets,
  auditLogs,
  deals,
  disputes,
  marketplaceListings,
  notifications,
  organizations,
  systemSettings,
  transactions,
  users,
  verificationRequests,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { ForbiddenError, asyncHandler, NotFoundError } from '../../utils/errors.js';

export const adminRouter = Router();

// User notifications (authenticated)
adminRouter.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.auth!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: rows });
  }),
);

adminRouter.post(
  '/notifications/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, req.params.id));
    res.json({ read: true });
  }),
);

// Platform Administration Endpoints
adminRouter.get(
  '/admin/overview',
  requireAuth,
  requirePermission('admin:overview'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const [userCount, orgCount, assetRows, pendingVerifications, openDisputes, dealRows, txnRows, aiJobs] =
      await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db.select({ count: sql<number>`count(*)::int` }).from(organizations),
        db.select({ status: assets.lifecycleStatus }).from(assets),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(verificationRequests)
          .where(eq(verificationRequests.status, 'pending')),
        db.select({ count: sql<number>`count(*)::int` }).from(disputes).where(eq(disputes.status, 'open')),
        db.select({ status: deals.status }).from(deals),
        db
          .select({
            status: transactions.status,
            gross: transactions.grossAmountMinor,
            commission: transactions.commissionAmountMinor,
          })
          .from(transactions),
        db.select({ status: analysisJobs.status, engineMode: analysisJobs.engineMode }).from(analysisJobs),
      ]);

    const assetsByStatus: Record<string, number> = {};
    for (const r of assetRows) {
      assetsByStatus[r.status] = (assetsByStatus[r.status] || 0) + 1;
    }

    let totalGmvMinor = 0;
    let totalCommissionMinor = 0;
    for (const t of txnRows) {
      if (t.status === 'captured' || t.status === 'settled') {
        totalGmvMinor += Number(t.gross);
        totalCommissionMinor += Number(t.commission);
      }
    }

    res.json({
      metrics: {
        totalUsers: userCount[0]?.count ?? 0,
        totalOrganizations: orgCount[0]?.count ?? 0,
        totalAssets: assetRows.length,
        assetsByStatus,
        pendingVerifications: pendingVerifications[0]?.count ?? 0,
        openDisputes: openDisputes[0]?.count ?? 0,
        totalDeals: dealRows.length,
        totalGmvMinor,
        totalCommissionMinor,
        aiJobsTotal: aiJobs.length,
        aiJobsFailed: aiJobs.filter((j) => j.status === 'failed').length,
      },
    });
  }),
);

adminRouter.get(
  '/admin/users',
  requireAuth,
  requirePermission('admin:users'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        primaryRole: users.primaryRole,
        accountStatus: users.accountStatus,
        emailVerified: users.emailVerified,
        isDemoAccount: users.isDemoAccount,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(req.auth!.isDemoAccount ? eq(users.isDemoAccount, true) : undefined)
      .orderBy(desc(users.createdAt));
    res.json({ users: rows });
  }),
);

adminRouter.patch(
  '/admin/users/:id/status',
  requireAuth,
  requirePermission('admin:users'),
  asyncHandler(async (req, res) => {
    const { accountStatus } = z.object({ accountStatus: z.enum(['active', 'suspended']) }).parse(req.body);
    const db = await getDb();
    const target = await db.query.users.findFirst({ where: eq(users.id, req.params.id) });
    if (!target) throw new NotFoundError('User not found');
    if (req.auth!.isDemoAccount && !target.isDemoAccount) {
      throw new ForbiddenError('Demo admin cannot modify real customer accounts');
    }
    const [updated] = await db
      .update(users)
      .set({ accountStatus, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning();

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'admin.user_status_changed',
      resourceType: 'user',
      resourceId: updated.id,
      metadata: { accountStatus },
    });

    res.json({ user: { id: updated.id, accountStatus: updated.accountStatus } });
  }),
);

adminRouter.get(
  '/admin/organizations',
  requireAuth,
  requirePermission('admin:orgs'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    res.json({ organizations: rows });
  }),
);

adminRouter.get(
  '/admin/assets',
  requireAuth,
  requirePermission('admin:assets'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        asset: assets,
        organizationName: organizations.name,
      })
      .from(assets)
      .innerJoin(organizations, eq(assets.organizationId, organizations.id))
      .where(req.auth!.isDemoAccount ? eq(assets.isDemoSeed, true) : undefined)
      .orderBy(desc(assets.updatedAt));
    res.json({ assets: rows });
  }),
);

adminRouter.get(
  '/admin/marketplace',
  requireAuth,
  requirePermission('marketplace:moderate'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        listing: marketplaceListings,
        assetName: assets.name,
        assetCode: assets.assetCode,
      })
      .from(marketplaceListings)
      .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
      .where(req.auth!.isDemoAccount ? eq(assets.isDemoSeed, true) : undefined)
      .orderBy(desc(marketplaceListings.publishedAt));
    res.json({ listings: rows });
  }),
);

adminRouter.post(
  '/admin/marketplace/:listingId/moderate',
  requireAuth,
  requirePermission('marketplace:moderate'),
  asyncHandler(async (req, res) => {
    const { action, reason } = z
      .object({
        action: z.enum(['approve', 'suspend']),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(req.body);

    const db = await getDb();
    const [updated] = await db
      .update(marketplaceListings)
      .set({
        status: action === 'approve' ? 'active' : 'suspended',
        moderationStatus: action === 'approve' ? 'approved' : 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, req.params.listingId))
      .returning();

    if (!updated) throw new NotFoundError('Listing not found');

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: `marketplace.moderation_${action}`,
      resourceType: 'marketplace_listing',
      resourceId: updated.id,
      metadata: { reason },
    });

    res.json({ listing: updated });
  }),
);

adminRouter.get(
  '/admin/ai-jobs',
  requireAuth,
  requirePermission('admin:ai_monitor'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        job: analysisJobs,
        assetName: assets.name,
      })
      .from(analysisJobs)
      .innerJoin(assets, eq(analysisJobs.assetId, assets.id))
      .orderBy(desc(analysisJobs.createdAt))
      .limit(100);
    res.json({ jobs: rows });
  }),
);

adminRouter.get(
  '/admin/security-events',
  requireAuth,
  requirePermission('admin:security'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(150);
    res.json({ auditLogs: rows });
  }),
);

adminRouter.get(
  '/admin/settings',
  requireAuth,
  requirePermission('admin:settings'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const [settings, categories] = await Promise.all([
      db.select().from(systemSettings),
      db.select().from(assetCategories),
    ]);
    res.json({ settings, categories });
  }),
);

adminRouter.put(
  '/admin/settings/:key',
  requireAuth,
  requirePermission('admin:settings'),
  asyncHandler(async (req, res) => {
    if (req.auth!.isDemoAccount) {
      throw new ForbiddenError('Demo platform admin cannot modify production system settings');
    }
    const { settingValue, description } = z
      .object({
        settingValue: z.unknown(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const [updated] = await db
      .insert(systemSettings)
      .values({
        settingKey: req.params.key,
        settingValue,
        description: description ?? 'Updated via admin console',
        updatedByUserId: req.auth!.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue,
          ...(description ? { description } : {}),
          updatedByUserId: req.auth!.userId,
          updatedAt: new Date(),
        },
      })
      .returning();

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'admin.setting_updated',
      resourceType: 'system_setting',
      resourceId: req.params.key,
    });

    res.json({ setting: updated });
  }),
);

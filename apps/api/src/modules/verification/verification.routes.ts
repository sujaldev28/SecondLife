import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ownershipDeclarationSchema } from '@secondlife/shared';
import { getDb } from '../../db/client.js';
import {
  assetHistory,
  assets,
  contributors,
  disputes,
  licenses,
  marketplaceListings,
  ownershipRecords,
  verificationEvidence,
  verificationRequests,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { createNotification, recordAuditLog } from '../../services/audit.service.js';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const verificationRouter = Router();

const STRONG_COPYLEFT_SPDX = new Set(['GPL-2.0', 'GPL-3.0', 'AGPL-3.0']);

verificationRouter.post(
  '/assets/:id/ownership-declaration',
  requireAuth,
  requirePermission('verification:submit'),
  asyncHandler(async (req, res) => {
    const input = ownershipDeclarationSchema.parse(req.body);
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');
    if (asset.organizationId !== req.auth!.organizationId) {
      throw new ForbiddenError('You may only declare ownership for assets in your organization');
    }

    const declaredSpdx = asset.declaredLicense.toUpperCase();
    const isStrongCopyleft = Array.from(STRONG_COPYLEFT_SPDX).some((id) => declaredSpdx.includes(id));
    const licenseRiskLevel = isStrongCopyleft ? 'high' : input.hasThirdPartyCode ? 'medium' : 'low';

    const result = await db.transaction(async (tx) => {
      const [ownership] = await tx
        .insert(ownershipRecords)
        .values({
          assetId: asset.id,
          claimantUserId: req.auth!.userId,
          organizationId: asset.organizationId,
          claimantType: input.claimantType,
          ownershipPercentage: input.ownershipPercentage,
          hasThirdPartyCode: input.hasThirdPartyCode,
          thirdPartySummary: input.thirdPartySummary ?? null,
          contributorsSummary: input.contributorsSummary ?? null,
          attestationAccepted: true,
          attestedAt: new Date(),
        })
        .returning();

      await tx.insert(licenses).values({
        assetId: asset.id,
        spdxId: asset.declaredLicense.slice(0, 80),
        licenseName: asset.declaredLicense,
        detectedSource: 'declared',
        commercialTransferAllowed: !isStrongCopyleft,
        copyleftRisk: isStrongCopyleft ? 'strong' : 'none',
        notes: isStrongCopyleft
          ? 'Strong copyleft license detected; commercial relicensing requires explicit contributor assignment.'
          : null,
      });

      if (input.contributorsSummary) {
        await tx.insert(contributors).values({
          assetId: asset.id,
          name: input.contributorsSummary.slice(0, 120),
          role: 'declared_contributor_group',
          rightsAssigned: input.claimantType === 'sole_author' || input.claimantType === 'corporate_owner',
          notes: input.contributorsSummary,
        });
      }

      const [verRequest] = await tx
        .insert(verificationRequests)
        .values({
          assetId: asset.id,
          submittedByUserId: req.auth!.userId,
          status: 'pending',
          ipConflictFlag: isStrongCopyleft || input.hasThirdPartyCode,
          licenseRiskLevel,
        })
        .returning();

      await tx.insert(verificationEvidence).values({
        verificationRequestId: verRequest.id,
        evidenceType: 'declaration',
        title: `Ownership Attestation (${input.claimantType})`,
        contentSummary: input.evidenceNotes || 'Signed digital ownership declaration submitted by claimant.',
      });

      const nextLifecycle =
        asset.lifecycleStatus === 'draft' || asset.lifecycleStatus === 'submitted'
          ? 'under_review'
          : asset.lifecycleStatus;

      await tx
        .update(assets)
        .set({
          verificationStatus: 'pending_review',
          lifecycleStatus: nextLifecycle,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, asset.id));

      await tx.insert(assetHistory).values({
        assetId: asset.id,
        actorUserId: req.auth!.userId,
        eventType: 'verification.submitted',
        fromStatus: asset.lifecycleStatus,
        toStatus: nextLifecycle,
        notes: `Ownership declaration submitted (${input.claimantType}); license risk: ${licenseRiskLevel}`,
      });

      return { ownership, verificationRequest: verRequest };
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: asset.organizationId,
      action: 'verification.submitted',
      resourceType: 'verification_request',
      resourceId: result.verificationRequest.id,
      metadata: { assetId: asset.id, licenseRiskLevel },
    });

    res.status(201).json(result);
  }),
);

verificationRouter.get(
  '/assets/:id/verification',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');

    const isReviewer = req.auth!.permissions.has('verification:review');
    if (!isReviewer && asset.organizationId !== req.auth!.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const [ownership, requests, assetLicenses, assetContributors] = await Promise.all([
      db.select().from(ownershipRecords).where(eq(ownershipRecords.assetId, asset.id)).orderBy(desc(ownershipRecords.createdAt)),
      db.select().from(verificationRequests).where(eq(verificationRequests.assetId, asset.id)).orderBy(desc(verificationRequests.createdAt)),
      db.select().from(licenses).where(eq(licenses.assetId, asset.id)),
      db.select().from(contributors).where(eq(contributors.assetId, asset.id)),
    ]);

    res.json({ ownership, verificationRequests: requests, licenses: assetLicenses, contributors: assetContributors });
  }),
);

verificationRouter.get(
  '/verification/queue',
  requireAuth,
  requirePermission('verification:review'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        requestId: verificationRequests.id,
        assetId: assets.id,
        assetCode: assets.assetCode,
        assetName: assets.name,
        declaredLicense: assets.declaredLicense,
        status: verificationRequests.status,
        ipConflictFlag: verificationRequests.ipConflictFlag,
        licenseRiskLevel: verificationRequests.licenseRiskLevel,
        createdAt: verificationRequests.createdAt,
      })
      .from(verificationRequests)
      .innerJoin(assets, eq(verificationRequests.assetId, assets.id))
      .where(req.auth!.isDemoAccount ? eq(assets.isDemoSeed, true) : undefined)
      .orderBy(desc(verificationRequests.createdAt));

    res.json({ queue: rows });
  }),
);

verificationRouter.post(
  '/verification/:requestId/decision',
  requireAuth,
  requirePermission('verification:approve'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        decision: z.enum(['approved', 'rejected', 'changes_requested']),
        reviewerNotes: z.string().trim().min(5).max(2000),
        ipConflictFlag: z.boolean().optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const verReq = await db.query.verificationRequests.findFirst({
      where: eq(verificationRequests.id, req.params.requestId),
    });
    if (!verReq) throw new NotFoundError('Verification request not found');

    const asset = await db.query.assets.findFirst({ where: eq(assets.id, verReq.assetId) });
    if (!asset) throw new NotFoundError('Associated asset not found');
    if (req.auth!.isDemoAccount && !asset.isDemoSeed) {
      throw new ForbiddenError('Demo reviewers cannot approve or reject real customer assets');
    }

    // Legal safeguard: prevent approval when unresolved IP conflict flag is explicitly set true
    if (input.decision === 'approved' && input.ipConflictFlag === true) {
      throw new BadRequestError('Cannot approve verification while IP conflict flag remains active');
    }

    const nextVerificationStatus =
      input.decision === 'approved'
        ? 'verified'
        : input.decision === 'rejected'
          ? 'rejected'
          : 'changes_requested';

    const nextLifecycle =
      input.decision === 'approved'
        ? 'approved'
        : input.decision === 'rejected'
          ? 'rejected'
          : 'verification_required';

    await db.transaction(async (tx) => {
      await tx
        .update(verificationRequests)
        .set({
          status: input.decision,
          assignedReviewerId: req.auth!.userId,
          reviewerNotes: input.reviewerNotes,
          decisionReason: input.reviewerNotes,
          ipConflictFlag: input.ipConflictFlag ?? verReq.ipConflictFlag,
          reviewedAt: new Date(),
        })
        .where(eq(verificationRequests.id, verReq.id));

      await tx
        .update(assets)
        .set({
          verificationStatus: nextVerificationStatus,
          lifecycleStatus: nextLifecycle,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, asset.id));

      await tx.insert(assetHistory).values({
        assetId: asset.id,
        actorUserId: req.auth!.userId,
        eventType: `verification.${input.decision}`,
        fromStatus: asset.lifecycleStatus,
        toStatus: nextLifecycle,
        notes: input.reviewerNotes,
      });
    });

    await createNotification({
      userId: asset.ownerUserId,
      category: 'verification',
      title: `Verification ${input.decision}: ${asset.name}`,
      body: input.reviewerNotes,
      actionUrl: `/dashboard/owner/assets/${asset.id}`,
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: asset.organizationId,
      action: `verification.${input.decision}`,
      resourceType: 'verification_request',
      resourceId: verReq.id,
      metadata: { assetId: asset.id },
    });

    res.json({ updated: true, verificationStatus: nextVerificationStatus, lifecycleStatus: nextLifecycle });
  }),
);

// Disputes & Takedown Workflow
verificationRouter.post(
  '/assets/:id/disputes',
  requireAuth,
  requirePermission('verification:dispute_file'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        disputeType: z.enum(['ownership_claim', 'license_violation', 'takedown', 'transaction_refund']),
        severity: z.enum(['critical', 'high', 'medium']).default('high'),
        description: z.string().trim().min(20).max(3000),
      })
      .parse(req.body);

    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');

    const [dispute] = await db.transaction(async (tx) => {
      const created = await tx
        .insert(disputes)
        .values({
          assetId: asset.id,
          filedByUserId: req.auth!.userId,
          disputeType: input.disputeType,
          severity: input.severity,
          description: input.description,
          status: 'open',
        })
        .returning();

      // Critical takedown safeguard: pause marketplace visibility on ownership/takedown disputes
      if (input.disputeType === 'ownership_claim' || input.disputeType === 'takedown') {
        await tx
          .update(marketplaceListings)
          .set({ status: 'suspended', moderationStatus: 'flagged', updatedAt: new Date() })
          .where(eq(marketplaceListings.assetId, asset.id));
        await tx
          .update(assets)
          .set({ lifecycleStatus: 'suspended', updatedAt: new Date() })
          .where(eq(assets.id, asset.id));
      }
      return created;
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: asset.organizationId,
      action: 'dispute.filed',
      resourceType: 'dispute',
      resourceId: dispute.id,
      metadata: { assetId: asset.id, disputeType: input.disputeType },
    });

    res.status(201).json({ dispute });
  }),
);

verificationRouter.get(
  '/disputes',
  requireAuth,
  requirePermission('verification:dispute_resolve'),
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        id: disputes.id,
        assetId: disputes.assetId,
        assetName: assets.name,
        disputeType: disputes.disputeType,
        severity: disputes.severity,
        description: disputes.description,
        status: disputes.status,
        resolutionNotes: disputes.resolutionNotes,
        createdAt: disputes.createdAt,
      })
      .from(disputes)
      .innerJoin(assets, eq(disputes.assetId, assets.id))
      .orderBy(desc(disputes.createdAt));

    res.json({ disputes: rows });
  }),
);

verificationRouter.post(
  '/disputes/:id/resolve',
  requireAuth,
  requirePermission('verification:dispute_resolve'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum(['resolved_upheld', 'resolved_dismissed']),
        resolutionNotes: z.string().trim().min(10).max(2000),
        restoreListing: z.boolean().default(false),
      })
      .parse(req.body);

    const db = await getDb();
    const dispute = await db.query.disputes.findFirst({ where: eq(disputes.id, req.params.id) });
    if (!dispute) throw new NotFoundError('Dispute not found');

    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({
          status: input.status,
          resolutionNotes: input.resolutionNotes,
          resolvedByUserId: req.auth!.userId,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, dispute.id));

      if (input.status === 'resolved_dismissed' && input.restoreListing) {
        await tx
          .update(marketplaceListings)
          .set({ status: 'active', moderationStatus: 'approved', updatedAt: new Date() })
          .where(eq(marketplaceListings.assetId, dispute.assetId));
        await tx
          .update(assets)
          .set({ lifecycleStatus: 'published', updatedAt: new Date() })
          .where(eq(assets.id, dispute.assetId));
      }
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'dispute.resolved',
      resourceType: 'dispute',
      resourceId: dispute.id,
      metadata: { status: input.status },
    });

    res.json({ resolved: true, status: input.status });
  }),
);

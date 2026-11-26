import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import {
  assertAssetTransition,
  ASSET_STATUSES,
  createAssetSchema,
  type AssetStatus,
} from '@secondlife/shared';
import { env } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import {
  assetCategories,
  assetHistory,
  assetMetadata,
  assets,
  assetVersions,
  discoveryCandidates,
  repositories,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { inspectSafeZipArchive } from '../../services/archive-security.service.js';
import { recordAuditLog } from '../../services/audit.service.js';
import {
  discoverInactiveCandidates,
  fetchRepositoryMetadata,
} from '../../services/repo-provider.service.js';
import { storageService } from '../../services/storage.service.js';
import { generateCode, slugify, validateSafeExternalUrl } from '../../utils/crypto.js';
import {
  asyncHandler,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const assetsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.AI_MAX_ARCHIVE_BYTES },
});

function assertTenantAssetAccess(assetOrgId: string, req: import('express').Request): void {
  const isAdmin =
    req.auth!.permissions.has('admin:assets') || req.auth!.permissions.has('verification:review');
  if (!isAdmin && assetOrgId !== req.auth!.organizationId) {
    throw new ForbiddenError('Access denied: asset belongs to a different organization');
  }
}

assetsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const categories = await db
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.isActive, true));
    res.json({ categories });
  }),
);

assetsRouter.get(
  '/assets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const orgId = req.auth!.organizationId;
    if (!orgId) {
      res.json({ assets: [] });
      return;
    }

    const rows = await db
      .select()
      .from(assets)
      .where(eq(assets.organizationId, orgId))
      .orderBy(desc(assets.updatedAt));

    res.json({ assets: rows });
  }),
);

assetsRouter.post(
  '/assets',
  requireAuth,
  requirePermission('asset:create'),
  asyncHandler(async (req, res) => {
    const input = createAssetSchema.parse(req.body);
    if (!req.auth!.organizationId || !req.auth!.workspaceId) {
      throw new BadRequestError('Active organization and workspace are required');
    }

    if (input.repositoryUrl) {
      validateSafeExternalUrl(input.repositoryUrl);
    }

    const db = await getDb();
    const category = await db.query.assetCategories.findFirst({
      where: eq(assetCategories.slug, input.categorySlug),
    });
    if (!category) {
      throw new BadRequestError(`Unknown asset category: ${input.categorySlug}`);
    }

    if (input.repositoryUrl) {
      const duplicate = await db
        .select({ id: assets.id, name: assets.name })
        .from(repositories)
        .innerJoin(assets, eq(repositories.assetId, assets.id))
        .where(
          and(
            eq(repositories.repoUrl, input.repositoryUrl),
            eq(assets.organizationId, req.auth!.organizationId),
          ),
        )
        .limit(1);
      if (duplicate.length > 0) {
        throw new ConflictError(`Repository URL is already registered in this organization as "${duplicate[0].name}"`);
      }
    }

    const assetCode = generateCode('SL');
    const slug = `${slugify(input.name)}-${assetCode.toLowerCase()}`;

    const created = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          assetCode,
          organizationId: req.auth!.organizationId!,
          workspaceId: req.auth!.workspaceId!,
          ownerUserId: req.auth!.userId,
          categoryId: category.id,
          name: input.name,
          slug,
          shortSummary: input.shortSummary || input.description.slice(0, 260),
          description: input.description,
          assetType: input.assetType,
          lifecycleStatus: 'draft',
          primaryLanguage: input.primaryLanguage ?? null,
          techStack: input.techStack,
          declaredLicense: input.declaredLicense,
          documentationNotes: input.documentationNotes ?? null,
          isDemoSeed: req.auth!.isDemoAccount,
        })
        .returning();

      const [version] = await tx
        .insert(assetVersions)
        .values({
          assetId: asset.id,
          versionTag: input.versionTag,
          ingestionStatus: input.repositoryUrl ? 'pending' : 'manual_ready',
          createdByUserId: req.auth!.userId,
        })
        .returning();

      await tx.insert(repositories).values({
        assetId: asset.id,
        provider: input.repositoryProvider,
        repoUrl: input.repositoryUrl || null,
      });

      await tx.insert(assetMetadata).values({
        assetId: asset.id,
        frameworksDetected: input.techStack,
        hasReadme: Boolean(input.documentationNotes),
      });

      await tx.insert(assetHistory).values({
        assetId: asset.id,
        actorUserId: req.auth!.userId,
        eventType: 'asset.created',
        toStatus: 'draft',
        notes: 'Asset created in workspace registry',
      });

      return { asset, version };
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: req.auth!.organizationId,
      action: 'asset.created',
      resourceType: 'asset',
      resourceId: created.asset.id,
      ipAddress: req.ip,
    });

    res.status(201).json(created);
  }),
);

assetsRouter.get(
  '/assets/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, req.params.id),
    });
    if (!asset) throw new NotFoundError('Asset not found');
    assertTenantAssetAccess(asset.organizationId, req);

    const [versions, repo, meta, history] = await Promise.all([
      db.select().from(assetVersions).where(eq(assetVersions.assetId, asset.id)).orderBy(desc(assetVersions.createdAt)),
      db.query.repositories.findFirst({ where: eq(repositories.assetId, asset.id) }),
      db.query.assetMetadata.findFirst({ where: eq(assetMetadata.assetId, asset.id) }),
      db.select().from(assetHistory).where(eq(assetHistory.assetId, asset.id)).orderBy(desc(assetHistory.createdAt)),
    ]);

    res.json({ asset, versions, repository: repo ?? null, metadata: meta ?? null, history });
  }),
);

assetsRouter.post(
  '/assets/:id/upload-archive',
  requireAuth,
  requirePermission('asset:update_own'),
  upload.single('archive'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');
    assertTenantAssetAccess(asset.organizationId, req);

    if (!req.file) {
      throw new BadRequestError('No archive file provided (expected multipart field "archive")');
    }

    const inspection = inspectSafeZipArchive(req.file.buffer);
    const versionTag = typeof req.body?.versionTag === 'string' && req.body.versionTag.trim()
      ? req.body.versionTag.trim().slice(0, 40)
      : `v-${Date.now()}`;
    const storageKey = `assets/${asset.organizationId}/${asset.id}/${versionTag}.zip`;
    const stored = await storageService.putObject(storageKey, req.file.buffer);

    const [version] = await db
      .insert(assetVersions)
      .values({
        assetId: asset.id,
        versionTag,
        archiveStorageKey: stored.key,
        archiveSha256: stored.sha256,
        fileCount: inspection.fileCount,
        totalSizeBytes: inspection.totalUncompressedBytes,
        ingestionStatus: 'completed',
        createdByUserId: req.auth!.userId,
      })
      .returning();

    await db
      .update(assetMetadata)
      .set({
        hasReadme: inspection.detectedManifests.some((m) => m.toLowerCase().endsWith('readme.md')),
        extraAttributes: {
          detectedManifests: inspection.detectedManifests,
          sampleFiles: inspection.files.slice(0, 40).map((f) => f.path),
        },
        updatedAt: new Date(),
      })
      .where(eq(assetMetadata.assetId, asset.id));

    await db.insert(assetHistory).values({
      assetId: asset.id,
      actorUserId: req.auth!.userId,
      eventType: 'asset.archive_uploaded',
      notes: `Uploaded ${inspection.fileCount} files (${inspection.totalUncompressedBytes} bytes uncompressed)`,
    });

    res.status(201).json({
      version,
      inspection: {
        fileCount: inspection.fileCount,
        totalUncompressedBytes: inspection.totalUncompressedBytes,
        detectedManifests: inspection.detectedManifests,
      },
    });
  }),
);

assetsRouter.post(
  '/assets/:id/sync-repository',
  requireAuth,
  requirePermission('asset:update_own'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');
    assertTenantAssetAccess(asset.organizationId, req);

    const repo = await db.query.repositories.findFirst({ where: eq(repositories.assetId, asset.id) });
    if (!repo?.repoUrl) {
      throw new BadRequestError('No repository URL attached to this asset');
    }

    const meta = await fetchRepositoryMetadata(repo.repoUrl, repo.provider);

    await db
      .update(repositories)
      .set({
        provider: meta.provider,
        repoFullName: meta.fullName,
        defaultBranch: meta.defaultBranch,
        isPrivate: meta.isPrivate,
        externalStars: meta.stars,
        externalForks: meta.forks,
        lastCommitAt: meta.lastCommitAt ? new Date(meta.lastCommitAt) : null,
        metadataSnapshot: meta.rawSignals,
        lastSyncedAt: new Date(),
      })
      .where(eq(repositories.id, repo.id));

    if (meta.primaryLanguage && !asset.primaryLanguage) {
      await db
        .update(assets)
        .set({ primaryLanguage: meta.primaryLanguage, updatedAt: new Date() })
        .where(eq(assets.id, asset.id));
    }

    res.json({ synced: true, repositoryMetadata: meta });
  }),
);

assetsRouter.post(
  '/assets/:id/transition',
  requireAuth,
  requirePermission('asset:submit'),
  asyncHandler(async (req, res) => {
    const { targetStatus, notes } = z
      .object({
        targetStatus: z.enum(ASSET_STATUSES),
        notes: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');
    assertTenantAssetAccess(asset.organizationId, req);

    try {
      assertAssetTransition(asset.lifecycleStatus as AssetStatus, targetStatus);
    } catch (err) {
      throw new BadRequestError((err as Error).message);
    }

    // Critical Business & Legal Compliance Gate: cannot publish without verification & technical evaluation
    if (targetStatus === 'published') {
      if (asset.verificationStatus !== 'verified') {
        throw new BadRequestError('Asset cannot be published before passing ownership and compliance verification');
      }
      if (asset.technicalEvalStatus !== 'completed') {
        throw new BadRequestError('Asset cannot be published before completing technical evaluation');
      }
    }

    const [updated] = await db
      .update(assets)
      .set({
        lifecycleStatus: targetStatus,
        marketplaceStatus: targetStatus === 'published' ? 'published' : asset.marketplaceStatus,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, asset.id))
      .returning();

    await db.insert(assetHistory).values({
      assetId: asset.id,
      actorUserId: req.auth!.userId,
      eventType: 'asset.status_transition',
      fromStatus: asset.lifecycleStatus,
      toStatus: targetStatus,
      notes: notes ?? null,
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: asset.organizationId,
      action: 'asset.lifecycle_transition',
      resourceType: 'asset',
      resourceId: asset.id,
      metadata: { from: asset.lifecycleStatus, to: targetStatus },
    });

    res.json({ asset: updated });
  }),
);

// Discovery Engine Routes
assetsRouter.get(
  '/discovery/candidates',
  requireAuth,
  requirePermission('discovery:read'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.organizationId, req.auth!.organizationId!))
      .orderBy(desc(discoveryCandidates.discoveredAt));
    res.json({ candidates: rows });
  }),
);

assetsRouter.post(
  '/discovery/scan',
  requireAuth,
  requirePermission('discovery:run'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        query: z.string().trim().min(2).max(120),
        minInactivityDays: z.number().int().min(30).max(3650).default(180),
        limit: z.number().int().min(1).max(20).default(8),
      })
      .parse(req.body);

    const result = await discoverInactiveCandidates({
      provider: 'github',
      topicOrQuery: input.query,
      minInactivityDays: input.minInactivityDays,
      limit: input.limit,
    });

    const db = await getDb();
    const inserted = [];
    for (const c of result.candidates) {
      const [row] = await db
        .insert(discoveryCandidates)
        .values({
          organizationId: req.auth!.organizationId!,
          provider: c.provider,
          repoFullName: c.repoFullName,
          repoUrl: c.repoUrl,
          primaryLanguage: c.primaryLanguage,
          detectedLicense: c.detectedLicense,
          inactivityDays: c.inactivityDays,
          inactivitySignals: c.inactivitySignals,
          candidateScore: c.candidateScore,
          status: 'candidate',
        })
        .returning();
      inserted.push(row);
    }

    res.json({
      liveApiUsed: result.liveApiUsed,
      disclaimer: result.disclaimer,
      candidatesFound: inserted.length,
      candidates: inserted,
    });
  }),
);

assetsRouter.post(
  '/discovery/candidates/:id/import',
  requireAuth,
  requirePermission('asset:create'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const candidate = await db.query.discoveryCandidates.findFirst({
      where: and(
        eq(discoveryCandidates.id, req.params.id),
        eq(discoveryCandidates.organizationId, req.auth!.organizationId!),
      ),
    });
    if (!candidate) throw new NotFoundError('Discovery candidate not found');

    const defaultCategory = await db.query.assetCategories.findFirst();
    if (!defaultCategory) throw new BadRequestError('No asset categories seeded');

    const assetCode = generateCode('SL');
    const [asset] = await db
      .insert(assets)
      .values({
        assetCode,
        organizationId: req.auth!.organizationId!,
        workspaceId: req.auth!.workspaceId!,
        ownerUserId: req.auth!.userId,
        categoryId: defaultCategory.id,
        name: candidate.repoFullName,
        slug: `${slugify(candidate.repoFullName)}-${assetCode.toLowerCase()}`,
        shortSummary: `Imported discovery candidate (${candidate.inactivityDays} days inactive). Pending ownership review.`,
        description: `Imported from ${candidate.provider} discovery scan. Inactivity signals do not prove ownership or abandonment; verification required before any publication.`,
        assetType: 'source_code',
        lifecycleStatus: 'verification_required',
        primaryLanguage: candidate.primaryLanguage,
        declaredLicense: candidate.detectedLicense || 'Unknown / Review Required',
      })
      .returning();

    await db.insert(repositories).values({
      assetId: asset.id,
      provider: candidate.provider,
      repoUrl: candidate.repoUrl,
      repoFullName: candidate.repoFullName,
    });

    await db
      .update(discoveryCandidates)
      .set({ status: 'imported', importedAssetId: asset.id })
      .where(eq(discoveryCandidates.id, candidate.id));

    res.status(201).json({ asset });
  }),
);

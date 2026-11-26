import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { buyerRequirementSchema, createListingSchema } from '@secondlife/shared';
import { getDb } from '../../db/client.js';
import {
  assetCategories,
  assetHistory,
  assetMatches,
  assetMetadata,
  assets,
  buyerRequirements,
  commercialReports,
  marketplaceListings,
  organizations,
  savedAssets,
  technicalReports,
} from '../../db/schema.js';
import { optionalAuth, requireAuth, requirePermission } from '../../middleware/auth.js';
import { recordAuditLog } from '../../services/audit.service.js';
import {
  asyncHandler,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors.js';

export const marketplaceRouter = Router();

marketplaceRouter.get(
  '/marketplace/listings',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const listingType = typeof req.query.listingType === 'string' ? req.query.listingType.trim() : '';
    const language = typeof req.query.language === 'string' ? req.query.language.trim().toLowerCase() : '';
    const minTechScore = req.query.minTechScore ? Number(req.query.minTechScore) : 0;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));

    const rows = await db
      .select({
        listingId: marketplaceListings.id,
        title: marketplaceListings.title,
        summary: marketplaceListings.summary,
        listingType: marketplaceListings.listingType,
        currency: marketplaceListings.currency,
        askingPriceMinor: marketplaceListings.askingPriceMinor,
        exclusivityAvailable: marketplaceListings.exclusivityAvailable,
        supportIncludedDays: marketplaceListings.supportIncludedDays,
        publishedAt: marketplaceListings.publishedAt,
        assetId: assets.id,
        assetCode: assets.assetCode,
        assetSlug: assets.slug,
        assetType: assets.assetType,
        primaryLanguage: assets.primaryLanguage,
        techStack: assets.techStack,
        declaredLicense: assets.declaredLicense,
        verificationStatus: assets.verificationStatus,
        isDemoSeed: assets.isDemoSeed,
        categorySlug: assetCategories.slug,
        categoryName: assetCategories.name,
        organizationName: organizations.name,
      })
      .from(marketplaceListings)
      .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
      .innerJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .innerJoin(organizations, eq(assets.organizationId, organizations.id))
      .where(
        and(
          eq(marketplaceListings.status, 'active'),
          eq(marketplaceListings.moderationStatus, 'approved'),
          eq(assets.verificationStatus, 'verified'),
        ),
      )
      .orderBy(desc(marketplaceListings.publishedAt));

    const assetIds = rows.map((r) => r.assetId);
    const techMap = new Map<string, number>();
    const commMap = new Map<string, number>();

    if (assetIds.length > 0) {
      const techs = await db
        .select({ assetId: technicalReports.assetId, technicalScore: technicalReports.technicalScore })
        .from(technicalReports)
        .where(inArray(technicalReports.assetId, assetIds));
      for (const t of techs) techMap.set(t.assetId, t.technicalScore);

      const comms = await db
        .select({ assetId: commercialReports.assetId, score: commercialReports.commercialOpportunityScore })
        .from(commercialReports)
        .where(inArray(commercialReports.assetId, assetIds));
      for (const c of comms) commMap.set(c.assetId, c.score);
    }

    const enriched = rows
      .map((r) => ({
        ...r,
        technicalScore: techMap.get(r.assetId) ?? null,
        commercialScore: commMap.get(r.assetId) ?? null,
      }))
      .filter((r) => {
        if (q) {
          const hay = `${r.title} ${r.summary} ${r.primaryLanguage ?? ''} ${r.techStack.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (categorySlug && r.categorySlug !== categorySlug) return false;
        if (listingType && r.listingType !== listingType) return false;
        if (language && (r.primaryLanguage ?? '').toLowerCase() !== language) return false;
        if (minTechScore > 0 && (r.technicalScore ?? 0) < minTechScore) return false;
        if (maxPrice !== null && !Number.isNaN(maxPrice) && r.askingPriceMinor > maxPrice) return false;
        return true;
      });

    const total = enriched.length;
    const paged = enriched.slice((page - 1) * limit, page * limit);

    res.json({
      listings: paged,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  }),
);

marketplaceRouter.get(
  '/marketplace/listings/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const row = await db
      .select({
        listing: marketplaceListings,
        asset: assets,
        category: assetCategories,
        organizationName: organizations.name,
      })
      .from(marketplaceListings)
      .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
      .innerJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .innerJoin(organizations, eq(assets.organizationId, organizations.id))
      .where(
        and(
          eq(marketplaceListings.id, req.params.id),
          eq(marketplaceListings.status, 'active'),
          eq(marketplaceListings.moderationStatus, 'approved'),
        ),
      )
      .limit(1);

    if (row.length === 0) throw new NotFoundError('Marketplace listing not found');
    const item = row[0];

    const [techReport, commReport, meta, similar] = await Promise.all([
      db.query.technicalReports.findFirst({
        where: eq(technicalReports.assetId, item.asset.id),
        orderBy: desc(technicalReports.createdAt),
      }),
      db.query.commercialReports.findFirst({
        where: eq(commercialReports.assetId, item.asset.id),
        orderBy: desc(commercialReports.createdAt),
      }),
      db.query.assetMetadata.findFirst({ where: eq(assetMetadata.assetId, item.asset.id) }),
      db
        .select({
          listingId: marketplaceListings.id,
          title: marketplaceListings.title,
          listingType: marketplaceListings.listingType,
          askingPriceMinor: marketplaceListings.askingPriceMinor,
          currency: marketplaceListings.currency,
          primaryLanguage: assets.primaryLanguage,
        })
        .from(marketplaceListings)
        .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
        .where(
          and(
            eq(marketplaceListings.status, 'active'),
            eq(assets.categoryId, item.asset.categoryId),
            sql`${marketplaceListings.id} != ${item.listing.id}`,
          ),
        )
        .limit(3),
    ]);

    res.json({
      listing: item.listing,
      asset: {
        id: item.asset.id,
        assetCode: item.asset.assetCode,
        name: item.asset.name,
        slug: item.asset.slug,
        shortSummary: item.asset.shortSummary,
        description: item.asset.description,
        assetType: item.asset.assetType,
        primaryLanguage: item.asset.primaryLanguage,
        techStack: item.asset.techStack,
        declaredLicense: item.asset.declaredLicense,
        verificationStatus: item.asset.verificationStatus,
        isDemoSeed: item.asset.isDemoSeed,
      },
      category: item.category,
      ownerOrganizationName: item.organizationName,
      metadata: meta ?? null,
      technicalReport: techReport ?? null,
      commercialReport: commReport ?? null,
      similarListings: similar,
    });
  }),
);

marketplaceRouter.get(
  '/marketplace/compare',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rawIds = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean).slice(0, 4) : [];
    if (rawIds.length < 2) {
      throw new BadRequestError('Provide at least 2 listing IDs via ?ids=id1,id2');
    }

    const db = await getDb();
    const rows = await db
      .select({
        listing: marketplaceListings,
        asset: assets,
      })
      .from(marketplaceListings)
      .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
      .where(and(inArray(marketplaceListings.id, rawIds), eq(marketplaceListings.status, 'active')));

    const enriched = await Promise.all(
      rows.map(async (r) => {
        const [tech, comm] = await Promise.all([
          db.query.technicalReports.findFirst({ where: eq(technicalReports.assetId, r.asset.id) }),
          db.query.commercialReports.findFirst({ where: eq(commercialReports.assetId, r.asset.id) }),
        ]);
        return {
          listingId: r.listing.id,
          title: r.listing.title,
          listingType: r.listing.listingType,
          askingPriceMinor: r.listing.askingPriceMinor,
          currency: r.listing.currency,
          primaryLanguage: r.asset.primaryLanguage,
          techStack: r.asset.techStack,
          declaredLicense: r.asset.declaredLicense,
          technicalScore: tech?.technicalScore ?? null,
          securityScore: tech?.securityScore ?? null,
          maintainabilityScore: tech?.maintainabilityScore ?? null,
          reusabilityScore: comm?.reusabilityScore ?? null,
          estimatedRevivalHoursMin: comm?.estimatedRevivalHoursMin ?? null,
          estimatedRevivalHoursMax: comm?.estimatedRevivalHoursMax ?? null,
        };
      }),
    );

    res.json({ comparison: enriched });
  }),
);

marketplaceRouter.post(
  '/assets/:id/publish-listing',
  requireAuth,
  requirePermission('asset:publish'),
  asyncHandler(async (req, res) => {
    const input = createListingSchema.parse(req.body);
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');
    if (asset.organizationId !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot publish asset outside your active organization');
    }

    if (asset.verificationStatus !== 'verified') {
      throw new BadRequestError('Asset must pass ownership & compliance verification before marketplace publication');
    }
    if (asset.technicalEvalStatus !== 'completed') {
      throw new BadRequestError('Asset must complete technical evaluation before marketplace publication');
    }

    const listing = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(marketplaceListings)
        .values({
          assetId: asset.id,
          organizationId: asset.organizationId,
          title: input.title,
          summary: input.summary,
          listingType: input.listingType,
          currency: input.currency,
          askingPriceMinor: input.askingPriceMinor,
          commercialTerms: input.commercialTerms,
          exclusivityAvailable: input.exclusivityAvailable,
          supportIncludedDays: input.supportIncludedDays,
          status: 'active',
          moderationStatus: 'approved',
        })
        .returning();

      await tx
        .update(assets)
        .set({
          lifecycleStatus: 'published',
          marketplaceStatus: 'published',
          updatedAt: new Date(),
        })
        .where(eq(assets.id, asset.id));

      await tx.insert(assetHistory).values({
        assetId: asset.id,
        actorUserId: req.auth!.userId,
        eventType: 'marketplace.published',
        fromStatus: asset.lifecycleStatus,
        toStatus: 'published',
        notes: `Published ${input.listingType} listing`,
      });

      return created;
    });

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      organizationId: asset.organizationId,
      action: 'marketplace.listing_published',
      resourceType: 'marketplace_listing',
      resourceId: listing.id,
    });

    res.status(201).json({ listing });
  }),
);

// Saved Assets
marketplaceRouter.get(
  '/saved-assets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        savedId: savedAssets.id,
        notes: savedAssets.notes,
        savedAt: savedAssets.createdAt,
        assetId: assets.id,
        assetName: assets.name,
        primaryLanguage: assets.primaryLanguage,
        declaredLicense: assets.declaredLicense,
      })
      .from(savedAssets)
      .innerJoin(assets, eq(savedAssets.assetId, assets.id))
      .where(eq(savedAssets.userId, req.auth!.userId))
      .orderBy(desc(savedAssets.createdAt));

    res.json({ savedAssets: rows });
  }),
);

marketplaceRouter.post(
  '/saved-assets',
  requireAuth,
  requirePermission('marketplace:save'),
  asyncHandler(async (req, res) => {
    const { assetId, notes } = z
      .object({ assetId: z.string().uuid(), notes: z.string().max(500).optional() })
      .parse(req.body);
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, assetId) });
    if (!asset || asset.marketplaceStatus !== 'published') {
      throw new NotFoundError('Published asset not found');
    }

    await db
      .insert(savedAssets)
      .values({ userId: req.auth!.userId, assetId, notes: notes ?? null })
      .onConflictDoNothing();

    res.status(201).json({ saved: true });
  }),
);

marketplaceRouter.delete(
  '/saved-assets/:assetId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    await db
      .delete(savedAssets)
      .where(and(eq(savedAssets.userId, req.auth!.userId), eq(savedAssets.assetId, req.params.assetId)));
    res.json({ removed: true });
  }),
);

// Buyer Requirements & Explainable Matching
marketplaceRouter.get(
  '/buyer/requirements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(buyerRequirements)
      .where(eq(buyerRequirements.userId, req.auth!.userId))
      .orderBy(desc(buyerRequirements.createdAt));
    res.json({ requirements: rows });
  }),
);

marketplaceRouter.post(
  '/buyer/requirements',
  requireAuth,
  requirePermission('requirements:manage'),
  asyncHandler(async (req, res) => {
    const input = buyerRequirementSchema.parse(req.body);
    const db = await getDb();
    const [requirement] = await db
      .insert(buyerRequirements)
      .values({
        userId: req.auth!.userId,
        organizationId: req.auth!.organizationId!,
        ...input,
        maxBudgetMinor: input.maxBudgetMinor ?? null,
      })
      .returning();

    res.status(201).json({ requirement });
  }),
);

marketplaceRouter.get(
  '/buyer/recommendations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const reqs = await db
      .select()
      .from(buyerRequirements)
      .where(and(eq(buyerRequirements.userId, req.auth!.userId), eq(buyerRequirements.isActive, true)))
      .orderBy(desc(buyerRequirements.createdAt))
      .limit(3);

    const activeListings = await db
      .select({
        listingId: marketplaceListings.id,
        title: marketplaceListings.title,
        listingType: marketplaceListings.listingType,
        askingPriceMinor: marketplaceListings.askingPriceMinor,
        currency: marketplaceListings.currency,
        assetId: assets.id,
        primaryLanguage: assets.primaryLanguage,
        techStack: assets.techStack,
        categorySlug: assetCategories.slug,
      })
      .from(marketplaceListings)
      .innerJoin(assets, eq(marketplaceListings.assetId, assets.id))
      .innerJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .where(and(eq(marketplaceListings.status, 'active'), eq(assets.verificationStatus, 'verified')));

    const recommendations: Array<Record<string, unknown>> = [];

    for (const r of reqs) {
      for (const l of activeListings) {
        const tech = await db.query.technicalReports.findFirst({ where: eq(technicalReports.assetId, l.assetId) });
        const techScore = tech?.technicalScore ?? 60;
        const reqTechs = new Set(r.requiredTechnologies.map((t) => t.toLowerCase()));
        const assetTechs = new Set([
          ...l.techStack.map((t) => t.toLowerCase()),
          ...(l.primaryLanguage ? [l.primaryLanguage.toLowerCase()] : []),
        ]);
        const reasons: string[] = [];
        const gaps: string[] = [];
        let score = 40;

        if (reqTechs.size > 0) {
          const matched = Array.from(reqTechs).filter((t) => assetTechs.has(t));
          score += Math.round((matched.length / reqTechs.size) * 35);
          if (matched.length > 0) reasons.push(`Stack match: ${matched.join(', ')}`);
          const missing = Array.from(reqTechs).filter((t) => !assetTechs.has(t));
          if (missing.length > 0) gaps.push(`Missing stack: ${missing.join(', ')}`);
        } else {
          score += 20;
        }

        if (r.preferredCategories.includes(l.categorySlug)) {
          score += 15;
          reasons.push(`Category match: ${l.categorySlug}`);
        }

        if (techScore >= r.minTechnicalScore) {
          score += 10;
          reasons.push(`Technical score ${techScore}/100 meets threshold`);
        } else {
          score -= 10;
          gaps.push(`Technical score ${techScore}/100 below ${r.minTechnicalScore}`);
        }

        if (r.maxBudgetMinor && l.askingPriceMinor > r.maxBudgetMinor) {
          score -= 15;
          gaps.push('Asking price above target budget');
        } else if (r.maxBudgetMinor) {
          reasons.push('Within target budget');
        }

        const bounded = Math.max(10, Math.min(100, score));
        await db
          .insert(assetMatches)
          .values({
            buyerRequirementId: r.id,
            assetId: l.assetId,
            matchScore: bounded,
            explanation: { reasons, gaps },
          })
          .onConflictDoUpdate({
            target: [assetMatches.buyerRequirementId, assetMatches.assetId],
            set: { matchScore: bounded, explanation: { reasons, gaps }, computedAt: new Date() },
          });

        recommendations.push({
          requirementId: r.id,
          requirementTitle: r.title,
          listingId: l.listingId,
          assetId: l.assetId,
          title: l.title,
          listingType: l.listingType,
          askingPriceMinor: l.askingPriceMinor,
          currency: l.currency,
          technicalScore: techScore,
          matchScore: bounded,
          explanation: { reasons, gaps },
        });
      }
    }

    recommendations.sort((a, b) => Number(b.matchScore) - Number(a.matchScore));
    res.json({ recommendations: recommendations.slice(0, 15) });
  }),
);

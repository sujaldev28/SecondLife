import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import {
  analysisJobs,
  assetHistory,
  assetMetadata,
  assets,
  assetVersions,
  commercialReports,
  riskFindings,
  technicalReports,
} from '../../db/schema.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { runAssetAnalysisPipeline } from '../../services/ai-client.service.js';
import { inspectSafeZipArchive } from '../../services/archive-security.service.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { storageService } from '../../services/storage.service.js';
import { asyncHandler, ForbiddenError, NotFoundError } from '../../utils/errors.js';

export const analysisRouter = Router();

analysisRouter.post(
  '/assets/:id/analyze',
  requireAuth,
  requirePermission('analysis:trigger'),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');

    const isPrivileged = req.auth!.permissions.has('analysis:override');
    if (!isPrivileged && asset.organizationId !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot trigger analysis for another organization');
    }

    const latestVersion = await db.query.assetVersions.findFirst({
      where: eq(assetVersions.assetId, asset.id),
      orderBy: desc(assetVersions.createdAt),
    });

    const [job] = await db
      .insert(analysisJobs)
      .values({
        assetId: asset.id,
        assetVersionId: latestVersion?.id ?? null,
        requestedByUserId: req.auth!.userId,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    const startedMs = Date.now();
    try {
      let files: Array<{ path: string; size: number; contentPreview?: string }> = [];
      if (latestVersion?.archiveStorageKey) {
        const buf = await storageService.getObject(latestVersion.archiveStorageKey);
        const inspected = inspectSafeZipArchive(buf);
        files = inspected.files;
      }

      const result = await runAssetAnalysisPipeline({
        assetId: asset.id,
        primaryLanguage: asset.primaryLanguage,
        techStack: asset.techStack,
        description: asset.description,
        documentationNotes: asset.documentationNotes,
        files,
      });

      const durationMs = Date.now() - startedMs;

      const persisted = await db.transaction(async (tx) => {
        const [techReport] = await tx
          .insert(technicalReports)
          .values({
            assetId: asset.id,
            assetVersionId: latestVersion?.id ?? null,
            analysisJobId: job.id,
            technicalScore: result.technicalReport.technicalScore,
            maintainabilityScore: result.technicalReport.maintainabilityScore,
            securityScore: result.technicalReport.securityScore,
            documentationScore: result.technicalReport.documentationScore,
            confidenceLevel: String(result.technicalReport.confidenceLevel),
            analysisMethods: result.technicalReport.analysisMethods,
            dataSources: result.technicalReport.dataSources,
            architectureSummary: result.technicalReport.architectureSummary,
            reusableComponents: result.technicalReport.reusableComponents,
            dependencySummary: result.technicalReport.dependencySummary,
            knownLimitations: result.technicalReport.knownLimitations,
          })
          .returning();

        if (result.riskFindings.length > 0) {
          await tx.insert(riskFindings).values(
            result.riskFindings.map((f) => ({
              technicalReportId: techReport.id,
              assetId: asset.id,
              category: f.category,
              severity: f.severity,
              title: f.title,
              description: f.description,
              filePath: f.filePath ?? null,
              lineNumber: f.lineNumber ?? null,
              evidenceSnippet: f.evidenceSnippet ?? null,
              remediation: f.remediation ?? null,
            })),
          );
        }

        const [commReport] = await tx
          .insert(commercialReports)
          .values({
            assetId: asset.id,
            technicalReportId: techReport.id,
            reusabilityScore: result.commercialReport.reusabilityScore,
            commercialOpportunityScore: result.commercialReport.commercialOpportunityScore,
            estimatedRevivalHoursMin: result.commercialReport.estimatedRevivalHoursMin,
            estimatedRevivalHoursMax: result.commercialReport.estimatedRevivalHoursMax,
            estimatedRevivalCostInrMin: result.commercialReport.estimatedRevivalCostInrMin,
            estimatedRevivalCostInrMax: result.commercialReport.estimatedRevivalCostInrMax,
            suggestedValueRangeInrMin: result.commercialReport.suggestedValueRangeInrMin,
            suggestedValueRangeInrMax: result.commercialReport.suggestedValueRangeInrMax,
            confidenceLevel: String(result.commercialReport.confidenceLevel),
            targetSegments: result.commercialReport.targetSegments,
            industryApplications: result.commercialReport.industryApplications,
            modernizationRequirements: result.commercialReport.modernizationRequirements,
            documentedAssumptions: result.commercialReport.documentedAssumptions,
            uncertaintyFactors: result.commercialReport.uncertaintyFactors,
          })
          .returning();

        await tx
          .update(assetMetadata)
          .set({
            languagesBreakdown: result.technicalReport.languagesBreakdown,
            linesOfCode: result.technicalReport.linesOfCode,
            hasTests: result.technicalReport.hasTests,
            hasReadme: result.technicalReport.hasReadme,
            hasCiConfig: result.technicalReport.hasCiConfig,
            updatedAt: new Date(),
          })
          .where(eq(assetMetadata.assetId, asset.id));

        await tx
          .update(analysisJobs)
          .set({
            status: 'completed',
            engineMode: result.engineMode,
            durationMs,
            completedAt: new Date(),
          })
          .where(eq(analysisJobs.id, job.id));

        await tx
          .update(assets)
          .set({
            technicalEvalStatus: 'completed',
            commercialEvalStatus: 'completed',
            lifecycleStatus:
              asset.lifecycleStatus === 'draft' || asset.lifecycleStatus === 'submitted'
                ? 'verification_required'
                : asset.lifecycleStatus,
            updatedAt: new Date(),
          })
          .where(eq(assets.id, asset.id));

        await tx.insert(assetHistory).values({
          assetId: asset.id,
          actorUserId: req.auth!.userId,
          eventType: 'analysis.completed',
          notes: `Completed via ${result.engineMode} (Tech Score: ${result.technicalReport.technicalScore}/100)`,
        });

        return { techReport, commReport };
      });

      res.status(201).json({
        jobId: job.id,
        engineMode: result.engineMode,
        technicalReport: persisted.techReport,
        commercialReport: persisted.commReport,
        findingsCount: result.riskFindings.length,
      });
    } catch (err) {
      await db
        .update(analysisJobs)
        .set({ status: 'failed', errorMessage: (err as Error).message, completedAt: new Date() })
        .where(eq(analysisJobs.id, job.id));
      throw err;
    }
  }),
);

analysisRouter.get(
  '/assets/:id/reports',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const asset = await db.query.assets.findFirst({ where: eq(assets.id, req.params.id) });
    if (!asset) throw new NotFoundError('Asset not found');

    const isOwnerOrg = asset.organizationId === req.auth!.organizationId;
    const isAdminOrEvaluator = req.auth!.permissions.has('analysis:read_confidential');
    const isPublished = asset.marketplaceStatus === 'published';

    if (!isOwnerOrg && !isAdminOrEvaluator && !isPublished) {
      throw new ForbiddenError('Unauthorized access to unpublished asset evaluation reports');
    }

    const [techReports, commReports, jobs] = await Promise.all([
      db.select().from(technicalReports).where(eq(technicalReports.assetId, asset.id)).orderBy(desc(technicalReports.createdAt)),
      db.select().from(commercialReports).where(eq(commercialReports.assetId, asset.id)).orderBy(desc(commercialReports.createdAt)),
      db.select().from(analysisJobs).where(eq(analysisJobs.assetId, asset.id)).orderBy(desc(analysisJobs.createdAt)),
    ]);

    let findings: typeof riskFindings.$inferSelect[] = [];
    if (techReports[0]) {
      findings = await db
        .select()
        .from(riskFindings)
        .where(eq(riskFindings.technicalReportId, techReports[0].id));
      // Do not expose raw file paths/snippets of confidential code to external buyers unless authorized
      if (!isOwnerOrg && !isAdminOrEvaluator) {
        findings = findings.map((f) => ({ ...f, filePath: null, evidenceSnippet: null }));
      }
    }

    res.json({
      technicalReport: techReports[0] ?? null,
      commercialReport: commReports[0] ?? null,
      riskFindings: findings,
      jobs,
    });
  }),
);

analysisRouter.post(
  '/reports/:commercialReportId/override',
  requireAuth,
  requirePermission('analysis:override'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        commercialOpportunityScore: z.number().int().min(1).max(100).optional(),
        suggestedValueRangeInrMin: z.number().int().min(0).optional(),
        suggestedValueRangeInrMax: z.number().int().min(0).optional(),
        humanOverrideNotes: z.string().trim().min(10).max(2000),
      })
      .parse(req.body);

    const db = await getDb();
    const [updated] = await db
      .update(commercialReports)
      .set({
        ...(input.commercialOpportunityScore !== undefined
          ? { commercialOpportunityScore: input.commercialOpportunityScore }
          : {}),
        ...(input.suggestedValueRangeInrMin !== undefined
          ? { suggestedValueRangeInrMin: input.suggestedValueRangeInrMin }
          : {}),
        ...(input.suggestedValueRangeInrMax !== undefined
          ? { suggestedValueRangeInrMax: input.suggestedValueRangeInrMax }
          : {}),
        humanOverrideNotes: input.humanOverrideNotes,
        overriddenByUserId: req.auth!.userId,
      })
      .where(eq(commercialReports.id, req.params.commercialReportId))
      .returning();

    if (!updated) throw new NotFoundError('Commercial report not found');

    await recordAuditLog({
      actorUserId: req.auth!.userId,
      action: 'commercial_report.human_override',
      resourceType: 'commercial_report',
      resourceId: updated.id,
      metadata: { notes: input.humanOverrideNotes },
    });

    res.json({ commercialReport: updated });
  }),
);

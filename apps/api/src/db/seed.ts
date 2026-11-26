import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import {
  analysisJobs,
  assetCategories,
  assetMetadata,
  assets,
  assetVersions,
  buyerRequirements,
  commercialReports,
  discoveryCandidates,
  licenses,
  marketplaceListings,
  organizationMembers,
  organizations,
  ownershipRecords,
  repositories,
  riskFindings,
  savedAssets,
  subscriptionPlans,
  subscriptions,
  systemSettings,
  technicalReports,
  users,
  verificationEvidence,
  verificationRequests,
  workspaces,
} from './schema.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { DEMO_SAMPLE_PASSWORD, isDemoModeEnabled } from '../services/demo.service.js';

const __filename = fileURLToPath(import.meta.url);

async function ensureDemoUser(
  db: Awaited<ReturnType<typeof getDb>>,
  params: {
    email: string;
    passwordHash: string;
    fullName: string;
    headline: string;
    primaryRole: string;
  },
) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, params.email) });
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: params.passwordHash,
        fullName: params.fullName,
        headline: params.headline,
        primaryRole: params.primaryRole,
        isDemoAccount: true,
        accountStatus: 'active',
        emailVerified: true,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: params.email,
      passwordHash: params.passwordHash,
      fullName: params.fullName,
      headline: params.headline,
      primaryRole: params.primaryRole,
      isDemoAccount: true,
      authProvider: 'local',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .returning();
  return created;
}

async function ensureOrganization(
  db: Awaited<ReturnType<typeof getDb>>,
  params: {
    slug: string;
    name: string;
    orgType: string;
    website?: string;
    description: string;
    ownerUserId: string;
    isPersonal: boolean;
    workspaceName: string;
    workspaceSlug: string;
  },
) {
  let org = await db.query.organizations.findFirst({ where: eq(organizations.slug, params.slug) });
  if (!org) {
    const [created] = await db
      .insert(organizations)
      .values({
        name: params.name,
        slug: params.slug,
        orgType: params.orgType,
        website: params.website ?? null,
        description: params.description,
        verificationStatus: 'verified',
        ownerUserId: params.ownerUserId,
        isPersonal: params.isPersonal,
      })
      .returning();
    org = created;
  }

  let ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.organizationId, org.id),
  });
  if (!ws) {
    const [createdWs] = await db
      .insert(workspaces)
      .values({
        organizationId: org.id,
        name: params.workspaceName,
        slug: params.workspaceSlug,
        isDefault: true,
      })
      .returning();
    ws = createdWs;
  }

  return { org, ws };
}

export async function seedDatabase(): Promise<void> {
  const db = await getDb();

  // 1. Seed Asset Categories (idempotent)
  const categoryData = [
    {
      slug: 'developer-tools',
      name: 'Developer Tools & CLIs',
      description: 'Compilers, linters, build pipelines, CLI utilities, and SDKs.',
    },
    {
      slug: 'saas-applications',
      name: 'SaaS & Web Applications',
      description: 'Full-stack vertical SaaS platforms, dashboards, and internal tools.',
    },
    {
      slug: 'ai-ml-algorithms',
      name: 'AI, ML & Quantitative Algorithms',
      description: 'Trained pipelines, inference engines, NLP toolkits, and forecasting models.',
    },
    {
      slug: 'fintech-billing',
      name: 'FinTech & Billing Infrastructure',
      description: 'Ledger engines, GST/tax invoicing, reconciliation, and payment adapters.',
    },
    {
      slug: 'devops-security',
      name: 'DevOps, Observability & Security',
      description: 'Deployment orchestrators, log pipelines, scanners, and infrastructure modules.',
    },
    {
      slug: 'research-prototypes',
      name: 'Research Prototypes & Datasets',
      description: 'Academic and R&D implementations with documented methodologies.',
    },
  ];

  for (const cat of categoryData) {
    await db
      .insert(assetCategories)
      .values(cat)
      .onConflictDoNothing({ target: assetCategories.slug });
  }

  // 2. Seed Subscription Plans (idempotent)
  const plansData = [
    {
      code: 'starter_free',
      name: 'Starter',
      description: 'For individual creators evaluating or listing up to 3 abandoned digital assets.',
      monthlyPriceMinor: 0,
      currency: 'INR',
      maxAssets: 3,
      maxTeamSeats: 1,
      features: [
        'Up to 3 active asset submissions',
        'Deterministic static & license scan',
        'Standard marketplace listing',
        'Standard ownership verification queue',
      ],
    },
    {
      code: 'pro_growth',
      name: 'Pro Commercial',
      description: 'For active asset owners, studios, and buyers running technical due diligence.',
      monthlyPriceMinor: 499900,
      currency: 'INR',
      maxAssets: 25,
      maxTeamSeats: 5,
      features: [
        'Up to 25 assets and 5 workspace seats',
        'Priority AI technical & commercial reports',
        'Side-by-side asset comparison & buyer match alerts',
        'Deal room & agreement templates',
      ],
    },
    {
      code: 'enterprise_scale',
      name: 'Enterprise Discovery',
      description: 'For technology companies, VCs, and research institutions sourcing IP at scale.',
      monthlyPriceMinor: 2499900,
      currency: 'INR',
      maxAssets: 500,
      maxTeamSeats: 50,
      features: [
        'Unlimited repository candidate discovery pipelines',
        'Dedicated verification specialist SLA',
        'Custom licensing & transfer workflows',
        'Organization audit logs & API access',
      ],
    },
  ];

  for (const plan of plansData) {
    await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoNothing({ target: subscriptionPlans.code });
  }

  // 3. Seed Configurable System Settings (idempotent)
  const settingsData = [
    {
      settingKey: 'pricing.commission_bps',
      settingValue: {
        non_exclusive_license: 1000,
        exclusive_license: 1000,
        full_transfer: 800,
        revival_partnership: 1200,
        repurposing_partnership: 1000,
      },
      description: 'Platform commission rates in basis points (100 bps = 1%) per transaction type.',
    },
    {
      settingKey: 'pricing.paid_evaluation_fee_inr_minor',
      settingValue: { amountMinor: 299900, currency: 'INR' },
      description: 'Standard fee for deep third-party technical evaluation reports.',
    },
    {
      settingKey: 'discovery.inactivity_threshold_days',
      settingValue: { defaultDays: 180, minStars: 5 },
      description: 'Default repository inactivity window for discovery candidate flagging.',
    },
    {
      settingKey: 'payment.razorpay_config',
      settingValue: {
        activeProvider: env.RAZORPAY_KEY_ID ? 'razorpay' : 'manual_invoice_settlement',
        routeSplitEnabled: false,
        settlementNote:
          'Automated split settlement requires an approved Razorpay Route merchant configuration; otherwise invoices settle with manual payout reconciliation.',
      },
      description: 'Configurable payment settlement mode and marketplace split capability flags.',
    },
  ];

  for (const setting of settingsData) {
    await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoNothing({ target: systemSettings.settingKey });
  }

  // 4. Fictional Demo Accounts & Demo Sample Data (Enabled only when Demo Mode is permitted)
  if (!isDemoModeEnabled()) {
    logger.info('Demo mode disabled: skipping demo account & demo asset seeding');
    return;
  }

  const demoPasswordHash = await bcrypt.hash(DEMO_SAMPLE_PASSWORD, env.BCRYPT_ROUNDS);

  const alice = await ensureDemoUser(db, {
    email: 'alice@demo.secondlife.test',
    passwordHash: demoPasswordHash,
    fullName: 'Alice Morgan',
    headline: 'Individual Software Creator (Demo)',
    primaryRole: 'individual_owner',
  });

  const bob = await ensureDemoUser(db, {
    email: 'bob@demo.secondlife.test',
    passwordHash: demoPasswordHash,
    fullName: 'Bob Wilson',
    headline: 'Engineering Lead, Horizon Demo Ventures (Demo)',
    primaryRole: 'buyer',
  });

  const charlie = await ensureDemoUser(db, {
    email: 'charlie@demo.secondlife.test',
    passwordHash: demoPasswordHash,
    fullName: 'Charlie Brown',
    headline: 'Senior Systems Developer, Northstar Demo Labs (Demo)',
    primaryRole: 'developer',
  });

  const diana = await ensureDemoUser(db, {
    email: 'diana@demo.secondlife.test',
    passwordHash: demoPasswordHash,
    fullName: 'Diana Miller',
    headline: 'VP Operations, Northstar Demo Labs (Demo)',
    primaryRole: 'org_admin',
  });

  const ethan = await ensureDemoUser(db, {
    email: 'ethan@demo.secondlife.test',
    passwordHash: demoPasswordHash,
    fullName: 'Ethan Taylor',
    headline: 'Platform & Compliance Administrator (Demo)',
    primaryRole: 'platform_admin',
  });

  // Demo Organizations & Workspaces (isolated from real customer orgs)
  const aliceOrgData = await ensureOrganization(db, {
    slug: 'demo-alice-morgan-studio',
    name: 'Alice Morgan Demo Portfolio',
    orgType: 'individual',
    description: 'Isolated demo portfolio for Individual Asset Owner Alice Morgan.',
    ownerUserId: alice.id,
    isPersonal: true,
    workspaceName: 'Alice Asset Portfolio',
    workspaceSlug: 'alice-portfolio',
  });

  const bobOrgData = await ensureOrganization(db, {
    slug: 'demo-horizon-ventures',
    name: 'Horizon Demo Ventures',
    orgType: 'enterprise',
    website: 'https://horizon-demo.example.test',
    description: 'Isolated demo buyer organization for Bob Wilson.',
    ownerUserId: bob.id,
    isPersonal: false,
    workspaceName: 'Acquisition Sourcing',
    workspaceSlug: 'sourcing',
  });

  const northstarOrgData = await ensureOrganization(db, {
    slug: 'demo-northstar-labs',
    name: 'Northstar Demo Labs',
    orgType: 'studio',
    website: 'https://northstar-demo.example.test',
    description: 'Isolated demo studio managed by Diana Miller with developer Charlie Brown.',
    ownerUserId: diana.id,
    isPersonal: false,
    workspaceName: 'Core Engineering Vault',
    workspaceSlug: 'core-vault',
  });

  const ethanOrgData = await ensureOrganization(db, {
    slug: 'demo-platform-governance',
    name: 'SecondLife Demo Governance',
    orgType: 'enterprise',
    description: 'Isolated demo platform governance workspace for Ethan Taylor.',
    ownerUserId: ethan.id,
    isPersonal: true,
    workspaceName: 'Governance Desk',
    workspaceSlug: 'governance',
  });

  // Organization Memberships (idempotent)
  const membershipSeeds = [
    { organizationId: aliceOrgData.org.id, userId: alice.id, role: 'individual_owner', status: 'active' },
    { organizationId: bobOrgData.org.id, userId: bob.id, role: 'buyer', status: 'active' },
    { organizationId: northstarOrgData.org.id, userId: diana.id, role: 'org_admin', status: 'active' },
    { organizationId: northstarOrgData.org.id, userId: charlie.id, role: 'developer', status: 'active' },
    { organizationId: ethanOrgData.org.id, userId: ethan.id, role: 'platform_admin', status: 'active' },
  ];
  for (const m of membershipSeeds) {
    await db
      .insert(organizationMembers)
      .values(m)
      .onConflictDoNothing({ target: [organizationMembers.organizationId, organizationMembers.userId] });
  }

  const proPlan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.code, 'pro_growth'),
  });
  if (proPlan) {
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    for (const orgId of [aliceOrgData.org.id, bobOrgData.org.id, northstarOrgData.org.id]) {
      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.organizationId, orgId),
      });
      if (!existingSub) {
        await db.insert(subscriptions).values({
          organizationId: orgId,
          planId: proPlan.id,
          status: 'active',
          currentPeriodEnd: nextMonth,
        });
      }
    }
  }

  const allCats = await db.select().from(assetCategories);
  const catBySlug = Object.fromEntries(allCats.map((c) => [c.slug, c.id]));

  const demoAssetsInput = [
    {
      assetCode: 'SL-DEMO-0001',
      organizationId: aliceOrgData.org.id,
      workspaceId: aliceOrgData.ws.id,
      ownerUserId: alice.id,
      categoryId: catBySlug['fintech-billing'],
      name: 'KathaLedger — Double-Entry GST Invoicing & Reconciliation Engine',
      slug: 'demo-kathaledger-gst-reconciliation',
      shortSummary:
        'Production-tested TypeScript & PostgreSQL double-entry ledger with GST e-invoice schema builders and automated bank statement matching.',
      description:
        'Demo sample asset submitted by Alice Morgan. Includes immutable journal entries, idempotent webhook ingestion, and 84 unit/integration tests.',
      assetType: 'api_service',
      primaryLanguage: 'TypeScript',
      techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Express', 'Vitest'],
      declaredLicense: 'Proprietary Commercial Transfer',
      repoUrl: 'https://github.com/demo-secondlife/kathaledger',
      techScore: 86,
      maintScore: 82,
      secScore: 89,
      docScore: 84,
      reusability: 88,
      opportunity: 84,
      revivalMin: 60,
      revivalMax: 110,
      priceMinor: 45000000,
      listingType: 'exclusive_license',
      publish: true,
    },
    {
      assetCode: 'SL-DEMO-0002',
      organizationId: northstarOrgData.org.id,
      workspaceId: northstarOrgData.ws.id,
      ownerUserId: charlie.id,
      categoryId: catBySlug['devops-security'],
      name: 'TracePulse — Lightweight OpenTelemetry Log & Latency Correlator',
      slug: 'demo-tracepulse-otel-correlator',
      shortSummary:
        'Python & FastAPI anomaly detector correlating structured logs with trace latency spikes without heavy APM overhead.',
      description:
        'Demo sample asset maintained by Charlie Brown inside Northstar Demo Labs. Uses sliding-window z-score detection and scikit-learn clustering.',
      assetType: 'developer_tool',
      primaryLanguage: 'Python',
      techStack: ['Python', 'FastAPI', 'NumPy', 'Scikit-learn', 'Redis'],
      declaredLicense: 'MIT (Dual Commercial Support Available)',
      repoUrl: 'https://github.com/demo-secondlife/tracepulse',
      techScore: 79,
      maintScore: 76,
      secScore: 85,
      docScore: 74,
      reusability: 83,
      opportunity: 78,
      revivalMin: 90,
      revivalMax: 150,
      priceMinor: 18000000,
      listingType: 'non_exclusive_license',
      publish: true,
    },
    {
      assetCode: 'SL-DEMO-0003',
      organizationId: northstarOrgData.org.id,
      workspaceId: northstarOrgData.ws.id,
      ownerUserId: diana.id,
      categoryId: catBySlug['ai-ml-algorithms'],
      name: 'ClauseLens — Deterministic Contract & License Extraction Pipeline',
      slug: 'demo-clauselens-contract-extraction',
      shortSummary:
        'Hybrid rule-based + NLP extraction engine for parsing software license obligations, indemnity caps, and renewal dates.',
      description:
        'Demo sample asset under Northstar Demo Labs ready for commercial licensing or revival partnerships.',
      assetType: 'algorithm_model',
      primaryLanguage: 'Python',
      techStack: ['Python', 'Scikit-learn', 'FastAPI', 'Docker'],
      declaredLicense: 'Proprietary Commercial Transfer',
      repoUrl: 'https://github.com/demo-secondlife/clauselens',
      techScore: 81,
      maintScore: 73,
      secScore: 88,
      docScore: 80,
      reusability: 85,
      opportunity: 87,
      revivalMin: 120,
      revivalMax: 200,
      priceMinor: 65000000,
      listingType: 'full_transfer',
      publish: true,
    },
    {
      assetCode: 'SL-DEMO-0004',
      organizationId: aliceOrgData.org.id,
      workspaceId: aliceOrgData.ws.id,
      ownerUserId: alice.id,
      categoryId: catBySlug['developer-tools'],
      name: 'MetricBridge — Schema-First Telemetry Forwarder (Pending Verification)',
      slug: 'demo-metricbridge-telemetry-forwarder',
      shortSummary:
        'Lightweight Go telemetry forwarder awaiting specialist ownership verification in the demo queue.',
      description:
        'Demo draft asset owned by Alice Morgan demonstrating the pending verification workflow.',
      assetType: 'developer_tool',
      primaryLanguage: 'Go',
      techStack: ['Go', 'gRPC', 'Prometheus'],
      declaredLicense: 'Apache-2.0',
      repoUrl: 'https://github.com/demo-secondlife/metricbridge',
      techScore: 77,
      maintScore: 75,
      secScore: 82,
      docScore: 71,
      reusability: 80,
      opportunity: 74,
      revivalMin: 50,
      revivalMax: 90,
      priceMinor: 12000000,
      listingType: 'non_exclusive_license',
      publish: false,
    },
  ];

  let firstPublishedAssetId: string | null = null;

  for (const item of demoAssetsInput) {
    const existingAsset = await db.query.assets.findFirst({
      where: eq(assets.assetCode, item.assetCode),
    });
    if (existingAsset) {
      if (item.publish && !firstPublishedAssetId) firstPublishedAssetId = existingAsset.id;
      continue;
    }

    const [asset] = await db
      .insert(assets)
      .values({
        assetCode: item.assetCode,
        organizationId: item.organizationId,
        workspaceId: item.workspaceId,
        ownerUserId: item.ownerUserId,
        categoryId: item.categoryId,
        name: item.name,
        slug: item.slug,
        shortSummary: item.shortSummary,
        description: item.description,
        assetType: item.assetType,
        lifecycleStatus: item.publish ? 'published' : 'under_review',
        technicalEvalStatus: 'completed',
        commercialEvalStatus: 'completed',
        verificationStatus: item.publish ? 'verified' : 'pending_review',
        marketplaceStatus: item.publish ? 'published' : 'unpublished',
        primaryLanguage: item.primaryLanguage,
        techStack: item.techStack,
        declaredLicense: item.declaredLicense,
        isDemoSeed: true,
      })
      .returning();

    if (item.publish && !firstPublishedAssetId) firstPublishedAssetId = asset.id;

    const [version] = await db
      .insert(assetVersions)
      .values({
        assetId: asset.id,
        versionTag: '1.4.0',
        fileCount: 142,
        totalSizeBytes: 2_450_000,
        ingestionStatus: 'completed',
        createdByUserId: item.ownerUserId,
      })
      .returning();

    await db.insert(repositories).values({
      assetId: asset.id,
      provider: 'github',
      repoUrl: item.repoUrl,
      repoFullName: item.repoUrl.replace('https://github.com/', ''),
      defaultBranch: 'main',
      isPrivate: false,
      externalStars: 48,
      externalForks: 9,
      lastCommitAt: new Date(Date.now() - 290 * 24 * 60 * 60 * 1000),
      lastSyncedAt: new Date(),
    });

    await db.insert(assetMetadata).values({
      assetId: asset.id,
      languagesBreakdown: { [item.primaryLanguage]: 84, Shell: 8, Markdown: 8 },
      frameworksDetected: item.techStack,
      linesOfCode: 18400,
      hasTests: true,
      hasReadme: true,
      hasCiConfig: true,
    });

    await db.insert(ownershipRecords).values({
      assetId: asset.id,
      claimantUserId: item.ownerUserId,
      organizationId: item.organizationId,
      claimantType: 'corporate_owner',
      ownershipPercentage: 100,
      hasThirdPartyCode: false,
      contributorsSummary: 'Demo IP assignment attestation on file.',
      attestationAccepted: true,
      attestedAt: new Date(),
    });

    await db.insert(licenses).values({
      assetId: asset.id,
      spdxId: item.declaredLicense.startsWith('MIT') ? 'MIT' : 'PROPRIETARY',
      licenseName: item.declaredLicense,
      detectedSource: 'declared',
      commercialTransferAllowed: true,
      copyleftRisk: 'none',
    });

    const [verReq] = await db
      .insert(verificationRequests)
      .values({
        assetId: asset.id,
        submittedByUserId: item.ownerUserId,
        assignedReviewerId: item.publish ? ethan.id : null,
        status: item.publish ? 'approved' : 'pending',
        ipConflictFlag: false,
        licenseRiskLevel: 'low',
        reviewerNotes: item.publish ? 'Demo ownership and license check passed.' : null,
        decisionReason: item.publish ? 'Approved for demo marketplace.' : null,
        reviewedAt: item.publish ? new Date() : null,
      })
      .returning();

    await db.insert(verificationEvidence).values({
      verificationRequestId: verReq.id,
      evidenceType: 'declaration',
      title: 'Demo Ownership Declaration',
      contentSummary: 'Isolated demo environment ownership attestation.',
    });

    const [job] = await db
      .insert(analysisJobs)
      .values({
        assetId: asset.id,
        assetVersionId: version.id,
        requestedByUserId: item.ownerUserId,
        jobType: 'full_evaluation',
        status: 'completed',
        engineMode: 'deterministic_python',
        durationMs: 1240,
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning();

    const [techReport] = await db
      .insert(technicalReports)
      .values({
        assetId: asset.id,
        assetVersionId: version.id,
        analysisJobId: job.id,
        technicalScore: item.techScore,
        maintainabilityScore: item.maintScore,
        securityScore: item.secScore,
        documentationScore: item.docScore,
        confidenceLevel: '0.84',
        analysisMethods: ['AST structural parse', 'Dependency manifest scan', 'Secret regex check'],
        dataSources: ['Demo repository snapshot'],
        architectureSummary: `Modular ${item.primaryLanguage} codebase with automated test suite and CI configuration.`,
        reusableComponents: ['Core domain engine', 'Validation schemas', 'Service adapters'],
        dependencySummary: { totalDependencies: 24, outdatedCount: 4, knownCriticalCves: 0 },
        knownLimitations: ['Demo seed evaluation snapshot; runtime benchmark excluded.'],
        humanReviewStatus: item.publish ? 'approved' : 'pending_review',
      })
      .returning();

    await db.insert(riskFindings).values({
      technicalReportId: techReport.id,
      assetId: asset.id,
      category: 'dependency',
      severity: 'low',
      title: 'Minor outdated runtime dependency versions',
      description: '4 non-critical packages are 1-2 minor versions behind latest.',
      remediation: 'Refresh dependency lockfile during onboarding.',
    });

    await db.insert(commercialReports).values({
      assetId: asset.id,
      technicalReportId: techReport.id,
      reusabilityScore: item.reusability,
      commercialOpportunityScore: item.opportunity,
      estimatedRevivalHoursMin: item.revivalMin,
      estimatedRevivalHoursMax: item.revivalMax,
      estimatedRevivalCostInrMin: item.revivalMin * 250000,
      estimatedRevivalCostInrMax: item.revivalMax * 350000,
      suggestedValueRangeInrMin: Math.round(item.priceMinor * 0.85),
      suggestedValueRangeInrMax: Math.round(item.priceMinor * 1.25),
      confidenceLevel: '0.78',
      targetSegments: ['B2B SaaS Engineering Teams', 'Growth-stage FinTechs'],
      industryApplications: ['Enterprise SaaS', 'Developer Productivity'],
      modernizationRequirements: ['Update dependency lockfiles', 'Validate telemetry hooks'],
      documentedAssumptions: ['Blended revival rate modeled at INR 2,500 - 3,500/hr'],
      uncertaintyFactors: ['Integration effort varies by buyer infrastructure'],
    });

    if (item.publish) {
      await db.insert(marketplaceListings).values({
        assetId: asset.id,
        organizationId: item.organizationId,
        title: item.name,
        summary: item.shortSummary,
        listingType: item.listingType,
        currency: 'INR',
        askingPriceMinor: item.priceMinor,
        commercialTerms: 'Demo commercial terms: includes source snapshot and 30-day handover.',
        exclusivityAvailable: item.listingType !== 'non_exclusive_license',
        supportIncludedDays: 30,
        status: 'active',
        moderationStatus: 'approved',
      });
    }
  }

  // Bob's demo buyer data (saved asset + requirement)
  if (firstPublishedAssetId) {
    await db
      .insert(savedAssets)
      .values({ userId: bob.id, assetId: firstPublishedAssetId, notes: 'Demo shortlist item' })
      .onConflictDoNothing();
  }

  const existingBobReq = await db.query.buyerRequirements.findFirst({
    where: eq(buyerRequirements.userId, bob.id),
  });
  if (!existingBobReq) {
    await db.insert(buyerRequirements).values({
      userId: bob.id,
      organizationId: bobOrgData.org.id,
      title: 'Demo Requirement: TypeScript Ledger & FinTech Engine',
      description: 'Looking for verified TypeScript & PostgreSQL billing modules for rapid deployment.',
      preferredCategories: ['fintech-billing'],
      requiredTechnologies: ['TypeScript', 'PostgreSQL'],
      preferredListingTypes: ['exclusive_license', 'non_exclusive_license'],
      maxBudgetMinor: 60000000,
      minTechnicalScore: 70,
    });
  }

  const existingCand = await db.query.discoveryCandidates.findFirst({
    where: eq(discoveryCandidates.organizationId, northstarOrgData.org.id),
  });
  if (!existingCand) {
    await db.insert(discoveryCandidates).values({
      organizationId: northstarOrgData.org.id,
      provider: 'github',
      repoFullName: 'demo-secondlife/legacy-webhook-relay',
      repoUrl: 'https://github.com/demo-secondlife/legacy-webhook-relay',
      primaryLanguage: 'Go',
      detectedLicense: 'Apache-2.0',
      inactivityDays: 412,
      inactivitySignals: {
        daysSinceLastCommit: 412,
        openIssues: 11,
        archived: false,
        note: 'Candidate for review only; inactivity never proves abandonment.',
      },
      candidateScore: 76,
      status: 'candidate',
    });
  }

  logger.info('Repeatable development/demo seed completed for all 5 demo accounts');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}

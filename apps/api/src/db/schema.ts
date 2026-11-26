import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  numeric,
} from 'drizzle-orm/pg-core';

// ============================================================================
// MODULE 1: IDENTITY, ORGANIZATION & WORKSPACE MANAGEMENT
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash'),
    fullName: varchar('full_name', { length: 120 }).notNull(),
    headline: varchar('headline', { length: 200 }),
    bio: text('bio'),
    primaryRole: varchar('primary_role', { length: 48 }).notNull().default('individual_owner'),
    accountStatus: varchar('account_status', { length: 32 }).notNull().default('active'),
    isDemoAccount: boolean('is_demo_account').notNull().default(false),
    authProvider: varchar('auth_provider', { length: 32 }).notNull().default('local'),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    notificationPrefs: jsonb('notification_prefs')
      .$type<{ emailDeals: boolean; emailVerification: boolean; emailMarketing: boolean }>()
      .notNull()
      .default({ emailDeals: true, emailVerification: true, emailMarketing: false }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // google
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(), // OIDC sub
    email: varchar('email', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('oauth_provider_sub_idx').on(t.provider, t.providerAccountId),
    index('oauth_accounts_user_idx').on(t.userId),
  ],
);

export const oauthStates = pgTable(
  'oauth_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    stateHash: text('state_hash').notNull(),
    nonce: varchar('nonce', { length: 128 }).notNull(),
    codeVerifier: varchar('code_verifier', { length: 128 }).notNull(),
    redirectPath: varchar('redirect_path', { length: 300 }).notNull().default('/dashboard/owner'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('oauth_states_hash_idx').on(t.stateHash)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    activeOrgId: uuid('active_org_id'),
    activeWorkspaceId: uuid('active_workspace_id'),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const emailTokens = pgTable(
  'email_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenType: varchar('token_type', { length: 32 }).notNull(), // email_verify | password_reset
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('email_tokens_hash_idx').on(t.tokenHash)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    orgType: varchar('org_type', { length: 32 }).notNull().default('startup'),
    website: varchar('website', { length: 255 }),
    description: text('description'),
    verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('unverified'),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isPersonal: boolean('is_personal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('orgs_slug_idx').on(t.slug)],
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 48 }).notNull(),
    customPermissions: jsonb('custom_permissions').$type<string[]>().notNull().default([]),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('org_member_unique_idx').on(t.organizationId, t.userId),
    index('org_member_user_idx').on(t.userId),
  ],
);

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 48 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('org_invite_org_idx').on(t.organizationId)],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    description: text('description'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('workspace_org_slug_idx').on(t.organizationId, t.slug)],
);

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 48 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    monthlyPriceMinor: integer('monthly_price_minor').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    maxAssets: integer('max_assets').notNull().default(5),
    maxTeamSeats: integer('max_team_seats').notNull().default(1),
    features: jsonb('features').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('sub_plan_code_idx').on(t.code)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).defaultNow().notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('subscriptions_org_idx').on(t.organizationId)],
);

// ============================================================================
// MODULE 2 & 3: ASSET DISCOVERY, REGISTRY & LIFECYCLE MANAGEMENT
// ============================================================================

export const assetCategories = pgTable(
  'asset_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 80 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('asset_category_slug_idx').on(t.slug)],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetCode: varchar('asset_code', { length: 32 }).notNull(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => assetCategories.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    shortSummary: varchar('short_summary', { length: 300 }).notNull(),
    description: text('description').notNull(),
    assetType: varchar('asset_type', { length: 48 }).notNull(),
    lifecycleStatus: varchar('lifecycle_status', { length: 40 }).notNull().default('draft'),
    technicalEvalStatus: varchar('technical_eval_status', { length: 32 }).notNull().default('pending'),
    commercialEvalStatus: varchar('commercial_eval_status', { length: 32 }).notNull().default('pending'),
    verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('unverified'),
    marketplaceStatus: varchar('marketplace_status', { length: 32 }).notNull().default('unpublished'),
    primaryLanguage: varchar('primary_language', { length: 60 }),
    techStack: jsonb('tech_stack').$type<string[]>().notNull().default([]),
    declaredLicense: varchar('declared_license', { length: 120 }).notNull().default('Proprietary / Unlicensed'),
    documentationNotes: text('documentation_notes'),
    isDemoSeed: boolean('is_demo_seed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('assets_code_idx').on(t.assetCode),
    uniqueIndex('assets_slug_idx').on(t.slug),
    index('assets_org_idx').on(t.organizationId),
    index('assets_status_idx').on(t.lifecycleStatus),
  ],
);

export const assetVersions = pgTable(
  'asset_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    versionTag: varchar('version_tag', { length: 40 }).notNull(),
    commitSha: varchar('commit_sha', { length: 64 }),
    archiveStorageKey: varchar('archive_storage_key', { length: 500 }),
    archiveSha256: varchar('archive_sha256', { length: 64 }),
    fileCount: integer('file_count').notNull().default(0),
    totalSizeBytes: bigint('total_size_bytes', { mode: 'number' }).notNull().default(0),
    ingestionStatus: varchar('ingestion_status', { length: 32 }).notNull().default('pending'),
    ingestionError: text('ingestion_error'),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('asset_versions_asset_idx').on(t.assetId)],
);

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // github | gitlab | bitbucket | archive | manual
    repoUrl: varchar('repo_url', { length: 500 }),
    repoFullName: varchar('repo_full_name', { length: 200 }),
    defaultBranch: varchar('default_branch', { length: 80 }).default('main'),
    isPrivate: boolean('is_private').notNull().default(false),
    externalStars: integer('external_stars').default(0),
    externalForks: integer('external_forks').default(0),
    lastCommitAt: timestamp('last_commit_at', { withTimezone: true }),
    metadataSnapshot: jsonb('metadata_snapshot').$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('repositories_asset_idx').on(t.assetId)],
);

export const assetMetadata = pgTable(
  'asset_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    languagesBreakdown: jsonb('languages_breakdown').$type<Record<string, number>>().notNull().default({}),
    frameworksDetected: jsonb('frameworks_detected').$type<string[]>().notNull().default([]),
    linesOfCode: integer('lines_of_code').notNull().default(0),
    hasTests: boolean('has_tests').notNull().default(false),
    hasReadme: boolean('has_readme').notNull().default(false),
    hasCiConfig: boolean('has_ci_config').notNull().default(false),
    extraAttributes: jsonb('extra_attributes').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('asset_metadata_asset_idx').on(t.assetId)],
);

export const assetHistory = pgTable(
  'asset_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    fromStatus: varchar('from_status', { length: 40 }),
    toStatus: varchar('to_status', { length: 40 }),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('asset_history_asset_idx').on(t.assetId)],
);

export const discoveryCandidates = pgTable(
  'discovery_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    repoFullName: varchar('repo_full_name', { length: 200 }).notNull(),
    repoUrl: varchar('repo_url', { length: 500 }).notNull(),
    primaryLanguage: varchar('primary_language', { length: 60 }),
    detectedLicense: varchar('detected_license', { length: 120 }),
    inactivityDays: integer('inactivity_days').notNull().default(0),
    inactivitySignals: jsonb('inactivity_signals').$type<Record<string, unknown>>().notNull().default({}),
    candidateScore: integer('candidate_score').notNull().default(0),
    status: varchar('status', { length: 32 }).notNull().default('candidate'), // candidate | imported | dismissed
    importedAssetId: uuid('imported_asset_id').references(() => assets.id, { onDelete: 'set null' }),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('discovery_candidates_org_idx').on(t.organizationId)],
);

// ============================================================================
// MODULE 4: OWNERSHIP, VERIFICATION & COMPLIANCE
// ============================================================================

export const ownershipRecords = pgTable(
  'ownership_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    claimantUserId: uuid('claimant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    claimantType: varchar('claimant_type', { length: 48 }).notNull(),
    ownershipPercentage: integer('ownership_percentage').notNull().default(100),
    hasThirdPartyCode: boolean('has_third_party_code').notNull().default(false),
    thirdPartySummary: text('third_party_summary'),
    contributorsSummary: text('contributors_summary'),
    attestationAccepted: boolean('attestation_accepted').notNull().default(false),
    attestedAt: timestamp('attested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ownership_asset_idx').on(t.assetId)],
);

export const contributors = pgTable(
  'contributors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }),
    role: varchar('role', { length: 64 }).notNull().default('contributor'),
    rightsAssigned: boolean('rights_assigned').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('contributors_asset_idx').on(t.assetId)],
);

export const licenses = pgTable(
  'licenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    spdxId: varchar('spdx_id', { length: 80 }).notNull(),
    licenseName: varchar('license_name', { length: 160 }).notNull(),
    detectedSource: varchar('detected_source', { length: 64 }).notNull(), // declared | file_scan | repo_api
    commercialTransferAllowed: boolean('commercial_transfer_allowed').notNull().default(false),
    copyleftRisk: varchar('copyleft_risk', { length: 32 }).notNull().default('unknown'), // none | weak | strong | unknown
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('licenses_asset_idx').on(t.assetId)],
);

export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    submittedByUserId: uuid('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 32 }).notNull().default('pending'), // pending | in_review | approved | rejected | changes_requested
    ipConflictFlag: boolean('ip_conflict_flag').notNull().default(false),
    licenseRiskLevel: varchar('license_risk_level', { length: 24 }).notNull().default('unknown'),
    reviewerNotes: text('reviewer_notes'),
    decisionReason: text('decision_reason'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('verification_asset_idx').on(t.assetId), index('verification_status_idx').on(t.status)],
);

export const verificationEvidence = pgTable(
  'verification_evidence',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    verificationRequestId: uuid('verification_request_id')
      .notNull()
      .references(() => verificationRequests.id, { onDelete: 'cascade' }),
    evidenceType: varchar('evidence_type', { length: 48 }).notNull(), // declaration | repo_token_proof | corporate_doc | cla_record
    title: varchar('title', { length: 160 }).notNull(),
    contentSummary: text('content_summary').notNull(),
    storageKey: varchar('storage_key', { length: 500 }),
    sha256: varchar('sha256', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('verification_evidence_req_idx').on(t.verificationRequestId)],
);

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id'),
    filedByUserId: uuid('filed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    disputeType: varchar('dispute_type', { length: 48 }).notNull(), // ownership_claim | license_violation | takedown | transaction_refund
    severity: varchar('severity', { length: 24 }).notNull().default('high'),
    description: text('description').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'), // open | investigating | resolved_upheld | resolved_dismissed
    resolutionNotes: text('resolution_notes'),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('disputes_asset_idx').on(t.assetId), index('disputes_status_idx').on(t.status)],
);

// ============================================================================
// MODULE 5 & 6: AI TECHNICAL & COMMERCIAL INTELLIGENCE
// ============================================================================

export const analysisJobs = pgTable(
  'analysis_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetVersionId: uuid('asset_version_id').references(() => assetVersions.id, { onDelete: 'set null' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    jobType: varchar('job_type', { length: 32 }).notNull().default('full_evaluation'),
    status: varchar('status', { length: 32 }).notNull().default('queued'), // queued | running | completed | failed
    engineMode: varchar('engine_mode', { length: 48 }).notNull().default('deterministic_python'),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('analysis_jobs_asset_idx').on(t.assetId), index('analysis_jobs_status_idx').on(t.status)],
);

export const technicalReports = pgTable(
  'technical_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    assetVersionId: uuid('asset_version_id').references(() => assetVersions.id, { onDelete: 'set null' }),
    analysisJobId: uuid('analysis_job_id')
      .notNull()
      .references(() => analysisJobs.id, { onDelete: 'cascade' }),
    technicalScore: integer('technical_score').notNull(),
    maintainabilityScore: integer('maintainability_score').notNull(),
    securityScore: integer('security_score').notNull(),
    documentationScore: integer('documentation_score').notNull(),
    confidenceLevel: numeric('confidence_level', { precision: 4, scale: 2 }).notNull(),
    analysisMethods: jsonb('analysis_methods').$type<string[]>().notNull().default([]),
    dataSources: jsonb('data_sources').$type<string[]>().notNull().default([]),
    architectureSummary: text('architecture_summary').notNull(),
    reusableComponents: jsonb('reusable_components').$type<string[]>().notNull().default([]),
    dependencySummary: jsonb('dependency_summary').$type<Record<string, unknown>>().notNull().default({}),
    knownLimitations: jsonb('known_limitations').$type<string[]>().notNull().default([]),
    humanReviewStatus: varchar('human_review_status', { length: 32 }).notNull().default('pending_review'),
    humanReviewerNotes: text('human_reviewer_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('technical_reports_asset_idx').on(t.assetId)],
);

export const riskFindings = pgTable(
  'risk_findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    technicalReportId: uuid('technical_report_id')
      .notNull()
      .references(() => technicalReports.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 48 }).notNull(), // secret | security_pattern | dependency | license | quality
    severity: varchar('severity', { length: 24 }).notNull(), // critical | high | medium | low | info
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    filePath: varchar('file_path', { length: 500 }),
    lineNumber: integer('line_number'),
    evidenceSnippet: text('evidence_snippet'),
    remediation: text('remediation'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('risk_findings_report_idx').on(t.technicalReportId)],
);

export const commercialReports = pgTable(
  'commercial_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    technicalReportId: uuid('technical_report_id')
      .notNull()
      .references(() => technicalReports.id, { onDelete: 'cascade' }),
    reusabilityScore: integer('reusability_score').notNull(),
    commercialOpportunityScore: integer('commercial_opportunity_score').notNull(),
    estimatedRevivalHoursMin: integer('estimated_revival_hours_min').notNull(),
    estimatedRevivalHoursMax: integer('estimated_revival_hours_max').notNull(),
    estimatedRevivalCostInrMin: bigint('estimated_revival_cost_inr_min', { mode: 'number' }).notNull(),
    estimatedRevivalCostInrMax: bigint('estimated_revival_cost_inr_max', { mode: 'number' }).notNull(),
    suggestedValueRangeInrMin: bigint('suggested_value_range_inr_min', { mode: 'number' }).notNull(),
    suggestedValueRangeInrMax: bigint('suggested_value_range_inr_max', { mode: 'number' }).notNull(),
    confidenceLevel: numeric('confidence_level', { precision: 4, scale: 2 }).notNull(),
    targetSegments: jsonb('target_segments').$type<string[]>().notNull().default([]),
    industryApplications: jsonb('industry_applications').$type<string[]>().notNull().default([]),
    modernizationRequirements: jsonb('modernization_requirements').$type<string[]>().notNull().default([]),
    documentedAssumptions: jsonb('documented_assumptions').$type<string[]>().notNull().default([]),
    uncertaintyFactors: jsonb('uncertainty_factors').$type<string[]>().notNull().default([]),
    humanOverrideNotes: text('human_override_notes'),
    overriddenByUserId: uuid('overridden_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('commercial_reports_asset_idx').on(t.assetId)],
);

// ============================================================================
// MODULE 7: ASSET MARKETPLACE & DISCOVERY EXPERIENCE
// ============================================================================

export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 160 }).notNull(),
    summary: text('summary').notNull(),
    listingType: varchar('listing_type', { length: 48 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    askingPriceMinor: bigint('asking_price_minor', { mode: 'number' }).notNull(),
    commercialTerms: text('commercial_terms').notNull(),
    exclusivityAvailable: boolean('exclusivity_available').notNull().default(false),
    supportIncludedDays: integer('support_included_days').notNull().default(30),
    status: varchar('status', { length: 32 }).notNull().default('active'), // active | paused | closed | suspended
    moderationStatus: varchar('moderation_status', { length: 32 }).notNull().default('approved'),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('listings_asset_idx').on(t.assetId),
    index('listings_status_idx').on(t.status),
  ],
);

export const savedAssets = pgTable(
  'saved_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('saved_assets_user_asset_idx').on(t.userId, t.assetId)],
);

export const buyerRequirements = pgTable(
  'buyer_requirements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description').notNull(),
    preferredCategories: jsonb('preferred_categories').$type<string[]>().notNull().default([]),
    requiredTechnologies: jsonb('required_technologies').$type<string[]>().notNull().default([]),
    preferredListingTypes: jsonb('preferred_listing_types').$type<string[]>().notNull().default([]),
    preferredLicenses: jsonb('preferred_licenses').$type<string[]>().notNull().default([]),
    budgetCurrency: varchar('budget_currency', { length: 8 }).notNull().default('INR'),
    maxBudgetMinor: bigint('max_budget_minor', { mode: 'number' }),
    minTechnicalScore: integer('min_technical_score').notNull().default(50),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('buyer_req_user_idx').on(t.userId)],
);

export const assetMatches = pgTable(
  'asset_matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    buyerRequirementId: uuid('buyer_requirement_id')
      .notNull()
      .references(() => buyerRequirements.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    matchScore: integer('match_score').notNull(),
    explanation: jsonb('explanation').$type<{ reasons: string[]; gaps: string[] }>().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('asset_match_req_asset_idx').on(t.buyerRequirementId, t.assetId)],
);

// ============================================================================
// MODULE 8: MATCHING, COLLABORATION & DEAL MANAGEMENT
// ============================================================================

export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id').references(() => marketplaceListings.id, { onDelete: 'set null' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    ownerOrgId: uuid('owner_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    subject: varchar('subject', { length: 160 }).notNull(),
    intendedUse: varchar('intended_use', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'), // open | accepted | declined | converted_to_deal
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('inquiries_asset_idx').on(t.assetId), index('inquiries_buyer_idx').on(t.buyerUserId)],
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inquiryId: uuid('inquiry_id').references(() => inquiries.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id'),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    ownerOrgId: uuid('owner_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('conversations_asset_idx').on(t.assetId)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    messageType: varchar('message_type', { length: 32 }).notNull().default('text'), // text | due_diligence_request | system
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('messages_conv_idx').on(t.conversationId)],
);

export const deals = pgTable(
  'deals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealCode: varchar('deal_code', { length: 32 }).notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    listingId: uuid('listing_id').references(() => marketplaceListings.id, { onDelete: 'set null' }),
    inquiryId: uuid('inquiry_id').references(() => inquiries.id, { onDelete: 'set null' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    buyerOrgId: uuid('buyer_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ownerOrgId: uuid('owner_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    dealType: varchar('deal_type', { length: 48 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('negotiation'), // negotiation | due_diligence | agreement_pending | payment_pending | handover_pending | completed | cancelled | disputed
    agreedAmountMinor: bigint('agreed_amount_minor', { mode: 'number' }),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    dueDiligenceStatus: varchar('due_diligence_status', { length: 32 }).notNull().default('not_requested'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('deals_code_idx').on(t.dealCode), index('deals_asset_idx').on(t.assetId)],
);

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    proposedByUserId: uuid('proposed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull().default(1),
    offerType: varchar('offer_type', { length: 48 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    termsSummary: text('terms_summary').notNull(),
    dueDiligenceRequired: boolean('due_diligence_required').notNull().default(true),
    supportDays: integer('support_days').notNull().default(30),
    status: varchar('status', { length: 24 }).notNull().default('pending'), // pending | accepted | rejected | countered | withdrawn
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('offers_deal_idx').on(t.dealId)],
);

export const agreements = pgTable(
  'agreements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    agreementType: varchar('agreement_type', { length: 48 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    termsBody: text('terms_body').notNull(),
    documentHash: varchar('document_hash', { length: 64 }).notNull(),
    ownerAcceptedAt: timestamp('owner_accepted_at', { withTimezone: true }),
    buyerAcceptedAt: timestamp('buyer_accepted_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('draft'), // draft | pending_signatures | executed | void
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('agreements_deal_idx').on(t.dealId)],
);

// ============================================================================
// MODULE 9: TRANSACTIONS, LICENSING & ASSET HANDOVER
// ============================================================================

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionCode: varchar('transaction_code', { length: 32 }).notNull(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'restrict' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'restrict' }),
    payerUserId: uuid('payer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    payeeOrgId: uuid('payee_org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    transactionType: varchar('transaction_type', { length: 48 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    grossAmountMinor: bigint('gross_amount_minor', { mode: 'number' }).notNull(),
    commissionRateBps: integer('commission_rate_bps').notNull(), // e.g., 1000 = 10%
    commissionAmountMinor: bigint('commission_amount_minor', { mode: 'number' }).notNull(),
    netPayoutMinor: bigint('net_payout_minor', { mode: 'number' }).notNull(),
    settlementMode: varchar('settlement_mode', { length: 48 }).notNull(), // razorpay_order | manual_invoice_settlement
    status: varchar('status', { length: 32 }).notNull().default('initiated'), // initiated | authorized | captured | settled | failed | refunded
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('transactions_code_idx').on(t.transactionCode),
    uniqueIndex('transactions_idempotency_idx').on(t.idempotencyKey),
    index('transactions_deal_idx').on(t.dealId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // razorpay | manual_bank_transfer
    providerOrderId: varchar('provider_order_id', { length: 120 }),
    providerPaymentId: varchar('provider_payment_id', { length: 120 }),
    providerSignatureVerified: boolean('provider_signature_verified').notNull().default(false),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('INR'),
    status: varchar('status', { length: 32 }).notNull().default('created'),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('payments_txn_idx').on(t.transactionId)],
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    reason: text('reason').notNull(),
    providerRefundId: varchar('provider_refund_id', { length: 120 }),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('refunds_txn_idx').on(t.transactionId)],
);

export const assetHandovers = pgTable(
  'asset_handovers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    assetVersionId: uuid('asset_version_id').references(() => assetVersions.id, { onDelete: 'set null' }),
    deliveredByUserId: uuid('delivered_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    deliveryPackageKey: varchar('delivery_package_key', { length: 500 }).notNull(),
    deliveryChecksumSha256: varchar('delivery_checksum_sha256', { length: 64 }).notNull(),
    deliveryNotes: text('delivery_notes'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).defaultNow().notNull(),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('delivered'), // delivered | accepted | disputed
  },
  (t) => [index('handovers_deal_idx').on(t.dealId)],
);

// ============================================================================
// MODULE 10: NOTIFICATIONS, AUDIT LOGS & SYSTEM CONFIGURATION
// ============================================================================

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 48 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    body: text('body').notNull(),
    actionUrl: varchar('action_url', { length: 300 }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 120 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 500 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_org_idx').on(t.organizationId),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_created_idx').on(t.createdAt),
  ],
);

export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    settingKey: varchar('setting_key', { length: 100 }).notNull(),
    settingValue: jsonb('setting_value').$type<unknown>().notNull(),
    description: text('description').notNull(),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('system_settings_key_idx').on(t.settingKey)],
);

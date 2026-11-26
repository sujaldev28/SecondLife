import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import AdmZip from 'adm-zip';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import { closeDb, resetDbForTesting, type Database } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { createApp } from '../app.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const client = new PGlite();
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Database;
  resetDbForTesting(db, client);
  await runMigrations();
  await seedDatabase();

  // Provision real (non-demo) verifier and admin accounts for E2E commercial tests
  const pwHash = await bcrypt.hash('TestAdmin@2026!', 6);
  await db.insert(schema.users).values([
    {
      email: 'verifier-e2e@example.com',
      passwordHash: pwHash,
      fullName: 'E2E Verifier',
      primaryRole: 'verification_specialist',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isDemoAccount: false,
    },
    {
      email: 'admin-e2e@example.com',
      passwordHash: pwHash,
      fullName: 'E2E Super Admin',
      primaryRole: 'super_admin',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isDemoAccount: false,
    },
  ]);

  app = createApp();
});

afterAll(async () => {
  await closeDb();
});

describe('SecondLife End-to-End Business Workflows & Security Verification', () => {
  let ownerToken = '';
  let ownerOrgId = '';
  let buyerToken = '';
  let buyerOrgId = '';
  let verifierToken = '';
  let adminToken = '';
  let assetId = '';
  let verificationRequestId = '';
  let listingId = '';
  let dealId = '';
  let transactionId = '';

  it('registers, verifies email, and authenticates a new asset owner', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: 'newowner@example.com',
      password: 'StrongPassword@123',
      confirmPassword: 'StrongPassword@123',
      fullName: 'Vikram Rao',
      accountType: 'organization',
      role: 'org_owner',
      organizationName: 'Rao Software Foundry',
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.devVerificationToken).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: regRes.body.devVerificationToken });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(true);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'newowner@example.com',
      password: 'StrongPassword@123',
    });
    expect(loginRes.status).toBe(200);
    ownerToken = loginRes.body.accessToken;
    ownerOrgId = loginRes.body.user.activeOrganizationId;
    expect(ownerToken).toBeTruthy();
  });

  it('registers real buyer and logs in verification specialist and super admin', async () => {
    const bReg = await request(app).post('/api/v1/auth/register').send({
      email: 'realbuyer@example.com',
      password: 'StrongPassword@123',
      confirmPassword: 'StrongPassword@123',
      fullName: 'Real Enterprise Buyer',
      accountType: 'organization',
      role: 'buyer',
      organizationName: 'Acquirer Corp',
    });
    expect(bReg.status).toBe(201);

    const [bRes, vRes, aRes] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'realbuyer@example.com', password: 'StrongPassword@123' }),
      request(app).post('/api/v1/auth/login').send({ email: 'verifier-e2e@example.com', password: 'TestAdmin@2026!' }),
      request(app).post('/api/v1/auth/login').send({ email: 'admin-e2e@example.com', password: 'TestAdmin@2026!' }),
    ]);

    expect(bRes.status).toBe(200);
    expect(vRes.status).toBe(200);
    expect(aRes.status).toBe(200);

    buyerToken = bRes.body.accessToken;
    buyerOrgId = bRes.body.user.activeOrganizationId;
    verifierToken = vRes.body.accessToken;
    adminToken = aRes.body.accessToken;
  });

  it('blocks SSRF URLs and Zip Slip malicious archives during asset submission', async () => {
    const ssrfRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'SSRF Probe Asset',
        description: 'Attempting to probe internal metadata server via repositoryUrl.',
        assetType: 'api_service',
        categorySlug: 'developer-tools',
        repositoryUrl: 'http://169.254.169.254/latest/meta-data/',
        repositoryProvider: 'github',
      });
    expect(ssrfRes.status).toBe(400);

    const createRes = await request(app)
      .post('/api/v1/assets')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'FinSync — Automated Reconciliation Worker',
        description:
          'Dormant TypeScript & Python worker for automated UPI settlement matching, ledger auditing, and exception alerting.',
        assetType: 'api_service',
        categorySlug: 'fintech-billing',
        primaryLanguage: 'TypeScript',
        techStack: ['TypeScript', 'PostgreSQL', 'Node.js'],
        declaredLicense: 'Proprietary Commercial Transfer',
        documentationNotes: '# FinSync\nComplete setup guide included.',
      });
    expect(createRes.status).toBe(201);
    assetId = createRes.body.asset.id;

    // Upload a real Zip Slip archive attempt (equal-length raw ZIP header overwrite)
    const evilZip = new AdmZip();
    evilZip.addFile('aa/bb/evil_f.sh', Buffer.from('rm -rf /'));
    const zipBuf = evilZip.toBuffer();
    const evilBuf = Buffer.from(zipBuf.toString('binary').replace(/aa\/bb\/evil_f\.sh/g, '../../evil_f.sh'), 'binary');
    const zipSlipRes = await request(app)
      .post(`/api/v1/assets/${assetId}/upload-archive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('archive', evilBuf, 'evil.zip');
    expect(zipSlipRes.status).toBe(400);
  });

  it('enforces tenant isolation (prevents cross-org IDOR & header spoofing)', async () => {
    const idorRead = await request(app)
      .get(`/api/v1/assets/${assetId}`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(idorRead.status).toBe(403);

    const spoofOrgHeader = await request(app)
      .get('/api/v1/assets')
      .set('Authorization', `Bearer ${buyerToken}`)
      .set('x-organization-id', ownerOrgId);
    expect(spoofOrgHeader.status).toBe(403);
  });

  it('uploads clean archive, runs static/AI evaluation, and blocks premature publishing', async () => {
    const cleanZip = new AdmZip();
    cleanZip.addFile('package.json', Buffer.from(JSON.stringify({ name: 'finsync', dependencies: { express: '^4.21.0' } })));
    cleanZip.addFile('src/index.ts', Buffer.from('export function reconcile(a: number, b: number) { return a === b; }\n'));
    cleanZip.addFile('tests/reconcile.test.ts', Buffer.from('expect(true).toBe(true);\n'));
    cleanZip.addFile('README.md', Buffer.from('# FinSync\nProduction ledger matcher.\n'));

    const uploadRes = await request(app)
      .post(`/api/v1/assets/${assetId}/upload-archive`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('archive', cleanZip.toBuffer(), 'finsync.zip');
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.inspection.fileCount).toBe(4);

    const analyzeRes = await request(app)
      .post(`/api/v1/assets/${assetId}/analyze`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(analyzeRes.status).toBe(201);
    expect(analyzeRes.body.technicalReport.technicalScore).toBeGreaterThan(60);
    expect(analyzeRes.body.commercialReport.documentedAssumptions.length).toBeGreaterThan(0);

    // Attempt to publish before ownership verification -> must fail!
    const prematurePublish = await request(app)
      .post(`/api/v1/assets/${assetId}/publish-listing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'FinSync Engine Commercial License',
        summary: 'Ready-to-deploy UPI reconciliation service with test coverage.',
        listingType: 'exclusive_license',
        currency: 'INR',
        askingPriceMinor: 30000000,
        commercialTerms: 'Exclusive 2-year commercial license with 30-day handover.',
      });
    expect(prematurePublish.status).toBe(400);
  });

  it('submits ownership declaration, prevents self-approval, and approves via Verification Specialist', async () => {
    const declRes = await request(app)
      .post(`/api/v1/assets/${assetId}/ownership-declaration`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        claimantType: 'corporate_owner',
        ownershipPercentage: 100,
        hasThirdPartyCode: false,
        contributorsSummary: 'Sole corporate employee authorship with IP assignment.',
        attestationAccepted: true,
        evidenceNotes: 'Board resolution and git commit log attached.',
      });
    expect(declRes.status).toBe(201);
    verificationRequestId = declRes.body.verificationRequest.id;

    // Owner tries to approve own verification -> 403 Forbidden
    const selfApprove = await request(app)
      .post(`/api/v1/verification/${verificationRequestId}/decision`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'approved', reviewerNotes: 'Self approval attempt' });
    expect(selfApprove.status).toBe(403);

    // Verification Specialist approves
    const approveRes = await request(app)
      .post(`/api/v1/verification/${verificationRequestId}/decision`)
      .set('Authorization', `Bearer ${verifierToken}`)
      .send({
        decision: 'approved',
        reviewerNotes: 'Corporate IP ownership and proprietary license verified.',
        ipConflictFlag: false,
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.verificationStatus).toBe('verified');
  });

  it('publishes listing, executes buyer matching, deal room, agreement, payment, and handover', async () => {
    const pubRes = await request(app)
      .post(`/api/v1/assets/${assetId}/publish-listing`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'FinSync — Automated UPI Reconciliation Engine',
        summary: 'Verified TypeScript reconciliation worker ready for enterprise adoption.',
        listingType: 'exclusive_license',
        currency: 'INR',
        askingPriceMinor: 30000000,
        commercialTerms: 'Exclusive commercial license + 30 days onboarding support.',
        exclusivityAvailable: true,
        supportIncludedDays: 30,
      });
    expect(pubRes.status).toBe(201);
    listingId = pubRes.body.listing.id;

    // Buyer defines requirements and receives recommendation
    const reqRes = await request(app)
      .post('/api/v1/buyer/requirements')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        title: 'Need TypeScript FinTech Reconciliation IP',
        description: 'Looking for verified PostgreSQL + TypeScript billing/reconciliation modules.',
        preferredCategories: ['fintech-billing'],
        requiredTechnologies: ['TypeScript', 'PostgreSQL'],
        minTechnicalScore: 60,
        maxBudgetMinor: 50000000,
      });
    expect(reqRes.status).toBe(201);

    const recRes = await request(app)
      .get('/api/v1/buyer/recommendations')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations.some((r: { assetId: string }) => r.assetId === assetId)).toBe(true);

    // Buyer submits inquiry -> Owner accepts -> Deal Room opened
    const inqRes = await request(app)
      .post('/api/v1/inquiries')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        assetId,
        listingId,
        subject: 'Exclusive License Inquiry for Meridian Cloud',
        message: 'We would like to review due diligence and negotiate an exclusive license.',
        intendedUse: 'license',
      });
    expect(inqRes.status).toBe(201);

    const acceptInq = await request(app)
      .post(`/api/v1/inquiries/${inqRes.body.inquiry.id}/respond`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ action: 'accept', note: 'Welcome to the deal room.' });
    expect(acceptInq.status).toBe(201);
    dealId = acceptInq.body.deal.id;

    // Buyer proposes offer -> Owner accepts
    const offerRes = await request(app)
      .post(`/api/v1/deals/${dealId}/offers`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        offerType: 'exclusive_license',
        amountMinor: 28000000,
        currency: 'INR',
        termsSummary: 'INR 2,80,000 for exclusive license with 30-day handover support.',
      });
    expect(offerRes.status).toBe(201);

    const acceptOffer = await request(app)
      .post(`/api/v1/offers/${offerRes.body.offer.id}/respond`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ decision: 'accepted' });
    expect(acceptOffer.status).toBe(200);

    // Agreement creation + dual signature
    const agrRes = await request(app)
      .post(`/api/v1/deals/${dealId}/agreements`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Exclusive Software License Agreement — FinSync',
        termsBody: 'Licensor grants Licensee an exclusive commercial license to FinSync v1.0 subject to full fee settlement.',
      });
    expect(agrRes.status).toBe(201);

    await request(app)
      .post(`/api/v1/agreements/${agrRes.body.agreement.id}/sign`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const buyerSign = await request(app)
      .post(`/api/v1/agreements/${agrRes.body.agreement.id}/sign`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyerSign.status).toBe(200);
    expect(buyerSign.body.fullyExecuted).toBe(true);

    // Payment initiation (server calculates 10% commission = 2,800,000 minor)
    const txnRes = await request(app)
      .post(`/api/v1/deals/${dealId}/transactions/initiate`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ idempotencyKey: `idem-${dealId}` });
    expect(txnRes.status).toBe(201);
    expect(txnRes.body.transaction.grossAmountMinor).toBe(28000000);
    expect(txnRes.body.transaction.commissionAmountMinor).toBe(2800000);
    expect(txnRes.body.transaction.netPayoutMinor).toBe(25200000);
    transactionId = txnRes.body.transaction.id;

    // Forged Razorpay webhook must be rejected
    const forgedWebhook = await request(app)
      .post('/api/v1/payments/webhooks/razorpay')
      .set('x-razorpay-signature', 'forged_sig')
      .send({ event: 'payment.captured' });
    expect(forgedWebhook.status).toBe(403);

    // Admin confirms manual invoice settlement
    const settleRes = await request(app)
      .post(`/api/v1/transactions/${transactionId}/confirm-settlement`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ settlementReference: 'UTR-HDFC-99887766' });
    expect(settleRes.status).toBe(200);

    // Owner delivers asset handover -> Buyer confirms receipt
    const deliverRes = await request(app)
      .post(`/api/v1/deals/${dealId}/handover/deliver`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deliveryNotes: 'Signed release bundle delivered with checksum verification.' });
    expect(deliverRes.status).toBe(201);

    const confirmRes = await request(app)
      .post(`/api/v1/deals/${dealId}/handover/confirm`)
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.dealStatus).toBe('completed');
    expect(confirmRes.body.assetStatus).toBe('licensed');

    // Admin analytics reflects completed transaction
    const overviewRes = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.metrics.totalGmvMinor).toBe(28000000);
    expect(overviewRes.body.metrics.totalCommissionMinor).toBe(2800000);

    // Buyer cannot access Admin Overview
    const buyerAdminTry = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyerAdminTry.status).toBe(403);
    expect(buyerOrgId).toBeTruthy();
  });
});
